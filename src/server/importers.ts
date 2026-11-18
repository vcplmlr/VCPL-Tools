import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  INDIA_RTO_RECORDS,
} from '../data/rtoDatabase.ts';
import { STATE_UT_BY_CODE } from '../data/statesAndUts.ts';
import {
  RBI_AMALGAMATED_BANKS,
  inferBankCategory,
} from './bankMetadata.ts';
import {
  getDb,
  normalizeStateDisplay,
  normalizeTitleCase,
} from './db.ts';

export interface ImportErrorSample {
  row: number;
  reason: string;
  identifier?: string;
}

export interface ImportSummary {
  dataset: 'pincodes' | 'ifsc' | 'rto';
  sourceLabel: string;
  format: string;
  versionTag: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  duplicateRows: number;
  invalidRows: number;
  missingFieldsRows: number;
  failedRows: number;
  errorSamples: ImportErrorSample[];
  importedAt: string;
}

export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const RTO_CODE_REGEX = /^[A-Z]{2}-\d{2,3}[A-Z]?$/;

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function normalizeOfficeType(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\./g, '');
  if (cleaned === 'HO' || cleaned === 'HEAD OFFICE' || cleaned === 'HEAD POST OFFICE') {
    return 'Head Office (H.O)';
  }
  if (cleaned === 'SO' || cleaned === 'SUB OFFICE' || cleaned === 'SUB POST OFFICE') {
    return 'Sub Office (S.O)';
  }
  if (cleaned === 'BO' || cleaned === 'BRANCH OFFICE' || cleaned === 'BRANCH POST OFFICE') {
    return 'Branch Office (B.O)';
  }
  return raw.trim() || 'Post Office';
}

export function normalizeDeliveryStatus(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (!lower || lower === 'na' || lower === 'null') return 'Unverified';
  if (lower.includes('non')) return 'Non-Delivery';
  if (lower.includes('delivery')) return 'Delivery';
  return raw.trim();
}

function cleanField(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (
    !str ||
    str.toUpperCase() === 'NA' ||
    str.toUpperCase() === 'NULL' ||
    str.toUpperCase() === 'NOT AVAILABLE'
  ) {
    return '';
  }
  return str;
}

function normalizeColKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildNormalizedRowLookup(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeColKey(k);
    if (nk && !map.has(nk)) {
      map.set(nk, v);
    }
  }
  return map;
}

function pickField(
  row: Record<string, unknown>,
  normMap: Map<string, unknown>,
  ...aliases: string[]
): unknown {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
    const nk = normalizeColKey(key);
    const val = normMap.get(nk);
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return '';
}

function normalizeMicr(raw: unknown): string {
  const digits = cleanField(raw).replace(/\D/g, '');
  return digits.length === 9 ? digits : '';
}

function normalizeOfficeLookupKey(pincode: string, officeName: string): string {
  const normName = officeName
    .toLowerCase()
    .replace(/\b(b\.?o|s\.?o|h\.?o)\b/gi, '')
    .replace(/[^a-z0-9]/g, '');
  return `${pincode}|${normName}`;
}

export function buildPostalAddress(fields: {
  officeName: string;
  taluk?: string;
  division?: string;
  district: string;
  state: string;
  pincode: string;
}): string {
  const parts = [
    fields.officeName,
    fields.taluk ? `${fields.taluk} Taluk` : '',
    fields.district,
    fields.state,
  ].filter(Boolean);
  return `${parts.join(', ')} - ${fields.pincode}`;
}

export function recordImportAudit(summary: ImportSummary, importedBy = 'admin'): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO dataset_imports (
      dataset, source_label, format, version_tag,
      total_rows, inserted_rows, updated_rows, duplicate_rows,
      invalid_rows, missing_fields_rows, failed_rows,
      error_samples_json, imported_by, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    summary.dataset,
    summary.sourceLabel,
    summary.format,
    summary.versionTag,
    summary.totalRows,
    summary.insertedRows,
    summary.updatedRows,
    summary.duplicateRows,
    summary.invalidRows,
    summary.missingFieldsRows,
    summary.failedRows,
    JSON.stringify(summary.errorSamples.slice(0, 50)),
    importedBy,
    summary.importedAt
  );
}

export interface PincodeInputRow {
  pincode?: unknown;
  office_name?: unknown;
  officeName?: unknown;
  officename?: unknown;
  OfficeName?: unknown;
  Pincode?: unknown;
  office_type?: unknown;
  officeType?: unknown;
  OfficeType?: unknown;
  delivery_status?: unknown;
  deliveryStatus?: unknown;
  Deliverystatus?: unknown;
  Delivery?: unknown;
  district?: unknown;
  District?: unknown;
  Districtname?: unknown;
  state?: unknown;
  StateName?: unknown;
  statename?: unknown;
  division?: unknown;
  DivisionName?: unknown;
  divisionname?: unknown;
  region?: unknown;
  RegionName?: unknown;
  regionname?: unknown;
  circle?: unknown;
  CircleName?: unknown;
  circlename?: unknown;
  taluk?: unknown;
  Taluk?: unknown;
  postal_address?: unknown;
  address?: unknown;
  contact?: unknown;
  Telephone?: unknown;
  latitude?: unknown;
  Latitude?: unknown;
  longitude?: unknown;
  Longitude?: unknown;
  verification_status?: unknown;
  source?: unknown;
  source_record_id?: unknown;
  last_verified_at?: unknown;
}

export function importPincodeRowsBatch(
  rows: PincodeInputRow[],
  options: {
    sourceLabel: string;
    format: 'csv' | 'xlsx' | 'json' | 'official_sync';
    versionTag?: string;
    importedBy?: string;
    skipAudit?: boolean;
  }
): ImportSummary {
  const db = getDb();
  const now = new Date().toISOString();
  const summary: ImportSummary = {
    dataset: 'pincodes',
    sourceLabel: options.sourceLabel,
    format: options.format,
    versionTag: options.versionTag || now.slice(0, 10),
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    missingFieldsRows: 0,
    failedRows: 0,
    errorSamples: [],
    importedAt: now,
  };

  const seenInBatch = new Set<string>();
  const existsStmt = db.prepare(
    'SELECT id FROM india_pincodes WHERE pincode = ? AND office_name = ? AND district = ? LIMIT 1'
  );
  const upsertStmt = db.prepare(`
    INSERT INTO india_pincodes (
      pincode, office_name, office_type, delivery_status,
      district, state, division, region, circle, taluk,
      postal_address, contact, latitude, longitude,
      verification_status, source, source_record_id,
      last_verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pincode, office_name, district) DO UPDATE SET
      office_type = excluded.office_type,
      delivery_status = excluded.delivery_status,
      state = excluded.state,
      division = CASE WHEN excluded.division != '' THEN excluded.division ELSE india_pincodes.division END,
      region = CASE WHEN excluded.region != '' THEN excluded.region ELSE india_pincodes.region END,
      circle = CASE WHEN excluded.circle != '' THEN excluded.circle ELSE india_pincodes.circle END,
      taluk = CASE WHEN excluded.taluk != '' THEN excluded.taluk ELSE india_pincodes.taluk END,
      postal_address = excluded.postal_address,
      contact = CASE WHEN excluded.contact != '' THEN excluded.contact ELSE india_pincodes.contact END,
      latitude = COALESCE(excluded.latitude, india_pincodes.latitude),
      longitude = COALESCE(excluded.longitude, india_pincodes.longitude),
      verification_status = excluded.verification_status,
      source = excluded.source,
      source_record_id = excluded.source_record_id,
      last_verified_at = excluded.last_verified_at,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN');
  try {
    for (let idx = 0; idx < rows.length; idx += 1) {
      const r = rows[idx] as Record<string, unknown>;
      const norm = buildNormalizedRowLookup(r);
      const pincode = cleanField(
        pickField(r, norm, 'pincode', 'Pincode', 'PIN Code', 'pin_code', 'pin')
      ).replace(/\D/g, '');
      const officeName = cleanField(
        pickField(
          r,
          norm,
          'office_name',
          'officeName',
          'officename',
          'OfficeName',
          'Post Office Name',
          'post_office_name',
          'Post Office'
        )
      );
      const rawDistrict = cleanField(
        pickField(r, norm, 'district', 'District', 'Districtname', 'district_name')
      );
      const rawState = cleanField(
        pickField(r, norm, 'state', 'StateName', 'statename', 'State', 'state_name')
      );

      if (
        !PINCODE_REGEX.test(pincode) ||
        pincode === '999999' ||
        /^test(\s+office|\s+po)?$/i.test(officeName)
      ) {
        summary.invalidRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          summary.errorSamples.push({
            row: idx + 1,
            reason: `Invalid or placeholder 6-digit Indian PIN code / test office ("${pincode || 'empty'}")`,
            identifier: officeName || pincode,
          });
        }
        continue;
      }

      if (!officeName || !rawDistrict || !rawState) {
        summary.missingFieldsRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          summary.errorSamples.push({
            row: idx + 1,
            reason: 'Missing required office_name, district, or state',
            identifier: pincode,
          });
        }
        continue;
      }

      const district = normalizeTitleCase(rawDistrict);
      const state = normalizeStateDisplay(rawState);
      const batchKey = `${pincode}|${officeName.toLowerCase()}|${district.toLowerCase()}`;
      if (seenInBatch.has(batchKey)) {
        summary.duplicateRows += 1;
        continue;
      }
      seenInBatch.add(batchKey);

      const officeType = normalizeOfficeType(
        cleanField(pickField(r, norm, 'office_type', 'officeType', 'OfficeType', 'Office Type'))
      );
      const deliveryStatus = normalizeDeliveryStatus(
        cleanField(
          pickField(
            r,
            norm,
            'delivery_status',
            'deliveryStatus',
            'Deliverystatus',
            'Delivery',
            'Delivery Status'
          )
        )
      );
      const division = normalizeTitleCase(
        cleanField(pickField(r, norm, 'division', 'DivisionName', 'divisionname', 'Division'))
      );
      const region = normalizeTitleCase(
        cleanField(pickField(r, norm, 'region', 'RegionName', 'regionname', 'Region'))
      );
      const circle = normalizeTitleCase(
        cleanField(pickField(r, norm, 'circle', 'CircleName', 'circlename', 'Circle'))
      );
      const taluk = normalizeTitleCase(
        cleanField(
          pickField(r, norm, 'taluk', 'Taluk', 'Taluk / Sub-District', 'sub_district', 'block')
        )
      );
      const contact = cleanField(pickField(r, norm, 'contact', 'Telephone', 'Contact', 'phone'));
      const latNum = Number(cleanField(pickField(r, norm, 'latitude', 'Latitude')));
      const lonNum = Number(cleanField(pickField(r, norm, 'longitude', 'Longitude')));
      const latitude =
        Number.isFinite(latNum) && latNum >= -90 && latNum <= 90 && latNum !== 0 ? latNum : null;
      const longitude =
        Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180 && lonNum !== 0 ? lonNum : null;
      const postalAddress =
        cleanField(pickField(r, norm, 'postal_address', 'Postal Address', 'address', 'Address')) ||
        buildPostalAddress({ officeName, taluk, division, district, state, pincode });
      const verificationStatus = cleanField(pickField(r, norm, 'verification_status')) || 'verified';
      const source = cleanField(pickField(r, norm, 'source', 'Source')) || options.sourceLabel;
      const sourceRecordId = cleanField(pickField(r, norm, 'source_record_id')) || `${pincode}-${idx + 1}`;
      const lastVerifiedAt =
        cleanField(pickField(r, norm, 'last_verified_at', 'Last Verified')) || now.slice(0, 10);

      const existing = existsStmt.get(pincode, officeName, district);
      upsertStmt.run(
        pincode,
        officeName,
        officeType,
        deliveryStatus,
        district,
        state,
        division,
        region,
        circle,
        taluk,
        postalAddress,
        contact,
        latitude,
        longitude,
        verificationStatus,
        source,
        sourceRecordId,
        lastVerifiedAt,
        now,
        now
      );

      if (existing) {
        summary.updatedRows += 1;
      } else {
        summary.insertedRows += 1;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (!options.skipAudit) {
    recordImportAudit(summary, options.importedBy || 'admin');
  }
  return summary;
}

export interface IfscInputRow {
  ifsc?: unknown;
  IFSC?: unknown;
  bank_name?: unknown;
  bankName?: unknown;
  BANK?: unknown;
  branch_name?: unknown;
  branchName?: unknown;
  BRANCH?: unknown;
  address?: unknown;
  ADDRESS?: unknown;
  state?: unknown;
  STATE?: unknown;
  district?: unknown;
  DISTRICT?: unknown;
  city?: unknown;
  CITY?: unknown;
  CENTRE?: unknown;
  micr?: unknown;
  MICR?: unknown;
  bank_code?: unknown;
  bankCode?: unknown;
  branch_code?: unknown;
  branchCode?: unknown;
  bank_category?: unknown;
  bankCategory?: unknown;
  bank_status?: unknown;
  bankStatus?: unknown;
  successor_bank?: unknown;
  successorBank?: unknown;
  successor_ifsc_prefix?: unknown;
  successorIfscPrefix?: unknown;
  upi?: unknown;
  UPI?: unknown;
  rtgs?: unknown;
  RTGS?: unknown;
  neft?: unknown;
  NEFT?: unknown;
  imps?: unknown;
  IMPS?: unknown;
  swift?: unknown;
  SWIFT?: unknown;
  contact?: unknown;
  CONTACT?: unknown;
  verification_status?: unknown;
  source?: unknown;
  source_record_id?: unknown;
  last_verified_at?: unknown;
}

function toBoolInt(val: unknown): number {
  if (val === true || val === 1) return 1;
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' ? 1 : 0;
}

export function importIfscRowsBatch(
  rows: IfscInputRow[],
  options: {
    sourceLabel: string;
    format: 'csv' | 'xlsx' | 'json' | 'official_sync';
    versionTag?: string;
    importedBy?: string;
    banksMeta?: Record<string, { type?: string }>;
    subletMap?: Record<string, string>;
    skipAudit?: boolean;
  }
): ImportSummary {
  const db = getDb();
  const now = new Date().toISOString();
  const summary: ImportSummary = {
    dataset: 'ifsc',
    sourceLabel: options.sourceLabel,
    format: options.format,
    versionTag: options.versionTag || now.slice(0, 10),
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    missingFieldsRows: 0,
    failedRows: 0,
    errorSamples: [],
    importedAt: now,
  };

  const seenInBatch = new Set<string>();
  const existsStmt = db.prepare(
    'SELECT id, upi, rtgs, neft, imps FROM india_ifsc WHERE ifsc = ? LIMIT 1'
  );
  const upsertStmt = db.prepare(`
    INSERT INTO india_ifsc (
      ifsc, bank_name, branch_name, address, state, district, city, micr,
      bank_code, branch_code, bank_category, bank_status,
      successor_bank, successor_ifsc_prefix,
      upi, rtgs, neft, imps, swift, contact,
      verification_status, source, source_record_id,
      last_verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ifsc) DO UPDATE SET
      bank_name = excluded.bank_name,
      branch_name = excluded.branch_name,
      address = CASE WHEN excluded.address != '' THEN excluded.address ELSE india_ifsc.address END,
      state = CASE WHEN excluded.state != '' THEN excluded.state ELSE india_ifsc.state END,
      district = CASE WHEN excluded.district != '' THEN excluded.district ELSE india_ifsc.district END,
      city = CASE WHEN excluded.city != '' THEN excluded.city ELSE india_ifsc.city END,
      micr = CASE WHEN excluded.micr != '' THEN excluded.micr ELSE india_ifsc.micr END,
      bank_code = excluded.bank_code,
      branch_code = excluded.branch_code,
      bank_category = CASE WHEN excluded.bank_category != '' THEN excluded.bank_category ELSE india_ifsc.bank_category END,
      bank_status = excluded.bank_status,
      successor_bank = CASE WHEN excluded.successor_bank != '' THEN excluded.successor_bank ELSE india_ifsc.successor_bank END,
      successor_ifsc_prefix = CASE WHEN excluded.successor_ifsc_prefix != '' THEN excluded.successor_ifsc_prefix ELSE india_ifsc.successor_ifsc_prefix END,
      upi = excluded.upi,
      rtgs = excluded.rtgs,
      neft = excluded.neft,
      imps = excluded.imps,
      swift = CASE WHEN excluded.swift != '' THEN excluded.swift ELSE india_ifsc.swift END,
      contact = CASE WHEN excluded.contact != '' THEN excluded.contact ELSE india_ifsc.contact END,
      verification_status = excluded.verification_status,
      source = excluded.source,
      source_record_id = excluded.source_record_id,
      last_verified_at = excluded.last_verified_at,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN');
  try {
    for (let idx = 0; idx < rows.length; idx += 1) {
      const r = rows[idx] as Record<string, unknown>;
      const norm = buildNormalizedRowLookup(r);
      const ifsc = cleanField(pickField(r, norm, 'ifsc', 'IFSC', 'IFSC Code', 'ifsc_code'))
        .toUpperCase()
        .replace(/\s+/g, '');
      const bankName = cleanField(
        pickField(r, norm, 'bank_name', 'bankName', 'BANK', 'Bank Name', 'Bank')
      );
      const branchName = cleanField(
        pickField(r, norm, 'branch_name', 'branchName', 'BRANCH', 'Branch Name', 'Branch')
      );

      if (!IFSC_REGEX.test(ifsc)) {
        summary.invalidRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          summary.errorSamples.push({
            row: idx + 1,
            reason: `Invalid 11-char IFSC "${ifsc || '(empty)'}"`,
            identifier: bankName || undefined,
          });
        }
        continue;
      }

      if (!bankName || !branchName) {
        summary.missingFieldsRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          summary.errorSamples.push({
            row: idx + 1,
            reason: 'Missing required bank_name or branch_name',
            identifier: ifsc,
          });
        }
        continue;
      }

      if (seenInBatch.has(ifsc)) {
        summary.duplicateRows += 1;
        continue;
      }
      seenInBatch.add(ifsc);

      const bankCode =
        cleanField(pickField(r, norm, 'bank_code', 'bankCode', 'Bank Code')).toUpperCase() ||
        ifsc.slice(0, 4);
      const branchCode =
        cleanField(pickField(r, norm, 'branch_code', 'branchCode', 'Branch Code')).toUpperCase() ||
        ifsc.slice(5);
      const address = cleanField(
        pickField(r, norm, 'address', 'ADDRESS', 'Branch Address', 'branch_address')
      );
      const state = normalizeStateDisplay(cleanField(pickField(r, norm, 'state', 'STATE', 'State')));
      const district = normalizeTitleCase(
        cleanField(pickField(r, norm, 'district', 'DISTRICT', 'District'))
      );
      const city = normalizeTitleCase(
        cleanField(pickField(r, norm, 'city', 'CITY', 'CENTRE', 'City', 'Centre'))
      );
      const micr = normalizeMicr(pickField(r, norm, 'micr', 'MICR', 'MICR Code', 'micr_code'));

      const subletTarget = options.subletMap?.[ifsc];
      const bankMetaType =
        options.banksMeta?.[subletTarget || bankCode]?.type || options.banksMeta?.[bankCode]?.type;
      const bankCategory =
        cleanField(pickField(r, norm, 'bank_category', 'bankCategory', 'Bank Category')) ||
        inferBankCategory(subletTarget || bankCode, bankName, bankMetaType);

      const mergerInfo = RBI_AMALGAMATED_BANKS[bankCode];
      const rawStatus = cleanField(
        pickField(r, norm, 'bank_status', 'bankStatus', 'Bank Status', 'status')
      );
      const bankStatus = rawStatus || (mergerInfo ? 'Merged' : 'Active');
      const successorBank =
        cleanField(pickField(r, norm, 'successor_bank', 'successorBank', 'Successor Bank')) ||
        mergerInfo?.successorBankName ||
        '';
      const successorIfscPrefix =
        cleanField(
          pickField(r, norm, 'successor_ifsc_prefix', 'successorIfscPrefix', 'Successor IFSC Prefix')
        ) ||
        mergerInfo?.successorPrefix ||
        '';

      const existing = existsStmt.get(ifsc) as
        | { id: number; upi: number; rtgs: number; neft: number; imps: number }
        | undefined;

      const rawUpi = pickField(r, norm, 'upi', 'UPI');
      const rawRtgs = pickField(r, norm, 'rtgs', 'RTGS');
      const rawNeft = pickField(r, norm, 'neft', 'NEFT');
      const rawImps = pickField(r, norm, 'imps', 'IMPS');

      const upi = rawUpi !== '' ? toBoolInt(rawUpi) : existing ? Number(existing.upi) : 0;
      const rtgs = rawRtgs !== '' ? toBoolInt(rawRtgs) : existing ? Number(existing.rtgs) : 0;
      const neft = rawNeft !== '' ? toBoolInt(rawNeft) : existing ? Number(existing.neft) : 0;
      const imps = rawImps !== '' ? toBoolInt(rawImps) : existing ? Number(existing.imps) : 0;
      const swift = cleanField(pickField(r, norm, 'swift', 'SWIFT'));
      const contact = cleanField(pickField(r, norm, 'contact', 'CONTACT', 'Contact', 'phone'));
      const verificationStatus =
        cleanField(pickField(r, norm, 'verification_status')) || 'verified';
      const source = cleanField(pickField(r, norm, 'source', 'Source')) || options.sourceLabel;
      const sourceRecordId = cleanField(pickField(r, norm, 'source_record_id')) || ifsc;
      const lastVerifiedAt =
        cleanField(pickField(r, norm, 'last_verified_at', 'Last Verified')) || now.slice(0, 10);

      upsertStmt.run(
        ifsc,
        bankName,
        branchName,
        address,
        state,
        district,
        city,
        micr,
        bankCode,
        branchCode,
        bankCategory,
        bankStatus,
        successorBank,
        successorIfscPrefix,
        upi,
        rtgs,
        neft,
        imps,
        swift,
        contact,
        verificationStatus,
        source,
        sourceRecordId,
        lastVerifiedAt,
        now,
        now
      );

      if (existing) {
        summary.updatedRows += 1;
      } else {
        summary.insertedRows += 1;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (!options.skipAudit) {
    recordImportAudit(summary, options.importedBy || 'admin');
  }
  return summary;
}

export function parseUploadPayloadToRows(
  format: 'csv' | 'xlsx' | 'json',
  payloadTextOrBase64: string
): Record<string, unknown>[] {
  if (format === 'json') {
    const parsed = JSON.parse(payloadTextOrBase64);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    throw new Error('JSON import must be an array of records or { rows: [...] }.');
  }

  if (format === 'xlsx') {
    const cleanB64 = payloadTextOrBase64.includes(',')
      ? payloadTextOrBase64.split(',').pop() || ''
      : payloadTextOrBase64;
    const buffer = Buffer.from(cleanB64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet], {
      defval: '',
    });
  }

  // CSV
  const lines = payloadTextOrBase64.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const out: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j += 1) {
      obj[headers[j]] = cols[j] ?? '';
    }
    out.push(obj);
  }
  return out;
}

async function downloadTextOrCache(url: string, cacheFileName: string): Promise<string> {
  const cacheDir = path.resolve(process.cwd(), '.cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, cacheFileName);

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 1024) {
    return fs.readFileSync(cachePath, 'utf8');
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'VCPL-Tools-DataSync/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  fs.writeFileSync(cachePath, text, 'utf8');
  return text;
}

export async function syncOfficialPincodesDataset(importedBy = 'system-seed'): Promise<ImportSummary> {
  const primaryCsv = await downloadTextOrCache(
    'https://raw.githubusercontent.com/dropdevrahul/pincodes-india/main/pincode.csv',
    'india_post_primary.csv'
  );

  // Optional enrichment map for Taluk & Telephone from Department of Posts Open Directory CSV
  const enrichmentMap = new Map<string, { taluk: string; telephone: string }>();
  try {
    const enrichCsv = await downloadTextOrCache(
      'https://raw.githubusercontent.com/saravanakumargn/All-India-Pincode-Directory/master/all-india-pincode-html-csv.csv',
      'india_post_taluk_enrich.csv'
    );
    const enrichLines = enrichCsv.split(/\r?\n/);
    if (enrichLines.length > 1) {
      const eh = parseCsvLine(enrichLines[0]).map((x) => x.trim().toLowerCase());
      const idxOffice = eh.indexOf('officename');
      const idxPin = eh.indexOf('pincode');
      const idxTaluk = eh.indexOf('taluk');
      const idxTel = eh.indexOf('telephone');
      for (let i = 1; i < enrichLines.length; i += 1) {
        if (!enrichLines[i]) continue;
        const cols = parseCsvLine(enrichLines[i]);
        const pin = (cols[idxPin] || '').trim();
        const office = (cols[idxOffice] || '').trim();
        const taluk = cleanField(cols[idxTaluk]);
        const telephone = cleanField(cols[idxTel]);
        if (pin && office && (taluk || telephone)) {
          enrichmentMap.set(normalizeOfficeLookupKey(pin, office), { taluk, telephone });
        }
      }
    }
  } catch {
    // Supplementary enrichment is optional; primary CSV still completes cleanly
  }

  const lines = primaryCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: PincodeInputRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      rec[headers[j]] = cols[j] ?? '';
    }
    const pin = (rec.Pincode || '').trim();
    const office = (rec.OfficeName || '').trim();
    const extra = enrichmentMap.get(normalizeOfficeLookupKey(pin, office));
    if (extra) {
      rec.Taluk = extra.taluk;
      rec.Telephone = extra.telephone;
    }
    rec.source = 'India Post / data.gov.in Open Directory';
    rec.last_verified_at = '2026-11-17';
    rows.push(rec);
  }

  const chunkSize = 10000;
  const aggregate: ImportSummary = {
    dataset: 'pincodes',
    sourceLabel: 'India Post / data.gov.in Open Directory',
    format: 'official_sync',
    versionTag: 'data.gov.in-india-post',
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    missingFieldsRows: 0,
    failedRows: 0,
    errorSamples: [],
    importedAt: new Date().toISOString(),
  };

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const res = importPincodeRowsBatch(chunk, {
      sourceLabel: aggregate.sourceLabel,
      format: 'official_sync',
      versionTag: aggregate.versionTag,
      importedBy,
      skipAudit: true,
    });
    aggregate.insertedRows += res.insertedRows;
    aggregate.updatedRows += res.updatedRows;
    aggregate.duplicateRows += res.duplicateRows;
    aggregate.invalidRows += res.invalidRows;
    aggregate.missingFieldsRows += res.missingFieldsRows;
    aggregate.failedRows += res.failedRows;
    if (aggregate.errorSamples.length < 50) {
      aggregate.errorSamples.push(...res.errorSamples.slice(0, 50 - aggregate.errorSamples.length));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  recordImportAudit(aggregate, importedBy);
  return aggregate;
}

export async function syncOfficialRazorpayIfscDataset(
  importedBy = 'system-seed'
): Promise<ImportSummary> {
  const releaseRes = await fetch('https://api.github.com/repos/razorpay/ifsc/releases/latest', {
    headers: { 'User-Agent': 'VCPL-Tools-DataSync/1.0' },
  });
  let tag = 'v2.0.62';
  let verifiedDate = '2026-09-01';
  if (releaseRes.ok) {
    const meta = (await releaseRes.json()) as { tag_name?: string; published_at?: string };
    if (meta.tag_name) tag = meta.tag_name;
    if (meta.published_at) verifiedDate = meta.published_at.slice(0, 10);
  }

  const baseUrl = `https://github.com/razorpay/ifsc/releases/download/${tag}`;
  const [csvText, banksText, subletText] = await Promise.all([
    downloadTextOrCache(`${baseUrl}/IFSC.csv`, `razorpay_ifsc_${tag}.csv`),
    downloadTextOrCache(`${baseUrl}/banks.json`, `razorpay_banks_${tag}.json`),
    downloadTextOrCache(`${baseUrl}/sublet.json`, `razorpay_sublet_${tag}.json`),
  ]);

  const banksMeta = JSON.parse(banksText) as Record<string, { type?: string }>;
  const subletMap = JSON.parse(subletText) as Record<string, string>;

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  const aggregate: ImportSummary = {
    dataset: 'ifsc',
    sourceLabel: `Razorpay IFSC ${tag} (RBI/NPCI)`,
    format: 'official_sync',
    versionTag: tag,
    totalRows: lines.length - 1,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    missingFieldsRows: 0,
    failedRows: 0,
    errorSamples: [],
    importedAt: new Date().toISOString(),
  };

  const chunkSize = 10000;
  for (let start = 1; start < lines.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunk: IfscInputRow[] = [];
    for (let i = start; i < end; i += 1) {
      const cols = parseCsvLine(lines[i]);
      const rec: Record<string, string> = {};
      for (let j = 0; j < headers.length; j += 1) {
        rec[headers[j]] = cols[j] ?? '';
      }
      rec.bank_status = 'Active';
      rec.source = aggregate.sourceLabel;
      rec.last_verified_at = verifiedDate;
      chunk.push(rec);
    }

    const res = importIfscRowsBatch(chunk, {
      sourceLabel: aggregate.sourceLabel,
      format: 'official_sync',
      versionTag: tag,
      importedBy,
      banksMeta,
      subletMap,
      skipAudit: true,
    });
    aggregate.insertedRows += res.insertedRows;
    aggregate.updatedRows += res.updatedRows;
    aggregate.duplicateRows += res.duplicateRows;
    aggregate.invalidRows += res.invalidRows;
    aggregate.missingFieldsRows += res.missingFieldsRows;
    aggregate.failedRows += res.failedRows;
    if (aggregate.errorSamples.length < 50) {
      aggregate.errorSamples.push(...res.errorSamples.slice(0, 50 - aggregate.errorSamples.length));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  recordImportAudit(aggregate, importedBy);
  return aggregate;
}

export interface RtoInputRow {
  code?: unknown;
  rto_code?: unknown;
  rtoCode?: unknown;
  state?: unknown;
  state_code?: unknown;
  stateCode?: unknown;
  office_name?: unknown;
  officeName?: unknown;
  district?: unknown;
  city?: unknown;
  address?: unknown;
  phone?: unknown;
  email?: unknown;
  rto_type?: unknown;
  rtoType?: unknown;
  status?: unknown;
  verification_status?: unknown;
  verificationStatus?: unknown;
  note?: unknown;
  source?: unknown;
  last_verified_at?: unknown;
  lastVerified?: unknown;
}

export function normalizeRtoCodeForImport(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^([A-Z]{2})0*(\d{1,3})([A-Z]?)$/);
  if (!match) return '';
  const statePart = match[1];
  const digits = match[2].padStart(2, '0');
  const suffix = match[3] || '';
  return `${statePart}-${digits}${suffix}`;
}

function inferRtoType(officeName: string, explicitType: string): string {
  if (explicitType) return explicitType.toUpperCase();
  const upper = officeName.toUpperCase();
  if (/\bARTO\b/.test(upper)) return 'ARTO';
  if (/\bDTO\b/.test(upper)) return 'DTO';
  if (/\bRLA\b/.test(upper)) return 'RLA';
  if (/\bRTA\b/.test(upper)) return 'RTA';
  if (/\bSDM\b/.test(upper)) return 'SDM';
  if (/\bSTA\b/.test(upper)) return 'STA';
  return 'RTO';
}

export function importRtoRowsBatch(
  rows: RtoInputRow[],
  options: {
    sourceLabel: string;
    format: 'csv' | 'xlsx' | 'json' | 'official_sync';
    versionTag?: string;
    importedBy?: string;
    skipAudit?: boolean;
  }
): ImportSummary {
  const db = getDb();
  const now = new Date().toISOString();
  const summary: ImportSummary = {
    dataset: 'rto',
    sourceLabel: options.sourceLabel,
    format: options.format,
    versionTag: options.versionTag || now.slice(0, 10),
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    missingFieldsRows: 0,
    failedRows: 0,
    errorSamples: [],
    importedAt: now,
  };

  const seenInBatch = new Set<string>();
  const existsStmt = db.prepare('SELECT id, office_name FROM india_rto WHERE code = ? LIMIT 1');
  const upsertStmt = db.prepare(`
    INSERT INTO india_rto (
      code, state, state_code, office_name, district, city,
      address, phone, email, rto_type, status, verification_status,
      note, source, source_record_id, last_verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      state = excluded.state,
      state_code = excluded.state_code,
      office_name = excluded.office_name,
      district = CASE WHEN excluded.district != '' THEN excluded.district ELSE india_rto.district END,
      city = CASE WHEN excluded.city != '' THEN excluded.city ELSE india_rto.city END,
      address = CASE WHEN excluded.address != '' THEN excluded.address ELSE india_rto.address END,
      phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE india_rto.phone END,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE india_rto.email END,
      rto_type = CASE WHEN excluded.rto_type != '' THEN excluded.rto_type ELSE india_rto.rto_type END,
      status = excluded.status,
      verification_status = excluded.verification_status,
      note = CASE WHEN excluded.note != '' THEN excluded.note ELSE india_rto.note END,
      source = excluded.source,
      source_record_id = excluded.source_record_id,
      last_verified_at = excluded.last_verified_at,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN');
  try {
    for (let idx = 0; idx < rows.length; idx += 1) {
      const r = rows[idx] as Record<string, unknown>;
      const norm = buildNormalizedRowLookup(r);

      const rawCode = cleanField(
        pickField(
          r,
          norm,
          'code',
          'rto_code',
          'rtoCode',
          'RTO Code',
          'rto',
          'reg_code',
          'registration_code',
          'vehicle_code',
          'prefix'
        )
      );
      const code = normalizeRtoCodeForImport(rawCode);

      if (!code || !RTO_CODE_REGEX.test(code)) {
        summary.invalidRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          summary.errorSamples.push({
            row: idx + 1,
            reason: `Invalid Indian RTO code ("${rawCode || 'empty'}") — expected format like KA-19 or KA19`,
            identifier: rawCode || undefined,
          });
        }
        continue;
      }

      const rawStateCode = cleanField(
        pickField(r, norm, 'state_code', 'stateCode', 'State Code')
      ).toUpperCase();
      const stateCode = /^[A-Z]{2}$/.test(rawStateCode) ? rawStateCode : code.slice(0, 2);

      const officeName = cleanField(
        pickField(
          r,
          norm,
          'office_name',
          'officeName',
          'RTO Office Name',
          'RTO Office',
          'office',
          'rto_name',
          'authority',
          'registering_authority',
          'name',
          'place'
        )
      );
      const rawState = cleanField(
        pickField(r, norm, 'state', 'State', 'state_name', 'stateName', 'State / UT', 'state_ut')
      );
      const resolvedState = rawState
        ? normalizeStateDisplay(rawState)
        : STATE_UT_BY_CODE[stateCode]?.state || '';

      const rawCity = cleanField(
        pickField(r, norm, 'city', 'City', 'City / Town', 'town', 'location', 'hq')
      );
      const rawDistrict = cleanField(
        pickField(r, norm, 'district', 'District', 'district_name', 'District Name')
      );
      const district = normalizeTitleCase(rawDistrict || rawCity);
      const city = normalizeTitleCase(rawCity || rawDistrict);
      const note = cleanField(pickField(r, norm, 'note', 'Note', 'notes', 'remarks', 'description'));

      const existing = existsStmt.get(code) as { id: number; office_name: string } | undefined;
      const finalOfficeName =
        officeName || (city ? `${city} RTO` : existing?.office_name || note || '');

      if (!finalOfficeName || !resolvedState) {
        summary.missingFieldsRows += 1;
        summary.failedRows += 1;
        if (summary.errorSamples.length < 50) {
          const missingReason = !resolvedState
            ? 'Missing or unrecognized state / state_code'
            : 'Blank office_name, city, and district in CSV row (unassigned / empty row)';
          summary.errorSamples.push({
            row: idx + 1,
            reason: missingReason,
            identifier: code,
          });
        }
        continue;
      }

      if (seenInBatch.has(code)) {
        summary.duplicateRows += 1;
        continue;
      }
      seenInBatch.add(code);

      const address = cleanField(
        pickField(r, norm, 'address', 'Address', 'office_address', 'RTO Address', 'postal_address')
      );
      const phone = cleanField(
        pickField(r, norm, 'phone', 'Phone', 'contact', 'Contact', 'telephone', 'helpline')
      );
      const email = cleanField(pickField(r, norm, 'email', 'Email', 'email_id'));
      const explicitType = cleanField(
        pickField(r, norm, 'rto_type', 'rtoType', 'type', 'office_type', 'authority_type')
      );
      const rtoType = inferRtoType(finalOfficeName, explicitType);

      const rawStatus = cleanField(pickField(r, norm, 'status', 'Status', 'series_status')).toLowerCase();
      const status =
        rawStatus === 'historical' || rawStatus === 'inactive' || rawStatus === 'legacy' || rawStatus === 'old'
          ? 'historical'
          : 'active';

      const verificationRaw = cleanField(
        pickField(r, norm, 'verification_status', 'verificationStatus')
      ).toLowerCase();
      const verificationStatus = verificationRaw === 'unverified' ? 'unverified' : 'verified';

      const source = cleanField(pickField(r, norm, 'source', 'Source')) || options.sourceLabel;
      const sourceRecordId = cleanField(pickField(r, norm, 'source_record_id')) || code;
      const lastVerifiedAt =
        cleanField(pickField(r, norm, 'last_verified_at', 'lastVerified', 'last_verified', 'Last Verified')) ||
        now.slice(0, 10);

      upsertStmt.run(
        code,
        resolvedState,
        stateCode,
        finalOfficeName,
        district,
        city,
        address,
        phone,
        email,
        rtoType,
        status,
        verificationStatus,
        note,
        source,
        sourceRecordId,
        lastVerifiedAt,
        now,
        now
      );

      if (existing) {
        summary.updatedRows += 1;
      } else {
        summary.insertedRows += 1;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (!options.skipAudit) {
    recordImportAudit(summary, options.importedBy || 'admin');
  }
  return summary;
}

export function syncBaselineRtoDataset(importedBy = 'system-seed'): ImportSummary {
  const rows: RtoInputRow[] = INDIA_RTO_RECORDS.map((rec) => ({
    code: rec.code,
    state: rec.state,
    state_code: rec.stateCode,
    office_name: rec.officeName,
    district: rec.district,
    city: rec.city,
    address: rec.address,
    status: rec.status,
    verification_status: rec.verificationStatus,
    note: rec.note || '',
    source: rec.source,
    last_verified_at: rec.lastVerified,
  }));

  return importRtoRowsBatch(rows, {
    sourceLabel: 'Parivahan Sewa / State Transport Built-in Registry',
    format: 'official_sync',
    versionTag: 'vcpl-baseline-rto',
    importedBy,
  });
}

export function seedRtoIfEmpty(): void {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM india_rto').get() as { c: number };
  if (Number(row?.c || 0) === 0) {
    syncBaselineRtoDataset('system-seed');
  }
}
