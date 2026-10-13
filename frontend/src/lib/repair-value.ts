/**
 * Aturan baris Repair yang dihitung ke kartu "Repair Value" di halaman Report
 * (permintaan user 12–13 Okt 2026):
 *
 * 1. status "Done Kirim" atau "Done Repair"; dan
 * 2. kolom Penyelesaian boleh apa saja KECUALI "Replacement Produk Baru".
 *
 * Dibandingkan tanpa peduli huruf besar/kecil dan spasi pinggir karena nilainya
 * datang dari kolom teks Google Sheet, bukan dari daftar tertutup.
 */
const DONE_STATUSES = new Set(["done kirim", "done repair"]);
const EXCLUDED_RESOLUTIONS = new Set(["replacement produk baru"]);

export function isRepairDone(status: string): boolean {
  return DONE_STATUSES.has(status.trim().toLowerCase());
}

/** True bila baris ikut dihitung ke kartu Repair Value. */
export function countsForRepairValue(status: string, resolution: string | null | undefined): boolean {
  if (!isRepairDone(status)) return false;
  return !EXCLUDED_RESOLUTIONS.has((resolution ?? "").trim().toLowerCase());
}
