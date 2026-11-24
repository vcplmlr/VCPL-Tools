import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'vcpl_data')
  : path.resolve(process.cwd(), 'data');
export const DB_FILE_PATH = path.join(DATA_DIR, 'vcpl_directory.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_FILE_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA cache_size = -32000;');

  ensureSchema(db);
  dbInstance = db;
  return db;
}

export function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS india_pincodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pincode TEXT NOT NULL,
      office_name TEXT NOT NULL,
      office_type TEXT NOT NULL DEFAULT '',
      delivery_status TEXT NOT NULL DEFAULT 'Unverified',
      district TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      division TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      circle TEXT NOT NULL DEFAULT '',
      taluk TEXT NOT NULL DEFAULT '',
      postal_address TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      verification_status TEXT NOT NULL DEFAULT 'verified',
      source TEXT NOT NULL DEFAULT '',
      source_record_id TEXT NOT NULL DEFAULT '',
      last_verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(pincode, office_name, district)
    );

    CREATE INDEX IF NOT EXISTS idx_pincodes_pincode ON india_pincodes(pincode);
    CREATE INDEX IF NOT EXISTS idx_pincodes_office_name ON india_pincodes(office_name);
    CREATE INDEX IF NOT EXISTS idx_pincodes_state ON india_pincodes(state);
    CREATE INDEX IF NOT EXISTS idx_pincodes_district ON india_pincodes(district);
    CREATE INDEX IF NOT EXISTS idx_pincodes_state_district ON india_pincodes(state, district);
    CREATE INDEX IF NOT EXISTS idx_pincodes_delivery ON india_pincodes(delivery_status);
    CREATE INDEX IF NOT EXISTS idx_pincodes_type ON india_pincodes(office_type);
    CREATE INDEX IF NOT EXISTS idx_pincodes_verification ON india_pincodes(verification_status);
    CREATE INDEX IF NOT EXISTS idx_pincodes_state_pin ON india_pincodes(state, pincode);
    CREATE INDEX IF NOT EXISTS idx_pincodes_state_dist_pin ON india_pincodes(state, district, pincode);

    CREATE TABLE IF NOT EXISTS india_ifsc (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ifsc TEXT NOT NULL UNIQUE,
      bank_name TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      micr TEXT NOT NULL DEFAULT '',
      bank_code TEXT NOT NULL,
      branch_code TEXT NOT NULL,
      bank_category TEXT NOT NULL DEFAULT '',
      bank_status TEXT NOT NULL DEFAULT 'Active',
      successor_bank TEXT NOT NULL DEFAULT '',
      successor_ifsc_prefix TEXT NOT NULL DEFAULT '',
      upi INTEGER NOT NULL DEFAULT 0,
      rtgs INTEGER NOT NULL DEFAULT 0,
      neft INTEGER NOT NULL DEFAULT 0,
      imps INTEGER NOT NULL DEFAULT 0,
      swift TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL DEFAULT 'verified',
      source TEXT NOT NULL DEFAULT '',
      source_record_id TEXT NOT NULL DEFAULT '',
      last_verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ifsc_code ON india_ifsc(ifsc);
    CREATE INDEX IF NOT EXISTS idx_ifsc_bank_name ON india_ifsc(bank_name);
    CREATE INDEX IF NOT EXISTS idx_ifsc_bank_code ON india_ifsc(bank_code);
    CREATE INDEX IF NOT EXISTS idx_ifsc_branch_name ON india_ifsc(branch_name);
    CREATE INDEX IF NOT EXISTS idx_ifsc_state ON india_ifsc(state);
    CREATE INDEX IF NOT EXISTS idx_ifsc_district ON india_ifsc(district);
    CREATE INDEX IF NOT EXISTS idx_ifsc_city ON india_ifsc(city);
    CREATE INDEX IF NOT EXISTS idx_ifsc_micr ON india_ifsc(micr);
    CREATE INDEX IF NOT EXISTS idx_ifsc_status ON india_ifsc(bank_status);
    CREATE INDEX IF NOT EXISTS idx_ifsc_category ON india_ifsc(bank_category);
    CREATE INDEX IF NOT EXISTS idx_ifsc_status_bank ON india_ifsc(bank_status, bank_name, bank_code, bank_category);
    CREATE INDEX IF NOT EXISTS idx_ifsc_status_state_dist ON india_ifsc(bank_status, state, district, city);
    CREATE INDEX IF NOT EXISTS idx_ifsc_status_bank_state ON india_ifsc(bank_status, bank_name, state);

    CREATE TABLE IF NOT EXISTS india_rto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      state_code TEXT NOT NULL,
      office_name TEXT NOT NULL,
      district TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      rto_type TEXT NOT NULL DEFAULT 'RTO',
      status TEXT NOT NULL DEFAULT 'active',
      verification_status TEXT NOT NULL DEFAULT 'verified',
      note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      source_record_id TEXT NOT NULL DEFAULT '',
      last_verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rto_code ON india_rto(code);
    CREATE INDEX IF NOT EXISTS idx_rto_state_code ON india_rto(state_code);
    CREATE INDEX IF NOT EXISTS idx_rto_state ON india_rto(state);
    CREATE INDEX IF NOT EXISTS idx_rto_district ON india_rto(district);
    CREATE INDEX IF NOT EXISTS idx_rto_city ON india_rto(city);
    CREATE INDEX IF NOT EXISTS idx_rto_status ON india_rto(status);
    CREATE INDEX IF NOT EXISTS idx_rto_state_status ON india_rto(state, status, code);

    CREATE TABLE IF NOT EXISTS dataset_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT NOT NULL,
      source_label TEXT NOT NULL,
      format TEXT NOT NULL,
      version_tag TEXT NOT NULL DEFAULT '',
      total_rows INTEGER NOT NULL DEFAULT 0,
      inserted_rows INTEGER NOT NULL DEFAULT 0,
      updated_rows INTEGER NOT NULL DEFAULT 0,
      duplicate_rows INTEGER NOT NULL DEFAULT 0,
      invalid_rows INTEGER NOT NULL DEFAULT 0,
      missing_fields_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      error_samples_json TEXT NOT NULL DEFAULT '[]',
      imported_by TEXT NOT NULL DEFAULT 'admin',
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auto_blog_posts (
      slug TEXT PRIMARY KEY,
      queue_no INTEGER NOT NULL,
      published_ist_date TEXT NOT NULL,
      post_json TEXT NOT NULL,
      cover_svg TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auto_blog_ist_date ON auto_blog_posts(published_ist_date DESC);

    CREATE TABLE IF NOT EXISTS enterprise_departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_designations (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL UNIQUE,
      default_role TEXT NOT NULL DEFAULT 'employee',
      default_permissions_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_username TEXT NOT NULL,
      internal_auth_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      employee_id TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT 'Operations',
      designation TEXT NOT NULL DEFAULT 'Executive',
      contact_number TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'employee',
      status TEXT NOT NULL DEFAULT 'Pending Approval',
      is_archived INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT NOT NULL DEFAULT '',
      token_version INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT NOT NULL DEFAULT '',
      last_active_at TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_ent_users_username ON enterprise_users(username);
    CREATE INDEX IF NOT EXISTS idx_ent_users_status ON enterprise_users(status, is_archived);
    CREATE INDEX IF NOT EXISTS idx_ent_users_role ON enterprise_users(role);

    CREATE TABLE IF NOT EXISTS enterprise_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      token_version INTEGER NOT NULL DEFAULT 1,
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT '',
      revoke_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_sessions_user ON enterprise_sessions(user_id, revoked_at, expires_at);

    CREATE TABLE IF NOT EXISTS enterprise_permissions (
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 0,
      can_create INTEGER NOT NULL DEFAULT 0,
      can_edit INTEGER NOT NULL DEFAULT 0,
      can_upload INTEGER NOT NULL DEFAULT 0,
      can_download INTEGER NOT NULL DEFAULT 0,
      can_delete INTEGER NOT NULL DEFAULT 0,
      can_approve INTEGER NOT NULL DEFAULT 0,
      can_export INTEGER NOT NULL DEFAULT 0,
      can_admin INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, module_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ent_perms_user ON enterprise_permissions(user_id);

    CREATE TABLE IF NOT EXISTS enterprise_password_reset_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      full_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      note TEXT NOT NULL DEFAULT '',
      resolved_by TEXT NOT NULL DEFAULT '',
      resolved_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_reset_status ON enterprise_password_reset_requests(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS enterprise_login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_username TEXT NOT NULL,
      outcome TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_login_hist_user ON enterprise_login_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ent_login_hist_created ON enterprise_login_history(created_at DESC);

    CREATE TABLE IF NOT EXISTS enterprise_activity_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_act_logs_created ON enterprise_activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ent_act_logs_actor ON enterprise_activity_logs(actor_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS enterprise_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL DEFAULT '',
      actor_username TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      event_type TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      before_json TEXT NOT NULL DEFAULT '',
      after_json TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_audit_logs_created ON enterprise_audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS google_drive_configuration (
      id TEXT PRIMARY KEY,
      auth_mode TEXT NOT NULL DEFAULT 'unconfigured',
      root_folder_id TEXT NOT NULL DEFAULT '',
      root_folder_name TEXT NOT NULL DEFAULT 'VCPL TOOLS - COMPANY DRIVE',
      shared_drive_id TEXT NOT NULL DEFAULT '',
      service_account_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Not Configured',
      last_verified_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT 'system',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS google_drive_folders (
      id TEXT PRIMARY KEY,
      folder_key TEXT NOT NULL UNIQUE,
      folder_name TEXT NOT NULL,
      parent_key TEXT NOT NULL DEFAULT '',
      drive_folder_id TEXT NOT NULL DEFAULT '',
      drive_parent_id TEXT NOT NULL DEFAULT '',
      module_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_documents (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      folder_key TEXT NOT NULL DEFAULT '04_DOCUMENT_VAULT',
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      stored_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'Draft',
      storage_provider TEXT NOT NULL DEFAULT 'google_drive',
      drive_file_id TEXT NOT NULL DEFAULT '',
      drive_folder_id TEXT NOT NULL DEFAULT '',
      drive_web_view_link TEXT NOT NULL DEFAULT '',
      checksum_sha256 TEXT NOT NULL DEFAULT '',
      version_number INTEGER NOT NULL DEFAULT 1,
      tags TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL,
      uploaded_by_username TEXT NOT NULL,
      approved_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_docs_mod ON enterprise_documents(module_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS enterprise_document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      drive_file_id TEXT NOT NULL DEFAULT '',
      drive_web_view_link TEXT NOT NULL DEFAULT '',
      checksum_sha256 TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL,
      uploaded_by_username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_doc_versions_doc ON enterprise_document_versions(document_id, version_number DESC);

    CREATE TABLE IF NOT EXISTS enterprise_workspace_records (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      record_title TEXT NOT NULL,
      reference_code TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      payload_json TEXT NOT NULL DEFAULT '{}',
      is_archived INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_by_username TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_rec_mod ON enterprise_workspace_records(module_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS report_management_records (
      id TEXT PRIMARY KEY,
      report_type TEXT NOT NULL,
      report_title TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'csv',
      module_filter TEXT NOT NULL DEFAULT 'all',
      date_range_label TEXT NOT NULL DEFAULT 'All Time',
      row_count INTEGER NOT NULL DEFAULT 0,
      drive_file_id TEXT NOT NULL DEFAULT '',
      drive_web_view_link TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Generated',
      generated_by TEXT NOT NULL,
      generated_by_username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ent_reports_created ON report_management_records(created_at DESC);

    CREATE TABLE IF NOT EXISTS enterprise_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      description TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT 'system',
      updated_at TEXT NOT NULL
    );


    CREATE VIRTUAL TABLE IF NOT EXISTS india_pincodes_fts USING fts5(
      pincode,
      office_name,
      district,
      state,
      taluk,
      division,
      region,
      circle,
      content='india_pincodes',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS india_ifsc_fts USING fts5(
      ifsc,
      bank_name,
      branch_name,
      city,
      district,
      state,
      address,
      micr,
      bank_code,
      content='india_ifsc',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS india_rto_fts USING fts5(
      code,
      office_name,
      district,
      city,
      state,
      state_code,
      address,
      note,
      content='india_rto',
      content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS india_pincodes_ai AFTER INSERT ON india_pincodes BEGIN
      INSERT INTO india_pincodes_fts(rowid, pincode, office_name, district, state, taluk, division, region, circle)
      VALUES (new.id, new.pincode, new.office_name, new.district, new.state, new.taluk, new.division, new.region, new.circle);
    END;

    CREATE TRIGGER IF NOT EXISTS india_pincodes_ad AFTER DELETE ON india_pincodes BEGIN
      INSERT INTO india_pincodes_fts(india_pincodes_fts, rowid, pincode, office_name, district, state, taluk, division, region, circle)
      VALUES ('delete', old.id, old.pincode, old.office_name, old.district, old.state, old.taluk, old.division, old.region, old.circle);
    END;

    CREATE TRIGGER IF NOT EXISTS india_pincodes_au AFTER UPDATE ON india_pincodes BEGIN
      INSERT INTO india_pincodes_fts(india_pincodes_fts, rowid, pincode, office_name, district, state, taluk, division, region, circle)
      VALUES ('delete', old.id, old.pincode, old.office_name, old.district, old.state, old.taluk, old.division, old.region, old.circle);
      INSERT INTO india_pincodes_fts(rowid, pincode, office_name, district, state, taluk, division, region, circle)
      VALUES (new.id, new.pincode, new.office_name, new.district, new.state, new.taluk, new.division, new.region, new.circle);
    END;

    CREATE TRIGGER IF NOT EXISTS india_ifsc_ai AFTER INSERT ON india_ifsc BEGIN
      INSERT INTO india_ifsc_fts(rowid, ifsc, bank_name, branch_name, city, district, state, address, micr, bank_code)
      VALUES (new.id, new.ifsc, new.bank_name, new.branch_name, new.city, new.district, new.state, new.address, new.micr, new.bank_code);
    END;

    CREATE TRIGGER IF NOT EXISTS india_ifsc_ad AFTER DELETE ON india_ifsc BEGIN
      INSERT INTO india_ifsc_fts(india_ifsc_fts, rowid, ifsc, bank_name, branch_name, city, district, state, address, micr, bank_code)
      VALUES ('delete', old.id, old.ifsc, old.bank_name, old.branch_name, old.city, old.district, old.state, old.address, old.micr, old.bank_code);
    END;

    CREATE TRIGGER IF NOT EXISTS india_ifsc_au AFTER UPDATE ON india_ifsc BEGIN
      INSERT INTO india_ifsc_fts(india_ifsc_fts, rowid, ifsc, bank_name, branch_name, city, district, state, address, micr, bank_code)
      VALUES ('delete', old.id, old.ifsc, old.bank_name, old.branch_name, old.city, old.district, old.state, old.address, old.micr, old.bank_code);
      INSERT INTO india_ifsc_fts(rowid, ifsc, bank_name, branch_name, city, district, state, address, micr, bank_code)
      VALUES (new.id, new.ifsc, new.bank_name, new.branch_name, new.city, new.district, new.state, new.address, new.micr, new.bank_code);
    END;

    CREATE TRIGGER IF NOT EXISTS india_rto_ai AFTER INSERT ON india_rto BEGIN
      INSERT INTO india_rto_fts(rowid, code, office_name, district, city, state, state_code, address, note)
      VALUES (new.id, new.code, new.office_name, new.district, new.city, new.state, new.state_code, new.address, new.note);
    END;

    CREATE TRIGGER IF NOT EXISTS india_rto_ad AFTER DELETE ON india_rto BEGIN
      INSERT INTO india_rto_fts(india_rto_fts, rowid, code, office_name, district, city, state, state_code, address, note)
      VALUES ('delete', old.id, old.code, old.office_name, old.district, old.city, old.state, old.state_code, old.address, old.note);
    END;

    CREATE TRIGGER IF NOT EXISTS india_rto_au AFTER UPDATE ON india_rto BEGIN
      INSERT INTO india_rto_fts(india_rto_fts, rowid, code, office_name, district, city, state, state_code, address, note)
      VALUES ('delete', old.id, old.code, old.office_name, old.district, old.city, old.state, old.state_code, old.address, old.note);
      INSERT INTO india_rto_fts(rowid, code, office_name, district, city, state, state_code, address, note)
      VALUES (new.id, new.code, new.office_name, new.district, new.city, new.state, new.state_code, new.address, new.note);
    END;
  `);

  const addColIfMissing = (table: string, col: string, defSql: string) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
      if (!cols.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${defSql};`);
      }
    } catch {
      // Ignore if table not present
    }
  };

  addColIfMissing('enterprise_users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('enterprise_users', 'locked_until', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_users', 'deleted_at', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'folder_key', "TEXT NOT NULL DEFAULT '04_DOCUMENT_VAULT'");
  addColIfMissing('enterprise_documents', 'storage_provider', "TEXT NOT NULL DEFAULT 'google_drive'");
  addColIfMissing('enterprise_documents', 'drive_folder_id', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'checksum_sha256', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'version_number', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('enterprise_documents', 'tags', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'notes', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('enterprise_documents', 'archived_at', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'deleted_at', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_documents', 'approved_by', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_workspace_records', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
  addColIfMissing('enterprise_workspace_records', 'deleted_at', "TEXT NOT NULL DEFAULT ''");
  addColIfMissing('enterprise_workspace_records', 'updated_by', "TEXT NOT NULL DEFAULT ''");
}

export function normalizeStateDisplay(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const upper = cleaned.toUpperCase();
  const canonical: Record<string, string> = {
    'ANDAMAN AND NICOBAR ISLANDS': 'Andaman and Nicobar Islands',
    'ANDAMAN & NICOBAR ISLANDS': 'Andaman and Nicobar Islands',
    'ANDHRA PRADESH': 'Andhra Pradesh',
    'ARUNACHAL PRADESH': 'Arunachal Pradesh',
    ASSAM: 'Assam',
    BIHAR: 'Bihar',
    CHANDIGARH: 'Chandigarh',
    CHHATTISGARH: 'Chhattisgarh',
    CHATTISGARH: 'Chhattisgarh',
    'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'Dadra and Nagar Haveli and Daman and Diu',
    'DADRA AND NAGAR HAVELI': 'Dadra and Nagar Haveli and Daman and Diu',
    'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'Dadra and Nagar Haveli and Daman and Diu',
    'DAMAN AND DIU': 'Dadra and Nagar Haveli and Daman and Diu',
    DELHI: 'Delhi',
    'NCT OF DELHI': 'Delhi',
    'NEW DELHI': 'Delhi',
    GOA: 'Goa',
    GUJARAT: 'Gujarat',
    HARYANA: 'Haryana',
    'HIMACHAL PRADESH': 'Himachal Pradesh',
    'JAMMU AND KASHMIR': 'Jammu and Kashmir',
    'JAMMU & KASHMIR': 'Jammu and Kashmir',
    JHARKHAND: 'Jharkhand',
    KARNATAKA: 'Karnataka',
    KERALA: 'Kerala',
    LADAKH: 'Ladakh',
    LAKSHADWEEP: 'Lakshadweep',
    'MADHYA PRADESH': 'Madhya Pradesh',
    MAHARASHTRA: 'Maharashtra',
    MANIPUR: 'Manipur',
    MEGHALAYA: 'Meghalaya',
    MIZORAM: 'Mizoram',
    NAGALAND: 'Nagaland',
    ODISHA: 'Odisha',
    ORISSA: 'Odisha',
    PUDUCHERRY: 'Puducherry',
    PONDICHERRY: 'Puducherry',
    PUNJAB: 'Punjab',
    RAJASTHAN: 'Rajasthan',
    SIKKIM: 'Sikkim',
    'TAMIL NADU': 'Tamil Nadu',
    TAMILNADU: 'Tamil Nadu',
    TELANGANA: 'Telangana',
    TRIPURA: 'Tripura',
    'UTTAR PRADESH': 'Uttar Pradesh',
    UTTARAKHAND: 'Uttarakhand',
    UTTARANCHAL: 'Uttarakhand',
    'WEST BENGAL': 'West Bengal',
  };
  if (canonical[upper]) return canonical[upper];
  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeTitleCase(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.toUpperCase() === 'NA' || cleaned.toUpperCase() === 'NULL') return '';
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    return cleaned
      .toLowerCase()
      .replace(/(^|\s|[-/(])([a-z])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);
  }
  return cleaned;
}

export function buildFtsQuery(raw: string): string {
  const tokens = raw
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
}
