import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Maximize2,
  ShieldCheck,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { useEnterpriseAuth } from '../../context/EnterpriseAuthContext.tsx';
import {
  CORE_ENTERPRISE_MODULES,
  ENTERPRISE_PERMISSION_ACTIONS,
} from '../../data/enterpriseModules.ts';
import { PUBLIC_TOOLS_CATALOG } from '../../data/toolsCatalog.ts';
import type { ToolCatalogItem } from '../../types/tools.ts';
import { CentralWorkspaceModules } from './CentralWorkspaceModules.tsx';

interface EnterprisePortalViewProps {
  onBackHome: () => void;
  onOpenTool: (tool: ToolCatalogItem, fullScreen?: boolean) => void;
  onOpenSuperAdmin: () => void;
}

export const EnterprisePortalView: React.FC<EnterprisePortalViewProps> = ({
  onBackHome,
  onOpenTool,
  onOpenSuperAdmin,
}) => {
  const {
    user,
    sessionLoading,
    isAuthenticated,
    isSuperAdmin,
    requiresPasswordChange,
    login,
    changePassword,
    requestPasswordReset,
    logout,
    hasPermission,
  } = useEnterpriseAuth();

  // Single Tally-style Sign-In state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showSignInPwd, setShowSignInPwd] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password (Manual Admin Queue) state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNote, setForgotNote] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Mandatory / Voluntary Password Change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  const [showChangePwds, setShowChangePwds] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [voluntaryChangeOpen, setVoluntaryChangeOpen] = useState(false);

  // Tool search inside employee dashboard
  const [toolSearch, setToolSearch] = useState('');

  const passwordRules = useMemo(
    () => ({
      minLen: newPwd.length >= 8,
      upper: /[A-Z]/.test(newPwd),
      lower: /[a-z]/.test(newPwd),
      numOrSpec: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPwd),
      differentFromCurrent: Boolean(newPwd) && newPwd !== currentPwd,
      matchesConfirm: Boolean(newPwd) && newPwd === confirmNewPwd,
    }),
    [confirmNewPwd, currentPwd, newPwd]
  );

  const coreModuleIds = useMemo(() => new Set(CORE_ENTERPRISE_MODULES.map((m) => m.id)), []);

  const assignedTools = useMemo(() => {
    const q = toolSearch.trim().toLowerCase();
    return PUBLIC_TOOLS_CATALOG.filter((tool) => {
      if (!isSuperAdmin && !hasPermission(tool.id, 'view')) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.code.toLowerCase().includes(q) ||
        tool.categoryName.toLowerCase().includes(q)
      );
    });
  }, [hasPermission, isSuperAdmin, toolSearch]);

  const visibleCoreModulesCount = useMemo(() => {
    return CORE_ENTERPRISE_MODULES.filter(
      (m) => m.id !== 'bmw-claims-reconciler' && (isSuperAdmin || hasPermission(m.id, 'view'))
    ).length;
  }, [hasPermission, isSuperAdmin]);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError('');

    const cleanUser = usernameInput.trim();
    if (!cleanUser) {
      setAuthError('Please enter your User ID.');
      return;
    }
    if (!passwordInput) {
      setAuthError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(cleanUser, passwordInput);
      setPasswordInput('');
      if (result.requiresPasswordChange) {
        setPwdError('');
        setPwdSuccess('');
        return;
      }
      if (result.user.role === 'super_admin') {
        onOpenSuperAdmin();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    setForgotError('');
    setForgotMessage('');
    const clean = forgotUsername.trim();
    if (!clean) {
      setForgotError('Please enter your User ID.');
      return;
    }

    setForgotSubmitting(true);
    try {
      const msg = await requestPasswordReset(clean, forgotNote.trim());
      setForgotMessage(msg);
      setForgotNote('');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Unable to submit reset request.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdSubmitting) return;
    setPwdError('');
    setPwdSuccess('');

    if (!currentPwd || !newPwd || !confirmNewPwd) {
      setPwdError('All password fields are required.');
      return;
    }
    if (newPwd !== confirmNewPwd) {
      setPwdError('New password and confirmation do not match.');
      return;
    }

    setPwdSubmitting(true);
    try {
      const updatedUser = await changePassword(currentPwd, newPwd, confirmNewPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
      setVoluntaryChangeOpen(false);
      setPwdSuccess('Password updated cleanly. Your temporary password has been invalidated.');
      if (updatedUser.role === 'super_admin') {
        onOpenSuperAdmin();
      }
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPwdSubmitting(false);
    }
  };

  if (sessionLoading && !isAuthenticated) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-16 min-h-[calc(100dvh-140px)] flex items-center justify-center">
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl px-7 py-6 shadow-[0_4px_0_#2F3E4E] text-center space-y-2.5">
          <div className="w-7 h-7 mx-auto rounded-full border-2 border-[#2F3E4E] dark:border-slate-600 border-t-[#F9C80E] animate-spin" />
          <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
            Checking VCPL Workspace Session...
          </p>
        </div>
      </section>
    );
  }

  // =========================================================================
  // STATE 1: MANDATORY PASSWORD CHANGE SCREEN (FIRST LOGIN OR ADMIN RESET)
  // =========================================================================
  if (isAuthenticated && requiresPasswordChange && user) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-10 sm:py-14 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="w-full max-w-lg mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-amber-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEE2E2] dark:bg-rose-950/70 border border-[#9E2A2B]/40 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#7D0B0B] dark:text-rose-200">
                    Mandatory Security Step
                  </span>
                  <h1 className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-50 mt-1">
                    Set Your Personal Password
                  </h1>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 font-mono mt-0.5">
                    Account: {user.fullName} ({user.displayUsername.replace(/^@+/, '')})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 text-xs font-bold text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-amber-500/35 bg-[#FEF2C8]/75 dark:bg-amber-950/35 px-4 py-3 text-xs text-[#2F3E4E] dark:text-amber-100 leading-relaxed">
              Your temporary password was issued by your administrator. Replace it with a strong
              personal password before accessing VCPL Tools files or modules. Your temporary
              password will be invalidated immediately upon saving.
            </div>

            <form onSubmit={(e) => void handlePasswordChangeSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="vcpl-force-current-pwd"
                    className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                  >
                    Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowChangePwds((p) => !p)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#475569] dark:text-slate-300 cursor-pointer"
                  >
                    {showChangePwds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showChangePwds ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  id="vcpl-force-current-pwd"
                  type={showChangePwds ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter your temporary password..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="vcpl-force-new-pwd"
                  className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                >
                  New Personal Password
                </label>
                <input
                  id="vcpl-force-new-pwd"
                  type={showChangePwds ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Create strong personal password..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="vcpl-force-confirm-pwd"
                  className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                >
                  Confirm New Password
                </label>
                <input
                  id="vcpl-force-confirm-pwd"
                  type={showChangePwds ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmNewPwd}
                  onChange={(e) => setConfirmNewPwd(e.target.value)}
                  placeholder="Re-enter new personal password..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>

              {/* Live strength checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-3 text-[11px]">
                {[
                  { ok: passwordRules.minLen, label: 'At least 8 characters' },
                  { ok: passwordRules.upper, label: '1 uppercase letter (A-Z)' },
                  { ok: passwordRules.lower, label: '1 lowercase letter (a-z)' },
                  { ok: passwordRules.numOrSpec, label: '1 number or symbol' },
                  { ok: passwordRules.differentFromCurrent, label: 'Different from temp password' },
                  { ok: passwordRules.matchesConfirm, label: 'Matches confirmation' },
                ].map((rule) => (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-1.5 font-medium ${
                      rule.ok
                        ? 'text-[#12805C] dark:text-emerald-400'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>

              {pwdError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#9E2A2B]/40 bg-[#FEE2E2]/80 dark:bg-rose-950/60 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#7D0B0B] dark:text-rose-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pwdSubmitting}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#12805C] hover:bg-[#0E6A4B] disabled:opacity-60 text-[#FFFDF5] shadow-[0_3px_0_#0A4F38] font-display font-extrabold text-sm cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{pwdSubmitting ? 'Updating Password...' : 'Save Password & Enter Workspace'}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // STATE 2: SINGLE TALLY-STYLE ENTERPRISE SIGN-IN SCREEN
  // =========================================================================
  if (!isAuthenticated || !user) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-10 sm:py-16 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="w-full max-w-md mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-4">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#2F3E4E] border-[1.5px] border-[#1E293B] text-[#F9C80E] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E]">
                  VCPL TOOLS
                </p>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight mt-0.5">
                  Secure Company Workspace
                </h1>
              </div>
            </div>

            {!forgotOpen ? (
              <form onSubmit={(e) => void handleSignInSubmit(e)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="vcpl-portal-username"
                    className="block text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                  >
                    User ID
                  </label>
                  <input
                    id="vcpl-portal-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    spellCheck={false}
                    disabled={isSubmitting}
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter your User ID"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-medium text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="vcpl-portal-password"
                      className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSignInPwd((p) => !p)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                    >
                      {showSignInPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showSignInPwd ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    id="vcpl-portal-password"
                    name="password"
                    type={showSignInPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter password"
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#9E2A2B]/40 bg-[#FEE2E2]/80 dark:bg-rose-950/60 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#7D0B0B] dark:text-rose-200"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] shadow-[0_3px_0_#1E293B] font-display font-extrabold text-sm cursor-pointer disabled:opacity-60"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isSubmitting ? 'Signing In...' : 'Login'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBackHome}
                    className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Home</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotUsername(usernameInput.trim());
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    className="inline-flex items-center gap-1.5 font-bold text-[#9E2A2B] dark:text-rose-300 hover:underline cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Forgot Password?</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Forgot Password Manual Admin Queue */
              <form onSubmit={(e) => void handleForgotSubmit(e)} className="space-y-4">
                <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FEF2C8]/75 dark:bg-slate-800/70 px-3.5 py-3 text-xs text-[#2F3E4E] dark:text-slate-200 leading-relaxed">
                  <strong>Password Reset Request:</strong> Submit your User ID below. Your request
                  goes straight to the Super Admin control queue, who will issue a one-time temporary
                  password directly.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    User ID *
                  </label>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="Enter your User ID..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Reason / Department Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={forgotNote}
                    onChange={(e) => setForgotNote(e.target.value)}
                    placeholder="e.g. Accounts Desk — need temporary password"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>

                {forgotError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#9E2A2B]/40 bg-[#FEE2E2]/80 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-[#7D0B0B] dark:text-rose-200"
                  >
                    {forgotError}
                  </div>
                )}

                {forgotMessage && (
                  <div className="rounded-xl border border-[#12805C]/40 bg-[#CEE5DC]/75 dark:bg-emerald-950/50 px-3.5 py-3 text-xs font-semibold text-[#12805C] dark:text-emerald-200">
                    {forgotMessage}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] font-display font-extrabold text-xs cursor-pointer disabled:opacity-60"
                  >
                    {forgotSubmitting ? 'Submitting...' : 'Submit Reset Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // STATE 3: AUTHORIZED COMPANY WORKSPACE
  // =========================================================================
  const cleanDisplayName = (user.fullName?.trim() || user.displayUsername || '').replace(/^@+/, '');

  return (
    <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-6 sm:py-8 min-h-[calc(100dvh-140px)]">
      <div className="max-w-[1440px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={onOpenSuperAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] shadow-[0_2px_0_#1E293B] text-xs font-display font-extrabold cursor-pointer"
              >
                <UserCog className="w-4 h-4" />
                <span>Open Super Admin Control Panel</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setVoluntaryChangeOpen((p) => !p);
                setPwdError('');
                setPwdSuccess('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#7D0B0B] bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] text-xs font-display font-extrabold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* User Profile Identity Card */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#12805C] text-[#FFFDF5] flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#12805C]/30 text-[#12805C] dark:text-emerald-300">
                    {user.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#2F3E4E] text-[#F9C80E]">
                    {user.role === 'super_admin' ? 'SUPER ADMIN' : 'EMPLOYEE'}
                  </span>
                  <span className="text-[#475569] dark:text-slate-300">
                    {user.displayUsername.replace(/^@+/, '')}
                  </span>
                  {user.employeeId && (
                    <span className="text-[#64748B] dark:text-slate-400">· ID {user.employeeId}</span>
                  )}
                </div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50">
                  {cleanDisplayName}
                </h1>
                <p className="text-xs text-[#475569] dark:text-slate-300">
                  <strong>{user.designation}</strong> · {user.department}
                  {user.lastLoginAt && (
                    <span className="ml-2 font-mono tabular-nums text-[11px] text-[#64748B] dark:text-slate-400">
                      · Last Login: {new Date(user.lastLoginAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="px-3 py-2 rounded-xl bg-[#FEF2C8]/75 dark:bg-slate-900 border border-[#2F3E4E]/15 dark:border-slate-700">
                <p className="text-lg font-mono font-extrabold tabular-nums text-[#2F3E4E] dark:text-[#F9C80E]">
                  {visibleCoreModulesCount}
                </p>
                <p className="text-[10px] font-display font-bold uppercase text-[#64748B] dark:text-slate-400">
                  Core Modules
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#FEF2C8]/75 dark:bg-slate-900 border border-[#2F3E4E]/15 dark:border-slate-700">
                <p className="text-lg font-mono font-extrabold tabular-nums text-[#2F3E4E] dark:text-[#F9C80E]">
                  {assignedTools.length}
                </p>
                <p className="text-[10px] font-display font-bold uppercase text-[#64748B] dark:text-slate-400">
                  Assigned Tools
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#CEE5DC]/65 dark:bg-emerald-950/40 border border-[#12805C]/25">
                <p className="text-lg font-mono font-extrabold tabular-nums text-[#12805C] dark:text-emerald-300">
                  Drive
                </p>
                <p className="text-[10px] font-display font-bold uppercase text-[#12805C] dark:text-emerald-300">
                  Central Vault
                </p>
              </div>
            </div>
          </div>

          {pwdSuccess && (
            <div className="rounded-xl border border-[#12805C]/40 bg-[#CEE5DC]/75 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-semibold text-[#12805C] dark:text-emerald-200">
              {pwdSuccess}
            </div>
          )}

          {voluntaryChangeOpen && (
            <form
              onSubmit={(e) => void handlePasswordChangeSubmit(e)}
              className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-display font-extrabold uppercase text-[#475569] dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPwd}
                  onChange={(e) => setConfirmNewPwd(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={pwdSubmitting}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-display font-extrabold cursor-pointer"
              >
                {pwdSubmitting ? 'Saving...' : 'Update Password'}
              </button>
              {pwdError && (
                <p className="md:col-span-4 text-xs font-semibold text-[#9E2A2B] dark:text-rose-300">
                  {pwdError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Centralized Multi-User Workspace Modules */}
        <CentralWorkspaceModules />

        {/* Assigned VCPL Pro Tools Grid */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-50">
                Your Assigned VCPL Tools ({assignedTools.length})
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Available across any computer or browser according to permissions assigned by Super Admin.
              </p>
            </div>
            <input
              type="text"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder="Filter your assigned tools..."
              className="w-full sm:w-72 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
            />
          </div>

          {assignedTools.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#2F3E4E]/30 dark:border-slate-700 rounded-xl text-xs text-[#64748B] dark:text-slate-400">
              No tools have been assigned to your account yet (or none matched your filter). Contact
              your Super Admin to assign tool permissions.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedTools.map((tool) => {
                const grantedActions = ENTERPRISE_PERMISSION_ACTIONS.filter((a) =>
                  isSuperAdmin ? true : hasPermission(tool.id, a.key)
                );
                const isCore = coreModuleIds.has(tool.id);

                return (
                  <article
                    key={tool.id}
                    className="rounded-xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-extrabold text-[#12805C] dark:text-emerald-400">
                          {tool.code}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-300 font-semibold">
                          {isCore ? 'Core Enterprise' : tool.categoryName}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                        {tool.title}
                      </h3>

                      <p className="text-xs text-[#475569] dark:text-slate-300 line-clamp-2">
                        {tool.description}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {grantedActions.slice(0, 6).map((act) => (
                          <span
                            key={act.key}
                            className="px-1.5 py-0.5 rounded-md border border-[#12805C]/25 bg-[#CEE5DC]/50 dark:bg-emerald-950/50 text-[10px] font-mono font-bold text-[#12805C] dark:text-emerald-300"
                          >
                            {act.shortLabel}
                          </span>
                        ))}
                        {grantedActions.length > 6 && (
                          <span className="px-1.5 py-0.5 rounded-md border border-[#2F3E4E]/20 text-[10px] font-mono font-bold text-[#64748B] dark:text-slate-400">
                            +{grantedActions.length - 6}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenTool(tool, false)}
                        className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer"
                      >
                        <span>Open Tool</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTool(tool, true)}
                        title="Open Fullscreen"
                        aria-label={`Open ${tool.title} Fullscreen`}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
