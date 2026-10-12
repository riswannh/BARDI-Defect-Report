import {
  normalizeCode,
  normalizeName,
  parseSheetNumber,
  parseSheetTimestamp,
  quoteTab,
} from "./mapping";
import type { SheetCell } from "./values";

/** Spreadsheet "Reparasi RFB" — dipakai kalau env REPAIR_GSHEET_ID kosong. */
export const DEFAULT_REPAIR_SHEET_ID = "1kmRdS3eREi-6-ZyDZboeWxJYNiCoeeRt8wVt81ZQHUg";
export const DEFAULT_REPAIR_TAB = "Data Reparasi";

export const repairSheetId = (): string =>
  process.env.REPAIR_GSHEET_ID?.trim() || DEFAULT_REPAIR_SHEET_ID;

export const repairSheetTab = (): string =>
  process.env.REPAIR_GSHEET_TAB?.trim() || DEFAULT_REPAIR_TAB;

/** Baris header kolom di tab "Data Reparasi" (baris 1-2 judul & grup kolom). */
export const REPAIR_HEADER_ROW = 3;
/** Baris data pertama; baris 4 kosong. */
export const REPAIR_FIRST_DATA_ROW = 5;

/**
 * Field repair yang ikut disamakan dengan sheet, dalam URUTAN PENCARIAN header.
 *
 * `value` (Saving Value) sengaja TIDAK ada di sini: kolom itu tidak ada di tab
 * "Data Reparasi" (nilainya dihitung app = Quantity x harga RW) dan sync tidak
 * pernah menimpa angka yang sudah ada.
 */
export const REPAIR_FIELDS = [
  "claimId",
  "date",
  "productId",
  "quantity",
  "origin",
  "customerName",
  "customerPhone",
  "resi",
  "customerIssue",
  "photoPackageLink",
  "photoCompletenessLink",
  "status",
  "startAt",
  "finishAt",
  "note",
  "pic",
  "resolution",
  "problemId",
  "sparePart1Id",
  "sparePart2Id",
  "sparePart3Id",
  "noteClosing",
] as const;

export type RepairField = (typeof REPAIR_FIELDS)[number];

/**
 * Nama header sheet untuk tiap field (dinormalisasi: huruf kecil, spasi rapat).
 *
 * Beberapa field punya alias karena header sheet pernah berubah. Dua header
 * memang bernama "Note" (kolom P dan W) dan tiga header sparepart memakai
 * penomoran, jadi pencocokan dilakukan BERURUTAN: kemunculan pertama untuk
 * field yang lebih dulu didaftarkan di REPAIR_FIELDS.
 */
export const REPAIR_HEADER_ALIASES: Record<RepairField, string[]> = {
  claimId: ["claim id", "no claim", "nomor claim"],
  date: ["tanggal", "tgl"],
  productId: ["nama produk", "produk"],
  quantity: ["quantity", "qty", "jumlah"],
  origin: ["asal"],
  customerName: ["nama"],
  customerPhone: ["no telp", "no. telp", "no telepon", "telepon"],
  resi: ["resi", "no resi"],
  customerIssue: ["kendala dari cust", "kendala dari customer", "kendala"],
  photoPackageLink: ["foto paket"],
  photoCompletenessLink: ["foto kelengkapan"],
  status: ["status"],
  startAt: ["start", "mulai"],
  finishAt: ["finish", "selesai"],
  note: ["note", "catatan"],
  pic: ["pic", "teknisi"],
  resolution: ["penyelesaian"],
  problemId: ["teknis device", "problem", "kendala teknis"],
  sparePart1Id: ["sparepart/komponen 1", "sparepart 1", "komponen 1", "sparepart"],
  sparePart2Id: ["sparepart/komponen 2", "sparepart 2", "komponen 2"],
  sparePart3Id: ["sparepart/komponen 3", "sparepart 3", "komponen 3"],
  noteClosing: ["note akhir", "catatan akhir", "note"],
};

/** Nilai canonical satu baris repair: semuanya string, master masih berupa NAMA. */
export type RepairRowFields = Partial<Record<RepairField, string>>;

/** Indeks kolom (0-based) tiap field, dibaca dari baris header sheet. */
export function resolveRepairHeaderIndex(header: SheetCell[]): {
  index: Record<RepairField, number>;
  missing: string[];
} {
  const names = header.map((cell) => normalizeName(String(cell ?? "")));
  const taken = new Set<number>();
  const index = {} as Record<RepairField, number>;
  const missing: string[] = [];

  for (const field of REPAIR_FIELDS) {
    const aliases = REPAIR_HEADER_ALIASES[field];
    const found = names.findIndex(
      (name, i) => !taken.has(i) && name !== "" && aliases.includes(name)
    );
    if (found === -1) missing.push(aliases[0]);
    else taken.add(found);
    index[field] = found;
  }

  return { index, missing };
}

const cellText = (value: SheetCell | undefined): string =>
  value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim();

/** Satu baris sheet -> nilai canonical per field. */
export function repairFieldsFromRow(
  cells: SheetCell[],
  index: Record<RepairField, number>
): RepairRowFields {
  const at = (field: RepairField): SheetCell | undefined => {
    const i = index[field];
    return i >= 0 ? cells[i] : undefined;
  };

  const claimId = normalizeCode(cellText(at("claimId")));
  // Kolom Tanggal berisi serial tanggal Google; startAt/finishAt bisa serial
  // atau teks. parseSheetTimestamp menangani keduanya dan mengembalikan "" kalau
  // tidak dikenali (lebih baik kosong daripada tanggal salah).
  const date = parseSheetTimestamp(at("date")).slice(0, 10);

  return {
    claimId,
    date,
    productId: cellText(at("productId")),
    quantity: String(parseSheetNumber(at("quantity"))),
    origin: cellText(at("origin")),
    customerName: cellText(at("customerName")),
    customerPhone: cellText(at("customerPhone")),
    resi: cellText(at("resi")),
    customerIssue: cellText(at("customerIssue")),
    photoPackageLink: cellText(at("photoPackageLink")),
    photoCompletenessLink: cellText(at("photoCompletenessLink")),
    status: cellText(at("status")),
    startAt: parseSheetTimestamp(at("startAt")),
    finishAt: parseSheetTimestamp(at("finishAt")),
    note: cellText(at("note")),
    pic: cellText(at("pic")),
    resolution: cellText(at("resolution")),
    problemId: cellText(at("problemId")),
    sparePart1Id: cellText(at("sparePart1Id")),
    sparePart2Id: cellText(at("sparePart2Id")),
    sparePart3Id: cellText(at("sparePart3Id")),
    noteClosing: cellText(at("noteClosing")),
  };
}

/**
 * Saving Value = Quantity x harga per pcs (harga master jenis RW produk itu).
 *
 * Beda dari `defectTotalValue` yang memakai Quantity minimal 1, di sini Quantity
 * 0 memang berarti 0 — rumusnya persis "Quantity x harga".
 */
export const repairSavingValue = (quantity: number, pricePerUnit: number): number =>
  Math.round((Number(quantity) || 0) * (Number(pricePerUnit) || 0));

/** Range A1 untuk membaca header + seluruh baris data tab Repair. */
export const repairSheetRange = (tab: string): string =>
  `${quoteTab(tab)}!A${REPAIR_HEADER_ROW}:W`;

/**
 * Sparepart/Komponen dari sheet: kalau namanya ada di Data Master pakai id-nya,
 * kalau tidak ada teksnya TETAP disimpan apa adanya (jangan dikosongkan).
 */
export function resolveSparePart(
  name: string,
  toId: Map<string, number>
): { id: number | null; text: string } {
  const text = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { id: null, text: "" };
  const id = toId.get(normalizeName(text)) ?? null;
  return { id, text };
}
