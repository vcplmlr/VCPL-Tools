import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
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
