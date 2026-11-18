import React, { useCallback, useRef, useState } from 'react';
import { filterAcceptedFiles } from '../../utils/fileDropUtils';

interface UseFileDropOptions {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

export function useFileDrop({
  accept,
  multiple = true,
  disabled = false,
  onFiles,
}: UseFileDropOptions) {
  const [isDragActive, setIsDragActive] = useState(false);
  const depthRef = useRef(0);

  const hasFiles = (e: React.DragEvent) =>
    Boolean(e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files'));

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current += 1;
      setIsDragActive(true);
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (!isDragActive) setIsDragActive(true);
    },
    [disabled, isDragActive]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [disabled]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = 0;
      setIsDragActive(false);

      const accepted = filterAcceptedFiles(e.dataTransfer?.files, accept, multiple);
      if (accepted.length > 0) {
        onFiles(accepted);
      }
    },
    [accept, disabled, multiple, onFiles]
  );

  return {
    isDragActive,
    dropProps: {
      'data-vcpl-dropzone': 'custom' as const,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}

interface FileDropZoneProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode | ((state: { isDragActive: boolean }) => React.ReactNode);
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  accept,
  multiple = true,
  disabled = false,
  onFiles,
  className = '',
  activeClassName = 'border-[#2F3E4E] bg-[#F9C80E]/25 ring-2 ring-[#F9C80E]',
  children,
}) => {
  const { isDragActive, dropProps } = useFileDrop({
    accept,
    multiple,
    disabled,
    onFiles,
  });

  return (
    <div {...dropProps} className={`${className} ${isDragActive ? activeClassName : ''}`.trim()}>
      {typeof children === 'function' ? children({ isDragActive }) : children}
    </div>
  );
};
