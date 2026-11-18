import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdBlockerNotice } from './components/AdBlockerNotice';
import { AdSlot } from './components/AdSlot';
import { AllToolsPage } from './components/AllToolsPage';
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
import { LegalPageView } from './components/LegalPageView';
import { NotFoundPage } from './components/NotFoundPage';
import { RequestSection } from './components/RequestSection';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { SearchModal } from './components/SearchModal';
import { SitemapPage } from './components/SitemapPage';
import { TopLoadingBar } from './components/TopLoadingBar';
import { WhatsAppChatWidget } from './components/WhatsAppChatWidget';
import { ToolWorkspace } from './components/tools/ToolWorkspace';
import {
  OPEN_COOKIE_BANNER_EVENT,
  ensureAdSenseInitialized,
} from './config/adsense';
import { LegalPageSlug } from './data/legalPagesData';
import { TOOL_CATEGORIES, getToolById } from './data/toolsCatalog';
import { useAdBlockerDetector } from './hooks/useAdBlockerDetector';
import { useGlobalFileDropSupport } from './hooks/useGlobalFileDropSupport';
import { useRightClickProtection } from './hooks/useRightClickProtection';
import { useTheme } from './hooks/useTheme';
import { ToolCatalogItem, ToolFilterType } from './types/tools';
import { BankId } from './utils/bankSlipRenderers';
import { safeReadStorage, safeWriteStorage } from './utils/browserVault';
import {
  ParsedRoute,
  applySeoForRoute,
  getAllToolsPath,
  getLegalPath,
  getToolFullPath,
  getToolPath,
  parseLocationToRoute,
} from './utils/seoRouting';

const FAVORITES_KEY = 'vcpl_tool_favorites_v1';
const RECENTS_KEY = 'vcpl_tool_recents_v1';

const ICON_MENU_TO_FILTER: Partial<Record<IconMenuKey, ToolFilterType>> = {
  banking: 'Banking',
  'tax-gst': 'Tax & GST',
  'gst-utilities': 'GST Utilities',
  'pdf-tools': 'PDF Suite',
  'image-studio': 'Image Studio',
  'image-qr': 'Utilities',
  'typing-text': 'Typing & Text',
  'vcpl-tools': 'VCPL',
  calculator: 'Calculator',
  'all-tools': 'All',
};

const FILTER_TO_ICON_MENU: Record<ToolFilterType, IconMenuKey> = {
  All: 'all-tools',
  Banking: 'banking',
  'Tax & GST': 'tax-gst',
  'GST Utilities': 'gst-utilities',
  Calculator: 'calculator',
  'PDF Suite': 'pdf-tools',
  'Image Studio': 'image-studio',
  'Typing & Text': 'typing-text',
  Utilities: 'image-qr',
  VCPL: 'vcpl-tools',
};

export default function App() {
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
  const [navTriggerKey, setNavTriggerKey] = useState(0);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  useEffect(() => {
    applySeoForRoute(route);
  }, [route]);

  useEffect(() => {
    ensureAdSenseInitialized();
    const handleOpenPreferences = () => setCookieOpen(true);
    window.addEventListener(OPEN_COOKIE_BANNER_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_BANNER_EVENT, handleOpenPreferences);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocationToRoute(window.location.pathname, window.location.search));
      setNavTriggerKey((k) => k + 1);
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

  const handleOpenLegalPage = useCallback(
    (slug: LegalPageSlug) => {
      navigateToRoute({ view: 'legal', slug }, getLegalPath(slug));
    },
    [navigateToRoute]
  );

  const handleGoHome = useCallback(() => {
    navigateToRoute({ view: 'home' }, '/');
  }, [navigateToRoute]);

  const handleSelectIconMenu = useCallback(
    (key: IconMenuKey) => {
      if (key === 'home') {
        handleGoHome();
        return;
      }
      const mapped = ICON_MENU_TO_FILTER[key] || 'All';
      handleOpenAllTools(mapped);
    },
    [handleGoHome, handleOpenAllTools]
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
        {route.view === 'home' && (
          <>
            <HeroSection
              onExploreClick={() => handleOpenAllTools('All')}
              onQuickLaunchTool={(toolId) => handleOpenTool(toolId)}
              onOpenSearch={() => setSearchModalOpen(true)}
            />
            <HighlightsBanner />
            <CategoriesSection
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(_catId, filterKey) => handleOpenAllTools(filterKey)}
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

        {route.view === 'all-tools' && (
          <AllToolsPage
            activeFilter={route.filter}
            initialSearchQuery={route.initialQuery}
            onFilterChange={(filter) => handleOpenAllTools(filter)}
            onBackHome={handleGoHome}
            onOpenTool={(tool) => handleOpenTool(tool)}
          />
        )}

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

        {route.view === 'sitemap' && (
          <SitemapPage
            onBackHome={handleGoHome}
            onOpenAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
            onOpenTool={(tool) => handleOpenTool(tool)}
            onOpenLegalPage={handleOpenLegalPage}
          />
        )}

        {route.view === 'not-found' && (
          <NotFoundPage
            requestedPath={route.path}
            onGoHome={handleGoHome}
            onExploreAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
            onOpenCalculator={() => handleOpenTool('unified-calculator')}
            onOpenSearch={() => setSearchModalOpen(true)}
            onOpenLegalPage={handleOpenLegalPage}
            onOpenSitemap={() => navigateToRoute({ view: 'sitemap' }, '/sitemap')}
          />
        )}
      </main>

      {!isToolFullScreen && (
        <Footer
          onHomeClick={handleGoHome}
          onOpenAllTools={(filter) => handleOpenAllTools(filter ?? 'All')}
          onOpenLegalPage={handleOpenLegalPage}
          onOpenPrivacyBanner={() => setCookieOpen(true)}
          onOpenNotFound={() => navigateToRoute({ view: 'not-found', path: '/404' }, '/404')}
          onOpenSitemap={() => navigateToRoute({ view: 'sitemap' }, '/sitemap')}
        />
      )}

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
