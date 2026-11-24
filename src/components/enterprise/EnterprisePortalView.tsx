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
  UserPlus,
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
  onOpenLockedVault?: () => void;
}

export const EnterprisePortalView: React.FC<EnterprisePortalViewProps> = ({
  onBackHome,
  onOpenTool,
  onOpenSuperAdmin,
  onOpenLockedVault,
}) => {
  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    requiresPasswordChange,
    superAdminConfigured,
    login,
    bootstrapSuperAdmin,
    changePassword,
    requestPasswordReset,
    logout,
    hasPermission,
  } = useEnterpriseAuth();

  // Sign-In state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showSignInPwd, setShowSignInPwd] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceLoginInsteadOfBootstrap, setForceLoginInsteadOfBootstrap] = useState(false);

  // Super Admin First-Run Bootstrap state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminDesignation, setAdminDesignation] = useState('Super Administrator');
  const [adminContact, setAdminContact] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);

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

  const normalizedSignInPreview = useMemo(() => usernameInput.trim().toLowerCase(), [usernameInput]);
  const normalizedAdminPreview = useMemo(() => adminUsername.trim().toLowerCase(), [adminUsername]);

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
    setAuthSuccess('');

    const cleanUser = usernameInput.trim();
    if (!cleanUser) {
      setAuthError('Please enter your username.');
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
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError('');

    if (!adminUsername.trim() || !adminFullName.trim()) {
      setAuthError('Super Admin username and Full Name are required.');
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setAuthError('Password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await bootstrapSuperAdmin({
        username: adminUsername.trim(),
        password: adminPassword,
        fullName: adminFullName.trim(),
        designation: adminDesignation.trim() || 'Super Administrator',
        contactNumber: adminContact.trim(),
      });
      setAdminPassword('');
      setAdminConfirmPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create Super Admin account.');
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
      setForgotError('Please enter your assigned username.');
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
      await changePassword(currentPwd, newPwd, confirmNewPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmNewPwd('');
      setVoluntaryChangeOpen(false);
      setPwdSuccess('Password updated cleanly. Your temporary password has been invalidated.');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPwdSubmitting(false);
    }
  };

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
                    Account: @{user.username} ({user.fullName})
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
              Your temporary password was issued by the Super Admin. Replace it with a strong
              personal password before accessing VCPL Pro tools, files, or records. Your
              temporary password will be invalidated immediately upon update.
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
                  placeholder="Enter the temporary password..."
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
                <span>{pwdSubmitting ? 'Updating Password...' : 'Save Password & Unlock VCPL Pro'}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // STATE 2: FIRST-RUN SUPER ADMIN SETUP (IF NO SUPER ADMIN EXISTS YET)
  // =========================================================================
  if (!isAuthenticated && superAdminConfigured === false && !forceLoginInsteadOfBootstrap) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-10 sm:py-14 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="w-full max-w-xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#2F3E4E] text-[#F9C80E] flex items-center justify-center shrink-0">
                  <UserPlus className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#12805C]/30 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-emerald-300">
                    Initial Enterprise Setup
                  </span>
                  <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 mt-1">
                    Initialize VCPL Pro Super Admin
                  </h1>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Configure the primary Super Admin account using a username and strong password. Once
              initialized, you can create employee accounts (no email required), approve users,
              assign granular tool permissions, and sync snapshots with Firebase Firestore.
            </p>

            <form onSubmit={(e) => void handleBootstrapSubmit(e)} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Super Admin Username *
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. Kaushik"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                  {normalizedAdminPreview && (
                    <p className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                      Login username: @{normalizedAdminPreview}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="e.g. Kaushik Bangera"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={adminDesignation}
                    onChange={(e) => setAdminDesignation(e.target.value)}
                    placeholder="Super Administrator"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Contact Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={adminContact}
                    onChange={(e) => setAdminContact(e.target.value)}
                    placeholder="+91..."
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAdminPwd((p) => !p)}
                      className="text-[11px] font-bold text-[#475569] dark:text-slate-300 cursor-pointer"
                    >
                      {showAdminPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showAdminPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Min 8 chars, upper, lower, symbol/num"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Confirm Password *
                  </label>
                  <input
                    type={showAdminPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm font-mono text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
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
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Initializing...' : 'Create Super Admin & Enter'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForceLoginInsteadOfBootstrap(true)}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                >
                  Sign In Instead
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // STATE 3: USERNAME + PASSWORD SIGN-IN (NO EMAIL REQUIRED)
  // =========================================================================
  if (!isAuthenticated || !user) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-10 sm:py-16 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="w-full max-w-lg mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-4">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2F3E4E] border-[1.5px] border-[#1E293B] text-[#F9C80E] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#F9C80E]/35 dark:bg-amber-950/60 border border-[#2F3E4E]/25 dark:border-amber-500/40 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
                  VCPL Pro Enterprise Portal
                </span>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight mt-1">
                  Employee &amp; Admin Sign In
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Sign in using your assigned <strong>Username</strong> and <strong>Password</strong>.
              Usernames are case-insensitive and automatically normalized.
            </p>

            {!forgotOpen ? (
              <form onSubmit={(e) => void handleSignInSubmit(e)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="vcpl-portal-username"
                      className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200"
                    >
                      Username
                    </label>
                    {normalizedSignInPreview && (
                      <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                        Normalized: @{normalizedSignInPreview}
                      </span>
                    )}
                  </div>
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
                    placeholder="e.g. Kaushik or kaushik123"
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
                    placeholder="Enter password or temporary password..."
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

                {authSuccess && (
                  <div className="rounded-xl border border-[#12805C]/40 bg-[#CEE5DC]/70 px-3.5 py-2.5 text-xs font-semibold text-[#12805C]">
                    {authSuccess}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] shadow-[0_3px_0_#1E293B] font-display font-extrabold text-sm cursor-pointer disabled:opacity-60"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isSubmitting ? 'Signing In...' : 'Sign In to VCPL Pro'}</span>
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

                <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
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
                    <span>Forgot Password? Request Super Admin Reset</span>
                  </button>

                  {onOpenLockedVault && (
                    <button
                      type="button"
                      onClick={onOpenLockedVault}
                      className="font-semibold text-[#475569] dark:text-slate-400 hover:underline cursor-pointer"
                    >
                      Legacy Vault Login
                    </button>
                  )}
                </div>
              </form>
            ) : (
              /* Forgot Password Manual Admin Queue */
              <form onSubmit={(e) => void handleForgotSubmit(e)} className="space-y-4">
                <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FEF2C8]/75 dark:bg-slate-800/70 px-3.5 py-3 text-xs text-[#2F3E4E] dark:text-slate-200 leading-relaxed">
                  <strong>Manual Password Reset Request:</strong> Submit your username below. No
                  automatic emails are sent—your request goes directly to the Super Admin control
                  panel, who will generate and share a one-time temporary password with you.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Your Username *
                  </label>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    placeholder="Enter your username..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Department / Note for Super Admin (Optional)
                  </label>
                  <input
                    type="text"
                    value={forgotNote}
                    onChange={(e) => setForgotNote(e.target.value)}
                    placeholder="e.g. Accounts Desk — locked out after browser change"
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
                    Back to Sign In
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
  // STATE 4: AUTHORIZED EMPLOYEE & ADMIN PORTAL WORKSPACE
  // =========================================================================
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
                  <span className="text-[#475569] dark:text-slate-300">@{user.displayUsername}</span>
                  {user.employeeId && (
                    <span className="text-[#64748B] dark:text-slate-400">· ID {user.employeeId}</span>
                  )}
                </div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50">
                  {user.fullName}
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
                  Core Workspaces
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
                  Cloud
                </p>
                <p className="text-[10px] font-display font-bold uppercase text-[#12805C] dark:text-emerald-300">
                  Multi-Device Sync
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
                Your Assigned VCPL Pro Tools ({assignedTools.length})
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
