import assert from "node:assert/strict";
import { claimMatchKey } from "../src/lib/claim-match";
import { cgCell, cgHeaderProblems, cgRaw, CG_COLUMNS } from "../src/lib/gsheet/cg-mapping";
import { parseSheetTimestamp } from "../src/lib/gsheet/mapping";
import { pickProductPrice } from "../src/lib/prices";
import type { ProductPrice } from "../src/lib/types";

/**
 * Pemeriksaan ringan modul Claim Garansi (tanpa jaringan/DB):
 *
 *   npx tsx scripts/cg-check.ts
 *
 * Menjaga tiga hal yang pernah bikin data salah: indeks kolom yang bergeser,
 * serial tanggal Google yang di-String() lebih dulu (jadi hilang), dan aturan
 * harga Regional Warehouse (bulan klaim → bulan terdekat sebelumnya).
 */

// Kolom: A Claim ID, B Timestamp, AC Official Name.
const row = ["202606102", 46023.402094907404, "Purwa"];
const cells = [...row];
cells[CG_COLUMNS.officialName] = "BARDI Smart IP Camera PoE IP67 4MP";
cells[CG_COLUMNS.quantity] = 2;
cells[CG_COLUMNS.status] = "Pengecekan Produk";

assert.equal(cgCell(cells, "claimId"), "202606102");
assert.equal(cgCell(cells, "officialName"), "BARDI Smart IP Camera PoE IP67 4MP");
assert.equal(cgCell(cells, "status"), "Pengecekan Produk");
assert.equal(cgRaw(cells, "quantity"), 2, "kolom angka harus tetap number");

// Serial Google → "YYYY-MM-DDTHH:mm"; kalau di-String() dulu hasilnya kosong.
assert.equal(parseSheetTimestamp(cgRaw(cells, "timestamp")), "2026-01-01T09:39");
assert.equal(parseSheetTimestamp(cgCell(cells, "timestamp")), "", "string serial memang tidak dikenali");

// Tajuk yang bergeser harus ketahuan, bukan diam-diam membaca kolom kosong.
assert.deepEqual(cgHeaderProblems(["Claim ID", "Timestamp"]), [
  'kolom 29 harus "Official Name"',
]);
assert.deepEqual(
  cgHeaderProblems(
    Array.from({ length: 29 }, (_, index) =>
      index === CG_COLUMNS.claimId ? "Claim ID" : index === CG_COLUMNS.officialName ? "Official Name" : ""
    )
  ),
  []
);

// Harga: bulan klaim dipakai kalau ada, kalau tidak → bulan terdekat sebelumnya.
const price = (month: string, value: number): ProductPrice => ({
  id: Number(month.replace("-", "")),
  productId: 11,
  priceType: "Regional Warehouse",
  year: month.slice(0, 4),
  month: month.slice(5, 7),
  price: value,
});
const prices = [price("2026-05", 100_000), price("2026-07", 120_000)];
assert.equal(pickProductPrice(prices, 11, "2026-07", "Regional Warehouse")?.price, 120_000);
assert.equal(pickProductPrice(prices, 11, "2026-06", "Regional Warehouse")?.price, 100_000);
assert.equal(pickProductPrice(prices, 11, "2026-08", "Regional Warehouse")?.price, 120_000);
// Lebih tua dari semua baris harga → pakai baris paling awal (bukan terbaru).
assert.equal(pickProductPrice(prices, 11, "2026-01", "Regional Warehouse")?.price, 100_000);

// Identitas baris: claim + tanggal + produk (Claim ID boleh ganda).
assert.equal(claimMatchKey("202606102", "2026-01-01", 11), "202606102|2026-01-01|11");
assert.notEqual(claimMatchKey("202606102", "2026-01-01", 11), claimMatchKey("202606102", "2026-01-02", 11));
assert.equal(claimMatchKey(" 202606102 ", "2026-01-01", null), "202606102|2026-01-01|");

console.log("cg-check: OK (kolom, serial tanggal, aturan harga, kunci baris)");
