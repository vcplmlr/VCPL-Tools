import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEnterpriseAuth } from '../../context/EnterpriseAuthContext.tsx';
import { uploadFileToDrive } from '../../services/googleWorkspaceApis.ts';
import { getAccessToken, googleSignIn } from '../../services/googleWorkspaceAuth.ts';

export type CentralModuleId =
  | 'document-vault'
  | 'document-studio'
  | 'auto-ledger'
  | 'vehicle-master'
  | 'registers'
  | 'reports';

export interface EnterpriseDocumentRow {
  id: string;
  module_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  approval_status: 'Draft' | 'Pending Review' | 'Approved' | 'Rejected';
  drive_file_id: string;
  drive_web_view_link: string;
  uploaded_by: string;
  uploaded_by_username: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRecordRow {
  id: string;
  module_id: CentralModuleId | string;
  record_title: string;
  reference_code: string;
  status: string;
  payload_json: string;
  created_by: string;
  created_by_username: string;
  created_at: string;
  updated_at: string;
}

const MODULE_META: Record<
  CentralModuleId,
  {
    title: string;
    subtitle: string;
    refPlaceholder: string;
    titlePlaceholder: string;
    detailLabel: string;
    amountLabel: string;
  }
> = {
  'document-vault': {
    title: 'Central Document Vault & Drive Backup',
    subtitle: 'Centralized team documents, approvals, downloads & optional Google Drive backup.',
    refPlaceholder: 'DOC-2026-001',
    titlePlaceholder: 'e.g. Monthly GST Audit Pack',
    detailLabel: 'Category / Remarks',
    amountLabel: 'Tag / Folder',
  },
  'document-studio': {
    title: 'Document Studio',
    subtitle: 'Centralized business letters, rent memos, authorization drafts & customer communications.',
    refPlaceholder: 'LTR-2026-014',
    titlePlaceholder: 'e.g. Showroom Lease Renewal Covering Letter',
    detailLabel: 'Recipient / Summary',
    amountLabel: 'Document Type',
  },
  'auto-ledger': {
    title: 'AutoLedger',
    subtitle: 'Centralized dealership voucher reconciliation, TDS/TCS adjustments & ledger entries.',
    refPlaceholder: 'VCH-8842',
    titlePlaceholder: 'e.g. BMW Warranty Credit Note Adjustment',
    detailLabel: 'Ledger Party / Narration',
    amountLabel: 'Amount (INR)',
  },
  'vehicle-master': {
    title: 'Vehicle Master',
    subtitle: 'Centralized VIN, chassis, model variant, customer & RTO registration master.',
    refPlaceholder: 'WBABA91050AL00012',
    titlePlaceholder: 'e.g. BMW X3 xDrive20d M Sport — KA-19',
    detailLabel: 'Owner / Dealership Location',
    amountLabel: 'RTO / Ex-Showroom',
  },
  registers: {
    title: 'Compliance & Operations Registers',
    subtitle: 'Centralized Sales, Purchase, Incentive & Fleet Fuel operational registers.',
    refPlaceholder: 'REG-NOV-09',
    titlePlaceholder: 'e.g. November IOCL XTRAPOWER Fleet Register',
    detailLabel: 'Register Scope / Period',
    amountLabel: 'Entries / Value',
  },
  reports: {
    title: 'Enterprise Reports',
    subtitle: 'Audited financial, claims aging, TDS reconciliation & departmental P&L summaries.',
    refPlaceholder: 'RPT-Q3-2026',
    titlePlaceholder: 'e.g. Q3 Departmental P&L & Claims Exception Report',
    detailLabel: 'Report Period / Notes',
    amountLabel: 'Summary Figure',
  },
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed reading selected file.'));
    reader.readAsDataURL(file);
  });
}

export const CentralWorkspaceModules: React.FC<{
  activeModule?: CentralModuleId;
  onChangeModule?: (mod: CentralModuleId) => void;
}> = ({ activeModule: controlledModule, onChangeModule }) => {
  const { apiFetch, hasPermission, token } = useEnterpriseAuth();
  const availableTabs = useMemo(
    () =>
      (Object.keys(MODULE_META) as CentralModuleId[]).filter((id) =>
        hasPermission(id, 'view')
      ),
    [hasPermission]
  );
  const [internalModule, setInternalModule] = useState<CentralModuleId>('document-vault');
  const activeModule: CentralModuleId =
    controlledModule ??
    (availableTabs.includes(internalModule)
      ? internalModule
      : availableTabs[0] || 'document-vault');
  const handleSelectModule = useCallback(
    (mod: CentralModuleId) => {
      if (onChangeModule) {
        onChangeModule(mod);
      } else {
        setInternalModule(mod);
      }
    },
    [onChangeModule]
  );

  const [documents, setDocuments] = useState<EnterpriseDocumentRow[]>([]);
  const [records, setRecords] = useState<WorkspaceRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Upload Document form
  const [docTitle, setDocTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupToDrive, setBackupToDrive] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Create Record form
  const [recTitle, setRecTitle] = useState('');
  const [recRef, setRecRef] = useState('');
  const [recDetail, setRecDetail] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  const meta = MODULE_META[activeModule];
  const canView = hasPermission(activeModule, 'view');
  const canCreate = hasPermission(activeModule, 'create');
  const canEdit = hasPermission(activeModule, 'edit');
  const canUpload = hasPermission(activeModule, 'upload') || hasPermission('document-vault', 'upload');
  const canDownload = hasPermission(activeModule, 'download') || hasPermission('document-vault', 'download');
  const canApprove = hasPermission(activeModule, 'approve');
  const canDelete = hasPermission(activeModule, 'delete');
  const canExport = hasPermission(activeModule, 'export');

  const loadData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      if (activeModule === 'document-vault') {
        const res = await apiFetch('/api/enterprise/documents');
        const data = (await res.json().catch(() => null)) as {
          documents?: EnterpriseDocumentRow[];
          error?: string;
        } | null;
        if (!res.ok) throw new Error(data?.error || 'Failed loading documents.');
        setDocuments(Array.isArray(data?.documents) ? data.documents : []);
      } else {
        const res = await apiFetch(
          `/api/enterprise/records?moduleId=${encodeURIComponent(activeModule)}`
        );
        const data = (await res.json().catch(() => null)) as {
          records?: WorkspaceRecordRow[];
          error?: string;
        } | null;
        if (!res.ok) throw new Error(data?.error || 'Failed loading workspace records.');
        setRecords(Array.isArray(data?.records) ? data.records : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [activeModule, apiFetch, canView]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !canUpload) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      let driveFileId = '';
      let driveWebViewLink = '';
      if (backupToDrive) {
        let accessToken = await getAccessToken();
        if (!accessToken) {
          const authRes = await googleSignIn();
          accessToken = authRes.accessToken;
        }
        const uploadedDrive = await uploadFileToDrive(accessToken, selectedFile);
        driveFileId = uploadedDrive.id || '';
        driveWebViewLink = uploadedDrive.webViewLink || '';
      }

      const base64Data = await readFileAsBase64(selectedFile);
      const res = await apiFetch('/api/enterprise/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          moduleId: 'document-vault',
          title: docTitle.trim() || selectedFile.name,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          base64Data,
          driveFileId,
          driveWebViewLink,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Document upload failed.');

      setDocTitle('');
      setSelectedFile(null);
      setNotice(
        driveFileId
          ? 'Uploaded to Central Vault and backed up to Google Drive.'
          : 'Uploaded securely to Central Document Vault.'
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (docRow: EnterpriseDocumentRow) => {
    if (!canDownload || !token) return;
    setError('');
    try {
      const res = await apiFetch(`/api/enterprise/documents/${encodeURIComponent(docRow.id)}/download`);
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || 'Unable to download document.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = docRow.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleDocumentApproval = async (
    docId: string,
    approvalStatus: 'Approved' | 'Rejected'
  ) => {
    setError('');
    try {
      const res = await apiFetch(`/api/enterprise/documents/${encodeURIComponent(docId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Failed to update approval status.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval update failed.');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/enterprise/documents/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Delete failed.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !recTitle.trim()) return;
    setSavingRecord(true);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch('/api/enterprise/records', {
        method: 'POST',
        body: JSON.stringify({
          moduleId: activeModule,
          recordTitle: recTitle.trim(),
          referenceCode: recRef.trim(),
          status: 'Pending Review',
          payload: {
            detail: recDetail.trim(),
            metric: recAmount.trim(),
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Failed saving record.');
      setRecTitle('');
      setRecRef('');
      setRecDetail('');
      setRecAmount('');
      setNotice('Saved to central multi-user database.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save record.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleRecordStatus = async (id: string, status: 'Approved' | 'Rejected') => {
    setError('');
    try {
      const res = await apiFetch(`/api/enterprise/records/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Failed updating status.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    setError('');
    try {
      const res = await apiFetch(`/api/enterprise/records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Delete failed.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleExportCsv = () => {
    if (!canExport) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    if (activeModule === 'document-vault') {
      const header = ['Title', 'File Name', 'Size Bytes', 'Approval Status', 'Uploaded By', 'Drive Link', 'Updated At'].join(',');
      const lines = documents.map((d) =>
        [d.title, d.file_name, d.size_bytes, d.approval_status, d.uploaded_by_username, d.drive_web_view_link, d.updated_at]
          .map(esc)
          .join(',')
      );
      const blob = new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vcpl-document-vault-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const header = ['Reference', 'Title', 'Status', 'Detail', 'Metric', 'Created By', 'Updated At'].join(',');
    const lines = records.map((r) => {
      let parsed: { detail?: string; metric?: string } = {};
      try {
        parsed = JSON.parse(r.payload_json || '{}') as { detail?: string; metric?: string };
      } catch {
        // ignore
      }
      return [
        r.reference_code,
        r.record_title,
        r.status,
        parsed.detail || '',
        parsed.metric || '',
        r.created_by_username,
        r.updated_at,
      ]
        .map(esc)
        .join(',');
    });
    const blob = new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vcpl-${activeModule}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (availableTabs.length === 0) {
    return (
      <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#131C2E] p-6 text-center text-sm text-[#475569] dark:text-slate-300">
        No central operational modules are currently assigned to your account. Contact your Super Admin for module permissions.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Module Switcher Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {availableTabs.map((modId) => {
            const active = modId === activeModule;
            const Icon =
              modId === 'document-vault'
                ? FolderArchive
                : modId === 'vehicle-master'
                  ? Car
                  : modId === 'reports'
                    ? FileSpreadsheet
                    : FileText;
            return (
              <button
                key={modId}
                type="button"
                onClick={() => handleSelectModule(modId)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                    : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{MODULE_META[modId].title.split('&')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          {canExport && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#12805C] bg-[#12805C] hover:bg-[#0E6A4C] text-xs font-bold text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {!canView ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-5 text-sm text-rose-800 dark:text-rose-200">
          You do not have View Access for {meta.title}.
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
                {meta.title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">{meta.subtitle}</p>
            </div>
            <div className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
              Permissions:{' '}
              {[
                canView && 'View',
                canCreate && 'Create',
                canEdit && 'Edit',
                canUpload && 'Upload',
                canDownload && 'Download',
                canApprove && 'Approve',
                canExport && 'Export',
                canDelete && 'Delete',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {activeModule === 'document-vault' ? (
            <div className="space-y-4">
              {canUpload && (
                <form
                  onSubmit={(e) => void handleUploadDocument(e)}
                  className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      Document Title
                    </label>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder={meta.titlePlaceholder}
                      className="w-full h-10 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-sm text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      Select File (Max 15 MB)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full h-10 px-2 py-1.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-200"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center h-10">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupToDrive}
                        onChange={(e) => setBackupToDrive(e.target.checked)}
                        className="w-4 h-4 accent-[#12805C]"
                      />
                      <span>Backup to Drive</span>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={!selectedFile || uploading}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2F3E4E]/15 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-slate-900 text-[#2F3E4E] dark:text-slate-200 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3.5">Document</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3">Approval</th>
                      <th className="py-2.5 px-3">Drive Backup</th>
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#64748B] dark:text-slate-400">
                          {loading ? 'Loading central documents...' : 'No documents uploaded yet.'}
                        </td>
                      </tr>
                    ) : (
                      documents.map((docRow) => (
                        <tr key={docRow.id} className="hover:bg-[#FEF2C8]/25 dark:hover:bg-slate-900/60">
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-[#2F3E4E] dark:text-slate-100">
                              {docRow.title}
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                              {docRow.file_name}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-[#475569] dark:text-slate-300">
                            {(docRow.size_bytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2.5 px-3 text-[#475569] dark:text-slate-300">
                            {docRow.uploaded_by_username}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                docRow.approval_status === 'Approved'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : docRow.approval_status === 'Rejected'
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {docRow.approval_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {docRow.drive_web_view_link ? (
                              <a
                                href={docRow.drive_web_view_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400 font-semibold hover:underline"
                              >
                                <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Open in Drive</span>
                                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-[#94A3B8]">Central Server</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            {canDownload && (
                              <button
                                type="button"
                                onClick={() => void handleDownloadDocument(docRow)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2F3E4E]/25 dark:border-slate-600 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 font-semibold cursor-pointer"
                              >
                                <Download className="w-3 h-3" aria-hidden="true" />
                                <span>Download</span>
                              </button>
                            )}
                            {canApprove && docRow.approval_status !== 'Approved' && (
                              <button
                                type="button"
                                onClick={() => void handleDocumentApproval(docRow.id, 'Approved')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                <span>Approve</span>
                              </button>
                            )}
                            {canApprove && docRow.approval_status !== 'Rejected' && (
                              <button
                                type="button"
                                onClick={() => void handleDocumentApproval(docRow.id, 'Rejected')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" aria-hidden="true" />
                                <span>Reject</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteDocument(docRow.id)}
                                aria-label={`Delete ${docRow.title}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-semibold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {canCreate && (
                <form
                  onSubmit={(e) => void handleCreateRecord(e)}
                  className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      Reference Code
                    </label>
                    <input
                      type="text"
                      value={recRef}
                      onChange={(e) => setRecRef(e.target.value)}
                      placeholder={meta.refPlaceholder}
                      className="w-full h-10 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      placeholder={meta.titlePlaceholder}
                      className="w-full h-10 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-sm text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      {meta.detailLabel}
                    </label>
                    <input
                      type="text"
                      value={recDetail}
                      onChange={(e) => setRecDetail(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-sm text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
                      {meta.amountLabel}
                    </label>
                    <input
                      type="text"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-sm text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <button
                      type="submit"
                      disabled={savingRecord || !recTitle.trim()}
                      className="w-full h-10 inline-flex items-center justify-center gap-1 px-3 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {savingRecord ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>Add</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2F3E4E]/15 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-slate-900 text-[#2F3E4E] dark:text-slate-200 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 px-3.5">Ref Code</th>
                      <th className="py-2.5 px-3">Title &amp; Details</th>
                      <th className="py-2.5 px-3">Value / Metric</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Author</th>
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#64748B] dark:text-slate-400">
                          {loading ? 'Loading records...' : `No central entries recorded in ${meta.title} yet.`}
                        </td>
                      </tr>
                    ) : (
                      records.map((rec) => {
                        let parsed: { detail?: string; metric?: string } = {};
                        try {
                          parsed = JSON.parse(rec.payload_json || '{}') as {
                            detail?: string;
                            metric?: string;
                          };
                        } catch {
                          // ignore
                        }
                        return (
                          <tr key={rec.id} className="hover:bg-[#FEF2C8]/25 dark:hover:bg-slate-900/60">
                            <td className="py-2.5 px-3.5 font-mono font-semibold text-[#2F3E4E] dark:text-slate-200">
                              {rec.reference_code || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[#2F3E4E] dark:text-slate-100">
                                {rec.record_title}
                              </div>
                              {parsed.detail && (
                                <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                                  {parsed.detail}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
                              {parsed.metric || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  rec.status === 'Approved'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : rec.status === 'Rejected'
                                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[#64748B] dark:text-slate-400">
                              {rec.created_by_username}
                            </td>
                            <td className="py-2.5 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                              {canApprove && rec.status !== 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRecordStatus(rec.id, 'Approved')}
                                  className="px-2 py-1 rounded border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {canApprove && rec.status !== 'Rejected' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRecordStatus(rec.id, 'Rejected')}
                                  className="px-2 py-1 rounded border border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRecord(rec.id)}
                                  aria-label={`Delete ${rec.record_title}`}
                                  className="inline-flex items-center px-2 py-1 rounded border border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
