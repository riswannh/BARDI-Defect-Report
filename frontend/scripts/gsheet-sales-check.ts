import assert from "node:assert/strict";
import {
  monthFromLabel,
  parseSalesNumber,
  resolveSalesLayout,
  salesRowKey,
} from "../src/lib/gsheet/sales-mapping";
import { planSalesCell } from "../src/lib/gsheet/sales-sync";
import { baselineFromSheet } from "../src/lib/gsheet/sync";

// Self-check logika sync tab "Data Penjualan" (tabel lebar). Jalankan:
//   npx tsx scripts/gsheet-sales-check.ts

const app = (quantity: number, value: number, localId = 5) => ({ localId, quantity, value });

// 1. Baris baru dari sheet masuk ke app.
let plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 250, value: 31185000 },
  app: null,
  baseline: null,
});
assert.equal(plan.empty, false);
assert.deepEqual(plan.insert, { quantity: 250, value: 31185000 });
assert.deepEqual(plan.conflicts, []);

// 2. Bulan yang di sheet 0 semua dan belum ada di app -> dilewati (keputusan user).
plan = planSalesCell({
  key: salesRowKey(1, 2, "Oct"),
  label: "Produk A · October 2026",
  sheetRow: 4,
  sheet: { quantity: 0, value: 0 },
  app: null,
  baseline: null,
});
assert.equal(plan.empty, true);
assert.equal(plan.insert, null);

// 3. Sudah sama -> tidak ada aksi.
const baseline = baselineFromSheet({ quantity: "250", value: "31185000" }, ["quantity", "value"]);
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 250, value: 31185000 },
  app: app(250, 31185000),
  baseline,
});
assert.deepEqual([plan.apply, plan.conflicts, plan.appOnly], [[], [], []]);

// 4. Sheet berubah, app belum ikut -> otomatis dipakai di app.
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 300, value: 31185000 },
  app: app(250, 31185000),
  baseline,
});
assert.deepEqual(plan.apply.map((f) => f.field), ["quantity"]);
assert.equal(plan.apply[0].sheet, "300");

// 5. App berubah, sheet tidak -> cuma informasi (sheet read-only).
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 250, value: 31185000 },
  app: app(200, 31185000),
  baseline,
});
assert.deepEqual(plan.appOnly.map((f) => f.field), ["quantity"]);
assert.deepEqual(plan.apply, []);

// 6. Dua-duanya berubah -> konflik per field.
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 300, value: 31185000 },
  app: app(200, 31185000),
  baseline,
});
assert.deepEqual(plan.conflicts.map((f) => f.field), ["quantity"]);

// 7. Konflik yang diputuskan "pakai sheet" -> masuk ke app.
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 300, value: 31185000 },
  app: app(200, 31185000),
  baseline,
  choices: { quantity: "sheet" },
});
assert.deepEqual(plan.apply.map((f) => f.field), ["quantity"]);
assert.equal(plan.resolved.length, 1);

// 8. Konflik yang diputuskan "pakai app" -> nilai app bertahan, baseline ikut sheet.
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 300, value: 31185000 },
  app: app(200, 31185000),
  baseline,
  choices: { quantity: "app" },
});
assert.deepEqual([plan.apply, plan.conflicts], [[], []]);
assert.deepEqual(plan.appOnly.map((f) => f.field), ["quantity"]);
assert.equal(plan.baseline.quantity, baselineFromSheet({ quantity: "300" }, ["quantity"]).quantity);

// 9. Belum pernah sync (tanpa baseline) -> tanya dulu, jangan menimpa.
plan = planSalesCell({
  key: salesRowKey(1, 2, "Jan"),
  label: "Produk A · January 2026",
  sheetRow: 4,
  sheet: { quantity: 300, value: 31185000 },
  app: app(200, 20000000),
  baseline: null,
});
assert.deepEqual(plan.conflicts.map((f) => f.field).sort(), ["quantity", "value"]);

// 10. Konflik yang belum diputuskan tidak menaikkan baseline field itu.
assert.equal(plan.baseline.quantity, undefined);
assert.equal(plan.baseline.value, undefined);

// --- mapping ---
assert.equal(monthFromLabel("January 2026"), "Jan");
assert.equal(monthFromLabel("December 2026"), "Dec");
assert.equal(monthFromLabel("Jan"), "Jan");
assert.equal(monthFromLabel(""), null);
assert.equal(monthFromLabel("Total"), null);

assert.equal(parseSalesNumber(31185000), 31185000);
assert.equal(parseSalesNumber("31,185,000.00"), 31185000);
assert.equal(parseSalesNumber("1.234,56"), 1234.56);
assert.equal(parseSalesNumber(""), 0);
assert.equal(parseSalesNumber(null), 0);
assert.equal(parseSalesNumber("-"), 0);
assert.equal(parseSalesNumber("(1,500)"), -1500);

const header = [
  "Nama Data Penjualan",
  "Official Name",
  "Factory",
  "January 2026",
  "",
  "February 2026",
  "",
];
const sub = ["", "", "", "QTY", "Value", "QTY", "Value"];
const layout = resolveSalesLayout(header, sub);
assert.equal(layout.official, 1);
assert.equal(layout.factory, 2);
assert.deepEqual(layout.missing, []);
assert.deepEqual(layout.months, [
  { month: "Jan", label: "January 2026", qtyCol: 3, valCol: 4 },
  { month: "Feb", label: "February 2026", qtyCol: 5, valCol: 6 },
]);
assert.deepEqual(resolveSalesLayout(["Official Name"], ["x"]).missing.length, 2);

console.log("SEMUA LULUS: 10 pemeriksaan logika sync sales + 13 pemeriksaan mapping");
