/**
 * Self-check kartu "Claim Garansi BARDI" (halaman Report).
 *
 * Aturan yang diuji: baris `warranty_claims` berstatus "Belum Ada Data" dan
 * "CLOSED" TIDAK dihitung; sisanya dijumlahkan quantity dan nilainya.
 *
 * Jalankan: cd frontend && npx tsx scripts/claim-summary-check.ts
 */
import assert from "node:assert/strict";
import {
  CLAIM_EXCLUDED_STATUSES,
  countsForClaimSummary,
  summarizeClaims,
} from "../src/lib/claim-summary";

assert.deepEqual(CLAIM_EXCLUDED_STATUSES, ["belum ada data", "closed"]);

// Status yang dikecualikan, termasuk variasi spasi dan huruf besar-kecil.
assert.equal(countsForClaimSummary("Belum Ada Data"), false);
assert.equal(countsForClaimSummary("CLOSED"), false);
assert.equal(countsForClaimSummary(" closed "), false);
assert.equal(countsForClaimSummary("belum ada data"), false);

// Status yang ikut dihitung.
assert.equal(countsForClaimSummary("Penggantian Produk Baru"), true);
assert.equal(countsForClaimSummary("Perbaikan Produk"), true);
assert.equal(countsForClaimSummary("Pengecekan Produk"), true);
assert.equal(countsForClaimSummary(""), true);

// Hanya baris yang lolos filter yang dijumlahkan.
const rows = [
  { status: "Penggantian Produk Baru", quantity: 2, value: 1_000_000 },
  { status: "Perbaikan Produk", quantity: 1, value: 250_000 },
  { status: "Belum Ada Data", quantity: 5, value: 9_999_999 },
  { status: "CLOSED", quantity: 7, value: 8_888_888 },
];
const counted = rows.filter((row) => countsForClaimSummary(row.status));
const summary = summarizeClaims(counted);
assert.deepEqual(summary, { qty: 3, value: 1_250_000, rows: 2 });

// Daftar kosong tetap nol (bukan NaN).
assert.deepEqual(summarizeClaims([]), { qty: 0, value: 0, rows: 0 });

console.log("claim-summary-check: OK (status dikecualikan, penjumlahan, daftar kosong)");
