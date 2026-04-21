import { useRef, useCallback, useEffect } from "react";

/**
 * Returns a debounced version of the callback.
 * - Delays invocation by `delay` ms after the last call.
 * - Exposes `.flush()` to fire immediately (used on unmount).
 * - Automatically flushes on component unmount so the last value is never lost.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCb = useRef(callback);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingArgs = useRef<any[] | null>(null);

  // Always keep the latest callback reference
  latestCb.current = callback;

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingArgs.current !== null) {
      const args = pendingArgs.current;
      pendingArgs.current = null;
      latestCb.current(...args);
    }
  }, []);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      pendingArgs.current = args;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingArgs.current !== null) {
          const a = pendingArgs.current;
          pendingArgs.current = null;
          latestCb.current(...a);
        }
      }, delay);
    },
    [delay]
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return Object.assign(debounced, { flush });
}
