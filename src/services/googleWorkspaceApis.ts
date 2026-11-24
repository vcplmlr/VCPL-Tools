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

export async function ensureVcplDriveFolder(
  accessToken: string,
  folderName = 'VCPL Pro Storage'
): Promise<string> {
  const escaped = folderName.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    pageSize: '1',
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const searchRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  const searchData = (await searchRes.json()) as { files?: Array<{ id?: string }> };
  const existingId = searchData.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await createDriveFolder(accessToken, folderName.trim());
  if (!created.id) {
    throw new Error('Failed to create Google Drive storage folder.');
  }
  return created.id;
}

export async function uploadFileToDrive(
  accessToken: string,
  file: File,
  parentFolderId?: string
): Promise<DriveFileItem> {
  const metadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }
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

// =============================================================================
// GOOGLE SHEETS API v4
// =============================================================================

export interface SpreadsheetSheetInfo {
  properties: {
    sheetId: number;
    title: string;
    index?: number;
    gridProperties?: { rowCount?: number; columnCount?: number };
  };
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties: {
    title: string;
    locale?: string;
    timeZone?: string;
  };
  sheets: SpreadsheetSheetInfo[];
}

export async function listSpreadsheetsFromDrive(
  accessToken: string,
  pageSize = 25
): Promise<DriveFileItem[]> {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
    q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { files?: DriveFileItem[] };
  return Array.isArray(data.files) ? data.files : [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId.trim()
    )}?fields=spreadsheetId,spreadsheetUrl,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties))`,
    accessToken
  );
  return (await res.json()) as SpreadsheetMetadata;
}

export function formatSheetRange(sheetTitle: string, a1CellRange = 'A1:Z50'): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!${a1CellRange}`;
}

export async function getSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<{ range: string; values: string[][] }> {
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId.trim()
    )}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    accessToken
  );
  const data = (await res.json()) as { range?: string; values?: unknown[][] };
  const rows = Array.isArray(data.values)
    ? data.values.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
      )
    : [];
  return {
    range: data.range || range,
    values: rows,
  };
}

export async function createSpreadsheet(
  accessToken: string,
  title: string,
  initialSheetTitle = 'Ledger'
): Promise<SpreadsheetMetadata> {
  const res = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: title.trim() },
      sheets: [{ properties: { title: initialSheetTitle.trim() || 'Ledger' } }],
    }),
  });
  return (await res.json()) as SpreadsheetMetadata;
}

export async function updateSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<{ updatedCells?: number; updatedRange?: string }> {
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId.trim()
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    }
  );
  return (await res.json()) as { updatedCells?: number; updatedRange?: string };
}

export async function appendSpreadsheetRow(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rowValues: string[]
): Promise<{ updates?: { updatedRange?: string; updatedRows?: number } }> {
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId.trim()
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ majorDimension: 'ROWS', values: [rowValues] }),
    }
  );
  return (await res.json()) as { updates?: { updatedRange?: string; updatedRows?: number } };
}

// =============================================================================
// GOOGLE CALENDAR API v3
// =============================================================================

export interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export interface CalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
}

export async function listUserCalendars(accessToken: string): Promise<CalendarListItem[]> {
  const res = await googleFetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    accessToken
  );
  const data = (await res.json()) as { items?: CalendarListItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId = 'primary',
  options: { timeMin?: string; timeMax?: string; maxResults?: number; q?: string } = {}
): Promise<CalendarEventItem[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(options.maxResults ?? 30),
  });
  if (options.timeMin) params.set('timeMin', options.timeMin);
  if (options.timeMax) params.set('timeMax', options.timeMax);
  if (options.q?.trim()) params.set('q', options.q.trim());

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { items?: CalendarEventItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
  attendeeEmails?: string[];
  timeZone?: string;
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: CalendarEventInput
): Promise<CalendarEventItem> {
  const body: Record<string, unknown> = {
    summary: input.summary.trim(),
    description: input.description?.trim() || undefined,
    location: input.location?.trim() || undefined,
    start: {
      dateTime: input.startIso,
      timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    },
    end: {
      dateTime: input.endIso,
      timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    },
  };
  if (input.attendeeEmails && input.attendeeEmails.length > 0) {
    body.attendees = input.attendeeEmails.map((email) => ({ email: email.trim() }));
  }

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return (await res.json()) as CalendarEventItem;
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<CalendarEventItem> {
  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary.trim();
  if (input.description !== undefined) body.description = input.description.trim();
  if (input.location !== undefined) body.location = input.location.trim();
  if (input.startIso) {
    body.start = {
      dateTime: input.startIso,
      timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    };
  }
  if (input.endIso) {
    body.end = {
      dateTime: input.endIso,
      timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    };
  }

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return (await res.json()) as CalendarEventItem;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

// =============================================================================
// GOOGLE CHAT API v1
// =============================================================================

export const GOOGLE_CHAT_CONSOLE_CONFIG_URL =
  'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=gen-lang-client-0957477595';

export class ChatSetupRequiredError extends Error {
  consoleUrl: string;
  constructor(message: string, consoleUrl = GOOGLE_CHAT_CONSOLE_CONFIG_URL) {
    super(message);
    this.name = 'ChatSetupRequiredError';
    this.consoleUrl = consoleUrl;
  }
}

export interface ChatSpaceItem {
  name: string;
  type?: string;
  spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | string;
  displayName?: string;
  singleUserBotDm?: boolean;
  threaded?: boolean;
  spaceDetails?: { description?: string; guidelines?: string };
}

export interface ChatMessageItem {
  name: string;
  sender?: { name?: string; displayName?: string; type?: string };
  createTime?: string;
  text?: string;
  formattedText?: string;
  thread?: { name?: string };
}

export interface ChatMemberItem {
  name: string;
  role?: string;
  state?: string;
  member?: { name?: string; displayName?: string; type?: string };
}

async function chatFetch(
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
    const msg = await parseGoogleError(res);
    if (
      res.status === 404 ||
      /Google Chat app not found/i.test(msg) ||
      /configure the app/i.test(msg) ||
      /not a Google Workspace/i.test(msg)
    ) {
      throw new ChatSetupRequiredError(msg);
    }
    throw new Error(msg);
  }
  return res;
}

export async function listChatSpaces(
  accessToken: string,
  pageSize = 50
): Promise<ChatSpaceItem[]> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  const res = await chatFetch(
    `https://chat.googleapis.com/v1/spaces?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { spaces?: ChatSpaceItem[] };
  return Array.isArray(data.spaces) ? data.spaces : [];
}

export async function createChatSpace(
  accessToken: string,
  displayName: string,
  spaceType: 'SPACE' | 'GROUP_CHAT' = 'SPACE'
): Promise<ChatSpaceItem> {
  const res = await chatFetch('https://chat.googleapis.com/v1/spaces', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceType,
      displayName: displayName.trim(),
    }),
  });
  return (await res.json()) as ChatSpaceItem;
}

export async function listChatMessages(
  accessToken: string,
  spaceName: string,
  pageSize = 30
): Promise<ChatMessageItem[]> {
  const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: 'createTime desc',
  });
  const res = await chatFetch(
    `https://chat.googleapis.com/v1/${cleanSpace}/messages?${params.toString()}`,
    accessToken
  );
  const data = (await res.json()) as { messages?: ChatMessageItem[] };
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function listChatMemberships(
  accessToken: string,
  spaceName: string
): Promise<ChatMemberItem[]> {
  const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const res = await chatFetch(
    `https://chat.googleapis.com/v1/${cleanSpace}/members?pageSize=50`,
    accessToken
  );
  const data = (await res.json()) as { memberships?: ChatMemberItem[] };
  return Array.isArray(data.memberships) ? data.memberships : [];
}

export async function sendChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<ChatMessageItem> {
  const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const res = await chatFetch(
    `https://chat.googleapis.com/v1/${cleanSpace}/messages`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    }
  );
  return (await res.json()) as ChatMessageItem;
}

export async function deleteChatMessage(
  accessToken: string,
  messageName: string
): Promise<void> {
  await chatFetch(`https://chat.googleapis.com/v1/${messageName}`, accessToken, {
    method: 'DELETE',
  });
}
