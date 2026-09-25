import type { ChartBucket } from "@/lib/analytics";
import type {
  Defect,
  Factory,
  Problem,
  Product,
  Sale,
  Status,
} from "@/lib/types";
import type { PeriodFilter } from "@/lib/period";
/**
 * Logika data halaman Report — dipisah dari halaman supaya `page.tsx` tinggal
 * mengurus filter, tabel rekap, dan tata letak.
 */

export type RecapSortKey =
  | "productName"
  | "defectQty"
  | "defectValue"
  | "salesQty"
  | "salesValue"
  | "replacementQty"
  | "selisihQty"
  | "ratio";

export interface RecapRow {
  productId: number;
  productName: string;
  defectQty: number;
  defectValue?: number;
  salesQty: number;
  salesValue?: number;
  /** Qty PO berketerangan "Replacement" untuk produk ini. */
  replacementQty: number;
  ratio: number | null;
}

export interface ReportResponse {
  period: PeriodFilter;
  defects: Defect[];
  sales: Sale[];
  /** Baris PO berketerangan "Replacement" pada periode terpilih. */
  replacementPos: ReportPoRow[];
  recap: RecapRow[];
  buckets: ChartBucket[];
  salesYearly: ChartBucket[];
  salesYearlyRecap: RecapRow[];
  totals: {
    /** Angka mentah; dipakai kartu ringkasan, grafik, dan tabel rekap. */
    defectQty: number;
    defectValue?: number;
    salesQty: number;
    salesValue?: number;
    replacementQty: number;
    replacementValue?: number;
    /** Value RW PO Replacement (quantity × harga master, Rupiah) — dasar Selisih Defect Value. */
    replacementRwValue?: number;
  };
  years: number[];
  products: Product[];
  problems: Problem[];
  statuses: Status[];
  factories: Factory[];
}

/**
 * Baris PO versi ringkas untuk halaman Report.
 *
 * `pricePerPcs`, `value`, `currency`, dan `productPrice` tidak ada untuk role
 * Pabrik — dihapus di server, jadi tipenya opsional di sini.
 */
export interface ReportPoRow {
  id: number;
  poNumber: string;
  poDate: string;
  productId: number;
  factoryId: number;
  quantity: number;
  pricePerPcs?: number;
  value?: number;
  currency?: string;
  /** Harga master (Rupiah); null bila produk belum punya harga di periode PO. */
  productPrice?: number | null;
  productName?: string | null;
  factoryName?: string | null;
}

export interface ReportFilters {
  period: string;
  month: string;
  year: string;
  day: string;
  weekEnd: string;
  from: string;
  to: string;
}

/** Saring berdasarkan nama produk lalu urutkan sesuai kolom yang dipilih. */
export function sortRecap(
  recap: RecapRow[],
  search: string,
  sortKey: RecapSortKey,
  sortDir: "asc" | "desc"
): RecapRow[] {
  const q = search.trim().toLowerCase();
  const rows = q
    ? recap.filter((r) => r.productName.toLowerCase().includes(q))
    : recap;
  const dir = sortDir === "asc" ? 1 : -1;
  /** Selisih Defect tidak dikirim server: Replacement − Qty Defect. */
  const pick = (r: RecapRow): number => {
    if (sortKey === "selisihQty") return r.replacementQty - r.defectQty;
    if (sortKey === "productName") return 0;
    return r[sortKey] ?? -1;
  };
  return [...rows].sort((a, b) => {
    if (sortKey === "productName") {
      return a.productName.localeCompare(b.productName) * dir;
    }
    return (pick(a) - pick(b)) * dir;
  });
}

/**
 * Rasio defect terhadap sales.
 *
 * Sales 0 dengan defect > 0 dihitung 100% (bukan tak hingga); keduanya 0
 * berarti tidak ada rasio yang bermakna.
 */
export function defectSalesRatio(
  defectQty: number,
  salesQty: number
): number | null {
  if (salesQty > 0) return defectQty / salesQty;
  return defectQty > 0 ? 1 : null;
}
