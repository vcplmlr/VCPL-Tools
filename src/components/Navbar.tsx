import { memo, useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  Clock,
  Facebook,
  Files,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Instagram,
  Keyboard,
  Landmark,
  Linkedin,
  Lock,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserCheck,
  X,
  Youtube,
} from 'lucide-react';
import { useEnterpriseAuth } from '../context/EnterpriseAuthContext';
import { ThemePreference } from '../hooks/useTheme';
import { ThemeSelector } from './ThemeSelector';
import { VcplBrandLogo } from './VcplBrandLogo';

export type IconMenuKey =
  | 'home'
  | 'banking'
  | 'tax-gst'
  | 'pdf-tools'
  | 'image-studio'
  | 'image-qr'
  | 'typing-text'
  | 'vcpl-tools'
  | 'special-tools'
  | 'learn-tools'
  | 'blog'
  | 'locked'
  | 'portal'
  | 'super-admin'
  | 'calculator'
  | 'all-tools';

interface NavbarProps {
  activeIconMenu: IconMenuKey | null;
  isVaultUnlocked?: boolean;
  onHomeClick: () => void;
  onSelectIconMenu: (key: IconMenuKey) => void;
  themePreference: ThemePreference;
  onChangeTheme: (next: ThemePreference) => void;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const IST_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

function formatIstNow(now: Date) {
  const datePart = IST_DATE_FORMATTER.format(now);
  const timePart = IST_TIME_FORMATTER.format(now).toUpperCase();
  return { datePart, timePart };
}

const IstClock = memo(function IstClock() {
  const [istNow, setIstNow] = useState(() => formatIstNow(new Date()));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIstNow(formatIstNow(new Date()));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      className="flex items-center gap-2 text-[11px] sm:text-xs font-medium min-w-0"
      aria-label="Indian Standard Time"
    >
      <Clock className="w-3.5 h-3.5 text-[#F9C80E] shrink-0" aria-hidden="true" />
      <span className="truncate font-mono tabular-nums tracking-tight">
        <span className="text-[#FEF2C8] font-semibold">{istNow.datePart}</span>
        <span className="mx-1.5 text-[#94A3B8]" aria-hidden="true">
          ·
        </span>
        <span className="text-[#F9C80E] font-bold">{istNow.timePart}</span>
        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#CEE5DC]">
          IST
        </span>
      </span>
    </div>
  );
});

const ICON_MENU_ITEMS: {
  key: Exclude<IconMenuKey, 'calculator' | 'portal' | 'super-admin'>;
  label: string;
  Icon: typeof Home;
}[] = [
  { key: 'home', label: 'HOME', Icon: Home },
  { key: 'vcpl-tools', label: 'VCPL TOOLS', Icon: Building2 },
  { key: 'banking', label: 'BANK SLIPS', Icon: Landmark },
  { key: 'tax-gst', label: 'TAX & GST', Icon: Receipt },
  { key: 'pdf-tools', label: 'PDF', Icon: Files },
  { key: 'image-studio', label: 'IMAGE', Icon: ImageIcon },
  { key: 'image-qr', label: 'QR & TOOLS', Icon: QrCode },
  { key: 'typing-text', label: 'TYPING & TEXT', Icon: Keyboard },
  { key: 'learn-tools', label: 'LEARN', Icon: GraduationCap },
  { key: 'special-tools', label: 'SPECIAL', Icon: Sparkles },
  { key: 'blog', label: 'BLOG', Icon: BookOpen },
  { key: 'locked', label: 'LOCKED', Icon: Lock },
];

const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/',
    renderIcon: () => <Instagram className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/',
    renderIcon: () => <Youtube className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/',
    renderIcon: () => <Facebook className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/',
    renderIcon: () => (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/',
    renderIcon: () => <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />,
  },
];

export function Navbar({
  activeIconMenu,
  isVaultUnlocked = false,
  onHomeClick,
  onSelectIconMenu,
  themePreference,
  onChangeTheme,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, isSuperAdmin, logout } = useEnterpriseAuth();
  const cleanUserDisplayName = (user?.fullName?.trim() || user?.displayUsername || '').replace(/^@+/, '');

  return (
    <>
      {/* Top Utility Strip Above Main Menu: Left = Live IST Date/Time, Right = Single Workspace Login + Social Icons */}
      <div
        className="w-full bg-[#2F3E4E] dark:bg-[#060A13] text-[#FFFDF5] border-b border-[#1E293B] dark:border-slate-800 no-print"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-[1440px] mx-auto pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 min-h-[2.5rem] py-1 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <IstClock />

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Single Unified Workspace Login / Account Controls */}
            <div className="flex items-center gap-1.5" aria-label="Workspace Login">
              {isAuthenticated && user ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSelectIconMenu(isSuperAdmin ? 'super-admin' : 'portal');
                    }}
                    title="Open My VCPL Workspace"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#CEE5DC] text-[#0F172A] hover:bg-[#F9C80E] text-[11px] font-display font-extrabold tracking-tight transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{cleanUserDisplayName}</span>
                  </button>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSelectIconMenu('super-admin');
                      }}
                      title="Open Super Admin Control Panel"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F9C80E] hover:bg-[#FDE047] text-[#0F172A] text-[11px] font-display font-extrabold tracking-tight transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Admin Panel</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void logout();
                    }}
                    title="Sign Out"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] border border-white/15 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSelectIconMenu('portal');
                  }}
                  title="Sign in to VCPL Tools Workspace"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#F9C80E] hover:bg-[#FDE047] text-[#0F172A] text-[11px] font-display font-extrabold tracking-tight transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Login</span>
                </button>
              )}
            </div>

            <span className="hidden sm:inline-block h-4 w-px bg-white/20" aria-hidden="true" />

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" aria-label="Developer Social Media Links">
              <span className="hidden lg:inline text-[11px] text-[#CBD5E1] mr-1 font-medium">
                Follow Developer:
              </span>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow Developer on ${social.name}`}
                  title={social.name}
                  className="w-6 h-6 rounded-md bg-[#FFFDF5]/10 hover:bg-[#F9C80E] text-[#FFFDF5] hover:text-[#2F3E4E] border border-white/15 hover:border-[#F9C80E] flex items-center justify-center transition-colors duration-150"
                >
                  {social.renderIcon()}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Responsive Menu Bar */}
      <header className="w-full bg-[#FEF2C8]/95 dark:bg-[#0B1120]/95 backdrop-blur-xs border-b-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700/80 md:sticky md:top-0 z-40 no-print transition-colors duration-200">
        <div className="max-w-[1440px] mx-auto pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 min-h-14 sm:min-h-16 py-1.5 flex items-center justify-between gap-2 xl:gap-3">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onHomeClick();
            }}
            aria-label="VCPL Tools Home"
            className="inline-flex items-center whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] rounded-lg px-1 py-0.5 transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <VcplBrandLogo variant="header" className="h-8 lg:h-7 xl:h-8 2xl:h-9" />
          </button>

          {/* Suite Navigation Menu — All items clearly visible without clipping */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex flex-wrap 2xl:flex-nowrap items-center justify-center 2xl:justify-end gap-1 flex-1 min-w-0 py-0.5"
          >
            {ICON_MENU_ITEMS.map(({ key, label, Icon }) => {
              const isActive = activeIconMenu === key;
              const isLockedItem = key === 'locked';
              const ItemIcon = isLockedItem && isVaultUnlocked ? Unlock : Icon;
              const itemLabel = isLockedItem && isVaultUnlocked ? 'UNLOCKED' : label;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSelectIconMenu(key);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  title={
                    isLockedItem
                      ? isVaultUnlocked
                        ? 'Locked Enterprise Vault (Unlocked)'
                        : 'Open Locked Enterprise Vault'
                      : undefined
                  }
                  className={`inline-flex items-center gap-1 xl:gap-1.5 px-1.5 xl:px-2 py-1.5 rounded-lg text-[9.5px] xl:text-[10px] 2xl:text-[10.5px] font-display font-extrabold tracking-tight 2xl:tracking-wide transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer border ${
                    isActive
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E] shadow-[0_2px_0_#1E293B]'
                      : isLockedItem && isVaultUnlocked
                        ? 'bg-[#CEE5DC]/90 dark:bg-emerald-950/80 text-[#12805C] dark:text-emerald-300 border-[#12805C]/40 dark:border-emerald-700 hover:bg-[#CEE5DC] dark:hover:bg-emerald-900'
                        : 'bg-[#FFFDF5]/90 dark:bg-slate-900/90 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/15 dark:border-slate-700 hover:bg-[#F9C80E]/55 dark:hover:bg-slate-800 hover:border-[#2F3E4E]/45 dark:hover:border-slate-500'
                  }`}
                >
                  <ItemIcon
                    className={`w-3 h-3 xl:w-3.5 xl:h-3.5 shrink-0 ${
                      isActive
                        ? 'text-[#F9C80E] dark:text-[#0F172A]'
                        : isLockedItem && isVaultUnlocked
                          ? 'text-[#12805C] dark:text-emerald-300'
                          : 'text-[#2F3E4E] dark:text-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{itemLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls in Main Menu Bar: Workspace Button (when signed in) + Light/Dark Switcher + Mobile Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAuthenticated && user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSelectIconMenu('portal');
                }}
                title={`Signed in as ${cleanUserDisplayName}`}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-display font-extrabold tracking-tight border transition-colors cursor-pointer whitespace-nowrap ${
                  activeIconMenu === 'portal'
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A]'
                    : 'bg-[#CEE5DC]/90 dark:bg-emerald-950/75 text-[#12805C] dark:text-emerald-300 border-[#12805C]/35'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{cleanUserDisplayName}</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSelectIconMenu('super-admin');
                }}
                title="Open Super Admin Control Panel"
                className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-display font-extrabold tracking-tight border transition-colors cursor-pointer whitespace-nowrap ${
                  activeIconMenu === 'super-admin'
                    ? 'bg-[#9E2A2B] text-[#FFFDF5] border-[#7D0B0B]'
                    : 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] hover:bg-[#1E293B]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>ADMIN</span>
              </button>
            )}

            <ThemeSelector
              preference={themePreference}
              onChange={onChangeTheme}
              size="header"
            />

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-900 text-[#2F3E4E] dark:text-slate-100 cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-[#2F3E4E]/15 dark:border-slate-700/80 bg-[#FEF2C8] dark:bg-[#0B1120] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 py-4 space-y-3">
            <nav
              aria-label="Mobile Navigation"
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {ICON_MENU_ITEMS.map(({ key, label, Icon }) => {
                const isActive = activeIconMenu === key;
                const isLockedItem = key === 'locked';
                const ItemIcon = isLockedItem && isVaultUnlocked ? Unlock : Icon;
                const itemLabel = isLockedItem && isVaultUnlocked ? 'UNLOCKED' : label;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSelectIconMenu(key);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-display font-extrabold tracking-wide border-[1.5px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                        : isLockedItem && isVaultUnlocked
                          ? 'bg-[#CEE5DC]/90 dark:bg-emerald-950/80 text-[#12805C] dark:text-emerald-300 border-[#12805C]/45 dark:border-emerald-700'
                          : 'bg-[#FFFDF5] dark:bg-slate-900 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/40 dark:border-slate-700 hover:bg-[#F9C80E]/40 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ItemIcon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-[#F9C80E] dark:text-[#0F172A]'
                          : isLockedItem && isVaultUnlocked
                            ? 'text-[#12805C] dark:text-emerald-300'
                            : 'text-[#2F3E4E] dark:text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{itemLabel}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSelectIconMenu('portal');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-900 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>
                    {isAuthenticated && user ? cleanUserDisplayName : 'Login'}
                  </span>
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSelectIconMenu('super-admin');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Admin Panel</span>
                  </button>
                )}
              </div>
              <ThemeSelector
                preference={themePreference}
                onChange={onChangeTheme}
                size="md"
              />
            </div>
          </div>
        )}
      </header>
    </>
  );
}
