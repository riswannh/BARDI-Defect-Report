import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { translationCache } from "@/lib/db/schema";

/**
 * Klien LibreTranslate SELF-HOSTED (service `libretranslate` di compose, satu
 * VPS dengan app, hanya lewat jaringan internal Docker).
 *
 * Dipakai sync Google Sheet untuk kolom "Keterangan Kendala" (Indonesia ->
 * Inggris); nanti gelembung chat tiket memakai `/api/translate` yang sama.
 *
 * Aturan yang dijaga di sini:
 * - teks dinormalkan dulu (spasi ganda/enter tidak boleh memecah cache);
 * - semua hasil disimpan ke `translation_cache`, jadi teks yang berulang gratis;
 * - layanan mati BUKAN alasan menyimpan teks Indonesia ke kolom Inggris —
 *   pemanggil menerima `TranslateError` dan menunda barisnya.
 */

const DEFAULT_URL = "http://libretranslate:5000";
const DEFAULT_TIMEOUT_MS = 20_000;
/** LibreTranslate memproses satu per satu; batch kecil lebih tahan timeout. */
const MAX_ITEMS_PER_REQUEST = 25;
const MAX_CHARS_PER_REQUEST = 4_000;
/** SQLite membatasi jumlah parameter query. */
const MAX_CACHE_PARAMS = 400;

export type TranslateFailure = "unavailable" | "rate-limit" | "invalid";

export class TranslateError extends Error {
  constructor(
    readonly code: TranslateFailure,
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = "TranslateError";
  }
}

/** Rapikan teks supaya cache tidak pecah karena perbedaan spasi. */
export const normalizeText = (value: string): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** Kunci cache: satu teks pada satu pasangan bahasa. */
export const translationHash = (text: string, from: string, to: string): string =>
  createHash("sha1").update(`${from}\u0000${to}\u0000${text}`, "utf8").digest("hex").slice(0, 16);

export const translateEndpoint = (): string =>
  (process.env.TRANSLATE_URL?.trim() || DEFAULT_URL).replace(/\/+$/, "");

const timeoutMs = (): number => {
  const raw = Number(process.env.TRANSLATE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : DEFAULT_TIMEOUT_MS;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bagi teks jadi batch kecil (jumlah item + total karakter). */
function chunkTexts(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const text of texts) {
    const tooMany = current.length >= MAX_ITEMS_PER_REQUEST;
    const tooLong = chars + text.length > MAX_CHARS_PER_REQUEST;
    if (current.length > 0 && (tooMany || tooLong)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Satu permintaan ke LibreTranslate. Dua percobaan untuk gangguan jaringan/5xx
 * (terjemahan idempoten, jadi aman diulang); 429/400 tidak diulang.
 */
async function requestTranslate(texts: string[], from: string, to: string): Promise<string[]> {
  const url = `${translateEndpoint()}/translate`;
  const body = JSON.stringify({ q: texts, source: from, target: to, format: "text" });
  let lastError: TranslateError | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs()),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { translatedText?: string | string[] };
        const raw = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText ?? ""];
        const out = raw.map((item) => normalizeText(String(item ?? "")));
        if (out.length !== texts.length || out.some((item) => !item)) {
          throw new TranslateError(
            "invalid",
            "Layanan terjemahan mengembalikan hasil yang tidak lengkap. Coba lagi nanti.",
            `diminta ${texts.length}, diterima ${out.length}`
          );
        }
        return out;
      }

      const detail = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 429) {
        throw new TranslateError("rate-limit", "Layanan terjemahan sedang penuh. Coba lagi sebentar.", detail);
      }
      if (res.status === 400) {
        throw new TranslateError("invalid", "Permintaan terjemahan ditolak layanan.", detail);
      }
      lastError = new TranslateError("unavailable", `Layanan terjemahan membalas ${res.status}.`, detail);
    } catch (error) {
      if (error instanceof TranslateError && (error.code === "invalid" || error.code === "rate-limit")) {
        throw error;
      }
      lastError =
        error instanceof TranslateError
          ? error
          : new TranslateError(
              "unavailable",
              "Layanan terjemahan tidak bisa dihubungi.",
              String((error as Error)?.message ?? error).slice(0, 200)
            );
    }
    if (attempt === 1) await sleep(400);
  }

  throw lastError ?? new TranslateError("unavailable", "Layanan terjemahan tidak bisa dihubungi.");
}

/** Baca cache untuk sekumpulan hash (dipotong supaya aman di SQLite). */
function readCache(hashes: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += MAX_CACHE_PARAMS) {
    const chunk = hashes.slice(i, i + MAX_CACHE_PARAMS);
    const rows = db
      .select({ hash: translationCache.hash, translated: translationCache.translated })
      .from(translationCache)
      .where(inArray(translationCache.hash, chunk))
      .all();
    for (const row of rows) out.set(row.hash, row.translated);
  }
  return out;
}

export type TranslateOutcome = {
  /** Teks normalisasi -> terjemahan. */
  translations: Map<string, string>;
  /** Berapa teks yang benar-benar dikirim ke layanan (bukan dari cache). */
  requested: number;
  /** Berapa teks yang dilayani cache. */
  cached: number;
};

/**
 * Terjemahkan banyak teks (id -> en secara default). Teks kosong/ganda diabaikan.
 * Melempar `TranslateError` kalau layanan bermasalah — pemanggil yang memutuskan
 * menunda atau gagal.
 */
export async function translateTexts(
  texts: string[],
  options: { from?: string; to?: string } = {}
): Promise<TranslateOutcome> {
  const from = options.from ?? "id";
  const to = options.to ?? "en";
  const unique = [...new Set(texts.map(normalizeText).filter(Boolean))];
  const translations = new Map<string, string>();
  if (unique.length === 0) return { translations, requested: 0, cached: 0 };

  const byHash = new Map(unique.map((text) => [translationHash(text, from, to), text] as const));
  const cachedRows = readCache([...byHash.keys()]);
  for (const [hash, text] of byHash) {
    const hit = cachedRows.get(hash);
    if (hit !== undefined) translations.set(text, hit);
  }

  const missing = unique.filter((text) => !translations.has(text));
  if (missing.length === 0) {
    return { translations, requested: 0, cached: unique.length };
  }

  const rows: (typeof translationCache.$inferInsert)[] = [];
  for (const chunk of chunkTexts(missing)) {
    const out = await requestTranslate(chunk, from, to);
    chunk.forEach((text, index) => {
      const value = out[index];
      translations.set(text, value);
      rows.push({
        hash: translationHash(text, from, to),
        sourceText: text,
        translated: value,
        fromLang: from,
        toLang: to,
      });
    });
  }
  if (rows.length > 0) db.insert(translationCache).values(rows).onConflictDoNothing().run();

  return { translations, requested: rows.length, cached: unique.length - missing.length };
}

/** Versi satu teks (dipakai fitur lain nanti). */
export async function translateText(
  text: string,
  options: { from?: string; to?: string } = {}
): Promise<string> {
  const { translations } = await translateTexts([text], options);
  return translations.get(normalizeText(text)) ?? "";
}
