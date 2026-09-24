export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string } | null)?.error ?? "Terjadi kesalahan.",
      res.status
    );
  }
  return data as T;
}

/**
 * Kegagalan jaringan (bukan balasan server) tidak bisa dibaca dari pesannya —
 * `fetch` hanya memberi `TypeError: Failed to fetch`. Jadi detailnya dikumpulkan
 * di sini lalu dikirim ke `/api/client-errors` supaya bisa diperiksa dari server.
 *
 * Log disimpan dulu di localStorage; kalau pengirimannya ikut gagal (koneksinya
 * memang sedang putus) isinya dikirim lagi begitu ada request yang berhasil.
 */
const PENDING_KEY = "bardi:client-errors";
const MAX_PENDING = 30;
/**
 * Jeda sebelum tiap percobaan ulang; panjangnya menentukan berapa kali diulang.
 * Terukur di produksi: pada sesi yang buruk sekitar 1 dari 4 request hilang tanpa
 * jejak di log server, jadi sekali ulangan belum cukup.
 */
const RETRY_DELAYS_MS = [400, 1200];

function pendingList(): unknown[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePending(list: unknown[]) {
  try {
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify(list.slice(-MAX_PENDING))
    );
  } catch {
    // localStorage penuh atau diblokir: catatannya hilang, tapi aplikasi jangan terganggu.
  }
}

function text(value: unknown): string | null {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? null : json;
  } catch {
    return null;
  }
}

/** Info timing: membedakan gagal seketika (koneksi ditolak) vs menggantung (timeout). */
function timing(url: string) {
  try {
    const entries = performance.getEntriesByName(url, "resource");
    const last = entries[entries.length - 1] as
      | (PerformanceResourceTiming & { responseStatus?: number })
      | undefined;
    if (!last) return {};
    return {
      durationMs: Math.round(last.duration),
      protocol: last.nextHopProtocol || null,
      responseStatus: last.responseStatus ?? null,
    };
  } catch {
    return {};
  }
}

function buildFailure(
  url: string,
  init: RequestInit,
  body: unknown,
  err: unknown,
  attempts: number
) {
  return {
    url,
    method: init.method ?? "GET",
    requestBody: text(body),
    errorName: err instanceof Error ? err.name : typeof err,
    errorMessage: err instanceof Error ? err.message : String(err),
    errorStack: err instanceof Error ? (err.stack ?? null) : null,
    online: navigator.onLine,
    page: window.location.href,
    attempts,
    ...timing(url),
  };
}

async function sendFailure(entry: unknown) {
  const res = await fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`client-errors -> ${res.status}`);
}

/** Kirim log yang menunggu. Dipanggil setelah request berhasil (koneksi hidup lagi). */
async function flushFailures() {
  const pending = pendingList();
  if (pending.length === 0) return;
  savePending([]);
  for (const entry of pending) {
    try {
      await sendFailure(entry);
    } catch {
      savePending([...pendingList(), entry]);
    }
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function request<T>(
  url: string,
  init: RequestInit,
  body: unknown,
  retryNetwork: boolean
): Promise<T> {
  for (let attempts = 1; ; attempts += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) void flushFailures();
      return await parse<T>(res);
    } catch (err) {
      // ApiError = server menjawab; itu bukan masalah jaringan, jangan diulang.
      if (err instanceof ApiError) throw err;

      // Hanya GET/PATCH yang diulang: keduanya menulis nilai tetap, dan request
      // yang gagal di sini terbukti tidak sampai ke server (log Caddy kosong),
      // jadi mengulang tidak menggandakan data. POST/DELETE/upload tidak diulang
      // supaya baris tidak tercatat dua kali.
      if (retryNetwork && attempts <= RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempts - 1])
        );
        continue;
      }

      savePending([
        ...pendingList(),
        buildFailure(url, init, body, err, attempts),
      ]);
      void flushFailures();
      // `TypeError: Failed to fetch` tidak bisa ditindaklanjuti pengguna, sementara
      // semua halaman menampilkan `err.message` apa adanya — jadi diterjemahkan di
      // sini sekali, bukan di puluhan tempat pemanggil.
      throw new ApiError(
        init.method && init.method !== "GET"
          ? "Koneksi ke server terputus. Data belum terkirim — coba klik simpan sekali lagi."
          : "Koneksi ke server terputus. Coba muat ulang halaman sebentar lagi.",
        0
      );
    }
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  return request<T>(url, {}, undefined, true);
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, jsonInit("POST", body), body, false);
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, jsonInit("PATCH", body), body, true);
}

export async function apiDelete<T>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" }, undefined, false);
}

export async function apiUpload<T>(url: string, file: File): Promise<T> {
  // Tidak diulang: body FormData sudah terpakai setelah percobaan pertama.
  const form = new FormData();
  form.append("file", file);
  return request<T>(url, { method: "POST", body: form }, null, false);
}

export function downloadUrl(url: string) {
  window.location.href = url;
}
