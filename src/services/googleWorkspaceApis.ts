import { clearAccessToken } from './googleWorkspaceAuth';

export class WorkspaceAuthExpiredError extends Error {
  constructor(message = 'Your Google Workspace session expired. Please sign in with Google again.') {
    super(message);
    this.name = 'WorkspaceAuthExpiredError';
  }
}

async function parseGoogleError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: { message?: string; status?: string };
      error_description?: string;
    };
    if (data?.error?.message) return data.error.message;
    if (data?.error_description) return data.error_description;
  } catch {
    // Ignore non-JSON error bodies
  }
  return `Google API request failed with HTTP ${res.status}`;
}

async function googleFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearAccessToken();
    throw new WorkspaceAuthExpiredError();
  }
  if (!res.ok) {
    throw new Error(await parseGoogleError(res));
  }
  return res;
}

// =============================================================================
// GOOGLE DRIVE API v3 & DRIVE ACTIVITY API v2
// =============================================================================

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  iconLink?: string;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
}

export type DriveFilterMode = 'all' | 'folders' | 'forms' | 'meet' | 'starred' | 'trashed';

export async function listDriveFiles(
  accessToken: string,
  options: {
    queryText?: string;
    filterMode?: DriveFilterMode;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const clauses: string[] = [];
  const mode = options.filterMode ?? 'all';

  if (mode === 'trashed') {
    clauses.push('trashed = true');
  } else {
    clauses.push('trashed = false');
  }

  if (mode === 'folders') {
    clauses.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (mode === 'forms') {
    clauses.push("mimeType = 'application/vnd.google-apps.form'");
  } else if (mode === 'meet') {
    clauses.push(
      "(name contains 'Meet' or mimeType = 'application/vnd.google-apps.document' or mimeType contains 'video/')"
    );
  } else if (mode === 'starred') {
    clauses.push('starred = true');
  }

  const trimmed = options.queryText?.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    pageSize: String(options.pageSize ?? 25),
    orderBy: 'modifiedTime desc',
    fields:
      'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,iconLink,starred,trashed,parents,owners(displayName,emailAddress))',
    q: clauses.join(' and '),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  if (options.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as {
    files?: DriveFileItem[];
    nextPageToken?: string;
  };
  return {
    files: Array.isArray(data.files) ? data.files : [],
    nextPageToken: data.nextPageToken,
  };
}

export async function createDriveFolder(
  accessToken: string,
  folderName: string
): Promise<DriveFileItem> {
  const res = await googleFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName.trim(),
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  return (await res.json()) as DriveFileItem;
}

export async function uploadFileToDrive(
  accessToken: string,
  file: File
): Promise<DriveFileItem> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,starred,trashed',
    accessToken,
    {
      method: 'POST',
      body: form,
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function renameDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<DriveFileItem> {
  const safeId = encodeURIComponent(fileId.trim());
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,name,mimeType,modifiedTime,webViewLink,starred,trashed`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function setDriveFileStarred(
  accessToken: string,
  fileId: string,
  starred: boolean
): Promise<DriveFileItem> {
  const safeId = encodeURIComponent(fileId.trim());
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,name,starred`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred }),
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function setDriveFileTrashed(
  accessToken: string,
  fileId: string,
  trashed: boolean
): Promise<DriveFileItem> {
  const safeId = encodeURIComponent(fileId.trim());
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,name,trashed`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed }),
    }
  );
  return (await res.json()) as DriveFileItem;
}

export async function deleteDriveFilePermanently(
  accessToken: string,
  fileId: string
): Promise<void> {
  const safeId = encodeURIComponent(fileId.trim());
  await googleFetch(`https://www.googleapis.com/drive/v3/files/${safeId}`, accessToken, {
    method: 'DELETE',
  });
}

const GOOGLE_EXPORT_MAP: Record<string, { exportMime: string; ext: string }> = {
  'application/vnd.google-apps.document': {
    exportMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: '.docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    exportMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    exportMime: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.drawing': {
    exportMime: 'image/png',
    ext: '.png',
  },
};

export async function downloadDriveFile(
  accessToken: string,
  file: DriveFileItem
): Promise<{ blob: Blob; filename: string }> {
  const safeId = encodeURIComponent(file.id.trim());
  const exportConfig = GOOGLE_EXPORT_MAP[file.mimeType];
  if (exportConfig) {
    const res = await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${safeId}/export?mimeType=${encodeURIComponent(
        exportConfig.exportMime
      )}`,
      accessToken
    );
    const blob = await res.blob();
    const filename = file.name.endsWith(exportConfig.ext)
      ? file.name
      : `${file.name}${exportConfig.ext}`;
    return { blob, filename };
  }

  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${safeId}?alt=media`,
    accessToken
  );
  const blob = await res.blob();
  return { blob, filename: file.name };
}

export interface DriveActivityEntry {
  timestamp?: string;
  primaryActionDetail?: Record<string, unknown>;
  targets?: Array<{ driveItem?: { title?: string; name?: string } }>;
}

export async function queryDriveActivity(
  accessToken: string,
  pageSize = 15
): Promise<DriveActivityEntry[]> {
  const res = await googleFetch(
    'https://driveactivity.googleapis.com/v2/activity:query',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize }),
    }
  );
  const data = (await res.json()) as { activities?: DriveActivityEntry[] };
  return Array.isArray(data.activities) ? data.activities : [];
}

// =============================================================================
// GOOGLE FORMS API v1
// =============================================================================

export interface GoogleFormQuestionOption {
  value: string;
}

export interface GoogleFormItem {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: {
    question?: {
      questionId?: string;
      required?: boolean;
      textQuestion?: { paragraph?: boolean };
      choiceQuestion?: {
        type?: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
        options?: GoogleFormQuestionOption[];
      };
      scaleQuestion?: { low?: number; high?: number };
    };
  };
}

export interface GoogleFormDocument {
  formId: string;
  info?: {
    title?: string;
    description?: string;
    documentTitle?: string;
  };
  responderUri?: string;
  linkedSheetId?: string;
  revisionId?: string;
  items?: GoogleFormItem[];
}

export interface GoogleFormResponseItem {
  responseId: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers?: Record<
    string,
    {
      questionId?: string;
      textAnswers?: { answers?: Array<{ value?: string }> };
    }
  >;
}

export async function listFormsFromDrive(accessToken: string): Promise<DriveFileItem[]> {
  const result = await listDriveFiles(accessToken, {
    filterMode: 'forms',
    pageSize: 30,
  });
  return result.files;
}

export async function getGoogleForm(
  accessToken: string,
  formId: string
): Promise<GoogleFormDocument> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await googleFetch(
    `https://forms.googleapis.com/v1/forms/${safeFormId}`,
    accessToken
  );
  return (await res.json()) as GoogleFormDocument;
}

export async function createGoogleForm(
  accessToken: string,
  title: string,
  documentTitle?: string
): Promise<GoogleFormDocument> {
  const res = await googleFetch('https://forms.googleapis.com/v1/forms', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      info: {
        title: title.trim(),
        documentTitle: (documentTitle || title).trim(),
      },
    }),
  });
  return (await res.json()) as GoogleFormDocument;
}

export async function batchUpdateGoogleForm(
  accessToken: string,
  formId: string,
  requests: Array<Record<string, unknown>>
): Promise<{ form?: GoogleFormDocument }> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await googleFetch(
    `https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeFormInResponse: true,
        requests,
      }),
    }
  );
  return (await res.json()) as { form?: GoogleFormDocument };
}

export async function listGoogleFormResponses(
  accessToken: string,
  formId: string
): Promise<GoogleFormResponseItem[]> {
  const safeFormId = encodeURIComponent(formId.trim());
  const res = await googleFetch(
    `https://forms.googleapis.com/v1/forms/${safeFormId}/responses`,
    accessToken
  );
  const data = (await res.json()) as { responses?: GoogleFormResponseItem[] };
  return Array.isArray(data.responses) ? data.responses : [];
}

// =============================================================================
// GOOGLE MEET API v2
// =============================================================================

export type MeetAccessType = 'ACCESS_TYPE_UNSPECIFIED' | 'OPEN' | 'TRUSTED' | 'RESTRICTED';
export type MeetEntryPointAccess = 'ENTRY_POINT_ACCESS_UNSPECIFIED' | 'ALL' | 'CREATOR_APP_ONLY';

export interface MeetSpace {
  name: string;
  meetingUri?: string;
  meetingCode?: string;
  config?: {
    accessType?: MeetAccessType;
    entryPointAccess?: MeetEntryPointAccess;
  };
  activeConference?: {
    conferenceRecord?: string;
  };
}

export interface MeetConferenceRecord {
  name: string;
  startTime?: string;
  endTime?: string;
  expireTime?: string;
  space?: string;
}

export interface MeetParticipant {
  name: string;
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: { user?: string; displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

export interface MeetRecording {
  name: string;
  state?: string;
  startTime?: string;
  endTime?: string;
  driveDestination?: { file?: string; exportUri?: string };
}

function normalizeMeetSpacePath(spaceInput: string): string {
  const trimmed = spaceInput.trim();
  const id = trimmed.startsWith('spaces/') ? trimmed.slice('spaces/'.length) : trimmed;
  return `spaces/${encodeURIComponent(id)}`;
}

function normalizeConferenceRecordPath(recordName: string): string {
  const trimmed = recordName.trim();
  const id = trimmed.startsWith('conferenceRecords/')
    ? trimmed.slice('conferenceRecords/'.length)
    : trimmed;
  return `conferenceRecords/${encodeURIComponent(id)}`;
}

export async function createMeetSpace(
  accessToken: string,
  config?: { accessType?: MeetAccessType; entryPointAccess?: MeetEntryPointAccess }
): Promise<MeetSpace> {
  const body: Record<string, unknown> = {};
  if (config && (config.accessType || config.entryPointAccess)) {
    body.config = config;
  }
  const res = await googleFetch('https://meet.googleapis.com/v2/spaces', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as MeetSpace;
}

export async function getMeetSpace(
  accessToken: string,
  spaceNameOrCode: string
): Promise<MeetSpace> {
  const path = normalizeMeetSpacePath(spaceNameOrCode);
  const res = await googleFetch(`https://meet.googleapis.com/v2/${path}`, accessToken);
  return (await res.json()) as MeetSpace;
}

export async function patchMeetSpaceConfig(
  accessToken: string,
  spaceName: string,
  config: { accessType: MeetAccessType; entryPointAccess: MeetEntryPointAccess }
): Promise<MeetSpace> {
  const path = normalizeMeetSpacePath(spaceName);
  const params = new URLSearchParams({
    updateMask: 'config.accessType,config.entryPointAccess',
  });
  const res = await googleFetch(
    `https://meet.googleapis.com/v2/${path}?${params.toString()}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: spaceName.trim(),
        config,
      }),
    }
  );
  return (await res.json()) as MeetSpace;
}

export async function endMeetActiveConference(
  accessToken: string,
  spaceName: string
): Promise<void> {
  const path = normalizeMeetSpacePath(spaceName);
  await googleFetch(`https://meet.googleapis.com/v2/${path}:endActiveConference`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function listMeetConferenceRecords(
  accessToken: string,
  pageSize = 20
): Promise<MeetConferenceRecord[]> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  const res = await googleFetch(
    `https://meet.googleapis.com/v2/conferenceRecords?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { conferenceRecords?: MeetConferenceRecord[] };
  return Array.isArray(data.conferenceRecords) ? data.conferenceRecords : [];
}

export async function listMeetParticipants(
  accessToken: string,
  recordName: string
): Promise<MeetParticipant[]> {
  const path = normalizeConferenceRecordPath(recordName);
  const res = await googleFetch(
    `https://meet.googleapis.com/v2/${path}/participants?pageSize=50`,
    accessToken
  );
  const data = (await res.json()) as { participants?: MeetParticipant[] };
  return Array.isArray(data.participants) ? data.participants : [];
}

export async function listMeetRecordings(
  accessToken: string,
  recordName: string
): Promise<MeetRecording[]> {
  const path = normalizeConferenceRecordPath(recordName);
  const res = await googleFetch(
    `https://meet.googleapis.com/v2/${path}/recordings?pageSize=20`,
    accessToken
  );
  const data = (await res.json()) as { recordings?: MeetRecording[] };
  return Array.isArray(data.recordings) ? data.recordings : [];
}
