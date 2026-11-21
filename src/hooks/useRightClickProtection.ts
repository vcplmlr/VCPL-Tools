import { useEffect } from 'react';

let programmaticCopyDepth = 0;

/**
 * Temporarily permits a programmatic copy operation triggered by an explicit
 * "Copy" / "Copy Text" button while global user-selection/copy lock is active.
 */
export function runWithCopyAllowed<T>(fn: () => T): T {
  programmaticCopyDepth += 1;
  try {
    return fn();
  } finally {
    programmaticCopyDepth = Math.max(0, programmaticCopyDepth - 1);
  }
}

/**
 * Copies text safely via Clipboard API with a programmatic fallback that works
 * even when normal manual text copying is disabled across the page.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback below
  }

  if (typeof document === 'undefined' || !document.body) return false;
  return runWithCopyAllowed(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    const activeEl = document.activeElement as HTMLElement | null;
    try {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
      if (activeEl && typeof activeEl.focus === 'function') {
        try {
          activeEl.focus({ preventScroll: true });
        } catch {
          // Ignore focus restore failures
        }
      }
    }
  });
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'range',
  'color',
  'image',
  'hidden',
]);

function resolveElement(target: EventTarget | null): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (typeof Node !== 'undefined' && target instanceof Node) {
    return target.parentElement;
  }
  const maybeNode = target as { nodeType?: number; parentElement?: Element | null };
  if (maybeNode && typeof maybeNode.nodeType === 'number') {
    return maybeNode.parentElement ?? null;
  }
  return null;
}

/**
 * Returns true strictly for editable form controls, contentEditable regions,
 * or explicit [data-allow-copy="true"] containers.
 */
export function isEditableOrAllowedCopyTarget(target: EventTarget | null): boolean {
  const el = resolveElement(target);
  if (!el) return false;

  if (el.closest('[data-allow-copy="true"]')) return true;

  const editableAncestor = el.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
  );
  if (!editableAncestor) return false;

  const tag = editableAncestor.tagName;
  if (tag === 'INPUT') {
    const inputType = ((editableAncestor as HTMLInputElement).type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }
  return true;
}

const LOCK_STYLE_ID = 'vcpl-copy-lock-style';
const LOCK_CSS = `
  html, body, body * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"]):not([type="hidden"]),
  textarea,
  select,
  [contenteditable=""],
  [contenteditable="true"],
  [contenteditable="plaintext-only"],
  [data-allow-copy="true"],
  [data-allow-copy="true"] * {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    user-select: text !important;
    -webkit-touch-callout: default !important;
  }
`;

/**
 * Enforces site-wide right-click disablement + normal text copy/selection lock
 * on a Document (main page or same-origin iframe), while preserving typing/editing
 * in inputs, textareas, selects, and contenteditable zones.
 */
export function protectDocument(doc: Document, win?: Window | null): () => void {
  const isMainDoc = typeof document !== 'undefined' && doc === document;
  let injectedStyle: HTMLStyleElement | null = null;

  if (!isMainDoc && doc.head && !doc.getElementById(LOCK_STYLE_ID)) {
    const styleEl = doc.createElement('style');
    styleEl.id = LOCK_STYLE_ID;
    styleEl.textContent = LOCK_CSS;
    doc.head.appendChild(styleEl);
    injectedStyle = styleEl;
  }

  const preventContext = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
  };

  const preventSecondaryButton = (event: MouseEvent | PointerEvent) => {
    if (event.button === 2 || (event.buttons & 2) === 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const preventSelectStart = (event: Event) => {
    if (!isEditableOrAllowedCopyTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const preventManualCopyOrCut = (event: ClipboardEvent) => {
    if (programmaticCopyDepth > 0) return;
    if (!isEditableOrAllowedCopyTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const preventProtectedShortcuts = (event: KeyboardEvent) => {
    const key = (event.key || '').toUpperCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    // Always block context menu keys, DevTools/view-source, and page save everywhere
    if (
      key === 'CONTEXTMENU' ||
      key === 'F12' ||
      (event.shiftKey && key === 'F10') ||
      (ctrlOrMeta && event.shiftKey && (key === 'I' || key === 'J' || key === 'C')) ||
      (ctrlOrMeta && (key === 'U' || key === 'S'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // Block Copy / Cut / Select-All / Ctrl+Insert outside editable controls
    const isCopyCutSelectKey =
      (ctrlOrMeta && !event.altKey && (key === 'C' || key === 'X' || key === 'A' || key === 'INSERT')) &&
      !(event.shiftKey && key === 'C');

    if (isCopyCutSelectKey) {
      const targetAllowed =
        isEditableOrAllowedCopyTarget(event.target) ||
        isEditableOrAllowedCopyTarget(doc.activeElement);
      if (!targetAllowed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  };

  const preventUnwantedDrag = (event: DragEvent) => {
    if (event.target instanceof HTMLImageElement || !isEditableOrAllowedCopyTarget(event.target)) {
      event.preventDefault();
    }
  };

  const targets: EventTarget[] = win ? [win, doc] : [doc];
  for (const t of targets) {
    t.addEventListener('contextmenu', preventContext, { capture: true });
    t.addEventListener('auxclick', preventSecondaryButton as EventListener, { capture: true });
    t.addEventListener('mousedown', preventSecondaryButton as EventListener, { capture: true });
    t.addEventListener('pointerdown', preventSecondaryButton as EventListener, { capture: true });
    t.addEventListener('keydown', preventProtectedShortcuts as EventListener, { capture: true });
  }

  doc.addEventListener('selectstart', preventSelectStart, { capture: true });
  doc.addEventListener('copy', preventManualCopyOrCut as EventListener, { capture: true });
  doc.addEventListener('cut', preventManualCopyOrCut as EventListener, { capture: true });
  doc.addEventListener('dragstart', preventUnwantedDrag as EventListener, { capture: true });

  const ensureBodyAttributes = () => {
    if (!doc.body) return;
    if (doc.body.getAttribute('oncontextmenu') !== 'return false;') {
      doc.body.setAttribute('oncontextmenu', 'return false;');
    }
    if (doc.body.getAttribute('onselectstart') !== 'return false;') {
      doc.body.setAttribute('onselectstart', 'return false;');
    }
  };
  ensureBodyAttributes();

  let observer: MutationObserver | null = null;
  if (doc.body && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      ensureBodyAttributes();
    });
    observer.observe(doc.body, {
      attributes: true,
      attributeFilter: ['oncontextmenu', 'onselectstart'],
    });
  }

  return () => {
    for (const t of targets) {
      t.removeEventListener('contextmenu', preventContext, { capture: true });
      t.removeEventListener('auxclick', preventSecondaryButton as EventListener, { capture: true });
      t.removeEventListener('mousedown', preventSecondaryButton as EventListener, { capture: true });
      t.removeEventListener('pointerdown', preventSecondaryButton as EventListener, { capture: true });
      t.removeEventListener('keydown', preventProtectedShortcuts as EventListener, { capture: true });
    }
    doc.removeEventListener('selectstart', preventSelectStart, { capture: true });
    doc.removeEventListener('copy', preventManualCopyOrCut as EventListener, { capture: true });
    doc.removeEventListener('cut', preventManualCopyOrCut as EventListener, { capture: true });
    doc.removeEventListener('dragstart', preventUnwantedDrag as EventListener, { capture: true });
    observer?.disconnect();
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }
  };
}

export function useRightClickProtection() {
  useEffect(() => {
    return protectDocument(document, window);
  }, []);
}
