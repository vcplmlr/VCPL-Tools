import React from 'react';
import { ReconStats, ReconciledDoc, MatchStatus } from '../types/reconciliation';
import {
  STATUS_LIST,
  STATUS_COLORS,
  formatCurrency,
  groupSuppliers,
} from '../utils/reconciliation';

interface ReconciliationOverviewProps {
  stats: ReconStats;
  res: ReconciledDoc[];
  onSelectStatus: (status: MatchStatus) => void;
  onSelectSupplier: (gstin: string) => void;
}

export const ReconciliationOverview: React.FC<ReconciliationOverviewProps> = ({
  stats,
  res,
  onSelectStatus,
  onSelectSupplier,
}) => {
  const tot = stats.n || 1;
  let offset = 25;

  const arcs = STATUS_LIST.map((k) => {
    const count = stats.s[k]?.n || 0;
    const p = (count / tot) * 100;
    const strokeColor = STATUS_COLORS[k]?.text || '#64748b';
    const currentOffset = offset;
    offset -= p;
    return {
      k,
      count,
      p,
      strokeColor,
      currentOffset,
    };
  });

  const topSuppliers = groupSuppliers(res).slice(0, 7);
  const maxDiff = Math.max(
    1,
    ...topSuppliers.map((s) => Math.abs(s.a - s.b))
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Donut Status Card */}
      <div className="md:col-span-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Reconciliation Status Distribution
        </h3>

        <div className="flex items-center gap-6 my-auto">
          {/* SVG Donut */}
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
              <circle
                r="15.9155"
                cx="21"
                cy="21"
                fill="none"
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth="5"
              />
              {arcs.map((arc) =>
                arc.p > 0 ? (
                  <circle
                    key={arc.k}
                    r="15.9155"
                    cx="21"
                    cy="21"
                    fill="none"
                    stroke={arc.strokeColor}
                    strokeWidth="5"
                    strokeDasharray={`${arc.p} ${100 - arc.p}`}
                    strokeDashoffset={`${arc.currentOffset}`}
                    className="transition-all duration-300"
                  />
                ) : null
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {stats.n}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Total Docs
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5">
            {STATUS_LIST.map((k) => {
              const count = stats.s[k]?.n || 0;
              const colorInfo = STATUS_COLORS[k];
              return (
                <button
                  key={k}
                  onClick={() => onSelectStatus(k)}
                  className="w-full flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1 rounded-md transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorInfo.text }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 truncate font-medium">
                      {k}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white ml-2">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          Click any status category to filter document list
        </div>
      </div>

      {/* Top Suppliers by ITC Variance Card */}
      <div className="md:col-span-7 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Top Suppliers by ITC Variance
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            2B Tax minus Books Tax
          </span>
        </div>

        <div className="space-y-2 my-auto">
          {topSuppliers.length === 0 ? (
            <p className="text-xs text-slate-400">No supplier data available.</p>
          ) : (
            topSuppliers.map((sup) => {
              const diff = sup.a - sup.b;
              const barPercent = Math.max(3, (Math.abs(diff) / maxDiff) * 100);
              const isNegative = diff < 0;

              return (
                <div
                  key={sup.g}
                  onClick={() => onSelectSupplier(sup.g)}
                  className="group flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="w-48 sm:w-56 truncate">
                    <span
                      className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate"
                      title={sup.name || sup.g}
                    >
                      {sup.name || sup.g}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block truncate">
                      {sup.g} · {sup.n} docs
                    </span>
                  </div>

                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isNegative
                          ? 'bg-rose-500 dark:bg-rose-400'
                          : 'bg-indigo-600 dark:bg-indigo-400'
                      }`}
                      style={{ width: `${barPercent}%` }}
                    />
                  </div>

                  <div className="w-24 text-right">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        Math.abs(diff) > 2
                          ? isNegative
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}
                      {formatCurrency(diff)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          Positive: excess ITC in 2B (to claim) · Negative: ITC booked in Tally but missing in 2B
        </div>
      </div>
    </div>
  );
};
