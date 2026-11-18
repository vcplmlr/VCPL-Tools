import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DirectoryAdminPanelProps {
  dataset: 'pincodes' | 'ifsc' | 'rto';
  onImportCompleted?: () => void;
}

interface AdminImportHistoryItem {
  id: number;
  dataset: string;
  source_label: string;
  format: string;
  version_tag: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  missing_fields_rows: number;
  failed_rows: number;
  error_samples_json: string;
  imported_by: string;
  imported_at: string;
}

interface ImportReportSummary {
  dataset: string;
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
  errorSamples: Array<{ row: number; reason: string; identifier?: string }>;
  importedAt: string;
}

const ADMIN_TOKEN_STORAGE_KEY = 'vcpl_admin_session_token';

async function fetchJsonSafe<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<{ ok: boolean; status: number; data: T | null; errorText: string | null }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const rawText = await res.text();
    let parsed: T | null = null;
    try {
      parsed = rawText ? (JSON.parse(rawText) as T) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const apiErr =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error?: unknown }).error || '')
          : '';
      const fallbackMsg =
        apiErr ||
        (res.status === 502 || res.status === 503 || res.status === 504
          ? `Server is temporarily busy or restarting (HTTP ${res.status}). Please retry.`
          : `Request failed (HTTP ${res.status}).`);
      return { ok: false, status: res.status, data: parsed, errorText: fallbackMsg };
    }

    if (parsed === null) {
      return {
        ok: false,
        status: res.status,
        data: null,
        errorText: 'Unexpected non-JSON response received from API server.',
      };
    }

    return { ok: true, status: res.status, data: parsed, errorText: null };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        data: null,
        errorText: 'Request timed out while waiting for server response. Please retry.',
      };
    }
    return {
      ok: false,
      status: 0,
      data: null,
      errorText: 'Unable to reach server API endpoint. Check connection and retry.',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Fast RFC-4180 CSV parser that handles UTF-8 BOM, quoted commas, escaped quotes (""),
 * embedded newlines inside quotes, and CRLF without freezing the UI thread.
 */
function parseCsvRowsFast(rawText: string): Record<string, unknown>[] {
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentCell);
      currentCell = '';
      if (currentRow.length > 1 || currentRow[0].trim() !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.length > 1 || currentRow[0].trim() !== '') {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, unknown>[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cols = rows[r];
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c += 1) {
      if (headers[c]) {
        obj[headers[c]] = cols[c] ?? '';
      }
    }
    out.push(obj);
  }
  return out;
}

export function DirectoryAdminPanel({
  dataset,
  onImportCompleted,
}: DirectoryAdminPanelProps) {
  const [passcode, setPasscode] = useState('');
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [overview, setOverview] = useState<{
    pinQuality?: Record<string, number>;
    ifscQuality?: Record<string, number>;
    rtoQuality?: Record<string, number>;
    imports: AdminImportHistoryItem[];
  } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [sourceLabel, setSourceLabel] = useState(
    dataset === 'pincodes'
      ? 'India Post Official Update'
      : dataset === 'ifsc'
      ? 'RBI / NPCI Branch Update'
      : 'Parivahan / State Transport CSV Import'
  );
  const [versionTag, setVersionTag] = useState(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReportSummary | null>(null);
  const [syncingOfficial, setSyncingOfficial] = useState(false);

  const clearAdminSession = useCallback(() => {
    setToken(null);
    try {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  const loadOverview = useCallback(
    async (authToken: string) => {
      setLoadingOverview(true);
      const res = await fetchJsonSafe<{
        pinQuality?: Record<string, number>;
        ifscQuality?: Record<string, number>;
        rtoQuality?: Record<string, number>;
        imports: AdminImportHistoryItem[];
      }>(
        '/api/admin/overview',
        { headers: { Authorization: `Bearer ${authToken}` } },
        15000
      );

      if (res.status === 401) {
        clearAdminSession();
        setAuthError('Admin session expired. Please unlock again.');
        setLoadingOverview(false);
        return;
      }

      if (!res.ok || !res.data) {
        setImportError(res.errorText || 'Unable to load admin overview.');
      } else {
        setOverview(res.data);
      }
      setLoadingOverview(false);
    },
    [clearAdminSession]
  );

  useEffect(() => {
    if (token) {
      void loadOverview(token);
    }
  }, [token, loadOverview]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const requestInit: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: passcode.trim() }),
    };

    let res = await fetchJsonSafe<{ token?: string }>(
      '/api/admin/auth',
      requestInit,
      12000
    );

    // Retry once transparently if proxy/dev server was mid-restart
    if (!res.ok && (res.status === 0 || res.status >= 500)) {
      await new Promise((r) => window.setTimeout(r, 600));
      res = await fetchJsonSafe<{ token?: string }>('/api/admin/auth', requestInit, 12000);
    }

    setAuthLoading(false);

    if (!res.ok || !res.data?.token) {
      setAuthError(res.errorText || 'Authentication failed.');
      return;
    }

    try {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.data.token);
    } catch {
      // Ignore storage restriction
    }
    setToken(res.data.token);
    setPasscode('');
  };

  const handleDownloadSampleTemplate = (fmt: 'csv' | 'json') => {
    const filename =
      dataset === 'pincodes'
        ? `sample-india-pincode-import.${fmt}`
        : dataset === 'ifsc'
        ? `sample-india-ifsc-import.${fmt}`
        : `sample-india-rto-import.${fmt}`;

    const content =
      dataset === 'pincodes'
        ? fmt === 'json'
          ? JSON.stringify(
              [
                {
                  pincode: '575001',
                  office_name: 'Mangaluru H.O',
                  office_type: 'Head Office (H.O)',
                  delivery_status: 'Delivery',
                  district: 'Dakshina Kannada',
                  state: 'Karnataka',
                  taluk: 'Mangaluru',
                  division: 'Mangalore',
                  region: 'South Karnataka',
                  circle: 'Karnataka',
                  postal_address: 'Mangaluru H.O, Mangaluru Taluk, Dakshina Kannada, Karnataka - 575001',
                  contact: '',
                },
              ],
              null,
              2
            )
          : [
              'pincode,office_name,office_type,delivery_status,district,state,taluk,division,region,circle,postal_address,contact',
              '575001,Mangaluru H.O,Head Office (H.O),Delivery,Dakshina Kannada,Karnataka,Mangaluru,Mangalore,South Karnataka,Karnataka,"Mangaluru H.O, Mangaluru Taluk, Dakshina Kannada, Karnataka - 575001",',
            ].join('\r\n')
        : dataset === 'ifsc'
        ? fmt === 'json'
          ? JSON.stringify(
              [
                {
                  ifsc: 'SBIN0000001',
                  bank_name: 'State Bank of India',
                  branch_name: 'KOLKATA MAIN',
                  address: 'SAMRIDDHI BHAVAN, 1 STRAND ROAD, KOLKATA - 700001',
                  city: 'Kolkata',
                  district: 'Kolkata',
                  state: 'West Bengal',
                  micr: '700002021',
                  bank_category: 'Public Sector Bank',
                  bank_status: 'Active',
                  upi: 1,
                  rtgs: 1,
                  neft: 1,
                  imps: 1,
                },
              ],
              null,
              2
            )
          : [
              'ifsc,bank_name,branch_name,address,city,district,state,micr,bank_category,bank_status,upi,rtgs,neft,imps',
              'SBIN0000001,State Bank of India,KOLKATA MAIN,"SAMRIDDHI BHAVAN, 1 STRAND ROAD, KOLKATA - 700001",Kolkata,Kolkata,West Bengal,700002021,Public Sector Bank,Active,1,1,1,1',
            ].join('\r\n')
        : fmt === 'json'
        ? JSON.stringify(
            [
              {
                code: 'KA-19',
                state: 'Karnataka',
                state_code: 'KA',
                office_name: 'Mangaluru RTO',
                district: 'Dakshina Kannada',
                city: 'Mangaluru',
                address: 'Regional Transport Office, Attavar, Mangaluru - 575001',
                phone: '',
                email: '',
                rto_type: 'RTO',
                status: 'active',
                note: '',
              },
            ],
            null,
            2
          )
        : [
            'code,state,state_code,office_name,district,city,address,phone,email,rto_type,status,note',
            'KA-19,Karnataka,KA,Mangaluru RTO,Dakshina Kannada,Mangaluru,"Regional Transport Office, Attavar, Mangaluru - 575001",,,RTO,active,',
          ].join('\r\n');

    const blob = new Blob([content], {
      type: fmt === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file || !token) return;
    setImportError(null);
    setImportReport(null);
    setImporting(true);
    setImportProgress(`Parsing ${file.name}...`);

    try {
      // Yield 1 frame so React paints the progress state before parsing
      await new Promise((r) => window.setTimeout(r, 16));

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let rows: Record<string, unknown>[] = [];
      let detectedFormat: 'csv' | 'xlsx' | 'json' = 'csv';

      if (ext === 'json') {
        detectedFormat = 'json';
        const text = await file.text();
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : [];
      } else if (ext === 'xlsx' || ext === 'xls') {
        detectedFormat = 'xlsx';
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.SheetNames[0];
        rows = sheet
          ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: '' })
          : [];
      } else {
        detectedFormat = 'csv';
        const text = await file.text();
        rows = parseCsvRowsFast(text);
      }

      if (rows.length === 0) {
        throw new Error('No data rows found inside the uploaded file.');
      }

      const chunkSize = 5000;
      const totalBatches = Math.ceil(rows.length / chunkSize);
      const aggregate: ImportReportSummary = {
        dataset,
        sourceLabel,
        format: detectedFormat,
        versionTag,
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

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const batchNum = Math.floor(i / chunkSize) + 1;
        setImportProgress(
          `Uploading & validating batch ${batchNum} of ${totalBatches} (${Math.min(
            i + chunkSize,
            rows.length
          ).toLocaleString('en-IN')} / ${rows.length.toLocaleString('en-IN')} rows)...`
        );

        const res = await fetchJsonSafe<{ summary?: ImportReportSummary; error?: string }>(
          `/api/admin/import/${dataset}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              format: detectedFormat,
              rows: chunk,
              sourceLabel,
              versionTag,
              skipAudit: totalBatches > 1,
            }),
          },
          60000
        );

        if (res.status === 401) {
          clearAdminSession();
          throw new Error('Admin session expired. Please unlock again.');
        }

        if (!res.ok || !res.data?.summary) {
          throw new Error(res.errorText || `Batch ${batchNum} failed`);
        }

        const s = res.data.summary;
        aggregate.insertedRows += s.insertedRows;
        aggregate.updatedRows += s.updatedRows;
        aggregate.duplicateRows += s.duplicateRows;
        aggregate.invalidRows += s.invalidRows;
        aggregate.missingFieldsRows += s.missingFieldsRows;
        aggregate.failedRows += s.failedRows;
        if (aggregate.errorSamples.length < 50 && Array.isArray(s.errorSamples)) {
          aggregate.errorSamples.push(
            ...s.errorSamples.slice(0, 50 - aggregate.errorSamples.length)
          );
        }
      }

      if (totalBatches > 1) {
        await fetchJsonSafe(
          `/api/admin/import/${dataset}/audit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(aggregate),
          },
          15000
        );
      }

      setImportReport(aggregate);
      setImportProgress('');
      await loadOverview(token);
      onImportCompleted?.();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Bulk import failed.');
      setImportProgress('');
    } finally {
      setImporting(false);
    }
  };

  const handleOfficialSync = async () => {
    if (!token) return;
    setImportError(null);
    setImportReport(null);
    setSyncingOfficial(true);
    setImportProgress(
      dataset === 'ifsc'
        ? 'Syncing full RBI / Razorpay IFSC release (~182,000+ branches). This may take 20-40 seconds...'
        : dataset === 'pincodes'
        ? 'Syncing full India Post directory (~157,000+ offices). This may take 20-40 seconds...'
        : 'Syncing built-in verified India RTO baseline records into SQLite...'
    );

    const res = await fetchJsonSafe<{ summary?: ImportReportSummary }>(
      `/api/admin/sync/${dataset}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      180000
    );

    setSyncingOfficial(false);
    setImportProgress('');

    if (res.status === 401) {
      clearAdminSession();
      setAuthError('Admin session expired. Please unlock again.');
      return;
    }

    if (!res.ok || !res.data?.summary) {
      setImportError(res.errorText || 'Official dataset sync failed.');
      return;
    }

    setImportReport(res.data.summary);
    await loadOverview(token);
    onImportCompleted?.();
  };

  if (!token) {
    return (
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
              Administrator Bulk Dataset Import &amp; Quality Console (
              {dataset === 'pincodes'
                ? 'India PIN Codes'
                : dataset === 'ifsc'
                ? 'India IFSC Branches'
                : 'India RTO Codes'}
              )
            </h3>
            <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
              Public search works without an account. Database imports, CSV/Excel/JSON batch upserts,
              and official source syncs require administrator authorization (configured via{' '}
              <code className="font-mono font-semibold">VCPL_ADMIN_PASSCODE</code> on the server).
            </p>
          </div>
        </div>

        <form onSubmit={handleAuthSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
          <label htmlFor={`admin-passcode-${dataset}`} className="sr-only">
            Administrator Passcode
          </label>
          <input
            id={`admin-passcode-${dataset}`}
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter admin passcode..."
            autoComplete="current-password"
            className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E]"
          />
          <button
            type="submit"
            disabled={authLoading || !passcode.trim()}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-50 text-[#F9C80E] text-xs font-bold border border-[#2F3E4E] whitespace-nowrap cursor-pointer"
          >
            {authLoading ? 'Verifying...' : 'Unlock Admin Import'}
          </button>
        </form>

        {authError && (
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{authError}</span>
          </p>
        )}
      </div>
    );
  }

  const quality =
    dataset === 'pincodes'
      ? overview?.pinQuality
      : dataset === 'ifsc'
      ? overview?.ifscQuality
      : overview?.rtoQuality;
  const datasetImports = (overview?.imports || []).filter((imp) => imp.dataset === dataset);

  return (
    <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#2F3E4E]/15 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] text-[#12805C] flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
              Admin Dataset Import &amp; Quality Monitor (
              {dataset === 'pincodes'
                ? 'India PIN Codes'
                : dataset === 'ifsc'
                ? 'India IFSC Branches'
                : 'India RTO Codes'}
              )
            </h3>
            <p className="text-[11px] text-[#475569] dark:text-slate-400">
              Chunked server-side SQL batch upsert, validation, duplicate detection &amp; coverage metrics
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearAdminSession}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Lock Admin Session</span>
        </button>
      </div>

      {/* Data Quality Metrics */}
      {loadingOverview ? (
        <div className="flex items-center gap-2 text-xs text-[#475569]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading SQLite data quality metrics...</span>
        </div>
      ) : quality ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {Object.entries(quality).map(([k, v]) => (
            <div
              key={k}
              className="bg-[#FEF2C8]/65 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3"
            >
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 capitalize">
                {k.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="mt-1 font-mono font-extrabold text-base text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {Number(v || 0).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Bulk Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-white dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-4">
        <div className="lg:col-span-4 space-y-1">
          <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300">
            Source Reference Label
          </label>
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-[#2F3E4E] dark:text-slate-100"
          />
        </div>

        <div className="lg:col-span-3 space-y-1">
          <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300">
            Dataset Version Tag
          </label>
          <input
            type="text"
            value={versionTag}
            onChange={(e) => setVersionTag(e.target.value)}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-xs text-[#2F3E4E] dark:text-slate-100"
          />
        </div>

        <div className="lg:col-span-5 flex flex-wrap items-center gap-2.5">
          <label
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] whitespace-nowrap ${
              importing || syncingOfficial ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Import CSV / XLSX / JSON</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              disabled={importing || syncingOfficial}
              onChange={(e) => {
                void handleFileUpload(e.target.files?.[0] || null);
                e.target.value = '';
              }}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            disabled={importing || syncingOfficial}
            onClick={() => void handleOfficialSync()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-50 text-[#FFFDF5] text-xs font-bold border border-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOfficial ? 'animate-spin' : ''}`} />
            <span>
              {syncingOfficial
                ? 'Syncing Official Feed...'
                : dataset === 'ifsc'
                ? 'Sync Razorpay Release'
                : dataset === 'pincodes'
                ? 'Sync India Post Feed'
                : 'Sync Baseline RTOs'}
            </span>
          </button>
        </div>
      </div>

      {importProgress && (
        <div className="flex items-center gap-2 text-xs font-semibold text-[#12805C] dark:text-emerald-400">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{importProgress}</span>
        </div>
      )}

      {importError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {importReport && (
        <div className="bg-[#CEE5DC]/50 dark:bg-emerald-950/30 border-[1.5px] border-[#2F3E4E] dark:border-emerald-700 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-display font-extrabold text-[#2F3E4E] dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-[#12805C]" />
            <span>
              Import Completed · {importReport.sourceLabel} ({importReport.versionTag})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono">
            <div>Total: {importReport.totalRows.toLocaleString('en-IN')}</div>
            <div className="text-[#12805C] font-bold">
              Inserted: {importReport.insertedRows.toLocaleString('en-IN')}
            </div>
            <div>Updated: {importReport.updatedRows.toLocaleString('en-IN')}</div>
            <div>Duplicates: {importReport.duplicateRows.toLocaleString('en-IN')}</div>
            <div>Invalid: {importReport.invalidRows.toLocaleString('en-IN')}</div>
            <div>Missing Fields: {importReport.missingFieldsRows.toLocaleString('en-IN')}</div>
          </div>

          {importReport.errorSamples.length > 0 && (
            <div className="pt-2 border-t border-[#2F3E4E]/15 space-y-1">
              <div className="font-bold">
                Validation Error Samples (first {importReport.errorSamples.length}):
              </div>
              <ul className="space-y-0.5 text-[11px] font-mono max-h-32 overflow-y-auto">
                {importReport.errorSamples.map((errItem, idx) => (
                  <li key={`${errItem.row}-${idx}`}>
                    Row #{errItem.row}: {errItem.reason}
                    {errItem.identifier ? ` [${errItem.identifier}]` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Import History Table */}
      {datasetImports.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <History className="w-3.5 h-3.5" />
            <span>Recent Dataset Import History</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                <tr>
                  <th className="py-2 px-3">Version</th>
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-3">Format</th>
                  <th className="py-2 px-3">Inserted / Updated</th>
                  <th className="py-2 px-3">Duplicates / Failed</th>
                  <th className="py-2 px-3">Imported At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                {datasetImports.slice(0, 8).map((imp) => (
                  <tr key={imp.id}>
                    <td className="py-2 px-3 font-mono font-bold">{imp.version_tag}</td>
                    <td className="py-2 px-3">{imp.source_label}</td>
                    <td className="py-2 px-3 uppercase font-mono">{imp.format}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">
                      +{imp.inserted_rows.toLocaleString('en-IN')} / ~
                      {imp.updated_rows.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums">
                      {imp.duplicate_rows} dup / {imp.failed_rows} fail
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {imp.imported_at.slice(0, 19).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#475569] dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#12805C] shrink-0" />
          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
          <span>
            Supported columns:{' '}
            {dataset === 'pincodes'
              ? 'pincode, office_name, office_type, delivery_status, district, state, taluk, division, region, circle, postal_address'
              : dataset === 'ifsc'
              ? 'ifsc, bank_name, branch_name, address, state, district, city, micr, bank_category, bank_status, successor_bank, upi, rtgs, neft, imps'
              : 'code (rto_code), office_name, state, state_code, district, city, address, phone, email, rto_type, status, note'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleDownloadSampleTemplate('csv')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Sample CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownloadSampleTemplate('json')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Sample JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
