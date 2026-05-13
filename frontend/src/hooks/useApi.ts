import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True whenever a fetch is in progress (including background re-fetches). */
  fetching: boolean;
  reload: () => void;
}

/**
 * Hook that calls an async API function and tracks loading/error state.
 * Re-fetches when any value in `deps` changes, or when `reload()` is called.
 * `loading` is only true for the initial fetch; `fetching` is true for every fetch.
 * @param fetcher - Async function that returns data.
 * @param deps - Dependency array that triggers a re-fetch when values change.
 * @returns Data, loading state, fetching state, error message, and reload function.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasLoaded.current) setLoading(true);
    setFetching(true);
    fetcher()
      .then((result) => {
        if (cancelled) return;
        hasLoaded.current = true;
        setData(result);
        setError(null);
        setLoading(false);
        setFetching(false);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        setError(
          fetchError instanceof Error ? fetchError.message : String(fetchError),
        );
        setLoading(false);
        setFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadCounter, ...deps]);

  const reload = useCallback(() => {
    setReloadCounter((count) => count + 1);
  }, []);

  return { data, loading, error, fetching, reload };
}
