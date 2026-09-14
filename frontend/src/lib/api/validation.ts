import { z } from "zod";

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
  value: z.coerce.number().int().min(0),
} satisfies z.ZodRawShape;

export const defectSchema = buildCreate(defectFields, {
  photosLink: z.string().trim().default(""),
  videosLink: z.string().trim().default(""),
  problemDetail: z.string().trim().default(""),
  quantity: z.coerce.number().int().min(0).default(0),
  value: z.coerce.number().int().min(0).default(0),
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
} satisfies z.ZodRawShape;

export const purchaseOrderSchema = buildCreate(purchaseOrderFields, {
  quantity: z.coerce.number().int().min(0).default(0),
  pricePerPcs: z.coerce.number().min(0).default(0),
  currency: z.string().optional(),
  ppn: z.string().optional(),
  keterangan: z.string().optional(),
});

export const purchaseOrderUpdateSchema = buildUpdate(purchaseOrderFields);

export const userCreateSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().default(false),
});

export const userUpdateSchema = z.object({
  username: z.string().trim().min(3).optional(),
  password: z.string().min(6).optional(),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  isAdmin: z.boolean().optional(),
});
