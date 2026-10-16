/**
 * Kartu "Claim Garansi BARDI" di halaman Report (permintaan user 18 Okt 2026).
 *
 * Dasarnya tabel `warranty_claims` (cermin tab "Raw Combine CG"). Baris berstatus
 * "Belum Ada Data" dan "CLOSED" TIDAK dihitung — status itu berarti claimnya
 * belum jalan atau sudah ditutup tanpa pergantian, jadi tidak masuk nilai klaim.
 * Baris sisanya dijumlahkan quantity dan nilainya (unit × harga RW Price List).
 */
export const CLAIM_EXCLUDED_STATUSES = ["belum ada data", "closed"];

/** True bila baris ini ikut dihitung di kartu Claim Garansi BARDI. */
export function countsForClaimSummary(status: string): boolean {
  return !CLAIM_EXCLUDED_STATUSES.includes(status.trim().toLowerCase());
}

export interface ClaimSummaryRow {
  status: string;
  quantity: number;
  value: number;
}

export interface ClaimSummary {
  /** Σ quantity baris yang ikut dihitung. */
  qty: number;
  /** Σ value baris yang ikut dihitung (Rupiah). */
  value: number;
  /** Jumlah baris yang ikut dihitung (keterangan kartu). */
  rows: number;
}

/** Jumlahkan baris yang lolos aturan status di atas. */
export function summarizeClaims(rows: ClaimSummaryRow[]): ClaimSummary {
  return rows.reduce<ClaimSummary>(
    (acc, row) => {
      acc.qty += row.quantity;
      acc.value += row.value;
      acc.rows += 1;
      return acc;
    },
    { qty: 0, value: 0, rows: 0 }
  );
}
