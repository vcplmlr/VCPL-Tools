import { useEffect } from 'react';

export function useRightClickProtection() {
  useEffect(() => {
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

    const preventInspectShortcuts = (event: KeyboardEvent) => {
      const key = (event.key || '').toUpperCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (
        key === 'CONTEXTMENU' ||
        key === 'F12' ||
        (event.shiftKey && key === 'F10') ||
        (ctrlOrMeta && event.shiftKey && (key === 'I' || key === 'J' || key === 'C')) ||
        (ctrlOrMeta && key === 'U')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const preventImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };

    // Attach in capture phase so listeners fire before any page or extension bubble handlers
    window.addEventListener('contextmenu', preventContext, { capture: true });
    document.addEventListener('contextmenu', preventContext, { capture: true });
    window.addEventListener('auxclick', preventSecondaryButton, { capture: true });
    window.addEventListener('mousedown', preventSecondaryButton, { capture: true });
    window.addEventListener('pointerdown', preventSecondaryButton, { capture: true });
    window.addEventListener('keydown', preventInspectShortcuts, { capture: true });
    document.addEventListener('dragstart', preventImageDrag, { capture: true });

    // Re-enforce body oncontextmenu attribute if mutated externally
    const ensureAttribute = () => {
      if (document.body.getAttribute('oncontextmenu') !== 'return false;') {
        document.body.setAttribute('oncontextmenu', 'return false;');
      }
    };
    ensureAttribute();

    const observer = new MutationObserver(() => {
      ensureAttribute();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['oncontextmenu'],
    });

    return () => {
      window.removeEventListener('contextmenu', preventContext, { capture: true });
      document.removeEventListener('contextmenu', preventContext, { capture: true });
      window.removeEventListener('auxclick', preventSecondaryButton, { capture: true });
      window.removeEventListener('mousedown', preventSecondaryButton, { capture: true });
      window.removeEventListener('pointerdown', preventSecondaryButton, { capture: true });
      window.removeEventListener('keydown', preventInspectShortcuts, { capture: true });
      document.removeEventListener('dragstart', preventImageDrag, { capture: true });
      observer.disconnect();
    };
  }, []);
}
