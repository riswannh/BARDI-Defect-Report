/**
 * Identitas satu baris data yang datang dari Google Sheet.
 *
 * Claim ID TIDAK unik di sheet (satu claim bisa dipakai beberapa baris), jadi
 * yang menentukan identitas baris = claim + tanggal + produk.
 */
export function claimMatchKey(
  claimId: string,
  date: string,
  productId: number | null | undefined
): string {
  return `${claimId.trim().toLowerCase()}|${date}|${productId ?? ""}`;
}
