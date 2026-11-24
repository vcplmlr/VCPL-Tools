import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  ALL_ENTERPRISE_MODULES,
  type EnterpriseAccountStatus,
  type ModulePermissionSet,
  type UserPermissionMatrix,
  buildFullAdminPermissionMatrix,
  createEmptyPermissionSet,
} from '../data/enterpriseModules.ts';
import { getDb } from './db.ts';
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabaseClient.ts';

export type ExtendedAccountStatus =
  | EnterpriseAccountStatus
  | 'Active'
  | 'Password Reset Required';

export interface EnterpriseUserRow {
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
  status: ExtendedAccountStatus;
  is_archived: boolean;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string;
  token_version: number;
  last_login_at: string;
  last_active_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
}

export interface EnterpriseSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_version: number;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string;
  revoke_reason: string;
  created_at: string;
}

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignationRow {
  id: string;
  department_id: string;
  name: string;
  default_role: 'super_admin' | 'employee';
  default_permissions: UserPermissionMatrix;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResetRequestRow {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  note: string;
  resolved_by: string;
  resolved_at: string;
  created_at: string;
  updated_at: string;
}

export interface LoginHistoryRow {
  id: string;
  user_id: string;
  username: string;
  display_username: string;
  role: string;
  outcome: string;
  detail: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface ActivityLogRow {
  id: string;
  actor_user_id: string;
  actor_username: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  metadata_json: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string;
  actor_username: string;
  category: string;
  event_type: string;
  target_type: string;
  target_id: string;
  before_json: string;
  after_json: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface DriveConfigRow {
  id: string;
  auth_mode: string;
  root_folder_id: string;
  root_folder_name: string;
  shared_drive_id: string;
  service_account_email: string;
  status: string;
  last_verified_at: string;
  last_error: string;
  updated_by: string;
  updated_at: string;
}

export interface DriveFolderRow {
  id: string;
  folder_key: string;
  folder_name: string;
  parent_key: string;
  drive_folder_id: string;
  drive_parent_id: string;
  module_id: string;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseDocumentRow {
  id: string;
  module_id: string;
  folder_key: string;
  title: string;
  file_name: string;
  stored_file_name: string;
  mime_type: string;
  size_bytes: number;
  approval_status: 'Draft' | 'Pending Review' | 'Approved' | 'Rejected';
  storage_provider: string;
  drive_file_id: string;
  drive_folder_id: string;
  drive_web_view_link: string;
  checksum_sha256: string;
  version_number: number;
  tags: string;
  notes: string;
  is_archived: boolean;
  archived_at: string;
  deleted_at: string;
  uploaded_by: string;
  uploaded_by_username: string;
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  drive_file_id: string;
  drive_web_view_link: string;
  checksum_sha256: string;
  notes: string;
  uploaded_by: string;
  uploaded_by_username: string;
  created_at: string;
}

export interface WorkspaceRecordRow {
  id: string;
  module_id: string;
  record_title: string;
  reference_code: string;
  status: string;
  payload_json: string;
  is_archived: boolean;
  deleted_at: string;
  created_by: string;
  created_by_username: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportRecordRow {
  id: string;
  report_type: string;
  report_title: string;
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  module_filter: string;
  date_range_label: string;
  row_count: number;
  drive_file_id: string;
  drive_web_view_link: string;
  file_name: string;
  size_bytes: number;
  status: string;
  generated_by: string;
  generated_by_username: string;
  created_at: string;
}

const VALID_MODULE_IDS = new Set(ALL_ENTERPRISE_MODULES.map((m) => m.id));

// Password hashing: bcryptjs cost 12 + transparent legacy scrypt verification
export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPasswordWithMigration(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedHash) return { valid: false, needsRehash: false };

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  }

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hashHex] = parts;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (candidate.length !== expected.length) return { valid: false, needsRehash: false };
    const valid = crypto.timingSafeEqual(candidate, expected);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

function mapSupabaseUser(r: Record<string, unknown>): EnterpriseUserRow {
  return {
    id: String(r.id || ''),
    username: String(r.username || ''),
    display_username: String(r.display_username || r.username || ''),
    internal_auth_id: String(r.internal_auth_id || ''),
    password_hash: String(r.password_hash || ''),
    full_name: String(r.full_name || ''),
    employee_id: String(r.employee_id || ''),
    department: String(r.department || 'Operations'),
    designation: String(r.designation || 'Staff'),
    contact_number: String(r.contact_number || ''),
    role: r.role === 'super_admin' ? 'super_admin' : 'employee',
    status: (String(r.status || 'Pending Approval') as ExtendedAccountStatus),
    is_archived: Boolean(r.is_archived),
    must_change_password: Boolean(r.must_change_password),
    failed_login_attempts: Number(r.failed_login_attempts || 0),
    locked_until: r.locked_until ? String(r.locked_until) : '',
    token_version: Number(r.token_version || 1),
    last_login_at: r.last_login_at ? String(r.last_login_at) : '',
    last_active_at: r.last_active_at ? String(r.last_active_at) : '',
    created_by: String(r.created_by || 'system'),
    created_at: r.created_at ? String(r.created_at) : '',
    updated_at: r.updated_at ? String(r.updated_at) : '',
    deleted_at: r.deleted_at ? String(r.deleted_at) : '',
  };
}

function mapSqliteUser(r: Record<string, unknown>): EnterpriseUserRow {
  return mapSupabaseUser(r);
}

function mapDocumentRow(r: Record<string, unknown>): EnterpriseDocumentRow {
  return {
    id: String(r.id || ''),
    module_id: String(r.module_id || 'document-vault'),
    folder_key: String(r.folder_key || '04_DOCUMENT_VAULT'),
    title: String(r.title || 'Untitled'),
    file_name: String(r.file_name || 'file'),
    stored_file_name: String(r.stored_file_name || ''),
    mime_type: String(r.mime_type || 'application/octet-stream'),
    size_bytes: Number(r.size_bytes || 0),
    approval_status:
      (String(r.approval_status || 'Draft') as EnterpriseDocumentRow['approval_status']),
    storage_provider: String(r.storage_provider || 'google_drive'),
    drive_file_id: String(r.drive_file_id || ''),
    drive_folder_id: String(r.drive_folder_id || ''),
    drive_web_view_link: String(r.drive_web_view_link || ''),
    checksum_sha256: String(r.checksum_sha256 || ''),
    version_number: Number(r.version_number || 1),
    tags: String(r.tags || ''),
    notes: String(r.notes || ''),
    is_archived: Boolean(r.is_archived),
    archived_at: r.archived_at ? String(r.archived_at) : '',
    deleted_at: r.deleted_at ? String(r.deleted_at) : '',
    uploaded_by: String(r.uploaded_by || ''),
    uploaded_by_username: String(r.uploaded_by_username || ''),
    approved_by: String(r.approved_by || ''),
    created_at: r.created_at ? String(r.created_at) : '',
    updated_at: r.updated_at ? String(r.updated_at) : '',
  };
}

let sqliteSeeded = false;
function ensureSqliteGovernanceSeeds(): void {
  if (sqliteSeeded) return;
  sqliteSeeded = true;
  const db = getDb();
  const now = new Date().toISOString();

  const depts = [
    ['dept_accounts', 'Accounts & Finance', 'ACC', 'Ledger, invoicing, bank slips, payments and reconciliation'],
    ['dept_tax_gst', 'Taxation & GST', 'TAX', 'Form 26AS, GSTR-1, GSTR-2B, TDS/TCS and statutory returns'],
    ['dept_dealership', 'Dealership Operations', 'OPS', 'DMS vs Tally, BMW/Bajaj claims, incentives and billing'],
    ['dept_compliance', 'Audit & Compliance', 'AUD', 'Statutory retention, compliance calendar and document verification'],
    ['dept_admin', 'Administration', 'ADM', 'Executive governance, approvals, system backups and user control'],
  ];
  const deptStmt = db.prepare(`
    INSERT OR IGNORE INTO enterprise_departments (id, name, code, description, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);
  for (const d of depts) {
    deptStmt.run(d[0], d[1], d[2], d[3], now, now);
  }

  const desigs = [
    [
      'desig_accounts_exec',
      'dept_accounts',
      'Accounts Executive',
      'employee',
      JSON.stringify({
        'accounts-workspace': { view: true, create: true, edit: true, upload: true, download: true },
        'auto-ledger': { view: true, create: true, edit: true, upload: true, download: true, export: true },
        'document-vault': { view: true, upload: true, download: true },
      }),
    ],
    [
      'desig_senior_accountant',
      'dept_accounts',
      'Senior Accountant',
      'employee',
      JSON.stringify({
        'accounts-workspace': { view: true, create: true, edit: true, upload: true, download: true, approve: true, export: true },
        'auto-ledger': { view: true, create: true, edit: true, upload: true, download: true, approve: true, export: true },
        'document-vault': { view: true, create: true, edit: true, upload: true, download: true, approve: true, export: true },
      }),
    ],
    [
      'desig_tax_analyst',
      'dept_tax_gst',
      'Tax & GST Analyst',
      'employee',
      JSON.stringify({
        'compliance-tracker': { view: true, create: true, edit: true, upload: true, download: true, export: true },
        'gstr2b-tally-reconciler': { view: true, create: true, edit: true, upload: true, download: true, export: true },
        'form-26as-to-excel': { view: true, create: true, edit: true, upload: true, download: true, export: true },
        'gstr1-return-prep': { view: true, create: true, edit: true, upload: true, download: true, export: true },
      }),
    ],
    [
      'desig_branch_auditor',
      'dept_compliance',
      'Auditor / Reviewer',
      'employee',
      JSON.stringify({
        'document-vault': { view: true, download: true, approve: true, export: true },
        'compliance-tracker': { view: true, download: true, approve: true, export: true },
        registers: { view: true, download: true, export: true },
      }),
    ],
    [
      'desig_dealership_mgr',
      'dept_dealership',
      'Dealership Operations Manager',
      'employee',
      JSON.stringify({
        'bmw-claims-reconciler': { view: true, create: true, edit: true, upload: true, download: true, approve: true, export: true },
        'vehicle-master': { view: true, create: true, edit: true, upload: true, download: true, approve: true, export: true },
        'document-vault': { view: true, create: true, upload: true, download: true, export: true },
      }),
    ],
    ['desig_super_admin', 'dept_admin', 'Super Admin / Director', 'super_admin', '{}'],
  ];

  const desigStmt = db.prepare(`
    INSERT OR IGNORE INTO enterprise_designations (id, department_id, name, default_role, default_permissions_json, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const ds of desigs) {
    desigStmt.run(ds[0], ds[1], ds[2], ds[3], ds[4], now, now);
  }
}

let envAdminSeededAttempted = false;

export async function isSuperAdminBootstrapCompleted(): Promise<boolean> {
  try {
    const raw = await getSharedSetting('super_admin_bootstrap_completed');
    if (!raw) return false;
    if (raw === 'true' || raw === '1') return true;
    const parsed = JSON.parse(raw) as { disabled?: boolean };
    return Boolean(parsed?.disabled);
  } catch {
    return false;
  }
}

export async function markSuperAdminBootstrapCompleted(username: string): Promise<void> {
  await setSharedSetting(
    'super_admin_bootstrap_completed',
    JSON.stringify({
      disabled: true,
      completedAt: new Date().toISOString(),
      username,
    })
  );
}

export async function countAnySuperAdmin(): Promise<number> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { count, error } = await sb
      .from('enterprise_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    if (!error && typeof count === 'number') {
      return count;
    }
  }
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS cnt FROM enterprise_users WHERE role = 'super_admin'")
    .get() as { cnt?: number } | undefined;
  return Number(row?.cnt || 0);
}

export async function ensureEnvSuperAdminSeeded(): Promise<void> {
  if (envAdminSeededAttempted) return;
  envAdminSeededAttempted = true;

  // Never auto-create an account when bootstrap was already completed or when only VCPL_SUPER_ADMIN_BOOTSTRAP_TOKEN is present
  if (await isSuperAdminBootstrapCompleted()) return;

  const rawUser = (process.env.SUPER_ADMIN_USERNAME || '').trim();
  const rawPass = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
  const fullName = (process.env.SUPER_ADMIN_FULL_NAME || 'VCPL Super Administrator').trim();

  if (!rawUser || !rawPass) return;
  const canonical = rawUser.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,47}$/.test(canonical)) return;

  try {
    const existing = await findUserByUsername(canonical);
    if (existing) return;

    const hash = await hashPasswordBcrypt(rawPass);
    await createUserRecord({
      username: canonical,
      displayUsername: rawUser,
      passwordHash: hash,
      fullName: fullName || 'VCPL Super Administrator',
      employeeId: 'ADMIN-01',
      department: 'Administration',
      designation: 'Super Admin / Director',
      contactNumber: '',
      role: 'super_admin',
      status: 'Approved',
      mustChangePassword: false,
      createdBy: 'env-seed',
    });
  } catch (err) {
    console.warn('[VCPL Enterprise] Env Super Admin seed skipped:', err);
  }
}

// =========================================================================
// USERS
// =========================================================================
export async function hasActiveSuperAdmin(options?: { skipEnvSeed?: boolean }): Promise<boolean> {
  if (!options?.skipEnvSeed) {
    await ensureEnvSuperAdminSeeded();
  }
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_users')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_archived', false)
      .is('deleted_at', null)
      .limit(1);
    if (!error) {
      return Boolean(data && data.length > 0);
    }
  }
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id FROM enterprise_users WHERE role = 'super_admin' AND is_archived = 0 AND (deleted_at = '' OR deleted_at IS NULL) LIMIT 1"
    )
    .get() as { id?: string } | undefined;
  return Boolean(row?.id);
}

export async function countActiveSuperAdmins(): Promise<number> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { count, error } = await sb
      .from('enterprise_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('is_archived', false)
      .in('status', ['Approved', 'Active'])
      .is('deleted_at', null);
    if (!error && typeof count === 'number') {
      return count;
    }
  }
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM enterprise_users WHERE role = 'super_admin' AND is_archived = 0 AND status IN ('Approved', 'Active') AND (deleted_at = '' OR deleted_at IS NULL)"
    )
    .get() as { cnt?: number } | undefined;
  return Number(row?.cnt || 0);
}

export async function findUserByUsername(canonicalUsername: string): Promise<EnterpriseUserRow | null> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_users')
      .select('*')
      .eq('username', canonicalUsername.toLowerCase())
      .is('deleted_at', null)
      .maybeSingle();
    if (!error) {
      return data ? mapSupabaseUser(data as Record<string, unknown>) : null;
    }
  }
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM enterprise_users WHERE LOWER(username) = ? AND (deleted_at = '' OR deleted_at IS NULL) LIMIT 1"
    )
    .get(canonicalUsername.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? mapSqliteUser(row) : null;
}

export async function findUserById(userId: string): Promise<EnterpriseUserRow | null> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_users')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!error) {
      return data ? mapSupabaseUser(data as Record<string, unknown>) : null;
    }
  }
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM enterprise_users WHERE id = ? AND (deleted_at = '' OR deleted_at IS NULL) LIMIT 1"
    )
    .get(userId) as Record<string, unknown> | undefined;
  return row ? mapSqliteUser(row) : null;
}

export async function listUsers(includeArchived = false): Promise<EnterpriseUserRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    let q = sb
      .from('enterprise_users')
      .select('*')
      .is('deleted_at', null)
      .order('role', { ascending: false })
      .order('created_at', { ascending: false });
    if (!includeArchived) {
      q = q.eq('is_archived', false);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data.map((r) => mapSupabaseUser(r as Record<string, unknown>));
    }
  }
  const db = getDb();
  const sql = includeArchived
    ? "SELECT * FROM enterprise_users WHERE (deleted_at = '' OR deleted_at IS NULL) ORDER BY role DESC, created_at DESC"
    : "SELECT * FROM enterprise_users WHERE is_archived = 0 AND (deleted_at = '' OR deleted_at IS NULL) ORDER BY role DESC, created_at DESC";
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map(mapSqliteUser);
}

export async function createUserRecord(input: {
  username: string;
  displayUsername: string;
  passwordHash: string;
  fullName: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  contactNumber?: string;
  role: 'super_admin' | 'employee';
  status: ExtendedAccountStatus;
  mustChangePassword: boolean;
  createdBy: string;
}): Promise<EnterpriseUserRow> {
  const id = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const internalAuthId = `${input.username.toLowerCase()}.${crypto.randomBytes(8).toString('hex')}@auth.vcpl.internal`;

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_users')
      .insert({
        id,
        username: input.username.toLowerCase(),
        display_username: input.displayUsername,
        internal_auth_id: internalAuthId,
        password_hash: input.passwordHash,
        full_name: input.fullName,
        employee_id: input.employeeId || '',
        department: input.department || 'Operations',
        designation: input.designation || 'Staff',
        contact_number: input.contactNumber || '',
        role: input.role,
        status: input.status,
        is_archived: false,
        must_change_password: input.mustChangePassword,
        failed_login_attempts: 0,
        locked_until: null,
        token_version: 1,
        created_by: input.createdBy,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapSupabaseUser(data as Record<string, unknown>);
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO enterprise_users (
      id, username, display_username, internal_auth_id, password_hash, full_name,
      employee_id, department, designation, contact_number, role, status,
      is_archived, must_change_password, failed_login_attempts, locked_until, token_version,
      last_login_at, last_active_at, created_by, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, '', 1, '', '', ?, ?, ?, '')
  `).run(
    id,
    input.username.toLowerCase(),
    input.displayUsername,
    internalAuthId,
    input.passwordHash,
    input.fullName,
    input.employeeId || '',
    input.department || 'Operations',
    input.designation || 'Staff',
    input.contactNumber || '',
    input.role,
    input.status,
    input.mustChangePassword ? 1 : 0,
    input.createdBy,
    now,
    now
  );

  const created = await findUserById(id);
  if (!created) throw new Error('User creation failed');
  return created;
}

export async function updateUserFields(
  userId: string,
  patch: Partial<{
    username: string;
    display_username: string;
    password_hash: string;
    full_name: string;
    employee_id: string;
    department: string;
    designation: string;
    contact_number: string;
    role: 'super_admin' | 'employee';
    status: ExtendedAccountStatus;
    is_archived: boolean;
    must_change_password: boolean;
    failed_login_attempts: number;
    locked_until: string | null;
    token_version: number;
    last_login_at: string;
    last_active_at: string;
    deleted_at: string | null;
  }>
): Promise<EnterpriseUserRow | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const sbPatch: Record<string, unknown> = { updated_at: now };
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' && (k === 'locked_until' || k === 'deleted_at' || k === 'last_login_at' || k === 'last_active_at')) {
        sbPatch[k] = null;
      } else {
        sbPatch[k] = v;
      }
    }
    const { data, error } = await sb
      .from('enterprise_users')
      .update(sbPatch)
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSupabaseUser(data as Record<string, unknown>) : null;
  }

  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const vals: Array<string | number | null> = [now];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    if (typeof v === 'boolean') {
      vals.push(v ? 1 : 0);
    } else if (v === null) {
      vals.push('');
    } else {
      vals.push(v);
    }
  }
  vals.push(userId);
  db.prepare(`UPDATE enterprise_users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return findUserById(userId);
}

export async function hardDeleteUser(userId: string): Promise<void> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('enterprise_sessions').delete().eq('user_id', userId);
    await sb.from('enterprise_permissions').delete().eq('user_id', userId);
    await sb.from('enterprise_password_reset_requests').delete().eq('user_id', userId);
    const { error } = await sb.from('enterprise_users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM enterprise_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM enterprise_permissions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM enterprise_password_reset_requests WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM enterprise_users WHERE id = ?').run(userId);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// =========================================================================
// SESSIONS (SERVER-MANAGED PERSISTENT REVOCATION)
// =========================================================================
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createSessionRecord(input: {
  userId: string;
  rawToken: string;
  tokenVersion: number;
  ipAddress: string;
  userAgent: string;
  ttlMs?: number;
}): Promise<EnterpriseSessionRow> {
  const id = `ses_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (input.ttlMs || 12 * 60 * 60 * 1000)).toISOString();
  const tokenHash = hashSessionToken(input.rawToken);

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_sessions')
      .insert({
        id,
        user_id: input.userId,
        token_hash: tokenHash,
        token_version: input.tokenVersion,
        ip_address: input.ipAddress.slice(0, 64),
        user_agent: input.userAgent.slice(0, 240),
        expires_at: expiresAt,
        last_seen_at: now,
        created_at: now,
      })
      .select('*')
      .single();
    if (!error && data) {
      return {
        id: String(data.id),
        user_id: String(data.user_id),
        token_hash: String(data.token_hash),
        token_version: Number(data.token_version || 1),
        ip_address: String(data.ip_address || ''),
        user_agent: String(data.user_agent || ''),
        expires_at: String(data.expires_at),
        last_seen_at: String(data.last_seen_at),
        revoked_at: data.revoked_at ? String(data.revoked_at) : '',
        revoke_reason: String(data.revoke_reason || ''),
        created_at: String(data.created_at),
      };
    }
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO enterprise_sessions (
      id, user_id, token_hash, token_version, ip_address, user_agent, expires_at, last_seen_at, revoked_at, revoke_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)
  `).run(
    id,
    input.userId,
    tokenHash,
    input.tokenVersion,
    input.ipAddress.slice(0, 64),
    input.userAgent.slice(0, 240),
    expiresAt,
    now,
    now
  );

  return {
    id,
    user_id: input.userId,
    token_hash: tokenHash,
    token_version: input.tokenVersion,
    ip_address: input.ipAddress.slice(0, 64),
    user_agent: input.userAgent.slice(0, 240),
    expires_at: expiresAt,
    last_seen_at: now,
    revoked_at: '',
    revoke_reason: '',
    created_at: now,
  };
}

export async function getActiveSessionByToken(rawToken: string): Promise<EnterpriseSessionRow | null> {
  const tokenHash = hashSessionToken(rawToken);
  const nowIso = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();
    if (!error) {
      if (!data) return null;
      if (String(data.expires_at) <= nowIso) return null;
      return {
        id: String(data.id),
        user_id: String(data.user_id),
        token_hash: String(data.token_hash),
        token_version: Number(data.token_version || 1),
        ip_address: String(data.ip_address || ''),
        user_agent: String(data.user_agent || ''),
        expires_at: String(data.expires_at),
        last_seen_at: String(data.last_seen_at),
        revoked_at: '',
        revoke_reason: '',
        created_at: String(data.created_at),
      };
    }
  }

  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM enterprise_sessions WHERE token_hash = ? AND (revoked_at = '' OR revoked_at IS NULL) LIMIT 1"
    )
    .get(tokenHash) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (String(row.expires_at) <= nowIso) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    token_hash: String(row.token_hash),
    token_version: Number(row.token_version || 1),
    ip_address: String(row.ip_address || ''),
    user_agent: String(row.user_agent || ''),
    expires_at: String(row.expires_at),
    last_seen_at: String(row.last_seen_at),
    revoked_at: String(row.revoked_at || ''),
    revoke_reason: String(row.revoke_reason || ''),
    created_at: String(row.created_at),
  };
}

export async function revokeSessionByToken(rawToken: string, reason = 'logout'): Promise<void> {
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb
      .from('enterprise_sessions')
      .update({ revoked_at: now, revoke_reason: reason })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null);
    return;
  }
  const db = getDb();
  db.prepare(
    "UPDATE enterprise_sessions SET revoked_at = ?, revoke_reason = ? WHERE token_hash = ? AND (revoked_at = '' OR revoked_at IS NULL)"
  ).run(now, reason, tokenHash);
}

export async function revokeAllUserSessions(userId: string, reason = 'security_revocation'): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb
      .from('enterprise_sessions')
      .update({ revoked_at: now, revoke_reason: reason })
      .eq('user_id', userId)
      .is('revoked_at', null);
    return;
  }
  const db = getDb();
  db.prepare(
    "UPDATE enterprise_sessions SET revoked_at = ?, revoke_reason = ? WHERE user_id = ? AND (revoked_at = '' OR revoked_at IS NULL)"
  ).run(now, reason, userId);
}

export async function touchSessionActivity(sessionId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('enterprise_sessions').update({ last_seen_at: now }).eq('id', sessionId);
    await sb.from('enterprise_users').update({ last_active_at: now }).eq('id', userId);
    return;
  }
  const db = getDb();
  db.prepare('UPDATE enterprise_sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
  db.prepare('UPDATE enterprise_users SET last_active_at = ? WHERE id = ?').run(now, userId);
}

// =========================================================================
// PERMISSIONS
// =========================================================================
export async function getUserPermissionsMap(
  userId: string,
  role: 'super_admin' | 'employee'
): Promise<UserPermissionMatrix> {
  if (role === 'super_admin') {
    return buildFullAdminPermissionMatrix();
  }

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_permissions')
      .select('module_id, permissions_json')
      .eq('user_id', userId);
    if (!error && Array.isArray(data)) {
      const matrix: UserPermissionMatrix = {};
      for (const row of data) {
        const modId = String(row.module_id || '');
        const raw = (row.permissions_json || {}) as Partial<ModulePermissionSet>;
        matrix[modId] = {
          ...createEmptyPermissionSet(false),
          view: Boolean(raw.view),
          create: Boolean(raw.create),
          edit: Boolean(raw.edit),
          upload: Boolean(raw.upload),
          download: Boolean(raw.download),
          delete: Boolean(raw.delete),
          approve: Boolean(raw.approve),
          export: Boolean(raw.export),
          admin: Boolean(raw.admin),
        };
      }
      return matrix;
    }
  }

  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM enterprise_permissions WHERE user_id = ?')
    .all(userId) as Array<Record<string, unknown>>;

  const matrix: UserPermissionMatrix = {};
  for (const row of rows) {
    matrix[String(row.module_id)] = {
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

export async function getBatchPermissionsMaps(
  users: EnterpriseUserRow[]
): Promise<Record<string, UserPermissionMatrix>> {
  const result: Record<string, UserPermissionMatrix> = {};
  const employeeIds: string[] = [];
  for (const u of users) {
    if (u.role === 'super_admin') {
      result[u.id] = buildFullAdminPermissionMatrix();
    } else {
      result[u.id] = {};
      employeeIds.push(u.id);
    }
  }
  if (employeeIds.length === 0) return result;

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_permissions')
      .select('user_id, module_id, permissions_json')
      .in('user_id', employeeIds);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const uid = String(row.user_id || '');
        const modId = String(row.module_id || '');
        const raw = (row.permissions_json || {}) as Partial<ModulePermissionSet>;
        if (!result[uid]) result[uid] = {};
        result[uid][modId] = {
          ...createEmptyPermissionSet(false),
          view: Boolean(raw.view),
          create: Boolean(raw.create),
          edit: Boolean(raw.edit),
          upload: Boolean(raw.upload),
          download: Boolean(raw.download),
          delete: Boolean(raw.delete),
          approve: Boolean(raw.approve),
          export: Boolean(raw.export),
          admin: Boolean(raw.admin),
        };
      }
      return result;
    }
  }

  const db = getDb();
  const rows = db.prepare('SELECT * FROM enterprise_permissions').all() as Array<Record<string, unknown>>;
  const idSet = new Set(employeeIds);
  for (const row of rows) {
    const uid = String(row.user_id || '');
    if (!idSet.has(uid)) continue;
    result[uid][String(row.module_id)] = {
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
  return result;
}

export async function saveUserPermissionsMap(
  userId: string,
  matrix: UserPermissionMatrix,
  updatedBy = 'super_admin'
): Promise<void> {
  const now = new Date().toISOString();
  const cleanRows: Array<{ moduleId: string; p: ModulePermissionSet }> = [];
  for (const [moduleId, perms] of Object.entries(matrix)) {
    if (!VALID_MODULE_IDS.has(moduleId)) continue;
    const p: ModulePermissionSet = {
      ...createEmptyPermissionSet(false),
      ...perms,
    };
    if (Object.values(p).some(Boolean)) {
      cleanRows.push({ moduleId, p });
    }
  }

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { error: delErr } = await sb.from('enterprise_permissions').delete().eq('user_id', userId);
    if (delErr) throw new Error(delErr.message);
    if (cleanRows.length > 0) {
      const { error: insErr } = await sb.from('enterprise_permissions').insert(
        cleanRows.map(({ moduleId, p }) => ({
          id: `perm_${userId}_${moduleId}`,
          user_id: userId,
          module_id: moduleId,
          permissions_json: p,
          updated_by: updatedBy,
          updated_at: now,
        }))
      );
      if (insErr) throw new Error(insErr.message);
    }
    return;
  }

  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM enterprise_permissions WHERE user_id = ?').run(userId);
    const stmt = db.prepare(`
      INSERT INTO enterprise_permissions (
        user_id, module_id, can_view, can_create, can_edit, can_upload,
        can_download, can_delete, can_approve, can_export, can_admin, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const { moduleId, p } of cleanRows) {
      stmt.run(
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

// =========================================================================
// DEPARTMENTS & DESIGNATIONS (GOVERNANCE TEMPLATES)
// =========================================================================
export async function listDepartments(): Promise<DepartmentRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_departments')
      .select('*')
      .order('name', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map((d) => ({
        id: String(d.id),
        name: String(d.name),
        code: String(d.code),
        description: String(d.description || ''),
        is_active: Boolean(d.is_active),
        created_at: String(d.created_at || ''),
        updated_at: String(d.updated_at || ''),
      }));
    }
  }
  ensureSqliteGovernanceSeeds();
  const rows = getDb()
    .prepare('SELECT * FROM enterprise_departments ORDER BY name ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((d) => ({
    id: String(d.id),
    name: String(d.name),
    code: String(d.code),
    description: String(d.description || ''),
    is_active: Boolean(d.is_active),
    created_at: String(d.created_at || ''),
    updated_at: String(d.updated_at || ''),
  }));
}

export async function createDepartment(input: {
  name: string;
  code: string;
  description?: string;
}): Promise<DepartmentRow> {
  const id = `dept_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_departments')
      .insert({
        id,
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description || '',
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      name: String(data.name),
      code: String(data.code),
      description: String(data.description || ''),
      is_active: Boolean(data.is_active),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  }
  ensureSqliteGovernanceSeeds();
  getDb()
    .prepare(
      'INSERT INTO enterprise_departments (id, name, code, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    )
    .run(id, input.name, input.code.toUpperCase(), input.description || '', now, now);
  return {
    id,
    name: input.name,
    code: input.code.toUpperCase(),
    description: input.description || '',
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export async function listDesignations(): Promise<DesignationRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_designations')
      .select('*')
      .order('name', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map((d) => ({
        id: String(d.id),
        department_id: String(d.department_id || ''),
        name: String(d.name),
        default_role: d.default_role === 'super_admin' ? 'super_admin' : 'employee',
        default_permissions: (d.default_permissions_json || {}) as UserPermissionMatrix,
        is_active: Boolean(d.is_active),
        created_at: String(d.created_at || ''),
        updated_at: String(d.updated_at || ''),
      }));
    }
  }
  ensureSqliteGovernanceSeeds();
  const rows = getDb()
    .prepare('SELECT * FROM enterprise_designations ORDER BY name ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((d) => {
    let parsed: UserPermissionMatrix = {};
    try {
      parsed = JSON.parse(String(d.default_permissions_json || '{}')) as UserPermissionMatrix;
    } catch {
      parsed = {};
    }
    return {
      id: String(d.id),
      department_id: String(d.department_id || ''),
      name: String(d.name),
      default_role: d.default_role === 'super_admin' ? 'super_admin' : 'employee',
      default_permissions: parsed,
      is_active: Boolean(d.is_active),
      created_at: String(d.created_at || ''),
      updated_at: String(d.updated_at || ''),
    };
  });
}

export async function createDesignation(input: {
  departmentId?: string;
  name: string;
  defaultPermissions?: UserPermissionMatrix;
}): Promise<DesignationRow> {
  const id = `desig_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const perms = input.defaultPermissions || {};
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_designations')
      .insert({
        id,
        department_id: input.departmentId || null,
        name: input.name,
        default_role: 'employee',
        default_permissions_json: perms,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      department_id: String(data.department_id || ''),
      name: String(data.name),
      default_role: 'employee',
      default_permissions: (data.default_permissions_json || {}) as UserPermissionMatrix,
      is_active: Boolean(data.is_active),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  }
  ensureSqliteGovernanceSeeds();
  getDb()
    .prepare(
      'INSERT INTO enterprise_designations (id, department_id, name, default_role, default_permissions_json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    )
    .run(id, input.departmentId || '', input.name, 'employee', JSON.stringify(perms), now, now);
  return {
    id,
    department_id: input.departmentId || '',
    name: input.name,
    default_role: 'employee',
    default_permissions: perms,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

// =========================================================================
// PASSWORD RESET REQUESTS
// =========================================================================
export async function upsertPendingResetRequest(input: {
  userId: string;
  username: string;
  fullName: string;
  note: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data: existing } = await sb
      .from('enterprise_password_reset_requests')
      .select('id')
      .eq('user_id', input.userId)
      .eq('status', 'Pending')
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await sb
        .from('enterprise_password_reset_requests')
        .update({
          note: input.note || 'Employee re-submitted password reset request.',
          requested_at: now,
        })
        .eq('id', existing.id);
    } else {
      await sb.from('enterprise_password_reset_requests').insert({
        id: `rst_${crypto.randomUUID()}`,
        user_id: input.userId,
        username: input.username,
        full_name: input.fullName,
        status: 'Pending',
        note: input.note,
        requested_at: now,
      });
    }
    return;
  }

  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id FROM enterprise_password_reset_requests WHERE user_id = ? AND status = 'Pending' LIMIT 1"
    )
    .get(input.userId) as { id?: string } | undefined;
  if (existing?.id) {
    db.prepare(
      'UPDATE enterprise_password_reset_requests SET note = ?, updated_at = ? WHERE id = ?'
    ).run(input.note || 'Employee re-submitted password reset request.', now, existing.id);
  } else {
    db.prepare(`
      INSERT INTO enterprise_password_reset_requests (
        id, user_id, username, full_name, status, note, resolved_by, resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Pending', ?, '', '', ?, ?)
    `).run(`rst_${crypto.randomUUID()}`, input.userId, input.username, input.fullName, input.note, now, now);
  }
}

export async function listResetRequests(): Promise<ResetRequestRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_password_reset_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id || ''),
        username: String(r.username || ''),
        full_name: String(r.full_name || ''),
        status: (String(r.status || 'Pending') as ResetRequestRow['status']),
        note: String(r.note || ''),
        resolved_by: String(r.resolved_by || ''),
        resolved_at: r.resolved_at ? String(r.resolved_at) : '',
        created_at: r.requested_at ? String(r.requested_at) : '',
        updated_at: r.resolved_at ? String(r.resolved_at) : String(r.requested_at || ''),
      }));
    }
  }

  const rows = getDb()
    .prepare('SELECT * FROM enterprise_password_reset_requests ORDER BY created_at DESC LIMIT 200')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id || ''),
    username: String(r.username || ''),
    full_name: String(r.full_name || ''),
    status: (String(r.status || 'Pending') as ResetRequestRow['status']),
    note: String(r.note || ''),
    resolved_by: String(r.resolved_by || ''),
    resolved_at: String(r.resolved_at || ''),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

export async function resolveResetRequestsForUser(input: {
  requestId?: string;
  userId: string;
  status: 'Approved' | 'Rejected';
  resolvedBy: string;
  note?: string;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    if (input.requestId) {
      const patch: Record<string, unknown> = {
        status: input.status,
        resolved_by: input.resolvedBy,
        resolved_at: now,
      };
      if (input.note) patch.note = input.note;
      const { data, error } = await sb
        .from('enterprise_password_reset_requests')
        .update(patch)
        .eq('id', input.requestId)
        .select('id');
      return !error && Boolean(data && data.length > 0);
    }
    await sb
      .from('enterprise_password_reset_requests')
      .update({
        status: input.status,
        resolved_by: input.resolvedBy,
        resolved_at: now,
      })
      .eq('user_id', input.userId)
      .eq('status', 'Pending');
    return true;
  }

  const db = getDb();
  if (input.requestId) {
    const info = db
      .prepare(`
        UPDATE enterprise_password_reset_requests
        SET status = ?, note = CASE WHEN ? != '' THEN ? ELSE note END,
            resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(input.status, input.note || '', input.note || '', input.resolvedBy, now, now, input.requestId);
    return Number(info.changes || 0) > 0;
  }
  db.prepare(`
    UPDATE enterprise_password_reset_requests
    SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
    WHERE user_id = ? AND status = 'Pending'
  `).run(input.status, input.resolvedBy, now, now, input.userId);
  return true;
}

// =========================================================================
// LOGIN HISTORY, ACTIVITY LOGS & AUDIT TRAILS
// =========================================================================
export async function recordLoginEvent(input: {
  userId: string;
  username: string;
  displayUsername: string;
  role?: string;
  outcome: string;
  detail: string;
  ipAddress: string;
  userAgent: string;
}): Promise<void> {
  const id = `lgn_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    const sb = getSupabaseAdminClient();
    if (sb) {
      await sb.from('enterprise_login_history').insert({
        id,
        user_id: input.userId || null,
        username: input.username,
        role: input.role || '',
        status: input.outcome,
        reason: input.detail,
        ip_address: input.ipAddress.slice(0, 64),
        user_agent: input.userAgent.slice(0, 240),
        created_at: now,
      });
      return;
    }
    getDb()
      .prepare(`
        INSERT INTO enterprise_login_history (
          id, user_id, username, display_username, outcome, detail, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.userId,
        input.username,
        input.displayUsername,
        input.outcome,
        input.detail,
        input.ipAddress.slice(0, 64),
        input.userAgent.slice(0, 240),
        now
      );
  } catch (err) {
    console.warn('Login history log failed:', err);
  }
}

export async function listLoginHistory(userIdFilter = ''): Promise<LoginHistoryRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    let q = sb
      .from('enterprise_login_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);
    if (userIdFilter) q = q.eq('user_id', userIdFilter);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id || ''),
        username: String(r.username || ''),
        display_username: String(r.username || ''),
        role: String(r.role || ''),
        outcome: String(r.status || ''),
        detail: String(r.reason || ''),
        ip_address: String(r.ip_address || ''),
        user_agent: String(r.user_agent || ''),
        created_at: String(r.created_at || ''),
      }));
    }
  }

  const db = getDb();
  const rows = (
    userIdFilter
      ? db
          .prepare('SELECT * FROM enterprise_login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 250')
          .all(userIdFilter)
      : db.prepare('SELECT * FROM enterprise_login_history ORDER BY created_at DESC LIMIT 250').all()
  ) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id || ''),
    username: String(r.username || ''),
    display_username: String(r.display_username || r.username || ''),
    role: '',
    outcome: String(r.outcome || ''),
    detail: String(r.detail || ''),
    ip_address: String(r.ip_address || ''),
    user_agent: String(r.user_agent || ''),
    created_at: String(r.created_at || ''),
  }));
}

export async function recordActivityEvent(input: {
  actorUserId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const id = `act_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    const sb = getSupabaseAdminClient();
    if (sb) {
      await sb.from('enterprise_activity_logs').insert({
        id,
        actor_user_id: input.actorUserId,
        actor_username: input.actorUsername,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId,
        summary: input.summary,
        metadata_json: input.metadata || {},
        created_at: now,
      });
      return;
    }
    getDb()
      .prepare(`
        INSERT INTO enterprise_activity_logs (
          id, actor_user_id, actor_username, action, target_type, target_id, summary, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.actorUserId,
        input.actorUsername,
        input.action,
        input.targetType,
        input.targetId,
        input.summary,
        JSON.stringify(input.metadata || {}),
        now
      );
  } catch (err) {
    console.warn('Activity log failed:', err);
  }
}

export async function listActivityLogs(userIdFilter = ''): Promise<ActivityLogRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    let q = sb
      .from('enterprise_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (userIdFilter) {
      q = q.or(`actor_user_id.eq.${userIdFilter},target_id.eq.${userIdFilter}`);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        actor_user_id: String(r.actor_user_id || ''),
        actor_username: String(r.actor_username || ''),
        action: String(r.action || ''),
        target_type: String(r.target_type || ''),
        target_id: String(r.target_id || ''),
        summary: String(r.summary || ''),
        metadata_json:
          typeof r.metadata_json === 'string'
            ? r.metadata_json
            : JSON.stringify(r.metadata_json || {}),
        created_at: String(r.created_at || ''),
      }));
    }
  }

  const db = getDb();
  const rows = (
    userIdFilter
      ? db
          .prepare(
            'SELECT * FROM enterprise_activity_logs WHERE actor_user_id = ? OR target_id = ? ORDER BY created_at DESC LIMIT 300'
          )
          .all(userIdFilter, userIdFilter)
      : db.prepare('SELECT * FROM enterprise_activity_logs ORDER BY created_at DESC LIMIT 300').all()
  ) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    actor_user_id: String(r.actor_user_id || ''),
    actor_username: String(r.actor_username || ''),
    action: String(r.action || ''),
    target_type: String(r.target_type || ''),
    target_id: String(r.target_id || ''),
    summary: String(r.summary || ''),
    metadata_json: String(r.metadata_json || '{}'),
    created_at: String(r.created_at || ''),
  }));
}

export async function recordAuditTrail(input: {
  actorUserId: string;
  actorUsername: string;
  category: string;
  eventType: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const id = `aud_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    const sb = getSupabaseAdminClient();
    if (sb) {
      await sb.from('enterprise_audit_logs').insert({
        id,
        actor_user_id: input.actorUserId,
        actor_username: input.actorUsername,
        category: input.category,
        event_type: input.eventType,
        target_type: input.targetType,
        target_id: input.targetId,
        before_json: input.before ?? null,
        after_json: input.after ?? null,
        ip_address: (input.ipAddress || '').slice(0, 64),
        user_agent: (input.userAgent || '').slice(0, 240),
        created_at: now,
      });
      return;
    }
    getDb()
      .prepare(`
        INSERT INTO enterprise_audit_logs (
          id, actor_user_id, actor_username, category, event_type, target_type, target_id,
          before_json, after_json, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.actorUserId,
        input.actorUsername,
        input.category,
        input.eventType,
        input.targetType,
        input.targetId,
        input.before ? JSON.stringify(input.before) : '',
        input.after ? JSON.stringify(input.after) : '',
        (input.ipAddress || '').slice(0, 64),
        (input.userAgent || '').slice(0, 240),
        now
      );
  } catch (err) {
    console.warn('Audit log write failed:', err);
  }
}

export async function listAuditLogs(limit = 200): Promise<AuditLogRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        actor_user_id: String(r.actor_user_id || ''),
        actor_username: String(r.actor_username || ''),
        category: String(r.category || ''),
        event_type: String(r.event_type || ''),
        target_type: String(r.target_type || ''),
        target_id: String(r.target_id || ''),
        before_json: r.before_json ? JSON.stringify(r.before_json) : '',
        after_json: r.after_json ? JSON.stringify(r.after_json) : '',
        ip_address: String(r.ip_address || ''),
        user_agent: String(r.user_agent || ''),
        created_at: String(r.created_at || ''),
      }));
    }
  }
  const rows = getDb()
    .prepare('SELECT * FROM enterprise_audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    actor_user_id: String(r.actor_user_id || ''),
    actor_username: String(r.actor_username || ''),
    category: String(r.category || ''),
    event_type: String(r.event_type || ''),
    target_type: String(r.target_type || ''),
    target_id: String(r.target_id || ''),
    before_json: String(r.before_json || ''),
    after_json: String(r.after_json || ''),
    ip_address: String(r.ip_address || ''),
    user_agent: String(r.user_agent || ''),
    created_at: String(r.created_at || ''),
  }));
}

// =========================================================================
// GOOGLE DRIVE CONFIGURATION & FOLDER MAP
// =========================================================================
export async function getDriveFoldersMap(): Promise<Record<string, DriveFolderRow>> {
  const out: Record<string, DriveFolderRow> = {};
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb.from('google_drive_folders').select('*');
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        out[String(r.folder_key)] = {
          id: String(r.id),
          folder_key: String(r.folder_key),
          folder_name: String(r.folder_name),
          parent_key: String(r.parent_key || ''),
          drive_folder_id: String(r.drive_folder_id || ''),
          drive_parent_id: String(r.drive_parent_id || ''),
          module_id: String(r.module_id || ''),
          created_at: String(r.created_at || ''),
          updated_at: String(r.updated_at || ''),
        };
      }
      return out;
    }
  }
  const rows = getDb().prepare('SELECT * FROM google_drive_folders').all() as Array<Record<string, unknown>>;
  for (const r of rows) {
    out[String(r.folder_key)] = {
      id: String(r.id),
      folder_key: String(r.folder_key),
      folder_name: String(r.folder_name),
      parent_key: String(r.parent_key || ''),
      drive_folder_id: String(r.drive_folder_id || ''),
      drive_parent_id: String(r.drive_parent_id || ''),
      module_id: String(r.module_id || ''),
      created_at: String(r.created_at || ''),
      updated_at: String(r.updated_at || ''),
    };
  }
  return out;
}

export async function saveDriveConfigurationAndFolders(input: {
  config: Omit<DriveConfigRow, 'id' | 'updated_at'>;
  folders?: Array<{
    folderKey: string;
    folderName: string;
    parentKey: string;
    driveFolderId: string;
    driveParentId: string;
    moduleId: string;
  }>;
}): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('google_drive_configuration').upsert(
      {
        id: 'primary',
        auth_mode: input.config.auth_mode,
        root_folder_id: input.config.root_folder_id,
        root_folder_name: input.config.root_folder_name,
        shared_drive_id: input.config.shared_drive_id,
        service_account_email: input.config.service_account_email,
        status: input.config.status,
        last_verified_at: input.config.last_verified_at || null,
        last_error: input.config.last_error,
        updated_by: input.config.updated_by,
        updated_at: now,
      },
      { onConflict: 'id' }
    );
    if (input.folders && input.folders.length > 0) {
      await sb.from('google_drive_folders').upsert(
        input.folders.map((f) => ({
          id: `gdf_${f.folderKey}`,
          folder_key: f.folderKey,
          folder_name: f.folderName,
          parent_key: f.parentKey,
          drive_folder_id: f.driveFolderId,
          drive_parent_id: f.driveParentId,
          module_id: f.moduleId,
          created_at: now,
          updated_at: now,
        })),
        { onConflict: 'folder_key' }
      );
    }
    return;
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO google_drive_configuration (
      id, auth_mode, root_folder_id, root_folder_name, shared_drive_id, service_account_email,
      status, last_verified_at, last_error, updated_by, updated_at
    ) VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      auth_mode = excluded.auth_mode,
      root_folder_id = excluded.root_folder_id,
      root_folder_name = excluded.root_folder_name,
      shared_drive_id = excluded.shared_drive_id,
      service_account_email = excluded.service_account_email,
      status = excluded.status,
      last_verified_at = excluded.last_verified_at,
      last_error = excluded.last_error,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(
    input.config.auth_mode,
    input.config.root_folder_id,
    input.config.root_folder_name,
    input.config.shared_drive_id,
    input.config.service_account_email,
    input.config.status,
    input.config.last_verified_at,
    input.config.last_error,
    input.config.updated_by,
    now
  );

  if (input.folders && input.folders.length > 0) {
    const fStmt = db.prepare(`
      INSERT INTO google_drive_folders (
        id, folder_key, folder_name, parent_key, drive_folder_id, drive_parent_id, module_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(folder_key) DO UPDATE SET
        folder_name = excluded.folder_name,
        parent_key = excluded.parent_key,
        drive_folder_id = excluded.drive_folder_id,
        drive_parent_id = excluded.drive_parent_id,
        module_id = excluded.module_id,
        updated_at = excluded.updated_at
    `);
    for (const f of input.folders) {
      fStmt.run(
        `gdf_${f.folderKey}`,
        f.folderKey,
        f.folderName,
        f.parentKey,
        f.driveFolderId,
        f.driveParentId,
        f.moduleId,
        now,
        now
      );
    }
  }
}

// =========================================================================
// DOCUMENTS & DOCUMENT VERSIONS (METADATA ONLY — BINARIES IN COMPANY GOOGLE DRIVE)
// =========================================================================
export async function listDocuments(filters?: {
  moduleId?: string;
  status?: string;
  folderKey?: string;
  includeArchived?: boolean;
  search?: string;
  limit?: number;
}): Promise<EnterpriseDocumentRow[]> {
  const limit = filters?.limit || 300;
  const sb = getSupabaseAdminClient();
  if (sb) {
    let q = sb
      .from('enterprise_documents')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (filters?.moduleId) q = q.eq('module_id', filters.moduleId);
    if (filters?.status) q = q.eq('approval_status', filters.status);
    if (filters?.folderKey) q = q.eq('folder_key', filters.folderKey);
    if (!filters?.includeArchived) q = q.eq('is_archived', false);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      let rows = data.map((r) => mapDocumentRow(r as Record<string, unknown>));
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (d) =>
            d.title.toLowerCase().includes(s) ||
            d.file_name.toLowerCase().includes(s) ||
            d.uploaded_by_username.toLowerCase().includes(s) ||
            d.tags.toLowerCase().includes(s)
        );
      }
      return rows;
    }
  }

  const db = getDb();
  const clauses: string[] = ["(deleted_at = '' OR deleted_at IS NULL)"];
  const params: Array<string | number> = [];
  if (filters?.moduleId) {
    clauses.push('module_id = ?');
    params.push(filters.moduleId);
  }
  if (filters?.status) {
    clauses.push('approval_status = ?');
    params.push(filters.status);
  }
  if (filters?.folderKey) {
    clauses.push('folder_key = ?');
    params.push(filters.folderKey);
  }
  if (!filters?.includeArchived) {
    clauses.push('is_archived = 0');
  }
  params.push(limit);

  const rawRows = db
    .prepare(
      `SELECT * FROM enterprise_documents WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`
    )
    .all(...params) as Array<Record<string, unknown>>;
  let rows = rawRows.map(mapDocumentRow);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.file_name.toLowerCase().includes(s) ||
        d.uploaded_by_username.toLowerCase().includes(s) ||
        d.tags.toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function getDocumentById(docId: string): Promise<EnterpriseDocumentRow | null> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_documents')
      .select('*')
      .eq('id', docId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!error) {
      return data ? mapDocumentRow(data as Record<string, unknown>) : null;
    }
  }
  const row = getDb()
    .prepare(
      "SELECT * FROM enterprise_documents WHERE id = ? AND (deleted_at = '' OR deleted_at IS NULL) LIMIT 1"
    )
    .get(docId) as Record<string, unknown> | undefined;
  return row ? mapDocumentRow(row) : null;
}

export async function createDocumentWithVersion(input: {
  id: string;
  moduleId: string;
  folderKey: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  approvalStatus: EnterpriseDocumentRow['approval_status'];
  driveFileId: string;
  driveFolderId: string;
  driveWebViewLink: string;
  checksumSha256: string;
  tags?: string;
  notes?: string;
  uploadedBy: string;
  uploadedByUsername: string;
}): Promise<EnterpriseDocumentRow> {
  const now = new Date().toISOString();
  const verId = `ver_${crypto.randomUUID()}`;
  const sb = getSupabaseAdminClient();

  if (sb) {
    const { data, error } = await sb
      .from('enterprise_documents')
      .insert({
        id: input.id,
        module_id: input.moduleId,
        folder_key: input.folderKey,
        title: input.title,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        approval_status: input.approvalStatus,
        storage_provider: 'google_drive',
        drive_file_id: input.driveFileId,
        drive_folder_id: input.driveFolderId,
        drive_web_view_link: input.driveWebViewLink,
        checksum_sha256: input.checksumSha256,
        version_number: 1,
        tags: input.tags || '',
        notes: input.notes || '',
        is_archived: false,
        uploaded_by: input.uploadedBy,
        uploaded_by_username: input.uploadedByUsername,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    await sb.from('enterprise_document_versions').insert({
      id: verId,
      document_id: input.id,
      version_number: 1,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      drive_file_id: input.driveFileId,
      drive_web_view_link: input.driveWebViewLink,
      checksum_sha256: input.checksumSha256,
      notes: input.notes || 'Initial upload',
      uploaded_by: input.uploadedBy,
      uploaded_by_username: input.uploadedByUsername,
      created_at: now,
    });

    return mapDocumentRow(data as Record<string, unknown>);
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO enterprise_documents (
      id, module_id, folder_key, title, file_name, stored_file_name, mime_type, size_bytes,
      approval_status, storage_provider, drive_file_id, drive_folder_id, drive_web_view_link,
      checksum_sha256, version_number, tags, notes, is_archived, archived_at, deleted_at,
      uploaded_by, uploaded_by_username, approved_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, 'google_drive', ?, ?, ?, ?, 1, ?, ?, 0, '', '', ?, ?, '', ?, ?)
  `).run(
    input.id,
    input.moduleId,
    input.folderKey,
    input.title,
    input.fileName,
    input.mimeType,
    input.sizeBytes,
    input.approvalStatus,
    input.driveFileId,
    input.driveFolderId,
    input.driveWebViewLink,
    input.checksumSha256,
    input.tags || '',
    input.notes || '',
    input.uploadedBy,
    input.uploadedByUsername,
    now,
    now
  );

  db.prepare(`
    INSERT INTO enterprise_document_versions (
      id, document_id, version_number, file_name, mime_type, size_bytes,
      drive_file_id, drive_web_view_link, checksum_sha256, notes,
      uploaded_by, uploaded_by_username, created_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    verId,
    input.id,
    input.fileName,
    input.mimeType,
    input.sizeBytes,
    input.driveFileId,
    input.driveWebViewLink,
    input.checksumSha256,
    input.notes || 'Initial upload',
    input.uploadedBy,
    input.uploadedByUsername,
    now
  );

  const created = await getDocumentById(input.id);
  if (!created) throw new Error('Document save failed');
  return created;
}

export async function updateDocumentMetadata(
  docId: string,
  patch: Partial<{
    title: string;
    approval_status: EnterpriseDocumentRow['approval_status'];
    approved_by: string;
    folder_key: string;
    drive_file_id: string;
    drive_folder_id: string;
    drive_web_view_link: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    checksum_sha256: string;
    version_number: number;
    tags: string;
    notes: string;
    is_archived: boolean;
    archived_at: string | null;
    deleted_at: string | null;
  }>
): Promise<EnterpriseDocumentRow | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const sbPatch: Record<string, unknown> = { updated_at: now, ...patch };
    const { data, error } = await sb
      .from('enterprise_documents')
      .update(sbPatch)
      .eq('id', docId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapDocumentRow(data as Record<string, unknown>) : null;
  }

  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const vals: Array<string | number> = [now];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    if (typeof v === 'boolean') {
      vals.push(v ? 1 : 0);
    } else if (v === null) {
      vals.push('');
    } else {
      vals.push(v);
    }
  }
  vals.push(docId);
  db.prepare(`UPDATE enterprise_documents SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getDocumentById(docId);
}

export async function addDocumentVersionRecord(input: {
  documentId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  driveFileId: string;
  driveWebViewLink: string;
  checksumSha256: string;
  notes: string;
  uploadedBy: string;
  uploadedByUsername: string;
}): Promise<void> {
  const id = `ver_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('enterprise_document_versions').insert({
      id,
      document_id: input.documentId,
      version_number: input.versionNumber,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      drive_file_id: input.driveFileId,
      drive_web_view_link: input.driveWebViewLink,
      checksum_sha256: input.checksumSha256,
      notes: input.notes,
      uploaded_by: input.uploadedBy,
      uploaded_by_username: input.uploadedByUsername,
      created_at: now,
    });
    return;
  }
  getDb()
    .prepare(`
      INSERT INTO enterprise_document_versions (
        id, document_id, version_number, file_name, mime_type, size_bytes,
        drive_file_id, drive_web_view_link, checksum_sha256, notes,
        uploaded_by, uploaded_by_username, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.documentId,
      input.versionNumber,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.driveFileId,
      input.driveWebViewLink,
      input.checksumSha256,
      input.notes,
      input.uploadedBy,
      input.uploadedByUsername,
      now
    );
}

export async function listDocumentVersions(documentId: string): Promise<DocumentVersionRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        document_id: String(r.document_id),
        version_number: Number(r.version_number || 1),
        file_name: String(r.file_name),
        mime_type: String(r.mime_type || 'application/octet-stream'),
        size_bytes: Number(r.size_bytes || 0),
        drive_file_id: String(r.drive_file_id || ''),
        drive_web_view_link: String(r.drive_web_view_link || ''),
        checksum_sha256: String(r.checksum_sha256 || ''),
        notes: String(r.notes || ''),
        uploaded_by: String(r.uploaded_by || ''),
        uploaded_by_username: String(r.uploaded_by_username || ''),
        created_at: String(r.created_at || ''),
      }));
    }
  }
  const rows = getDb()
    .prepare('SELECT * FROM enterprise_document_versions WHERE document_id = ? ORDER BY version_number DESC')
    .all(documentId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    document_id: String(r.document_id),
    version_number: Number(r.version_number || 1),
    file_name: String(r.file_name),
    mime_type: String(r.mime_type || 'application/octet-stream'),
    size_bytes: Number(r.size_bytes || 0),
    drive_file_id: String(r.drive_file_id || ''),
    drive_web_view_link: String(r.drive_web_view_link || ''),
    checksum_sha256: String(r.checksum_sha256 || ''),
    notes: String(r.notes || ''),
    uploaded_by: String(r.uploaded_by || ''),
    uploaded_by_username: String(r.uploaded_by_username || ''),
    created_at: String(r.created_at || ''),
  }));
}

export async function deleteDocumentMetadata(docId: string): Promise<void> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('enterprise_document_versions').delete().eq('document_id', docId);
    await sb.from('enterprise_documents').delete().eq('id', docId);
    return;
  }
  const db = getDb();
  db.prepare('DELETE FROM enterprise_document_versions WHERE document_id = ?').run(docId);
  db.prepare('DELETE FROM enterprise_documents WHERE id = ?').run(docId);
}

// =========================================================================
// WORKSPACE RECORDS & REPORT MANAGEMENT RECORDS
// =========================================================================
function mapWorkspaceRecord(r: Record<string, unknown>): WorkspaceRecordRow {
  return {
    id: String(r.id),
    module_id: String(r.module_id),
    record_title: String(r.record_title),
    reference_code: String(r.reference_code || ''),
    status: String(r.status || 'Active'),
    payload_json:
      typeof r.payload_json === 'string'
        ? r.payload_json
        : JSON.stringify(r.payload_json || {}),
    is_archived: Boolean(r.is_archived),
    deleted_at: r.deleted_at ? String(r.deleted_at) : '',
    created_by: String(r.created_by || ''),
    created_by_username: String(r.created_by_username || ''),
    updated_by: String(r.updated_by || ''),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  };
}

export async function listWorkspaceRecords(moduleId = ''): Promise<WorkspaceRecordRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    let q = sb
      .from('enterprise_workspace_records')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(300);
    if (moduleId) q = q.eq('module_id', moduleId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data.map((r) => mapWorkspaceRecord(r as Record<string, unknown>));
    }
  }
  const db = getDb();
  const rows = (
    moduleId
      ? db
          .prepare(
            "SELECT * FROM enterprise_workspace_records WHERE module_id = ? AND (deleted_at = '' OR deleted_at IS NULL) ORDER BY updated_at DESC LIMIT 300"
          )
          .all(moduleId)
      : db
          .prepare(
            "SELECT * FROM enterprise_workspace_records WHERE (deleted_at = '' OR deleted_at IS NULL) ORDER BY updated_at DESC LIMIT 300"
          )
          .all()
  ) as Array<Record<string, unknown>>;
  return rows.map(mapWorkspaceRecord);
}

export async function getWorkspaceRecordById(id: string): Promise<WorkspaceRecordRow | null> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_workspace_records')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!error) return data ? mapWorkspaceRecord(data as Record<string, unknown>) : null;
  }
  const row = getDb()
    .prepare(
      "SELECT * FROM enterprise_workspace_records WHERE id = ? AND (deleted_at = '' OR deleted_at IS NULL) LIMIT 1"
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapWorkspaceRecord(row) : null;
}

export async function createWorkspaceRecord(input: {
  moduleId: string;
  recordTitle: string;
  referenceCode: string;
  status: string;
  payload: unknown;
  createdBy: string;
  createdByUsername: string;
}): Promise<WorkspaceRecordRow> {
  const id = `rec_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const payloadObj =
    input.payload && typeof input.payload === 'object' ? input.payload : {};
  const payloadStr = JSON.stringify(payloadObj).slice(0, 65000);

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('enterprise_workspace_records')
      .insert({
        id,
        module_id: input.moduleId,
        record_title: input.recordTitle,
        reference_code: input.referenceCode,
        status: input.status,
        payload_json: payloadObj,
        is_archived: false,
        created_by: input.createdBy,
        created_by_username: input.createdByUsername,
        updated_by: input.createdByUsername,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapWorkspaceRecord(data as Record<string, unknown>);
  }

  getDb()
    .prepare(`
      INSERT INTO enterprise_workspace_records (
        id, module_id, record_title, reference_code, status, payload_json,
        is_archived, deleted_at, created_by, created_by_username, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.moduleId,
      input.recordTitle,
      input.referenceCode,
      input.status,
      payloadStr,
      input.createdBy,
      input.createdByUsername,
      input.createdByUsername,
      now,
      now
    );

  const created = await getWorkspaceRecordById(id);
  if (!created) throw new Error('Workspace record create failed');
  return created;
}

export async function updateWorkspaceRecord(
  id: string,
  patch: Partial<{
    record_title: string;
    reference_code: string;
    status: string;
    payload: unknown;
    updated_by: string;
  }>
): Promise<WorkspaceRecordRow | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const sbPatch: Record<string, unknown> = { updated_at: now };
    if (patch.record_title !== undefined) sbPatch.record_title = patch.record_title;
    if (patch.reference_code !== undefined) sbPatch.reference_code = patch.reference_code;
    if (patch.status !== undefined) sbPatch.status = patch.status;
    if (patch.updated_by !== undefined) sbPatch.updated_by = patch.updated_by;
    if (patch.payload !== undefined) sbPatch.payload_json = patch.payload;
    const { data, error } = await sb
      .from('enterprise_workspace_records')
      .update(sbPatch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapWorkspaceRecord(data as Record<string, unknown>) : null;
  }

  const sets: string[] = ['updated_at = ?'];
  const vals: string[] = [now];
  if (patch.record_title !== undefined) {
    sets.push('record_title = ?');
    vals.push(patch.record_title);
  }
  if (patch.reference_code !== undefined) {
    sets.push('reference_code = ?');
    vals.push(patch.reference_code);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    vals.push(patch.status);
  }
  if (patch.updated_by !== undefined) {
    sets.push('updated_by = ?');
    vals.push(patch.updated_by);
  }
  if (patch.payload !== undefined) {
    sets.push('payload_json = ?');
    vals.push(JSON.stringify(patch.payload).slice(0, 65000));
  }
  vals.push(id);
  getDb().prepare(`UPDATE enterprise_workspace_records SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getWorkspaceRecordById(id);
}

export async function deleteWorkspaceRecord(id: string): Promise<void> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('enterprise_workspace_records').delete().eq('id', id);
    return;
  }
  getDb().prepare('DELETE FROM enterprise_workspace_records WHERE id = ?').run(id);
}

export async function listReportRecords(limit = 150): Promise<ReportRecordRow[]> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('report_management_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: String(r.id),
        report_type: String(r.report_type),
        report_title: String(r.report_title),
        format: (String(r.format || 'csv') as ReportRecordRow['format']),
        module_filter: String(r.module_filter || 'all'),
        date_range_label: String(r.date_range_label || 'All Time'),
        row_count: Number(r.row_count || 0),
        drive_file_id: String(r.drive_file_id || ''),
        drive_web_view_link: String(r.drive_web_view_link || ''),
        file_name: String(r.file_name || ''),
        size_bytes: Number(r.size_bytes || 0),
        status: String(r.status || 'Generated'),
        generated_by: String(r.generated_by || ''),
        generated_by_username: String(r.generated_by_username || ''),
        created_at: String(r.created_at || ''),
      }));
    }
  }
  const rows = getDb()
    .prepare('SELECT * FROM report_management_records ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    report_type: String(r.report_type),
    report_title: String(r.report_title),
    format: (String(r.format || 'csv') as ReportRecordRow['format']),
    module_filter: String(r.module_filter || 'all'),
    date_range_label: String(r.date_range_label || 'All Time'),
    row_count: Number(r.row_count || 0),
    drive_file_id: String(r.drive_file_id || ''),
    drive_web_view_link: String(r.drive_web_view_link || ''),
    file_name: String(r.file_name || ''),
    size_bytes: Number(r.size_bytes || 0),
    status: String(r.status || 'Generated'),
    generated_by: String(r.generated_by || ''),
    generated_by_username: String(r.generated_by_username || ''),
    created_at: String(r.created_at || ''),
  }));
}

export async function createReportRecord(
  input: Omit<ReportRecordRow, 'id' | 'created_at'>
): Promise<ReportRecordRow> {
  const id = `rpt_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('report_management_records')
      .insert({
        id,
        ...input,
        created_at: now,
      })
      .select('*')
      .single();
    if (!error && data) {
      return {
        ...input,
        id: String(data.id),
        created_at: String(data.created_at),
      };
    }
  }
  getDb()
    .prepare(`
      INSERT INTO report_management_records (
        id, report_type, report_title, format, module_filter, date_range_label,
        row_count, drive_file_id, drive_web_view_link, file_name, size_bytes,
        status, generated_by, generated_by_username, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.report_type,
      input.report_title,
      input.format,
      input.module_filter,
      input.date_range_label,
      input.row_count,
      input.drive_file_id,
      input.drive_web_view_link,
      input.file_name,
      input.size_bytes,
      input.status,
      input.generated_by,
      input.generated_by_username,
      now
    );
  return { id, ...input, created_at: now };
}

// =========================================================================
// SHARED SETTINGS & BLOG PERSISTENCE (SUPABASE + SQLITE FALLBACK)
// =========================================================================
export async function getSharedSetting(key: string): Promise<string | null> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (!error) return data?.value ? String(data.value) : null;
  }
  const row = getDb()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value?: string } | undefined;
  return row?.value ?? null;
}

export async function setSharedSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    await sb.from('app_settings').upsert({ key, value, updated_at: now }, { onConflict: 'key' });
    return;
  }
  getDb()
    .prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    )
    .run(key, value, now);
}

export async function getEnterprisePersistenceSummary(): Promise<{
  backend: 'supabase' | 'sqlite_fallback';
  userCount: number;
  documentCount: number;
  recordCount: number;
  reportCount: number;
}> {
  const users = await listUsers(true);
  const docs = await listDocuments({ includeArchived: true, limit: 1000 });
  const records = await listWorkspaceRecords();
  const reports = await listReportRecords(500);
  return {
    backend: isSupabaseConfigured() ? 'supabase' : 'sqlite_fallback',
    userCount: users.length,
    documentCount: docs.length,
    recordCount: records.length,
    reportCount: reports.length,
  };
}

// =========================================================================
// HOMEPAGE "WHAT'S NEW AT VCPL" ANNOUNCEMENTS (SUPABASE + APP_SETTINGS + SQLITE)
// =========================================================================
export type AnnouncementBadge = 'NEW' | 'UPGRADE' | 'BETA' | 'INFO';

export interface HomepageAnnouncement {
  id: string;
  title: string;
  badge: AnnouncementBadge;
  summary: string;
  launchDate: string;
  toolId: string;
  actionLabel: string;
  actionUrl: string;
  isPinned: boolean;
  isActive: boolean;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const ANNOUNCEMENTS_SETTINGS_KEY = 'vcpl_homepage_announcements_v1';
const ANNOUNCEMENTS_SEEDED_KEY = 'vcpl_homepage_announcements_seeded_v1';

const DEFAULT_ANNOUNCEMENTS: HomepageAnnouncement[] = [
  {
    id: 'ann_vcpl_ai_text_cleaner',
    title: 'VCPL AI Text Cleaner',
    badge: 'NEW',
    summary:
      'Clean ChatGPT, Claude, Gemini & Copilot text 100% locally in your browser—strip Markdown, citations, invisible characters, stray symbols & uneven spacing while preserving original meaning.',
    launchDate: '2026-11-24',
    toolId: 'ai-text-cleaner',
    actionLabel: 'Open Tool',
    actionUrl: '',
    isPinned: true,
    isActive: true,
    sortOrder: 1,
    createdBy: 'system',
    updatedBy: 'system',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  },
];

function normalizeAnnouncementRow(raw: Record<string, unknown>): HomepageAnnouncement {
  const badgeRaw = String(raw.badge ?? 'NEW').toUpperCase();
  const badge: AnnouncementBadge =
    badgeRaw === 'UPGRADE' || badgeRaw === 'BETA' || badgeRaw === 'INFO' ? badgeRaw : 'NEW';
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    badge,
    summary: String(raw.summary || ''),
    launchDate: String(raw.launch_date ?? raw.launchDate ?? new Date().toISOString().slice(0, 10)),
    toolId: String(raw.tool_id ?? raw.toolId ?? ''),
    actionLabel: String(raw.action_label ?? raw.actionLabel ?? 'Open Tool') || 'Open Tool',
    actionUrl: String(raw.action_url ?? raw.actionUrl ?? ''),
    isPinned: Boolean(raw.is_pinned ?? raw.isPinned ?? false),
    isActive: raw.is_active !== undefined ? Boolean(raw.is_active) : raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    sortOrder: Number(raw.sort_order ?? raw.sortOrder ?? 0) || 0,
    createdBy: String(raw.created_by ?? raw.createdBy ?? 'system'),
    updatedBy: String(raw.updated_by ?? raw.updatedBy ?? 'system'),
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? new Date().toISOString()),
  };
}

function sortAnnouncements(list: HomepageAnnouncement[]): HomepageAnnouncement[] {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.launchDate.localeCompare(a.launchDate) || b.createdAt.localeCompare(a.createdAt);
  });
}

async function readFallbackAnnouncementsList(): Promise<HomepageAnnouncement[]> {
  const raw = await getSharedSetting(ANNOUNCEMENTS_SETTINGS_KEY);
  if (!raw) {
    const seeded = await getSharedSetting(ANNOUNCEMENTS_SEEDED_KEY);
    if (!seeded) {
      await setSharedSetting(ANNOUNCEMENTS_SETTINGS_KEY, JSON.stringify(DEFAULT_ANNOUNCEMENTS));
      await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
      return DEFAULT_ANNOUNCEMENTS;
    }
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return DEFAULT_ANNOUNCEMENTS;
    return sortAnnouncements(parsed.map(normalizeAnnouncementRow));
  } catch {
    return DEFAULT_ANNOUNCEMENTS;
  }
}

async function writeFallbackAnnouncementsList(list: HomepageAnnouncement[]): Promise<void> {
  await setSharedSetting(ANNOUNCEMENTS_SETTINGS_KEY, JSON.stringify(sortAnnouncements(list)));
  await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
}

export async function listHomepageAnnouncements(options?: {
  activeOnly?: boolean;
}): Promise<HomepageAnnouncement[]> {
  const activeOnly = Boolean(options?.activeOnly);
  const sb = getSupabaseAdminClient();
  if (sb) {
    let query = sb.from('homepage_announcements').select('*');
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (!error && data) {
      if (data.length === 0) {
        const seeded = await getSharedSetting(ANNOUNCEMENTS_SEEDED_KEY);
        if (!seeded) {
          for (const item of DEFAULT_ANNOUNCEMENTS) {
            await sb.from('homepage_announcements').upsert({
              id: item.id,
              title: item.title,
              badge: item.badge,
              summary: item.summary,
              launch_date: item.launchDate,
              tool_id: item.toolId,
              action_label: item.actionLabel,
              action_url: item.actionUrl,
              is_pinned: item.isPinned,
              is_active: item.isActive,
              sort_order: item.sortOrder,
              created_by: item.createdBy,
              updated_by: item.updatedBy,
              created_at: item.createdAt,
              updated_at: item.updatedAt,
            });
          }
          await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
          return DEFAULT_ANNOUNCEMENTS.filter((item) => !activeOnly || item.isActive);
        }
      }
      return sortAnnouncements(data.map((r) => normalizeAnnouncementRow(r as Record<string, unknown>)));
    }
    const fallback = await readFallbackAnnouncementsList();
    return activeOnly ? fallback.filter((item) => item.isActive) : fallback;
  }

  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM homepage_announcements').get() as
    | { cnt?: number }
    | undefined;
  if ((countRow?.cnt ?? 0) === 0) {
    const seededRow = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(ANNOUNCEMENTS_SEEDED_KEY) as { value?: string } | undefined;
    if (!seededRow) {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO homepage_announcements (
          id, title, badge, summary, launch_date, tool_id, action_label, action_url,
          is_pinned, is_active, sort_order, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of DEFAULT_ANNOUNCEMENTS) {
        insertStmt.run(
          item.id,
          item.title,
          item.badge,
          item.summary,
          item.launchDate,
          item.toolId,
          item.actionLabel,
          item.actionUrl,
          item.isPinned ? 1 : 0,
          item.isActive ? 1 : 0,
          item.sortOrder,
          item.createdBy,
          item.updatedBy,
          item.createdAt,
          item.updatedAt
        );
      }
      await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
    }
  }

  const rows = db
    .prepare(
      activeOnly
        ? 'SELECT * FROM homepage_announcements WHERE is_active = 1'
        : 'SELECT * FROM homepage_announcements'
    )
    .all() as Array<Record<string, unknown>>;
  return sortAnnouncements(rows.map(normalizeAnnouncementRow));
}

export async function createHomepageAnnouncement(input: {
  title: string;
  badge: AnnouncementBadge;
  summary: string;
  launchDate: string;
  toolId?: string;
  actionLabel?: string;
  actionUrl?: string;
  isPinned?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  actorUsername: string;
}): Promise<HomepageAnnouncement> {
  const now = new Date().toISOString();
  const record: HomepageAnnouncement = {
    id: `ann_${crypto.randomUUID().slice(0, 12)}`,
    title: input.title,
    badge: input.badge,
    summary: input.summary,
    launchDate: input.launchDate,
    toolId: input.toolId || '',
    actionLabel: input.actionLabel || 'Open Tool',
    actionUrl: input.actionUrl || '',
    isPinned: Boolean(input.isPinned),
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    createdBy: input.actorUsername,
    updatedBy: input.actorUsername,
    createdAt: now,
    updatedAt: now,
  };

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data, error } = await sb
      .from('homepage_announcements')
      .insert({
        id: record.id,
        title: record.title,
        badge: record.badge,
        summary: record.summary,
        launch_date: record.launchDate,
        tool_id: record.toolId,
        action_label: record.actionLabel,
        action_url: record.actionUrl,
        is_pinned: record.isPinned,
        is_active: record.isActive,
        sort_order: record.sortOrder,
        created_by: record.createdBy,
        updated_by: record.updatedBy,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      })
      .select('*')
      .single();
    if (!error && data) {
      await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
      return normalizeAnnouncementRow(data as Record<string, unknown>);
    }
    const existing = await readFallbackAnnouncementsList();
    existing.unshift(record);
    await writeFallbackAnnouncementsList(existing);
    return record;
  }

  getDb()
    .prepare(`
      INSERT INTO homepage_announcements (
        id, title, badge, summary, launch_date, tool_id, action_label, action_url,
        is_pinned, is_active, sort_order, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      record.id,
      record.title,
      record.badge,
      record.summary,
      record.launchDate,
      record.toolId,
      record.actionLabel,
      record.actionUrl,
      record.isPinned ? 1 : 0,
      record.isActive ? 1 : 0,
      record.sortOrder,
      record.createdBy,
      record.updatedBy,
      record.createdAt,
      record.updatedAt
    );
  await setSharedSetting(ANNOUNCEMENTS_SEEDED_KEY, '1');
  return record;
}

export async function updateHomepageAnnouncement(
  id: string,
  patch: Partial<{
    title: string;
    badge: AnnouncementBadge;
    summary: string;
    launchDate: string;
    toolId: string;
    actionLabel: string;
    actionUrl: string;
    isPinned: boolean;
    isActive: boolean;
    sortOrder: number;
  }>,
  actorUsername: string
): Promise<HomepageAnnouncement | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const payload: Record<string, unknown> = {
      updated_by: actorUsername,
      updated_at: now,
    };
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.badge !== undefined) payload.badge = patch.badge;
    if (patch.summary !== undefined) payload.summary = patch.summary;
    if (patch.launchDate !== undefined) payload.launch_date = patch.launchDate;
    if (patch.toolId !== undefined) payload.tool_id = patch.toolId;
    if (patch.actionLabel !== undefined) payload.action_label = patch.actionLabel;
    if (patch.actionUrl !== undefined) payload.action_url = patch.actionUrl;
    if (patch.isPinned !== undefined) payload.is_pinned = patch.isPinned;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;

    const { data, error } = await sb
      .from('homepage_announcements')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (!error) {
      return data ? normalizeAnnouncementRow(data as Record<string, unknown>) : null;
    }

    const list = await readFallbackAnnouncementsList();
    const idx = list.findIndex((item) => item.id === id);
    if (idx < 0) return null;
    const updated: HomepageAnnouncement = {
      ...list[idx],
      ...patch,
      updatedBy: actorUsername,
      updatedAt: now,
    };
    list[idx] = updated;
    await writeFallbackAnnouncementsList(list);
    return updated;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM homepage_announcements WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const current = normalizeAnnouncementRow(existing);
  const next: HomepageAnnouncement = {
    ...current,
    ...patch,
    updatedBy: actorUsername,
    updatedAt: now,
  };
  db.prepare(`
    UPDATE homepage_announcements
    SET title = ?, badge = ?, summary = ?, launch_date = ?, tool_id = ?,
        action_label = ?, action_url = ?, is_pinned = ?, is_active = ?, sort_order = ?,
        updated_by = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.title,
    next.badge,
    next.summary,
    next.launchDate,
    next.toolId,
    next.actionLabel,
    next.actionUrl,
    next.isPinned ? 1 : 0,
    next.isActive ? 1 : 0,
    next.sortOrder,
    next.updatedBy,
    next.updatedAt,
    id
  );
  return next;
}

export async function deleteHomepageAnnouncement(id: string): Promise<boolean> {
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { error, count } = await sb
      .from('homepage_announcements')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (!error) {
      return (count ?? 0) > 0;
    }
    const list = await readFallbackAnnouncementsList();
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    await writeFallbackAnnouncementsList(filtered);
    return true;
  }

  const info = getDb().prepare('DELETE FROM homepage_announcements WHERE id = ?').run(id);
  return Number(info.changes || 0) > 0;
}
