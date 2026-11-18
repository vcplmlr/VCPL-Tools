/**
 * Shared file-type matching & automatic DOM drag-and-drop bridge for all VCPL Tools
 * (both React components and same-origin embedded HTML tools).
 */

export function acceptsFile(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true;
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const fileName = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  return tokens.some((token) => {
    if (token === '*' || token === '*/*') return true;
    if (token.startsWith('.')) {
      return fileName.endsWith(token);
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1);
      return mime.startsWith(prefix);
    }
    if (mime === token) return true;
    // Common fallback when OS omits file.type on drag-and-drop
    if (!mime) {
      if (token === 'application/pdf') return fileName.endsWith('.pdf');
      if (token === 'application/json') return fileName.endsWith('.json');
      if (token === 'text/csv') return fileName.endsWith('.csv');
    }
    return false;
  });
}

export function filterAcceptedFiles(
  fileList: FileList | File[] | null | undefined,
  accept?: string,
  multiple = true
): File[] {
  if (!fileList) return [];
  const arr = Array.from(fileList);
  const matched = accept ? arr.filter((f) => acceptsFile(f, accept)) : arr;
  if (!multiple && matched.length > 1) return [matched[0]];
  return matched;
}

export function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

const AUTO_DROP_CLASS = 'vcpl-auto-drop-active';

function clearDropHighlights(doc: Document) {
  doc.querySelectorAll(`.${AUTO_DROP_CLASS}`).forEach((el) => {
    el.classList.remove(AUTO_DROP_CLASS);
  });
}

function getAllEnabledFileInputs(root: Document | Element): HTMLInputElement[] {
  const inputs = Array.from(root.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
  return inputs.filter((inp) => !inp.disabled && inp.getAttribute('aria-hidden') !== 'true');
}

function resolveTargetFromEvent(
  doc: Document,
  target: EventTarget | null,
  files?: File[]
): { input: HTMLInputElement; highlightEl: HTMLElement } | null {
  if (!(target instanceof Element)) return null;

  // Let React / custom dropzones handle themselves exclusively
  if (target.closest('[data-vcpl-dropzone="custom"]')) {
    return null;
  }

  // Direct file input drop
  if (target instanceof HTMLInputElement && target.type === 'file' && !target.disabled) {
    return {
      input: target,
      highlightEl: (target.closest('label, .drop, [class*="rounded-"]') as HTMLElement) || target,
    };
  }

  // Inside a <label> linked by `for` or wrapping an <input type="file">
  const label = target.closest('label');
  if (label) {
    const forId = label.getAttribute('for');
    if (forId) {
      const linked = doc.getElementById(forId);
      if (linked instanceof HTMLInputElement && linked.type === 'file' && !linked.disabled) {
        return { input: linked, highlightEl: label as HTMLElement };
      }
    }
    const nested = label.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (nested && !nested.disabled) {
      return { input: nested, highlightEl: label as HTMLElement };
    }
  }

  // Walk upward through local container cards/wrappers to find the associated file input
  let node: Element | null = target;
  for (let depth = 0; depth < 7 && node && node !== doc.body && node !== doc.documentElement; depth++) {
    const candidates = getAllEnabledFileInputs(node);
    if (candidates.length === 1) {
      const inp = candidates[0];
      const preferredBox =
        (target.closest('.drop, [class*="border-dashed"], label, button') as HTMLElement | null) ||
        (node as HTMLElement);
      return { input: inp, highlightEl: preferredBox };
    }
    if (candidates.length > 1 && files && files.length > 0) {
      // Pick the single matching input by accept filter if unique
      const matching = candidates.filter((inp) =>
        files.some((f) => acceptsFile(f, inp.accept || undefined))
      );
      if (matching.length === 1) {
        const inp = matching[0];
        const preferredBox =
          (inp.closest('.drop, [class*="border-dashed"], label, div') as HTMLElement | null) ||
          (node as HTMLElement);
        return { input: inp, highlightEl: preferredBox };
      }
    }
    node = node.parentElement;
  }

  // Workspace-level fallback: if the entire tool area has exactly 1 active file input
  const scope = target.closest('main') || doc.body;
  if (scope) {
    const allInputs = getAllEnabledFileInputs(scope);
    if (allInputs.length === 1) {
      const inp = allInputs[0];
      const highlight =
        (inp.closest('label, .drop, [class*="border-dashed"], [class*="rounded-2xl"]') as HTMLElement | null) ||
        (scope as HTMLElement);
      return { input: inp, highlightEl: highlight };
    }
  }

  return null;
}

function assignFilesAndTriggerChange(input: HTMLInputElement, files: File[]) {
  if (!files.length) return;
  try {
    const dt = new DataTransfer();
    const list = input.multiple ? files : [files[0]];
    list.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {
    // Ignore read-only environments where DataTransfer assignment is unsupported
  }
}

export function attachDocumentFileDropBridge(doc: Document): () => void {
  let activeHighlight: HTMLElement | null = null;

  // Ensure highlight style exists inside standalone / iframe documents too
  if (doc.head && !doc.getElementById('vcpl-auto-drop-style')) {
    const style = doc.createElement('style');
    style.id = 'vcpl-auto-drop-style';
    style.textContent = `
      .${AUTO_DROP_CLASS} {
        outline: 2.5px dashed #2F3E4E !important;
        outline-offset: 2px !important;
        background-color: rgba(249, 200, 14, 0.24) !important;
        box-shadow: 0 0 0 4px rgba(249, 200, 14, 0.35) !important;
        transition: background-color 140ms ease, box-shadow 140ms ease !important;
      }
    `;
    doc.head.appendChild(style);
  }

  const hasDraggedFiles = (e: DragEvent) => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  };

  const onDragOver = (e: DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    if (e.target instanceof Element && e.target.closest('[data-vcpl-dropzone="custom"]')) {
      return;
    }

    // Prevent browser from opening dropped files in current tab
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }

    const resolved = resolveTargetFromEvent(doc, e.target);
    if (resolved) {
      if (activeHighlight && activeHighlight !== resolved.highlightEl) {
        activeHighlight.classList.remove(AUTO_DROP_CLASS);
      }
      resolved.highlightEl.classList.add(AUTO_DROP_CLASS);
      activeHighlight = resolved.highlightEl;
    } else if (activeHighlight) {
      activeHighlight.classList.remove(AUTO_DROP_CLASS);
      activeHighlight = null;
    }
  };

  const onDragLeave = (e: DragEvent) => {
    if (!e.relatedTarget || e.relatedTarget === doc.documentElement) {
      clearDropHighlights(doc);
      activeHighlight = null;
    }
  };

  const onDrop = (e: DragEvent) => {
    if (!hasDraggedFiles(e)) return;
    if (e.target instanceof Element && e.target.closest('[data-vcpl-dropzone="custom"]')) {
      clearDropHighlights(doc);
      activeHighlight = null;
      return;
    }

    e.preventDefault();
    clearDropHighlights(doc);
    activeHighlight = null;

    const rawFiles = e.dataTransfer?.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const filesArr = Array.from(rawFiles);
    const resolved = resolveTargetFromEvent(doc, e.target, filesArr);
    if (!resolved) return;

    const filtered = filterAcceptedFiles(
      filesArr,
      resolved.input.accept || undefined,
      resolved.input.multiple
    );
    if (filtered.length === 0) return;

    e.stopPropagation();
    assignFilesAndTriggerChange(resolved.input, filtered);
  };

  doc.addEventListener('dragover', onDragOver);
  doc.addEventListener('dragleave', onDragLeave);
  doc.addEventListener('drop', onDrop);

  return () => {
    clearDropHighlights(doc);
    doc.removeEventListener('dragover', onDragOver);
    doc.removeEventListener('dragleave', onDragLeave);
    doc.removeEventListener('drop', onDrop);
  };
}
