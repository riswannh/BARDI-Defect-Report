"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";

interface ApiState<T> {
  url: string;
  data: T | null;
  error: string | null;
}

/**
 * Memuat satu endpoint. Semua halaman memakai ini, jadi permintaannya lewat
 * `apiGet` — bukan `fetch` mentah — supaya ikut diulang saat gagal jaringan dan
 * ikut tercatat ke `/api/client-errors`.
 */
export function useApi<T>(url: string | null) {
  const [result, setResult] = useState<ApiState<T> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    apiGet<T>(url)
      .then((json) => {
        if (!cancelled) {
          setResult({ url, data: json, error: null });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Data yang sudah tampil DIPERTAHANKAN saat memuat ulang gagal. Dulu baris
        // ini mengosongkannya, sehingga gangguan jaringan sesaat membuat tabel di
        // layar mendadak kosong seolah datanya hilang.
        setResult((prev) => ({
          url,
          data: prev && prev.url === url ? prev.data : null,
          error: err instanceof Error ? err.message : "Gagal memuat data.",
        }));
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
