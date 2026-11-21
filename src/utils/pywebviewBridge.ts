/**
 * Safe pywebview bridge detector and caller.
 * In pywebview, window.pywebview often appears before window.pywebview.api is ready
 * (which becomes available on the 'pywebviewready' event).
 * - If window.pywebview exists: wait for 'pywebviewready' up to 15s.
 * - If window.pywebview does not exist (regular browser): short 350ms detection timeout.
 * - Never cache a null result so subsequent calls re-check cleanly.
 */

type PywebviewApi = NonNullable<Window['pywebview']>['api'];

const BROWSER_DETECT_TIMEOUT_MS = 350;
const PYWEBVIEW_READY_TIMEOUT_MS = 15000;

let pendingApiPromise: Promise<PywebviewApi | null> | null = null;

export const getPywebviewApi = (): Promise<PywebviewApi | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (window.pywebview?.api) {
    return Promise.resolve(window.pywebview.api);
  }

  if (pendingApiPromise) {
    return pendingApiPromise;
  }

  const promise = new Promise<PywebviewApi | null>((resolve) => {
    if (window.pywebview?.api) {
      resolve(window.pywebview.api);
      return;
    }

    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const finish = (api: PywebviewApi | null) => {
      if (settled) return;
      settled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      window.removeEventListener('pywebviewready', onReady);
      if (pendingApiPromise === promise) {
        pendingApiPromise = null;
      }
      resolve(api);
    };

    const onReady = () => {
      finish(window.pywebview?.api || null);
    };

    window.addEventListener('pywebviewready', onReady);

    const initialTimeout = window.pywebview
      ? PYWEBVIEW_READY_TIMEOUT_MS
      : BROWSER_DETECT_TIMEOUT_MS;

    const onTimeout = () => {
      if (window.pywebview?.api) {
        finish(window.pywebview.api);
        return;
      }
      // If window.pywebview appeared during the short browser check, extend up to 15s
      const elapsed = Date.now() - startedAt;
      if (window.pywebview && elapsed < PYWEBVIEW_READY_TIMEOUT_MS) {
        timerId = setTimeout(onTimeout, PYWEBVIEW_READY_TIMEOUT_MS - elapsed);
        return;
      }
      finish(null);
    };

    timerId = setTimeout(onTimeout, initialTimeout);
  });

  pendingApiPromise = promise;
  return promise;
};
