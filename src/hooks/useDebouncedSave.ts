import { useCallback, useEffect, useRef } from 'react';

interface DebouncedSaveOptions {
  delay?: number;
  onSave: () => Promise<void>;
  enabled?: boolean;
}

export const useDebouncedSave = ({ 
  delay = 2000, 
  onSave, 
  enabled = true 
}: DebouncedSaveOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveRef = useRef(onSave);

  // Update save function ref when it changes
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const debouncedSave = useCallback(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      saveRef.current();
    }, delay);
  }, [delay, enabled]);

  const saveImmediately = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return saveRef.current();
  }, []);

  const cancelSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    debouncedSave,
    saveImmediately,
    cancelSave
  };
};
