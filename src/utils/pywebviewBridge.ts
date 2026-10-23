/**
 * Safe pywebview bridge detector and caller.
 * In pywebview, window.pywebview.api is injected or ready after 'pywebviewready'.
 * In standard browser development mode, falls back to mocks after a brief check.
 */

let apiPromise: Promise<NonNullable<Window['pywebview']>['api'] | null> | null = null;

export const getPywebviewApi = (): Promise<NonNullable<Window['pywebview']>['api'] | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (window.pywebview?.api) {
    return Promise.resolve(window.pywebview.api);
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    if (window.pywebview?.api) {
      resolve(window.pywebview.api);
      return;
    }

    const onReady = () => {
      window.removeEventListener('pywebviewready', onReady);
      resolve(window.pywebview?.api || null);
    };

    window.addEventListener('pywebviewready', onReady);

    // In a browser outside pywebview, pywebviewready never fires.
    // Wait max 350ms to detect before falling back to browser mode.
    setTimeout(() => {
      window.removeEventListener('pywebviewready', onReady);
      resolve(window.pywebview?.api || null);
    }, 350);
  });

  return apiPromise;
};
