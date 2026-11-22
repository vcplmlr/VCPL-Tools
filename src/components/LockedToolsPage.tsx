import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Maximize2,
  RotateCcw,
  Search,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { PUBLIC_TOOLS_CATALOG } from '../data/toolsCatalog';
import { ToolCatalogItem } from '../types/tools';

interface LockedToolsPageProps {
  isUnlocked: boolean;
  vaultEmail?: string;
  onUnlock: (token: string, email: string) => void;
  onLock: () => void;
  onBackHome: () => void;
  onOpenTool: (tool: ToolCatalogItem, fullScreen?: boolean) => void;
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

function isValidEmailInput(value: string): boolean {
  return (
    value.length >= 5 &&
    value.length <= 254 &&
    !value.includes('..') &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      value
    ) &&
    /\.[a-z]{2,}$/i.test(value)
  );
}

export function LockedToolsPage({
  isUnlocked,
  vaultEmail = '',
  onUnlock,
  onLock,
  onBackHome,
  onOpenTool,
}: LockedToolsPageProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<VaultScopeFilter>('all');
  const emailFieldRef = useRef<HTMLInputElement | null>(null);
  const passwordFieldRef = useRef<HTMLInputElement | null>(null);

  const lockedTools = useMemo(() => {
    return PUBLIC_TOOLS_CATALOG.filter(
      (tool) =>
        tool.statusLabel.toLowerCase().includes('passcode locked') ||
        LETTERS_DOCS_IDS.has(tool.id)
    );
  }, []);

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

  const handleLockPage = useCallback(() => {
    setEmailInput('');
    setPasswordInput('');
    setShowPassword(false);
    setAuthError('');
    setSearchQuery('');
    setScopeFilter('all');
    onLock();
  }, [onLock]);

  useEffect(() => {
    if (!isUnlocked) {
      let active = true;
      void fetch('/api/vault/status')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { configured?: boolean } | null) => {
          if (active && data && typeof data.configured === 'boolean') {
            setSetupRequired(!data.configured);
          }
        })
        .catch(() => {
          // Keep current state if status endpoint is temporarily unreachable
        });

      const id = window.setTimeout(() => emailFieldRef.current?.focus(), 60);
      return () => {
        active = false;
        window.clearTimeout(id);
      };
    }
  }, [isUnlocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = emailInput.trim().toLowerCase();
    const candidatePassword = passwordInput.trim();

    if (!normalizedEmail) {
      setAuthError('Please enter your authorized email ID.');
      emailFieldRef.current?.focus();
      return;
    }
    if (!isValidEmailInput(normalizedEmail)) {
      setAuthError('Please enter a valid email ID address.');
      emailFieldRef.current?.focus();
      return;
    }
    if (!candidatePassword) {
      setAuthError('Please enter your vault password.');
      passwordFieldRef.current?.focus();
      return;
    }
    if (setupRequired && candidatePassword.length < 6) {
      setAuthError('Vault password must be at least 6 characters.');
      passwordFieldRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setAuthError('');

    try {
      const endpoint = setupRequired ? '/api/vault/claim' : '/api/vault/auth';
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: candidatePassword }),
      });

      let payload = (await res.json().catch(() => null)) as {
        token?: string;
        email?: string;
        code?: string;
        error?: string;
      } | null;

      if (res.status === 409 && payload?.code === 'VAULT_SETUP_REQUIRED') {
        setSetupRequired(true);
        res = await fetch('/api/vault/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password: candidatePassword }),
        });
        payload = (await res.json().catch(() => null)) as {
          token?: string;
          email?: string;
          code?: string;
          error?: string;
        } | null;
      }

      if (res.ok && payload?.token) {
        setSetupRequired(false);
        setEmailInput('');
        setPasswordInput('');
        setShowPassword(false);
        setAuthError('');
        onUnlock(payload.token, payload.email || normalizedEmail);
        return;
      }

      if (res.status === 429) {
        setAuthError('Too many sign-in attempts. Please wait a moment and try again.');
        return;
      }

      setAuthError(
        payload?.error || 'Invalid email ID or password. Access to the Locked Vault is denied.'
      );
    } catch {
      setAuthError('Unable to reach authentication server. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isUnlocked) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-10 sm:py-16 min-h-[calc(100dvh-140px)] transition-colors duration-200 flex items-center">
        <div className="w-full max-w-lg mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#7D0B0B] dark:border-rose-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_6px_0_#7D0B0B] dark:shadow-[0_6px_0_#020617] space-y-6">
            {/* Top Crest */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#9E2A2B] border-[1.5px] border-[#7D0B0B] text-[#FFFDF5] flex items-center justify-center shrink-0 shadow-[0_3px_0_#5C0909]">
                <Lock className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FEE2E2] dark:bg-rose-950/75 border border-[#9E2A2B]/40 dark:border-rose-500/40 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#7D0B0B] dark:text-rose-200">
                  Restricted Vault · Login Required
                </span>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight mt-1.5">
                  VCPL Locked Tools Login
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-[#475569] dark:text-slate-300">
              Sign in with your authorized Email ID and Password to unlock all{' '}
              {lockedTools.length} restricted enterprise, banking, covering letter, and rent
              payment letter utilities directly.
            </p>

            {setupRequired && (
              <div className="rounded-xl border border-[#2F3E4E]/25 dark:border-amber-400/40 bg-[#FEF2C8]/75 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs font-medium text-[#2F3E4E] dark:text-amber-200">
                <strong className="font-bold">Initial Vault Activation:</strong> Enter your
                authorized Email ID and Password below to configure and unlock the Vault.
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
              {/* Email ID Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="vcpl-locked-page-email"
                  className="inline-flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                >
                  <Mail className="w-3.5 h-3.5 text-[#9E2A2B] dark:text-rose-400" aria-hidden="true" />
                  <span>Authorized Email ID</span>
                </label>

                <div className="relative flex items-center">
                  <input
                    ref={emailFieldRef}
                    id="vcpl-locked-page-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    disabled={isSubmitting}
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter authorized email ID..."
                    className={`w-full min-h-[46px] pl-4 pr-10 py-2.5 rounded-xl border-[1.5px] bg-white dark:bg-[#0B1120] text-base sm:text-sm font-medium text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 ${
                      authError
                        ? 'border-[#9E2A2B] focus:ring-[#9E2A2B]'
                        : 'border-[#2F3E4E] dark:border-slate-600 focus:ring-[#F9C80E]'
                    }`}
                  />
                  {emailInput.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailInput('');
                        setAuthError('');
                        emailFieldRef.current?.focus();
                      }}
                      aria-label="Clear email input"
                      className="absolute right-2.5 p-1.5 rounded-md text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="vcpl-locked-page-password"
                    className="inline-flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#9E2A2B] dark:text-rose-400" aria-hidden="true" />
                    <span>Vault Access Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white py-1 px-1.5 rounded cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Show</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    ref={passwordFieldRef}
                    id="vcpl-locked-page-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={setupRequired ? 'new-password' : 'current-password'}
                    spellCheck={false}
                    disabled={isSubmitting}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter vault password..."
                    className={`w-full min-h-[46px] pl-4 pr-10 py-2.5 rounded-xl border-[1.5px] bg-white dark:bg-[#0B1120] text-base sm:text-sm font-mono font-semibold text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 ${
                      authError
                        ? 'border-[#9E2A2B] focus:ring-[#9E2A2B]'
                        : 'border-[#2F3E4E] dark:border-slate-600 focus:ring-[#F9C80E]'
                    }`}
                  />
                  {passwordInput.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordInput('');
                        setAuthError('');
                        passwordFieldRef.current?.focus();
                      }}
                      aria-label="Clear password input"
                      className="absolute right-2.5 p-1.5 rounded-md text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#9E2A2B]/40 bg-[#FEE2E2]/80 dark:bg-rose-950/60 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#7D0B0B] dark:text-rose-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#9E2A2B] dark:text-rose-400" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-[1.5px] border-[#7D0B0B] bg-[#9E2A2B] hover:bg-[#7D0B0B] disabled:opacity-60 text-[#FFFDF5] shadow-[0_3px_0_#5C0909] font-display font-extrabold text-sm transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Unlock className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Verifying...'
                      : setupRequired
                        ? 'Activate & Unlock Vault'
                        : 'Sign In & Unlock Vault'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onBackHome}
                  className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-[#2F3E4E] dark:text-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Home</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    );
  }

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

          <button
            type="button"
            onClick={handleLockPage}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#7D0B0B] bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] text-xs font-display font-extrabold shadow-[0_2px_0_#5C0909] transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Lock Vault Page</span>
          </button>
        </div>

        {/* Vault Banner + Filter Header */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#7D0B0B] dark:border-rose-500/50 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#7D0B0B] dark:shadow-[0_5px_0_#020617] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono font-bold">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#9E2A2B] text-[#FFFDF5]">
                  <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>VAULT UNLOCKED</span>
                </span>
                {vaultEmail && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200">
                    <Mail className="w-3 h-3 text-[#9E2A2B] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>{vaultEmail}</span>
                  </span>
                )}
                <span className="text-[#475569] dark:text-slate-400 tabular-nums">
                  {lockedTools.length} Enabled Modules
                </span>
                <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>100% Client-Side Execution</span>
                </span>
              </div>
              <h1 className="font-display font-extrabold text-[clamp(1.6rem,3vw,2.35rem)] text-[#2F3E4E] dark:text-slate-50 tracking-tight leading-tight">
                VCPL Locked Enterprise &amp; Banking Vault
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
                Direct index of all {lockedTools.length} enabled VCPL reconciliation engines, bulk
                SBI RTGS/NEFT banking letters, 26AS TDS/TCS ledger audits, incentive reports, DBS
                P&amp;L analytics, IOCL fuel compilers, Covering Letter Generator, and Rent Payment
                Letter Maker—all open directly without secondary passcodes.
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

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#12805C] text-[#FFFDF5] text-[10px] font-display font-extrabold uppercase tracking-wider shrink-0">
                        <Unlock className="w-2.5 h-2.5" aria-hidden="true" />
                        <span>Enabled</span>
                      </span>
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
                      <span>Launch Tool</span>
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
