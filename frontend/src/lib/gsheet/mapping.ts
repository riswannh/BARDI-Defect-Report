import { createHash } from "node:crypto";

/**
 * Field defect yang ikut sync dengan tab "Big Data" di Google Sheet.
 * Urutannya tidak penting; nama kolom ada di SHEET_COLUMN.
 */
export const GSHEET_FIELDS = [
  "codeGaransi",
  "timeStamp",
  "photosLink",
  "videosLink",
  "problemId",
  "problemDetail",
  "productId",
  "quantity",
  "statusId",
  "factoryId",
  "value",
] as const;

export type GsheetField = (typeof GSHEET_FIELDS)[number];

/** Nama header di sheet untuk tiap field (harus sama persis, beda huruf besar/kecil dimaafkan). */
export const SHEET_COLUMN: Record<GsheetField, string> = {
  codeGaransi: "Code Garansi",
  timeStamp: "Time Stamp",
  photosLink: "Foto Kendala",
  videosLink: "Video Kendala",
  problemId: "Problem",
  problemDetail: "Translate",
  productId: "Offical Name",
  quantity: "Quantity",
  statusId: "Status Defect",
  factoryId: "Pabrik",
  value: "Value",
};

/** Label bahasa Indonesia untuk popup konflik. */
export const FIELD_LABEL: Record<GsheetField, string> = {
  codeGaransi: "Code Garansi",
  timeStamp: "Timestamp",
  photosLink: "Foto Kendala",
  videosLink: "Video Kendala",
  problemId: "Problem",
  problemDetail: "Translate",
  productId: "Produk (Offical Name)",
  quantity: "Quantity",
  statusId: "Status Defect",
  factoryId: "Pabrik",
  value: "Value",
};

/** Nilai canonical satu baris: semuanya string, nama master bukan id. */
export type RowFields = Partial<Record<GsheetField, string>>;

export const shortHash = (value: string): string =>
  createHash("sha1").update(value, "utf8").digest("hex").slice(0, 16);

export const normalizeCode = (value: string): string =>
  String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();

export const normalizeName = (value: string): string =>
  String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Angka dari sheet bisa tampil "123,120" (format tampilan) atau 123120 (mentah).
 * Nilai di sheet ini selalu rupiah bulat, jadi cukup buang pemisah ribuan.
 * ponytail: kalau nanti ada nilai desimal, ganti ke parse lokal-aware.
 */
export function parseSheetNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const digits = String(value ?? "").replace(/[^\d-]/g, "");
  if (digits === "" || digits === "-") return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-01-03 13:51:39" / serial -> "YYYY-MM-DDTHH:mm" (format yang dipakai app). */
export function parseSheetTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial tanggal Google (hari sejak 1899-12-30, waktu lokal spreadsheet).
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
        d.getUTCHours()
      )}:${pad(d.getUTCMinutes())}`;
    }
  }
  const text = String(value ?? "").trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi] = m;
    return `${y}-${mo}-${d}T${String(h).padStart(2, "0")}:${mi}`;
  }
  return text.replace(" ", "T").slice(0, 16);
}

/** Indeks kolom (0-based) untuk tiap field, dibaca dari baris header sheet. */
export function resolveHeaderIndex(header: string[]): {
  index: Record<GsheetField, number>;
  missing: string[];
} {
  const found = new Map<string, number>();
  header.forEach((name, i) => {
    const key = normalizeName(name);
    if (key && !found.has(key)) found.set(key, i);
  });
  const index = {} as Record<GsheetField, number>;
  const missing: string[] = [];
  for (const field of GSHEET_FIELDS) {
    const i = found.get(normalizeName(SHEET_COLUMN[field]));
    if (i === undefined) missing.push(SHEET_COLUMN[field]);
    index[field] = i ?? -1;
  }
  return { index, missing };
}

/** Bungkus nama tab supaya aman dipakai di range A1 (mis. Big Data -> 'Big Data'). */
export const quoteTab = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
