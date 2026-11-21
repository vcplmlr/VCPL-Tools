import React from 'react';
import { CalendarDays, RotateCcw } from 'lucide-react';
import {
  AvailablePeriodChoices,
  RecoHalf,
  RecoPeriodFilter,
  RecoPeriodMode,
  RecoQuarter,
  createDefaultRecoPeriodFilter,
  formatFyLabel,
  formatMonthDisplay,
  getCurrentIndianFy,
  getIndianFyFromKey,
  getIndianFyStartYear,
  getQuarterFromKey,
  isoToDateKey,
  parseFyStartYear,
  resolveRecoPeriodBounds,
} from '../../utils/recoPeriodFilter';

interface RecoPeriodFilterBarProps {
  value: RecoPeriodFilter;
  onChange: (next: RecoPeriodFilter) => void;
  available?: AvailablePeriodChoices;
  matchedCount?: number;
  totalCount?: number;
  scopeHint?: string;
  compact?: boolean;
}

const MODE_OPTIONS: Array<{ key: RecoPeriodMode; label: string }> = [
  { key: 'all', label: 'All Dates' },
  { key: 'fy', label: 'Financial Year (FY)' },
  { key: 'quarter', label: 'Quarterly (Q1–Q4)' },
  { key: 'half', label: 'Half-Year (H1–H2)' },
  { key: 'month', label: 'Month' },
  { key: 'custom', label: 'Custom Dates' },
];

const QUARTERS: Array<{ key: RecoQuarter; label: string; span: string }> = [
  { key: 'Q1', label: 'Q1', span: 'Apr–Jun' },
  { key: 'Q2', label: 'Q2', span: 'Jul–Sep' },
  { key: 'Q3', label: 'Q3', span: 'Oct–Dec' },
  { key: 'Q4', label: 'Q4', span: 'Jan–Mar' },
];

const HALVES: Array<{ key: RecoHalf; label: string; span: string }> = [
  { key: 'H1', label: 'H1', span: 'Apr–Sep' },
  { key: 'H2', label: 'H2', span: 'Oct–Mar' },
];

export const RecoPeriodFilterBar: React.FC<RecoPeriodFilterBarProps> = ({
  value,
  onChange,
  available,
  matchedCount,
  totalCount,
  scopeHint,
  compact = false,
}) => {
  const bounds = resolveRecoPeriodBounds(value);
  const fyChoices = available?.fys.length
    ? available.fys
    : [
        getCurrentIndianFy(),
        formatFyLabel(
          getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1) - 1
        ),
        formatFyLabel(
          getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1) - 2
        ),
      ];
  const monthChoices = available?.months ?? [];

  const switchMode = (mode: RecoPeriodMode) => {
    let nextFy = value.fy || fyChoices[0];
    if (!fyChoices.includes(nextFy) && available?.maxIso) {
      const mk = isoToDateKey(available.maxIso);
      if (mk) nextFy = getIndianFyFromKey(mk);
    }
    let nextMonth = value.month;
    if (mode === 'month' && monthChoices.length > 0 && !monthChoices.includes(nextMonth)) {
      nextMonth = monthChoices[monthChoices.length - 1];
    }
    let nextQuarter = value.quarter;
    if (mode === 'quarter' && available?.maxIso && value.mode === 'all') {
      const mk = isoToDateKey(available.maxIso);
      if (mk) nextQuarter = getQuarterFromKey(mk);
    }
    let nextFrom = value.from;
    let nextTo = value.to;
    if (mode === 'custom' && !nextFrom && !nextTo && available?.minIso && available?.maxIso) {
      nextFrom = available.minIso;
      nextTo = available.maxIso;
    }

    onChange({
      ...value,
      mode,
      fy: nextFy,
      quarter: nextQuarter,
      month: nextMonth,
      from: nextFrom,
      to: nextTo,
    });
  };

  const applyQuickPreset = (
    preset: 'thisFy' | 'prevFy' | 'last30' | 'currQtr' | 'prevQtr' | 'dataRange'
  ) => {
    const now = new Date();
    const curStart = getIndianFyStartYear(now.getFullYear(), now.getMonth() + 1);
    const curQIdx = now.getMonth() + 1 >= 4 ? Math.floor((now.getMonth() + 1 - 4) / 3) : 3;

    if (preset === 'thisFy') {
      onChange({ ...value, mode: 'fy', fy: formatFyLabel(curStart) });
      return;
    }
    if (preset === 'prevFy') {
      onChange({ ...value, mode: 'fy', fy: formatFyLabel(curStart - 1) });
      return;
    }
    if (preset === 'currQtr') {
      const qList: RecoQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
      onChange({
        ...value,
        mode: 'quarter',
        fy: formatFyLabel(curStart),
        quarter: qList[curQIdx],
      });
      return;
    }
    if (preset === 'prevQtr') {
      const qList: RecoQuarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
      const prevIdx = curQIdx === 0 ? 3 : curQIdx - 1;
      const fyStart = curQIdx === 0 ? curStart - 1 : curStart;
      onChange({
        ...value,
        mode: 'quarter',
        fy: formatFyLabel(fyStart),
        quarter: qList[prevIdx],
      });
      return;
    }
    if (preset === 'last30') {
      const toD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fromD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
      onChange({ ...value, mode: 'custom', from: iso(fromD), to: iso(toD) });
      return;
    }
    if (preset === 'dataRange' && available?.minIso && available?.maxIso) {
      onChange({ ...value, mode: 'custom', from: available.minIso, to: available.maxIso });
    }
  };

  const resetAll = () => {
    const def = createDefaultRecoPeriodFilter();
    onChange({
      ...def,
      fy: fyChoices[0] || def.fy,
    });
  };

  return (
    <div
      className={`no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl ${
        compact ? 'p-3' : 'p-3.5 sm:p-4'
      } space-y-2.5`}
    >
      {/* Top Row: Label + Mode Buttons + Active Scope Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100 mr-1">
            <CalendarDays className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
            <span>Period Filter</span>
          </span>

          {MODE_OPTIONS.map((opt) => {
            const active = value.mode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => switchMode(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                    : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
              bounds.isFiltered
                ? 'bg-[#FEF2C8] dark:bg-amber-950/50 text-[#2F3E4E] dark:text-amber-200 border-[#2F3E4E]/40 dark:border-amber-700/60'
                : 'bg-[#CEE5DC]/50 dark:bg-emerald-950/40 text-[#12805C] dark:text-emerald-300 border-[#12805C]/30 dark:border-emerald-700/50'
            }`}
          >
            <span>{bounds.label}</span>
            {bounds.isFiltered && (
              <span className="text-[#475569] dark:text-slate-300 font-normal">
                ({bounds.rangeText})
              </span>
            )}
            {matchedCount != null && totalCount != null && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-[#2F3E4E] dark:text-slate-100">
                {matchedCount}/{totalCount}
              </span>
            )}
          </span>

          {value.mode !== 'all' && (
            <button
              type="button"
              onClick={resetAll}
              title="Reset to All Dates"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-500/35 bg-rose-50 dark:bg-rose-950/35 hover:bg-rose-100 text-[11px] font-bold text-rose-700 dark:text-rose-300 cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode-Specific Controls */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[#2F3E4E]/10 dark:border-slate-700/70 text-xs">
        {(value.mode === 'fy' || value.mode === 'quarter' || value.mode === 'half') && (
          <label className="inline-flex items-center gap-1.5 font-semibold text-[#2F3E4E] dark:text-slate-200">
            <span className="text-[11px] text-[#64748B] dark:text-slate-400">FY (Apr–Mar):</span>
            <select
              aria-label="Financial Year"
              value={value.fy}
              onChange={(e) => onChange({ ...value, fy: e.target.value })}
              className="px-2.5 py-1 rounded-lg border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono font-bold text-xs text-[#2F3E4E] dark:text-slate-100"
            >
              {fyChoices.map((fy) => {
                const sy = parseFyStartYear(fy);
                return (
                  <option key={fy} value={fy}>
                    FY {fy} {sy ? `(Apr ${sy} – Mar ${sy + 1})` : ''}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {value.mode === 'quarter' && (
          <div className="flex flex-wrap items-center gap-1">
            {QUARTERS.map((q) => {
              const on = value.quarter === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => onChange({ ...value, quarter: q.key })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                    on
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {q.label}{' '}
                  <span className="font-normal opacity-80">({q.span})</span>
                </button>
              );
            })}
          </div>
        )}

        {value.mode === 'half' && (
          <div className="flex flex-wrap items-center gap-1">
            {HALVES.map((h) => {
              const on = value.half === h.key;
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => onChange({ ...value, half: h.key })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                    on
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {h.label}{' '}
                  <span className="font-normal opacity-80">({h.span})</span>
                </button>
              );
            })}
          </div>
        )}

        {value.mode === 'month' && (
          <div className="flex flex-wrap items-center gap-2">
            {monthChoices.length > 0 && (
              <label className="inline-flex items-center gap-1.5 font-semibold text-[#2F3E4E] dark:text-slate-200">
                <span className="text-[11px] text-[#64748B] dark:text-slate-400">From data:</span>
                <select
                  aria-label="Month from uploaded data"
                  value={monthChoices.includes(value.month) ? value.month : ''}
                  onChange={(e) => {
                    if (e.target.value) onChange({ ...value, month: e.target.value });
                  }}
                  className="px-2.5 py-1 rounded-lg border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono font-bold text-xs text-[#2F3E4E] dark:text-slate-100"
                >
                  <option value="">Select month…</option>
                  {monthChoices.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatMonthDisplay(ym)} ({ym})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="inline-flex items-center gap-1.5 font-semibold text-[#2F3E4E] dark:text-slate-200">
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">Pick month:</span>
              <input
                type="month"
                aria-label="Pick calendar month"
                value={value.month}
                onChange={(e) => onChange({ ...value, month: e.target.value })}
                className="px-2 py-1 rounded-lg border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono text-xs text-[#2F3E4E] dark:text-slate-100"
              />
            </label>
          </div>
        )}

        {value.mode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 font-semibold text-[#2F3E4E] dark:text-slate-200">
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">From:</span>
              <input
                type="date"
                aria-label="From date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="px-2 py-1 rounded-lg border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono text-xs text-[#2F3E4E] dark:text-slate-100"
              />
            </label>
            <label className="inline-flex items-center gap-1.5 font-semibold text-[#2F3E4E] dark:text-slate-200">
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">To:</span>
              <input
                type="date"
                aria-label="To date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="px-2 py-1 rounded-lg border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono text-xs text-[#2F3E4E] dark:text-slate-100"
              />
            </label>
          </div>
        )}

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mr-0.5">
            Quick:
          </span>
          {(
            [
              ['thisFy', 'This FY'],
              ['prevFy', 'Prev FY'],
              ['currQtr', 'Current Qtr'],
              ['prevQtr', 'Last Qtr'],
              ['last30', 'Last 30d'],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => applyQuickPreset(k)}
              className="px-2 py-0.5 rounded border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[10px] font-bold text-[#475569] dark:text-slate-300 cursor-pointer transition"
            >
              {lbl}
            </button>
          ))}
          {available?.minIso && available?.maxIso && (
            <button
              type="button"
              onClick={() => applyQuickPreset('dataRange')}
              className="px-2 py-0.5 rounded border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[10px] font-bold text-[#475569] dark:text-slate-300 cursor-pointer transition"
            >
              Data Span ({available.minIso} → {available.maxIso})
            </button>
          )}
        </div>

        <span className="flex-1" />

        {value.mode !== 'all' && (
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F3E4E] dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value.includeUndated}
              onChange={(e) => onChange({ ...value, includeUndated: e.target.checked })}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Include undated rows</span>
          </label>
        )}

        {scopeHint && (
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">{scopeHint}</span>
        )}
      </div>
    </div>
  );
};
