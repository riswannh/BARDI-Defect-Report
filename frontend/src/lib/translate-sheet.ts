import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { translationCache } from "@/lib/db/schema";
import { getAccessToken } from "@/lib/gsheet/auth";
import { quoteTab } from "@/lib/gsheet/mapping";
import type { SheetValues } from "@/lib/gsheet/values";

/**
 * Penerjemah lewat Google Sheet milik user ("Translate Apps").
 *
 * Sheet itu berisi empat blok, masing-masing satu judul + header `Asli` /
 * `Translate` + kolom B berisi formula `=GOOGLETRANSLATE(...)`:
 *
 *   Indonesia > Inggris   (ID -> EN)
 *   Indonesia < Inggris   (EN -> ID)
 *   Indonesia > China     (ID -> ZH)
 *   Indonesia < China     (ZH -> ID)
 *
 * Cara pakai (sesuai permintaan user): teks ditaruh di baris kosong pertama
 * kolom `Asli`, hasilnya dibaca dari kolom `Translate` di baris yang sama, lalu
 * sel itu dikosongkan lagi supaya baris kosong berikutnya bisa dipakai.
 *
 * Catatan:
 * - Google menghitung formula secara asinkron, jadi hasil dibaca dengan polling;
 *   sesekali sel tetap kosong (pernah 3 dari 40) — karena itu ada satu percobaan
 *   ulang sebelum menyerah.
 * - Semua hasil disimpan di `translation_cache`, jadi teks yang sama tidak
 *   memanggil Google dua kali.
 * - Permintaan diserialkan: sheet cuma punya satu baris kerja, dua permintaan
 *   bersamaan akan saling menimpa.
 */

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_SHEET_ID = "1hLUyO1T9HdUtHonWGkM0Dpim9BhHs8zYT-M0mLvslSw";
const DEFAULT_TAB = "Sheet1";
/** Baris yang dipindai untuk menemukan judul blok + baris kosong terakhir. */
const SCAN_ROWS = 200;
const POLL_INTERVAL_MS = 350;
const DEFAULT_TIMEOUT_MS = 20_000;

/** Bahasa yang dikenal app; "zh" dipetakan ke "zh-CN" di formula. */
export type DetailLanguage = "id" | "en" | "zh";

const SHEET_LANG: Record<DetailLanguage, string> = { id: "ID", en: "EN", zh: "zh-CN" };

export type SheetTranslateFailure = "unavailable" | "invalid" | "config";

export class SheetTranslateError extends Error {
  constructor(
    readonly code: SheetTranslateFailure,
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = "SheetTranslateError";
  }
}

/** Rapikan teks supaya cache tidak pecah karena perbedaan spasi. */
export const normalizeText = (value: string): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Hasil yang jelas rusak jangan disimpan/dipakai: sel kosong, tanda baca saja,
 * atau pesan error formula ("#VALUE!", "#NAME?").
 */
export const isUsableTranslation = (translated: string): boolean => {
  const text = normalizeText(translated);
  if (text.length < 2) return false;
  if (text.startsWith("#")) return false;
  if (/^[\s_\-–—.…?*]+$/.test(text)) return false;
  return /\p{L}/u.test(text);
};

export const translationHash = (text: string, from: string, to: string): string =>
  createHash("sha1").update(`${from}\u0000${to}\u0000${text}`, "utf8").digest("hex").slice(0, 16);

function sheetConfig() {
  return {
    id: process.env.TRANSLATE_SHEET_ID?.trim() || DEFAULT_SHEET_ID,
    tab: process.env.TRANSLATE_SHEET_TAB?.trim() || DEFAULT_TAB,
  };
}

const timeoutMs = (): number => {
  const raw = Number(process.env.TRANSLATE_SHEET_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 2_000 ? raw : DEFAULT_TIMEOUT_MS;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");

/**
 * Judul blok -> pasangan bahasa. Ditulis apa adanya dari sheet user
 * ("Indonesia > Inggris"), tapi spasi/panah panah alternatif dimaafkan.
 */
function parseTitle(value: unknown): { from: DetailLanguage; to: DetailLanguage } | null {
  const key = normalizeKey(value).replace(/→/g, ">").replace(/←/g, "<");
  const match = /^indonesia([<>])(inggris|english|en|china|mandarin|zh)$/.exec(key);
  if (!match) return null;
  const other: DetailLanguage =
    ["china", "mandarin", "zh"].includes(match[2]) ? "zh" : "en";
  return match[1] === ">" ? { from: "id", to: other } : { from: other, to: "id" };
}

async function sheetsFetch(path: string, init: RequestInit): Promise<Response> {
  // Token statis hanya untuk self-check (tanpa kredensial service account).
  const token = process.env.TRANSLATE_SHEET_TOKEN?.trim() || (await getAccessToken());
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new SheetTranslateError(
      res.status === 403 || res.status === 404 ? "config" : "unavailable",
      res.status === 403
        ? "Service account belum diberi akses tulis ke sheet terjemahan."
        : res.status === 404
          ? "Sheet terjemahan tidak ditemukan. Cek TRANSLATE_SHEET_ID / TRANSLATE_SHEET_TAB."
          : `Google Sheet menolak permintaan terjemahan (${res.status}).`,
      detail
    );
  }
  return res;
}

async function getValues(sheetId: string, range: string): Promise<SheetValues> {
  const url = `/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await sheetsFetch(url, { method: "GET" });
  const body = (await res.json().catch(() => ({}))) as { values?: SheetValues };
  return body.values ?? [];
}

async function setValues(
  sheetId: string,
  range: string,
  values: string[][],
  valueInputOption: "RAW" | "USER_ENTERED"
): Promise<void> {
  const url = `/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(
    range
  )}?valueInputOption=${valueInputOption}`;
  await sheetsFetch(url, { method: "PUT", body: JSON.stringify({ values }) });
}

async function clearValues(sheetId: string, range: string): Promise<void> {
  const url = `/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:clear`;
  await sheetsFetch(url, { method: "POST", body: "{}" });
}

type Block = {
  from: DetailLanguage;
  to: DetailLanguage;
  /** Baris (1-based) pertama yang kosong di kolom "Asli" milik blok ini. */
  nextRow: number;
};

/** Cari keempat blok + baris kosong berikutnya di tiap blok. */
async function readBlocks(sheetId: string, tab: string): Promise<Block[]> {
  const rows = await getValues(sheetId, `${quoteTab(tab)}!A1:B${SCAN_ROWS}`);
  const titles: { index: number; pair: { from: DetailLanguage; to: DetailLanguage } }[] = [];
  rows.forEach((row, index) => {
    const pair = parseTitle(row?.[0]);
    if (pair) titles.push({ index, pair });
  });
  if (titles.length === 0) {
    throw new SheetTranslateError(
      "config",
      `Judul blok terjemahan ("Indonesia > Inggris" dan seterusnya) tidak ditemukan di tab "${tab}".`
    );
  }

  return titles.map((title, i) => {
    const end = i + 1 < titles.length ? titles[i + 1].index : rows.length;
    let header = -1;
    for (let index = title.index + 1; index < Math.min(title.index + 4, end); index += 1) {
      if (normalizeKey(rows[index]?.[0]) === "asli") {
        header = index;
        break;
      }
    }
    if (header < 0) header = title.index + 1;
    let last = header;
    for (let index = header + 1; index < end; index += 1) {
      if (String(rows[index]?.[0] ?? "").trim() !== "") last = index;
    }
    return { ...title.pair, nextRow: last + 2 };
  });
}

/** Tunggu sampai Google selesai menghitung formula di kolom "Translate". */
async function pollTranslation(sheetId: string, tab: string, row: number): Promise<string> {
  const range = `${quoteTab(tab)}!B${row}`;
  const deadline = Date.now() + timeoutMs();
  let lastSeen = "";
  while (Date.now() < deadline) {
    const values = await getValues(sheetId, range);
    const value = normalizeText(String(values?.[0]?.[0] ?? ""));
    if (value) {
      if (value.startsWith("#")) {
        throw new SheetTranslateError(
          "invalid",
          "Google Sheet menolak menerjemahkan teks ini (formula mengembalikan error).",
          value.slice(0, 80)
        );
      }
      if (isUsableTranslation(value)) return value;
      lastSeen = value;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new SheetTranslateError(
    "unavailable",
    "Google Sheet belum mengembalikan hasil terjemahan. Coba lagi sebentar.",
    lastSeen ? `hasil terakhir: ${lastSeen.slice(0, 80)}` : "sel kosong sampai batas waktu"
  );
}

/** Satu putaran tulis -> tunggu -> baca -> kosongkan. */
async function runOnce(
  sheetId: string,
  tab: string,
  source: string,
  from: DetailLanguage,
  to: DetailLanguage
): Promise<string> {
  const block = (await readBlocks(sheetId, tab)).find((b) => b.from === from && b.to === to);
  if (!block) {
    throw new SheetTranslateError(
      "config",
      `Blok terjemahan ${from.toUpperCase()} -> ${to.toUpperCase()} tidak ada di sheet.`
    );
  }

  const range = `${quoteTab(tab)}!A${block.nextRow}:B${block.nextRow}`;
  const formula = `=GOOGLETRANSLATE(A${block.nextRow}, "${SHEET_LANG[from]}", "${SHEET_LANG[to]}")`;
  await setValues(sheetId, range, [[source, formula]], "USER_ENTERED");
  try {
    return await pollTranslation(sheetId, tab, block.nextRow);
  } finally {
    // Sel kerja selalu dikosongkan, berhasil maupun gagal, supaya baris itu bisa
    // dipakai lagi dan tidak mengotori sheet user.
    await clearValues(sheetId, range).catch((error) => {
      console.error("[translate-sheet:clear]", (error as Error).message);
    });
  }
}

/** Antrean sederhana: satu permintaan sheet dalam satu waktu. */
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function readCache(hash: string): string | null {
  const row = db
    .select({ translated: translationCache.translated })
    .from(translationCache)
    .where(eq(translationCache.hash, hash))
    .get();
  return row?.translated ?? null;
}

function writeCache(
  hash: string,
  sourceText: string,
  translated: string,
  from: DetailLanguage,
  to: DetailLanguage
) {
  db.insert(translationCache)
    .values({ hash, sourceText, translated, fromLang: from, toLang: to })
    .onConflictDoNothing()
    .run();
}

/**
 * Terjemahkan satu teks lewat Google Sheet user. Hasil disimpan di cache supaya
 * teks yang sama tidak memanggil sheet lagi.
 */
export async function translateWithSheet(
  text: string,
  from: DetailLanguage,
  to: DetailLanguage
): Promise<string> {
  const source = normalizeText(text);
  if (!source) {
    throw new SheetTranslateError("invalid", "Teks kosong tidak bisa diterjemahkan.");
  }
  const hash = translationHash(source, from, to);
  const cached = readCache(hash);
  if (cached !== null) return cached;

  return serialize(async () => {
    const again = readCache(hash);
    if (again !== null) return again;

    const { id, tab } = sheetConfig();
    let lastError: SheetTranslateError | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const value = await runOnce(id, tab, source, from, to);
        writeCache(hash, source, value, from, to);
        return value;
      } catch (error) {
        lastError =
          error instanceof SheetTranslateError
            ? error
            : new SheetTranslateError(
                "unavailable",
                "Penerjemah Google Sheet gagal.",
                String((error as Error)?.message ?? error).slice(0, 200)
              );
        if (attempt === 1) await sleep(600);
      }
    }
    throw lastError ?? new SheetTranslateError("unavailable", "Penerjemah Google Sheet gagal.");
  });
}
