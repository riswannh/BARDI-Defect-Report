import type { ProductPrice } from "@/lib/types";
import { DEFAULT_PRICE_TYPE } from "@/lib/api/validation";

const periodOf = (row: ProductPrice) =>
  `${row.year}-${String(row.month).padStart(2, "0")}`;

/**
 * Harga master yang dipakai form/timbangan nilai untuk sebuah produk.
 *
 * Aturan (disamakan untuk Defect, PO Product, dan Repair): cari harga JENIS yang
 * dipilih pada periode `YYYY-MM`; kalau periode itu belum punya harga, pakai
 * harga yang SEDANG BERLAKU saat itu = baris terakhir yang periodenya <= periode
 * tiket (keputusan user 12 Okt 2026: tiket Maret tidak boleh memakai harga
 * Agustus hanya karena Maret belum diisi). Kalau tiket lebih tua dari semua
 * baris harga, dipakai baris TERTUA yang ada. Operator tetap bisa memilih baris
 * harga lain dari daftar harga produk.
 */
export function pickProductPrice(
  prices: ProductPrice[],
  productId: number,
  period: string,
  priceType: string = DEFAULT_PRICE_TYPE
): ProductPrice | undefined {
  const mine = prices.filter(
    (row) =>
      row.productId === productId &&
      (row.priceType ?? DEFAULT_PRICE_TYPE) === priceType
  );
  const exact = mine.find((row) => periodOf(row) === period);
  if (exact) return exact;
  const berlaku = mine
    .filter((row) => periodOf(row) <= period)
    .sort((a, b) => periodOf(b).localeCompare(periodOf(a)));
  if (berlaku.length > 0) return berlaku[0];
  return mine.sort((a, b) => periodOf(a).localeCompare(periodOf(b)))[0];
}
