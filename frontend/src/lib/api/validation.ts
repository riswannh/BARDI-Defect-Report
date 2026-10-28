import { z } from "zod";
import { MONTHS_FULL } from "@/lib/format";
import { MENU_KEYS } from "@/lib/permissions";

export function normalizeTimestamp(value: string): string {
  const s = value.trim().replace(" ", "T");
  return s.length === 10 ? `${s}T00:00` : s;
}

export const masterNameSchema = z.object({
  name: z.string().trim().min(1),
});

/**
 * Bentuk "create" dan "update" untuk resource yang punya field berdefault.
 *
 * JEBAKAN YANG PERNAH TERJADI: `schema.partial()` TIDAK melepas `.default()`.
 * Pada zod, `z.object({ quantity: z.coerce.number().default(0) }).partial()`
 * tetap mengisi `quantity: 0` ketika field itu tidak dikirim. Akibatnya PATCH
 * yang hanya bermaksud mengubah satu field ikut menulis `0` ke field berdefault
 * lainnya — pernah membuat `quantity` dan `value` sebuah defect terhapus hanya
 * karena problemDetail-nya diubah.
 *
 * Karena itu update schema dibangun dari field tanpa default: field yang tidak
 * dikirim benar-benar absen, dan handler PATCH memakai `??` untuk mempertahankan
 * nilai lama.
 */
function buildCreate<C extends z.ZodRawShape, U extends z.ZodRawShape>(
  updateShape: C,
  defaults: U
) {
  return z.object({ ...updateShape, ...defaults });
}

/**
 * Update schema: setiap field dibuat OPSIONAL, dan `.optional()` dipasang DI LUAR
 * transform supaya transformnya (mis. normalisasi timestamp) tetap jalan saat
 * field itu dikirim.
 *
 * Ditulis sebagai mapped type, bukan loop `Object.entries`, supaya tipe tiap
 * field tidak hilang (loop runtime membuat semuanya menjadi `{}`).
 */
function buildUpdate<C extends z.ZodRawShape>(fields: C) {
  const shape = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      (field as z.ZodTypeAny).optional(),
    ])
  ) as unknown as { [K in keyof C]: z.ZodOptional<C[K]> };
  return z.object(shape);
}

/** Normalisasi SKU: string kosong dianggap "tidak diisi" (null), bukan "". */
export function normalizeSku(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Produk punya SKU; master lain (problem/status/pabrik) hanya nama.
 * SKU opsional, tapi kalau diisi harus unik — dicek terpisah di handler.
 */
export const productSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().optional().nullable(),
});

/**
 * Jenis harga produk — DI-HARDCODE, mengikuti kolom spreadsheet harga user:
 * Website (F), Reseller (G), Key Account (H), Buyback (I), Collection Point (J),
 * Experience Store (K), Regional Warehouse (L).
 *
 * "Regional Warehouse" adalah satu-satunya jenis yang dipakai sistem sebelum
 * fitur ini, jadi ia menjadi nilai bawaan sekaligus jenis untuk baris harga lama
 * (kolom `priceType` diberi default itu saat kolomnya ditambahkan).
 */
export const PRICE_TYPES = [
  "Website",
  "Reseller",
  "Key Account",
  "Buyback",
  "Collection Point",
  "Experience Store",
  "Regional Warehouse",
] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const DEFAULT_PRICE_TYPE: PriceType = "Regional Warehouse";

/** Terima beda huruf besar-kecil/spasi; nilai di luar daftar -> null. */
export function normalizePriceType(value: unknown): PriceType | null {
  const s =
    typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (s === "") return null;
  return PRICE_TYPES.find((option) => option.toLowerCase() === s) ?? null;
}

export const defectFields = {
  codeGaransi: z.string().trim().min(1),
  timestamp: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeTimestamp),
  photosLink: z.string().trim(),
  videosLink: z.string().trim(),
  problemId: z.coerce.number().int().positive(),
  problemDetail: z.string().trim(),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0),
  statusId: z.coerce.number().int().positive(),
  factoryId: z.coerce.number().int().positive(),
  /**
   * Nilai defect (Rupiah), disimpan APA ADANYA — dari isian operator maupun kolom
   * Value pada impor Excel. Server tidak lagi menghitung `quantity × harga master`
   * dan tidak mengisi `productPriceId`; harga master hanya dipakai form sebagai
   * isian awal (lihat `defect-form-dialog.tsx`).
   */
  value: z.coerce.number().int().min(0),
  /** Jenis harga yang dipakai form saat mengisi `value`; lihat PRICE_TYPES. */
  priceType: z.string().trim(),
} satisfies z.ZodRawShape;

export const defectSchema = buildCreate(defectFields, {
  photosLink: z.string().trim().default(""),
  videosLink: z.string().trim().default(""),
  problemDetail: z.string().trim().default(""),
  quantity: z.coerce.number().int().min(0).default(0),
  value: z.coerce.number().int().min(0).default(0),
  priceType: z.string().trim().default(DEFAULT_PRICE_TYPE),
});

export const defectUpdateSchema = buildUpdate(defectFields);

export const saleFields = {
  productId: z.coerce.number().int().positive(),
  factoryId: z.coerce.number().int().positive(),
  month: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(0),
  value: z.coerce.number().int().min(0),
} satisfies z.ZodRawShape;

export const saleSchema = buildCreate(saleFields, {
  quantity: z.coerce.number().int().min(0).default(0),
  value: z.coerce.number().int().min(0).default(0),
});

export const saleUpdateSchema = buildUpdate(saleFields);

/* ------------------------------ Repair Data ------------------------------ */

/**
 * Pilihan dropdown modul Repair Data — DI-HARDCODE, disamakan dengan isi sheet
 * "Reparasi RFB" (tab `Dropdown` kolom A/B plus kolom Asal/PIC/Status), sama
 * seperti pola `KETERANGAN_OPTIONS` di modul PO.
 *
 * "Teknis Device" TIDAK ada di sini: kolom itu memakai master Problem yang sama
 * dengan modul Defect (`repairs.problemId`).
 */
export const REPAIR_ORIGINS = ["Distri", "OR", "Customer"] as const;
export type RepairOrigin = (typeof REPAIR_ORIGINS)[number];

export const REPAIR_STATUSES = [
  "Done Repair",
  "Proses",
  "Belum Di Buka",
  "Tidak Ada Data",
  "Done Kirim",
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const REPAIR_PICS = [
  "Aji",
  "Roland",
  "Danu",
  "Aziz",
  "Danang",
  "Almer",
  "Hendi",
] as const;
export type RepairPic = (typeof REPAIR_PICS)[number];

export const REPAIR_RESOLUTIONS = [
  "Replacement BJ",
  "Ganti Sparepart",
  "Maintenance",
  "Ganti Komponen",
  "Replacement Produk Baru",
] as const;
export type RepairResolution = (typeof REPAIR_RESOLUTIONS)[number];

export const DEFAULT_REPAIR_ORIGIN: RepairOrigin = "Distri";
/** Status baris baru; "Proses" karena baris yang baru dicatat belum selesai. */
export const DEFAULT_REPAIR_STATUS: RepairStatus = "Proses";

/**
 * "2026-05-04", "2026-05-04 10:30", atau "04/05/2026" → "2026-05-04".
 *
 * Kosong / tidak dikenali → "" supaya impor bisa melaporkannya sebagai error
 * tanpa membatalkan seluruh baris.
 */
export function normalizeDateOnly(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "") return "";
  if (/^\d+(\.\d+)?$/.test(raw)) {
    // Serial tanggal Google (hari sejak 1899-12-30) — dipakai kolom "Tanggal".
    const serial = Number(raw);
    if (serial > 0 && serial < 200_000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
        .toISOString()
        .slice(0, 10);
    }
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw.replace(" ", "T"));
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export const repairFields = {
  claimId: z.string().trim().min(1),
  date: z.string().trim().min(1),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0),
  value: z.coerce.number().int().min(0),
  priceType: z.string().trim(),
  origin: z.string().trim(),
  customerName: z.string().trim(),
  customerPhone: z.string().trim(),
  resi: z.string().trim(),
  customerIssue: z.string().trim(),
  photoPackageLink: z.string().trim(),
  photoCompletenessLink: z.string().trim(),
  status: z.string().trim(),
  startAt: z.string().trim(),
  finishAt: z.string().trim(),
  note: z.string().trim(),
  pic: z.string().trim(),
  resolution: z.string().trim(),
  // Foreign key opsional: 0 berarti "tidak ada" dan diterjemahkan ke NULL oleh
  // handler API, supaya satu bentuk schema bisa dipakai create maupun update.
  problemId: z.coerce.number().int().min(0),
  sparePart1Id: z.coerce.number().int().min(0),
  sparePart2Id: z.coerce.number().int().min(0),
  sparePart3Id: z.coerce.number().int().min(0),
  // Nama sparepart apa adanya; dipakai kalau namanya belum ada di Data Master.
  sparePart1Text: z.string().trim().max(200),
  sparePart2Text: z.string().trim().max(200),
  sparePart3Text: z.string().trim().max(200),
  noteClosing: z.string().trim(),
} satisfies z.ZodRawShape;

export const repairSchema = buildCreate(repairFields, {
  quantity: z.coerce.number().int().min(0).default(0),
  value: z.coerce.number().int().min(0).default(0),
  priceType: z.string().trim().default(DEFAULT_PRICE_TYPE),
  origin: z.string().trim().default(DEFAULT_REPAIR_ORIGIN),
  status: z.string().trim().default(DEFAULT_REPAIR_STATUS),
  customerName: z.string().trim().default(""),
  customerPhone: z.string().trim().default(""),
  resi: z.string().trim().default(""),
  customerIssue: z.string().trim().default(""),
  photoPackageLink: z.string().trim().default(""),
  photoCompletenessLink: z.string().trim().default(""),
  startAt: z.string().trim().default(""),
  finishAt: z.string().trim().default(""),
  note: z.string().trim().default(""),
  pic: z.string().trim().default(""),
  resolution: z.string().trim().default(""),
  problemId: z.coerce.number().int().min(0).default(0),
  sparePart1Id: z.coerce.number().int().min(0).default(0),
  sparePart2Id: z.coerce.number().int().min(0).default(0),
  sparePart3Id: z.coerce.number().int().min(0).default(0),
  sparePart1Text: z.string().trim().max(200).default(""),
  sparePart2Text: z.string().trim().max(200).default(""),
  sparePart3Text: z.string().trim().max(200).default(""),
  noteClosing: z.string().trim().default(""),
});

export const repairUpdateSchema = buildUpdate(repairFields);

/** Mata uang yang didukung modul PO. */
export const CURRENCIES = ["Rp", "USD", "RMB"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Terima "rp"/"idr" dan spasi berlebih, simpan sebagai kode baku. */
export function normalizeCurrency(value: unknown): Currency {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (s === "RP" || s === "IDR") return "Rp";
  if (s === "USD" || s === "US$" || s === "$") return "USD";
  if (s === "RMB" || s === "CNY" || s === "¥") return "RMB";
  return "Rp";
}

/** Status PPN baris PO. Hanya penanda; tidak memengaruhi perhitungan total. */
export const PPN_OPTIONS = ["PPN", "Non PPN"] as const;
export type PpnStatus = (typeof PPN_OPTIONS)[number];

/** Terima variasi penulisan ("ppn", "non-ppn", "PPN 11%") dan kembalikan baku. */
export function normalizePpn(value: unknown): PpnStatus {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (s === "") return "Non PPN";
  if (/^(non|no|tanpa|without|tidak)[\s-]*ppn/.test(s)) return "Non PPN";
  if (s === "false" || s === "0" || s === "tidak") return "Non PPN";
  if (s.includes("ppn") || s === "true" || s === "1" || s === "ya" || s === "yes") {
    return "PPN";
  }
  return "Non PPN";
}

/**
 * PO Product.
 *
 * `value` tidak diterima dari klien sebagai sumber kebenaran — server selalu
 * menghitung ulang pricePerPcs x quantity sebelum menyimpan. `poDate` adalah
 * tanggal PO yang diisi operator, dinormalkan sama seperti timestamp defect.
 * `pricePerPcs` boleh pecahan (USD/RMB), jadi tidak dibatasi bilangan bulat.
 */
/**
 * Pilihan keterangan PO — DI-HARDCODE, bukan master yang bisa di-CRUD.
 *
 * Dulu keterangan adalah tabel master dengan foreign key; user memutuskan cukup
 * tiga nilai tetap ini. Karena itu tidak ada tabel `keterangan`, tidak ada
 * `/api/keterangan`, dan tidak ada tab Data Master untuknya.
 */
export const KETERANGAN_OPTIONS = [
  "Product Order",
  "Sparepart Order",
  "Replacement",
] as const;
export type KeteranganOption = (typeof KETERANGAN_OPTIONS)[number];

export const DEFAULT_KETERANGAN: KeteranganOption = "Product Order";

/** Terima variasi spasi/huruf besar-kecil; nilai di luar daftar ditolak (null). */
export function normalizeKeterangan(value: unknown): KeteranganOption | null {
  const s = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (s === "") return null;
  const found = KETERANGAN_OPTIONS.find((option) => option.toLowerCase() === s);
  return found ?? null;
}

export const purchaseOrderFields = {
  poNumber: z.string().trim().min(1),
  poDate: z.string().trim().min(1).transform(normalizeTimestamp),
  productId: z.coerce.number().int().positive(),
  factoryId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0),
  pricePerPcs: z.coerce.number().min(0),
  currency: z.string(),
  ppn: z.string(),
  keterangan: z.string(),
  /** Harga master (Rupiah) yang dipakai baris PO; boleh kosong. */
  productPriceId: z.coerce.number().int().positive().nullable(),
  /** Jenis harga master yang dipilih operator; lihat PRICE_TYPES. */
  priceType: z.string().trim(),
} satisfies z.ZodRawShape;

export const purchaseOrderSchema = buildCreate(purchaseOrderFields, {
  quantity: z.coerce.number().int().min(0).default(0),
  pricePerPcs: z.coerce.number().min(0).default(0),
  currency: z.string().optional(),
  ppn: z.string().optional(),
  keterangan: z.string().optional(),
  productPriceId: z.coerce.number().int().positive().nullable().optional(),
  priceType: z.string().trim().default(DEFAULT_PRICE_TYPE),
});

export const purchaseOrderUpdateSchema = buildUpdate(purchaseOrderFields);

/* ---------------------- Harga produk per bulan ---------------------- */

/** Bulan dua digit, "01".."12" — kunci harga bersama tahun. */
export const PRICE_MONTHS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;
export type PriceMonth = (typeof PRICE_MONTHS)[number];

/** Terima "4", "04", atau "April"; kembalikan "04". Null bila tidak dikenali. */
export function normalizePriceMonth(value: unknown): PriceMonth | null {
  const raw =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (raw === "") return null;
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) {
    return PRICE_MONTHS[asNumber - 1];
  }
  const lower = raw.toLowerCase();
  const exact = MONTHS_FULL.findIndex((name) => name.toLowerCase() === lower);
  if (exact >= 0) return PRICE_MONTHS[exact];
  // Singkatan, mis. "Apr".
  if (lower.length < 3) return null;
  const short = MONTHS_FULL.findIndex((name) =>
    name.toLowerCase().startsWith(lower.slice(0, 3))
  );
  return short >= 0 ? PRICE_MONTHS[short] : null;
}

/** Terima "2026"; null bila bukan tahun empat angka yang masuk akal. */
export function normalizePriceYear(value: unknown): string | null {
  const raw =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!/^\d{4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1900 && n <= 2999 ? raw : null;
}

export const productPriceFields = {
  productId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0),
  month: z.string().trim().min(1),
  year: z.string().trim().min(1),
  /** Jenis harga (Website/Reseller/…/Regional Warehouse); lihat PRICE_TYPES. */
  priceType: z.string().trim(),
} satisfies z.ZodRawShape;

export const productPriceSchema = buildCreate(productPriceFields, {
  price: z.coerce.number().min(0).default(0),
  priceType: z.string().trim().default(DEFAULT_PRICE_TYPE),
});

export const productPriceUpdateSchema = buildUpdate(productPriceFields);

/* --------------------- Harga sparepart per bulan --------------------- */

/**
 * Sama seperti harga produk, hanya rujukannya sparepart. Dipisah (bukan dipakai
 * ulang) supaya kontrak API-nya jelas: field-nya `sparePartId`, bukan `productId`.
 */
export const sparePartPriceFields = {
  sparePartId: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0),
  month: z.string().trim().min(1),
  year: z.string().trim().min(1),
} satisfies z.ZodRawShape;

export const sparePartPriceSchema = buildCreate(sparePartPriceFields, {
  price: z.coerce.number().min(0).default(0),
});

export const sparePartPriceUpdateSchema = buildUpdate(sparePartPriceFields);

/**
 * Limit allowance defect per tahun (Rupiah, satu baris per tahun).
 *
 * Update schema ditulis manual (bukan `.partial()`) supaya field yang tidak
 * dikirim benar-benar absen — lihat catatan jebakan `.default()` di atas.
 */
export const defectAllowanceSchema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/),
  limitValue: z.coerce.number().min(0),
});

export const defectAllowanceUpdateSchema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional(),
  limitValue: z.coerce.number().min(0).optional(),
});

/**
 * Kurs mata uang asing PO ke Rupiah. `usd`/`rmb` = berapa Rupiah untuk 1 unit;
 * 0 diizinkan (artinya kurs belum diisi) supaya admin bisa menyimpan sebagian.
 */
export const currencyRatesSchema = z.object({
  usd: z.coerce.number().min(0),
  rmb: z.coerce.number().min(0),
});

export const userCreateSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().default(false),
  roleId: z.coerce.number().int().positive().nullable().optional(),
});

export const userUpdateSchema = z.object({
  username: z.string().trim().min(3).optional(),
  password: z.string().min(6).optional(),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().optional(),
  roleId: z.coerce.number().int().positive().nullable().optional(),
});

/**
 * Satu baris matriks akses. Dikirim sebagai array (bukan record) supaya menu
 * yang tidak dikirim benar-benar absen — pola yang sama dengan `buildUpdate`.
 */
export const permissionEntrySchema = z.object({
  menu: z.enum(MENU_KEYS),
  read: z.boolean().default(false),
  write: z.boolean().default(false),
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).default(""),
  permissions: z.array(permissionEntrySchema).default([]),
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(permissionEntrySchema).optional(),
});
