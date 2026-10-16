import type { SheetCell } from "@/lib/gsheet/values";
import { normalizeName, quoteTab } from "@/lib/gsheet/mapping";

/**
 * Peta kolom tab "Raw Combine CG" (sheet "Data Garansi Produk").
 *
 * Dibaca per INDEKS kolom, bukan per nama header, karena beberapa header bisa
 * sama/berubah; baris tajuk tetap diperiksa sekali saat sync supaya kolom yang
 * bergeser ketahuan lebih awal (lihat `cgHeaderProblems`).
 */
export const DEFAULT_CG_SHEET_ID = "1TzJAH7mgIp8OK4l_VsE1GSYAp-IldcyM7TQwmdC8S3U";
export const DEFAULT_CG_TAB = "Raw Combine CG";
/** Baris tajuk dan baris data pertama (1-based, seperti di sheet). */
export const CG_HEADER_ROW = 1;
export const CG_FIRST_DATA_ROW = 2;
export const CG_LAST_COLUMN = "AC";

export const CG_COLUMNS = {
  claimId: 0,
  timestamp: 1,
  name: 2,
  phone: 3,
  email: 4,
  address: 5,
  courier: 6,
  resiUnit: 7,
  problem: 12,
  productForm: 13,
  collectionPoint: 14,
  city: 15,
  postalCode: 16,
  quantity: 17,
  invoiceNumber: 18,
  barcode: 20,
  resi: 21,
  shippingService: 22,
  status: 23,
  shippedAt: 24,
  sla: 25,
  pic: 26,
  note: 27,
  officialName: 28,
} as const;

export type CgField = keyof typeof CG_COLUMNS;

/** Nama kolom yang diperiksa saat sync — kalau bergeser, sync digagalkan. */
const CG_HEADER_CHECK: { column: number; startsWith: string; label: string }[] = [
  { column: CG_COLUMNS.claimId, startsWith: "claim id", label: "Claim ID" },
  { column: CG_COLUMNS.officialName, startsWith: "official name", label: "Official Name" },
];

export function cgSheetId(): string {
  return (process.env.CG_GSHEET_ID ?? "").trim() || DEFAULT_CG_SHEET_ID;
}

export function cgSheetTab(): string {
  return (process.env.CG_GSHEET_TAB ?? "").trim() || DEFAULT_CG_TAB;
}

export function cgSheetRange(tab: string): string {
  return `${quoteTab(tab)}!A${CG_HEADER_ROW}:${CG_LAST_COLUMN}`;
}

/** Kolom wajib yang tidak ketemu di baris tajuk (kosong = aman). */
export function cgHeaderProblems(header: SheetCell[]): string[] {
  return CG_HEADER_CHECK.filter((item) => {
    const cell = normalizeName(String(header[item.column] ?? ""));
    return !cell.startsWith(item.startsWith);
  }).map((item) => `kolom ${item.column + 1} harus "${item.label}"`);
}

export const cgCell = (cells: SheetCell[], field: CgField): string =>
  String(cells[CG_COLUMNS[field]] ?? "").trim();

/**
 * Nilai mentah sel (angka tetap angka).
 *
 * WAJIB dipakai untuk kolom yang diurai angka/tanggal: `parseSheetTimestamp`
 * dan `parseSheetNumber` hanya mengenali serial Google kalau nilainya masih
 * bertipe number — kalau sudah di-String() jadi "46023.4", hasilnya kosong.
 */
export const cgRaw = (cells: SheetCell[], field: CgField): SheetCell =>
  cells[CG_COLUMNS[field]] ?? "";
