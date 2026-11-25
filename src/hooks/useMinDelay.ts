import { useEffect, useRef, useState } from 'react';

export interface UseMinDelayOptions {
  /**
   * When true (e.g. status is 'none' or 'error'), clears the loading state
   * immediately without waiting for minDelayMs.
   */
  immediateClear?: boolean;
  /**
   * Changing this key while not already loading (e.g. opening a cached map,
   * switching session/pass synchronously, or receiving a ready map via event)
   * starts a fresh minDelayMs window.
   */
  triggerKey?: string | number | null;
}

/**
 * Ensures a loading state remains active for at least `minDelayMs` (default 500ms)
 * whenever loading begins, on initial mount (unless `immediateClear`), or when
 * `triggerKey` changes. If actual loading takes longer than `minDelayMs`, holds
 * until `loading` finishes. Clears immediately when `immediateClear` is true.
 */
export function useMinDelay(
  loading: boolean,
  minDelayMs = 500,
  options?: UseMinDelayOptions
): boolean {
  const immediateClear = Boolean(options?.immediateClear);
  const triggerKey = options?.triggerKey;

  const [holding, setHolding] = useState<boolean>(() => !immediateClear);
  const startedAtRef = useRef<number>(immediateClear ? 0 : Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTriggerKeyRef = useRef<string | number | null | undefined>(triggerKey);
  const prevLoadingRef = useRef<boolean>(loading);

  const wasLoading = prevLoadingRef.current;
  const loadingStarted = loading && !wasLoading && !immediateClear;
  const triggerChanged =
    prevTriggerKeyRef.current !== triggerKey &&
    !immediateClear &&
    !wasLoading;

  if (loadingStarted || triggerChanged) {
    startedAtRef.current = Date.now();
  }

  prevTriggerKeyRef.current = triggerKey;
  prevLoadingRef.current = loading;

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (immediateClear) {
      startedAtRef.current = 0;
      setHolding(false);
      return;
    }

    if (loading) {
      if (startedAtRef.current === 0) {
        startedAtRef.current = Date.now();
      }
      setHolding(true);
      return;
    }

    if (startedAtRef.current === 0) {
      setHolding(false);
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = minDelayMs - elapsed;

    if (remaining <= 0) {
      startedAtRef.current = 0;
      setHolding(false);
      return;
    }

    setHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startedAtRef.current = 0;
      setHolding(false);
    }, remaining);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading, immediateClear, triggerKey, minDelayMs]);

  if (immediateClear) return false;
  return loading || holding || loadingStarted || triggerChanged;
}
