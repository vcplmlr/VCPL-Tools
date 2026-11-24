import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { AdBlockerNotice } from './components/AdBlockerNotice';
import { AdSlot } from './components/AdSlot';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { CategoriesSection } from './components/CategoriesSection';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  CookieConsentBanner,
} from './components/CookieConsentBanner';
import { CustomCursor } from './components/CustomCursor';
import { FaqSection } from './components/FaqSection';
import { FeaturedSlotsSection } from './components/FeaturedSlotsSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { HighlightsBanner } from './components/HighlightsBanner';
import { IconMenuKey, Navbar } from './components/Navbar';
import { NewlyAddedUpgradedSection } from './components/NewlyAddedUpgradedSection';
import { RequestSection } from './components/RequestSection';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { TopLoadingBar, emitGlobalProgress } from './components/TopLoadingBar';
import { WhatsAppChatWidget } from './components/WhatsAppChatWidget';
import { WhatsNewSection } from './components/WhatsNewSection';
import { OPEN_COOKIE_BANNER_EVENT } from './config/adsense';
import { EnterpriseAuthProvider, useEnterpriseAuth } from './context/EnterpriseAuthContext';
import { mergeDynamicBlogPosts } from './data/blogPostsData';
import { HttpErrorCode } from './data/errorPagesData';
import { LegalPageSlug } from './data/legalPagesData';
import { TOOL_CATEGORIES, getToolById } from './data/toolsCatalog';
import { useAdBlockerDetector } from './hooks/useAdBlockerDetector';
import { useGlobalFileDropSupport } from './hooks/useGlobalFileDropSupport';
import { useRightClickProtection } from './hooks/useRightClickProtection';
import { useTheme } from './hooks/useTheme';
import { BlogPostItem } from './types/blog';
import { ToolCatalogItem, ToolFilterType } from './types/tools';
import { BankId } from './utils/bankSlipRenderers';
import { safeReadStorage, safeWriteStorage } from './utils/browserVault';
import {
  ParsedRoute,
  applySeoForRoute,
  getAllToolsPath,
  getBlogPath,
  getLegalPath,
  getToolFullPath,
  getToolPath,
  parseLocationToRoute,
} from './utils/seoRouting';

const AllToolsPage = lazy(() =>
  import('./components/AllToolsPage').then((m) => ({ default: m.AllToolsPage }))
);
const BlogPage = lazy(() =>
  import('./components/BlogPage').then((m) => ({ default: m.BlogPage }))
);
const LegalPageView = lazy(() =>
  import('./components/LegalPageView').then((m) => ({ default: m.LegalPageView }))
);
const NotFoundPage = lazy(() =>
  import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const SearchModal = lazy(() =>
  import('./components/SearchModal').then((m) => ({ default: m.SearchModal }))
);
const SitemapPage = lazy(() =>
  import('./components/SitemapPage').then((m) => ({ default: m.SitemapPage }))
);
const ToolWorkspace = lazy(() =>
  import('./components/tools/ToolWorkspace').then((m) => ({ default: m.ToolWorkspace }))
);
const EnterprisePortalView = lazy(() =>
  import('./components/enterprise/EnterprisePortalView').then((m) => ({
    default: m.EnterprisePortalView,
  }))
);
const SuperAdminDashboard = lazy(() =>
  import('./components/enterprise/SuperAdminDashboard').then((m) => ({
    default: m.SuperAdminDashboard,
  }))
);

function RouteLoadingFallback() {
  useEffect(() => {
    emitGlobalProgress(true, 45, 'suspense-route');
    return () => {
      emitGlobalProgress(false, 100, 'suspense-route');
    };
  }, []);

  return (
    <div className="w-full min-h-[52dvh] flex items-center justify-center bg-[#FEF2C8] dark:bg-[#0B1120] px-4 py-16">
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl px-7 py-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] text-center space-y-2.5">
        <div className="w-7 h-7 mx-auto rounded-full border-2 border-[#2F3E4E] dark:border-slate-600 border-t-[#F9C80E] animate-spin" />
        <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
          Loading Workspace...
        </p>
      </div>
    </div>
  );
}

const FAVORITES_KEY = 'vcpl_tool_favorites_v1';
const RECENTS_KEY = 'vcpl_tool_recents_v1';

const ICON_MENU_TO_FILTER: Partial<Record<IconMenuKey, ToolFilterType>> = {
  banking: 'Banking',
  'tax-gst': 'Tax & GST',
  'pdf-tools': 'PDF Suite',
  'image-studio': 'Image Studio',
  'image-qr': 'Utilities',
  'typing-text': 'Typing & Text',
  'vcpl-tools': 'VCPL',
  'special-tools': 'Special Tools',
  'learn-tools': 'Learn Tools',
  calculator: 'Calculator',
  'all-tools': 'All',
};

const FILTER_TO_ICON_MENU: Record<ToolFilterType, IconMenuKey> = {
  All: 'all-tools',
  Banking: 'banking',
  'Tax & GST': 'tax-gst',
  Calculator: 'calculator',
  'PDF Suite': 'pdf-tools',
  'Image Studio': 'image-studio',
  'Typing & Text': 'typing-text',
  Utilities: 'image-qr',
  VCPL: 'vcpl-tools',
  'Special Tools': 'special-tools',
  'Learn Tools': 'learn-tools',
};

function AppShell() {
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const {
    status: adBlockStatus,
    isRechecking: isAdBlockRechecking,
    stillBlockedAfterRetry,
    recheckAdBlocker,
  } = useAdBlockerDetector();

  useGlobalFileDropSupport();
  useRightClickProtection();

  const [route, setRoute] = useState<ParsedRoute>(() =>
    parseLocationToRoute(window.location.pathname, window.location.search)
  );
  const [blogFeedLoaded, setBlogFeedLoaded] = useState(false);
  const [navTriggerKey, setNavTriggerKey] = useState(0);
  const { isAuthenticated, isSuperAdmin, sessionLoading, requiresPasswordChange } = useEnterpriseAuth();
  const [selectedBankForSlip, setSelectedBankForSlip] = useState<BankId | undefined>(undefined);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(() => {
    try {
      return !window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() =>
    safeReadStorage<string[]>(FAVORITES_KEY, [])
  );
  const [recents, setRecents] = useState<string[]>(() =>
    safeReadStorage<string[]>(RECENTS_KEY, [])
  );

  useEffect(() => {
    let active = true;
    const loadAutoPublishedPosts = async () => {
      try {
        const res = await fetch('/api/blog/posts');
        if (!res.ok) return;
        const payload = (await res.json()) as { posts?: BlogPostItem[] };
        if (active && Array.isArray(payload.posts) && payload.posts.length > 0) {
          mergeDynamicBlogPosts(payload.posts);
          window.dispatchEvent(new CustomEvent('vcpl:blog-posts-updated'));
          setRoute((prev) => {
            if (window.location.pathname.toLowerCase().startsWith('/blog')) {
              return parseLocationToRoute(window.location.pathname, window.location.search);
            }
            return prev;
          });
        }
      } catch {
        // Ignore network errors cleanly; static posts remain available
      } finally {
        if (active) setBlogFeedLoaded(true);
      }
    };
    void loadAutoPublishedPosts();
    return () => {
      active = false;
    };
  }, []);

  const navigateToRoute = useCallback(
    (nextRoute: ParsedRoute, targetPath: string, replace = false) => {
      setRoute(nextRoute);
      setNavTriggerKey((k) => k + 1);
      if (window.location.pathname + window.location.search !== targetPath) {
        if (replace) {
          window.history.replaceState(null, '', targetPath);
        } else {
          window.history.pushState(null, '', targetPath);
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    },
    []
  );

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    applySeoForRoute(route);
  }, [route]);

  useEffect(() => {
    const handleOpenPreferences = () => setCookieOpen(true);
    window.addEventListener(OPEN_COOKIE_BANNER_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_BANNER_EVENT, handleOpenPreferences);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocationToRoute(window.location.pathname, window.location.search));
      setNavTriggerKey((k) => k + 1);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const recordRecentTool = useCallback((toolId: string) => {
    setRecents((prev) => {
      const next = [toolId, ...prev.filter((id) => id !== toolId)].slice(0, 8);
      safeWriteStorage(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback((toolId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [toolId, ...prev];
      safeWriteStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const handleOpenTool = useCallback(
    (toolOrId: ToolCatalogItem | string, fullScreen = false) => {
      const tool = typeof toolOrId === 'string' ? getToolById(toolOrId) : toolOrId;
      if (!tool) return;
      recordRecentTool(tool.id);
      const targetPath = fullScreen ? getToolFullPath(tool) : getToolPath(tool);
      navigateToRoute({ view: 'tool', toolId: tool.id, fullScreen }, targetPath);
    },
    [navigateToRoute, recordRecentTool]
  );

  const handleOpenAllTools = useCallback(
    (filter: ToolFilterType = 'All') => {
      navigateToRoute({ view: 'all-tools', filter }, getAllToolsPath(filter));
    },
    [navigateToRoute]
  );

  const handleOpenPortal = useCallback(() => {
    navigateToRoute({ view: 'portal' }, '/portal');
  }, [navigateToRoute]);

  const handleOpenSuperAdmin = useCallback(() => {
    navigateToRoute({ view: 'super-admin' }, '/super-admin');
  }, [navigateToRoute]);

  useEffect(() => {
    if (isAuthenticated && requiresPasswordChange && route.view !== 'portal') {
      navigateToRoute({ view: 'portal' }, '/portal', true);
    }
  }, [isAuthenticated, navigateToRoute, requiresPasswordChange, route.view]);

  const handleOpenBlog = useCallback(
    (slug?: string) => {
      navigateToRoute({ view: 'blog', slug }, getBlogPath(slug));
    },
    [navigateToRoute]
  );

  const handleOpenLegalPage = useCallback(
    (slug: LegalPageSlug) => {
      navigateToRoute({ view: 'legal', slug }, getLegalPath(slug));
    },
    [navigateToRoute]
  );

  const handleGoHome = useCallback(() => {
    navigateToRoute({ view: 'home' }, '/');
  }, [navigateToRoute]);

  const handleOpenErrorPage = useCallback(
    (code: HttpErrorCode = 404) => {
      const targetPath = `/${code}`;
      navigateToRoute({ view: 'not-found', path: targetPath, statusCode: code }, targetPath);
    },
    [navigateToRoute]
  );

  const handleSelectIconMenu = useCallback(
    (key: IconMenuKey) => {
      if (key === 'home') {
        handleGoHome();
        return;
      }
      if (key === 'blog') {
        handleOpenBlog();
        return;
      }
      if (key === 'portal') {
        handleOpenPortal();
        return;
      }
      if (key === 'super-admin') {
        handleOpenSuperAdmin();
        return;
      }
      const mapped = ICON_MENU_TO_FILTER[key] || 'All';
      handleOpenAllTools(mapped);
    },
    [
      handleGoHome,
      handleOpenAllTools,
      handleOpenBlog,
      handleOpenPortal,
      handleOpenSuperAdmin,
    ]
  );

  const activeFilter: ToolFilterType =
    route.view === 'all-tools'
      ? route.filter
      : route.view === 'tool'
        ? getToolById(route.toolId)?.category ?? 'All'
        : 'All';

  const activeTool =
    route.view === 'tool' ? getToolById(route.toolId) : undefined;

  const activeIconMenu: IconMenuKey | null = useMemo(() => {
    if (route.view === 'home') return 'home';
    if (route.view === 'blog') return 'blog';
    if (route.view === 'portal') return 'portal';
    if (route.view === 'super-admin') return 'super-admin';
    if (route.view === 'all-tools') return FILTER_TO_ICON_MENU[route.filter];
    if (route.view === 'tool' && activeTool) {
      return FILTER_TO_ICON_MENU[activeTool.category];
    }
    return null;
  }, [activeTool, route]);

  const selectedCategoryId = useMemo(() => {
    const found = TOOL_CATEGORIES.find((c) => c.filterKey === activeFilter);
    return found?.id ?? '';
  }, [activeFilter]);

  const isToolFullScreen = route.view === 'tool' && Boolean(route.fullScreen);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100">
      <CustomCursor />
      <TopLoadingBar triggerKey={navTriggerKey} />

      {!isToolFullScreen && (
        <Navbar
          activeIconMenu={activeIconMenu}
          onHomeClick={handleGoHome}
          onSelectIconMenu={handleSelectIconMenu}
          themePreference={themePreference}
          onChangeTheme={setThemePreference}
        />
      )}

      <main className="flex-1">
        <AppErrorBoundary
          resetKey={navTriggerKey}
          onGoHome={handleGoHome}
          onExploreAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
          onOpenCalculator={() => handleOpenTool('unified-calculator')}
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenLegalPage={handleOpenLegalPage}
          onOpenSitemap={() => navigateToRoute({ view: 'sitemap' }, '/sitemap')}
          onSelectErrorCode={handleOpenErrorPage}
        >
        {route.view === 'home' && (
          <>
            <HeroSection
              onExploreClick={() => handleOpenAllTools('All')}
              onQuickLaunchTool={(toolId) => handleOpenTool(toolId)}
              onOpenSearch={() => setSearchModalOpen(true)}
            />
            <HighlightsBanner />
            <WhatsNewSection onOpenTool={(toolId) => handleOpenTool(toolId)} />
            <NewlyAddedUpgradedSection
              onOpenTool={(toolId) => handleOpenTool(toolId)}
              onOpenAllTools={() => handleOpenAllTools('All')}
            />
            <CategoriesSection
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(_catId, filterKey) => handleOpenAllTools(filterKey)}
              onOpenBlog={() => handleOpenBlog()}
            />
            <div className="w-full bg-[#CEE5DC] dark:bg-[#0D1526] pt-8 sm:pt-10 no-print">
              <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
                <AdSlot
                  slotId="vcpl-home-billboard-top"
                  variant="billboard"
                  label="Homepage Top Billboard · 970 × 250 / 320 × 100"
                  contentContext="Indian Banking Deposit Slips, Form 26AS & GST Filing Tools"
                />
              </div>
            </div>
            <FeaturedSlotsSection
              activeFilter="All"
              onFilterChange={(filter) => handleOpenAllTools(filter)}
              onOpenTool={(tool) => handleOpenTool(tool)}
              onOpenAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
            />
            <FaqSection variant="home" />
            <div className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] pb-10 sm:pb-12 no-print">
              <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
                <AdSlot
                  slotId="vcpl-home-multiplex-bottom"
                  variant="multiplex"
                  label="Homepage Multiplex Grid · AutoRelaxed"
                  contentContext="CA, MSME, Document Conversion & Banking Software"
                />
              </div>
            </div>
            <RequestSection />
          </>
        )}

        <Suspense fallback={<RouteLoadingFallback />}>
          {route.view === 'all-tools' && (
            <AllToolsPage
              activeFilter={route.filter}
              initialSearchQuery={route.initialQuery}
              onFilterChange={(filter) => handleOpenAllTools(filter)}
              onBackHome={handleGoHome}
              onOpenTool={(tool) => handleOpenTool(tool)}
            />
          )}

          {route.view === 'portal' && (
            <EnterprisePortalView
              onBackHome={handleGoHome}
              onOpenTool={(tool, fullScreen) => handleOpenTool(tool, fullScreen)}
              onOpenSuperAdmin={handleOpenSuperAdmin}
            />
          )}

          {route.view === 'super-admin' &&
            (sessionLoading ? (
              <RouteLoadingFallback />
            ) : isSuperAdmin ? (
              <SuperAdminDashboard
                onBackPortal={handleOpenPortal}
                onBackHome={handleGoHome}
              />
            ) : !isAuthenticated ? (
              <EnterprisePortalView
                onBackHome={handleGoHome}
                onOpenTool={(tool, fullScreen) => handleOpenTool(tool, fullScreen)}
                onOpenSuperAdmin={handleOpenSuperAdmin}
              />
            ) : (
              <SuperAdminDashboard
                onBackPortal={handleOpenPortal}
                onBackHome={handleGoHome}
              />
            ))}

          {route.view === 'tool' && activeTool && (
            <ToolWorkspace
              tool={activeTool}
              initialBank={selectedBankForSlip}
              initialSubParam={route.subParam}
              isRouteFullScreen={Boolean(route.fullScreen)}
              onToggleRouteFullScreen={(full) => handleOpenTool(activeTool, full)}
              onSyncToolSubParam={(subParam) => {
                if (activeTool.id === 'rto-code-finder') {
                  const nextPath = subParam
                    ? `/tools/rto-code-finder/${encodeURIComponent(subParam)}`
                    : '/tools/rto-code-finder';
                  window.history.replaceState(null, '', nextPath);
                } else if (activeTool.id === 'pin-code-finder') {
                  const nextPath = subParam
                    ? `/tools/pin-code-finder/${encodeURIComponent(subParam)}`
                    : '/tools/pin-code-finder';
                  window.history.replaceState(null, '', nextPath);
                } else if (activeTool.id === 'bank-ifsc-finder') {
                  const nextPath = subParam
                    ? `/tools/ifsc-code-finder/${encodeURIComponent(subParam)}`
                    : '/bank-slips/bank-ifsc-finder';
                  window.history.replaceState(null, '', nextPath);
                }
              }}
              onClose={() => handleOpenAllTools(activeTool.category)}
              onOpenCategory={(cat) => handleOpenAllTools(cat)}
              onSelectTool={(id) => handleOpenTool(id)}
              onOpenBankSlipWithBank={(bankId) => {
                setSelectedBankForSlip(bankId);
                handleOpenTool('bank-slip-generator');
              }}
              onOpenDisclaimer={() => handleOpenLegalPage('disclaimer')}
              onOpenPortal={handleOpenPortal}
            />
          )}

          {route.view === 'legal' && (
            <LegalPageView
              slug={route.slug}
              onSelectPage={handleOpenLegalPage}
              onBackHome={handleGoHome}
              onOpenPrivacyBanner={() => setCookieOpen(true)}
            />
          )}

          {route.view === 'blog' && (
            <BlogPage
              activeSlug={route.slug}
              onSelectPost={(slug) => handleOpenBlog(slug)}
              onBackHome={handleGoHome}
              onOpenTool={(tool) => handleOpenTool(tool)}
            />
          )}

          {route.view === 'sitemap' && (
            <SitemapPage
              onBackHome={handleGoHome}
              onOpenAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
              onOpenTool={(tool) => handleOpenTool(tool)}
              onOpenLegalPage={handleOpenLegalPage}
              onOpenBlog={(slug) => handleOpenBlog(slug)}
            />
          )}

          {route.view === 'not-found' &&
            (!blogFeedLoaded &&
            window.location.pathname.toLowerCase().startsWith('/blog/') ? (
              <RouteLoadingFallback />
            ) : (
              <NotFoundPage
                statusCode={route.statusCode ?? 404}
                requestedPath={route.path}
                onGoHome={handleGoHome}
                onExploreAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
                onOpenCalculator={() => handleOpenTool('unified-calculator')}
                onOpenSearch={() => setSearchModalOpen(true)}
                onOpenLegalPage={handleOpenLegalPage}
                onOpenSitemap={() => navigateToRoute({ view: 'sitemap' }, '/sitemap')}
                onSelectErrorCode={handleOpenErrorPage}
              />
            ))}
        </Suspense>
        </AppErrorBoundary>
      </main>

      {!isToolFullScreen && (
        <Footer
          activeTool={activeTool}
          onHomeClick={handleGoHome}
          onOpenAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
          onOpenPortal={handleOpenPortal}
          onOpenSuperAdmin={handleOpenSuperAdmin}
          onOpenLegalPage={handleOpenLegalPage}
          onOpenBlog={() => handleOpenBlog()}
          onOpenPrivacyBanner={() => setCookieOpen(true)}
          onOpenNotFound={() => handleOpenErrorPage(404)}
          onOpenErrorPage={handleOpenErrorPage}
          onOpenSitemap={() => navigateToRoute({ view: 'sitemap' }, '/sitemap')}
        />
      )}

      {searchModalOpen && (
        <Suspense fallback={null}>
          <SearchModal
            isOpen={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
            onSelectTool={(tool) => {
              setSearchModalOpen(false);
              handleOpenTool(tool);
            }}
            activeToolId={activeTool?.id ?? null}
            isFavorite={(id) => favorites.includes(id)}
            onToggleFavorite={handleToggleFavorite}
            recents={recents}
          />
        </Suspense>
      )}

      <CookieConsentBanner
        isOpen={cookieOpen}
        onClose={() => setCookieOpen(false)}
        onClearAllLocalData={() => {
          try {
            window.localStorage.clear();
          } catch {
            // Ignore storage errors
          }
          setFavorites([]);
          setRecents([]);
        }}
      />

      {adBlockStatus === 'blocked' && (
        <AdBlockerNotice
          isRechecking={isAdBlockRechecking}
          stillBlockedAfterRetry={stillBlockedAfterRetry}
          onRecheck={() => {
            void recheckAdBlocker();
          }}
        />
      )}

      {!isToolFullScreen && (
        <WhatsAppChatWidget
          view={route.view}
          activeFilter={activeFilter}
          activeTool={activeTool}
          activeLegalSlug={route.view === 'legal' ? route.slug : undefined}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}

export default function App() {
  return (
    <EnterpriseAuthProvider>
      <AppShell />
    </EnterpriseAuthProvider>
  );
}
