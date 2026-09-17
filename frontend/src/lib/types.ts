export type Role = "admin" | "pabrik";

export interface Factory {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  factoryId: number | null;
  isAdmin: boolean;
}

export interface Product {
  id: number;
  name: string;
  /** Opsional: produk lama belum punya SKU. Unik kalau diisi. */
  sku?: string | null;
}

export interface Problem {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  name: string;
}

/**
 * Harga produk per bulan dan tahun (selalu Rupiah).
 *
 * Satu produk boleh punya banyak baris — satu per periode. Baris PO merujuk ke
 * salah satunya lewat `productPriceId`, jadi nilai PO lama tidak ikut berubah
 * ketika harga baru ditambahkan untuk periode berikutnya.
 */
export interface ProductPrice {
  id: number;
  productId: number;
  price: number;
  /** "01".."12". */
  month: string;
  year: string;
  /** Dari master produk, ikut dikirim server supaya tabel tidak perlu join di klien. */
  sku?: string | null;
  productName?: string | null;
}

export interface Defect {
  id: number;
  codeGaransi: string;
  timestamp: string;
  photosLink: string;
  videosLink: string;
  problemId: number;
  problemDetail: string;
  productId: number;
  quantity: number;
  statusId: number;
  factoryId: number;
  value: number;
  /**
   * Harga master (Rupiah) yang dipakai baris ini, sama polanya dengan Value RW
   * di PO. Null berarti produk belum punya harga di periode defect tersebut,
   * sehingga `value`-nya diketik manual.
   */
  productPriceId?: number | null;
  productPrice?: number | null;
  productPriceMonth?: string | null;
  productPriceYear?: string | null;
}

export interface Sale {
  id: number;
  productId: number;
  factoryId: number;
  month: string;
  quantity: number;
  value: number;
}

/**
 * Satu baris PO Product.
 *
 * `pricePerPcs`, `value`, dan `currency` tidak dikirim ke role Pabrik (dihapus
 * di API), jadi tipenya opsional di sini — sama seperti `value` pada Defect.
 */
export interface PurchaseOrder {
  id: number;
  poNumber: string;
  /**
   * Tanggal PO, DIISI MANUAL operator lewat input `datetime-local` di form
   * (mis. tanggal PO diterbitkan), bukan waktu input baris. Formatnya sama
   * dengan timestamp defect: `YYYY-MM-DDTHH:mm`.
   *
   * Ditampilkan sebagai kolom Timestamp tepat setelah PO Number, dan dipakai
   * untuk filter per bulan.
   */
  poDate: string;
  productId: number;
  factoryId: number;
  quantity: number;
  pricePerPcs?: number;
  /** Hasil pricePerPcs x quantity; dihitung server. */
  value?: number;
  currency?: string;
  /** "PPN" atau "Non PPN". Hanya penanda; tidak memengaruhi `value`. */
  ppn?: string;
  /**
   * Keterangan baris PO. Nilainya tetap salah satu dari tiga:
   * "Product Order" | "Sparepart Order" | "Replacement".
   */
  keterangan?: string;
  /** Rujukan ke harga master (Rupiah) yang dipakai baris ini; null bila belum ada. */
  productPriceId?: number | null;
  /** Nominal harga master yang dirujuk, untuk menghitung Value RW. */
  productPrice?: number | null;
  productPriceMonth?: string | null;
  productPriceYear?: string | null;
  sku?: string | null;
  productName?: string | null;
  factoryName?: string | null;
}

export type PeriodType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export interface ImportIssue {
  row: number;
  key: string;
  reason: string;
}

export interface ImportResult {
  module: string;
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: ImportIssue[];
  skippedDetails: ImportIssue[];
}
