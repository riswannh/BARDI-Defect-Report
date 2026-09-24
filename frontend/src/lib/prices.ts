import type { ProductPrice } from "@/lib/types";

/**
 * Harga master yang dipakai form untuk sebuah produk.
 *
 * Aturan (disamakan untuk Defect dan PO Product): cari harga pada periode
 * `YYYY-MM` yang diminta; kalau produk itu belum punya harga di periode tersebut,
 * pakai harga TERBARU yang dimilikinya — jadi kotak Harga RW tidak pernah kosong
 * selama produknya sudah punya harga. Operator tetap bisa memilih baris harga lain
 * dari daftar harga produk.
 */
export function pickProductPrice(
  prices: ProductPrice[],
  productId: number,
  period: string
): ProductPrice | undefined {
  const mine = prices.filter((row) => row.productId === productId);
  const exact = mine.find((row) => `${row.year}-${row.month}` === period);
  if (exact) return exact;
  return mine.sort(
    (a, b) => b.year.localeCompare(a.year) || b.month.localeCompare(a.month)
  )[0];
}
