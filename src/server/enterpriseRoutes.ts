import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import path from 'node:path';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import {
  ALL_ENTERPRISE_MODULES,
  ENTERPRISE_ACCOUNT_STATUSES,
  ENTERPRISE_PERMISSION_ACTIONS,
  type ModulePermissionSet,
  type PermissionActionKey,
  type UserPermissionMatrix,
  buildFullAdminPermissionMatrix,
  createEmptyPermissionSet,
} from '../data/enterpriseModules.ts';
import {
  type EnterpriseDocumentRow,
  type EnterpriseUserRow,
  type ExtendedAccountStatus,
  addDocumentVersionRecord,
  countActiveSuperAdmins,
  createDepartment,
  createDesignation,
  createDocumentWithVersion,
  createReportRecord,
  createSessionRecord,
  createUserRecord,
  createWorkspaceRecord,
  deleteDocumentMetadata,
  deleteWorkspaceRecord,
  ensureEnvSuperAdminSeeded,
  findUserById,
  findUserByUsername,
  getActiveSessionByToken,
  getBatchPermissionsMaps,
  getDocumentById,
  getDriveFoldersMap,
  getEnterprisePersistenceSummary,
  getSharedSetting,
  getUserPermissionsMap,
  getWorkspaceRecordById,
  hardDeleteUser,
  hasActiveSuperAdmin,
  hashPasswordBcrypt,
  listActivityLogs,
  listAuditLogs,
  listDepartments,
  listDesignations,
  listDocumentVersions,
  listDocuments,
  listLoginHistory,
  listReportRecords,
  listResetRequests,
  listUsers,
  listWorkspaceRecords,
  recordActivityEvent,
  recordAuditTrail,
  recordLoginEvent,
  resolveResetRequestsForUser,
  revokeAllUserSessions,
  revokeSessionByToken,
  saveDriveConfigurationAndFolders,
  saveUserPermissionsMap,
  setSharedSetting,
  touchSessionActivity,
  updateDocumentMetadata,
  updateUserFields,
  updateWorkspaceRecord,
  upsertPendingResetRequest,
  verifyPasswordWithMigration,
} from './enterpriseStore.ts';
import {
  deleteFileFromCompanyDrive,
  downloadFileFromCompanyDrive,
  ensureCompanyDriveFolderHierarchy,
  getCompanyDriveConfigStatus,
  moveFileInCompanyDrive,
  resolveDriveFolderKeyForModule,
  testCompanyDriveConnection,
  uploadFileToCompanyDrive,
} from './googleDriveService.ts';
import { checkSupabaseHealth, getPersistenceMode } from './supabaseClient.ts';

const SESSION_COOKIE_NAME = 'vcpl_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const EPHEMERAL_SESSION_KEY = crypto.randomBytes(32).toString('hex');

async function getSessionSigningKey(): Promise<string> {
  const envKey = (
    process.env.SESSION_SECRET ||
    process.env.VCPL_ENTERPRISE_SECRET ||
    process.env.VCPL_ADMIN_SECRET ||
    ''
  ).trim();
  if (envKey) return envKey;

  try {
    const stored = await getSharedSetting('enterprise_signing_key');
    if (stored && stored.length >= 32) {
      return stored;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    await setSharedSetting('enterprise_signing_key', generated);
    return generated;
  } catch {
    return EPHEMERAL_SESSION_KEY;
  }
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      });
      return;
    }
    next();
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function getUserAgent(req: Request): string {
  return String(req.headers['user-agent'] || '').slice(0, 240);
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto.includes('https');
}

function parseCookies(req: Request): Record<string, string> {
  const header = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isSecureRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
  ];
  if (secure) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
  ];
  if (secure) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function verifyCookieCsrfOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  // Requests authenticating explicitly with Authorization Bearer are not cookie-CSRF vulnerable
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) return true;

  // Check Origin/Referer host against Host/X-Forwarded-Host, or verify custom header
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
  const origin = String(req.headers.origin || '');
  if (origin) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase();
      if (originHost === host) return true;
    } catch {
      return false;
    }
    return false;
  }

  return String(req.headers['x-requested-with'] || '') === 'VCPL-Workspace';
}

export function normalizeEnterpriseUsername(raw: unknown): {
  displayUsername: string;
  canonicalUsername: string;
  valid: boolean;
  error?: string;
} {
  const displayUsername = String(raw ?? '').trim();
  const canonicalUsername = displayUsername.toLowerCase();
  if (!displayUsername) {
    return { displayUsername: '', canonicalUsername: '', valid: false, error: 'User ID is required.' };
  }
  if (canonicalUsername.length < 2 || canonicalUsername.length > 48) {
    return {
      displayUsername,
      canonicalUsername,
      valid: false,
      error: 'User ID must be between 2 and 48 characters.',
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(canonicalUsername)) {
    return {
      displayUsername,
      canonicalUsername,
      valid: false,
      error:
        'User ID can contain letters, numbers, dots (.), underscores (_), and hyphens (-), starting with a letter or number.',
    };
  }
  return { displayUsername, canonicalUsername, valid: true };
}

function validateStrongPassword(password: string): string | null {
  if (password.length < 8 || password.length > 128) {
    return 'Password must be between 8 and 128 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least 1 uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least 1 lowercase letter (a-z).';
  }
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must include at least 1 number or special character.';
  }
  return null;
}

function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%&*!';
  const all = upper + lower + digits + special;
  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

interface EnterpriseTokenPayload {
  uid: string;
  role: 'super_admin' | 'employee';
  tv: number;
  pwdChangeOnly: boolean;
  jti: string;
  exp: number;
}

async function signEnterpriseToken(payload: Omit<EnterpriseTokenPayload, 'exp' | 'jti'>): Promise<string> {
  const full: EnterpriseTokenPayload = {
    ...payload,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const key = await getSessionSigningKey();
  const sig = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

async function verifyEnterpriseToken(token: string): Promise<EnterpriseTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const key = await getSessionSigningKey();
  const expected = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  if (!safeEqualStrings(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as EnterpriseTokenPayload;
    if (
      typeof parsed.uid === 'string' &&
      (parsed.role === 'super_admin' || parsed.role === 'employee') &&
      typeof parsed.tv === 'number' &&
      typeof parsed.pwdChangeOnly === 'boolean' &&
      typeof parsed.exp === 'number' &&
      Date.now() < parsed.exp
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isUserStatusActive(status: string): boolean {
  return status === 'Approved' || status === 'Active';
}

function sanitizeUserForClient(
  row: EnterpriseUserRow,
  permissions: UserPermissionMatrix,
  options: { includeAdminFields?: boolean } = {}
) {
  const base = {
    id: row.id,
    username: row.username,
    displayUsername: row.display_username,
    fullName: row.full_name,
    employeeId: row.employee_id,
    department: row.department,
    designation: row.designation,
    contactNumber: row.contact_number,
    role: row.role,
    status: row.status === 'Active' ? 'Approved' : row.status,
    rawStatus: row.status,
    isArchived: Boolean(row.is_archived),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permissions,
  };
  if (options.includeAdminFields) {
    return {
      ...base,
      internalAuthId: row.internal_auth_id,
      createdBy: row.created_by,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
    };
  }
  return base;
}

interface AuthedRequest extends Request {
  enterpriseUser?: EnterpriseUserRow;
  enterpriseToken?: EnterpriseTokenPayload;
  enterpriseRawToken?: string;
  enterpriseSessionId?: string;
  enterprisePermissions?: UserPermissionMatrix;
}

function extractRequestToken(req: Request): string {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return String(cookies[SESSION_COOKIE_NAME] || '').trim();
}

function authenticateEnterprise(options: { allowPwdChangeOnly?: boolean } = {}) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      if (!verifyCookieCsrfOrigin(req)) {
        res.status(403).json({ error: 'Invalid request origin.' });
        return;
      }

      const rawToken = extractRequestToken(req);
      if (!rawToken) {
        res.status(401).json({ error: 'Authentication required. Please sign in.' });
        return;
      }

      const payload = await verifyEnterpriseToken(rawToken);
      if (!payload) {
        clearSessionCookie(req, res);
        res.status(401).json({ error: 'Your session has expired or is invalid. Please sign in again.' });
        return;
      }

      const activeSession = await getActiveSessionByToken(rawToken);
      if (!activeSession) {
        clearSessionCookie(req, res);
        res.status(401).json({ error: 'Session revoked or expired. Please sign in again.' });
        return;
      }

      const user = await findUserById(payload.uid);
      if (!user || user.is_archived || user.token_version !== payload.tv || !isUserStatusActive(user.status)) {
        clearSessionCookie(req, res);
        res.status(401).json({ error: 'Account session revoked or disabled. Contact your Super Admin.' });
        return;
      }

      const mustChange = Boolean(user.must_change_password) || payload.pwdChangeOnly;
      if (mustChange && !options.allowPwdChangeOnly) {
        res.status(403).json({
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'Password update required before accessing VCPL Tools modules.',
        });
        return;
      }

      await touchSessionActivity(activeSession.id, user.id);

      req.enterpriseUser = user;
      req.enterpriseToken = payload;
      req.enterpriseRawToken = rawToken;
      req.enterpriseSessionId = activeSession.id;
      req.enterprisePermissions = await getUserPermissionsMap(user.id, user.role);
      next();
    } catch (err) {
      console.error('Authentication middleware error:', err);
      res.status(500).json({ error: 'Authentication verification failed.' });
    }
  };
}

function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.enterpriseUser || req.enterpriseUser.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access is required for this operation.' });
    return;
  }
  next();
}

function hasModulePermission(
  user: EnterpriseUserRow,
  permissions: UserPermissionMatrix,
  moduleId: string,
  action: PermissionActionKey
): boolean {
  if (user.role === 'super_admin') return true;
  const mod = permissions[moduleId];
  if (!mod) return false;
  if (mod.admin) return true;
  return Boolean(mod[action]);
}

function isValidStatus(value: unknown): value is ExtendedAccountStatus {
  return (
    ENTERPRISE_ACCOUNT_STATUSES.includes(value as (typeof ENTERPRISE_ACCOUNT_STATUSES)[number]) ||
    value === 'Active' ||
    value === 'Password Reset Required'
  );
}

async function resolveTargetDriveFolder(folderKey: string): Promise<{
  folderKey: string;
  driveFolderId: string;
}> {
  const driveStatus = getCompanyDriveConfigStatus();
  if (!driveStatus.configured) {
    throw new Error(
      `Central Company Google Drive is not configured (${driveStatus.missingVars.join(', ')}).`
    );
  }
  const existingMap = await getDriveFoldersMap();
  const existing = existingMap[folderKey];
  if (existing?.drive_folder_id) {
    return { folderKey, driveFolderId: existing.drive_folder_id };
  }

  // Provision hierarchy in Company Google Drive and persist folder IDs
  const idLookup: Record<string, string> = {};
  for (const [k, row] of Object.entries(existingMap)) {
    if (row.drive_folder_id) idLookup[k] = row.drive_folder_id;
  }
  const provisioned = await ensureCompanyDriveFolderHierarchy(idLookup);
  await saveDriveConfigurationAndFolders({
    config: {
      auth_mode: driveStatus.authMode,
      root_folder_id: driveStatus.rootFolderId,
      root_folder_name: 'VCPL TOOLS - COMPANY DRIVE',
      shared_drive_id: driveStatus.sharedDriveId,
      service_account_email: driveStatus.serviceAccountEmail,
      status: 'Connected',
      last_verified_at: new Date().toISOString(),
      last_error: '',
      updated_by: 'system',
    },
    folders: provisioned,
  });

  const matched = provisioned.find((f) => f.folderKey === folderKey);
  return {
    folderKey,
    driveFolderId: matched?.driveFolderId || driveStatus.rootFolderId,
  };
}

export function createEnterpriseRouter(): Router {
  const router = express.Router();
  const authLimiter = createRateLimiter(30, 5 * 60_000);
  const resetLimiter = createRateLimiter(15, 10 * 60_000);

  // =========================================================================
  // 1. SUPER ADMIN STATUS & PROTECTED PROVISIONING (NO PUBLIC SIGNUP)
  // =========================================================================
  router.get('/auth/super-admin-status', async (_req, res) => {
    try {
      const configured = await hasActiveSuperAdmin();
      const mode = getPersistenceMode();
      res.json({
        configured,
        bootstrapProtected: true,
        databaseMode: mode,
      });
    } catch {
      res.json({ configured: true, bootstrapProtected: true, databaseMode: getPersistenceMode() });
    }
  });

  // Protected one-time provisioning (requires VCPL_SUPER_ADMIN_BOOTSTRAP_TOKEN env var when called via API)
  router.post('/auth/bootstrap-super-admin', authLimiter, async (req, res) => {
    try {
      await ensureEnvSuperAdminSeeded();
      const alreadyConfigured = await hasActiveSuperAdmin();
      if (alreadyConfigured) {
        res.status(409).json({
          error: 'Super Admin account is already provisioned. Sign in with your User ID and password.',
        });
        return;
      }

      const bootstrapTokenEnv = (process.env.VCPL_SUPER_ADMIN_BOOTSTRAP_TOKEN || '').trim();
      const suppliedToken = String(
        (req.body as { bootstrapToken?: unknown })?.bootstrapToken ||
          req.headers['x-vcpl-bootstrap-token'] ||
          ''
      ).trim();

      if (!bootstrapTokenEnv || !suppliedToken || !safeEqualStrings(suppliedToken, bootstrapTokenEnv)) {
        res.status(403).json({
          error:
            'Public Super Admin self-registration is disabled. Provision Super Admin via SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD or VCPL_SUPER_ADMIN_BOOTSTRAP_TOKEN in server environment variables.',
        });
        return;
      }

      const body = (req.body || {}) as {
        username?: unknown;
        password?: unknown;
        fullName?: unknown;
        designation?: unknown;
        contactNumber?: unknown;
      };

      const norm = normalizeEnterpriseUsername(body.username);
      if (!norm.valid) {
        res.status(400).json({ error: norm.error });
        return;
      }
      const password = String(body.password ?? '');
      const pwdErr = validateStrongPassword(password);
      if (pwdErr) {
        res.status(400).json({ error: pwdErr });
        return;
      }
      const fullName = String(body.fullName ?? '').trim();
      if (fullName.length < 2 || fullName.length > 120) {
        res.status(400).json({ error: 'Full Name is required (2–120 characters).' });
        return;
      }

      const existing = await findUserByUsername(norm.canonicalUsername);
      if (existing) {
        res.status(409).json({ error: `User ID "${norm.displayUsername}" already exists.` });
        return;
      }

      const passwordHash = await hashPasswordBcrypt(password);
      const created = await createUserRecord({
        username: norm.canonicalUsername,
        displayUsername: norm.displayUsername,
        passwordHash,
        fullName,
        employeeId: 'ADMIN-01',
        department: 'Administration',
        designation: String(body.designation ?? 'Super Admin / Director').trim() || 'Super Admin / Director',
        contactNumber: String(body.contactNumber ?? '').trim().slice(0, 40),
        role: 'super_admin',
        status: 'Approved',
        mustChangePassword: false,
        createdBy: 'protected-bootstrap',
      });

      const token = await signEnterpriseToken({
        uid: created.id,
        role: 'super_admin',
        tv: created.token_version,
        pwdChangeOnly: false,
      });

      await createSessionRecord({
        userId: created.id,
        rawToken: token,
        tokenVersion: created.token_version,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      await recordLoginEvent({
        userId: created.id,
        username: created.username,
        displayUsername: created.display_username,
        role: 'super_admin',
        outcome: 'success',
        detail: 'Protected Super Admin provisioning completed.',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      setSessionCookie(req, res, token);
      res.status(201).json({
        token,
        requiresPasswordChange: false,
        user: sanitizeUserForClient(created, buildFullAdminPermissionMatrix(), { includeAdminFields: true }),
      });
    } catch (err) {
      console.error('Protected bootstrap error:', err);
      res.status(500).json({ error: 'Unable to provision Super Admin account.' });
    }
  });

  // =========================================================================
  // 2. SINGLE TALLY-STYLE WORKSPACE AUTHENTICATION (COOKIES + SESSIONS)
  // =========================================================================
  router.post('/auth/login', authLimiter, async (req, res) => {
    try {
      await ensureEnvSuperAdminSeeded();
      const body = (req.body || {}) as { username?: unknown; password?: unknown };
      const norm = normalizeEnterpriseUsername(body.username);
      const password = String(body.password ?? '');

      if (!norm.valid || !password) {
        res.status(400).json({ error: 'User ID and password are both required.' });
        return;
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);
      const user = await findUserByUsername(norm.canonicalUsername);

      if (!user) {
        await recordLoginEvent({
          userId: '',
          username: norm.canonicalUsername,
          displayUsername: norm.displayUsername,
          outcome: 'failed_unknown_user',
          detail: 'Unknown User ID attempt.',
          ipAddress,
          userAgent,
        });
        res.status(401).json({ error: 'Invalid User ID or password.' });
        return;
      }

      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        await recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          role: user.role,
          outcome: 'denied_locked',
          detail: 'Account temporarily locked due to repeated failed attempts.',
          ipAddress,
          userAgent,
        });
        res.status(423).json({
          code: 'ACCOUNT_LOCKED',
          error: 'Too many failed login attempts. Account temporarily locked; wait 15 minutes or ask your Super Admin to reset access.',
        });
        return;
      }

      const pwdCheck = await verifyPasswordWithMigration(password, user.password_hash);
      if (!pwdCheck.valid) {
        const nextAttempts = (user.failed_login_attempts || 0) + 1;
        const lockedUntil =
          nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
            : null;
        await updateUserFields(user.id, {
          failed_login_attempts: nextAttempts,
          locked_until: lockedUntil,
        });

        await recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          role: user.role,
          outcome: 'failed_password',
          detail: `Invalid password attempt (${nextAttempts}/${MAX_FAILED_LOGIN_ATTEMPTS}).`,
          ipAddress,
          userAgent,
        });
        res.status(401).json({ error: 'Invalid User ID or password.' });
        return;
      }

      // Migrate legacy scrypt hash transparently to bcryptjs cost 12
      if (pwdCheck.needsRehash) {
        const nextHash = await hashPasswordBcrypt(password);
        await updateUserFields(user.id, { password_hash: nextHash });
      }

      if (user.is_archived) {
        await recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          role: user.role,
          outcome: 'denied_archived',
          detail: 'Login blocked because account is archived.',
          ipAddress,
          userAgent,
        });
        res.status(403).json({
          code: 'ACCOUNT_ARCHIVED',
          error: 'This account has been archived. Please contact your Super Admin.',
        });
        return;
      }

      if (!isUserStatusActive(user.status)) {
        const statusMessages: Record<string, { outcome: string; code: string; error: string }> = {
          'Pending Approval': {
            outcome: 'denied_pending',
            code: 'PENDING_APPROVAL',
            error: 'Your account is awaiting Super Admin approval. Please contact your administrator.',
          },
          Rejected: {
            outcome: 'denied_rejected',
            code: 'ACCOUNT_REJECTED',
            error: 'Your account request has been rejected. Please contact your Super Admin.',
          },
          Suspended: {
            outcome: 'denied_suspended',
            code: 'ACCOUNT_SUSPENDED',
            error: 'Your account has been suspended by the Super Admin.',
          },
          Inactive: {
            outcome: 'denied_inactive',
            code: 'ACCOUNT_INACTIVE',
            error: 'Your account is currently inactive. Please contact your Super Admin.',
          },
          'Password Reset Required': {
            outcome: 'denied_reset_required',
            code: 'PASSWORD_RESET_REQUIRED',
            error: 'Password reset pending with Super Admin. Contact your administrator for your temporary password.',
          },
        };
        const statusInfo = statusMessages[user.status] || statusMessages.Inactive;
        await recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          role: user.role,
          outcome: statusInfo.outcome,
          detail: `Login denied (${user.status}).`,
          ipAddress,
          userAgent,
        });
        res.status(403).json({ code: statusInfo.code, error: statusInfo.error });
        return;
      }

      const now = new Date().toISOString();
      await updateUserFields(user.id, {
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: now,
        last_active_at: now,
      });
      user.last_login_at = now;
      user.last_active_at = now;

      const mustChange = Boolean(user.must_change_password);
      const token = await signEnterpriseToken({
        uid: user.id,
        role: user.role,
        tv: user.token_version,
        pwdChangeOnly: mustChange,
      });

      await createSessionRecord({
        userId: user.id,
        rawToken: token,
        tokenVersion: user.token_version,
        ipAddress,
        userAgent,
      });

      await recordLoginEvent({
        userId: user.id,
        username: user.username,
        displayUsername: user.display_username,
        role: user.role,
        outcome: 'success',
        detail: mustChange
          ? 'Authenticated with temporary password (password change required).'
          : 'Authenticated successfully.',
        ipAddress,
        userAgent,
      });

      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'USER_LOGIN',
        targetType: 'session',
        targetId: user.id,
        summary: mustChange
          ? `${user.full_name} signed in with temporary password.`
          : `${user.full_name} signed in to VCPL Workspace.`,
      });

      setSessionCookie(req, res, token);
      const perms = mustChange ? {} : await getUserPermissionsMap(user.id, user.role);
      res.json({
        token,
        requiresPasswordChange: mustChange,
        user: sanitizeUserForClient(user, perms, {
          includeAdminFields: user.role === 'super_admin',
        }),
      });
    } catch (err) {
      console.error('Enterprise login error:', err);
      res.status(500).json({ error: 'Authentication error. Please try again.' });
    }
  });

  router.get(
    '/auth/me',
    authenticateEnterprise({ allowPwdChangeOnly: true }),
    async (req: AuthedRequest, res) => {
      const user = req.enterpriseUser!;
      const mustChange = Boolean(user.must_change_password) || Boolean(req.enterpriseToken?.pwdChangeOnly);
      res.json({
        requiresPasswordChange: mustChange,
        user: sanitizeUserForClient(user, mustChange ? {} : req.enterprisePermissions || {}, {
          includeAdminFields: user.role === 'super_admin',
        }),
      });
    }
  );

  router.post(
    '/auth/change-password',
    authenticateEnterprise({ allowPwdChangeOnly: true }),
    async (req: AuthedRequest, res) => {
      try {
        const user = req.enterpriseUser!;
        const body = (req.body || {}) as {
          currentPassword?: unknown;
          newPassword?: unknown;
          confirmPassword?: unknown;
        };

        const currentPassword = String(body.currentPassword ?? '');
        const newPassword = String(body.newPassword ?? '');
        const confirmPassword = String(body.confirmPassword ?? '');

        if (!currentPassword || !newPassword || !confirmPassword) {
          res.status(400).json({ error: 'Current password, new password, and confirmation are all required.' });
          return;
        }
        const pwdCheck = await verifyPasswordWithMigration(currentPassword, user.password_hash);
        if (!pwdCheck.valid) {
          res.status(401).json({ error: 'Current or temporary password is incorrect.' });
          return;
        }
        if (newPassword !== confirmPassword) {
          res.status(400).json({ error: 'New password and confirmation do not match.' });
          return;
        }
        if (newPassword === currentPassword) {
          res.status(400).json({
            error: 'New password cannot be the same as your temporary or current password.',
          });
          return;
        }
        const pwdErr = validateStrongPassword(newPassword);
        if (pwdErr) {
          res.status(400).json({ error: pwdErr });
          return;
        }

        const nextHash = await hashPasswordBcrypt(newPassword);
        const nextVersion = user.token_version + 1;
        const now = new Date().toISOString();

        // Invalidate all prior sessions & temp password immediately
        await revokeAllUserSessions(user.id, 'password_changed');
        const updated = await updateUserFields(user.id, {
          password_hash: nextHash,
          must_change_password: false,
          failed_login_attempts: 0,
          locked_until: null,
          token_version: nextVersion,
          last_active_at: now,
        });
        if (!updated) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const token = await signEnterpriseToken({
          uid: updated.id,
          role: updated.role,
          tv: updated.token_version,
          pwdChangeOnly: false,
        });

        await createSessionRecord({
          userId: updated.id,
          rawToken: token,
          tokenVersion: updated.token_version,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        await recordLoginEvent({
          userId: updated.id,
          username: updated.username,
          displayUsername: updated.display_username,
          role: updated.role,
          outcome: 'password_changed',
          detail: 'Password updated and temporary password invalidated.',
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        await recordActivityEvent({
          actorUserId: updated.id,
          actorUsername: updated.username,
          action: 'PASSWORD_CHANGED',
          targetType: 'user',
          targetId: updated.id,
          summary: `${updated.full_name} updated password and unlocked workspace access.`,
        });

        setSessionCookie(req, res, token);
        const perms = await getUserPermissionsMap(updated.id, updated.role);
        res.json({
          token,
          requiresPasswordChange: false,
          user: sanitizeUserForClient(updated, perms, {
            includeAdminFields: updated.role === 'super_admin',
          }),
        });
      } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Unable to update password.' });
      }
    }
  );

  router.post('/auth/forgot-password', resetLimiter, async (req, res) => {
    try {
      const body = (req.body || {}) as { username?: unknown; note?: unknown };
      const norm = normalizeEnterpriseUsername(body.username);
      if (!norm.valid) {
        res.status(400).json({ error: norm.error });
        return;
      }

      const user = await findUserByUsername(norm.canonicalUsername);
      const note = String(body.note ?? '').trim().slice(0, 400);

      if (user && !user.is_archived) {
        await upsertPendingResetRequest({
          userId: user.id,
          username: user.username,
          fullName: user.full_name,
          note,
        });
        await recordActivityEvent({
          actorUserId: user.id,
          actorUsername: user.username,
          action: 'PASSWORD_RESET_REQUESTED',
          targetType: 'reset_request',
          targetId: user.id,
          summary: `${user.full_name} submitted a manual password reset request.`,
        });
      }

      res.json({
        ok: true,
        message:
          'If this User ID is registered, your password reset request has been queued for the Super Admin. No automatic email is sent—contact your administrator directly for your temporary password.',
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Unable to submit password reset request.' });
    }
  });

  router.post('/auth/logout', async (req, res) => {
    try {
      const rawToken = extractRequestToken(req);
      if (rawToken) {
        const payload = await verifyEnterpriseToken(rawToken);
        await revokeSessionByToken(rawToken, 'user_logout');
        if (payload?.uid) {
          const user = await findUserById(payload.uid);
          if (user) {
            await recordActivityEvent({
              actorUserId: user.id,
              actorUsername: user.username,
              action: 'USER_LOGOUT',
              targetType: 'session',
              targetId: user.id,
              summary: `${user.full_name} signed out.`,
            });
          }
        }
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    } catch {
      clearSessionCookie(req, res);
      res.json({ ok: true });
    }
  });

  // =========================================================================
  // 3. SUPER ADMIN GOVERNANCE, DEPARTMENTS, DESIGNATIONS, USERS & RBAC
  // =========================================================================
  router.get('/admin/departments', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const departments = await listDepartments();
      res.json({ departments });
    } catch (err) {
      console.error('List departments error:', err);
      res.status(500).json({ error: 'Unable to load departments.' });
    }
  });

  router.post('/admin/departments', authenticateEnterprise(), requireSuperAdmin, async (req: AuthedRequest, res) => {
    try {
      const actor = req.enterpriseUser!;
      const body = (req.body || {}) as { name?: unknown; code?: unknown; description?: unknown };
      const name = String(body.name ?? '').trim().slice(0, 100);
      const code = String(body.code ?? '').trim().slice(0, 16);
      if (name.length < 2 || code.length < 2) {
        res.status(400).json({ error: 'Department name and short code (2+ characters) are required.' });
        return;
      }
      const created = await createDepartment({
        name,
        code,
        description: String(body.description ?? '').trim().slice(0, 240),
      });
      await recordAuditTrail({
        actorUserId: actor.id,
        actorUsername: actor.username,
        category: 'governance',
        eventType: 'DEPARTMENT_CREATED',
        targetType: 'department',
        targetId: created.id,
        after: created,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      res.status(201).json({ department: created });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create department.' });
    }
  });

  router.get('/admin/designations', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const designations = await listDesignations();
      res.json({ designations });
    } catch (err) {
      console.error('List designations error:', err);
      res.status(500).json({ error: 'Unable to load designations.' });
    }
  });

  router.post('/admin/designations', authenticateEnterprise(), requireSuperAdmin, async (req: AuthedRequest, res) => {
    try {
      const actor = req.enterpriseUser!;
      const body = (req.body || {}) as {
        departmentId?: unknown;
        name?: unknown;
        defaultPermissions?: UserPermissionMatrix;
      };
      const name = String(body.name ?? '').trim().slice(0, 100);
      if (name.length < 2) {
        res.status(400).json({ error: 'Designation name is required.' });
        return;
      }
      const created = await createDesignation({
        departmentId: typeof body.departmentId === 'string' ? body.departmentId.trim() : undefined,
        name,
        defaultPermissions: body.defaultPermissions || {},
      });
      await recordAuditTrail({
        actorUserId: actor.id,
        actorUsername: actor.username,
        category: 'governance',
        eventType: 'DESIGNATION_CREATED',
        targetType: 'designation',
        targetId: created.id,
        after: created,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      res.status(201).json({ designation: created });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create designation.' });
    }
  });

  router.get('/admin/users', authenticateEnterprise(), requireSuperAdmin, async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
      const rows = await listUsers(includeArchived);
      const permMap = await getBatchPermissionsMaps(rows);
      const users = rows.map((row) =>
        sanitizeUserForClient(row, permMap[row.id] || {}, { includeAdminFields: true })
      );
      res.json({ users });
    } catch (err) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Unable to load users.' });
    }
  });

  router.post('/admin/users', authenticateEnterprise(), requireSuperAdmin, async (req: AuthedRequest, res) => {
    try {
      const actor = req.enterpriseUser!;
      const body = (req.body || {}) as {
        username?: unknown;
        temporaryPassword?: unknown;
        fullName?: unknown;
        employeeId?: unknown;
        department?: unknown;
        designation?: unknown;
        contactNumber?: unknown;
        role?: unknown;
        status?: unknown;
        permissions?: UserPermissionMatrix;
      };

      const norm = normalizeEnterpriseUsername(body.username);
      if (!norm.valid) {
        res.status(400).json({ error: norm.error });
        return;
      }

      const fullName = String(body.fullName ?? '').trim();
      if (fullName.length < 2 || fullName.length > 120) {
        res.status(400).json({ error: 'Full Name is required (2–120 characters).' });
        return;
      }

      const existing = await findUserByUsername(norm.canonicalUsername);
      if (existing) {
        res.status(409).json({
          code: 'USERNAME_EXISTS',
          error: `User ID "${norm.displayUsername}" already exists (registered as "${existing.display_username}").`,
        });
        return;
      }

      const rawTempPwd = String(body.temporaryPassword ?? '').trim();
      const tempPassword = rawTempPwd || generateTempPassword(12);
      if (tempPassword.length < 8 || tempPassword.length > 128) {
        res.status(400).json({ error: 'Temporary password must be between 8 and 128 characters.' });
        return;
      }

      const role: 'super_admin' | 'employee' = body.role === 'super_admin' ? 'super_admin' : 'employee';
      const status: ExtendedAccountStatus = isValidStatus(body.status) ? body.status : 'Approved';
      const passwordHash = await hashPasswordBcrypt(tempPassword);

      const created = await createUserRecord({
        username: norm.canonicalUsername,
        displayUsername: norm.displayUsername,
        passwordHash,
        fullName,
        employeeId: String(body.employeeId ?? '').trim().slice(0, 64),
        department: String(body.department ?? 'Operations').trim().slice(0, 100) || 'Operations',
        designation: String(body.designation ?? 'Staff').trim().slice(0, 100) || 'Staff',
        contactNumber: String(body.contactNumber ?? '').trim().slice(0, 40),
        role,
        status,
        mustChangePassword: true,
        createdBy: actor.username,
      });

      if (role === 'employee' && body.permissions && typeof body.permissions === 'object') {
        await saveUserPermissionsMap(created.id, body.permissions, actor.username);
      }

      const perms = await getUserPermissionsMap(created.id, created.role);

      await recordActivityEvent({
        actorUserId: actor.id,
        actorUsername: actor.username,
        action: 'USER_CREATED',
        targetType: 'user',
        targetId: created.id,
        summary: `Created account ${created.display_username} (${created.full_name}) with status "${status}".`,
      });
      await recordAuditTrail({
        actorUserId: actor.id,
        actorUsername: actor.username,
        category: 'user_management',
        eventType: 'USER_CREATED',
        targetType: 'user',
        targetId: created.id,
        after: { username: created.username, role: created.role, status: created.status },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.status(201).json({
        user: sanitizeUserForClient(created, perms, { includeAdminFields: true }),
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      console.error('Create enterprise user error:', err);
      res.status(500).json({ error: 'Unable to create user account.' });
    }
  });

  router.patch('/admin/users/:id', authenticateEnterprise(), requireSuperAdmin, async (req: AuthedRequest, res) => {
    try {
      const actor = req.enterpriseUser!;
      const targetId = String(req.params.id || '');
      const existing = await findUserById(targetId);
      if (!existing) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }

      const body = (req.body || {}) as {
        fullName?: unknown;
        employeeId?: unknown;
        department?: unknown;
        designation?: unknown;
        contactNumber?: unknown;
        displayUsername?: unknown;
        role?: unknown;
      };

      const fullName =
        body.fullName !== undefined ? String(body.fullName).trim() : existing.full_name;
      if (fullName.length < 2 || fullName.length > 120) {
        res.status(400).json({ error: 'Full Name must be between 2 and 120 characters.' });
        return;
      }

      let nextDisplayUsername = existing.display_username;
      let nextCanonicalUsername = existing.username;
      if (body.displayUsername !== undefined) {
        const norm = normalizeEnterpriseUsername(body.displayUsername);
        if (!norm.valid) {
          res.status(400).json({ error: norm.error });
          return;
        }
        if (norm.canonicalUsername !== existing.username) {
          const clash = await findUserByUsername(norm.canonicalUsername);
          if (clash && clash.id !== targetId) {
            res.status(409).json({ error: `User ID "${norm.displayUsername}" already exists.` });
            return;
          }
        }
        nextDisplayUsername = norm.displayUsername;
        nextCanonicalUsername = norm.canonicalUsername;
      }

      let nextRole: 'super_admin' | 'employee' = existing.role;
      if (body.role === 'super_admin' || body.role === 'employee') {
        if (existing.role === 'super_admin' && body.role === 'employee') {
          const adminCount = await countActiveSuperAdmins();
          if (adminCount <= 1) {
            res.status(400).json({ error: 'Cannot demote the last active Super Admin account.' });
            return;
          }
        }
        nextRole = body.role;
      }

      const updated = await updateUserFields(targetId, {
        username: nextCanonicalUsername,
        display_username: nextDisplayUsername,
        full_name: fullName,
        employee_id:
          body.employeeId !== undefined
            ? String(body.employeeId).trim().slice(0, 64)
            : existing.employee_id,
        department:
          body.department !== undefined
            ? String(body.department).trim().slice(0, 100) || 'Operations'
            : existing.department,
        designation:
          body.designation !== undefined
            ? String(body.designation).trim().slice(0, 100) || 'Staff'
            : existing.designation,
        contact_number:
          body.contactNumber !== undefined
            ? String(body.contactNumber).trim().slice(0, 40)
            : existing.contact_number,
        role: nextRole,
      });

      if (!updated) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }

      const perms = await getUserPermissionsMap(updated.id, updated.role);
      await recordActivityEvent({
        actorUserId: actor.id,
        actorUsername: actor.username,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId,
        summary: `Updated details & designation for ${updated.display_username} (${updated.designation}).`,
      });
      await recordAuditTrail({
        actorUserId: actor.id,
        actorUsername: actor.username,
        category: 'user_management',
        eventType: 'USER_UPDATED',
        targetType: 'user',
        targetId,
        before: { department: existing.department, designation: existing.designation, role: existing.role },
        after: { department: updated.department, designation: updated.designation, role: updated.role },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ user: sanitizeUserForClient(updated, perms, { includeAdminFields: true }) });
    } catch (err) {
      console.error('Update enterprise user error:', err);
      res.status(500).json({ error: 'Unable to update user details.' });
    }
  });

  router.patch(
    '/admin/users/:id/status',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const nextStatus = (req.body as { status?: unknown })?.status;

        if (!isValidStatus(nextStatus)) {
          res.status(400).json({
            error: `Status must be one of: ${ENTERPRISE_ACCOUNT_STATUSES.join(', ')}.`,
          });
          return;
        }

        const existing = await findUserById(targetId);
        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const becomingInactive = !isUserStatusActive(nextStatus);
        if (existing.id === actor.id && becomingInactive) {
          res.status(400).json({ error: 'Super Admin cannot suspend or deactivate their own active session.' });
          return;
        }
        if (existing.role === 'super_admin' && isUserStatusActive(existing.status) && becomingInactive) {
          const activeAdmins = await countActiveSuperAdmins();
          if (activeAdmins <= 1) {
            res.status(400).json({ error: 'Cannot disable the last active Super Admin account.' });
            return;
          }
        }

        const nextTv = becomingInactive ? existing.token_version + 1 : existing.token_version;
        if (becomingInactive) {
          await revokeAllUserSessions(targetId, `status_${nextStatus}`);
        }

        const updated = await updateUserFields(targetId, {
          status: nextStatus,
          token_version: nextTv,
          ...(isUserStatusActive(nextStatus) ? { failed_login_attempts: 0, locked_until: null } : {}),
        });

        if (!updated) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const perms = await getUserPermissionsMap(updated.id, updated.role);
        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_STATUS_CHANGED',
          targetType: 'user',
          targetId,
          summary: `Changed status for ${updated.display_username} from "${existing.status}" to "${nextStatus}".`,
        });

        res.json({ user: sanitizeUserForClient(updated, perms, { includeAdminFields: true }) });
      } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Unable to update user status.' });
      }
    }
  );

  router.put(
    '/admin/users/:id/permissions',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const existing = await findUserById(targetId);
        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const matrix = (req.body as { permissions?: UserPermissionMatrix })?.permissions;
        if (!matrix || typeof matrix !== 'object') {
          res.status(400).json({ error: 'Valid permissions object is required.' });
          return;
        }

        const beforePerms = await getUserPermissionsMap(targetId, existing.role);
        await saveUserPermissionsMap(targetId, matrix, actor.username);
        const updated = await updateUserFields(targetId, {});
        const afterPerms = await getUserPermissionsMap(targetId, existing.role);

        const enabledModuleCount = Object.values(matrix).filter((m) =>
          Boolean(m && Object.values(m).some(Boolean))
        ).length;

        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'PERMISSIONS_UPDATED',
          targetType: 'user',
          targetId,
          summary: `Updated tool permissions for ${existing.display_username} (${enabledModuleCount} modules enabled).`,
        });
        await recordAuditTrail({
          actorUserId: actor.id,
          actorUsername: actor.username,
          category: 'permissions',
          eventType: 'PERMISSIONS_UPDATED',
          targetType: 'user',
          targetId,
          before: { moduleCount: Object.keys(beforePerms).length },
          after: { moduleCount: enabledModuleCount },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.json({
          user: sanitizeUserForClient(updated || existing, afterPerms, { includeAdminFields: true }),
        });
      } catch (err) {
        console.error('Update permissions error:', err);
        res.status(500).json({ error: 'Unable to update user permissions.' });
      }
    }
  );

  router.post(
    '/admin/users/:id/reset-password',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const body = (req.body || {}) as { temporaryPassword?: unknown; requestId?: unknown };

        const existing = await findUserById(targetId);
        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const rawTemp = String(body.temporaryPassword ?? '').trim();
        const temporaryPassword = rawTemp || generateTempPassword(12);
        if (temporaryPassword.length < 8 || temporaryPassword.length > 128) {
          res.status(400).json({ error: 'Temporary password must be between 8 and 128 characters.' });
          return;
        }

        const nextHash = await hashPasswordBcrypt(temporaryPassword);
        const nextTv = existing.token_version + 1;

        await revokeAllUserSessions(targetId, 'admin_password_reset');
        const updated = await updateUserFields(targetId, {
          password_hash: nextHash,
          must_change_password: true,
          failed_login_attempts: 0,
          locked_until: null,
          token_version: nextTv,
        });

        await resolveResetRequestsForUser({
          requestId: typeof body.requestId === 'string' ? body.requestId.trim() : undefined,
          userId: targetId,
          status: 'Approved',
          resolvedBy: actor.display_username,
        });

        const perms = await getUserPermissionsMap(targetId, existing.role);
        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'ADMIN_PASSWORD_RESET',
          targetType: 'user',
          targetId,
          summary: `Issued temporary password for ${existing.display_username} (mandatory change enforced on next login).`,
        });

        res.json({
          temporaryPassword,
          user: sanitizeUserForClient(updated || existing, perms, { includeAdminFields: true }),
        });
      } catch (err) {
        console.error('Admin password reset error:', err);
        res.status(500).json({ error: 'Unable to reset user password.' });
      }
    }
  );

  router.patch(
    '/admin/users/:id/archive',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const archived = Boolean((req.body as { archived?: unknown })?.archived ?? true);
        const existing = await findUserById(targetId);

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }
        if (existing.id === actor.id && archived) {
          res.status(400).json({ error: 'Super Admin cannot archive their own account.' });
          return;
        }
        if (existing.role === 'super_admin' && archived && !existing.is_archived) {
          const activeAdmins = await countActiveSuperAdmins();
          if (activeAdmins <= 1) {
            res.status(400).json({ error: 'Cannot archive the last active Super Admin account.' });
            return;
          }
        }

        const nextTv = archived ? existing.token_version + 1 : existing.token_version;
        if (archived) {
          await revokeAllUserSessions(targetId, 'user_archived');
        }

        const updated = await updateUserFields(targetId, {
          is_archived: archived,
          token_version: nextTv,
        });

        const perms = await getUserPermissionsMap(targetId, existing.role);
        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: archived ? 'USER_ARCHIVED' : 'USER_RESTORED',
          targetType: 'user',
          targetId,
          summary: `${archived ? 'Archived' : 'Restored'} user account ${existing.display_username}.`,
        });

        res.json({
          user: sanitizeUserForClient(updated || existing, perms, { includeAdminFields: true }),
        });
      } catch (err) {
        console.error('Archive user error:', err);
        res.status(500).json({ error: 'Unable to update archive status.' });
      }
    }
  );

  router.delete(
    '/admin/users/:id',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        if (targetId === actor.id) {
          res.status(400).json({ error: 'Super Admin cannot delete their own active account.' });
          return;
        }

        const existing = await findUserById(targetId);
        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        if (existing.role === 'super_admin' && !existing.is_archived && isUserStatusActive(existing.status)) {
          const activeAdmins = await countActiveSuperAdmins();
          if (activeAdmins <= 1) {
            res.status(400).json({ error: 'Cannot delete the last active Super Admin account.' });
            return;
          }
        }

        await revokeAllUserSessions(targetId, 'user_deleted');
        await hardDeleteUser(targetId);

        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_DELETED',
          targetType: 'user',
          targetId,
          summary: `Deleted user account ${existing.display_username} (${existing.full_name}).`,
        });

        res.json({ ok: true });
      } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Unable to delete user account.' });
      }
    }
  );

  // =========================================================================
  // 4. PASSWORD RESET REQUESTS, LOGIN HISTORY, ACTIVITY & AUDIT LOGS
  // =========================================================================
  router.get('/admin/reset-requests', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const requests = await listResetRequests();
      res.json({ requests });
    } catch {
      res.status(500).json({ error: 'Unable to load password reset requests.' });
    }
  });

  router.post(
    '/admin/reset-requests/:id/reject',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const reqId = String(req.params.id || '');
        const note = String((req.body as { note?: unknown })?.note ?? '').trim().slice(0, 400);

        const resolved = await resolveResetRequestsForUser({
          requestId: reqId,
          userId: '',
          status: 'Rejected',
          resolvedBy: actor.display_username,
          note,
        });
        if (!resolved) {
          res.status(404).json({ error: 'Password reset request not found.' });
          return;
        }

        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'RESET_REQUEST_REJECTED',
          targetType: 'reset_request',
          targetId: reqId,
          summary: `Rejected password reset request (${reqId}).`,
        });
        res.json({ ok: true });
      } catch {
        res.status(500).json({ error: 'Unable to reject reset request.' });
      }
    }
  );

  router.get('/admin/login-history', authenticateEnterprise(), requireSuperAdmin, async (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const history = await listLoginHistory(userId);
      res.json({ history });
    } catch {
      res.status(500).json({ error: 'Unable to load login history.' });
    }
  });

  router.get('/admin/activity-logs', authenticateEnterprise(), requireSuperAdmin, async (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const logs = await listActivityLogs(userId);
      res.json({ logs });
    } catch {
      res.status(500).json({ error: 'Unable to load activity logs.' });
    }
  });

  router.get('/admin/audit-logs', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const logs = await listAuditLogs(200);
      res.json({ auditLogs: logs });
    } catch {
      res.status(500).json({ error: 'Unable to load audit logs.' });
    }
  });

  // =========================================================================
  // 5. CENTRAL COMPANY GOOGLE DRIVE STATUS, FOLDERS & DOCUMENT STORAGE
  // =========================================================================
  router.get('/admin/drive/status', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const configStatus = getCompanyDriveConfigStatus();
      const folders = await getDriveFoldersMap();
      const liveTest = await testCompanyDriveConnection();
      res.json({
        configStatus,
        liveConnection: liveTest,
        folders: Object.values(folders),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to check Company Google Drive status.',
      });
    }
  });

  router.post(
    '/admin/drive/initialize',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const configStatus = getCompanyDriveConfigStatus();
        if (!configStatus.configured) {
          res.status(503).json({
            error: `Company Google Drive credentials are missing: ${configStatus.missingVars.join(', ')}`,
          });
          return;
        }

        const existingMap = await getDriveFoldersMap();
        const existingLookup: Record<string, string> = {};
        for (const [k, v] of Object.entries(existingMap)) {
          if (v.drive_folder_id) existingLookup[k] = v.drive_folder_id;
        }

        const provisioned = await ensureCompanyDriveFolderHierarchy(existingLookup);
        const live = await testCompanyDriveConnection();

        await saveDriveConfigurationAndFolders({
          config: {
            auth_mode: configStatus.authMode,
            root_folder_id: configStatus.rootFolderId,
            root_folder_name: live.rootFolderName || 'VCPL TOOLS - COMPANY DRIVE',
            shared_drive_id: configStatus.sharedDriveId,
            service_account_email: configStatus.serviceAccountEmail,
            status: live.ok ? 'Connected' : 'Error',
            last_verified_at: new Date().toISOString(),
            last_error: live.error || '',
            updated_by: actor.username,
          },
          folders: provisioned,
        });

        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'COMPANY_DRIVE_INITIALIZED',
          targetType: 'google_drive',
          targetId: configStatus.rootFolderId,
          summary: `Verified & initialized ${provisioned.length} Company Google Drive workspace folders.`,
        });

        res.json({
          ok: true,
          liveConnection: live,
          folders: provisioned,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Company Google Drive folder initialization failed.';
        res.status(502).json({ error: msg });
      }
    }
  );

  router.get('/documents', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const moduleFilter = String(req.query.moduleId ?? '').trim();
      const statusFilter = String(req.query.status ?? '').trim();
      const folderFilter = String(req.query.folderKey ?? '').trim();
      const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
      const search = String(req.query.search ?? '').trim();

      if (moduleFilter && !hasModulePermission(user, perms, moduleFilter, 'view')) {
        res.status(403).json({ error: `View permission required for ${moduleFilter}.` });
        return;
      }
      if (
        !moduleFilter &&
        !hasModulePermission(user, perms, 'document-vault', 'view') &&
        !hasModulePermission(user, perms, 'document-studio', 'view')
      ) {
        res.status(403).json({ error: 'View permission required for Document Vault or Document Studio.' });
        return;
      }

      const docs = await listDocuments({
        moduleId: moduleFilter || undefined,
        status: statusFilter || undefined,
        folderKey: folderFilter || undefined,
        includeArchived,
        search: search || undefined,
        limit: 300,
      });

      const visibleDocs = moduleFilter
        ? docs
        : docs.filter(
            (d) =>
              hasModulePermission(user, perms, d.module_id, 'view') ||
              hasModulePermission(user, perms, 'document-vault', 'view')
          );

      res.json({ documents: visibleDocs });
    } catch (err) {
      console.error('List documents error:', err);
      res.status(500).json({ error: 'Unable to load documents.' });
    }
  });

  router.get('/documents/:id/versions', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const docId = String(req.params.id || '');
      const docRow = await getDocumentById(docId);
      if (!docRow) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      if (
        !hasModulePermission(user, perms, docRow.module_id, 'view') &&
        !hasModulePermission(user, perms, 'document-vault', 'view')
      ) {
        res.status(403).json({ error: 'View permission required.' });
        return;
      }
      const versions = await listDocumentVersions(docId);
      res.json({ versions });
    } catch {
      res.status(500).json({ error: 'Unable to load document versions.' });
    }
  });

  router.post('/documents/upload', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const body = (req.body || {}) as {
        moduleId?: unknown;
        folderKey?: unknown;
        title?: unknown;
        fileName?: unknown;
        mimeType?: unknown;
        base64Data?: unknown;
        tags?: unknown;
        notes?: unknown;
        replaceDocumentId?: unknown;
      };

      const moduleId = String(body.moduleId ?? 'document-vault').trim() || 'document-vault';
      if (
        !hasModulePermission(user, perms, moduleId, 'upload') &&
        !hasModulePermission(user, perms, 'document-vault', 'upload')
      ) {
        res.status(403).json({ error: 'Upload access is not permitted for your account.' });
        return;
      }

      const fileName = path.basename(String(body.fileName ?? '').trim() || 'document.bin').slice(0, 255);
      const title = String(body.title ?? fileName).trim().slice(0, 180) || fileName;
      const mimeType = String(body.mimeType ?? 'application/octet-stream').trim().slice(0, 160);
      const rawBase64 = String(body.base64Data ?? '');

      if (!rawBase64) {
        res.status(400).json({ error: 'File content is required for upload.' });
        return;
      }
      const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',').pop() || '' : rawBase64;
      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      if (fileBuffer.length === 0 || fileBuffer.length > 15 * 1024 * 1024) {
        res.status(400).json({ error: 'File size must be between 1 byte and 15 MB.' });
        return;
      }

      const requestedFolderKey = String(body.folderKey ?? '').trim();
      const targetFolderKey =
        requestedFolderKey || resolveDriveFolderKeyForModule(moduleId, mimeType);

      // Strictly upload to Central Company Google Drive (NO local disk / Supabase Storage)
      let driveTarget: { folderKey: string; driveFolderId: string };
      let uploadRes: {
        driveFileId: string;
        driveFolderId: string;
        driveWebViewLink: string;
        sizeBytes: number;
        sha256: string;
      };
      try {
        driveTarget = await resolveTargetDriveFolder(targetFolderKey);
        uploadRes = await uploadFileToCompanyDrive({
          buffer: fileBuffer,
          fileName,
          mimeType,
          targetFolderId: driveTarget.driveFolderId,
          description: `VCPL Module: ${moduleId} | Uploaded by: ${user.display_username}`,
        });
      } catch (driveErr) {
        const msg =
          driveErr instanceof Error
            ? driveErr.message
            : 'Central Company Google Drive upload failed.';
        await recordAuditTrail({
          actorUserId: user.id,
          actorUsername: user.username,
          category: 'document_drive',
          eventType: 'DRIVE_UPLOAD_FAILED',
          targetType: 'document',
          targetId: fileName,
          after: { moduleId, error: msg },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
        res.status(503).json({
          code: 'COMPANY_DRIVE_UPLOAD_FAILED',
          error: `Upload stopped because Central Company Google Drive failed: ${msg}`,
        });
        return;
      }

      const replaceDocId = String(body.replaceDocumentId ?? '').trim();
      if (replaceDocId) {
        const existingDoc = await getDocumentById(replaceDocId);
        if (!existingDoc) {
          res.status(404).json({ error: 'Target document for replacement not found.' });
          return;
        }
        const nextVersion = (existingDoc.version_number || 1) + 1;
        await addDocumentVersionRecord({
          documentId: existingDoc.id,
          versionNumber: nextVersion,
          fileName,
          mimeType,
          sizeBytes: uploadRes.sizeBytes,
          driveFileId: uploadRes.driveFileId,
          driveWebViewLink: uploadRes.driveWebViewLink,
          checksumSha256: uploadRes.sha256,
          notes: String(body.notes ?? `Replaced with version v${nextVersion}`).trim().slice(0, 400),
          uploadedBy: user.id,
          uploadedByUsername: user.username,
        });
        const updatedDoc = await updateDocumentMetadata(existingDoc.id, {
          title,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: uploadRes.sizeBytes,
          drive_file_id: uploadRes.driveFileId,
          drive_folder_id: uploadRes.driveFolderId,
          drive_web_view_link: uploadRes.driveWebViewLink,
          checksum_sha256: uploadRes.sha256,
          version_number: nextVersion,
          approval_status: 'Pending Review',
        });

        await recordActivityEvent({
          actorUserId: user.id,
          actorUsername: user.username,
          action: 'DOCUMENT_VERSION_UPLOADED',
          targetType: 'document',
          targetId: existingDoc.id,
          summary: `Uploaded v${nextVersion} of "${title}" (${fileName}) to Company Google Drive.`,
        });
        res.status(201).json({ document: updatedDoc });
        return;
      }

      const docId = `doc_${crypto.randomUUID()}`;
      const created = await createDocumentWithVersion({
        id: docId,
        moduleId,
        folderKey: driveTarget.folderKey,
        title,
        fileName,
        mimeType,
        sizeBytes: uploadRes.sizeBytes,
        approvalStatus: 'Pending Review',
        driveFileId: uploadRes.driveFileId,
        driveFolderId: uploadRes.driveFolderId,
        driveWebViewLink: uploadRes.driveWebViewLink,
        checksumSha256: uploadRes.sha256,
        tags: String(body.tags ?? '').trim().slice(0, 240),
        notes: String(body.notes ?? '').trim().slice(0, 400),
        uploadedBy: user.id,
        uploadedByUsername: user.username,
      });

      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_UPLOADED',
        targetType: 'document',
        targetId: docId,
        summary: `Uploaded "${title}" (${fileName}, ${Math.ceil(uploadRes.sizeBytes / 1024)} KB) to Company Google Drive (${driveTarget.folderKey}).`,
      });

      res.status(201).json({ document: created });
    } catch (err) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: 'Unable to upload document to Company Google Drive.' });
    }
  });

  router.get('/documents/:id/download', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const docId = String(req.params.id || '');
      const row = await getDocumentById(docId);

      if (!row) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (
        !hasModulePermission(user, perms, row.module_id, 'download') &&
        !hasModulePermission(user, perms, 'document-vault', 'download')
      ) {
        res.status(403).json({ error: 'Download permission is required.' });
        return;
      }

      if (!row.drive_file_id) {
        res.status(404).json({
          error: 'No Central Company Google Drive file ID is linked to this document.',
        });
        return;
      }

      const fileData = await downloadFileFromCompanyDrive(row.drive_file_id);

      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_DOWNLOADED',
        targetType: 'document',
        targetId: docId,
        summary: `Downloaded "${row.file_name}" from Company Google Drive.`,
      });

      const safeFilename = row.file_name.replace(/["\r\n]/g, '');
      res.setHeader('Content-Type', row.mime_type || fileData.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(fileData.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to download file from Company Google Drive.';
      res.status(502).json({ error: msg });
    }
  });

  router.patch('/documents/:id', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const docId = String(req.params.id || '');
      const body = (req.body || {}) as {
        title?: unknown;
        approvalStatus?: unknown;
        tags?: unknown;
        notes?: unknown;
        isArchived?: unknown;
      };

      const row = await getDocumentById(docId);
      if (!row) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (body.approvalStatus !== undefined && body.approvalStatus !== row.approval_status) {
        if (
          !hasModulePermission(user, perms, row.module_id, 'approve') &&
          !hasModulePermission(user, perms, 'document-vault', 'approve')
        ) {
          res.status(403).json({ error: 'Approve permission is required to approve or reject documents.' });
          return;
        }
      }

      if (
        body.title !== undefined ||
        body.tags !== undefined ||
        body.notes !== undefined ||
        body.isArchived !== undefined
      ) {
        if (
          !hasModulePermission(user, perms, row.module_id, 'edit') &&
          !hasModulePermission(user, perms, 'document-vault', 'edit') &&
          !hasModulePermission(user, perms, 'document-vault', 'upload')
        ) {
          res.status(403).json({ error: 'Edit permission is required to modify document metadata.' });
          return;
        }
      }

      const allowedApprovals = new Set<EnterpriseDocumentRow['approval_status']>([
        'Draft',
        'Pending Review',
        'Approved',
        'Rejected',
      ]);
      const nextApproval: EnterpriseDocumentRow['approval_status'] =
        typeof body.approvalStatus === 'string' &&
        allowedApprovals.has(body.approvalStatus as EnterpriseDocumentRow['approval_status'])
          ? (body.approvalStatus as EnterpriseDocumentRow['approval_status'])
          : row.approval_status;

      const patch: Parameters<typeof updateDocumentMetadata>[1] = {
        title: body.title !== undefined ? String(body.title).trim().slice(0, 180) || row.title : row.title,
        approval_status: nextApproval,
        tags: body.tags !== undefined ? String(body.tags).trim().slice(0, 240) : row.tags,
        notes: body.notes !== undefined ? String(body.notes).trim().slice(0, 400) : row.notes,
        approved_by:
          nextApproval === 'Approved' || nextApproval === 'Rejected'
            ? user.display_username
            : row.approved_by,
      };

      if (typeof body.isArchived === 'boolean' && body.isArchived !== row.is_archived) {
        patch.is_archived = body.isArchived;
        patch.archived_at = body.isArchived ? new Date().toISOString() : null;
        if (body.isArchived && row.drive_file_id && getCompanyDriveConfigStatus().configured) {
          try {
            const archiveTarget = await resolveTargetDriveFolder('08_ARCHIVED_DOCUMENTS');
            await moveFileInCompanyDrive(row.drive_file_id, archiveTarget.driveFolderId);
            patch.folder_key = archiveTarget.folderKey;
            patch.drive_folder_id = archiveTarget.driveFolderId;
          } catch (moveErr) {
            console.warn('Company Drive move-to-archive warning:', moveErr);
          }
        }
      }

      const updated = await updateDocumentMetadata(docId, patch);
      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_UPDATED',
        targetType: 'document',
        targetId: docId,
        summary: `Updated "${row.title}" (status: ${nextApproval}${patch.is_archived ? ', archived' : ''}).`,
      });

      res.json({ document: updated });
    } catch (err) {
      console.error('Update document error:', err);
      res.status(500).json({ error: 'Unable to update document.' });
    }
  });

  router.delete('/documents/:id', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const docId = String(req.params.id || '');
      const row = await getDocumentById(docId);

      if (!row) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (
        !hasModulePermission(user, perms, row.module_id, 'delete') &&
        !hasModulePermission(user, perms, 'document-vault', 'delete')
      ) {
        res.status(403).json({ error: 'Delete permission is required to remove documents.' });
        return;
      }

      if (row.drive_file_id && getCompanyDriveConfigStatus().configured) {
        try {
          await deleteFileFromCompanyDrive(row.drive_file_id);
        } catch (driveErr) {
          res.status(502).json({
            error: `Company Google Drive file removal failed: ${
              driveErr instanceof Error ? driveErr.message : 'Drive error'
            }`,
          });
          return;
        }
      }

      await deleteDocumentMetadata(docId);
      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_DELETED',
        targetType: 'document',
        targetId: docId,
        summary: `Deleted "${row.file_name}" from Company Google Drive and database.`,
      });
      await recordAuditTrail({
        actorUserId: user.id,
        actorUsername: user.username,
        category: 'document_drive',
        eventType: 'DOCUMENT_DELETED',
        targetType: 'document',
        targetId: docId,
        before: { fileName: row.file_name, driveFileId: row.drive_file_id },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Delete document error:', err);
      res.status(500).json({ error: 'Unable to delete document.' });
    }
  });

  // =========================================================================
  // 6. CENTRALIZED WORKSPACE RECORDS
  // =========================================================================
  router.get('/records', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const moduleId = String(req.query.moduleId ?? '').trim();

      if (moduleId && !hasModulePermission(user, perms, moduleId, 'view')) {
        res.status(403).json({ error: `View permission required for ${moduleId}.` });
        return;
      }

      const rows = await listWorkspaceRecords(moduleId);
      const visible = moduleId
        ? rows
        : rows.filter((r) => hasModulePermission(user, perms, r.module_id, 'view'));
      res.json({ records: visible });
    } catch {
      res.status(500).json({ error: 'Unable to load workspace records.' });
    }
  });

  router.post('/records', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const body = (req.body || {}) as {
        moduleId?: unknown;
        recordTitle?: unknown;
        referenceCode?: unknown;
        status?: unknown;
        payload?: unknown;
      };

      const moduleId = String(body.moduleId ?? '').trim();
      if (!moduleId) {
        res.status(400).json({ error: 'moduleId is required.' });
        return;
      }
      if (!hasModulePermission(user, perms, moduleId, 'create')) {
        res.status(403).json({ error: `Create permission is required for ${moduleId}.` });
        return;
      }

      const recordTitle = String(body.recordTitle ?? '').trim().slice(0, 200);
      if (!recordTitle) {
        res.status(400).json({ error: 'Record title is required.' });
        return;
      }

      const created = await createWorkspaceRecord({
        moduleId,
        recordTitle,
        referenceCode: String(body.referenceCode ?? '').trim().slice(0, 100),
        status: String(body.status ?? 'Active').trim().slice(0, 64) || 'Active',
        payload: body.payload ?? {},
        createdBy: user.id,
        createdByUsername: user.username,
      });

      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'RECORD_CREATED',
        targetType: 'record',
        targetId: created.id,
        summary: `Created record "${recordTitle}" in ${moduleId}.`,
      });

      res.status(201).json({ record: created });
    } catch {
      res.status(500).json({ error: 'Unable to create workspace record.' });
    }
  });

  router.patch('/records/:id', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const id = String(req.params.id || '');
      const existing = await getWorkspaceRecordById(id);
      if (!existing) {
        res.status(404).json({ error: 'Workspace record not found.' });
        return;
      }

      const body = (req.body || {}) as {
        recordTitle?: unknown;
        referenceCode?: unknown;
        status?: unknown;
        payload?: unknown;
      };

      const isApprovalOnly =
        body.status !== undefined &&
        (body.status === 'Approved' || body.status === 'Rejected') &&
        body.recordTitle === undefined &&
        body.payload === undefined;

      if (isApprovalOnly) {
        if (!hasModulePermission(user, perms, existing.module_id, 'approve')) {
          res.status(403).json({ error: `Approve permission required for ${existing.module_id}.` });
          return;
        }
      } else if (!hasModulePermission(user, perms, existing.module_id, 'edit')) {
        res.status(403).json({ error: `Edit permission required for ${existing.module_id}.` });
        return;
      }

      const updated = await updateWorkspaceRecord(id, {
        record_title:
          body.recordTitle !== undefined
            ? String(body.recordTitle).trim().slice(0, 200) || existing.record_title
            : undefined,
        reference_code:
          body.referenceCode !== undefined
            ? String(body.referenceCode).trim().slice(0, 100)
            : undefined,
        status:
          body.status !== undefined
            ? String(body.status).trim().slice(0, 64) || existing.status
            : undefined,
        payload: body.payload,
        updated_by: user.username,
      });

      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: isApprovalOnly ? 'RECORD_APPROVED' : 'RECORD_UPDATED',
        targetType: 'record',
        targetId: id,
        summary: `${isApprovalOnly ? 'Status updated to ' + body.status : 'Updated'} "${existing.record_title}" in ${existing.module_id}.`,
      });

      res.json({ record: updated });
    } catch {
      res.status(500).json({ error: 'Unable to update workspace record.' });
    }
  });

  router.delete('/records/:id', authenticateEnterprise(), async (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const id = String(req.params.id || '');
      const existing = await getWorkspaceRecordById(id);
      if (!existing) {
        res.status(404).json({ error: 'Workspace record not found.' });
        return;
      }

      if (!hasModulePermission(user, perms, existing.module_id, 'delete')) {
        res.status(403).json({ error: `Delete permission required for ${existing.module_id}.` });
        return;
      }

      await deleteWorkspaceRecord(id);
      await recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'RECORD_DELETED',
        targetType: 'record',
        targetId: id,
        summary: `Deleted record "${existing.record_title}" from ${existing.module_id}.`,
      });

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Unable to delete workspace record.' });
    }
  });

  // =========================================================================
  // 7. DOCUMENT REPORTS, CSV/EXCEL EXPORTS & SYSTEM BACKUP / RESTORE
  // =========================================================================
  router.get('/admin/reports/summary', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const docs = await listDocuments({ includeArchived: true, limit: 1000 });
      const reports = await listReportRecords(150);
      const audits = await listAuditLogs(200);
      const users = await listUsers(true);

      const byModule: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byFolder: Record<string, number> = {};
      const byUploader: Record<string, { count: number; bytes: number }> = {};
      let totalBytes = 0;

      for (const d of docs) {
        totalBytes += Number(d.size_bytes || 0);
        byModule[d.module_id] = (byModule[d.module_id] || 0) + 1;
        byStatus[d.approval_status] = (byStatus[d.approval_status] || 0) + 1;
        byFolder[d.folder_key] = (byFolder[d.folder_key] || 0) + 1;
        const emp = d.uploaded_by_username || 'system';
        if (!byUploader[emp]) byUploader[emp] = { count: 0, bytes: 0 };
        byUploader[emp].count += 1;
        byUploader[emp].bytes += Number(d.size_bytes || 0);
      }

      const failedDriveEvents = audits.filter((a) => a.event_type === 'DRIVE_UPLOAD_FAILED');

      res.json({
        totals: {
          documentsCount: docs.length,
          archivedDocumentsCount: docs.filter((d) => d.is_archived).length,
          totalStorageBytes: totalBytes,
          usersCount: users.length,
          reportsCount: reports.length,
          failedUploadCount: failedDriveEvents.length,
        },
        byModule,
        byStatus,
        byFolder,
        byUploader,
        failedDriveEvents: failedDriveEvents.slice(0, 20),
        reports,
      });
    } catch (err) {
      console.error('Report summary error:', err);
      res.status(500).json({ error: 'Unable to compile document reports summary.' });
    }
  });

  router.post(
    '/admin/reports/generate',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const body = (req.body || {}) as {
          reportType?: unknown;
          format?: unknown;
          moduleFilter?: unknown;
        };

        const reportType = String(body.reportType ?? 'documents_register');
        const format: 'csv' | 'xlsx' = body.format === 'xlsx' ? 'xlsx' : 'csv';
        const moduleFilter = String(body.moduleFilter ?? 'all').trim() || 'all';
        const stamp = new Date().toISOString().slice(0, 10);

        let reportTitle = 'VCPL Documents Register Report';
        let headers: string[] = [];
        let rows: Array<Array<string | number>> = [];

        if (reportType === 'users_permissions') {
          reportTitle = 'VCPL Employees & Tool Permissions Report';
          const users = await listUsers(true);
          const permMap = await getBatchPermissionsMaps(users);
          headers = [
            'User ID',
            'Full Name',
            'Employee ID',
            'Department',
            'Designation',
            'Role',
            'Status',
            'Archived',
            'Enabled Modules',
            'Last Login',
          ];
          rows = users.map((u) => {
            const p = permMap[u.id] || {};
            const count =
              u.role === 'super_admin'
                ? ALL_ENTERPRISE_MODULES.length
                : Object.values(p).filter((m) => Object.values(m).some(Boolean)).length;
            return [
              u.display_username,
              u.full_name,
              u.employee_id,
              u.department,
              u.designation,
              u.role,
              u.status,
              u.is_archived ? 'Yes' : 'No',
              count,
              u.last_login_at || '-',
            ];
          });
        } else if (reportType === 'audit_trail') {
          reportTitle = 'VCPL Security & Activity Audit Report';
          const acts = await listActivityLogs();
          headers = ['Timestamp', 'Actor', 'Action', 'Target Type', 'Target ID', 'Summary'];
          rows = acts.map((a) => [
            a.created_at,
            a.actor_username,
            a.action,
            a.target_type,
            a.target_id,
            a.summary,
          ]);
        } else if (reportType === 'workspace_records') {
          reportTitle = 'VCPL Central Workspace Records Report';
          const recs = await listWorkspaceRecords(moduleFilter === 'all' ? '' : moduleFilter);
          headers = ['ID', 'Module', 'Title', 'Reference Code', 'Status', 'Created By', 'Updated At'];
          rows = recs.map((r) => [
            r.id,
            r.module_id,
            r.record_title,
            r.reference_code,
            r.status,
            r.created_by_username,
            r.updated_at,
          ]);
        } else {
          const docs = await listDocuments({
            moduleId: moduleFilter === 'all' ? undefined : moduleFilter,
            includeArchived: true,
            limit: 1000,
          });
          headers = [
            'Document ID',
            'Title',
            'File Name',
            'Module',
            'Company Drive Folder',
            'Approval Status',
            'Size (Bytes)',
            'Version',
            'Uploaded By',
            'Google Drive File ID',
            'Updated At',
          ];
          rows = docs.map((d) => [
            d.id,
            d.title,
            d.file_name,
            d.module_id,
            d.folder_key,
            d.approval_status,
            d.size_bytes,
            d.version_number,
            d.uploaded_by_username,
            d.drive_file_id,
            d.updated_at,
          ]);
        }

        const safeFileBase = `vcpl_${reportType}_${stamp}`;
        let fileBuffer: Buffer;
        let fileName: string;
        let mimeType: string;

        if (format === 'xlsx') {
          const wb = new ExcelJS.Workbook();
          wb.creator = 'VCPL Tools Enterprise';
          const ws = wb.addWorksheet('VCPL Report');
          ws.addRow([reportTitle, `Generated: ${new Date().toISOString()}`]);
          ws.addRow(headers);
          for (const r of rows) ws.addRow(r);
          ws.getRow(2).font = { bold: true };
          const arrBuf = await wb.xlsx.writeBuffer();
          fileBuffer = Buffer.from(arrBuf);
          fileName = `${safeFileBase}.xlsx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else {
          const escapeCsv = (val: string | number) => {
            const s = String(val ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };
          const csvText = [
            headers.map(escapeCsv).join(','),
            ...rows.map((r) => r.map(escapeCsv).join(',')),
          ].join('\r\n');
          fileBuffer = Buffer.from(`\uFEFF${csvText}`, 'utf8');
          fileName = `${safeFileBase}.csv`;
          mimeType = 'text/csv; charset=utf-8';
        }

        let driveFileId = '';
        let driveWebViewLink = '';
        let statusLabel = 'Local Export Only (Company Drive Not Configured)';

        if (getCompanyDriveConfigStatus().configured) {
          try {
            const folder = await resolveTargetDriveFolder('03_GENERATED_REPORTS');
            const uploaded = await uploadFileToCompanyDrive({
              buffer: fileBuffer,
              fileName,
              mimeType,
              targetFolderId: folder.driveFolderId,
              description: `Generated Report: ${reportTitle} by ${actor.display_username}`,
            });
            driveFileId = uploaded.driveFileId;
            driveWebViewLink = uploaded.driveWebViewLink;
            statusLabel = 'Stored in Company Google Drive';
          } catch (driveErr) {
            statusLabel = `Generated (Drive archive error: ${
              driveErr instanceof Error ? driveErr.message : 'Drive error'
            })`;
          }
        }

        const record = await createReportRecord({
          report_type: reportType,
          report_title: reportTitle,
          format,
          module_filter: moduleFilter,
          date_range_label: 'All Time',
          row_count: rows.length,
          drive_file_id: driveFileId,
          drive_web_view_link: driveWebViewLink,
          file_name: fileName,
          size_bytes: fileBuffer.byteLength,
          status: statusLabel,
          generated_by: actor.id,
          generated_by_username: actor.username,
        });

        await recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'REPORT_GENERATED',
          targetType: 'report',
          targetId: record.id,
          summary: `Generated ${format.toUpperCase()} report "${reportTitle}" (${rows.length} rows).`,
        });

        res.status(201).json({
          report: record,
          fileName,
          mimeType,
          downloadBase64: fileBuffer.toString('base64'),
        });
      } catch (err) {
        console.error('Report generation error:', err);
        res.status(500).json({ error: 'Unable to generate report.' });
      }
    }
  );

  // Database Backup & Confirmed Restore (Company Drive: 06_SYSTEM_BACKUPS)
  router.get('/admin/backups', authenticateEnterprise(), requireSuperAdmin, async (_req, res) => {
    try {
      const all = await listReportRecords(200);
      const backups = all.filter((r) => r.report_type === 'system_backup');
      res.json({ backups });
    } catch {
      res.status(500).json({ error: 'Unable to list backup records.' });
    }
  });

  router.post(
    '/admin/backups/create',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const users = await listUsers(true);
        const permissionsByUser = await getBatchPermissionsMaps(users);
        const departments = await listDepartments();
        const designations = await listDesignations();
        const resetRequests = await listResetRequests();
        const documents = await listDocuments({ includeArchived: true, limit: 2000 });
        const records = await listWorkspaceRecords();

        const snapshot = {
          schemaVersion: 'vcpl-enterprise-v2',
          exportedAt: new Date().toISOString(),
          exportedBy: actor.username,
          departments,
          designations,
          users: users.map((u) => sanitizeUserForClient(u, permissionsByUser[u.id] || {}, { includeAdminFields: true })),
          permissionsByUser,
          resetRequests,
          documents,
          records,
        };

        const jsonBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8');
        const fileName = `vcpl_db_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        let driveFileId = '';
        let driveWebViewLink = '';
        let status = 'Downloaded Locally (Company Drive Not Configured)';

        if (getCompanyDriveConfigStatus().configured) {
          const folder = await resolveTargetDriveFolder('06_SYSTEM_BACKUPS');
          const uploaded = await uploadFileToCompanyDrive({
            buffer: jsonBuffer,
            fileName,
            mimeType: 'application/json',
            targetFolderId: folder.driveFolderId,
            description: `VCPL System Database Backup exported by ${actor.display_username}`,
          });
          driveFileId = uploaded.driveFileId;
          driveWebViewLink = uploaded.driveWebViewLink;
          status = 'Backed Up to Company Google Drive (06_SYSTEM_BACKUPS)';
        }

        const backupRec = await createReportRecord({
          report_type: 'system_backup',
          report_title: `Database Backup (${users.length} users, ${documents.length} docs, ${records.length} records)`,
          format: 'json',
          module_filter: 'all',
          date_range_label: 'Full Snapshot',
          row_count: users.length + documents.length + records.length,
          drive_file_id: driveFileId,
          drive_web_view_link: driveWebViewLink,
          file_name: fileName,
          size_bytes: jsonBuffer.byteLength,
          status,
          generated_by: actor.id,
          generated_by_username: actor.username,
        });

        await recordAuditTrail({
          actorUserId: actor.id,
          actorUsername: actor.username,
          category: 'backup',
          eventType: 'SYSTEM_BACKUP_CREATED',
          targetType: 'backup',
          targetId: backupRec.id,
          after: { fileName, driveFileId },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.status(201).json({
          backup: backupRec,
          fileName,
          snapshotBase64: jsonBuffer.toString('base64'),
        });
      } catch (err) {
        console.error('Backup error:', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Backup creation failed.' });
      }
    }
  );

  router.post(
    '/admin/backups/restore',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const body = (req.body || {}) as {
          confirmPhrase?: unknown;
          snapshot?: {
            permissionsByUser?: Record<string, UserPermissionMatrix>;
            records?: Array<{
              id: string;
              module_id?: string;
              moduleId?: string;
              record_title?: string;
              recordTitle?: string;
              reference_code?: string;
              referenceCode?: string;
              status?: string;
              payload_json?: string;
              payloadJson?: string;
              created_by?: string;
              createdBy?: string;
              created_by_username?: string;
              createdByUsername?: string;
            }>;
          };
        };

        if (String(body.confirmPhrase ?? '').trim() !== 'RESTORE VCPL DATABASE') {
          res.status(400).json({
            error: 'Confirmation phrase mismatch. Type exact phrase: RESTORE VCPL DATABASE',
          });
          return;
        }

        const snap = body.snapshot;
        if (!snap || typeof snap !== 'object') {
          res.status(400).json({ error: 'Valid backup snapshot JSON object is required.' });
          return;
        }

        let restoredPermissions = 0;
        let restoredRecords = 0;

        if (snap.permissionsByUser && typeof snap.permissionsByUser === 'object') {
          for (const [uid, matrix] of Object.entries(snap.permissionsByUser)) {
            const targetUser = await findUserById(uid);
            if (targetUser && targetUser.role !== 'super_admin' && matrix && typeof matrix === 'object') {
              await saveUserPermissionsMap(uid, matrix, actor.username);
              restoredPermissions += 1;
            }
          }
        }

        if (Array.isArray(snap.records)) {
          for (const rec of snap.records) {
            const moduleId = rec.module_id || rec.moduleId;
            const title = rec.record_title || rec.recordTitle;
            if (!rec.id || !moduleId || !title) continue;
            const exists = await getWorkspaceRecordById(rec.id);
            if (!exists) {
              let parsedPayload: unknown = {};
              const rawPayload = rec.payload_json || rec.payloadJson || '{}';
              try {
                parsedPayload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
              } catch {
                parsedPayload = {};
              }
              await createWorkspaceRecord({
                moduleId,
                recordTitle: title,
                referenceCode: rec.reference_code || rec.referenceCode || '',
                status: rec.status || 'Active',
                payload: parsedPayload,
                createdBy: rec.created_by || rec.createdBy || actor.id,
                createdByUsername: rec.created_by_username || rec.createdByUsername || actor.username,
              });
              restoredRecords += 1;
            }
          }
        }

        await recordAuditTrail({
          actorUserId: actor.id,
          actorUsername: actor.username,
          category: 'backup',
          eventType: 'SYSTEM_BACKUP_RESTORED',
          targetType: 'backup',
          targetId: 'snapshot',
          after: { restoredPermissions, restoredRecords },
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        res.json({ ok: true, restoredPermissions, restoredRecords });
      } catch (err) {
        console.error('Backup restore error:', err);
        res.status(500).json({ error: 'Unable to restore backup snapshot.' });
      }
    }
  );

  // =========================================================================
  // 8. SYSTEM DIAGNOSTICS & MODULES METADATA
  // =========================================================================
  router.get(
    '/admin/system-status',
    authenticateEnterprise(),
    requireSuperAdmin,
    async (_req, res) => {
      try {
        const supabaseHealth = await checkSupabaseHealth();
        const driveStatus = getCompanyDriveConfigStatus();
        const driveLive = await testCompanyDriveConnection();
        const summary = await getEnterprisePersistenceSummary();
        const geminiConfigured = Boolean(
          (process.env.GEMINI_API_KEY || '').trim() &&
            process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        );
        const cronConfigured = Boolean((process.env.CRON_SECRET || '').trim());
        const indexNowConfigured = /^[a-zA-Z0-9-]{8,128}$/.test(
          (process.env.INDEXNOW_KEY || '').trim()
        );

        res.json({
          supabase: supabaseHealth,
          googleDrive: {
            ...driveStatus,
            liveConnection: driveLive,
          },
          summary,
          services: {
            geminiConfigured,
            cronConfigured,
            indexNowConfigured,
            superAdminEnvSeeded: Boolean(
              (process.env.SUPER_ADMIN_USERNAME || '').trim() &&
                (process.env.SUPER_ADMIN_PASSWORD || '').trim()
            ),
          },
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Unable to check system diagnostics.',
        });
      }
    }
  );

  router.get('/modules', authenticateEnterprise(), (_req, res) => {
    res.json({
      modules: ALL_ENTERPRISE_MODULES,
      actions: ENTERPRISE_PERMISSION_ACTIONS,
      statuses: ENTERPRISE_ACCOUNT_STATUSES,
    });
  });

  return router;
}
