/**
 * Identitas baris Repair untuk pencocokan sheet <-> app.
 *
 * Claim ID TIDAK unik: satu Claim ID boleh dipakai beberapa baris kalau
 * tanggal/produknya beda (keputusan user 12 Okt 2026). Jadi baris dicocokkan
 * dengan Claim ID + tanggal + produk, bukan Claim ID saja.
 */
export function repairMatchKey(
  claimId: string,
  date: string,
  productId: number | null | undefined
): string {
  return `${claimId.trim().toLowerCase()}|${date}|${productId ?? ""}`;
}
