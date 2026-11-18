import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { attachDocumentFileDropBridge } from '../../utils/fileDropUtils';
import { getToolFullPath, getToolPath } from '../../utils/seoRouting';

interface EmbeddedHtmlToolViewProps {
  tool: ToolCatalogItem;
  isRouteFullScreen?: boolean;
  onExitRouteFullScreen?: () => void;
}

export const EmbeddedHtmlToolView: React.FC<EmbeddedHtmlToolViewProps> = ({
  tool,
  isRouteFullScreen = false,
  onExitRouteFullScreen,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [inlineHeight, setInlineHeight] = useState<number>(860);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeCleanupRef = useRef<(() => void) | null>(null);
  const heightSyncCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      iframeCleanupRef.current?.();
      iframeCleanupRef.current = null;
      heightSyncCleanupRef.current?.();
      heightSyncCleanupRef.current = null;
    };
  }, []);

  const rawSrc = tool.embedHtmlPath ?? '';
  const seoFullPath = getToolFullPath(tool);
  const seoToolPath = getToolPath(tool);
  const showFullscreenLayout = isRouteFullScreen || isExpanded;
  const isPdfEditorAdvanced = tool.kind === 'pdf-editor-advanced';
  const shouldAutoSizeInline = !showFullscreenLayout && !isPdfEditorAdvanced;

  const syncIframeHeightAndOverflow = useCallback(
    (frameEl: HTMLIFrameElement | null) => {
      heightSyncCleanupRef.current?.();
      heightSyncCleanupRef.current = null;
      if (!frameEl) return;
      try {
        const doc = frameEl.contentDocument;
        if (!doc) return;
        if (shouldAutoSizeInline) {
          doc.documentElement.style.overflow = 'hidden';
          doc.documentElement.style.height = 'auto';
          if (doc.body) {
            doc.body.style.overflow = 'hidden';
            doc.body.style.height = 'auto';
            doc.body.classList.add('is-inline-embed');
          }
          let rafId = 0;
          const measure = () => {
            const appEl = doc.querySelector('.app') || doc.querySelector('main') || doc.body;
            const contentH = Math.max(
              doc.body?.scrollHeight || 0,
              appEl ? Math.ceil(appEl.getBoundingClientRect().height + 24) : 0
            );
            if (contentH > 200) {
              setInlineHeight((prev) => (Math.abs(prev - contentH) > 4 ? contentH : prev));
            }
          };
          const scheduleMeasure = () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(() => {
              rafId = 0;
              measure();
            });
          };
          scheduleMeasure();
          const ro =
            typeof ResizeObserver !== 'undefined'
              ? new ResizeObserver(() => scheduleMeasure())
              : null;
          if (ro && doc.body) ro.observe(doc.body);
          const mo = new MutationObserver(() => scheduleMeasure());
          if (doc.body) {
            mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
          }
          const win = frameEl.contentWindow;
          win?.addEventListener('resize', scheduleMeasure);

          heightSyncCleanupRef.current = () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            ro?.disconnect();
            mo.disconnect();
            win?.removeEventListener('resize', scheduleMeasure);
          };
        } else {
          doc.documentElement.style.overflow = '';
          doc.documentElement.style.height = '';
          if (doc.body) {
            doc.body.style.overflow = '';
            doc.body.style.height = '';
            doc.body.classList.remove('is-inline-embed');
          }
        }
      } catch {
        // Ignore cross-origin iframe access restrictions
      }
    },
    [shouldAutoSizeInline]
  );

  useEffect(() => {
    syncIframeHeightAndOverflow(iframeRef.current);
  }, [syncIframeHeightAndOverflow]);

  useEffect(() => {
    if (!isPdfEditorAdvanced) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'vcpl-pdf-exit-fullscreen') {
        if (isRouteFullScreen && onExitRouteFullScreen) {
          onExitRouteFullScreen();
        } else {
          setIsExpanded(false);
        }
      } else if (payload.type === 'vcpl-pdf-reset') {
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPdfEditorAdvanced, isRouteFullScreen, onExitRouteFullScreen]);

  const src = (() => {
    if (!rawSrc) return '';
    if (!isPdfEditorAdvanced) return rawSrc;
    const params = new URLSearchParams();
    params.set('embed', '1');
    if (showFullscreenLayout) params.set('full', '1');
    if (isRouteFullScreen) params.set('routeFull', '1');
    const sep = rawSrc.includes('?') ? '&' : '?';
    return `${rawSrc}${sep}${params.toString()}`;
  })();

  const hideOuterFullscreenBar = showFullscreenLayout && isPdfEditorAdvanced;

  return (
    <div className={isRouteFullScreen ? 'h-[100dvh] w-full flex flex-col bg-[#FEF2C8]' : 'space-y-4'}>
      {/* Header Banner Card matching VCPL Tools Theme */}
      {!showFullscreenLayout && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E]">
                {tool.code} · {tool.suite}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E]">
                100% Browser-Local
              </span>
              {tool.statusLabel.toLowerCase().includes('beta') && (
                <span className="px-2.5 py-0.5 rounded-md bg-[#FFE1B3] border border-[#2F3E4E] text-[11px] font-extrabold text-[#9E2A2B]">
                  {tool.statusLabel}
                </span>
              )}
            </div>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
              {tool.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-3xl">
              {tool.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Workspace</span>
            </button>

            <a
              href={seoFullPath}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${tool.title} in full browser tab (${seoFullPath})`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Full Browser Tab</span>
            </a>

            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] shadow-[0_2px_0_#1E293B] transition cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>
      )}

      {/* Workspace Container */}
      <div
        className={
          showFullscreenLayout
            ? 'fixed inset-0 z-50 bg-[#FEF2C8] flex flex-col'
            : 'bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl shadow-[0_4px_0_#2F3E4E] overflow-hidden'
        }
      >
        {showFullscreenLayout && !hideOuterFullscreenBar && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#FFFDF5] border-b-[1.5px] border-[#2F3E4E]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E] shrink-0">
                {tool.code}
              </span>
              <h1 className="font-display font-extrabold text-sm text-[#2F3E4E] truncate">
                {tool.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
              >
                <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
              {isRouteFullScreen ? (
                <a
                  href={seoToolPath}
                  onClick={(e) => {
                    if (onExitRouteFullScreen) {
                      e.preventDefault();
                      onExitRouteFullScreen();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tool Guide &amp; Exit Full View</span>
                </a>
              ) : (
                <>
                  <a
                    href={seoFullPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>New Tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] cursor-pointer whitespace-nowrap"
                  >
                    <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Exit Fullscreen</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className={showFullscreenLayout ? 'flex-1 min-h-0 bg-[#FEF2C8]' : 'w-full bg-[#FEF2C8] overflow-hidden'}>
          {src ? (
            <iframe
              ref={iframeRef}
              key={`${tool.id}-${reloadKey}`}
              src={src}
              title={tool.title}
              scrolling={shouldAutoSizeInline ? 'no' : undefined}
              style={shouldAutoSizeInline ? { height: `${inlineHeight}px` } : undefined}
              onLoad={(e) => {
                iframeCleanupRef.current?.();
                iframeCleanupRef.current = null;
                const frameEl = e.currentTarget;
                try {
                  const doc = frameEl.contentDocument;
                  if (doc) {
                    iframeCleanupRef.current = attachDocumentFileDropBridge(doc);
                  }
                } catch {
                  // Ignore cross-origin iframe access restrictions
                }
                syncIframeHeightAndOverflow(frameEl);
              }}
              className={
                showFullscreenLayout
                  ? 'w-full h-full border-0 bg-[#FEF2C8]'
                  : isPdfEditorAdvanced
                    ? 'w-full h-[820px] sm:h-[880px] border-0 bg-[#FEF2C8] block'
                    : 'w-full border-0 bg-[#FEF2C8] block overflow-hidden'
              }
            />
          ) : (
            <div className="p-10 text-center text-sm text-[#475569]">
              Tool source path is missing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
