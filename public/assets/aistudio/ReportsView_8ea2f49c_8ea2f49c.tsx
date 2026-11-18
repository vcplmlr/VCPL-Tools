import React, { useState } from 'react';
import {
  ReconciledDoc,
  ReconStats,
  ControlBridgeItem,
} from '../types/reconciliation';
import {
  formatINR,
  formatCurrency,
  STATUS_COLORS,
} from '../utils/reconciliation';
import {
  ShieldAlert,
  Clock,
  Building2,
  FileText,
  AlertOctagon,
  CheckCircle,
  XCircle,
  FileCheck2,
  Receipt,
  Scale,
} from 'lucide-react';

interface ReportsViewProps {
  res: ReconciledDoc[];
  stats: ReconStats;
  ctl: ControlBridgeItem[];
  onOpenDoc: (docIndex: number) => void;
  onFilterBySupplier: (gstin: string) => void;
  initialReportKey?: string;
}

type ReportKey =
  | 'summary'
  | 'rcm'
  | 'na'
  | 'late'
  | 'limit'
  | 'follow'
  | 'notes'
  | 'exc';

interface ReportTabDef {
  key: ReportKey;
  label: string;
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  res,
  stats,
  ctl,
  onOpenDoc,
  onFilterBySupplier,
  initialReportKey = 'summary',
}) => {
  const [activeReport, setActiveReport] = useState<ReportKey>(
    (initialReportKey as ReportKey) || 'summary'
  );
  const [reportSearch, setReportSearch] = useState('');

  const reportTabs: ReportTabDef[] = [
    {
      key: 'summary',
      label: 'ITC Bridge & 3B Control',
      icon: Scale,
      description:
        'Reconciliation bridge tying 2B eligible ITC with Tally purchase books and validating against portal summary sheets.',
    },
    {
      key: 'rcm',
      label: 'Reverse Charge (RCM)',
      count: res.filter((r) => /rcm$/.test(r.bk)).length,
      icon: ShieldAlert,
      description:
        'Inward supplies liable to Reverse Charge. Tax must be discharged in cash under Table 3.1(d); ITC can be claimed under Table 4(A)(3) after payment.',
    },
    {
      key: 'na',
      label: 'Ineligible / Blocked ITC',
      count: res.filter((r) => /^n_/.test(r.bk)).length,
      icon: AlertOctagon,
      description:
        'Credits marked not available in GSTR-2B by the GST Portal. Report in GSTR-3B Table 4(D)(2). If already booked in Tally, do not claim.',
    },
    {
      key: 'late',
      label: 'Late Reported Invoices',
      count: res.filter((r) => r.late).length,
      icon: Clock,
      description:
        'Documents reported by suppliers in a GSTR-1 period later than invoice date. Verify they were not already claimed in prior return periods.',
    },
    {
      key: 'limit',
      label: 'Section 16(4) Time-Limit',
      count: res.filter((r) => r.tl != null && r.tl <= 180).length,
      icon: Clock,
      description:
        'Invoices approaching or past the statutory ITC deadline (30th November following the financial year end) under Section 16(4) of the CGST Act.',
    },
    {
      key: 'follow',
      label: 'Supplier Follow-Up',
      count: res.filter((r) => r.status === 'Only in Tally').length,
      icon: Building2,
      description:
        'Invoices entered in your Tally books but missing from GSTR-2B. Grouped by supplier to follow up with vendors for filing their GSTR-1/IFF.',
    },
    {
      key: 'notes',
      label: 'Credit / Debit Notes',
      count: res.filter((r) => r.type !== 'Invoice').length,
      icon: Receipt,
      description:
        'Credit and debit notes affecting ITC. Credit notes reduce eligible ITC and are netted off in Part B of Table 4(A).',
    },
    {
      key: 'exc',
      label: 'Audit Exceptions',
      count: res.filter((r) => !!r.flags).length,
      icon: FileText,
      description:
        'All documents flagged for tax rate anomalies (e.g. CGST != SGST), consolidated line items, or statutory exceptions.',
    },
  ];

  // Overview calculations
  const B = stats.br;
  const validCtl = (ctl || []).filter((x) => x.n || x.pt);
  const unexplained = stats.e2 - stats.tT - B.a - B.b - B.c - B.d;
  const netITC2B = validCtl
    .filter((x) => !x.k.startsWith('n'))
    .reduce((a, x) => a + (x.k.endsWith('cn') ? -x.ot : x.ot), 0);
  const getCtlVal = (k: string) =>
    (validCtl.find((x) => x.k === k) || { ot: 0 }).ot;

  // Render sub-report rows
  const getSubReportRows = (): ReconciledDoc[] => {
    switch (activeReport) {
      case 'rcm':
        return res.filter((r) => /rcm$/.test(r.bk));
      case 'na':
        return res.filter((r) => /^n_/.test(r.bk));
      case 'late':
        return res.filter((r) => r.late);
      case 'limit':
        return res
          .filter((r) => r.tl != null && r.tl <= 180)
          .sort((a, b) => (a.tl || 0) - (b.tl || 0));
      case 'notes':
        return res.filter((r) => r.type !== 'Invoice');
      case 'follow':
        return res.filter((r) => r.status === 'Only in Tally');
      case 'exc':
        return res.filter((r) => !!r.flags);
      default:
        return [];
    }
  };

  const currentTab = reportTabs.find((t) => t.key === activeReport)!;
  const rawRows = getSubReportRows();
  const filteredSubRows = rawRows.filter((r) => {
    if (!reportSearch) return true;
    const q = reportSearch.toLowerCase().trim();
    return (
      r.name.toLowerCase().includes(q) ||
      r.gstin.toLowerCase().includes(q) ||
      (r.doc2b || r.docT).toLowerCase().includes(q) ||
      r.flags.toLowerCase().includes(q)
    );
  });

  // Grouped follow-up suppliers
  const supplierFollowUpList = React.useMemo(() => {
    if (activeReport !== 'follow') return [];
    const m = new Map<string, { gstin: string; name: string; n: number; t: number }>();
    res
      .filter((r) => r.status === 'Only in Tally')
      .forEach((r) => {
        const s = m.get(r.gstin) || {
          gstin: r.gstin,
          name: r.name,
          n: 0,
          t: 0,
        };
        s.n++;
        s.t += r.taxT;
        m.set(r.gstin, s);
      });
    return [...m.values()].sort((a, b) => b.t - a.t);
  }, [activeReport, res]);

  return (
    <div className="space-y-4">
      {/* Report Switcher Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeReport === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveReport(tab.key);
                setReportSearch('');
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 border ${
                isSelected
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Report Description Banner */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
        <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
          <currentTab.icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {currentTab.label}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {currentTab.description}
          </p>
        </div>
      </div>

      {/* View 1: ITC Bridge & 3B Control Overview */}
      {activeReport === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ITC Bridge Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Reconciliation Bridge – 2B vs Tally Books
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        ITC eligible per GSTR-2B (regular + credit notes)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        ₹{formatINR(stats.e2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        ITC booked in Tally purchase books
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        ₹{formatINR(stats.tT)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">
                        Reconciliation Difference
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        ₹{formatINR(stats.e2 - stats.tT)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-4 text-slate-500 dark:text-slate-400">
                        (+) In 2B, not booked in Tally (to claim)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        +₹{formatINR(B.a)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-4 text-slate-500 dark:text-slate-400">
                        (−) Booked in Tally, missing in 2B (ITC at risk)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        −₹{formatINR(Math.abs(B.b))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-4 text-slate-500 dark:text-slate-400">
                        (−) Booked in Tally, but 2B says RCM / Ineligible
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        −₹{formatINR(Math.abs(B.c))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pl-4 text-slate-500 dark:text-slate-400">
                        (±) Amount differences on matched documents
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {B.d >= 0 ? '+' : ''}₹{formatINR(B.d)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-2 font-bold text-slate-900 dark:text-white">
                        Unexplained Residual Variance
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        <span
                          className={`font-bold inline-flex items-center gap-1 ${
                            Math.abs(unexplained) > 1
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {Math.abs(unexplained) <= 1 ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>₹0.00 (100% Tied)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>₹{formatINR(unexplained)}</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* GSTR-3B Table Positions Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                GSTR-3B Table Positions (Auto-Computed from 2B)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        All other ITC – Table 4(A)(5)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        ₹{formatINR(getCtlVal('a_reg'))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        RCM Inward ITC (after payment) – Table 4(A)(3)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        ₹{formatINR(getCtlVal('a_rcm'))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        Less: Credit Notes (Net-off) – Part B / 4(A)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        −₹{formatINR(getCtlVal('a_cn'))}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">
                        Net Eligible ITC Available
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{formatINR(netITC2B)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        RCM Tax Liability (payable in cash) – Table 3.1(d)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
                        ₹{formatINR(getCtlVal('a_rcm') + getCtlVal('n_rcm'))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        ITC Not Available / Ineligible – Table 4(D)(2)
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                        ₹{formatINR(getCtlVal('n_reg') + getCtlVal('n_rcm'))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* GSTR-3B ITC Control Sheet Table */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              GSTR-3B ITC Control vs Portal Summary Sheets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Validating line items against the portal’s pre-aggregated totals to catch corrupted or missing rows
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      Bucket
                    </th>
                    <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      3B Table
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      Docs
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      Taxable (₹)
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      IGST (₹)
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      CGST (₹)
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      SGST (₹)
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      Cess (₹)
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      Computed Total
                    </th>
                    <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      Portal Summary
                    </th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      Check Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {validCtl.map((x) => {
                    const matches = x.diff == null || Math.abs(x.diff) < 1;
                    return (
                      <tr
                        key={x.k}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                          {x.label}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400">
                          {x.tb}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {x.n}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(x.tx)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(x.t[0])}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(x.t[1])}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(x.t[2])}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(x.t[3])}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          ₹{formatINR(x.ot)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {x.pt == null ? '—' : `₹${formatINR(x.pt)}`}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {x.diff == null ? (
                            <span className="text-slate-400">n/a</span>
                          ) : matches ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Ties
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              <XCircle className="w-3.5 h-3.5" /> Diff ₹
                              {formatINR(x.diff)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Supplier Follow-Up (Grouped list of vendors with unfiled invoices) */}
      {activeReport === 'follow' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Suppliers with Invoices Missing in GSTR-2B ({supplierFollowUpList.length} vendors)
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-mono font-bold">
              Total ITC at Risk: {formatCurrency(stats.risk)}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[580px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Name
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    GSTIN
                  </th>
                  <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    Missing Invoices
                  </th>
                  <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    ITC at Risk
                  </th>
                  <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {supplierFollowUpList.map((sup) => (
                  <tr
                    key={sup.gstin}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => onFilterBySupplier(sup.gstin)}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                      {sup.name || 'Unspecified Party'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {sup.gstin}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {sup.n} docs
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      ₹{formatINR(sup.t)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilterBySupplier(sup.gstin);
                        }}
                        className="px-2 py-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                      >
                        Filter Docs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 3: Document-level Specialized Reports */}
      {activeReport !== 'summary' && activeReport !== 'follow' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              {currentTab.label} ({filteredSubRows.length} documents)
            </span>
            <input
              type="search"
              placeholder="Filter within this report..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="overflow-x-auto max-h-[580px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Supplier &amp; GSTIN
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Document
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Date
                  </th>
                  <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    Taxable
                  </th>
                  <th className="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    Tax Amount
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {activeReport === 'rcm' && 'ITC Availability & Booking'}
                    {activeReport === 'na' && 'Portal Ineligibility Reason'}
                    {activeReport === 'late' && 'Filing Period & Filing Date'}
                    {activeReport === 'limit' && 'Time-Limit Countdown'}
                    {activeReport === 'notes' && 'Voucher Type & Remark'}
                    {activeReport === 'exc' && 'Specific Risk Flags'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No documents found in this report category.
                    </td>
                  </tr>
                ) : (
                  filteredSubRows.map((r) => {
                    const statusColor = STATUS_COLORS[r.status];
                    return (
                      <tr
                        key={r.i}
                        onClick={() => onOpenDoc(r.i)}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor.bg}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-[200px]">
                          <div className="font-medium text-slate-900 dark:text-white truncate">
                            {r.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {r.gstin}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200">
                          {r.doc2b || r.docT}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {r.date2b || r.dateT}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          ₹{formatINR(r.tx2 || r.txT)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          ₹{formatINR(r.tax2 || r.taxT)}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {activeReport === 'rcm' && (
                            <span className="text-xs">
                              ITC: {r.itc || 'Yes'} · Booked in Tally:{' '}
                              {r.docT ? `Yes (${r.vt})` : 'No'}
                            </span>
                          )}
                          {activeReport === 'na' && (
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                              {r.reason || 'Marked ineligible in portal'}
                            </span>
                          )}
                          {activeReport === 'late' && (
                            <span className="text-xs">
                              Period: <b className="font-mono">{r.per}</b> · Filed on:{' '}
                              {r.fdate || 'N/A'}
                            </span>
                          )}
                          {activeReport === 'limit' && (
                            <span
                              className={`text-xs font-semibold ${
                                (r.tl || 0) < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              Deadline: {r.deadline} (
                              {(r.tl || 0) < 0
                                ? 'Lapsed'
                                : `${r.tl} days left`}
                              )
                            </span>
                          )}
                          {activeReport === 'notes' && (
                            <span className="text-xs">
                              {r.vt || 'Note'} · {r.remark}
                            </span>
                          )}
                          {activeReport === 'exc' && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {r.flags}
                            </span>
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
    </div>
  );
};
