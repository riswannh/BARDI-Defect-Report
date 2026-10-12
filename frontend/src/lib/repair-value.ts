/**
 * Status Repair yang dihitung ke kartu "Repair Value" di halaman Report:
 * "Done Kirim" dan "Done Repair" (permintaan user 12 Okt 2026).
 *
 * Dibandingkan tanpa peduli huruf besar/kecil dan spasi pinggir karena nilainya
 * datang dari kolom teks Google Sheet, bukan dari daftar tertutup.
 */
const DONE_STATUSES = new Set(["done kirim", "done repair"]);

export function isRepairDone(status: string): boolean {
  return DONE_STATUSES.has(status.trim().toLowerCase());
}
