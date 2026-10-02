/**
 * Logika periode harga yang dipakai bersama oleh harga produk dan harga
 * sparepart.
 *
 * Harga disimpan per bulan+tahun, dan untuk pergantian bulan ada tombol "salin
 * harga periode sebelumnya". Aturan pemilihannya sengaja tidak diduplikasi:
 * kalau aturannya berubah, kedua modul harus ikut berubah.
 */

export interface PricePeriodRow {
  /** Rujukan harga: `productId` untuk produk, `sparePartId` untuk sparepart. */
  refId: number;
  price: number;
  /** "01".."12". */
  month: string;
  year: string;
}

/** Periode ini lebih awal dari periode tujuan? */
function isBeforeTarget(
  row: { year: string; month: string },
  month: string,
  year: string
) {
  return row.year < year || (row.year === year && row.month < month);
}

/**
 * Harga terakhir SEBELUM periode tujuan untuk tiap rujukan.
 *
 * Bukan hanya bulan tepat sebelumnya: produk/sparepart yang harganya jarang
 * diisi tetap ikut tersalin dari periode terakhir yang benar-benar punya harga.
 */
export function lastPriceBefore(
  rows: PricePeriodRow[],
  month: string,
  year: string
): Map<number, { price: number; month: string; year: string }> {
  const best = new Map<number, { price: number; month: string; year: string }>();
  for (const row of rows) {
    if (!isBeforeTarget(row, month, year)) continue;
    const current = best.get(row.refId);
    if (
      !current ||
      row.year > current.year ||
      (row.year === current.year && row.month > current.month)
    ) {
      best.set(row.refId, {
        price: row.price,
        month: row.month,
        year: row.year,
      });
    }
  }
  return best;
}

/** Pesan hasil carry-forward yang seragam untuk kedua modul harga. */
export function carryForwardMessage(
  label: string,
  inserted: number,
  skipped: number,
  period: { month: string; year: string }
) {
  if (inserted === 0) {
    return skipped > 0
      ? `Semua harga ${label} sudah ada di ${period.month}/${period.year}.`
      : `Belum ada harga ${label} sebelum ${period.month}/${period.year} untuk disalin.`;
  }
  return `${inserted} harga ${label} disalin ke ${period.month}/${period.year}.`;
}
