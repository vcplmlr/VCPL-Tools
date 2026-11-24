import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import {
  ALL_ENTERPRISE_MODULES,
  ENTERPRISE_ACCOUNT_STATUSES,
  ENTERPRISE_PERMISSION_ACTIONS,
  type EnterpriseAccountStatus,
  type ModulePermissionSet,
  type PermissionActionKey,
  type UserPermissionMatrix,
  buildFullAdminPermissionMatrix,
  createEmptyPermissionSet,
} from '../data/enterpriseModules.ts';
import { DATA_DIR, getDb } from './db.ts';

const VAULT_FILES_DIR = path.resolve(DATA_DIR, 'enterprise_vault');
const EPHEMERAL_ENTERPRISE_KEY = crypto.randomBytes(32).toString('hex');

function getSigningKey(): string {
  return (
    process.env.VCPL_ENTERPRISE_SECRET?.trim() ||
    process.env.VCPL_ADMIN_SECRET?.trim() ||
    EPHEMERAL_ENTERPRISE_KEY
  );
}

function getPersistentKeyFileSigningKey(): string {
  // Ensures issued tokens remain valid across warm reloads if no env secret is set,
  // using an unpredictable locally generated CSPRNG key persisted in app_settings.
  const envKey = process.env.VCPL_ENTERPRISE_SECRET?.trim() || process.env.VCPL_ADMIN_SECRET?.trim();
  if (envKey) return envKey;
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get('enterprise_signing_key') as { value?: string } | undefined;
    if (row?.value && row.value.length >= 32) {
      return row.value;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'enterprise_signing_key',
      generated,
      new Date().toISOString()
    );
    const refreshed = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get('enterprise_signing_key') as { value?: string } | undefined;
    return refreshed?.value || getSigningKey();
  } catch {
    return getSigningKey();
  }
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPasswordScrypt(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      'unknown';

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

export function normalizeEnterpriseUsername(raw: unknown): {
  displayUsername: string;
  canonicalUsername: string;
  valid: boolean;
  error?: string;
} {
  const displayUsername = String(raw ?? '').trim();
  const canonicalUsername = displayUsername.toLowerCase();
  if (!displayUsername) {
    return { displayUsername: '', canonicalUsername: '', valid: false, error: 'Username is required.' };
  }
  if (canonicalUsername.length < 2 || canonicalUsername.length > 48) {
    return {
      displayUsername,
      canonicalUsername,
      valid: false,
      error: 'Username must be between 2 and 48 characters.',
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(canonicalUsername)) {
    return {
      displayUsername,
      canonicalUsername,
      valid: false,
      error:
        'Username can contain letters, numbers, dots (.), underscores (_), and hyphens (-), starting with a letter or number.',
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

function makeInternalAuthId(canonicalUsername: string): string {
  const token = crypto.randomBytes(8).toString('hex');
  return `${canonicalUsername}.${token}@auth.vcpl.internal`;
}

interface EnterpriseTokenPayload {
  uid: string;
  role: 'super_admin' | 'employee';
  tv: number;
  pwdChangeOnly: boolean;
  exp: number;
}

function signEnterpriseToken(payload: Omit<EnterpriseTokenPayload, 'exp'>): string {
  const full: EnterpriseTokenPayload = {
    ...payload,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getPersistentKeyFileSigningKey())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyEnterpriseToken(token: string): EnterpriseTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', getPersistentKeyFileSigningKey())
    .update(encoded)
    .digest('base64url');
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

interface DbUserRow {
  id: string;
  username: string;
  display_username: string;
  internal_auth_id: string;
  password_hash: string;
  full_name: string;
  employee_id: string;
  department: string;
  designation: string;
  contact_number: string;
  role: 'super_admin' | 'employee';
  status: EnterpriseAccountStatus;
  is_archived: number;
  must_change_password: number;
  token_version: number;
  last_login_at: string;
  last_active_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DbPermissionRow {
  user_id: string;
  module_id: string;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_upload: number;
  can_download: number;
  can_delete: number;
  can_approve: number;
  can_export: number;
  can_admin: number;
  updated_at: string;
}

function getUserPermissionsMap(userId: string, role: 'super_admin' | 'employee'): UserPermissionMatrix {
  if (role === 'super_admin') {
    return buildFullAdminPermissionMatrix();
  }
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM enterprise_permissions WHERE user_id = ?')
    .all(userId) as unknown as DbPermissionRow[];

  const matrix: UserPermissionMatrix = {};
  for (const row of rows) {
    matrix[row.module_id] = {
      view: Boolean(row.can_view),
      create: Boolean(row.can_create),
      edit: Boolean(row.can_edit),
      upload: Boolean(row.can_upload),
      download: Boolean(row.can_download),
      delete: Boolean(row.can_delete),
      approve: Boolean(row.can_approve),
      export: Boolean(row.can_export),
      admin: Boolean(row.can_admin),
    };
  }
  return matrix;
}

function saveUserPermissionsMap(userId: string, matrix: UserPermissionMatrix): void {
  const db = getDb();
  const now = new Date().toISOString();
  const validModuleIds = new Set(ALL_ENTERPRISE_MODULES.map((m) => m.id));
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM enterprise_permissions WHERE user_id = ?').run(userId);
    const insertStmt = db.prepare(`
      INSERT INTO enterprise_permissions (
        user_id, module_id, can_view, can_create, can_edit, can_upload,
        can_download, can_delete, can_approve, can_export, can_admin, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [moduleId, perms] of Object.entries(matrix)) {
      if (!validModuleIds.has(moduleId)) continue;
      const p: ModulePermissionSet = {
        ...createEmptyPermissionSet(false),
        ...perms,
      };
      const anyEnabled = Object.values(p).some(Boolean);
      if (!anyEnabled) continue;
      insertStmt.run(
        userId,
        moduleId,
        p.view ? 1 : 0,
        p.create ? 1 : 0,
        p.edit ? 1 : 0,
        p.upload ? 1 : 0,
        p.download ? 1 : 0,
        p.delete ? 1 : 0,
        p.approve ? 1 : 0,
        p.export ? 1 : 0,
        p.admin ? 1 : 0,
        now
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function sanitizeUserForClient(
  row: DbUserRow,
  options: { includeAdminFields?: boolean; permissions?: UserPermissionMatrix } = {}
) {
  const permissions =
    options.permissions ?? getUserPermissionsMap(row.id, row.role);

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
    status: row.status,
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
    };
  }
  return base;
}

function getClientIp(req: Request): string {
  return (
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : undefined) ||
    req.ip ||
    'unknown'
  );
}

function recordLoginEvent(params: {
  userId: string;
  username: string;
  displayUsername: string;
  outcome: string;
  detail: string;
  req: Request;
}) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO enterprise_login_history (
        id, user_id, username, display_username, outcome, detail, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `lgh_${crypto.randomUUID()}`,
      params.userId,
      params.username,
      params.displayUsername,
      params.outcome,
      params.detail.slice(0, 400),
      getClientIp(params.req).slice(0, 80),
      String(params.req.headers['user-agent'] || '').slice(0, 220),
      new Date().toISOString()
    );
  } catch (err) {
    console.warn('Unable to record login history:', err);
  }
}

function recordActivityEvent(params: {
  actorUserId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO enterprise_activity_logs (
        id, actor_user_id, actor_username, action, target_type, target_id, summary, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `act_${crypto.randomUUID()}`,
      params.actorUserId,
      params.actorUsername,
      params.action.slice(0, 80),
      params.targetType.slice(0, 64),
      params.targetId.slice(0, 128),
      params.summary.slice(0, 500),
      JSON.stringify(params.metadata || {}).slice(0, 2000),
      new Date().toISOString()
    );
  } catch (err) {
    console.warn('Unable to record activity log:', err);
  }
}

interface AuthedRequest extends Request {
  enterpriseUser?: DbUserRow;
  enterpriseToken?: EnterpriseTokenPayload;
  enterprisePermissions?: UserPermissionMatrix;
}

function authenticateEnterprise(options: { allowPwdChangeOnly?: boolean } = {}) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    const parsed = verifyEnterpriseToken(token);
    if (!parsed) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT * FROM enterprise_users WHERE id = ?')
      .get(parsed.uid) as DbUserRow | undefined;

    if (!user) {
      res.status(401).json({ error: 'Account not found or removed. Please contact your Super Admin.' });
      return;
    }
    if (user.is_archived === 1) {
      res.status(403).json({ error: 'Your account has been archived by the Super Admin.' });
      return;
    }
    if (user.status !== 'Approved') {
      res.status(403).json({
        error:
          user.status === 'Pending Approval'
            ? 'Your account is awaiting Super Admin approval. Please contact your administrator.'
            : user.status === 'Suspended'
              ? 'Your account has been suspended. Please contact your Super Admin.'
              : `Your account is ${user.status.toLowerCase()}. Access denied.`,
      });
      return;
    }
    if (user.token_version !== parsed.tv) {
      res.status(401).json({ error: 'Your session was invalidated after a security or password update. Please sign in again.' });
      return;
    }

    if (!options.allowPwdChangeOnly && (parsed.pwdChangeOnly || user.must_change_password === 1)) {
      res.status(403).json({
        code: 'FORCE_PASSWORD_CHANGE',
        error: 'Mandatory first-login password change is required before accessing modules.',
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE enterprise_users SET last_active_at = ? WHERE id = ?').run(now, user.id);
    user.last_active_at = now;

    req.enterpriseUser = user;
    req.enterpriseToken = parsed;
    req.enterprisePermissions = getUserPermissionsMap(user.id, user.role);
    next();
  };
}

function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.enterpriseUser || req.enterpriseUser.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access is strictly required for this operation.' });
    return;
  }
  next();
}

function hasModulePermission(
  user: DbUserRow,
  matrix: UserPermissionMatrix,
  moduleId: string,
  action: PermissionActionKey
): boolean {
  if (user.role === 'super_admin') return true;
  const modPerms = matrix[moduleId];
  if (!modPerms) return false;
  if (modPerms.admin) return true;
  return Boolean(modPerms[action]);
}

function ensureVaultFilesDir(): void {
  if (!fs.existsSync(VAULT_FILES_DIR)) {
    fs.mkdirSync(VAULT_FILES_DIR, { recursive: true });
  }
}

function resolveVaultFileSafe(storedFileName: string): string | null {
  ensureVaultFilesDir();
  const baseName = path.basename(storedFileName);
  if (!baseName || baseName !== storedFileName) return null;
  const resolved = path.resolve(VAULT_FILES_DIR, baseName);
  if (!resolved.startsWith(VAULT_FILES_DIR + path.sep)) return null;
  return resolved;
}

function isValidStatus(value: unknown): value is EnterpriseAccountStatus {
  return ENTERPRISE_ACCOUNT_STATUSES.includes(value as EnterpriseAccountStatus);
}

export function createEnterpriseRouter(): Router {
  const router = express.Router();
  const authLimiter = createRateLimiter(35, 5 * 60_000);
  const resetLimiter = createRateLimiter(15, 10 * 60_000);

  // =========================================================================
  // 1. SUPER ADMIN BOOTSTRAP STATUS & FIRST-RUN SETUP
  // =========================================================================
  router.get('/auth/super-admin-status', (_req, res) => {
    const db = getDb();
    const adminRow = db
      .prepare("SELECT id, username, display_username, full_name FROM enterprise_users WHERE role = 'super_admin' AND is_archived = 0 LIMIT 1")
      .get() as { id?: string; username?: string } | undefined;
    res.json({
      configured: Boolean(adminRow?.id),
    });
  });

  router.post('/auth/bootstrap-super-admin', authLimiter, (req, res) => {
    try {
      const db = getDb();
      const existingAdmin = db
        .prepare("SELECT id FROM enterprise_users WHERE role = 'super_admin' LIMIT 1")
        .get() as { id?: string } | undefined;

      if (existingAdmin?.id) {
        res.status(409).json({
          error: 'Super Admin account is already initialized. Please sign in with your credentials.',
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

      const duplicate = db
        .prepare('SELECT id FROM enterprise_users WHERE username = ?')
        .get(norm.canonicalUsername) as { id?: string } | undefined;
      if (duplicate?.id) {
        res.status(409).json({
          error: `Username "${norm.displayUsername}" already exists.`,
        });
        return;
      }

      const now = new Date().toISOString();
      const userId = `usr_${crypto.randomUUID()}`;
      const internalAuthId = makeInternalAuthId(norm.canonicalUsername);
      const passwordHash = hashPasswordScrypt(password);

      db.prepare(`
        INSERT INTO enterprise_users (
          id, username, display_username, internal_auth_id, password_hash, full_name,
          employee_id, department, designation, contact_number, role, status,
          is_archived, must_change_password, token_version, last_login_at, last_active_at,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        norm.canonicalUsername,
        norm.displayUsername,
        internalAuthId,
        passwordHash,
        fullName,
        'ADMIN-01',
        'Executive Administration',
        String(body.designation ?? 'Super Administrator').trim() || 'Super Administrator',
        String(body.contactNumber ?? '').trim().slice(0, 40),
        'super_admin',
        'Approved',
        0,
        0,
        1,
        now,
        now,
        'bootstrap',
        now,
        now
      );

      const created = db
        .prepare('SELECT * FROM enterprise_users WHERE id = ?')
        .get(userId) as unknown as DbUserRow;

      recordLoginEvent({
        userId,
        username: norm.canonicalUsername,
        displayUsername: norm.displayUsername,
        outcome: 'success',
        detail: 'Super Admin initialized and signed in.',
        req,
      });

      recordActivityEvent({
        actorUserId: userId,
        actorUsername: norm.canonicalUsername,
        action: 'SUPER_ADMIN_BOOTSTRAP',
        targetType: 'user',
        targetId: userId,
        summary: `Initialized Super Admin account (${norm.displayUsername}).`,
      });

      const token = signEnterpriseToken({
        uid: userId,
        role: 'super_admin',
        tv: 1,
        pwdChangeOnly: false,
      });

      res.status(201).json({
        token,
        requiresPasswordChange: false,
        user: sanitizeUserForClient(created, { includeAdminFields: true }),
      });
    } catch (err) {
      console.error('Super Admin bootstrap error:', err);
      res.status(500).json({ error: 'Unable to initialize Super Admin account.' });
    }
  });

  // =========================================================================
  // 2. USERNAME + PASSWORD AUTHENTICATION (ZERO-EMAIL EMPLOYEE LOGIN)
  // =========================================================================
  router.post('/auth/login', authLimiter, (req, res) => {
    try {
      const body = (req.body || {}) as { username?: unknown; password?: unknown };
      const norm = normalizeEnterpriseUsername(body.username);
      const password = String(body.password ?? '');

      if (!norm.valid || !password) {
        res.status(400).json({ error: 'Username and password are both required.' });
        return;
      }

      const db = getDb();
      const user = db
        .prepare('SELECT * FROM enterprise_users WHERE username = ?')
        .get(norm.canonicalUsername) as DbUserRow | undefined;

      if (!user || !verifyPasswordScrypt(password, user.password_hash)) {
        if (user) {
          recordLoginEvent({
            userId: user.id,
            username: user.username,
            displayUsername: norm.displayUsername,
            outcome: 'failed_password',
            detail: 'Invalid password attempt.',
            req,
          });
        }
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      if (user.is_archived === 1) {
        recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          outcome: 'denied_archived',
          detail: 'Login blocked because account is archived.',
          req,
        });
        res.status(403).json({
          code: 'ACCOUNT_ARCHIVED',
          error: 'This account has been archived. Please contact your Super Admin.',
        });
        return;
      }

      if (user.status !== 'Approved') {
        const msgMap: Record<EnterpriseAccountStatus, { outcome: string; code: string; error: string }> = {
          'Pending Approval': {
            outcome: 'denied_pending',
            code: 'PENDING_APPROVAL',
            error: 'Your account is awaiting Super Admin approval. Please contact your administrator.',
          },
          Rejected: {
            outcome: 'denied_rejected',
            code: 'ACCOUNT_REJECTED',
            error: 'Your account has been rejected by the Super Admin. Please contact your administrator.',
          },
          Suspended: {
            outcome: 'denied_suspended',
            code: 'ACCOUNT_SUSPENDED',
            error: 'Your account has been suspended by the Super Admin. Please contact your administrator.',
          },
          Inactive: {
            outcome: 'denied_inactive',
            code: 'ACCOUNT_INACTIVE',
            error: 'Your account is currently inactive. Please contact your Super Admin to reactivate it.',
          },
          Approved: {
            outcome: 'success',
            code: 'OK',
            error: '',
          },
        };
        const statusInfo = msgMap[user.status] || msgMap.Inactive;
        recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          outcome: statusInfo.outcome,
          detail: `Login denied (${user.status}).`,
          req,
        });
        res.status(403).json({ code: statusInfo.code, error: statusInfo.error });
        return;
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE enterprise_users SET last_login_at = ?, last_active_at = ? WHERE id = ?').run(
        now,
        now,
        user.id
      );
      user.last_login_at = now;
      user.last_active_at = now;

      const mustChange = user.must_change_password === 1;
      recordLoginEvent({
        userId: user.id,
        username: user.username,
        displayUsername: user.display_username,
        outcome: 'success',
        detail: mustChange
          ? 'Authenticated with temporary password (mandatory password change required).'
          : 'Authenticated successfully.',
        req,
      });

      recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'USER_LOGIN',
        targetType: 'session',
        targetId: user.id,
        summary: mustChange
          ? `${user.display_username} signed in with temporary password.`
          : `${user.display_username} signed in to VCPL Pro.`,
      });

      const token = signEnterpriseToken({
        uid: user.id,
        role: user.role,
        tv: user.token_version,
        pwdChangeOnly: mustChange,
      });

      res.json({
        token,
        requiresPasswordChange: mustChange,
        user: sanitizeUserForClient(user, {
          includeAdminFields: user.role === 'super_admin',
        }),
      });
    } catch (err) {
      console.error('Enterprise login error:', err);
      res.status(500).json({ error: 'Authentication error. Please try again.' });
    }
  });

  router.get('/auth/me', authenticateEnterprise({ allowPwdChangeOnly: true }), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const mustChange = user.must_change_password === 1 || Boolean(req.enterpriseToken?.pwdChangeOnly);
    res.json({
      requiresPasswordChange: mustChange,
      user: sanitizeUserForClient(user, {
        includeAdminFields: user.role === 'super_admin',
        permissions: mustChange ? {} : req.enterprisePermissions,
      }),
    });
  });

  router.post(
    '/auth/change-password',
    authenticateEnterprise({ allowPwdChangeOnly: true }),
    (req: AuthedRequest, res) => {
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
        if (!verifyPasswordScrypt(currentPassword, user.password_hash)) {
          res.status(401).json({ error: 'Current/temporary password is incorrect.' });
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

        const db = getDb();
        const now = new Date().toISOString();
        const nextHash = hashPasswordScrypt(newPassword);
        const nextVersion = user.token_version + 1;

        db.prepare(`
          UPDATE enterprise_users
          SET password_hash = ?, must_change_password = 0, token_version = ?, updated_at = ?, last_active_at = ?
          WHERE id = ?
        `).run(nextHash, nextVersion, now, now, user.id);

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(user.id) as unknown as DbUserRow;

        recordLoginEvent({
          userId: user.id,
          username: user.username,
          displayUsername: user.display_username,
          outcome: 'password_changed',
          detail: 'User completed mandatory/voluntary password change. Temporary password invalidated.',
          req,
        });

        recordActivityEvent({
          actorUserId: user.id,
          actorUsername: user.username,
          action: 'PASSWORD_CHANGED',
          targetType: 'user',
          targetId: user.id,
          summary: `${user.display_username} updated their personal password and unlocked full access.`,
        });

        const token = signEnterpriseToken({
          uid: updated.id,
          role: updated.role,
          tv: updated.token_version,
          pwdChangeOnly: false,
        });

        res.json({
          token,
          requiresPasswordChange: false,
          user: sanitizeUserForClient(updated, {
            includeAdminFields: updated.role === 'super_admin',
          }),
        });
      } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Unable to update password.' });
      }
    }
  );

  router.post('/auth/forgot-password', resetLimiter, (req, res) => {
    try {
      const body = (req.body || {}) as { username?: unknown; note?: unknown };
      const norm = normalizeEnterpriseUsername(body.username);
      if (!norm.valid) {
        res.status(400).json({ error: norm.error });
        return;
      }

      const db = getDb();
      const user = db
        .prepare('SELECT * FROM enterprise_users WHERE username = ? AND is_archived = 0')
        .get(norm.canonicalUsername) as DbUserRow | undefined;

      const note = String(body.note ?? '').trim().slice(0, 400);
      const now = new Date().toISOString();

      if (user) {
        const existingPending = db
          .prepare("SELECT id FROM enterprise_password_reset_requests WHERE user_id = ? AND status = 'Pending' LIMIT 1")
          .get(user.id) as { id?: string } | undefined;

        if (existingPending?.id) {
          db.prepare(
            'UPDATE enterprise_password_reset_requests SET note = ?, updated_at = ? WHERE id = ?'
          ).run(note || 'Employee re-submitted password reset request.', now, existingPending.id);
        } else {
          const reqId = `rst_${crypto.randomUUID()}`;
          db.prepare(`
            INSERT INTO enterprise_password_reset_requests (
              id, user_id, username, full_name, status, note, resolved_by, resolved_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'Pending', ?, '', '', ?, ?)
          `).run(reqId, user.id, user.username, user.full_name, note, now, now);
        }

        recordActivityEvent({
          actorUserId: user.id,
          actorUsername: user.username,
          action: 'PASSWORD_RESET_REQUESTED',
          targetType: 'reset_request',
          targetId: user.id,
          summary: `${user.display_username} submitted a manual password reset request.`,
        });
      }

      res.json({
        ok: true,
        message:
          'If this username is registered, your password reset request has been sent to the Super Admin. No automatic email will be sent—please contact your Super Admin directly to obtain your new temporary password.',
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Unable to submit password reset request.' });
    }
  });

  router.post(
    '/auth/logout',
    authenticateEnterprise({ allowPwdChangeOnly: true }),
    (req: AuthedRequest, res) => {
      const user = req.enterpriseUser!;
      recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'USER_LOGOUT',
        targetType: 'session',
        targetId: user.id,
        summary: `${user.display_username} signed out.`,
      });
      res.json({ ok: true });
    }
  );

  // =========================================================================
  // 3. SUPER ADMIN USER & RBAC MANAGEMENT (ALL 15 FEATURES)
  // =========================================================================
  router.get(
    '/admin/users',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req, res) => {
      const db = getDb();
      const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
      const rows = db
        .prepare(
          includeArchived
            ? 'SELECT * FROM enterprise_users ORDER BY role DESC, created_at DESC'
            : 'SELECT * FROM enterprise_users WHERE is_archived = 0 ORDER BY role DESC, created_at DESC'
        )
        .all() as unknown as DbUserRow[];

      const users = rows.map((row) =>
        sanitizeUserForClient(row, { includeAdminFields: true })
      );
      res.json({ users });
    }
  );

  router.post(
    '/admin/users',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
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

        const db = getDb();
        const existing = db
          .prepare('SELECT id, display_username FROM enterprise_users WHERE username = ?')
          .get(norm.canonicalUsername) as { id?: string; display_username?: string } | undefined;

        if (existing?.id) {
          res.status(409).json({
            code: 'USERNAME_EXISTS',
            error: `Username "${norm.displayUsername}" already exists (registered as "${existing.display_username || norm.canonicalUsername}"). Duplicate accounts differing only in capitalization are not permitted.`,
          });
          return;
        }

        const rawTempPwd = String(body.temporaryPassword ?? '').trim();
        const tempPassword = rawTempPwd || generateTempPassword(12);
        if (tempPassword.length < 6 || tempPassword.length > 128) {
          res.status(400).json({ error: 'Temporary password must be between 6 and 128 characters.' });
          return;
        }

        const status: EnterpriseAccountStatus = isValidStatus(body.status)
          ? body.status
          : 'Approved';

        const now = new Date().toISOString();
        const userId = `usr_${crypto.randomUUID()}`;
        const internalAuthId = makeInternalAuthId(norm.canonicalUsername);
        const passwordHash = hashPasswordScrypt(tempPassword);

        db.prepare(`
          INSERT INTO enterprise_users (
            id, username, display_username, internal_auth_id, password_hash, full_name,
            employee_id, department, designation, contact_number, role, status,
            is_archived, must_change_password, token_version, last_login_at, last_active_at,
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'employee', ?, 0, 1, 1, '', '', ?, ?, ?)
        `).run(
          userId,
          norm.canonicalUsername,
          norm.displayUsername,
          internalAuthId,
          passwordHash,
          fullName,
          String(body.employeeId ?? '').trim().slice(0, 64),
          String(body.department ?? 'Operations').trim().slice(0, 100) || 'Operations',
          String(body.designation ?? 'Staff').trim().slice(0, 100) || 'Staff',
          String(body.contactNumber ?? '').trim().slice(0, 40),
          status,
          actor.username,
          now,
          now
        );

        if (body.permissions && typeof body.permissions === 'object') {
          saveUserPermissionsMap(userId, body.permissions);
        }

        const created = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(userId) as unknown as DbUserRow;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_CREATED',
          targetType: 'user',
          targetId: userId,
          summary: `Created user ${norm.displayUsername} (${fullName}) with status "${status}".`,
        });

        res.status(201).json({
          user: sanitizeUserForClient(created, { includeAdminFields: true }),
          temporaryPassword: tempPassword,
        });
      } catch (err) {
        console.error('Create enterprise user error:', err);
        res.status(500).json({ error: 'Unable to create user account.' });
      }
    }
  );

  router.patch(
    '/admin/users/:id',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

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
            const clash = db
              .prepare('SELECT id FROM enterprise_users WHERE username = ? AND id != ?')
              .get(norm.canonicalUsername, targetId) as { id?: string } | undefined;
            if (clash?.id) {
              res.status(409).json({
                error: `Username "${norm.displayUsername}" already exists.`,
              });
              return;
            }
          }
          nextDisplayUsername = norm.displayUsername;
          nextCanonicalUsername = norm.canonicalUsername;
        }

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE enterprise_users
          SET username = ?, display_username = ?, full_name = ?, employee_id = ?,
              department = ?, designation = ?, contact_number = ?, updated_at = ?
          WHERE id = ?
        `).run(
          nextCanonicalUsername,
          nextDisplayUsername,
          fullName,
          body.employeeId !== undefined
            ? String(body.employeeId).trim().slice(0, 64)
            : existing.employee_id,
          body.department !== undefined
            ? String(body.department).trim().slice(0, 100) || 'Operations'
            : existing.department,
          body.designation !== undefined
            ? String(body.designation).trim().slice(0, 100) || 'Staff'
            : existing.designation,
          body.contactNumber !== undefined
            ? String(body.contactNumber).trim().slice(0, 40)
            : existing.contact_number,
          now,
          targetId
        );

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as unknown as DbUserRow;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_UPDATED',
          targetType: 'user',
          targetId: targetId,
          summary: `Updated details & designation for ${updated.display_username} (${updated.designation}).`,
        });

        res.json({ user: sanitizeUserForClient(updated, { includeAdminFields: true }) });
      } catch (err) {
        console.error('Update enterprise user error:', err);
        res.status(500).json({ error: 'Unable to update user details.' });
      }
    }
  );

  router.patch(
    '/admin/users/:id/status',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
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

        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }
        if (existing.id === actor.id && nextStatus !== 'Approved') {
          res.status(400).json({ error: 'Super Admin cannot suspend or deactivate their own active session account.' });
          return;
        }

        const now = new Date().toISOString();
        const nextTv = nextStatus === 'Approved' ? existing.token_version : existing.token_version + 1;
        db.prepare(
          'UPDATE enterprise_users SET status = ?, token_version = ?, updated_at = ? WHERE id = ?'
        ).run(nextStatus, nextTv, now, targetId);

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as unknown as DbUserRow;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_STATUS_CHANGED',
          targetType: 'user',
          targetId,
          summary: `Changed status for ${updated.display_username} from "${existing.status}" to "${nextStatus}".`,
        });

        res.json({ user: sanitizeUserForClient(updated, { includeAdminFields: true }) });
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
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const matrix = (req.body as { permissions?: UserPermissionMatrix })?.permissions;
        if (!matrix || typeof matrix !== 'object') {
          res.status(400).json({ error: 'Valid permissions object is required.' });
          return;
        }

        saveUserPermissionsMap(targetId, matrix);
        db.prepare('UPDATE enterprise_users SET updated_at = ? WHERE id = ?').run(
          new Date().toISOString(),
          targetId
        );

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as unknown as DbUserRow;

        const enabledModuleCount = Object.values(matrix).filter((m) =>
          Boolean(m && Object.values(m).some(Boolean))
        ).length;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'PERMISSIONS_UPDATED',
          targetType: 'user',
          targetId,
          summary: `Updated tool & permission matrix for ${updated.display_username} (${enabledModuleCount} modules configured).`,
        });

        res.json({ user: sanitizeUserForClient(updated, { includeAdminFields: true }) });
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
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const body = (req.body || {}) as { temporaryPassword?: unknown; requestId?: unknown };

        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        const rawTemp = String(body.temporaryPassword ?? '').trim();
        const temporaryPassword = rawTemp || generateTempPassword(12);
        if (temporaryPassword.length < 6 || temporaryPassword.length > 128) {
          res.status(400).json({ error: 'Temporary password must be between 6 and 128 characters.' });
          return;
        }

        const now = new Date().toISOString();
        const nextHash = hashPasswordScrypt(temporaryPassword);
        const nextTv = existing.token_version + 1;

        db.prepare(`
          UPDATE enterprise_users
          SET password_hash = ?, must_change_password = 1, token_version = ?, updated_at = ?
          WHERE id = ?
        `).run(nextHash, nextTv, now, targetId);

        if (typeof body.requestId === 'string' && body.requestId.trim()) {
          db.prepare(`
            UPDATE enterprise_password_reset_requests
            SET status = 'Approved', resolved_by = ?, resolved_at = ?, updated_at = ?
            WHERE id = ?
          `).run(actor.display_username, now, now, body.requestId.trim());
        } else {
          db.prepare(`
            UPDATE enterprise_password_reset_requests
            SET status = 'Approved', resolved_by = ?, resolved_at = ?, updated_at = ?
            WHERE user_id = ? AND status = 'Pending'
          `).run(actor.display_username, now, now, targetId);
        }

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as unknown as DbUserRow;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'ADMIN_PASSWORD_RESET',
          targetType: 'user',
          targetId,
          summary: `Generated temporary password for ${updated.display_username} (mandatory change enforced on next login).`,
        });

        res.json({
          temporaryPassword,
          user: sanitizeUserForClient(updated, { includeAdminFields: true }),
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
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        const archived = Boolean((req.body as { archived?: unknown })?.archived ?? true);

        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }
        if (existing.id === actor.id && archived) {
          res.status(400).json({ error: 'Super Admin cannot archive their own account.' });
          return;
        }

        const now = new Date().toISOString();
        const nextTv = archived ? existing.token_version + 1 : existing.token_version;
        db.prepare(
          'UPDATE enterprise_users SET is_archived = ?, token_version = ?, updated_at = ? WHERE id = ?'
        ).run(archived ? 1 : 0, nextTv, now, targetId);

        const updated = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as unknown as DbUserRow;

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: archived ? 'USER_ARCHIVED' : 'USER_RESTORED',
          targetType: 'user',
          targetId,
          summary: `${archived ? 'Archived' : 'Restored'} user account ${updated.display_username}.`,
        });

        res.json({ user: sanitizeUserForClient(updated, { includeAdminFields: true }) });
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
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const targetId = String(req.params.id || '');
        if (targetId === actor.id) {
          res.status(400).json({ error: 'Super Admin cannot permanently delete their own account.' });
          return;
        }

        const db = getDb();
        const existing = db
          .prepare('SELECT * FROM enterprise_users WHERE id = ?')
          .get(targetId) as DbUserRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'User account not found.' });
          return;
        }

        db.exec('BEGIN TRANSACTION;');
        try {
          db.prepare('DELETE FROM enterprise_permissions WHERE user_id = ?').run(targetId);
          db.prepare('DELETE FROM enterprise_password_reset_requests WHERE user_id = ?').run(targetId);
          db.prepare('DELETE FROM enterprise_users WHERE id = ?').run(targetId);
          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        }

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'USER_DELETED',
          targetType: 'user',
          targetId,
          summary: `Permanently deleted user account ${existing.display_username} (${existing.full_name}).`,
        });

        res.json({ ok: true });
      } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Unable to delete user account.' });
      }
    }
  );

  // =========================================================================
  // 4. PASSWORD RESET REQUESTS QUEUE, LOGIN HISTORY & ACTIVITY LOGS
  // =========================================================================
  router.get(
    '/admin/reset-requests',
    authenticateEnterprise(),
    requireSuperAdmin,
    (_req, res) => {
      const db = getDb();
      const rows = db
        .prepare('SELECT * FROM enterprise_password_reset_requests ORDER BY created_at DESC LIMIT 200')
        .all();
      res.json({ requests: rows });
    }
  );

  router.post(
    '/admin/reset-requests/:id/reject',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const actor = req.enterpriseUser!;
      const reqId = String(req.params.id || '');
      const note = String((req.body as { note?: unknown })?.note ?? '').trim().slice(0, 400);
      const db = getDb();
      const existing = db
        .prepare('SELECT * FROM enterprise_password_reset_requests WHERE id = ?')
        .get(reqId) as { id?: string; username?: string } | undefined;

      if (!existing?.id) {
        res.status(404).json({ error: 'Password reset request not found.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE enterprise_password_reset_requests
        SET status = 'Rejected', note = CASE WHEN ? != '' THEN ? ELSE note END,
            resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
      `).run(note, note, actor.display_username, now, now, reqId);

      recordActivityEvent({
        actorUserId: actor.id,
        actorUsername: actor.username,
        action: 'RESET_REQUEST_REJECTED',
        targetType: 'reset_request',
        targetId: reqId,
        summary: `Rejected password reset request for ${existing.username || 'user'}.`,
      });

      res.json({ ok: true });
    }
  );

  router.get(
    '/admin/login-history',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req, res) => {
      const db = getDb();
      const userId = String(req.query.userId ?? '').trim();
      const rows = userId
        ? db
            .prepare(
              'SELECT * FROM enterprise_login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 250'
            )
            .all(userId)
        : db
            .prepare('SELECT * FROM enterprise_login_history ORDER BY created_at DESC LIMIT 250')
            .all();
      res.json({ history: rows });
    }
  );

  router.get(
    '/admin/activity-logs',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req, res) => {
      const db = getDb();
      const actorId = String(req.query.userId ?? '').trim();
      const rows = actorId
        ? db
            .prepare(
              'SELECT * FROM enterprise_activity_logs WHERE actor_user_id = ? OR target_id = ? ORDER BY created_at DESC LIMIT 300'
            )
            .all(actorId, actorId)
        : db
            .prepare('SELECT * FROM enterprise_activity_logs ORDER BY created_at DESC LIMIT 300')
            .all();
      res.json({ logs: rows });
    }
  );

  // =========================================================================
  // 5. CENTRALIZED DOCUMENT VAULT (UPLOAD / DOWNLOAD / APPROVE / DRIVE LINK)
  // =========================================================================
  router.get('/documents', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const moduleFilter = String(req.query.moduleId ?? '').trim();

    if (moduleFilter && !hasModulePermission(user, perms, moduleFilter, 'view')) {
      res.status(403).json({ error: `View permission required for ${moduleFilter}.` });
      return;
    }
    if (!moduleFilter && !hasModulePermission(user, perms, 'document-vault', 'view') && !hasModulePermission(user, perms, 'document-studio', 'view')) {
      res.status(403).json({ error: 'View permission required for Document Vault or Document Studio.' });
      return;
    }

    const db = getDb();
    const rows = moduleFilter
      ? db
          .prepare('SELECT * FROM enterprise_documents WHERE module_id = ? ORDER BY updated_at DESC LIMIT 250')
          .all(moduleFilter)
      : db
          .prepare('SELECT * FROM enterprise_documents ORDER BY updated_at DESC LIMIT 250')
          .all();

    res.json({ documents: rows });
  });

  router.post('/documents/upload', authenticateEnterprise(), (req: AuthedRequest, res) => {
    try {
      const user = req.enterpriseUser!;
      const perms = req.enterprisePermissions!;
      const body = (req.body || {}) as {
        moduleId?: unknown;
        title?: unknown;
        fileName?: unknown;
        mimeType?: unknown;
        base64Data?: unknown;
        driveFileId?: unknown;
        driveWebViewLink?: unknown;
      };

      const moduleId = String(body.moduleId ?? 'document-vault').trim() || 'document-vault';
      if (!hasModulePermission(user, perms, moduleId, 'upload') && !hasModulePermission(user, perms, 'document-vault', 'upload')) {
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

      const ext = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
      const storedFileName = `${crypto.randomUUID()}${ext}`;
      const targetPath = resolveVaultFileSafe(storedFileName);
      if (!targetPath) {
        res.status(400).json({ error: 'Invalid target storage filename.' });
        return;
      }
      fs.writeFileSync(targetPath, fileBuffer);

      const docId = `doc_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const db = getDb();

      db.prepare(`
        INSERT INTO enterprise_documents (
          id, module_id, title, file_name, stored_file_name, mime_type, size_bytes,
          approval_status, drive_file_id, drive_web_view_link, uploaded_by, uploaded_by_username,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?, ?, ?)
      `).run(
        docId,
        moduleId,
        title,
        fileName,
        storedFileName,
        mimeType,
        fileBuffer.length,
        String(body.driveFileId ?? '').trim().slice(0, 256),
        String(body.driveWebViewLink ?? '').trim().slice(0, 512),
        user.id,
        user.username,
        now,
        now
      );

      const created = db
        .prepare('SELECT * FROM enterprise_documents WHERE id = ?')
        .get(docId);

      recordActivityEvent({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_UPLOADED',
        targetType: 'document',
        targetId: docId,
        summary: `Uploaded "${title}" (${fileName}, ${Math.ceil(fileBuffer.length / 1024)} KB) to ${moduleId}.`,
      });

      res.status(201).json({ document: created });
    } catch (err) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: 'Unable to upload document to central vault.' });
    }
  });

  router.get('/documents/:id/download', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const docId = String(req.params.id || '');
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM enterprise_documents WHERE id = ?')
      .get(docId) as
      | {
          id: string;
          module_id: string;
          file_name: string;
          stored_file_name: string;
          mime_type: string;
        }
      | undefined;

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

    const filePath = resolveVaultFileSafe(row.stored_file_name);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Document binary is missing on storage disk.' });
      return;
    }

    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'DOCUMENT_DOWNLOADED',
      targetType: 'document',
      targetId: docId,
      summary: `Downloaded "${row.file_name}".`,
    });

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${row.file_name.replace(/"/g, '')}"`
    );
    res.sendFile(filePath);
  });

  router.patch('/documents/:id', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const docId = String(req.params.id || '');
    const body = (req.body || {}) as {
      title?: unknown;
      approvalStatus?: unknown;
      driveFileId?: unknown;
      driveWebViewLink?: unknown;
    };

    const db = getDb();
    const row = db
      .prepare('SELECT * FROM enterprise_documents WHERE id = ?')
      .get(docId) as { id: string; module_id: string; title: string; approval_status: string; drive_file_id: string; drive_web_view_link: string } | undefined;

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

    if (body.title !== undefined || body.driveFileId !== undefined) {
      if (
        !hasModulePermission(user, perms, row.module_id, 'edit') &&
        !hasModulePermission(user, perms, 'document-vault', 'edit') &&
        !hasModulePermission(user, perms, 'document-vault', 'upload')
      ) {
        res.status(403).json({ error: 'Edit permission is required to modify document metadata.' });
        return;
      }
    }

    const allowedApprovals = new Set(['Draft', 'Pending Review', 'Approved', 'Rejected']);
    const nextApproval =
      typeof body.approvalStatus === 'string' && allowedApprovals.has(body.approvalStatus)
        ? body.approvalStatus
        : row.approval_status;

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE enterprise_documents
      SET title = ?, approval_status = ?, drive_file_id = ?, drive_web_view_link = ?, updated_at = ?
      WHERE id = ?
    `).run(
      body.title !== undefined ? String(body.title).trim().slice(0, 180) || row.title : row.title,
      nextApproval,
      body.driveFileId !== undefined
        ? String(body.driveFileId).trim().slice(0, 256)
        : row.drive_file_id,
      body.driveWebViewLink !== undefined
        ? String(body.driveWebViewLink).trim().slice(0, 512)
        : row.drive_web_view_link,
      now,
      docId
    );

    const updated = db.prepare('SELECT * FROM enterprise_documents WHERE id = ?').get(docId);
    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'DOCUMENT_UPDATED',
      targetType: 'document',
      targetId: docId,
      summary: `Updated "${row.title}" (status: ${nextApproval}).`,
    });

    res.json({ document: updated });
  });

  router.delete('/documents/:id', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const docId = String(req.params.id || '');
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM enterprise_documents WHERE id = ?')
      .get(docId) as { id: string; module_id: string; file_name: string; stored_file_name: string } | undefined;

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

    const filePath = resolveVaultFileSafe(row.stored_file_name);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Continue metadata removal
      }
    }

    db.prepare('DELETE FROM enterprise_documents WHERE id = ?').run(docId);
    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'DOCUMENT_DELETED',
      targetType: 'document',
      targetId: docId,
      summary: `Deleted "${row.file_name}" from central vault.`,
    });

    res.json({ ok: true });
  });

  // =========================================================================
  // 6. CENTRALIZED MODULE WORKSPACE RECORDS (STUDIO / LEDGER / VEHICLE / REGISTERS / REPORTS)
  // =========================================================================
  router.get('/records', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const moduleId = String(req.query.moduleId ?? '').trim();

    if (moduleId) {
      if (!hasModulePermission(user, perms, moduleId, 'view')) {
        res.status(403).json({ error: `View permission required for ${moduleId}.` });
        return;
      }
      const rows = getDb()
        .prepare('SELECT * FROM enterprise_workspace_records WHERE module_id = ? ORDER BY updated_at DESC LIMIT 300')
        .all(moduleId);
      res.json({ records: rows });
      return;
    }

    const allRows = getDb()
      .prepare('SELECT * FROM enterprise_workspace_records ORDER BY updated_at DESC LIMIT 300')
      .all() as Array<{ module_id: string }>;

    const visible = allRows.filter((r) => hasModulePermission(user, perms, r.module_id, 'view'));
    res.json({ records: visible });
  });

  router.post('/records', authenticateEnterprise(), (req: AuthedRequest, res) => {
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

    const id = `rec_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(body.payload ?? {}).slice(0, 65000);
    const db = getDb();

    db.prepare(`
      INSERT INTO enterprise_workspace_records (
        id, module_id, record_title, reference_code, status, payload_json,
        created_by, created_by_username, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      moduleId,
      recordTitle,
      String(body.referenceCode ?? '').trim().slice(0, 100),
      String(body.status ?? 'Active').trim().slice(0, 64) || 'Active',
      payloadJson,
      user.id,
      user.username,
      now,
      now
    );

    const created = db
      .prepare('SELECT * FROM enterprise_workspace_records WHERE id = ?')
      .get(id);

    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'RECORD_CREATED',
      targetType: 'record',
      targetId: id,
      summary: `Created record "${recordTitle}" in ${moduleId}.`,
    });

    res.status(201).json({ record: created });
  });

  router.patch('/records/:id', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const id = String(req.params.id || '');
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM enterprise_workspace_records WHERE id = ?')
      .get(id) as
      | {
          id: string;
          module_id: string;
          record_title: string;
          reference_code: string;
          status: string;
          payload_json: string;
        }
      | undefined;

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

    const now = new Date().toISOString();
    const nextTitle =
      body.recordTitle !== undefined
        ? String(body.recordTitle).trim().slice(0, 200) || existing.record_title
        : existing.record_title;
    const nextRef =
      body.referenceCode !== undefined
        ? String(body.referenceCode).trim().slice(0, 100)
        : existing.reference_code;
    const nextStatus =
      body.status !== undefined
        ? String(body.status).trim().slice(0, 64) || existing.status
        : existing.status;
    const nextPayload =
      body.payload !== undefined
        ? JSON.stringify(body.payload).slice(0, 65000)
        : existing.payload_json;

    db.prepare(`
      UPDATE enterprise_workspace_records
      SET record_title = ?, reference_code = ?, status = ?, payload_json = ?, updated_at = ?
      WHERE id = ?
    `).run(nextTitle, nextRef, nextStatus, nextPayload, now, id);

    const updated = db
      .prepare('SELECT * FROM enterprise_workspace_records WHERE id = ?')
      .get(id);

    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: isApprovalOnly ? 'RECORD_APPROVED' : 'RECORD_UPDATED',
      targetType: 'record',
      targetId: id,
      summary: `${isApprovalOnly ? 'Updated status to ' + nextStatus : 'Updated'} "${nextTitle}" in ${existing.module_id}.`,
    });

    res.json({ record: updated });
  });

  router.delete('/records/:id', authenticateEnterprise(), (req: AuthedRequest, res) => {
    const user = req.enterpriseUser!;
    const perms = req.enterprisePermissions!;
    const id = String(req.params.id || '');
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM enterprise_workspace_records WHERE id = ?')
      .get(id) as { id: string; module_id: string; record_title: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Workspace record not found.' });
      return;
    }

    if (!hasModulePermission(user, perms, existing.module_id, 'delete')) {
      res.status(403).json({ error: `Delete permission required for ${existing.module_id}.` });
      return;
    }

    db.prepare('DELETE FROM enterprise_workspace_records WHERE id = ?').run(id);

    recordActivityEvent({
      actorUserId: user.id,
      actorUsername: user.username,
      action: 'RECORD_DELETED',
      targetType: 'record',
      targetId: id,
      summary: `Deleted record "${existing.record_title}" from ${existing.module_id}.`,
    });

    res.json({ ok: true });
  });

  // =========================================================================
  // 7. FIRESTORE CLOUD SYNC SNAPSHOT EXPORT & HYDRATION
  // =========================================================================
  router.get(
    '/admin/cloud-snapshot',
    authenticateEnterprise(),
    requireSuperAdmin,
    (_req, res) => {
      const db = getDb();
      const userRows = db
        .prepare('SELECT * FROM enterprise_users ORDER BY created_at ASC')
        .all() as unknown as DbUserRow[];
      const users = userRows.map((row) =>
        sanitizeUserForClient(row, { includeAdminFields: true })
      );
      const resetRequests = db
        .prepare('SELECT * FROM enterprise_password_reset_requests ORDER BY created_at DESC LIMIT 100')
        .all();
      const activityLogs = db
        .prepare('SELECT * FROM enterprise_activity_logs ORDER BY created_at DESC LIMIT 100')
        .all();
      const documents = db
        .prepare('SELECT * FROM enterprise_documents ORDER BY updated_at DESC LIMIT 100')
        .all();
      const records = db
        .prepare('SELECT * FROM enterprise_workspace_records ORDER BY updated_at DESC LIMIT 100')
        .all();

      res.json({ users, resetRequests, activityLogs, documents, records });
    }
  );

  router.post(
    '/admin/hydrate-from-cloud',
    authenticateEnterprise(),
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      try {
        const actor = req.enterpriseUser!;
        const body = (req.body || {}) as {
          permissionsByUser?: Record<string, UserPermissionMatrix>;
          records?: Array<{
            id: string;
            moduleId: string;
            recordTitle: string;
            referenceCode: string;
            status: string;
            payloadJson: string;
            createdBy: string;
            createdByUsername: string;
          }>;
        };

        let restoredPermissions = 0;
        let restoredRecords = 0;
        const db = getDb();
        const now = new Date().toISOString();

        if (body.permissionsByUser && typeof body.permissionsByUser === 'object') {
          for (const [uid, matrix] of Object.entries(body.permissionsByUser)) {
            const exists = db
              .prepare('SELECT id FROM enterprise_users WHERE id = ?')
              .get(uid) as { id?: string } | undefined;
            if (exists?.id && matrix && typeof matrix === 'object') {
              saveUserPermissionsMap(uid, matrix);
              restoredPermissions += 1;
            }
          }
        }

        if (Array.isArray(body.records)) {
          const insertRec = db.prepare(`
            INSERT OR IGNORE INTO enterprise_workspace_records (
              id, module_id, record_title, reference_code, status, payload_json,
              created_by, created_by_username, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const rec of body.records) {
            if (!rec?.id || !rec?.moduleId || !rec?.recordTitle) continue;
            const info = insertRec.run(
              rec.id,
              rec.moduleId,
              rec.recordTitle,
              rec.referenceCode || '',
              rec.status || 'Active',
              rec.payloadJson || '{}',
              rec.createdBy || actor.id,
              rec.createdByUsername || actor.username,
              now,
              now
            );
            restoredRecords += Number(info.changes || 0);
          }
        }

        recordActivityEvent({
          actorUserId: actor.id,
          actorUsername: actor.username,
          action: 'CLOUD_HYDRATE',
          targetType: 'system',
          targetId: 'firestore',
          summary: `Restored ${restoredPermissions} permission profiles and ${restoredRecords} workspace records from Firebase Firestore.`,
        });

        res.json({ ok: true, restoredPermissions, restoredRecords });
      } catch (err) {
        console.error('Cloud hydration error:', err);
        res.status(500).json({ error: 'Unable to hydrate data from cloud snapshot.' });
      }
    }
  );

  // =========================================================================
  // 8. METADATA ENDPOINT FOR CLIENT PERMISSIONS & MODULES
  // =========================================================================
  router.get('/modules', authenticateEnterprise(), (_req, res) => {
    res.json({
      modules: ALL_ENTERPRISE_MODULES,
      actions: ENTERPRISE_PERMISSION_ACTIONS,
      statuses: ENTERPRISE_ACCOUNT_STATUSES,
    });
  });

  return router;
}
