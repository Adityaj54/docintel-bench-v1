import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export interface Resource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

export function useResource<T>(path: string | null, interval = 0): Resource<T> {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: Error | null;
    loading: boolean;
    refreshing: boolean;
  }>({ path, data: null, error: null, loading: Boolean(path), refreshing: false });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const sequence = useRef(0);

  useEffect(() => {
    const request = ++sequence.current;
    if (!path) {
      setState({ path, data: null, error: null, loading: false, refreshing: false });
      return;
    }
    const controller = new AbortController();
    setState(previous => ({
      path,
      data: previous.path === path ? previous.data : null,
      error: null,
      loading: previous.path !== path || previous.data === null,
      refreshing: true,
    }));
    api<T>(path, { signal: controller.signal }).then(data => {
      if (request === sequence.current) {
        setState({ path, data, error: null, loading: false, refreshing: false });
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted || request !== sequence.current) return;
      setState(previous => ({
        ...previous,
        error: error instanceof Error ? error : new Error("Unable to load data."),
        loading: false,
        refreshing: false,
      }));
    });
    return () => controller.abort();
  }, [path, revision]);

  useEffect(() => {
    if (!interval || !path) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, path, refresh]);

  return { ...state, refresh };
}
