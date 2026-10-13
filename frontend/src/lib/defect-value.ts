import { DEFAULT_PRICE_TYPE } from "@/lib/api/validation";
import { pickProductPrice } from "@/lib/prices";
import type { ProductPrice } from "@/lib/types";

/**
 * Nilai defect dihitung APP dari harga master (keputusan user 12 Okt 2026):
 * `quantity × harga` jenis harga baris itu untuk BULAN timestamp defect —
 * bulan yang sama dipakai kalau ada, kalau tidak harga yang berlaku saat itu
 * (periode terakhir <= bulan defect, lihat `pickProductPrice`, sama seperti form
 * Defect/PO/Repair). Kolom "Value" di
 * Google Sheet tidak lagi dibaca, jadi angka defect selalu ikut Price List.
 *
 * `null` = produk itu belum punya baris harga untuk jenis itu; pemanggil
 * mempertahankan nilai lama supaya tidak ada angka yang hilang.
 */
export function defectValueFromMaster(
  prices: ProductPrice[],
  row: {
    productId: number | null;
    quantity: number;
    timeStamp: string;
    priceType?: string | null;
  }
): number | null {
  const period = (row.timeStamp ?? "").slice(0, 7);
  if (!row.productId || !/^\d{4}-\d{2}$/.test(period)) return null;
  const match = pickProductPrice(
    prices,
    row.productId,
    period,
    row.priceType || DEFAULT_PRICE_TYPE
  );
  return match ? row.quantity * match.price : null;
}
