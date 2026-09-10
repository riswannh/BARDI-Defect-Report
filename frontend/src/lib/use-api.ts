"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiState<T> {
  url: string;
  data: T | null;
  error: string | null;
}

export function useApi<T>(url: string | null) {
  const [result, setResult] = useState<ApiState<T> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    fetch(url)
      .then(async (res) => {
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (!res.ok) {
          throw new Error(
            (json as { error?: string } | null)?.error ?? "Gagal memuat data."
          );
        }
        return json as T;
      })
      .then((json) => {
        if (!cancelled) {
          setResult({ url, data: json, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            url,
            data: null,
            error: err instanceof Error ? err.message : "Gagal memuat data.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, version]);

  const current = result && result.url === url ? result : null;
  const loading = Boolean(url) && !current;

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: current?.data ?? null,
    loading,
    error: current?.error ?? null,
    reload,
  };
}
