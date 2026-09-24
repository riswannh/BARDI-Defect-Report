/**
 * Self-check logika sync SATU ARAH (sheet -> app), tanpa jaringan/DB:
 *   npx tsx scripts/gsheet-sync-check.ts
 */
import assert from "node:assert/strict";
import {
  baselineFromSheet,
  parseBaseline,
  planRowSync,
  type RowPlan,
} from "../src/lib/gsheet/sync";
import {
  normalizeCode,
  parseSheetNumber,
  parseSheetTimestamp,
  resolveHeaderIndex,
} from "../src/lib/gsheet/mapping";

const base = {
  codeGaransi: "ABC123",
  timeStamp: "2026-01-03T13:51",
  photosLink: "foto.jpg",
  videosLink: "video.mp4",
  problemId: "Death After Usage",
  problemDetail: "Totally dead",
  productId: "BARDI Smart Tag",
  quantity: "1",
  statusId: "Open",
  factoryId: "Pabrik A",
  value: "123120",
};
const baseline = baselineFromSheet(base);
const names = (plan: RowPlan) => ({
  apply: plan.apply.map((f) => f.field),
  conflicts: plan.conflicts.map((f) => f.field),
  appOnly: plan.appOnly.map((f) => f.field),
});

// 1. Tidak ada perubahan di kedua sisi -> tidak ada aksi.
let plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base },
  app: { ...base },
  baseline,
});
assert.deepEqual(names(plan), { apply: [], conflicts: [], appOnly: [] });

// 2. Sheet berubah, app belum ikut -> otomatis dipakai di app.
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, value: "200000" },
  app: { ...base },
  baseline,
});
assert.deepEqual(names(plan), { apply: ["value"], conflicts: [], appOnly: [] });
assert.equal(plan.apply[0].sheet, "200000");

// 3. App berubah, sheet tidak -> tidak ada yang ditulis ke mana pun (informasi saja).
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base },
  app: { ...base, quantity: "3" },
  baseline,
});
assert.deepEqual(names(plan), { apply: [], conflicts: [], appOnly: ["quantity"] });

// 4. Dua-duanya berubah di FIELD yang sama -> konflik, harus dipilih user.
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, quantity: "5" },
  app: { ...base, quantity: "3" },
  baseline,
});
assert.deepEqual(names(plan), { apply: [], conflicts: ["quantity"], appOnly: [] });
assert.equal(plan.conflicts[0].sheet, "5");
assert.equal(plan.conflicts[0].app, "3");

// 5. Dua-duanya berubah di field BERBEDA -> sheet tetap masuk, app dibiarkan.
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, value: "200000" },
  app: { ...base, quantity: "3" },
  baseline,
});
assert.deepEqual(names(plan), { apply: ["value"], conflicts: [], appOnly: ["quantity"] });

// 6. Belum pernah disinkron (tanpa baseline) -> selalu tanya, jangan menimpa.
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, value: "200000" },
  app: { ...base },
  baseline: null,
});
assert.deepEqual(names(plan), { apply: [], conflicts: ["value"], appOnly: [] });

// 7. Baseline selalu mengikuti nilai sheet terakhir (dipakai pembanding berikutnya).
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, value: "200000" },
  app: { ...base, quantity: "3" },
  baseline,
});
assert.equal(plan.baseline.value, baselineFromSheet({ ...base, value: "200000" }).value);
assert.equal(plan.baseline.quantity, baseline.quantity);

// 8. Beda huruf besar/kecil di Code Garansi bukan perubahan.
plan = planRowSync({
  code: "abc123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, codeGaransi: "abc123" },
  app: { ...base },
  baseline,
});
assert.deepEqual(names(plan), { apply: [], conflicts: [], appOnly: [] });

// 9. Sel kosong di sheet tetap dianggap perubahan biasa.
plan = planRowSync({
  code: "ABC123",
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, problemDetail: "" },
  app: { ...base },
  baseline,
});
assert.deepEqual(names(plan), { apply: ["problemDetail"], conflicts: [], appOnly: [] });

// 10. Baseline rusak/kosong diperlakukan sebagai belum pernah sync.
assert.equal(parseBaseline("bukan json"), null);
assert.equal(parseBaseline(null), null);
assert.equal(parseBaseline('{"value":"x"}')?.value, "x");

// 11. Konflik yang diputuskan "pakai sheet" -> nilainya masuk ke app.
plan = planRowSync({
  code: base.codeGaransi,
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, quantity: "5" },
  app: { ...base, quantity: "3" },
  baseline: baselineFromSheet(base),
  choices: { quantity: "sheet" },
});
assert.deepEqual(names(plan), { apply: ["quantity"], conflicts: [], appOnly: [] });
assert.equal(plan.resolved.length, 1);
assert.equal(plan.baseline.quantity, baselineFromSheet({ ...base, quantity: "5" }).quantity);

// 12. Konflik yang diputuskan "pakai app" -> nilai app bertahan, baseline ikut sheet
// supaya perubahan yang sama tidak ditanyakan lagi.
plan = planRowSync({
  code: base.codeGaransi,
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, quantity: "5" },
  app: { ...base, quantity: "3" },
  baseline: baselineFromSheet(base),
  choices: { quantity: "app" },
});
assert.deepEqual(names(plan), { apply: [], conflicts: [], appOnly: ["quantity"] });
assert.equal(plan.resolved.length, 1);
assert.equal(plan.baseline.quantity, baselineFromSheet({ ...base, quantity: "5" }).quantity);

// 13. Konflik yang belum diputuskan tidak menaikkan baseline field itu -> muncul lagi.
plan = planRowSync({
  code: base.codeGaransi,
  sheetRow: 2,
  localId: 1,
  sheet: { ...base, quantity: "5" },
  app: { ...base, quantity: "3" },
  baseline: baselineFromSheet(base),
});
assert.deepEqual(names(plan), { apply: [], conflicts: ["quantity"], appOnly: [] });
assert.equal(plan.baseline.quantity, undefined);
assert.equal(plan.baseline.value, baselineFromSheet(base).value);

// --- mapping ---
assert.equal(parseSheetNumber("123,120"), 123120);
assert.equal(parseSheetNumber(123120), 123120);
assert.equal(parseSheetNumber(""), 0);
assert.equal(parseSheetTimestamp("2026-01-03 13:51:39"), "2026-01-03T13:51");
assert.equal(parseSheetTimestamp("2026-01-03T09:05"), "2026-01-03T09:05");
assert.equal(normalizeCode(" b2qhlwz9ui "), "B2QHLWZ9UI");

const header = [
  "Code Garansi",
  "Time Stamp",
  "Foto Kendala",
  "Video Kendala",
  "Keterangan Kendala",
  "Produk",
  "Quantity",
  "Status",
  "Month",
  "Problem",
  "Pabrik",
  "Value",
  "Offical Name",
  "Translate",
  "Status Defect",
];
const resolved = resolveHeaderIndex(header);
assert.deepEqual(resolved.missing, []);
assert.equal(resolved.index.codeGaransi, 0);
assert.equal(resolved.index.problemId, 9);
assert.equal(resolved.index.value, 11);
assert.equal(resolved.index.productId, 12);
assert.equal(resolved.index.problemDetail, 13);
assert.equal(resolved.index.statusId, 14);
assert.deepEqual(resolveHeaderIndex(["Code Garansi"]).missing.length, 10);

// Timestamp: sel tanggal di "Big Data" format tampilannya campur, jadi semua
// bentuk yang pernah muncul harus dikenali (dan yang aneh -> kosong, bukan jam ngawur).
assert.equal(parseSheetTimestamp("2026-01-03 13:51:39"), "2026-01-03T13:51");
assert.equal(parseSheetTimestamp("2026-01-03T13:51"), "2026-01-03T13:51");
assert.equal(parseSheetTimestamp("9/9/2026 23:10:4"), "2026-09-09T23:10");
assert.equal(parseSheetTimestamp("03/09/2026 23:10"), "2026-03-09T23:10");
assert.equal(parseSheetTimestamp("13/09/2026 8:05"), "2026-09-13T08:05");
assert.equal(parseSheetTimestamp("3 Sep 2026 13:51"), "2026-09-03T13:51");
assert.equal(parseSheetTimestamp("Sep 3, 2026 13:51"), "2026-09-03T13:51");
assert.equal(parseSheetTimestamp("2026-09-09"), "2026-09-09T00:00");
assert.equal(parseSheetTimestamp(46274), "2026-09-09T00:00");
assert.equal(parseSheetTimestamp(46274.5), "2026-09-09T12:00");
assert.equal(parseSheetTimestamp("abc"), "");
assert.equal(parseSheetTimestamp(""), "");
assert.equal(parseSheetTimestamp(null), "");
assert.equal(parseSheetNumber("31,185,000"), 31185000);
assert.equal(parseSheetNumber(123.6), 124);
assert.equal(parseSheetNumber("1.234,5"), 1235);

console.log(
  "SEMUA LULUS: 13 pemeriksaan logika sync satu arah + 25 pemeriksaan mapping"
);
