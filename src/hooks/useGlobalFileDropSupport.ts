import { useEffect } from 'react';
import { attachDocumentFileDropBridge } from '../utils/fileDropUtils';

/**
 * Enables automatic drag-and-drop file injection across all current and future
 * React tool views containing <input type="file">, while respecting custom dropzones.
 */
export function useGlobalFileDropSupport(): void {
  useEffect(() => {
    return attachDocumentFileDropBridge(document);
  }, []);
}
