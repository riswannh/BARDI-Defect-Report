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
 * Nilai di sheet ini rupiah, jadi pemisah ribuan dibuang dan desimal dibulatkan
 * (kolom di app bertipe integer).
 */
export function parseSheetNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
  let text = String(value ?? "").trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()\s\u00a0]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const commaDecimal = /,\d{1,2}$/.test(text);
  if (lastComma > lastDot && commaDecimal) text = text.replace(/\./g, "").replace(",", ".");
  else if (lastDot >= 0) text = text.replace(/,/g, "");
  else if (commaDecimal) text = text.replace(",", ".");
  else text = text.replace(/,/g, "");
  const n = Number.parseFloat(text.replace(/[^\d.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.round(n) : Math.round(n);
}

const MONTH_INDEX = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad2 = (value: unknown, fallback: string) => {
  const n = Number(value);
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? String(n).padStart(2, "0") : fallback;
};
const joinTimestamp = (y: unknown, mo: unknown, d: unknown, h?: unknown, mi?: unknown) =>
  `${String(y).padStart(4, "0")}-${pad2(mo, "01")}-${pad2(d, "01")}T${pad2(h, "00")}:${pad2(mi, "00")}`;

/**
 * Timestamp sheet -> "YYYY-MM-DDTHH:mm" (format yang dipakai app).
 *
 * Sel tanggal di tab "Big Data" format tampilannya CAMPUR: sebagian
 * "2026-01-03 13:51:39", sebagian lagi ikut lokal en-US "9/9/2026 23:10:4".
 * Karena itu angka serial (hasil baca UNFORMATTED_VALUE) dipakai langsung, dan
 * teksnya dikenali dalam beberapa bentuk. Yang tidak dikenali -> "" (lebih baik
 * kosong daripada menyimpan jam yang salah dan merusak filter periode report).
 */
export function parseSheetTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial tanggal Google (hari sejak 1899-12-30, waktu lokal spreadsheet).
    if (value < 20000 || value > 80000) return "";
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1, "01")}-${pad2(
      d.getUTCDate(),
      "01"
    )}T${pad2(d.getUTCHours(), "00")}:${pad2(d.getUTCMinutes(), "00")}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  // ISO / sudah format app: 2026-01-03 13:51[:39] atau 2026-01-03T13:51
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]+(\d{1,2}):(\d{2}))?/);
  if (m) return joinTimestamp(m[1], m[2], m[3], m[4], m[5]);

  // 9/9/2026 23:10:4 (en-US) atau 03/09/2026 23:10 (hari dulu)
  m = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Salah satu > 12 sudah pasti tanggal; kalau ambigu ikut kebiasaan sheet (bulan dulu).
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return joinTimestamp(m[3], month, day, m[4], m[5]);
  }

  // 3 Sep 2026 13:51 / 3-Sep-2026 / Sep 3, 2026 13:51
  m = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-,]+(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const mo = MONTH_INDEX.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    if (mo > 0) return joinTimestamp(m[3], mo, m[1], m[4], m[5]);
  }
  m = text.match(/^([A-Za-z]{3,})[\s-](\d{1,2})[,\s]+(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const mo = MONTH_INDEX.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (mo > 0) return joinTimestamp(m[3], mo, m[2], m[4], m[5]);
  }

  return "";
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
