import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  KeyRound,
  LogIn,
  Maximize2,
  RotateCcw,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import { useEnterpriseAuth } from '../context/EnterpriseAuthContext';
import { PUBLIC_TOOLS_CATALOG } from '../data/toolsCatalog';
import { ToolCatalogItem } from '../types/tools';

interface LockedToolsPageProps {
  isUnlocked: boolean;
  vaultEmail?: string;
  onUnlock?: (token: string, email: string) => void;
  onLock?: () => void;
  onBackHome: () => void;
  onOpenTool: (tool: ToolCatalogItem, fullScreen?: boolean) => void;
  onOpenPortal?: () => void;
}

type VaultScopeFilter = 'all' | 'recon-banking' | 'dealership-tax' | 'letters-docs';

const RECON_BANKING_IDS = new Set([
  'bmw-statement-reconciler',
  'bmw-vendor-ledger-reconciler',
  'bmw-claims-reconciler',
  'vcpl-rtgs-neft-form',
  'bajaj-reconciliation-desk',
]);

const LETTERS_DOCS_IDS = new Set([
  'covering-letter-generator',
  'rent-payment-letter-maker',
]);

export function LockedToolsPage({
  isUnlocked,
  vaultEmail = '',
  onBackHome,
  onOpenTool,
  onOpenPortal,
}: LockedToolsPageProps) {
  const { user, isAuthenticated, isSuperAdmin, requiresPasswordChange, hasPermission } =
    useEnterpriseAuth();
  const effectiveUnlocked = isUnlocked || (isAuthenticated && !requiresPasswordChange);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<VaultScopeFilter>('all');

  const lockedTools = useMemo(() => {
    return PUBLIC_TOOLS_CATALOG.filter((tool) => {
      const isVaultItem =
        tool.statusLabel.toLowerCase().includes('passcode locked') ||
        LETTERS_DOCS_IDS.has(tool.id);
      if (!isVaultItem) return false;
      if (isAuthenticated && !isSuperAdmin && !requiresPasswordChange) {
        return hasPermission(tool.id, 'view');
      }
      return true;
    });
  }, [hasPermission, isAuthenticated, isSuperAdmin, requiresPasswordChange]);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lockedTools.filter((tool) => {
      if (scopeFilter === 'recon-banking' && !RECON_BANKING_IDS.has(tool.id)) return false;
      if (
        scopeFilter === 'dealership-tax' &&
        (RECON_BANKING_IDS.has(tool.id) || LETTERS_DOCS_IDS.has(tool.id))
      ) {
        return false;
      }
      if (scopeFilter === 'letters-docs' && !LETTERS_DOCS_IDS.has(tool.id)) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.code.toLowerCase().includes(q) ||
        tool.categoryName.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [lockedTools, scopeFilter, searchQuery]);

  const cleanUserLabel = (vaultEmail || user?.fullName?.trim() || user?.displayUsername || '').replace(
    /^@+/,
    ''
  );

  return (
    <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-8 md:py-12 min-h-[calc(100dvh-140px)] transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        {/* Top Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] shadow-[0_2px_0_#2F3E4E] dark:shadow-[0_2px_0_#020617] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          {onOpenPortal && !isAuthenticated && (
            <button
              type="button"
              onClick={onOpenPortal}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-xs font-display font-extrabold shadow-[0_2px_0_#1E293B] transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Login to Company Workspace</span>
            </button>
          )}
        </div>

        {/* Vault Banner + Filter Header */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#7D0B0B] dark:border-rose-500/50 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#7D0B0B] dark:shadow-[0_5px_0_#020617] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono font-bold">
                {effectiveUnlocked ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#12805C] text-[#FFFDF5]">
                    <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>SESSION UNLOCKED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]/30">
                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>LIVE · PASSCODE ACCESS OPEN</span>
                  </span>
                )}
                {cleanUserLabel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200">
                    <UserCheck className="w-3 h-3 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>{cleanUserLabel}</span>
                  </span>
                )}
                <span className="text-[#475569] dark:text-slate-400 tabular-nums">
                  {lockedTools.length} Live Modules
                </span>
                <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>100% Client-Side Execution</span>
                </span>
              </div>
              <h1 className="font-display font-extrabold text-[clamp(1.6rem,3vw,2.35rem)] text-[#2F3E4E] dark:text-slate-50 tracking-tight leading-tight">
                VCPL Passcode-Protected Tools Directory
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
                {effectiveUnlocked
                  ? `Direct access enabled for all ${lockedTools.length} VCPL reconciliation engines, bulk banking letters, 26AS TDS/TCS audits, incentive reports, DBS P&L analytics, fuel compilers, and letter builders.`
                  : `All ${lockedTools.length} specialized VCPL reconciliation engines, bulk banking letters, 26AS TDS/TCS audits, incentive reports, DBS P&L analytics, fuel compilers, and RTO tools are live below—click any tool and enter its 6-digit passcode to open immediately, or log in with your Company Workspace credentials.`}
              </p>
            </div>

            <div className="relative w-full lg:w-[340px] shrink-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter locked tools by code or name..."
                aria-label="Filter locked tools"
                className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-base sm:text-sm font-medium text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9E2A2B] dark:focus:ring-[#F9C80E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Scope Tabs */}
          <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700/80 flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All Enabled (${lockedTools.length})` },
                { id: 'recon-banking', label: 'Banking & Reconcilers' },
                { id: 'dealership-tax', label: 'Incentive, P&L, Tax & Fuel' },
                { id: 'letters-docs', label: 'Covering & Rent Letters' },
              ] as const
            ).map((tab) => {
              const active = scopeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScopeFilter(tab.id)}
                  className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#9E2A2B] text-[#FFFDF5] border-[#7D0B0B] shadow-[0_2px_0_#5C0909]'
                      : 'bg-[#FEF2C8]/65 dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {(searchQuery || scopeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setScopeFilter('all');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg text-xs font-bold text-[#7D0B0B] dark:text-rose-300 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Locked Tools Grid */}
        {filteredTools.length === 0 ? (
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-8 text-center space-y-3">
            <p className="font-display font-bold text-base text-[#2F3E4E] dark:text-slate-100">
              No locked tools matched your filter
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setScopeFilter('all');
              }}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-[#9E2A2B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
            >
              Show All {lockedTools.length} Enabled Tools
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const isLetterTool = LETTERS_DOCS_IDS.has(tool.id);
              const TileIcon = isLetterTool ? FileText : Building2;
              return (
                <article
                  key={tool.id}
                  className="group rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 flex flex-col justify-between gap-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_0_#7D0B0B] dark:hover:shadow-[0_4px_0_#020617]"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-[#FEE2E2] dark:bg-rose-950/70 border-[1.5px] border-[#9E2A2B] dark:border-rose-500/50 text-[#7D0B0B] dark:text-rose-200 flex items-center justify-center shrink-0">
                          <TileIcon className="w-5 h-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-mono font-extrabold text-[#7D0B0B] dark:text-rose-300">
                              {tool.code}
                            </span>
                            <span className="text-[#94A3B8]" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[#475569] dark:text-slate-400 font-semibold truncate">
                              {LETTERS_DOCS_IDS.has(tool.id) ? 'Letter Studio' : 'Passcode Protected'}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                            {tool.categoryName}
                          </p>
                        </div>
                      </div>

                      {effectiveUnlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#12805C] text-[#FFFDF5] text-[10px] font-display font-extrabold uppercase tracking-wider shrink-0">
                          <Unlock className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>Unlocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]/30 text-[10px] font-display font-extrabold uppercase tracking-wider shrink-0">
                          <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>Passcode</span>
                        </span>
                      )}
                    </div>

                    <h2 className="font-display font-bold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100 leading-snug">
                      {tool.title}
                    </h2>

                    <p className="text-xs sm:text-[13px] leading-relaxed text-[#475569] dark:text-slate-300 line-clamp-3">
                      {tool.description}
                    </p>
                  </div>

                  <div className="pt-3.5 border-t border-[#2F3E4E]/12 dark:border-slate-700/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTool(tool, false)}
                      className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] border-[1.5px] border-[#7D0B0B] text-xs font-display font-extrabold transition-colors cursor-pointer"
                    >
                      <span>{effectiveUnlocked ? 'Launch Tool' : 'Open with Passcode'}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTool(tool, true)}
                      title={`Open ${tool.title} Fullscreen`}
                      aria-label={`Open ${tool.title} in Fullscreen`}
                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
