import crypto from 'node:crypto';

export type DriveAuthMode = 'service_account' | 'company_oauth' | 'unconfigured';

export interface CompanyDriveFolderSpec {
  folderKey: string;
  folderName: string;
  parentKey: string;
  moduleId: string;
}

export const VCPL_COMPANY_DRIVE_ROOT_NAME = 'VCPL TOOLS - COMPANY DRIVE';

export const VCPL_COMPANY_DRIVE_FOLDERS: CompanyDriveFolderSpec[] = [
  { folderKey: '01_EMPLOYEE_DOCUMENTS', folderName: '01_EMPLOYEE_DOCUMENTS', parentKey: 'ROOT', moduleId: 'employee-docs' },
  { folderKey: '02_ACCOUNTS_DOCUMENTS', folderName: '02_ACCOUNTS_DOCUMENTS', parentKey: 'ROOT', moduleId: 'accounts-workspace' },
  { folderKey: '02_ACCOUNTS_PURCHASE_INVOICES', folderName: 'PURCHASE_INVOICES', parentKey: '02_ACCOUNTS_DOCUMENTS', moduleId: 'purchase-invoices' },
  { folderKey: '02_ACCOUNTS_SALES_INVOICES', folderName: 'SALES_INVOICES', parentKey: '02_ACCOUNTS_DOCUMENTS', moduleId: 'sales-invoices' },
  { folderKey: '02_ACCOUNTS_BANK_DOCUMENTS', folderName: 'BANK_DOCUMENTS', parentKey: '02_ACCOUNTS_DOCUMENTS', moduleId: 'bank-documents' },
  { folderKey: '02_ACCOUNTS_RECONCILIATION', folderName: 'RECONCILIATION', parentKey: '02_ACCOUNTS_DOCUMENTS', moduleId: 'reconciliation' },
  { folderKey: '02_ACCOUNTS_RETENTION', folderName: 'RETENTION', parentKey: '02_ACCOUNTS_DOCUMENTS', moduleId: 'retention' },
  { folderKey: '03_GENERATED_REPORTS', folderName: '03_GENERATED_REPORTS', parentKey: 'ROOT', moduleId: 'reports' },
  { folderKey: '04_DOCUMENT_VAULT', folderName: '04_DOCUMENT_VAULT', parentKey: 'ROOT', moduleId: 'document-vault' },
  { folderKey: '05_EXCEL_AND_CSV_FILES', folderName: '05_EXCEL_AND_CSV_FILES', parentKey: 'ROOT', moduleId: 'excel-csv' },
  { folderKey: '06_SYSTEM_BACKUPS', folderName: '06_SYSTEM_BACKUPS', parentKey: 'ROOT', moduleId: 'system-backups' },
  { folderKey: '07_ADMIN_RECORDS', folderName: '07_ADMIN_RECORDS', parentKey: 'ROOT', moduleId: 'admin-register' },
  { folderKey: '08_ARCHIVED_DOCUMENTS', folderName: '08_ARCHIVED_DOCUMENTS', parentKey: 'ROOT', moduleId: 'archived-documents' },
];

export function resolveDriveFolderKeyForModule(moduleId: string, mimeType = ''): string {
  const m = (moduleId || '').toLowerCase();
  if (m === 'reports' || m.includes('pnl') || m.includes('incentive') || m.includes('fuel-report')) {
    return '03_GENERATED_REPORTS';
  }
  if (m === 'system-backups') return '06_SYSTEM_BACKUPS';
  if (m === 'admin-register' || m === 'document-studio') return '07_ADMIN_RECORDS';
  if (m.includes('invoice') && m.includes('maker')) return '02_ACCOUNTS_SALES_INVOICES';
  if (m.includes('invoice')) return '02_ACCOUNTS_PURCHASE_INVOICES';
  if (m.includes('bank') || m.includes('rtgs')) return '02_ACCOUNTS_BANK_DOCUMENTS';
  if (
    m.includes('reconcil') ||
    m.includes('reco') ||
    m.includes('26as') ||
    m.includes('gstr') ||
    m.includes('tds') ||
    m === 'auto-ledger'
  ) {
    return '02_ACCOUNTS_RECONCILIATION';
  }
  if (m.includes('compliance') || m.includes('retention')) return '02_ACCOUNTS_RETENTION';
  if (m === 'employee-docs') return '01_EMPLOYEE_DOCUMENTS';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return '05_EXCEL_AND_CSV_FILES';
  }
  return '04_DOCUMENT_VAULT';
}

interface ParsedServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function parseServiceAccountJson(): ParsedServiceAccount | null {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const obj = JSON.parse(decoded) as Partial<ParsedServiceAccount>;
    if (!obj.client_email || !obj.private_key) return null;
    return {
      client_email: obj.client_email,
      private_key: obj.private_key.replace(/\\n/g, '\n'),
      token_uri: obj.token_uri || 'https://oauth2.googleapis.com/token',
    };
  } catch {
    return null;
  }
}

export function getCompanyDriveConfigStatus(): {
  configured: boolean;
  authMode: DriveAuthMode;
  rootFolderId: string;
  sharedDriveId: string;
  serviceAccountEmail: string;
  hasFolderId: boolean;
  missingVars: string[];
} {
  const sa = parseServiceAccountJson();
  const rootFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const sharedDriveId = (process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || '').trim();
  const oauthClientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const oauthClientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  const oauthRefreshToken = (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '').trim();

  let authMode: DriveAuthMode = 'unconfigured';
  if (sa) {
    authMode = 'service_account';
  } else if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    authMode = 'company_oauth';
  }

  const missingVars: string[] = [];
  if (authMode === 'unconfigured') {
    missingVars.push(
      'GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_DRIVE_CLIENT_ID + GOOGLE_DRIVE_CLIENT_SECRET + GOOGLE_DRIVE_REFRESH_TOKEN)'
    );
  }
  if (!rootFolderId) {
    missingVars.push('GOOGLE_DRIVE_FOLDER_ID');
  }

  return {
    configured: authMode !== 'unconfigured' && Boolean(rootFolderId),
    authMode,
    rootFolderId,
    sharedDriveId,
    serviceAccountEmail: sa?.client_email || '',
    hasFolderId: Boolean(rootFolderId),
    missingVars,
  };
}

let cachedAccessToken: { token: string; expiresAtMs: number; mode: DriveAuthMode } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getCompanyDriveAccessToken(): Promise<string> {
  const now = Date.now();
  const status = getCompanyDriveConfigStatus();
  if (
    cachedAccessToken &&
    cachedAccessToken.mode === status.authMode &&
    cachedAccessToken.expiresAtMs > now + 60_000
  ) {
    return cachedAccessToken.token;
  }

  if (status.authMode === 'service_account') {
    const sa = parseServiceAccountJson();
    if (!sa) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is invalid or incomplete.');
    }
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const iat = Math.floor(now / 1000);
    const exp = iat + 3600;
    const impersonateEmail = (process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL || '').trim();

    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims: Record<string, unknown> = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: tokenUri,
      iat,
      exp,
    };
    if (impersonateEmail) {
      claims.sub = impersonateEmail;
    }
    const payload = base64UrlEncode(JSON.stringify(claims));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = base64UrlEncode(signer.sign(sa.private_key));
    const assertion = `${header}.${payload}.${signature}`;

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (!res.ok || !data?.access_token) {
      throw new Error(
        data?.error_description ||
          data?.error ||
          'Failed to obtain Google Service Account access token.'
      );
    }

    cachedAccessToken = {
      token: data.access_token,
      expiresAtMs: now + (Number(data.expires_in || 3600) * 1000),
      mode: 'service_account',
    };
    return cachedAccessToken.token;
  }

  if (status.authMode === 'company_oauth') {
    const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
    const refreshToken = (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '').trim();

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (!res.ok || !data?.access_token) {
      throw new Error(
        data?.error_description ||
          data?.error ||
          'Failed to refresh Company Google Drive OAuth2 access token.'
      );
    }

    cachedAccessToken = {
      token: data.access_token,
      expiresAtMs: now + (Number(data.expires_in || 3600) * 1000),
      mode: 'company_oauth',
    };
    return cachedAccessToken.token;
  }

  throw new Error(
    'Central Company Google Drive is not configured. Set GOOGLE_DRIVE_FOLDER_ID and either GOOGLE_SERVICE_ACCOUNT_JSON or Company OAuth2 refresh credentials.'
  );
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveJsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getCompanyDriveAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const errObj = parsed as { error?: { message?: string } } | null;
    const msg = errObj?.error?.message || text || `Google Drive HTTP ${res.status}`;
    throw new Error(msg);
  }
  return parsed as T;
}

export async function testCompanyDriveConnection(): Promise<{
  ok: boolean;
  configured: boolean;
  authMode: DriveAuthMode;
  rootFolderId: string;
  rootFolderName?: string;
  accountEmail?: string;
  error?: string;
}> {
  const status = getCompanyDriveConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      configured: false,
      authMode: status.authMode,
      rootFolderId: status.rootFolderId,
      accountEmail: status.serviceAccountEmail || undefined,
      error: `Missing env: ${status.missingVars.join(', ')}`,
    };
  }

  try {
    const meta = await driveJsonFetch<{ id: string; name: string; mimeType: string }>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(status.rootFolderId)}?fields=id,name,mimeType&supportsAllDrives=true`
    );
    if (meta.mimeType !== 'application/vnd.google-apps.folder') {
      return {
        ok: false,
        configured: true,
        authMode: status.authMode,
        rootFolderId: status.rootFolderId,
        error: 'Configured GOOGLE_DRIVE_FOLDER_ID is not a Google Drive folder.',
      };
    }
    return {
      ok: true,
      configured: true,
      authMode: status.authMode,
      rootFolderId: meta.id,
      rootFolderName: meta.name,
      accountEmail: status.serviceAccountEmail || undefined,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      authMode: status.authMode,
      rootFolderId: status.rootFolderId,
      accountEmail: status.serviceAccountEmail || undefined,
      error: err instanceof Error ? err.message : 'Unable to verify Company Google Drive folder.',
    };
  }
}

async function findOrCreateSubfolder(parentId: string, folderName: string): Promise<string> {
  const query = [
    `'${escapeDriveQueryLiteral(parentId)}' in parents`,
    `name = '${escapeDriveQueryLiteral(folderName)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ].join(' and ');

  const searchUrl =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}` +
    `&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1`;

  const found = await driveJsonFetch<{ files?: Array<{ id: string; name: string }> }>(searchUrl);
  if (found.files && found.files.length > 0) {
    return found.files[0].id;
  }

  const created = await driveJsonFetch<{ id: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true',
    {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );
  return created.id;
}

export async function ensureCompanyDriveFolderHierarchy(
  existingByKey: Record<string, string> = {}
): Promise<
  Array<{
    folderKey: string;
    folderName: string;
    parentKey: string;
    driveFolderId: string;
    driveParentId: string;
    moduleId: string;
  }>
> {
  const status = getCompanyDriveConfigStatus();
  if (!status.configured) {
    throw new Error(`Company Google Drive not configured (${status.missingVars.join(', ')})`);
  }

  const resolvedIds: Record<string, string> = {
    ...existingByKey,
    ROOT: status.rootFolderId,
  };

  // Optional check: if root folder doesn't already have the VCPL root subfolder, use rootFolderId directly
  // so every standard folder sits directly inside the configured Company Drive Root Folder.
  const out: Array<{
    folderKey: string;
    folderName: string;
    parentKey: string;
    driveFolderId: string;
    driveParentId: string;
    moduleId: string;
  }> = [];

  for (const spec of VCPL_COMPANY_DRIVE_FOLDERS) {
    const parentId = resolvedIds[spec.parentKey] || status.rootFolderId;
    let folderId = resolvedIds[spec.folderKey];
    if (!folderId) {
      folderId = await findOrCreateSubfolder(parentId, spec.folderName);
      resolvedIds[spec.folderKey] = folderId;
    }
    out.push({
      folderKey: spec.folderKey,
      folderName: spec.folderName,
      parentKey: spec.parentKey,
      driveFolderId: folderId,
      driveParentId: parentId,
      moduleId: spec.moduleId,
    });
  }

  return out;
}

export async function uploadFileToCompanyDrive(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  targetFolderId: string;
  description?: string;
}): Promise<{
  driveFileId: string;
  driveFolderId: string;
  driveWebViewLink: string;
  sizeBytes: number;
  sha256: string;
}> {
  const token = await getCompanyDriveAccessToken();
  const safeName = (input.fileName || 'document.bin').replace(/[\\/:*?"<>|]/g, '_').slice(0, 220);
  const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

  const boundary = `vcpl_drive_${crypto.randomBytes(12).toString('hex')}`;
  const metadata = JSON.stringify({
    name: safeName,
    parents: [input.targetFolderId],
    description: input.description || 'Uploaded via VCPL Tools Enterprise Workspace',
  });

  const headPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${
      input.mimeType || 'application/octet-stream'
    }\r\n\r\n`,
    'utf8'
  );
  const tailPart = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipartBody = Buffer.concat([headPart, input.buffer, tailPart]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const payload = (await res.json().catch(() => null)) as {
    id?: string;
    size?: string;
    webViewLink?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok || !payload?.id) {
    throw new Error(
      payload?.error?.message || `Google Drive upload failed (HTTP ${res.status}).`
    );
  }

  return {
    driveFileId: payload.id,
    driveFolderId: input.targetFolderId,
    driveWebViewLink:
      payload.webViewLink || `https://drive.google.com/file/d/${payload.id}/view`,
    sizeBytes: Number(payload.size || input.buffer.byteLength),
    sha256,
  };
}

export async function downloadFileFromCompanyDrive(driveFileId: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const token = await getCompanyDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Google Drive download failed (HTTP ${res.status}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

export async function moveFileInCompanyDrive(
  driveFileId: string,
  targetFolderId: string
): Promise<void> {
  const meta = await driveJsonFetch<{ parents?: string[] }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=parents&supportsAllDrives=true`
  );
  const removeParents = (meta.parents || []).filter((p) => p !== targetFolderId).join(',');
  const params = new URLSearchParams({
    addParents: targetFolderId,
    supportsAllDrives: 'true',
  });
  if (removeParents) {
    params.set('removeParents', removeParents);
  }
  await driveJsonFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?${params.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    }
  );
}

export async function deleteFileFromCompanyDrive(driveFileId: string): Promise<void> {
  const token = await getCompanyDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Google Drive delete failed (HTTP ${res.status}).`);
  }
}
