import crypto from 'node:crypto';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import { RBI_AMALGAMATED_BANKS } from './bankMetadata.ts';
import { buildFtsQuery, getDb } from './db.ts';
import {
  IFSC_REGEX,
  PINCODE_REGEX,
  importIfscRowsBatch,
  importPincodeRowsBatch,
  importRtoRowsBatch,
  parseUploadPayloadToRows,
  recordImportAudit,
  syncBaselineRtoDataset,
  syncOfficialPincodesDataset,
  syncOfficialRazorpayIfscDataset,
} from './importers.ts';

const BANK_SHORT_ALIAS_TO_CODE: Record<string, string> = {
  SBI: 'SBIN',
  PNB: 'PUNB',
  BOB: 'BARB',
  CNB: 'CNRB',
  UBI: 'UBIN',
  BOI: 'BKID',
  INDB: 'IDIB',
  CBI: 'CBIN',
  IOB: 'IOBA',
  UCO: 'UCBA',
  BOM: 'MAHB',
  PSB: 'PSIB',
  ICICI: 'ICIC',
  AXIS: 'UTIB',
  KOTAK: 'KKBK',
  YES: 'YESB',
  IDFC: 'IDFB',
  FED: 'FDRL',
  RBL: 'RATN',
  KBL: 'KARB',
  SIB: 'SIBL',
  KVB: 'KVBL',
  CUB: 'CIUB',
  TMB: 'TMBL',
  JKB: 'JAKA',
  IPPB: 'IPOS',
};

function createRateLimiter(maxRequests: number, windowMs: number) {
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      'unknown';

    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before sending more requests.',
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      });
      return;
    }
    next();
  };
}

function getAdminPasscode(): string {
  return process.env.VCPL_ADMIN_PASSCODE?.trim() || '202627';
}

function getAdminSigningKey(): string {
  return process.env.VCPL_ADMIN_SECRET?.trim() || `vcpl-admin-key:${getAdminPasscode()}`;
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signAdminToken(): string {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAdminSigningKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getAdminSigningKey())
    .update(payload)
    .digest('base64url');
  if (!safeEqualStrings(sig, expectedSig)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && Date.now() < parsed.exp;
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: 'Admin authorization required or session expired.' });
    return;
  }
  next();
}

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function validateIfscStructure(raw: string): {
  attempted: boolean;
  input: string;
  formatValid: boolean;
  errors: string[];
  bankCode: string;
  fifthChar: string;
  branchCode: string;
} {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) {
    return {
      attempted: false,
      input: '',
      formatValid: false,
      errors: [],
      bankCode: '',
      fifthChar: '',
      branchCode: '',
    };
  }

  // Detect if query looks like an attempted IFSC code rather than a 9-digit MICR, city, or bank name
  const isMicr = /^\d{9}$/.test(cleaned);
  const looksLikeIfscAttempt =
    !isMicr &&
    ((cleaned.length === 11 && /^[A-Z]{2,4}[A-Z0-9]{7,9}$/.test(cleaned)) ||
      (/^[A-Z]{4}0[A-Z0-9]{0,6}$/.test(cleaned) && cleaned.length >= 6) ||
      (/^[A-Z]{4}\d[A-Z0-9]{4,8}$/.test(cleaned) && /\d/.test(cleaned)));

  if (!looksLikeIfscAttempt) {
    return {
      attempted: false,
      input: cleaned,
      formatValid: false,
      errors: [],
      bankCode: '',
      fifthChar: '',
      branchCode: '',
    };
  }

  const errors: string[] = [];
  if (cleaned.length !== 11) {
    errors.push(`IFSC must be exactly 11 characters (entered ${cleaned.length}).`);
  }
  const first4 = cleaned.slice(0, 4);
  if (first4.length === 4 && !/^[A-Z]{4}$/.test(first4)) {
    errors.push('First 4 characters must be uppercase alphabetic letters (bank code).');
  }
  const fifth = cleaned[4] || '';
  if (cleaned.length >= 5 && fifth !== '0') {
    errors.push(`5th character must be 0 (zero) per RBI standard (found "${fifth}").`);
  }
  const rest6 = cleaned.slice(5);
  if (cleaned.length === 11 && !/^[A-Z0-9]{6}$/.test(rest6)) {
    errors.push('Last 6 characters must be alphanumeric (branch identifier).');
  }

  return {
    attempted: true,
    input: cleaned,
    formatValid: IFSC_REGEX.test(cleaned),
    errors,
    bankCode: first4,
    fifthChar: fifth,
    branchCode: rest6,
  };
}

function buildPincodeFilterClause(params: {
  q?: string;
  pincode?: string;
  state?: string;
  district?: string;
  officeType?: string;
  deliveryStatus?: string;
}): {
  joinSql: string;
  whereSql: string;
  bindings: (string | number)[];
  exactPincode: string | null;
  invalidPincodeAttempt: string | null;
} {
  const clauses: string[] = [];
  const bindings: (string | number)[] = [];
  let joinSql = '';
  let exactPincode: string | null = null;
  let invalidPincodeAttempt: string | null = null;

  const explicitPin = (params.pincode || '').trim();
  const qRaw = (params.q || '').trim();

  if (explicitPin) {
    if (PINCODE_REGEX.test(explicitPin)) {
      exactPincode = explicitPin;
      clauses.push('p.pincode = ?');
      bindings.push(explicitPin);
    } else {
      invalidPincodeAttempt = explicitPin;
    }
  } else if (qRaw) {
    const compactDigits = qRaw.replace(/\s+/g, '');
    if (PINCODE_REGEX.test(compactDigits)) {
      exactPincode = compactDigits;
      clauses.push('p.pincode = ?');
      bindings.push(compactDigits);
    } else if (/^\d{6}$/.test(compactDigits)) {
      // 6 digits starting with 0 (invalid Indian PIN)
      invalidPincodeAttempt = compactDigits;
      clauses.push('1 = 0');
    } else if (/^\d{2,5}$/.test(compactDigits)) {
      clauses.push('p.pincode LIKE ?');
      bindings.push(`${compactDigits}%`);
    } else {
      const fts = buildFtsQuery(qRaw);
      if (fts) {
        joinSql = 'JOIN india_pincodes_fts f ON f.rowid = p.id';
        clauses.push('india_pincodes_fts MATCH ?');
        bindings.push(fts);
      } else {
        const like = `%${qRaw}%`;
        clauses.push(
          '(p.pincode LIKE ? OR p.office_name LIKE ? OR p.district LIKE ? OR p.state LIKE ? OR p.taluk LIKE ?)'
        );
        bindings.push(like, like, like, like, like);
      }
    }
  }

  if (params.state && params.state !== 'ALL') {
    clauses.push('p.state = ?');
    bindings.push(params.state);
  }
  if (params.district && params.district !== 'ALL') {
    clauses.push('p.district = ?');
    bindings.push(params.district);
  }
  if (params.officeType && params.officeType !== 'ALL') {
    clauses.push('p.office_type = ?');
    bindings.push(params.officeType);
  }
  if (params.deliveryStatus && params.deliveryStatus !== 'ALL') {
    clauses.push('p.delivery_status = ?');
    bindings.push(params.deliveryStatus);
  }

  return {
    joinSql,
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    bindings,
    exactPincode,
    invalidPincodeAttempt,
  };
}

function buildIfscFilterClause(params: {
  q?: string;
  ifsc?: string;
  bank?: string;
  state?: string;
  district?: string;
  city?: string;
  micr?: string;
  category?: string;
  status?: string;
}): {
  joinSql: string;
  whereSql: string;
  bindings: (string | number)[];
  ifscValidation: ReturnType<typeof validateIfscStructure>;
} {
  const clauses: string[] = [];
  const bindings: (string | number)[] = [];
  let joinSql = '';

  const explicitIfsc = (params.ifsc || '').trim().toUpperCase();
  const qRaw = (params.q || '').trim();
  const validationTarget = explicitIfsc || qRaw;
  const ifscValidation = validateIfscStructure(validationTarget);

  if (explicitIfsc) {
    if (IFSC_REGEX.test(explicitIfsc)) {
      clauses.push('i.ifsc = ?');
      bindings.push(explicitIfsc);
    } else {
      clauses.push('i.ifsc LIKE ?');
      bindings.push(`${explicitIfsc}%`);
    }
  } else if (qRaw) {
    const qUpper = qRaw.toUpperCase().replace(/\s+/g, '');
    if (IFSC_REGEX.test(qUpper)) {
      clauses.push('i.ifsc = ?');
      bindings.push(qUpper);
    } else if (/^\d{9}$/.test(qUpper)) {
      // Exact 9-digit MICR code
      clauses.push('i.micr = ?');
      bindings.push(qUpper);
    } else if (/^[A-Z]{4}0?[A-Z0-9]{0,6}$/.test(qUpper) && qUpper.length >= 4 && !qRaw.includes(' ')) {
      // Partial IFSC prefix or 4-letter bank code / short alias
      const mappedCode = BANK_SHORT_ALIAS_TO_CODE[qUpper] || qUpper;
      clauses.push('(i.ifsc LIKE ? OR i.bank_code = ? OR i.bank_name LIKE ?)');
      bindings.push(`${qUpper}%`, mappedCode, `%${qRaw}%`);
    } else if (BANK_SHORT_ALIAS_TO_CODE[qUpper]) {
      const mappedCode = BANK_SHORT_ALIAS_TO_CODE[qUpper];
      clauses.push('(i.bank_code = ? OR i.bank_name LIKE ?)');
      bindings.push(mappedCode, `%${qRaw}%`);
    } else {
      const fts = buildFtsQuery(qRaw);
      if (fts) {
        joinSql = 'JOIN india_ifsc_fts f ON f.rowid = i.id';
        clauses.push('india_ifsc_fts MATCH ?');
        bindings.push(fts);
      } else {
        const like = `%${qRaw}%`;
        clauses.push(
          '(i.ifsc LIKE ? OR i.bank_name LIKE ? OR i.branch_name LIKE ? OR i.city LIKE ? OR i.district LIKE ? OR i.state LIKE ? OR i.micr LIKE ?)'
        );
        bindings.push(like, like, like, like, like, like, like);
      }
    }
  }

  // Do NOT mix inactive or historical/merged codes into normal Active searches unless explicitly requested
  const requestedStatus = params.status || 'Active';
  if (requestedStatus !== 'ALL' && requestedStatus !== 'All') {
    clauses.push('i.bank_status = ?');
    bindings.push(requestedStatus);
  }

  if (params.bank && params.bank !== 'ALL') {
    clauses.push('i.bank_name = ?');
    bindings.push(params.bank);
  }
  if (params.state && params.state !== 'ALL') {
    clauses.push('i.state = ?');
    bindings.push(params.state);
  }
  if (params.district && params.district !== 'ALL') {
    clauses.push('i.district = ?');
    bindings.push(params.district);
  }
  if (params.city && params.city !== 'ALL') {
    clauses.push('i.city = ?');
    bindings.push(params.city);
  }
  if (params.micr && params.micr.trim()) {
    clauses.push('i.micr = ?');
    bindings.push(params.micr.trim());
  }
  if (params.category && params.category !== 'ALL') {
    clauses.push('i.bank_category = ?');
    bindings.push(params.category);
  }

  return {
    joinSql,
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    bindings,
    ifscValidation,
  };
}

const directoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60_000;

function getCachedOrCompute<T>(key: string, compute: () => T): T {
  const now = Date.now();
  const hit = directoryCache.get(key);
  if (hit && now < hit.expiresAt) {
    return hit.value as T;
  }
  const value = compute();
  directoryCache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function invalidateDirectoryCache(scope: 'pincodes' | 'ifsc' | 'rto' | 'all' = 'all'): void {
  for (const key of Array.from(directoryCache.keys())) {
    if (
      scope === 'all' ||
      key.startsWith(`${scope}:`) ||
      key.startsWith('admin:')
    ) {
      directoryCache.delete(key);
    }
  }
}

function computePincodeFacets(state: string) {
  const db = getDb();
  const states = getCachedOrCompute('pincodes:states_facet', () =>
    db
      .prepare(
        `SELECT state, COUNT(*) as officeCount, COUNT(DISTINCT pincode) as uniquePincodeCount
         FROM india_pincodes
         WHERE state != ''
         GROUP BY state
         ORDER BY state ASC`
      )
      .all()
  );

  const districts =
    state && state !== 'ALL'
      ? getCachedOrCompute(`pincodes:districts:${state}`, () =>
          db
            .prepare(
              `SELECT district, COUNT(*) as officeCount, COUNT(DISTINCT pincode) as uniquePincodeCount
               FROM india_pincodes
               WHERE state = ? AND district != ''
               GROUP BY district
               ORDER BY district ASC`
            )
            .all(state)
        )
      : [];

  const officeTypes = getCachedOrCompute('pincodes:office_types', () =>
    db
      .prepare(
        `SELECT office_type as officeType, COUNT(*) as count FROM india_pincodes WHERE office_type != '' GROUP BY office_type ORDER BY count DESC`
      )
      .all()
  );

  const deliveryStatuses = getCachedOrCompute('pincodes:delivery_statuses', () =>
    db
      .prepare(
        `SELECT delivery_status as deliveryStatus, COUNT(*) as count FROM india_pincodes GROUP BY delivery_status ORDER BY count DESC`
      )
      .all()
  );

  return { states, districts, officeTypes, deliveryStatuses };
}

function computePincodeStats() {
  return getCachedOrCompute('pincodes:stats', () => {
    const db = getDb();
    const totals = db
      .prepare(
        `SELECT
           COUNT(*) as totalPostOffices,
           COUNT(DISTINCT pincode) as totalUniquePincodes,
           COUNT(DISTINCT state) as totalStatesAndUts,
           COUNT(DISTINCT district || '|' || state) as totalDistricts,
           SUM(CASE WHEN delivery_status = 'Delivery' THEN 1 ELSE 0 END) as deliveryOffices,
           SUM(CASE WHEN delivery_status = 'Non-Delivery' THEN 1 ELSE 0 END) as nonDeliveryOffices,
           SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verifiedOffices,
           SUM(CASE WHEN verification_status != 'verified' THEN 1 ELSE 0 END) as unverifiedOffices,
           MAX(updated_at) as lastUpdatedAt
         FROM india_pincodes`
      )
      .get() as Record<string, unknown>;

    const stateWise = db
      .prepare(
        `SELECT state, COUNT(*) as officeCount, COUNT(DISTINCT pincode) as uniquePincodeCount
         FROM india_pincodes
         WHERE state != ''
         GROUP BY state
         ORDER BY officeCount DESC`
      )
      .all();

    const officeTypes = db
      .prepare(
        `SELECT office_type as officeType, COUNT(*) as count
         FROM india_pincodes
         GROUP BY office_type
         ORDER BY count DESC`
      )
      .all();

    const lastImport = db
      .prepare(
        `SELECT * FROM dataset_imports WHERE dataset = 'pincodes' ORDER BY id DESC LIMIT 1`
      )
      .get();

    return {
      ...totals,
      stateWise,
      officeTypes,
      lastImport: lastImport || null,
    };
  });
}

function computeIfscFacets(bank: string, state: string, district: string, status: string) {
  return getCachedOrCompute(`ifsc:facets:${bank}|${state}|${district}|${status}`, () => {
    const db = getDb();
    const statusWhere =
      status !== 'ALL' && status !== 'All' ? `WHERE bank_status = ?` : '';
    const statusBind = status !== 'ALL' && status !== 'All' ? [status] : [];

    const banks = getCachedOrCompute(`ifsc:banks:${status}`, () =>
      db
        .prepare(
          `SELECT bank_name as bankName, bank_code as bankCode, bank_category as bankCategory, COUNT(*) as branchCount
           FROM india_ifsc ${statusWhere}
           GROUP BY bank_name
           ORDER BY branchCount DESC`
        )
        .all(...statusBind)
    );

    const statesWhereParts: string[] = [`state != ''`];
    const statesBind: string[] = [];
    if (status !== 'ALL' && status !== 'All') {
      statesWhereParts.push('bank_status = ?');
      statesBind.push(status);
    }
    if (bank !== 'ALL') {
      statesWhereParts.push('bank_name = ?');
      statesBind.push(bank);
    }

    const states = db
      .prepare(
        `SELECT state, COUNT(*) as branchCount
         FROM india_ifsc
         WHERE ${statesWhereParts.join(' AND ')}
         GROUP BY state
         ORDER BY state ASC`
      )
      .all(...statesBind);

    let districts: unknown[] = [];
    if (state !== 'ALL') {
      const dParts = [`state = ?`, `district != ''`];
      const dBind = [state];
      if (bank !== 'ALL') {
        dParts.push('bank_name = ?');
        dBind.push(bank);
      }
      if (status !== 'ALL' && status !== 'All') {
        dParts.push('bank_status = ?');
        dBind.push(status);
      }
      districts = db
        .prepare(
          `SELECT district, COUNT(*) as branchCount
           FROM india_ifsc
           WHERE ${dParts.join(' AND ')}
           GROUP BY district
           ORDER BY district ASC`
        )
        .all(...dBind);
    }

    let cities: unknown[] = [];
    if (state !== 'ALL' || bank !== 'ALL') {
      const cParts = [`city != ''`];
      const cBind: string[] = [];
      if (bank !== 'ALL') {
        cParts.push('bank_name = ?');
        cBind.push(bank);
      }
      if (state !== 'ALL') {
        cParts.push('state = ?');
        cBind.push(state);
      }
      if (district !== 'ALL') {
        cParts.push('district = ?');
        cBind.push(district);
      }
      if (status !== 'ALL' && status !== 'All') {
        cParts.push('bank_status = ?');
        cBind.push(status);
      }
      cities = db
        .prepare(
          `SELECT city, COUNT(*) as branchCount
           FROM india_ifsc
           WHERE ${cParts.join(' AND ')}
           GROUP BY city
           ORDER BY branchCount DESC, city ASC
           LIMIT 250`
        )
        .all(...cBind);
    }

    const categories = getCachedOrCompute('ifsc:categories', () =>
      db
        .prepare(
          `SELECT bank_category as category, COUNT(*) as count
           FROM india_ifsc
           WHERE bank_category != ''
           GROUP BY bank_category
           ORDER BY count DESC`
        )
        .all()
    );

    const statuses = getCachedOrCompute('ifsc:statuses', () =>
      db
        .prepare(
          `SELECT bank_status as status, COUNT(*) as count
           FROM india_ifsc
           GROUP BY bank_status
           ORDER BY count DESC`
        )
        .all()
    );

    return { banks, states, districts, cities, categories, statuses };
  });
}

function computeIfscStats() {
  return getCachedOrCompute('ifsc:stats', () => {
    const db = getDb();
    const totals = db
      .prepare(
        `SELECT
           COUNT(*) as totalRecords,
           SUM(CASE WHEN bank_status = 'Active' THEN 1 ELSE 0 END) as activeRecords,
           SUM(CASE WHEN bank_status != 'Active' THEN 1 ELSE 0 END) as inactiveOrHistoricalRecords,
           COUNT(DISTINCT bank_name) as uniqueBanks,
           COUNT(DISTINCT CASE WHEN state != '' THEN state END) as statesCovered,
           SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verifiedRecords,
           SUM(CASE WHEN verification_status != 'verified' THEN 1 ELSE 0 END) as unverifiedRecords,
           MAX(updated_at) as lastUpdatedAt
         FROM india_ifsc`
      )
      .get() as Record<string, unknown>;

    const topBanks = db
      .prepare(
        `SELECT bank_name as bankName, bank_code as bankCode, bank_category as bankCategory, COUNT(*) as branchCount
         FROM india_ifsc
         WHERE bank_status = 'Active'
         GROUP BY bank_name
         ORDER BY branchCount DESC
         LIMIT 25`
      )
      .all();

    const stateWise = db
      .prepare(
        `SELECT state, COUNT(*) as branchCount
         FROM india_ifsc
         WHERE bank_status = 'Active' AND state != ''
         GROUP BY state
         ORDER BY branchCount DESC`
      )
      .all();

    const categories = db
      .prepare(
        `SELECT bank_category as category, COUNT(*) as count
         FROM india_ifsc
         WHERE bank_status = 'Active'
         GROUP BY bank_category
         ORDER BY count DESC`
      )
      .all();

    const lastImport = db
      .prepare(
        `SELECT * FROM dataset_imports WHERE dataset = 'ifsc' ORDER BY id DESC LIMIT 1`
      )
      .get();

    return {
      ...totals,
      topBanks,
      stateWise,
      categories,
      amalgamatedBanksCount: Object.keys(RBI_AMALGAMATED_BANKS).length,
      lastImport: lastImport || null,
    };
  });
}

function computeRtoStats() {
  return getCachedOrCompute('rto:stats', () => {
    const db = getDb();
    const totals = db
      .prepare(
        `SELECT
           COUNT(*) as totalRecords,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeRecords,
           SUM(CASE WHEN status = 'historical' THEN 1 ELSE 0 END) as historicalRecords,
           COUNT(DISTINCT CASE WHEN state != '' THEN state END) as statesAndUtsCovered,
           SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verifiedRecords,
           MAX(updated_at) as lastUpdatedAt
         FROM india_rto`
      )
      .get() as Record<string, unknown>;

    const stateWise = db
      .prepare(
        `SELECT state, COUNT(*) as rtoCount
         FROM india_rto
         WHERE state != ''
         GROUP BY state
         ORDER BY rtoCount DESC`
      )
      .all();

    const lastImport = db
      .prepare(
        `SELECT * FROM dataset_imports WHERE dataset = 'rto' ORDER BY id DESC LIMIT 1`
      )
      .get();

    return {
      ...totals,
      stateWise,
      lastImport: lastImport || null,
    };
  });
}

function getCachedRtoRecords() {
  return getCachedOrCompute('rto:records', () => {
    const db = getDb();
    return db
      .prepare(
        `SELECT
           code,
           state,
           state_code as stateCode,
           office_name as officeName,
           district,
           city,
           address,
           phone,
           email,
           rto_type as rtoType,
           source,
           last_verified_at as lastVerified,
           status,
           verification_status as verificationStatus,
           note
         FROM india_rto
         ORDER BY code ASC`
      )
      .all();
  });
}

function computeAdminOverview() {
  return getCachedOrCompute('admin:overview', () => {
    const db = getDb();
    const pinQuality = db
      .prepare(
        `SELECT
           COUNT(*) as totalPostOffices,
           COUNT(DISTINCT pincode) as totalUniquePincodes,
           SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verifiedCount,
           SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) as unverifiedCount,
           SUM(CASE WHEN verification_status = 'awaiting_verification' THEN 1 ELSE 0 END) as awaitingVerificationCount,
           SUM(CASE WHEN taluk = '' THEN 1 ELSE 0 END) as missingTalukCount,
           SUM(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 ELSE 0 END) as missingCoordinatesCount
         FROM india_pincodes`
      )
      .get();

    const ifscQuality = db
      .prepare(
        `SELECT
           COUNT(*) as totalRecords,
           SUM(CASE WHEN bank_status = 'Active' THEN 1 ELSE 0 END) as activeCount,
           SUM(CASE WHEN bank_status != 'Active' THEN 1 ELSE 0 END) as inactiveOrMergedCount,
           SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verifiedCount,
           SUM(CASE WHEN verification_status = 'unverified' THEN 1 ELSE 0 END) as unverifiedCount,
           SUM(CASE WHEN micr = '' THEN 1 ELSE 0 END) as missingMicrCount,
           SUM(CASE WHEN address = '' THEN 1 ELSE 0 END) as missingAddressCount
         FROM india_ifsc`
      )
      .get();

    const rtoQuality = db
      .prepare(
        `SELECT
           COUNT(*) as totalRtoRecords,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeCount,
           SUM(CASE WHEN status = 'historical' THEN 1 ELSE 0 END) as historicalCount,
           COUNT(DISTINCT CASE WHEN state != '' THEN state END) as statesCovered,
           SUM(CASE WHEN address = '' THEN 1 ELSE 0 END) as missingAddressCount
         FROM india_rto`
      )
      .get();

    const imports = db
      .prepare(`SELECT * FROM dataset_imports ORDER BY id DESC LIMIT 25`)
      .all();

    return { pinQuality, ifscQuality, rtoQuality, imports };
  });
}

export function warmDirectoryCache(): void {
  const steps = [
    () => computeIfscStats(),
    () => computeIfscFacets('ALL', 'ALL', 'ALL', 'Active'),
    () => computePincodeStats(),
    () => computePincodeFacets('ALL'),
    () => computeRtoStats(),
    () => getCachedRtoRecords(),
    () => computeAdminOverview(),
  ];
  let idx = 0;
  const runNext = () => {
    if (idx >= steps.length) return;
    try {
      steps[idx]();
    } catch (err) {
      console.warn('Cache warmup step failed:', err);
    }
    idx += 1;
    if (idx < steps.length) {
      setTimeout(runNext, 25);
    }
  };
  setTimeout(runNext, 50);
}

export function createApiRouter(): Router {
  const router = express.Router();
  const publicLimiter = createRateLimiter(300, 60_000);
  const adminAuthLimiter = createRateLimiter(30, 5 * 60_000);

  // Apply public limiter to public query endpoints only (never block admin bulk chunk uploads)
  router.use('/pincodes', publicLimiter);
  router.use('/ifsc', publicLimiter);
  router.use('/rto', publicLimiter);

  // Health endpoint
  router.get('/health', (_req, res) => {
    const db = getDb();
    const pins = Number((db.prepare('SELECT COUNT(*) as c FROM india_pincodes').get() as { c: number }).c);
    const ifscs = Number((db.prepare('SELECT COUNT(*) as c FROM india_ifsc').get() as { c: number }).c);
    const rtos = Number((db.prepare('SELECT COUNT(*) as c FROM india_rto').get() as { c: number }).c);
    res.json({ ok: true, pincodesCount: pins, ifscCount: ifscs, rtoCount: rtos });
  });

  // =========================================================================
  // INDIA PIN CODE FINDER ENDPOINTS
  // =========================================================================
  router.get('/pincodes/search', async (req, res) => {
    try {
      const started = Date.now();
      const db = getDb();
      const q = String(req.query.q ?? '');
      const pincode = String(req.query.pincode ?? '');
      const state = String(req.query.state ?? 'ALL');
      const district = String(req.query.district ?? 'ALL');
      const officeType = String(req.query.officeType ?? 'ALL');
      const deliveryStatus = String(req.query.deliveryStatus ?? 'ALL');
      const sort = String(req.query.sort ?? 'pincode_asc');
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const offset = (page - 1) * limit;

      const built = buildPincodeFilterClause({
        q,
        pincode,
        state,
        district,
        officeType,
        deliveryStatus,
      });

      const orderByMap: Record<string, string> = {
        pincode_asc: 'p.pincode ASC, p.office_name ASC',
        pincode_desc: 'p.pincode DESC, p.office_name ASC',
        office_asc: 'p.office_name ASC, p.pincode ASC',
        office_desc: 'p.office_name DESC, p.pincode ASC',
      };
      const orderBy = orderByMap[sort] || orderByMap.pincode_asc;

      const countRow = db
        .prepare(
          `SELECT COUNT(*) as totalOffices, COUNT(DISTINCT p.pincode) as uniquePincodes FROM india_pincodes p ${built.joinSql} ${built.whereSql}`
        )
        .get(...built.bindings) as { totalOffices: number; uniquePincodes: number };

      let items = db
        .prepare(
          `SELECT p.* FROM india_pincodes p ${built.joinSql} ${built.whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        )
        .all(...built.bindings, limit, offset) as Record<string, unknown>[];

      let fallbackSource: string | null = null;
      let totalMatchingOffices = Number(countRow.totalOffices || 0);
      let totalUniquePincodes = Number(countRow.uniquePincodes || 0);

      // Live India Post supplementary fallback ONLY if exact 6-digit PIN has 0 rows in local SQL DB
      if (
        items.length === 0 &&
        built.exactPincode &&
        state === 'ALL' &&
        district === 'ALL' &&
        officeType === 'ALL' &&
        deliveryStatus === 'ALL'
      ) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const apiRes = await fetch(
            `https://api.postalpincode.in/pincode/${built.exactPincode}`,
            { signal: controller.signal }
          );
          clearTimeout(timer);
          if (apiRes.ok) {
            const payload = (await apiRes.json()) as Array<{
              Status?: string;
              PostOffice?: Array<Record<string, string | null>>;
            }>;
            const first = payload?.[0];
            if (first?.Status === 'Success' && Array.isArray(first.PostOffice) && first.PostOffice.length > 0) {
              fallbackSource = 'India Post Live API (api.postalpincode.in)';
              const liveRows = first.PostOffice.map((po, idx) => ({
                id: -(idx + 1),
                pincode: po.Pincode || built.exactPincode,
                office_name: po.Name || 'Not Available',
                office_type: po.BranchType || 'Post Office',
                delivery_status: po.DeliveryStatus || 'Unverified',
                district: po.District || '',
                state: po.State || '',
                division: po.Division || '',
                region: po.Region || '',
                circle: po.Circle || '',
                taluk: po.Block && po.Block !== 'NA' ? po.Block : '',
                postal_address: `${po.Name || ''}, ${po.District || ''}, ${po.State || ''} - ${built.exactPincode}`,
                contact: '',
                latitude: null,
                longitude: null,
                verification_status: 'verified',
                source: fallbackSource,
                last_verified_at: new Date().toISOString().slice(0, 10),
              }));
              totalMatchingOffices = liveRows.length;
              totalUniquePincodes = 1;
              items = liveRows.slice(offset, offset + limit);
            }
          }
        } catch {
          // Safe fallback: continue returning 0 rows without crashing
        }
      }

      const totalPages = Math.max(1, Math.ceil(totalMatchingOffices / limit));

      res.json({
        items,
        totalMatchingOffices,
        totalUniquePincodes,
        page,
        limit,
        totalPages,
        exactPincodeLookup: built.exactPincode,
        invalidPincodeAttempt: built.invalidPincodeAttempt,
        fallbackSource,
        queryDurationMs: Date.now() - started,
      });
    } catch (err) {
      console.error('PIN search error:', err);
      res.status(500).json({ error: 'Unable to execute PIN code search.' });
    }
  });

  router.get('/pincodes/suggest', (req, res) => {
    try {
      const db = getDb();
      const q = String(req.query.q ?? '').trim();
      if (!q || q.length < 2) {
        res.json({ suggestions: [] });
        return;
      }

      const compactDigits = q.replace(/\s+/g, '');
      let rows: Record<string, unknown>[] = [];
      if (/^\d{2,6}$/.test(compactDigits)) {
        rows = db
          .prepare(
            `SELECT pincode, office_name, office_type, district, state FROM india_pincodes WHERE pincode LIKE ? ORDER BY pincode ASC, office_name ASC LIMIT 8`
          )
          .all(`${compactDigits}%`) as Record<string, unknown>[];
      } else {
        const fts = buildFtsQuery(q);
        if (fts) {
          rows = db
            .prepare(
              `SELECT p.pincode, p.office_name, p.office_type, p.district, p.state
               FROM india_pincodes p
               JOIN india_pincodes_fts f ON f.rowid = p.id
               WHERE india_pincodes_fts MATCH ?
               ORDER BY p.pincode ASC
               LIMIT 8`
            )
            .all(fts) as Record<string, unknown>[];
        }
      }
      res.json({ suggestions: rows });
    } catch {
      res.json({ suggestions: [] });
    }
  });

  router.get('/pincodes/facets', (req, res) => {
    try {
      const state = String(req.query.state ?? 'ALL');
      res.json(computePincodeFacets(state));
    } catch (err) {
      console.error('PIN facets error:', err);
      res.status(500).json({ error: 'Unable to load PIN directory facets.' });
    }
  });

  router.get('/pincodes/stats', (_req, res) => {
    try {
      res.json(computePincodeStats());
    } catch (err) {
      console.error('PIN stats error:', err);
      res.status(500).json({ error: 'Unable to compute PIN statistics.' });
    }
  });

  router.get('/pincodes/export', (req, res) => {
    try {
      const db = getDb();
      const built = buildPincodeFilterClause({
        q: String(req.query.q ?? ''),
        pincode: String(req.query.pincode ?? ''),
        state: String(req.query.state ?? 'ALL'),
        district: String(req.query.district ?? 'ALL'),
        officeType: String(req.query.officeType ?? 'ALL'),
        deliveryStatus: String(req.query.deliveryStatus ?? 'ALL'),
      });

      const rows = db
        .prepare(
          `SELECT p.pincode, p.office_name, p.office_type, p.delivery_status, p.district, p.state,
                  p.taluk, p.division, p.region, p.circle, p.postal_address, p.contact,
                  p.latitude, p.longitude, p.source, p.last_verified_at
           FROM india_pincodes p ${built.joinSql} ${built.whereSql}
           ORDER BY p.pincode ASC, p.office_name ASC
           LIMIT 5000`
        )
        .all(...built.bindings) as Record<string, unknown>[];

      const headers = [
        'PIN Code',
        'Post Office Name',
        'Office Type',
        'Delivery Status',
        'District',
        'State',
        'Taluk / Sub-District',
        'Division',
        'Region',
        'Circle',
        'Postal Address',
        'Contact',
        'Latitude',
        'Longitude',
        'Source',
        'Last Verified',
      ];

      const csvLines = [headers.map(escapeCsvCell).join(',')];
      for (const r of rows) {
        csvLines.push(
          [
            r.pincode,
            r.office_name,
            r.office_type,
            r.delivery_status,
            r.district,
            r.state,
            r.taluk || 'Not Available',
            r.division || 'Not Available',
            r.region || 'Not Available',
            r.circle || 'Not Available',
            r.postal_address,
            r.contact || 'Not Available',
            r.latitude ?? '',
            r.longitude ?? '',
            r.source,
            r.last_verified_at,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="india-pincode-results.csv"');
      res.send(`\uFEFF${csvLines.join('\r\n')}`);
    } catch (err) {
      console.error('PIN export error:', err);
      res.status(500).json({ error: 'Failed to export PIN results.' });
    }
  });

  // =========================================================================
  // INDIA IFSC CODE FINDER ENDPOINTS
  // =========================================================================
  router.get('/ifsc/search', async (req, res) => {
    try {
      const started = Date.now();
      const db = getDb();
      const q = String(req.query.q ?? '');
      const ifsc = String(req.query.ifsc ?? '');
      const bank = String(req.query.bank ?? 'ALL');
      const state = String(req.query.state ?? 'ALL');
      const district = String(req.query.district ?? 'ALL');
      const city = String(req.query.city ?? 'ALL');
      const micr = String(req.query.micr ?? '');
      const category = String(req.query.category ?? 'ALL');
      const status = String(req.query.status ?? 'Active');
      const sort = String(req.query.sort ?? 'ifsc_asc');
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const offset = (page - 1) * limit;

      const built = buildIfscFilterClause({
        q,
        ifsc,
        bank,
        state,
        district,
        city,
        micr,
        category,
        status,
      });

      const orderByMap: Record<string, string> = {
        ifsc_asc: 'i.ifsc ASC',
        bank_asc: 'i.bank_name ASC, i.branch_name ASC',
        branch_asc: 'i.branch_name ASC, i.bank_name ASC',
        city_asc: 'i.city ASC, i.bank_name ASC',
      };
      const orderBy = orderByMap[sort] || orderByMap.ifsc_asc;

      let items: Record<string, unknown>[] = [];
      let totalMatchingBranches = 0;

      // Short-circuit DB scan when user entered a syntactically invalid IFSC code
      if (built.ifscValidation.attempted && !built.ifscValidation.formatValid) {
        totalMatchingBranches = 0;
        items = [];
      } else {
        const countRow = db
          .prepare(
            `SELECT COUNT(*) as total FROM india_ifsc i ${built.joinSql} ${built.whereSql}`
          )
          .get(...built.bindings) as { total: number };
        totalMatchingBranches = Number(countRow.total || 0);

        items = db
          .prepare(
            `SELECT i.* FROM india_ifsc i ${built.joinSql} ${built.whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
          )
          .all(...built.bindings, limit, offset) as Record<string, unknown>[];
      }

      // Check historical / merged / inactive isolation + RBI Amalgamated bank prefix recognition
      let historicalRecord: Record<string, unknown> | null = null;
      let mergerInfo = null;
      let existsInDataset = totalMatchingBranches > 0;
      let statusInDataset: string | null =
        items[0] && typeof items[0].bank_status === 'string' ? items[0].bank_status : null;
      let fallbackSource: string | null = null;

      if (built.ifscValidation.attempted && built.ifscValidation.formatValid) {
        const candidate = built.ifscValidation.input;
        mergerInfo = RBI_AMALGAMATED_BANKS[candidate.slice(0, 4)] || null;

        const exactAnyStatus = db
          .prepare('SELECT * FROM india_ifsc WHERE ifsc = ? LIMIT 1')
          .get(candidate) as Record<string, unknown> | undefined;

        if (exactAnyStatus) {
          existsInDataset = true;
          statusInDataset = String(exactAnyStatus.bank_status || 'Active');
          if (exactAnyStatus.bank_status !== 'Active' && status === 'Active') {
            historicalRecord = exactAnyStatus;
          }
        } else {
          // Optional supplementary live Razorpay IFSC check ONLY when valid-format IFSC isn't found locally
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const liveRes = await fetch(`https://ifsc.razorpay.com/${candidate}`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (liveRes.ok) {
              const liveData = (await liveRes.json()) as Record<string, unknown>;
              fallbackSource = 'Razorpay Live IFSC Directory (ifsc.razorpay.com)';
              existsInDataset = true;
              statusInDataset = 'Active';
              items = [
                {
                  id: -1,
                  ifsc: String(liveData.IFSC || candidate),
                  bank_name: String(liveData.BANK || ''),
                  branch_name: String(liveData.BRANCH || ''),
                  address: String(liveData.ADDRESS || ''),
                  state: String(liveData.STATE || ''),
                  district: String(liveData.DISTRICT || ''),
                  city: String(liveData.CITY || ''),
                  micr: String(liveData.MICR || ''),
                  bank_code: String(liveData.BANKCODE || candidate.slice(0, 4)),
                  branch_code: candidate.slice(5),
                  bank_category: 'RBI-Regulated Bank',
                  bank_status: 'Active',
                  successor_bank: '',
                  successor_ifsc_prefix: '',
                  upi: liveData.UPI ? 1 : 0,
                  rtgs: liveData.RTGS ? 1 : 0,
                  neft: liveData.NEFT ? 1 : 0,
                  imps: liveData.IMPS ? 1 : 0,
                  swift: String(liveData.SWIFT || ''),
                  contact: String(liveData.CONTACT || ''),
                  verification_status: 'verified',
                  source: fallbackSource,
                  last_verified_at: new Date().toISOString().slice(0, 10),
                },
              ];
              totalMatchingBranches = 1;
            }
          } catch {
            // Safe offline resilience
          }
        }
      }

      const totalPages = Math.max(1, Math.ceil(totalMatchingBranches / limit));

      res.json({
        items,
        totalMatchingBranches,
        page,
        limit,
        totalPages,
        ifscValidation: {
          ...built.ifscValidation,
          existsInDataset,
          statusInDataset,
          mergerInfo,
        },
        historicalRecord,
        fallbackSource,
        queryDurationMs: Date.now() - started,
      });
    } catch (err) {
      console.error('IFSC search error:', err);
      res.status(500).json({ error: 'Unable to execute IFSC code search.' });
    }
  });

  router.get('/ifsc/suggest', (req, res) => {
    try {
      const db = getDb();
      const q = String(req.query.q ?? '').trim();
      const mode = String(req.query.mode ?? 'all');
      if (!q || q.length < 2) {
        res.json({ banks: [], branches: [] });
        return;
      }

      const qUpper = q.toUpperCase().replace(/\s+/g, '');
      const bankAlias = BANK_SHORT_ALIAS_TO_CODE[qUpper];

      const banks =
        mode === 'branch'
          ? []
          : db
              .prepare(
                `SELECT bank_name as bankName, bank_code as bankCode, bank_category as bankCategory, COUNT(*) as branchCount
                 FROM india_ifsc
                 WHERE bank_status = 'Active' AND (bank_name LIKE ? OR bank_code = ?)
                 GROUP BY bank_name
                 ORDER BY branchCount DESC
                 LIMIT 6`
              )
              .all(`%${q}%`, bankAlias || qUpper);

      let branches: unknown[] = [];
      if (mode !== 'bank') {
        if (/^[A-Z]{4}0?[A-Z0-9]{0,6}$/.test(qUpper) && !q.includes(' ')) {
          branches = db
            .prepare(
              `SELECT ifsc, bank_name, branch_name, city, state, bank_status
               FROM india_ifsc
               WHERE bank_status = 'Active' AND ifsc LIKE ?
               ORDER BY ifsc ASC
               LIMIT 8`
            )
            .all(`${qUpper}%`);
        } else {
          const fts = buildFtsQuery(q);
          if (fts) {
            branches = db
              .prepare(
                `SELECT i.ifsc, i.bank_name, i.branch_name, i.city, i.state, i.bank_status
                 FROM india_ifsc i
                 JOIN india_ifsc_fts f ON f.rowid = i.id
                 WHERE i.bank_status = 'Active' AND india_ifsc_fts MATCH ?
                 LIMIT 8`
              )
              .all(fts);
          }
        }
      }

      res.json({ banks, branches });
    } catch {
      res.json({ banks: [], branches: [] });
    }
  });

  router.get('/ifsc/facets', (req, res) => {
    try {
      const bank = String(req.query.bank ?? 'ALL');
      const state = String(req.query.state ?? 'ALL');
      const district = String(req.query.district ?? 'ALL');
      const status = String(req.query.status ?? 'Active');
      res.json(computeIfscFacets(bank, state, district, status));
    } catch (err) {
      console.error('IFSC facets error:', err);
      res.status(500).json({ error: 'Unable to load IFSC directory facets.' });
    }
  });

  router.get('/ifsc/stats', (_req, res) => {
    try {
      res.json(computeIfscStats());
    } catch (err) {
      console.error('IFSC stats error:', err);
      res.status(500).json({ error: 'Unable to compute IFSC statistics.' });
    }
  });

  router.get('/ifsc/export', (req, res) => {
    try {
      const db = getDb();
      const built = buildIfscFilterClause({
        q: String(req.query.q ?? ''),
        ifsc: String(req.query.ifsc ?? ''),
        bank: String(req.query.bank ?? 'ALL'),
        state: String(req.query.state ?? 'ALL'),
        district: String(req.query.district ?? 'ALL'),
        city: String(req.query.city ?? 'ALL'),
        micr: String(req.query.micr ?? ''),
        category: String(req.query.category ?? 'ALL'),
        status: String(req.query.status ?? 'Active'),
      });

      const rows = db
        .prepare(
          `SELECT i.ifsc, i.bank_name, i.branch_name, i.address, i.city, i.district, i.state,
                  i.micr, i.bank_code, i.branch_code, i.bank_category, i.bank_status,
                  i.successor_bank, i.upi, i.rtgs, i.neft, i.imps, i.source, i.last_verified_at
           FROM india_ifsc i ${built.joinSql} ${built.whereSql}
           ORDER BY i.ifsc ASC
           LIMIT 5000`
        )
        .all(...built.bindings) as Record<string, unknown>[];

      const headers = [
        'IFSC Code',
        'Bank Name',
        'Branch Name',
        'Branch Address',
        'City',
        'District',
        'State',
        'MICR Code',
        'Bank Code',
        'Branch Code',
        'Bank Category',
        'Bank Status',
        'Successor Bank',
        'UPI',
        'RTGS',
        'NEFT',
        'IMPS',
        'Source',
        'Last Verified',
      ];

      const csvLines = [headers.map(escapeCsvCell).join(',')];
      for (const r of rows) {
        csvLines.push(
          [
            r.ifsc,
            r.bank_name,
            r.branch_name,
            r.address || 'Not Available',
            r.city || 'Not Available',
            r.district || 'Not Available',
            r.state || 'Not Available',
            r.micr || 'Not Available',
            r.bank_code,
            r.branch_code,
            r.bank_category || 'Not Available',
            r.bank_status,
            r.successor_bank || '',
            r.upi ? 'Yes' : 'No',
            r.rtgs ? 'Yes' : 'No',
            r.neft ? 'Yes' : 'No',
            r.imps ? 'Yes' : 'No',
            r.source,
            r.last_verified_at,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="india-ifsc-results.csv"');
      res.send(`\uFEFF${csvLines.join('\r\n')}`);
    } catch (err) {
      console.error('IFSC export error:', err);
      res.status(500).json({ error: 'Failed to export IFSC results.' });
    }
  });

  // =========================================================================
  // INDIA RTO CODE FINDER ENDPOINTS
  // =========================================================================
  router.get('/rto/records', (_req, res) => {
    try {
      const records = getCachedRtoRecords();
      const stats = computeRtoStats();
      res.json({ records, stats });
    } catch (err) {
      console.error('RTO records error:', err);
      res.status(500).json({ error: 'Unable to fetch RTO records.' });
    }
  });

  router.get('/rto/stats', (_req, res) => {
    try {
      res.json(computeRtoStats());
    } catch (err) {
      console.error('RTO stats error:', err);
      res.status(500).json({ error: 'Unable to compute RTO statistics.' });
    }
  });

  router.get('/rto/export', (_req, res) => {
    try {
      const records = getCachedRtoRecords() as Array<Record<string, unknown>>;
      const headers = [
        'RTO Code',
        'State / UT',
        'State Code',
        'RTO Office Name',
        'District',
        'City',
        'Address',
        'Phone',
        'Email',
        'RTO Type',
        'Status',
        'Verification Status',
        'Note',
        'Source',
        'Last Verified',
      ];
      const csvLines = [headers.map(escapeCsvCell).join(',')];
      for (const r of records) {
        csvLines.push(
          [
            r.code,
            r.state,
            r.stateCode,
            r.officeName,
            r.district,
            r.city,
            r.address || '',
            r.phone || '',
            r.email || '',
            r.rtoType || 'RTO',
            r.status,
            r.verificationStatus,
            r.note || '',
            r.source,
            r.lastVerified,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="india-rto-registry.csv"');
      res.send(`\uFEFF${csvLines.join('\r\n')}`);
    } catch (err) {
      console.error('RTO export error:', err);
      res.status(500).json({ error: 'Failed to export RTO records.' });
    }
  });

  // =========================================================================
  // ADMIN AUTH & BULK DATA IMPORT / DATA QUALITY DASHBOARD
  // =========================================================================
  router.post('/admin/auth', adminAuthLimiter, (req, res) => {
    const passcode = String((req.body as { passcode?: string })?.passcode ?? '').trim();
    if (!passcode || !safeEqualStrings(passcode, getAdminPasscode())) {
      res.status(401).json({ error: 'Invalid administrator passcode.' });
      return;
    }
    res.json({ token: signAdminToken(), expiresInSeconds: 12 * 3600 });
  });

  router.get('/admin/overview', requireAdmin, (_req, res) => {
    try {
      res.json(computeAdminOverview());
    } catch (err) {
      console.error('Admin overview error:', err);
      res.status(500).json({ error: 'Unable to fetch admin data quality overview.' });
    }
  });

  router.post('/admin/import/:dataset', requireAdmin, (req, res) => {
    try {
      const dataset =
        req.params.dataset === 'ifsc'
          ? 'ifsc'
          : req.params.dataset === 'pincodes'
          ? 'pincodes'
          : req.params.dataset === 'rto'
          ? 'rto'
          : null;
      if (!dataset) {
        res.status(400).json({ error: 'Dataset must be "pincodes", "ifsc", or "rto".' });
        return;
      }

      const body = (req.body || {}) as {
        format?: 'csv' | 'xlsx' | 'json';
        payload?: string;
        rows?: Record<string, unknown>[];
        sourceLabel?: string;
        versionTag?: string;
        skipAudit?: boolean;
      };

      const format = body.format || 'json';
      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(body.rows)) {
        rows = body.rows;
      } else if (typeof body.payload === 'string' && body.payload.trim()) {
        rows = parseUploadPayloadToRows(format, body.payload);
      } else {
        res.status(400).json({ error: 'Provide either rows array or payload content.' });
        return;
      }

      if (rows.length > 50000) {
        res.status(400).json({
          error: 'Batch exceeds 50,000 rows per request. Split into smaller batches for chunked import.',
        });
        return;
      }

      const sourceLabel =
        body.sourceLabel?.trim() || `Admin ${format.toUpperCase()} Import`;
      const versionTag = body.versionTag?.trim() || new Date().toISOString().slice(0, 10);

      const summary =
        dataset === 'pincodes'
          ? importPincodeRowsBatch(rows, {
              sourceLabel,
              format,
              versionTag,
              importedBy: 'admin-ui',
              skipAudit: Boolean(body.skipAudit),
            })
          : dataset === 'ifsc'
          ? importIfscRowsBatch(rows, {
              sourceLabel,
              format,
              versionTag,
              importedBy: 'admin-ui',
              skipAudit: Boolean(body.skipAudit),
            })
          : importRtoRowsBatch(rows, {
              sourceLabel,
              format,
              versionTag,
              importedBy: 'admin-ui',
              skipAudit: Boolean(body.skipAudit),
            });

      invalidateDirectoryCache(dataset);
      res.json({ ok: true, summary });
    } catch (err) {
      console.error('Admin import error:', err);
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Bulk dataset import failed.',
      });
    }
  });

  router.post('/admin/import/:dataset/audit', requireAdmin, (req, res) => {
    try {
      const dataset =
        req.params.dataset === 'ifsc'
          ? 'ifsc'
          : req.params.dataset === 'pincodes'
          ? 'pincodes'
          : req.params.dataset === 'rto'
          ? 'rto'
          : null;
      if (!dataset) {
        res.status(400).json({ error: 'Dataset must be "pincodes", "ifsc", or "rto".' });
        return;
      }
      const summary = req.body as import('./importers.ts').ImportSummary;
      recordImportAudit({ ...summary, dataset }, 'admin-ui');
      invalidateDirectoryCache('all');
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to record import audit.',
      });
    }
  });

  router.post('/admin/sync/:dataset', requireAdmin, async (req, res) => {
    try {
      const dataset = req.params.dataset;
      if (dataset === 'pincodes') {
        const summary = await syncOfficialPincodesDataset('admin-official-sync');
        invalidateDirectoryCache('pincodes');
        res.json({ ok: true, summary });
        return;
      }
      if (dataset === 'ifsc') {
        const summary = await syncOfficialRazorpayIfscDataset('admin-official-sync');
        invalidateDirectoryCache('ifsc');
        res.json({ ok: true, summary });
        return;
      }
      if (dataset === 'rto') {
        const summary = syncBaselineRtoDataset('admin-baseline-sync');
        invalidateDirectoryCache('rto');
        res.json({ ok: true, summary });
        return;
      }
      res.status(400).json({ error: 'Unsupported sync target. Use "pincodes", "ifsc", or "rto".' });
    } catch (err) {
      console.error('Official sync error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to sync official dataset.',
      });
    }
  });

  // Official Launch Ribbon-Cutting 6-Digit Code Verification
  const launchVerifyLimiter = createRateLimiter(60_000, 30);
  router.post('/launch/verify', launchVerifyLimiter, (req, res) => {
    const body = req.body as { code?: string };
    const submitted = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(submitted)) {
      res.status(400).json({ error: 'Please enter a valid 6-digit numeric launch code.' });
      return;
    }

    const expected = process.env.VCPL_LAUNCH_CODE?.trim() || getAdminPasscode();
    if (!safeEqualStrings(submitted, expected)) {
      res.status(401).json({
        error: 'Incorrect 6-digit launch passcode. Please check your inauguration code and retry.',
      });
      return;
    }

    res.json({
      ok: true,
      launchedAtIso: new Date().toISOString(),
    });
  });

  return router;
}
