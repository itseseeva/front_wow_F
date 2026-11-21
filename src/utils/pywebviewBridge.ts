/**
 * Safe pywebview bridge detector and caller.
 * In pywebview, window.pywebview and an empty window.pywebview.api = {} object
 * are created BEFORE Python methods are attached and 'pywebviewready' fires.
 * - isBridgeReady(): true only when window.pywebview?.api?.list_routes is a function.
 * - getPywebviewApi(): resolves api only when isBridgeReady(); otherwise waits for
 *   'pywebviewready' (up to 15s when window.pywebview exists, or 350ms in a regular browser).
 * - Never caches a null result so subsequent calls check again cleanly.
 */

type PywebviewApi = NonNullable<Window['pywebview']>['api'];

const BROWSER_DETECT_TIMEOUT_MS = 350;
const PYWEBVIEW_READY_TIMEOUT_MS = 15000;
const READY_POLL_INTERVAL_MS = 150;

let pendingApiPromise: Promise<PywebviewApi | null> | null = null;

export const isBridgeReady = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof window.pywebview?.api?.list_routes === 'function'
  );
};

export const getPywebviewApi = (): Promise<PywebviewApi | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (isBridgeReady()) {
    return Promise.resolve(window.pywebview!.api);
  }

  if (pendingApiPromise) {
    return pendingApiPromise;
  }

  const promise = new Promise<PywebviewApi | null>((resolve) => {
    if (isBridgeReady()) {
      resolve(window.pywebview!.api);
      return;
    }

    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const startedAt = Date.now();

    const finish = (api: PywebviewApi | null) => {
      if (settled) return;
      settled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (pollId !== null) {
        clearInterval(pollId);
        pollId = null;
      }
      window.removeEventListener('pywebviewready', onReady);
      if (pendingApiPromise === promise) {
        pendingApiPromise = null;
      }
      resolve(api);
    };

    const onReady = () => {
      if (isBridgeReady()) {
        finish(window.pywebview!.api);
      }
    };

    window.addEventListener('pywebviewready', onReady);

    // Poll lightly while waiting in case methods attach just after/without a second event
    pollId = setInterval(() => {
      if (isBridgeReady()) {
        finish(window.pywebview!.api);
      }
    }, READY_POLL_INTERVAL_MS);

    const initialTimeout = window.pywebview
      ? PYWEBVIEW_READY_TIMEOUT_MS
      : BROWSER_DETECT_TIMEOUT_MS;

    const onTimeout = () => {
      if (isBridgeReady()) {
        finish(window.pywebview!.api);
        return;
      }
      // If window.pywebview appeared during the short browser check, extend wait up to 15s
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
