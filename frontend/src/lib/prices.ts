import type { ProductPrice } from "@/lib/types";
import { DEFAULT_PRICE_TYPE } from "@/lib/api/validation";

/**
 * Harga master yang dipakai form untuk sebuah produk.
 *
 * Aturan (disamakan untuk Defect dan PO Product): cari harga JENIS yang dipilih
 * pada periode `YYYY-MM`; kalau produk itu belum punya harga jenis tersebut di
 * periode itu, pakai harga terbaru jenis yang sama — jadi kotak Harga tidak
 * pernah kosong selama produknya sudah punya harga untuk jenis itu. Operator
 * tetap bisa memilih baris harga lain dari daftar harga produk.
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
  const exact = mine.find((row) => `${row.year}-${row.month}` === period);
  if (exact) return exact;
  return mine.sort(
    (a, b) => b.year.localeCompare(a.year) || b.month.localeCompare(a.month)
  )[0];
}
