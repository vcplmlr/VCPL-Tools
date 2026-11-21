import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadJsonBackup,
  formatShortSavedTime,
  readJsonFile,
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '../../utils/browserVault';

interface Gstr1ReturnPrepViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type SectionKey = 'b2b' | 'b2cl' | 'b2cs' | 'cdnr' | 'cdnur' | 'exp';
type RowRecord = Record<string, string | number>;

interface SectionDef {
  label: string;
  sheets: string[];
  headers: string[];
}

const SECTION_KEYS: SectionKey[] = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'];

const SEC: Record<SectionKey, SectionDef> = {
  b2b: {
    label: 'B2B',
    sheets: ['b2b,sez,de', 'b2b'],
    headers: [
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Invoice Number',
      'Invoice date',
      'Invoice Value',
      'Place Of Supply',
      'Reverse Charge',
      'Applicable % of Tax Rate',
      'Invoice Type',
      'E-Commerce GSTIN',
      'Rate',
      'Taxable Value',
      'Cess Amount',
    ],
  },
  b2cl: {
    label: 'B2CL',
    sheets: ['b2cl'],
    headers: [
      'Invoice Number',
      'Invoice date',
      'Invoice Value',
      'Place Of Supply',
      'Applicable % of Tax Rate',
      'Rate',
      'Taxable Value',
      'Cess Amount',
      'E-Commerce GSTIN',
    ],
  },
  b2cs: {
    label: 'B2CS',
    sheets: ['b2cs'],
    headers: [
      'Type',
      'Place Of Supply',
      'Applicable % of Tax Rate',
      'Rate',
      'Taxable Value',
      'Cess Amount',
      'E-Commerce GSTIN',
    ],
  },
  cdnr: {
    label: 'CDNR',
    sheets: ['cdnr'],
    headers: [
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Note Number',
      'Note Date',
      'Note Type',
      'Place Of Supply',
      'Reverse Charge',
      'Note Supply Type',
      'Note Value',
      'Applicable % of Tax Rate',
      'Rate',
      'Taxable Value',
      'Cess Amount',
    ],
  },
  cdnur: {
    label: 'CDNUR',
    sheets: ['cdnur'],
    headers: [
      'UR Type',
      'Note Number',
      'Note Date',
      'Note Type',
      'Place Of Supply',
      'Note Value',
      'Applicable % of Tax Rate',
      'Rate',
      'Taxable Value',
      'Cess Amount',
    ],
  },
  exp: {
    label: 'Exports',
    sheets: ['exp'],
    headers: [
      'Export Type',
      'Invoice Number',
      'Invoice date',
      'Invoice Value',
      'Port Code',
      'Shipping Bill Number',
      'Shipping Bill Date',
      'Rate',
      'Taxable Value',
      'Cess Amount',
    ],
  },
};

const RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

const INVTYPE: Record<string, string> = {
  regular: 'R',
  'deemed exp': 'DE',
  'sez supplies with payment': 'SEZWP',
  'sez supplies without payment': 'SEZWOP',
  'intra-state supplies attracting igst': 'CBW',
};

const MON: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

const STATES = [
  '01-Jammu & Kashmir',
  '02-Himachal Pradesh',
  '03-Punjab',
  '04-Chandigarh',
  '05-Uttarakhand',
  '06-Haryana',
  '07-Delhi',
  '08-Rajasthan',
  '09-Uttar Pradesh',
  '10-Bihar',
  '11-Sikkim',
  '12-Arunachal Pradesh',
  '13-Nagaland',
  '14-Manipur',
  '15-Mizoram',
  '16-Tripura',
  '17-Meghalaya',
  '18-Assam',
  '19-West Bengal',
  '20-Jharkhand',
  '21-Odisha',
  '22-Chhattisgarh',
  '23-Madhya Pradesh',
  '24-Gujarat',
  '26-Dadra and Nagar Haveli and Daman and Diu',
  '27-Maharashtra',
  '29-Karnataka',
  '30-Goa',
  '31-Lakshdweep',
  '32-Kerala',
  '33-Tamil Nadu',
  '34-Puducherry',
  '35-Andaman & Nicobar Islands',
  '36-Telangana',
  '37-Andhra Pradesh',
  '38-Ladakh',
  '97-Other Territory',
];

const SUP = [
  'Regular',
  'SEZ supplies with payment',
  'SEZ supplies without payment',
  'Deemed Exp',
];

const OPT: Record<string, string[]> = {
  'Reverse Charge': ['Y', 'N'],
  'Invoice Type': [...SUP, 'Intra-State supplies attracting IGST'],
  'Note Type': ['C', 'D'],
  'Note Supply Type': ['Regular B2B', ...SUP.slice(1)],
  Type: ['OE', 'E'],
  'UR Type': ['B2CL', 'EXPWP', 'EXPWOP'],
  'Export Type': ['WPAY', 'WOPAY'],
  Rate: RATES.map(String),
  'Place Of Supply': STATES,
};

const DEF: Partial<Record<SectionKey, Record<string, string>>> = {
  b2b: { 'Reverse Charge': 'N', 'Invoice Type': 'Regular' },
  b2cs: { Type: 'OE' },
  cdnr: { 'Reverse Charge': 'N', 'Note Type': 'C', 'Note Supply Type': 'Regular B2B' },
  cdnur: { 'UR Type': 'B2CL', 'Note Type': 'C' },
  exp: { 'Export Type': 'WPAY' },
};

const norm = (s: unknown) =>
  String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9%]/g, '');

const n2 = (v: unknown) => {
  const x = parseFloat(String(v));
  return isNaN(x) ? 0 : Math.round(x * 100) / 100;
};

const str = (v: unknown) => (v == null ? '' : String(v).trim());
const p2 = (n: number) => String(n).padStart(2, '0');

function chk(d: number, m: number, y: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCDate() === d && t.getUTCMonth() === m - 1
    ? `${p2(d)}-${p2(m)}-${y}`
    : null;
}

function pd(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
    return `${p2(d.getUTCDate())}-${p2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ](\d{2,4})$/);
  if (m) {
    const mo = MON[m[2].toLowerCase()];
    if (mo == null) return null;
    let y = +m[3];
    if (y < 100) y += 2000;
    return chk(+m[1], mo + 1, y);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return chk(+m[1], +m[2], +m[3]);
  return null;
}

const sc = (v: unknown) => str(v).slice(0, 2);

interface FpInfo {
  m: number;
  y: number;
}

function parseFpInfo(fpRaw: string): FpInfo | null {
  const f = fpRaw.trim();
  if (!/^(0[1-9]|1[0-2])20\d\d$/.test(f)) return null;
  return { m: +f.slice(0, 2), y: +f.slice(2) };
}

function periodOK(dt: string | null, fp: FpInfo | null): boolean {
  if (!fp || !dt) return true;
  const [, m, y] = dt.split('-').map(Number);
  return y * 12 + m <= fp.y * 12 + fp.m;
}

interface TaxItemDetail {
  rt: number;
  txval: number;
  iamt?: number;
  camt?: number;
  samt?: number;
  csamt?: number;
}

interface ParsedRecord {
  ctin?: string;
  num?: string;
  dt?: string | null;
  val?: number;
  pos?: string;
  rchrg?: string;
  ntty?: string;
  inv_typ?: string;
  etin?: string;
  typ?: string;
  inter?: boolean | string;
  tv?: number;
  rt?: number;
  cs?: number;
  pc?: string;
  sb?: string;
  sd?: string | null;
  itm?: TaxItemDetail;
}

interface CheckedRowResult {
  rec: ParsedRecord;
  e: string[];
  blank?: boolean;
}

function isBlank(k: SectionKey, r: RowRecord): boolean {
  const def = DEF[k];
  return SEC[k].headers.every((h) => {
    const val = str(r[h]);
    return val === '' || val === (def && def[h] ? def[h] : '\u0000');
  });
}

function newRow(k: SectionKey): RowRecord {
  const o: RowRecord = {};
  const def = DEF[k];
  SEC[k].headers.forEach((h) => {
    o[h] = (def && def[h]) || '';
  });
  return o;
}

function dv(h: string, v: unknown): string | number {
  if (typeof v === 'number' && /date/i.test(h)) return pd(v) || v;
  if (h === 'Rate' && v !== '' && v != null && !isNaN(Number(v))) return String(parseFloat(String(v)));
  return v == null ? '' : (v as string | number);
}

function checkRow(k: SectionKey, r: RowRecord, g: string, fp: FpInfo | null): CheckedRowResult {
  const e: string[] = [];
  const R = (n: string) => r[n];
  const rec: ParsedRecord = {};
  const gs = str(g).toUpperCase();
  const home = gs.slice(0, 2);

  const inv = (label: string, v: unknown) => {
    const s = str(v);
    if (!s) e.push(`${label} is missing`);
    else if (
      s.length > 16 ||
      !/^[A-Za-z0-9/-]+$/.test(s) ||
      /^0+$/.test(s) ||
      /^[/-]|[/-]$/.test(s)
    ) {
      e.push(`${label} "${s}" is not valid (max 16 chars, letters, digits, / and -)`);
    }
    return s;
  };

  const dt = (label: string, v: unknown) => {
    const d = pd(v);
    if (!d) e.push(`${label} is missing or not a valid date`);
    else if (!periodOK(d, fp)) e.push(`${label} is after the return period`);
    return d;
  };

  const tin = (label: string, v: unknown, req: boolean) => {
    const s = str(v).toUpperCase();
    if (!s) {
      if (req) e.push(`${label} is missing`);
      return s;
    }
    if (!GSTIN_RE.test(s)) e.push(`${label} "${s}" is not a valid GSTIN`);
    return s;
  };

  const pos = (v: unknown) => {
    const s = sc(v);
    if (!/^\d{2}$/.test(s)) e.push('Place of supply is missing or invalid');
    return s;
  };

  const rate = (v: unknown) => {
    const x = parseFloat(String(v));
    if (isNaN(x)) {
      e.push('Rate is missing');
      return 0;
    }
    if (!RATES.includes(x)) e.push(`Rate ${x}% is not an allowed rate`);
    return x;
  };

  const amt = (label: string, v: unknown, neg = false) => {
    const x = parseFloat(String(v));
    if (isNaN(x)) {
      e.push(`${label} is missing or not a number`);
      return 0;
    }
    if (x < 0 && !neg) e.push(`${label} cannot be negative`);
    return n2(x);
  };

  const rc = (v: unknown) => {
    const s = str(v).toUpperCase();
    if (s !== 'Y' && s !== 'N') e.push('Reverse charge must be Y or N');
    return s;
  };

  const tax = (
    x: { tv: number; cs: number; forceInter?: boolean },
    rt: number,
    p: string
  ): TaxItemDetail => {
    const o: TaxItemDetail = { rt, txval: x.tv };
    const inter = Boolean(home && p && home !== p);
    if (inter || x.forceInter) {
      o.iamt = n2((x.tv * rt) / 100);
    } else {
      o.camt = n2((x.tv * rt) / 200);
      o.samt = n2((x.tv * rt) / 200);
    }
    if (x.cs) o.csamt = x.cs;
    return o;
  };

  if (k === 'b2b' || k === 'cdnr') {
    rec.ctin = tin('Recipient GSTIN', R(SEC[k].headers[0]), true);
    const note = k === 'cdnr';
    rec.num = inv(note ? 'Note number' : 'Invoice number', R(note ? 'Note Number' : 'Invoice Number'));
    rec.dt = dt(note ? 'Note date' : 'Invoice date', R(note ? 'Note Date' : 'Invoice date'));
    rec.val = amt(note ? 'Note value' : 'Invoice value', R(note ? 'Note Value' : 'Invoice Value'), note);
    rec.pos = pos(R('Place Of Supply'));
    rec.rchrg = rc(R('Reverse Charge'));
    if (note) {
      const t = str(R('Note Type')).toUpperCase();
      if (t !== 'C' && t !== 'D') e.push('Note type must be C or D');
      rec.ntty = t;
      const ty = str(R('Note Supply Type')).toLowerCase();
      rec.inv_typ =
        INVTYPE[ty] ||
        (ty.startsWith('regular')
          ? 'R'
          : (e.push(`Note supply type "${str(R('Note Supply Type'))}" not recognised`), ''));
    } else {
      const ty = str(R('Invoice Type')).toLowerCase();
      rec.inv_typ =
        INVTYPE[ty] ||
        (e.push(`Invoice type "${str(R('Invoice Type'))}" not recognised`), '');
    }
    rec.etin = tin('E-commerce GSTIN', R('E-Commerce GSTIN'), false);
    const tv = amt('Taxable value', R('Taxable Value'), note);
    rec.itm = tax(
      {
        tv,
        cs: n2(R('Cess Amount')),
        forceInter:
          rec.inv_typ === 'SEZWP' || rec.inv_typ === 'SEZWOP' || rec.inv_typ === 'CBW',
      },
      rate(R('Rate')),
      rec.pos
    );
    if (rec.inv_typ === 'SEZWOP') {
      delete rec.itm.iamt;
    }
    if (rec.ctin && rec.ctin === gs) e.push('Recipient GSTIN cannot be your own GSTIN');
  } else if (k === 'b2cl') {
    rec.num = inv('Invoice number', R('Invoice Number'));
    rec.dt = dt('Invoice date', R('Invoice date'));
    rec.val = amt('Invoice value', R('Invoice Value'));
    rec.pos = pos(R('Place Of Supply'));
    const lim = fp && fp.y * 12 + fp.m >= 2024 * 12 + 8 ? 100000 : 250000;
    if (rec.val && rec.val <= lim) {
      e.push(`B2CL invoice value must be above ₹${lim.toLocaleString('en-IN')} for this period`);
    }
    if (home && rec.pos === home) {
      e.push('B2CL supplies must be inter-state (place of supply equals your state)');
    }
    rec.etin = tin('E-commerce GSTIN', R('E-Commerce GSTIN'), false);
    const tv = amt('Taxable value', R('Taxable Value'));
    rec.itm = tax({ tv, cs: n2(R('Cess Amount')), forceInter: true }, rate(R('Rate')), rec.pos);
  } else if (k === 'b2cs') {
    const t = str(R('Type')).toUpperCase();
    if (t !== 'OE' && t !== 'E') e.push('Type must be OE or E');
    rec.typ = t === 'E' ? 'E' : 'OE';
    rec.pos = pos(R('Place Of Supply'));
    rec.etin = tin('E-commerce GSTIN', R('E-Commerce GSTIN'), t === 'E');
    const tv = amt('Taxable value', R('Taxable Value'), true);
    const rt = rate(R('Rate'));
    rec.inter = Boolean(home && rec.pos && home !== rec.pos);
    rec.tv = tv;
    rec.rt = rt;
    rec.cs = n2(R('Cess Amount'));
  } else if (k === 'cdnur') {
    const t = str(R('UR Type')).toUpperCase().replace(/\s/g, '');
    if (!['B2CL', 'EXPWP', 'EXPWOP'].includes(t)) {
      e.push('UR type must be B2CL, EXPWP or EXPWOP');
    }
    rec.typ = t;
    rec.num = inv('Note number', R('Note Number'));
    rec.dt = dt('Note date', R('Note Date'));
    const nt = str(R('Note Type')).toUpperCase();
    if (nt !== 'C' && nt !== 'D') e.push('Note type must be C or D');
    rec.ntty = nt;
    rec.pos = pos(R('Place Of Supply'));
    rec.val = amt('Note value', R('Note Value'), true);
    const tv = amt('Taxable value', R('Taxable Value'), true);
    rec.itm = tax({ tv, cs: n2(R('Cess Amount')), forceInter: true }, rate(R('Rate')), rec.pos);
    if (t === 'EXPWOP') delete rec.itm.iamt;
  } else if (k === 'exp') {
    const t = str(R('Export Type')).toUpperCase();
    if (t !== 'WPAY' && t !== 'WOPAY') e.push('Export type must be WPAY or WOPAY');
    rec.typ = t;
    rec.num = inv('Invoice number', R('Invoice Number'));
    rec.dt = dt('Invoice date', R('Invoice date'));
    rec.val = amt('Invoice value', R('Invoice Value'));
    rec.pc = str(R('Port Code')).toUpperCase();
    if (rec.pc && !/^[A-Z0-9]{6}$/.test(rec.pc)) e.push('Port code must be 6 characters');
    rec.sb = str(R('Shipping Bill Number'));
    if (rec.sb && !/^\d{1,7}$/.test(rec.sb)) {
      e.push('Shipping bill number must be numeric, up to 7 digits');
    }
    rec.sd = R('Shipping Bill Date') ? pd(R('Shipping Bill Date')) : null;
    if (R('Shipping Bill Date') && !rec.sd) e.push('Shipping bill date is not a valid date');
    const tv = amt('Taxable value', R('Taxable Value'));
    rec.itm = tax({ tv, cs: n2(R('Cess Amount')), forceInter: true }, rate(R('Rate')), '');
    if (rec.typ === 'WOPAY') delete rec.itm.iamt;
  }

  rec.tv = rec.tv !== undefined ? rec.tv : rec.itm ? rec.itm.txval : 0;
  return { rec, e };
}

function rowsFromAOA(aoa: unknown[][], k: SectionKey): RowRecord[] | null {
  const H = SEC[k].headers;
  const nh = H.map(norm);
  let hi = -1;
  let map: number[] = [];
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const row = Array.isArray(aoa[i]) ? aoa[i] : [];
    const c = row.map(norm);
    const m = nh.map((h) => c.indexOf(h));
    if (m.filter((x) => x >= 0).length >= Math.max(3, nh.length - 2)) {
      hi = i;
      map = m;
      break;
    }
  }
  if (hi < 0) return null;
  const out: RowRecord[] = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const a = aoa[i];
    if (!a || a.every((v) => v === '' || v == null)) continue;
    const o: RowRecord = {};
    H.forEach((h, j) => {
      const raw = map[j] >= 0 ? a[map[j]] : '';
      o[h] = raw == null ? '' : (raw as string | number);
    });
    out.push(o);
  }
  return out;
}

function buildGstr1Json(
  gstin: string,
  fp: string,
  skipErrors: boolean,
  res: Partial<Record<SectionKey, CheckedRowResult[]>>
) {
  const out: Record<string, unknown> = {
    gstin: gstin.trim().toUpperCase(),
    fp: fp.trim(),
  };

  const good = (k: SectionKey) =>
    (res[k] || [])
      .filter((x) => !x.blank && (skipErrors ? !x.e.length : true))
      .map((x) => x.rec);

  const grp = (arr: ParsedRecord[], key: keyof ParsedRecord) => {
    const m: Record<string, ParsedRecord[]> = {};
    arr.forEach((r) => {
      const kv = String(r[key] || '');
      (m[kv] = m[kv] || []).push(r);
    });
    return m;
  };

  const item = (r: ParsedRecord, n: number) => ({ num: n, itm_det: r.itm });

  const b2b = good('b2b');
  if (b2b.length) {
    out.b2b = Object.entries(grp(b2b, 'ctin')).map(([ctin, l]) => ({
      ctin,
      inv: Object.entries(grp(l, 'num')).map(([num, xs]) => {
        const x = xs[0];
        const o: Record<string, unknown> = {
          inum: num,
          idt: x.dt,
          val: x.val,
          pos: x.pos,
          rchrg: x.rchrg,
          inv_typ: x.inv_typ,
          itms: xs.map((y, i) => item(y, i + 1)),
        };
        if (x.etin) o.etin = x.etin;
        return o;
      }),
    }));
  }

  const b2cl = good('b2cl');
  if (b2cl.length) {
    out.b2cl = Object.entries(grp(b2cl, 'pos')).map(([pos, l]) => ({
      pos,
      inv: Object.entries(grp(l, 'num')).map(([num, xs]) => {
        const x = xs[0];
        const o: Record<string, unknown> = {
          inum: num,
          idt: x.dt,
          val: x.val,
          itms: xs.map((y, i) => item(y, i + 1)),
        };
        if (x.etin) o.etin = x.etin;
        return o;
      }),
    }));
  }

  const b2cs = good('b2cs');
  if (b2cs.length) {
    const m: Record<
      string,
      {
        sply_ty: string;
        rt: number;
        typ: string;
        pos: string;
        txval: number;
        iamt?: number;
        camt?: number;
        samt?: number;
        csamt?: number;
        etin?: string;
        _i: boolean;
      }
    > = {};
    b2cs.forEach((r) => {
      const key = [r.pos, r.rt, r.typ, r.etin].join('|');
      const isInter = Boolean(r.inter);
      const o =
        m[key] ||
        (m[key] = {
          sply_ty: isInter ? 'INTER' : 'INTRA',
          rt: r.rt || 0,
          typ: r.typ || 'OE',
          pos: r.pos || '',
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
          _i: isInter,
        });
      if (r.typ === 'E' && r.etin) o.etin = r.etin;
      const tv = r.tv || 0;
      const rt = r.rt || 0;
      o.txval = n2(o.txval + tv);
      if (isInter) {
        o.iamt = n2((o.iamt || 0) + (tv * rt) / 100);
      } else {
        o.camt = n2((o.camt || 0) + (tv * rt) / 200);
        o.samt = o.camt;
      }
      o.csamt = n2((o.csamt || 0) + (r.cs || 0));
    });
    out.b2cs = Object.values(m).map((o) => {
      const { _i, ...rest } = o;
      if (_i) {
        delete rest.camt;
        delete rest.samt;
      } else {
        delete rest.iamt;
      }
      if (!rest.csamt) delete rest.csamt;
      return rest;
    });
  }

  const cdnr = good('cdnr');
  if (cdnr.length) {
    out.cdnr = Object.entries(grp(cdnr, 'ctin')).map(([ctin, l]) => ({
      ctin,
      nt: l.map((x) => ({
        ntty: x.ntty,
        nt_num: x.num,
        nt_dt: x.dt,
        val: x.val,
        pos: x.pos,
        rchrg: x.rchrg,
        inv_typ: x.inv_typ,
        itms: [item(x, 1)],
      })),
    }));
  }

  const cdnur = good('cdnur');
  if (cdnur.length) {
    out.cdnur = cdnur.map((x) => ({
      typ: x.typ,
      ntty: x.ntty,
      nt_num: x.num,
      nt_dt: x.dt,
      val: x.val,
      pos: x.pos,
      itms: [item(x, 1)],
    }));
  }

  const exp = good('exp');
  if (exp.length) {
    out.exp = Object.entries(grp(exp, 'typ')).map(([exp_typ, l]) => ({
      exp_typ,
      inv: Object.entries(grp(l, 'num')).map(([num, xs]) => {
        const x = xs[0];
        const o: Record<string, unknown> = {
          inum: num,
          idt: x.dt,
          val: x.val,
          itms: xs.map((y) => {
            const d: Record<string, number> = {
              txval: y.itm?.txval ?? 0,
              rt: y.itm?.rt ?? 0,
            };
            if (y.itm?.iamt != null) d.iamt = y.itm.iamt;
            if (y.itm?.csamt) d.csamt = y.itm.csamt;
            return d;
          }),
        };
        if (x.pc) o.sbpcode = x.pc;
        if (x.sb) o.sbnum = x.sb;
        if (x.sd) o.sbdt = x.sd;
        return o;
      }),
    }));
  }

  return out;
}

function countJsonEntries(o: Record<string, unknown>): number {
  let n = 0;
  for (const k of Object.keys(o)) {
    const val = o[k];
    if (!Array.isArray(val)) continue;
    val.forEach((e: { inv?: unknown[]; nt?: unknown[] }) => {
      const a = e.inv || e.nt;
      n += a ? a.length : 1;
    });
  }
  return n;
}

function workbookFromData(d: Partial<Record<SectionKey, RowRecord[]>>) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['GSTR-1 Excel Workbook - Help'],
      [
        'Fill each sheet from row 5. Column headings are in row 4; do not change them. Enter dates as dd-mm-yyyy and place of supply as code-name (for example 29-Karnataka).',
      ],
      ['Upload this file in the web tool, correct the rows shown in red, then generate the JSON.'],
    ]),
    'Help Instruction'
  );
  SECTION_KEYS.forEach((k) => {
    const H = SEC[k].headers;
    const rows = (d[k] || [])
      .filter((r) => !isBlank(k, r))
      .map((r) => H.map((h) => dv(h, r[h])));
    const ws = XLSX.utils.aoa_to_sheet([[`Summary for ${SEC[k].label}`], [], [], H, ...rows]);
    ws['!cols'] = H.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, SEC[k].sheets[0]);
  });
  return wb;
}

function triggerBlobDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const inr = (v: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GSTR1_DRAFT_KEY = 'vcpl_gstr1_draft_v1';
const GSTR1_PROFILES_KEY = 'vcpl_gstr1_profiles_v1';
const GSTR1_RETURNS_KEY = 'vcpl_gstr1_returns_v1';

interface Gstr1DraftState {
  gstin: string;
  fp: string;
  skipErrors: boolean;
  cur: SectionKey;
  data: Partial<Record<SectionKey, RowRecord[]>>;
  updatedAt: string;
}

interface Gstr1TaxpayerProfile {
  id: string;
  name: string;
  gstin: string;
  defaultFp: string;
  skipErrors: boolean;
  updatedAt: string;
}

interface Gstr1ReturnSnapshot {
  id: string;
  label: string;
  gstin: string;
  fp: string;
  savedAt: string;
  recordCount: number;
  errorCount: number;
  taxableTotal: number;
  taxTotal: number;
  data: Partial<Record<SectionKey, RowRecord[]>>;
}

interface Gstr1VaultBackup {
  app: 'vcpl-gstr1-vault';
  version: 1;
  exportedAt: string;
  draft?: Gstr1DraftState;
  profiles?: Gstr1TaxpayerProfile[];
  returns?: Gstr1ReturnSnapshot[];
}

function loadInitialGstr1Draft(): Gstr1DraftState {
  const saved = safeReadStorage<Partial<Gstr1DraftState> | null>(GSTR1_DRAFT_KEY, null);
  const validCur =
    saved?.cur && SECTION_KEYS.includes(saved.cur) ? saved.cur : 'b2b';
  return {
    gstin: typeof saved?.gstin === 'string' ? saved.gstin : '',
    fp: typeof saved?.fp === 'string' ? saved.fp : '',
    skipErrors: typeof saved?.skipErrors === 'boolean' ? saved.skipErrors : true,
    cur: validCur,
    data: saved?.data && typeof saved.data === 'object' ? saved.data : {},
    updatedAt: typeof saved?.updatedAt === 'string' ? saved.updatedAt : '',
  };
}

export const Gstr1ReturnPrepView: React.FC<Gstr1ReturnPrepViewProps> = ({ tool, onBack }) => {
  const initialDraft = useMemo(() => loadInitialGstr1Draft(), []);
  const [gstin, setGstin] = useState(initialDraft.gstin);
  const [fp, setFp] = useState(initialDraft.fp);
  const [skipErrors, setSkipErrors] = useState(initialDraft.skipErrors);
  const [data, setData] = useState<Partial<Record<SectionKey, RowRecord[]>>>(initialDraft.data);
  const [cur, setCur] = useState<SectionKey>(initialDraft.cur);
  const [fillColIdx, setFillColIdx] = useState<number>(0);
  const [fillVal, setFillVal] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Client-Side Browser Storage Vault (Zero Server / Zero Database)
  const [profiles, setProfiles] = useState<Gstr1TaxpayerProfile[]>(() =>
    safeReadStorage<Gstr1TaxpayerProfile[]>(GSTR1_PROFILES_KEY, [])
  );
  const [savedReturns, setSavedReturns] = useState<Gstr1ReturnSnapshot[]>(() =>
    safeReadStorage<Gstr1ReturnSnapshot[]>(GSTR1_RETURNS_KEY, [])
  );
  const [activeProfileId, setActiveProfileId] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [vaultOpen, setVaultOpen] = useState(true);
  const [confirmWipeVault, setConfirmWipeVault] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(
    initialDraft.updatedAt || new Date().toISOString()
  );

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'neutral' | 'ok' | 'warn';
  }>({
    text: 'Enter your GSTIN, return period (MMYYYY) and upload a file or paste rows. All entries save automatically inside your browser.',
    tone: 'neutral',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const vaultBackupInputRef = useRef<HTMLInputElement>(null);

  // Auto-save working draft to user's browser localStorage (zero server traffic)
  useEffect(() => {
    const nowIso = new Date().toISOString();
    const ok = safeWriteStorage(GSTR1_DRAFT_KEY, {
      gstin,
      fp,
      skipErrors,
      cur,
      data,
      updatedAt: nowIso,
    } satisfies Gstr1DraftState);
    if (ok) {
      setLastAutoSavedAt(nowIso);
    }
  }, [gstin, fp, skipErrors, cur, data]);

  useEffect(() => {
    safeWriteStorage(GSTR1_PROFILES_KEY, profiles);
  }, [profiles]);

  useEffect(() => {
    safeWriteStorage(GSTR1_RETURNS_KEY, savedReturns);
  }, [savedReturns]);

  const normalizedGstin = gstin.trim().toUpperCase();
  const fpParsed = useMemo(() => parseFpInfo(fp), [fp]);
  const gstinInvalid = Boolean(normalizedGstin) && !GSTIN_RE.test(normalizedGstin);
  const fpInvalid = Boolean(fp.trim()) && !fpParsed;

  const res = useMemo<Partial<Record<SectionKey, CheckedRowResult[]>>>(() => {
    const out: Partial<Record<SectionKey, CheckedRowResult[]>> = {};
    SECTION_KEYS.forEach((k) => {
      const list = data[k];
      if (!list) return;
      const checked = list.map((r) =>
        isBlank(k, r)
          ? ({ rec: {}, e: [], blank: true } as CheckedRowResult)
          : checkRow(k, r, normalizedGstin, fpParsed)
      );
      if (k !== 'b2cs') {
        const seen: Record<string, number> = {};
        checked.forEach((x) => {
          const key = `${x.rec.ctin || ''}|${x.rec.num || ''}${
            k === 'cdnr' || k === 'cdnur' ? `|${x.rec.ntty || ''}` : ''
          }`;
          if (x.rec.num) {
            if (seen[key]) x.e.push('Duplicate document number');
            seen[key] = 1;
          }
        });
      }
      out[k] = checked;
    });
    return out;
  }, [data, fpParsed, normalizedGstin]);

  const totals = useMemo(() => {
    let rows = 0;
    let tv = 0;
    let tx = 0;
    let er = 0;
    SECTION_KEYS.forEach((k) => {
      (res[k] || []).forEach((x) => {
        if (x.blank) return;
        rows++;
        if (x.e.length) {
          er++;
        } else {
          tv += x.rec.tv || 0;
          const i = x.rec.itm;
          if (i) {
            tx += (i.iamt || 0) + (i.camt || 0) + (i.samt || 0) + (i.csamt || 0);
          } else if (k === 'b2cs') {
            const rt = x.rec.rt || 0;
            const rtv = x.rec.tv || 0;
            tx += (rtv * rt) / 100 + (x.rec.cs || 0);
          }
        }
      });
    });
    return { rows, tv, tx, er };
  }, [res]);

  const hasAnySection = useMemo(
    () => SECTION_KEYS.some((k) => Boolean(data[k]?.length)),
    [data]
  );

  const canGenerateJson =
    GSTIN_RE.test(normalizedGstin) && Boolean(fpParsed) && totals.rows > 0;

  const currentHeaders = SEC[cur].headers;
  const currentRows = data[cur] || [];
  const currentResults = res[cur] || [];

  const sectionErrorList = useMemo(() => {
    const lst: string[] = [];
    currentResults.forEach((x, i) => {
      x.e.forEach((m) => lst.push(`Row ${i + 1}: ${m}`));
    });
    return lst;
  }, [currentResults]);

  const handleLoadFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextData: Partial<Record<SectionKey, RowRecord[]>> = { ...data };
    let firstLoaded: SectionKey | null = null;
    const notes: string[] = [];

    for (const f of Array.from(files)) {
      try {
        const buf = await f.arrayBuffer();
        const isCsv = /\.csv$/i.test(f.name);
        const wb = XLSX.read(buf, isCsv ? { type: 'array', raw: true } : { type: 'array' });
        let found = 0;
        for (const k of SECTION_KEYS) {
          let ws: XLSX.WorkSheet | null = null;
          if (isCsv) {
            const base = f.name.toLowerCase().replace(/\.csv$/, '');
            if (SEC[k].sheets.includes(base)) ws = wb.Sheets[wb.SheetNames[0]];
          } else {
            const nm = wb.SheetNames.find((n) =>
              SEC[k].sheets.includes(n.trim().toLowerCase())
            );
            if (nm) ws = wb.Sheets[nm];
          }
          if (!ws) continue;
          const aoa = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            raw: true,
            defval: '',
          }) as unknown[][];
          const rows = rowsFromAOA(aoa, k);
          if (rows === null) {
            notes.push(
              `Sheet "${SEC[k].label}" in ${f.name}: column headings do not match the GSTR-1 V2.2 template.`
            );
            continue;
          }
          nextData[k] = rows;
          if (!firstLoaded) firstLoaded = k;
          found++;
        }
        if (!found && notes.length === 0) {
          notes.push(
            `${f.name}: no recognised section found. Use a GSTR-1 V2.2 workbook or CSV names such as b2b.csv.`
          );
        }
      } catch {
        notes.push(`Could not read ${f.name}. Please verify it is a valid .xlsx, .xls, or .csv file.`);
      }
    }

    setData(nextData);
    if (firstLoaded) setCur(firstLoaded);
    if (notes.length > 0) {
      setStatusMessage({ text: notes.join(' '), tone: 'warn' });
    } else {
      setStatusMessage({
        text: 'Workbook / CSV data loaded locally into the audit grid.',
        tone: 'ok',
      });
    }
  }, [data]);

  const handleCellChange = (rowIdx: number, header: string, value: string) => {
    setData((prev) => {
      const sectionRows = [...(prev[cur] || [])];
      const existing = { ...(sectionRows[rowIdx] || newRow(cur)) };
      existing[header] = value;

      if (header === 'GSTIN/UIN of Recipient') {
        const matchedState = STATES.find(
          (st) => st.slice(0, 2) === value.trim().slice(0, 2)
        );
        if (matchedState && !str(existing['Place Of Supply'])) {
          existing['Place Of Supply'] = matchedState;
        }
      }

      sectionRows[rowIdx] = existing;
      return { ...prev, [cur]: sectionRows };
    });
  };

  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>,
    r0: number,
    c0: number
  ) => {
    const tx = e.clipboardData?.getData('text') || '';
    if (!/[\t\n]/.test(tx.trim())) return;
    e.preventDefault();

    const lines = tx.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    setData((prev) => {
      const nextRows = [...(prev[cur] || [])];
      lines.forEach((ln, i) => {
        while (nextRows.length <= r0 + i) nextRows.push(newRow(cur));
        const rowCopy = { ...nextRows[r0 + i] };
        ln.split('\t').forEach((val, j) => {
          if (c0 + j < currentHeaders.length) {
            const hdr = currentHeaders[c0 + j];
            rowCopy[hdr] = val.trim();
            if (hdr === 'GSTIN/UIN of Recipient') {
              const matchedState = STATES.find(
                (st) => st.slice(0, 2) === val.trim().slice(0, 2)
              );
              if (matchedState && !str(rowCopy['Place Of Supply'])) {
                rowCopy['Place Of Supply'] = matchedState;
              }
            }
          }
        });
        nextRows[r0 + i] = rowCopy;
      });
      return { ...prev, [cur]: nextRows };
    });
  };

  const handleAddRows = (count: number) => {
    setData((prev) => {
      const next = [...(prev[cur] || [])];
      for (let i = 0; i < count; i++) next.push(newRow(cur));
      return { ...prev, [cur]: next };
    });
  };

  const handleDeleteRow = (rowIdx: number) => {
    setData((prev) => {
      const next = [...(prev[cur] || [])];
      next.splice(rowIdx, 1);
      return { ...prev, [cur]: next };
    });
  };

  const handleClearSection = () => {
    setData((prev) => {
      const next = { ...prev };
      delete next[cur];
      return next;
    });
  };

  const handleFillColumn = (onlyBlank: boolean) => {
    const colHeader = currentHeaders[fillColIdx] ?? currentHeaders[0];
    if (!colHeader) return;
    setData((prev) => {
      const rows = prev[cur] || [];
      if (rows.length === 0) return prev;
      const updated = rows.map((r) => {
        if (!onlyBlank || str(r[colHeader]) === '') {
          return { ...r, [colHeader]: fillVal };
        }
        return r;
      });
      return { ...prev, [cur]: updated };
    });
  };

  // Browser Vault Handlers
  const handleSaveProfile = () => {
    const cleanName =
      newProfileName.trim() ||
      (normalizedGstin ? `Client · ${normalizedGstin}` : `Taxpayer ${profiles.length + 1}`);
    const entry: Gstr1TaxpayerProfile = {
      id: `gprof_${Date.now()}`,
      name: cleanName,
      gstin: normalizedGstin,
      defaultFp: fp.trim(),
      skipErrors,
      updatedAt: new Date().toISOString(),
    };
    setProfiles((prev) => [entry, ...prev]);
    setActiveProfileId(entry.id);
    setNewProfileName('');
    setStatusMessage({
      text: `Saved taxpayer profile "${cleanName}" locally in this browser.`,
      tone: 'ok',
    });
  };

  const handleUpdateActiveProfile = () => {
    if (!activeProfileId) return;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? {
              ...p,
              gstin: normalizedGstin,
              defaultFp: fp.trim(),
              skipErrors,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setStatusMessage({
      text: 'Updated selected taxpayer profile in browser storage.',
      tone: 'ok',
    });
  };

  const handleLoadProfile = (profile: Gstr1TaxpayerProfile) => {
    setGstin(profile.gstin);
    if (profile.defaultFp) setFp(profile.defaultFp);
    setSkipErrors(profile.skipErrors);
    setActiveProfileId(profile.id);
    setStatusMessage({
      text: `Loaded taxpayer profile "${profile.name}" from browser storage.`,
      tone: 'ok',
    });
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId('');
  };

  const handleSaveReturnSnapshot = () => {
    if (!hasAnySection && !normalizedGstin && !fp.trim()) {
      setStatusMessage({
        text: 'Enter a GSTIN, return period, or invoice rows before saving a return snapshot.',
        tone: 'warn',
      });
      return;
    }
    const cleanLabel =
      snapshotLabel.trim() ||
      `${normalizedGstin || 'GSTR-1 Draft'}${fp.trim() ? ` · ${fp.trim()}` : ''}`;
    const snap: Gstr1ReturnSnapshot = {
      id: `gret_${Date.now()}`,
      label: cleanLabel,
      gstin: normalizedGstin,
      fp: fp.trim(),
      savedAt: new Date().toISOString(),
      recordCount: totals.rows,
      errorCount: totals.er,
      taxableTotal: totals.tv,
      taxTotal: totals.tx,
      data: JSON.parse(JSON.stringify(data)) as Partial<Record<SectionKey, RowRecord[]>>,
    };
    setSavedReturns((prev) => [snap, ...prev].slice(0, 50));
    setSnapshotLabel('');
    setStatusMessage({
      text: `Saved return snapshot "${cleanLabel}" in your browser (${totals.rows} records).`,
      tone: 'ok',
    });
  };

  const handleLoadReturnSnapshot = (snap: Gstr1ReturnSnapshot) => {
    setGstin(snap.gstin);
    setFp(snap.fp);
    setData(JSON.parse(JSON.stringify(snap.data)) as Partial<Record<SectionKey, RowRecord[]>>);
    const firstNonEmpty = SECTION_KEYS.find((k) => Boolean(snap.data[k]?.length));
    if (firstNonEmpty) setCur(firstNonEmpty);
    setStatusMessage({
      text: `Loaded saved return "${snap.label}" (${snap.recordCount} records) from browser storage.`,
      tone: 'ok',
    });
  };

  const handleDeleteReturnSnapshot = (id: string) => {
    setSavedReturns((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetDraft = () => {
    setGstin('');
    setFp('');
    setData({});
    setCur('b2b');
    setSkipErrors(true);
    setActiveProfileId('');
    setStatusMessage({
      text: 'Working grid & inputs cleared cleanly. Your saved profiles and return snapshots remain safe in the Browser Vault.',
      tone: 'neutral',
    });
  };

  const handleExportVaultBackup = () => {
    const payload: Gstr1VaultBackup = {
      app: 'vcpl-gstr1-vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      draft: {
        gstin,
        fp,
        skipErrors,
        cur,
        data,
        updatedAt: new Date().toISOString(),
      },
      profiles,
      returns: savedReturns,
    };
    downloadJsonBackup('VCPL_GSTR1_Browser_Vault_Backup.json', payload);
    setStatusMessage({
      text: 'Exported GSTR-1 browser vault backup (.json) with profiles, saved returns & current draft.',
      tone: 'ok',
    });
  };

  const handleImportVaultBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await readJsonFile<Partial<Gstr1VaultBackup>>(file);
      if (parsed.app !== 'vcpl-gstr1-vault') {
        setStatusMessage({
          text: 'That file is not a valid VCPL GSTR-1 Browser Vault backup (.json).',
          tone: 'warn',
        });
        return;
      }
      if (Array.isArray(parsed.profiles)) setProfiles(parsed.profiles);
      if (Array.isArray(parsed.returns)) setSavedReturns(parsed.returns);
      if (parsed.draft && typeof parsed.draft === 'object') {
        if (typeof parsed.draft.gstin === 'string') setGstin(parsed.draft.gstin);
        if (typeof parsed.draft.fp === 'string') setFp(parsed.draft.fp);
        if (typeof parsed.draft.skipErrors === 'boolean') setSkipErrors(parsed.draft.skipErrors);
        if (parsed.draft.data && typeof parsed.draft.data === 'object') setData(parsed.draft.data);
      }
      setStatusMessage({
        text: `Restored ${parsed.profiles?.length ?? 0} profile(s) and ${
          parsed.returns?.length ?? 0
        } saved return(s) into this browser.`,
        tone: 'ok',
      });
    } catch {
      setStatusMessage({
        text: 'Could not read the backup JSON file. Make sure it is a valid vault backup.',
        tone: 'warn',
      });
    }
  };

  const handleWipeBrowserVault = () => {
    if (!confirmWipeVault) {
      setConfirmWipeVault(true);
      window.setTimeout(() => setConfirmWipeVault(false), 4500);
      return;
    }
    safeRemoveStorage(GSTR1_DRAFT_KEY);
    safeRemoveStorage(GSTR1_PROFILES_KEY);
    safeRemoveStorage(GSTR1_RETURNS_KEY);
    setProfiles([]);
    setSavedReturns([]);
    setGstin('');
    setFp('');
    setData({});
    setActiveProfileId('');
    setConfirmWipeVault(false);
    setStatusMessage({
      text: 'All GSTR-1 browser data (draft, taxpayer profiles, and return snapshots) has been cleared from this browser.',
      tone: 'neutral',
    });
  };

  const handleDownloadWorkbook = (filename: string, sourceData: Partial<Record<SectionKey, RowRecord[]>>) => {
    const wb = workbookFromData(sourceData);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerBlobDownload(
      filename,
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
  };

  const handleDownloadBlankCsv = () => {
    triggerBlobDownload(
      `${cur}.csv`,
      new Blob([`\uFEFF${SEC[cur].headers.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' })
    );
  };

  const handleGenerateJson = () => {
    if (!GSTIN_RE.test(normalizedGstin) || !fpParsed) {
      setStatusMessage({
        text: 'Enter a valid 15-character GSTIN and MMYYYY return period before generating JSON.',
        tone: 'warn',
      });
      return;
    }
    if (totals.er > 0 && !skipErrors) {
      setStatusMessage({
        text: 'Fix the rows highlighted in red or enable "Leave out rows with errors" before generating JSON.',
        tone: 'warn',
      });
      return;
    }

    const built = buildGstr1Json(normalizedGstin, fp, skipErrors, res);
    const txt = JSON.stringify(built);
    const entryCount = countJsonEntries(built);

    if (!entryCount) {
      setStatusMessage({
        text: 'No valid records available to export into GSTR-1 JSON.',
        tone: 'warn',
      });
      return;
    }

    let note = `${entryCount} documents/entries written to GSTR1_${built.gstin}_${built.fp}.json.`;
    if (entryCount > 19000 || txt.length > 5 * 1024 * 1024) {
      note +=
        ' Warning: the GST portal accepts at most 19,000 items or 5 MB per upload; split this file before uploading.';
    }
    if (totals.er > 0) {
      note += ` ${totals.er} row(s) with errors were excluded.`;
    }
    setStatusMessage({
      text: note,
      tone: entryCount > 19000 || txt.length > 5 * 1024 * 1024 ? 'warn' : 'ok',
    });

    triggerBlobDownload(
      `GSTR1_${built.gstin}_${built.fp}.json`,
      new Blob([txt], { type: 'application/json' })
    );
  };

  const safeFillIdx = fillColIdx < currentHeaders.length ? fillColIdx : 0;

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-7 space-y-6 shadow-[0_4px_0_#2F3E4E]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E]/30 text-[#2F3E4E]">
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.categoryName || 'GST Utilities'} · {tool?.code || 'GS-01'}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#FEF2C8] border border-[#2F3E4E]/25 text-[#2F3E4E]">
              Form GSTR-1 · V2.2 Offline
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#12805C]/40 text-[#12805C]">
              <HardDrive className="w-3 h-3" aria-hidden="true" />
              <span>100% Browser Storage · Zero Server</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
            {tool?.title || 'GSTR-1 Return Preparation Tool'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] max-w-3xl leading-relaxed">
            Upload your GSTR-1 Excel workbook (V2.2 layout) or section CSV files, or paste rows
            directly from Excel. All entries, client GSTIN profiles, and monthly return snapshots
            stay 100% locally inside your browser—nothing is stored on any server or database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveReturnSnapshot}
            className="px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Return in Browser</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadWorkbook('GSTR1_Blank_Template.xlsx', {})}
            className="px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#2F3E4E]" aria-hidden="true" />
            <span>Blank Template</span>
          </button>

          <button
            type="button"
            onClick={handleResetDraft}
            className="px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear Grid</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Browser-Only Vault: Auto-Save, Taxpayer Profiles, Monthly Returns & Portable Backup */}
      <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-[#2F3E4E]" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-sm text-[#2F3E4E]">
              Browser Storage Vault (Saved on Your Device Only)
            </h2>
            <span className="text-xs text-[#12805C] font-semibold inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Auto-saved in this browser ({formatShortSavedTime(lastAutoSavedAt)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={vaultBackupInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportVaultBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportVaultBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Vault (.json)</span>
            </button>
            <button
              type="button"
              onClick={() => vaultBackupInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#CEE5DC] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restore Vault</span>
            </button>
            <button
              type="button"
              onClick={handleWipeBrowserVault}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] text-xs font-bold cursor-pointer whitespace-nowrap transition ${
                confirmWipeVault
                  ? 'border-red-700 bg-red-600 text-white'
                  : 'border-red-700/40 bg-red-50 hover:bg-red-100 text-red-800'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{confirmWipeVault ? 'Click Again to Wipe Browser Data' : 'Clear Browser Data'}</span>
            </button>
            <button
              type="button"
              onClick={() => setVaultOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <span>{vaultOpen ? 'Hide Vault' : `Show Vault (${profiles.length} / ${savedReturns.length})`}</span>
            </button>
          </div>
        </div>

        {vaultOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[#2F3E4E]/15">
            {/* Saved Taxpayer / Client Profiles */}
            <div className="rounded-xl bg-[#FFFDF5] border border-[#2F3E4E]/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-display font-extrabold text-[#2F3E4E]">
                  Saved Taxpayer / Client GSTIN Profiles ({profiles.length})
                </p>
                {activeProfileId && (
                  <button
                    type="button"
                    onClick={handleUpdateActiveProfile}
                    className="px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    Update Selected
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Client or branch name (e.g. Branch 1 GSTIN)"
                  autoComplete="off"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white text-xs text-[#2F3E4E]"
                />
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer shrink-0"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save Profile</span>
                </button>
              </div>
              {profiles.length === 0 ? (
                <p className="text-[11px] text-[#64748B]">
                  No profiles saved yet. Enter your GSTIN below and save a reusable profile in your
                  browser for instant one-click loading next time.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {profiles.map((p) => {
                    const isSelected = activeProfileId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                          isSelected
                            ? 'bg-[#FEF2C8] border-[#2F3E4E]'
                            : 'bg-white border-[#2F3E4E]/20'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#2F3E4E] truncate">{p.name}</p>
                          <p className="font-mono text-[10px] text-[#64748B] truncate">
                            {p.gstin || 'No GSTIN'}
                            {p.defaultFp ? ` · ${p.defaultFp}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadProfile(p)}
                            className="px-2 py-1 rounded bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id)}
                            aria-label={`Delete profile ${p.name}`}
                            className="p-1 rounded text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saved Return Filing Snapshots */}
            <div className="rounded-xl bg-[#FFFDF5] border border-[#2F3E4E]/25 p-3.5 space-y-2.5">
              <p className="text-xs font-display font-extrabold text-[#2F3E4E]">
                Saved Monthly Returns &amp; Snapshots ({savedReturns.length})
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="Optional snapshot label (e.g. Oct 2026 Final)"
                  autoComplete="off"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white text-xs text-[#2F3E4E]"
                />
                <button
                  type="button"
                  onClick={handleSaveReturnSnapshot}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save Return</span>
                </button>
              </div>
              {savedReturns.length === 0 ? (
                <p className="text-[11px] text-[#64748B]">
                  Save any prepared GSTR-1 return right inside this browser to reopen, revise, or
                  re-export Excel / JSON in future visits.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {savedReturns.map((snap) => (
                    <div
                      key={snap.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/20 bg-white text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#2F3E4E] truncate">{snap.label}</p>
                        <p className="font-mono text-[10px] text-[#64748B] truncate tabular-nums">
                          {snap.recordCount} rows · ₹{inr(snap.taxableTotal)} ·{' '}
                          {formatShortSavedTime(snap.savedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadReturnSnapshot(snap)}
                          className="px-2 py-1 rounded bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadWorkbook(
                              `GSTR1_${snap.gstin || 'Saved'}_${snap.fp || 'Return'}.xlsx`,
                              snap.data
                            )
                          }
                          title="Export saved snapshot as Excel"
                          className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-[#FEF2C8] hover:bg-[#F9C80E] text-[#2F3E4E] text-[11px] font-bold cursor-pointer"
                        >
                          XLSX
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReturnSnapshot(snap.id)}
                          aria-label={`Delete saved return ${snap.label}`}
                          className="p-1 rounded text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4-Step Guide Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { step: '1', text: 'Download blank V2.2 Excel template' },
          { step: '2', text: 'Fill, paste from Excel, or upload workbook' },
          { step: '3', text: 'Fix any rows highlighted in red' },
          { step: '4', text: 'Generate GSTR-1 JSON for GST portal' },
        ].map((item) => (
          <div
            key={item.step}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FEF2C8]/75 border border-[#2F3E4E]/20 text-xs font-semibold text-[#2F3E4E]"
          >
            <span className="w-5 h-5 rounded-md bg-[#2F3E4E] text-[#F9C80E] font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0">
              {item.step}
            </span>
            <span className="leading-snug">{item.text}</span>
          </div>
        ))}
      </div>

      {/* GSTIN, Return Period & Options */}
      <div className="bg-[#FEF2C8]/45 border-[1.5px] border-[#2F3E4E] rounded-xl p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <label className="lg:col-span-4 flex flex-col gap-1.5 text-xs font-bold text-[#2F3E4E]">
            <span>GSTIN of Taxpayer (15 chars)</span>
            <input
              type="text"
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="Enter 15-character GSTIN"
              autoComplete="off"
              className={`w-full px-3 py-2.5 rounded-lg border-[1.5px] bg-white font-mono text-sm text-[#2F3E4E] uppercase placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 ${
                gstinInvalid
                  ? 'border-red-600 focus:ring-red-400'
                  : 'border-[#2F3E4E] focus:ring-[#F9C80E]'
              }`}
            />
          </label>

          <label className="lg:col-span-3 flex flex-col gap-1.5 text-xs font-bold text-[#2F3E4E]">
            <span>Return Period (MMYYYY)</span>
            <input
              type="text"
              maxLength={6}
              value={fp}
              onChange={(e) => setFp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="MMYYYY"
              autoComplete="off"
              className={`w-full px-3 py-2.5 rounded-lg border-[1.5px] bg-white font-mono text-sm text-[#2F3E4E] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 ${
                fpInvalid
                  ? 'border-red-600 focus:ring-red-400'
                  : 'border-[#2F3E4E] focus:ring-[#F9C80E]'
              }`}
            />
          </label>

          <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer select-none min-h-[40px]">
              <input
                type="checkbox"
                checked={skipErrors}
                onChange={(e) => setSkipErrors(e.target.checked)}
                className="w-4 h-4 accent-[#2F3E4E] cursor-pointer"
              />
              <span>Leave out rows with errors when generating JSON</span>
            </label>
          </div>
        </div>
      </div>

      {/* Dropzone & Workbook Export */}
      <div className="space-y-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleLoadFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-[#2F3E4E] bg-[#CEE5DC]/65'
              : 'border-[#2F3E4E]/45 bg-[#FFFDF5] hover:bg-[#FEF2C8]/45'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              void handleLoadFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Upload className="w-6 h-6 text-[#2F3E4E] mx-auto mb-2" aria-hidden="true" />
          <p className="font-display font-bold text-sm text-[#2F3E4E]">
            Drop your GSTR-1 Excel workbook or CSV files here, or click to browse
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Supports <span className="font-mono font-semibold text-[#2F3E4E]">.xlsx / .xls / .csv</span>{' '}
            — CSV filenames should match sections (<code>b2b.csv</code>, <code>b2cl.csv</code>,{' '}
            <code>b2cs.csv</code>, <code>cdnr.csv</code>, <code>cdnur.csv</code>, <code>exp.csv</code>)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadWorkbook('GSTR1_MyData.xlsx', data)}
            className="px-3.5 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export Current Grid to Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBlankCsv}
            className="px-3.5 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Blank {SEC[cur].label} CSV ({cur}.csv)</span>
          </button>
        </div>
      </div>

      {/* Live Summary Stat Cards */}
      {hasAnySection && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#CEE5DC]/55 border-[1.5px] border-[#2F3E4E] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Records Read
            </p>
            <p className="font-mono text-xl font-extrabold text-[#2F3E4E] mt-1 tabular-nums">
              {totals.rows}
            </p>
          </div>
          <div
            className={`rounded-xl border-[1.5px] border-[#2F3E4E] p-3.5 ${
              totals.er > 0 ? 'bg-red-50' : 'bg-[#CEE5DC]/55'
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Records With Errors
            </p>
            <p
              className={`font-mono text-xl font-extrabold mt-1 tabular-nums ${
                totals.er > 0 ? 'text-red-700' : 'text-[#12805C]'
              }`}
            >
              {totals.er}
            </p>
          </div>
          <div className="rounded-xl bg-[#FEF2C8]/75 border-[1.5px] border-[#2F3E4E] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Taxable Value (Valid)
            </p>
            <p className="font-mono text-lg sm:text-xl font-extrabold text-[#2F3E4E] mt-1 tabular-nums">
              ₹ {inr(totals.tv)}
            </p>
          </div>
          <div className="rounded-xl bg-[#FEF2C8]/75 border-[1.5px] border-[#2F3E4E] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Tax + Cess (Valid)
            </p>
            <p className="font-mono text-lg sm:text-xl font-extrabold text-[#2F3E4E] mt-1 tabular-nums">
              ₹ {inr(totals.tx)}
            </p>
          </div>
        </div>
      )}

      {/* Section Tabs & Interactive Editable Grid */}
      <div className="border-[1.5px] border-[#2F3E4E] rounded-xl bg-white overflow-hidden">
        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-[#FEF2C8]/65 border-b border-[#2F3E4E]/20">
          {SECTION_KEYS.map((k) => {
            const count = (res[k] || []).filter((x) => !x.blank).length;
            const errCount = (res[k] || []).filter((x) => x.e.length > 0).length;
            const active = cur === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setCur(k);
                  setFillColIdx(0);
                }}
                className={`inline-flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg text-xs font-display font-extrabold border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                    : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25 hover:bg-[#FEF2C8]'
                }`}
              >
                <span>{SEC[k].label}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    active ? 'text-[#FFFDF5]' : 'text-[#64748B]'
                  }`}
                >
                  {count}
                </span>
                {errCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] leading-none tabular-nums">
                    {errCount}!
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid Controls Toolbar */}
        <div className="p-3 bg-[#FFFDF5] border-b border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAddRows(1)}
              className="px-3 py-1.5 min-h-[34px] rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC]/75 hover:bg-[#CEE5DC] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddRows(10)}
              className="px-3 py-1.5 min-h-[34px] rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              + 10 Rows
            </button>
            <button
              type="button"
              onClick={handleClearSection}
              disabled={currentRows.length === 0}
              className="px-3 py-1.5 min-h-[34px] rounded-lg border border-red-700/40 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-xs font-bold text-red-800 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear {SEC[cur].label}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748B]">Fill column:</span>
            <select
              aria-label="Select column to fill"
              value={safeFillIdx}
              onChange={(e) => setFillColIdx(Number(e.target.value))}
              className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-[#2F3E4E]/40 bg-white text-xs font-semibold text-[#2F3E4E]"
            >
              {currentHeaders.map((h, j) => (
                <option key={h} value={j}>
                  {h}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={fillVal}
              onChange={(e) => setFillVal(e.target.value)}
              placeholder="Value to fill"
              className="px-2.5 py-1.5 min-h-[34px] w-32 sm:w-36 rounded-lg border border-[#2F3E4E]/40 bg-white text-xs text-[#2F3E4E]"
            />
            <button
              type="button"
              onClick={() => handleFillColumn(false)}
              className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              All Rows
            </button>
            <button
              type="button"
              onClick={() => handleFillColumn(true)}
              className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-[#2F3E4E]/50 bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              Blank Only
            </button>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-[#FEF2C8]/35 border-b border-[#2F3E4E]/10 text-[11px] text-[#475569]">
          <strong>Tip:</strong> Copy multiple cells or rows in Excel and press{' '}
          <kbd className="px-1 py-0.5 rounded bg-white border border-[#2F3E4E]/30 font-mono text-[10px]">
            Ctrl+V
          </kbd>{' '}
          inside any grid cell. Entering a recipient GSTIN automatically populates Place Of Supply
          from its 2-digit state code.
        </div>

        {/* Editable Spreadsheet Table */}
        <div className="overflow-x-auto max-h-[460px]">
          {currentRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              No rows in <strong>{SEC[cur].label}</strong> yet. Click <strong>Add Row</strong>,
              paste directly from Excel, or upload your workbook.
            </div>
          ) : (
            <table className="w-full border-collapse text-xs font-mono tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#2F3E4E] text-[#FFFDF5]">
                <tr>
                  <th className="p-2 text-center w-8 border-r border-white/15">Del</th>
                  <th className="p-2 text-center w-10 border-r border-white/15">#</th>
                  {currentHeaders.map((h) => (
                    <th
                      key={h}
                      className="px-2.5 py-2 text-left font-sans font-bold text-[11px] whitespace-nowrap border-r border-white/15 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRows.slice(0, 500).map((row, rIdx) => {
                  const rowCheck = currentResults[rIdx];
                  const hasError = Boolean(rowCheck && rowCheck.e.length > 0);
                  return (
                    <tr
                      key={rIdx}
                      title={hasError ? rowCheck?.e.join(' | ') : undefined}
                      className={`border-b border-[#2F3E4E]/15 ${
                        hasError ? 'bg-red-50/90' : rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF5]'
                      }`}
                    >
                      <td className="p-1 text-center border-r border-[#2F3E4E]/10">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          aria-label={`Delete row ${rIdx + 1}`}
                          title="Delete row"
                          className="w-6 h-6 inline-flex items-center justify-center rounded text-red-700 hover:bg-red-100 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-2 py-1 text-center text-[#64748B] font-bold border-r border-[#2F3E4E]/10">
                        {rIdx + 1}
                      </td>
                      {currentHeaders.map((h, cIdx) => {
                        const rawVal = String(dv(h, row[h]));
                        const opts = OPT[h];
                        if (opts) {
                          const choices =
                            opts.includes(rawVal) || rawVal === '' ? opts : [...opts, rawVal];
                          return (
                            <td
                              key={h}
                              className="p-0.5 border-r border-[#2F3E4E]/10 last:border-r-0 min-w-[125px]"
                            >
                              <select
                                value={rawVal}
                                onChange={(e) => handleCellChange(rIdx, h, e.target.value)}
                                onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                                className="w-full px-1.5 py-1.5 rounded bg-transparent font-sans text-xs text-[#2F3E4E] focus:bg-[#FEF2C8]/65 focus:outline-none focus:ring-1 focus:ring-[#2F3E4E]"
                              >
                                <option value=""></option>
                                {choices.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={h}
                            className="p-0.5 border-r border-[#2F3E4E]/10 last:border-r-0 min-w-[110px]"
                          >
                            <input
                              type="text"
                              value={rawVal}
                              onChange={(e) => handleCellChange(rIdx, h, e.target.value)}
                              onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                              className="w-full px-2 py-1.5 rounded bg-transparent text-xs text-[#2F3E4E] focus:bg-[#FEF2C8]/65 focus:outline-none focus:ring-1 focus:ring-[#2F3E4E]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {(currentRows.length > 500 || sectionErrorList.length > 0) && (
          <div className="p-3 bg-[#FFFDF5] border-t border-[#2F3E4E]/15 space-y-2">
            {currentRows.length > 500 && (
              <p className="text-xs font-semibold text-[#475569]">
                Showing first 500 of {currentRows.length} rows in grid (all {currentRows.length} rows
                are still validated and exported).
              </p>
            )}
            {sectionErrorList.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-300 p-3">
                <p className="text-xs font-extrabold text-red-800 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {SEC[cur].label} Validation Issues ({sectionErrorList.length})
                  </span>
                </p>
                <ul className="max-h-44 overflow-y-auto list-disc pl-5 space-y-0.5 text-xs text-red-700">
                  {sectionErrorList.slice(0, 150).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {sectionErrorList.length > 150 && (
                  <p className="text-[11px] font-semibold text-red-800 mt-1.5">
                    Showing first 150 of {sectionErrorList.length} errors.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate JSON Card */}
      <div className="rounded-xl bg-[#CEE5DC]/45 border-[1.5px] border-[#2F3E4E] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            {statusMessage.tone === 'ok' && (
              <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" aria-hidden="true" />
            )}
            {statusMessage.tone === 'warn' && (
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" aria-hidden="true" />
            )}
            <span
              className={
                statusMessage.tone === 'warn'
                  ? 'text-red-800'
                  : statusMessage.tone === 'ok'
                  ? 'text-[#12805C]'
                  : 'text-[#2F3E4E]'
              }
            >
              {statusMessage.text}
            </span>
          </div>
          <p className="text-[11px] text-[#475569]">
            Covers B2B/SEZ/DE, B2CL, B2CS, CDNR, CDNUR and Exports. Check generated files on the
            GST portal before filing.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateJson}
          disabled={!canGenerateJson}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-45 disabled:hover:bg-[#2F3E4E] text-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#1A242F] text-sm font-display font-extrabold whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed transition-all"
        >
          <FileJson className="w-4 h-4" aria-hidden="true" />
          <span>Generate GSTR-1 JSON</span>
        </button>
      </div>
    </div>
  );
};
