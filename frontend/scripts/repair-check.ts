import assert from "node:assert/strict";
import {
  REPAIR_FIELDS,
  repairFieldsFromRow,
  repairSavingValue,
  repairSheetRange,
  resolveRepairHeaderIndex,
  resolveSparePart,
} from "../src/lib/gsheet/repair-mapping";
import { planRepairRow } from "../src/lib/gsheet/repair-sync";
import { baselineFromSheet } from "../src/lib/gsheet/sync";
import { repairMatchKey } from "../src/lib/repair-match";

// Self-check modul Repair Data: pemetaan kolom sheet, konversi nilai, dan aturan
// sync. Jalankan: npx tsx scripts/repair-check.ts

/* ------------------------- 1. Pemetaan header kolom ------------------------ */

/** Baris 3 tab "Data Reparasi" (A..W) apa adanya, termasuk header kembar "Note". */
const HEADER = [
  " Tanggal",
  "Bulan",
  "CLAIM ID",
  "Nama Produk",
  "Quantity",
  "Asal",
  "Nama ",
  "No Telp",
  "Resi",
  "Kendala dari cust",
  "Foto Paket",
  "Foto Kelengkapan",
  "Status",
  "Start",
  "Finish",
  "Note",
  "PIC",
  "Penyelesaian",
  "Teknis Device",
  "Sparepart/Komponen 1",
  "Sparepart/Komponen 2",
  "Sparepart/Komponen 3",
  "Note",
];

const resolved = resolveRepairHeaderIndex(HEADER);
assert.deepEqual(resolved.missing, [], "semua header sheet harus dikenali");
assert.equal(resolved.index.claimId, 2, "CLAIM ID ada di kolom C");
assert.equal(resolved.index.productId, 3, "Nama Produk ada di kolom D");
assert.equal(resolved.index.quantity, 4, "Quantity ada di kolom E");
assert.equal(resolved.index.note, 15, "Note pertama (kolom P) untuk field note");
assert.equal(resolved.index.noteClosing, 22, "Note kedua (kolom W) untuk noteClosing");
assert.equal(resolved.index.sparePart1Id, 19, "Sparepart 1 ada di kolom T");
assert.equal(resolved.index.sparePart3Id, 21, "Sparepart 3 ada di kolom V");
assert.equal(
  REPAIR_FIELDS.some((field) => (resolved.index[field] ?? -1) < 0),
  false,
  "tidak ada field yang kehilangan kolom"
);

// Header pengganti (sheet berubah nama) tetap harus ketemu lewat alias.
const renamed = resolveRepairHeaderIndex(
  HEADER.map((name) => (name === "Sparepart/Komponen 1" ? "Sparepart 1" : name))
);
assert.equal(renamed.index.sparePart1Id, 19, "alias 'Sparepart 1' dikenali");

// Kolom yang benar-benar hilang dilaporkan, bukan diam-diam jadi -1.
const missingResi = resolveRepairHeaderIndex(HEADER.filter((name) => name !== "Resi"));
assert.equal(missingResi.index.resi, -1, "kolom hilang ditandai -1");
assert.deepEqual(missingResi.missing, ["resi"], "kolom hilang masuk daftar missing");

/* --------------------------- 2. Konversi nilai ---------------------------- */

// Serial tanggal Google: 46119 = 2026-04-07 (hari sejak 1899-12-30).
const row = repairFieldsFromRow(
  [
    46119, // Tanggal (serial)
    "April 2026", // Bulan (tidak dipakai)
    " rfb-001 ", // CLAIM ID
    "BARDI Smart Tag", // Nama Produk
    1234, // Quantity (mentah; sync membaca UNFORMATTED_VALUE)
    "Distri",
    "Budi",
    "08123",
    "JNE123",
    "Tidak menyala",
    "https://drive.google.com/a",
    "https://drive.google.com/b",
    "Done Repair",
    46119.5, // Start (serial + jam, 12:00)
    "2026-04-09 15:30",
    "Catatan p",
    "Aji",
    "Ganti Sparepart",
    "Totally Dead",
    "Baterai",
    "",
    "Kabel",
    "Catatan w",
  ],
  resolved.index
);

assert.equal(row.claimId, "RFB-001", "Claim ID dinormalkan jadi huruf besar");
assert.equal(row.date, "2026-04-07", "serial tanggal -> YYYY-MM-DD");
assert.equal(row.quantity, "1234", "quantity dibaca sebagai angka");
assert.equal(row.startAt, "2026-04-07T12:00", "serial + jam -> timestamp app");
assert.equal(row.finishAt, "2026-04-09T15:30", "teks tanggal -> timestamp app");
assert.equal(row.note, "Catatan p", "note = kolom Note pertama");
assert.equal(row.noteClosing, "Catatan w", "noteClosing = kolom Note kedua");
assert.equal(row.sparePart1Id, "Baterai", "sparepart 1 terbaca");
assert.equal(row.sparePart3Id, "Kabel", "sparepart 3 terbaca");
assert.equal(row.problemId, "Totally Dead", "Teknis Device terbaca");

// Kolom bertipe tanggal yang isinya teks bebas tidak boleh jadi tanggal salah.
const weird = repairFieldsFromRow(
  [46119, "", "RFB-002", "Produk", 1, "", "", "", "", "", "", "", "", "Oktober 2026", "", "", "", "", "", "", "", "", ""],
  resolved.index
);
assert.equal(weird.startAt, "", "teks 'Oktober 2026' bukan timestamp -> kosong");

/* --------------------------- 3. Saving Value ------------------------------ */

assert.equal(repairSavingValue(3, 153_900), 461_700, "Quantity x harga RW");
assert.equal(repairSavingValue(0, 153_900), 0, "Quantity 0 -> Saving Value 0");
assert.equal(repairSavingValue(2, 0), 0, "produk tanpa harga RW -> 0");

/* ------------------------------ 4. Range sheet ---------------------------- */

assert.equal(
  repairSheetRange("Data Reparasi"),
  "'Data Reparasi'!A3:W",
  "range baca dimulai dari baris header"
);

/* -------------------- 4b. Kunci baris tidak lengkap ----------------------- */

// Baris tanpa Claim ID tetap punya kunci stabil, jadi sync berikutnya
// mencocokkannya lagi (tidak menggandakan baris).
assert.equal(
  repairMatchKey("", "2026-10-02", null),
  "|2026-10-02|",
  "kunci baris tanpa Claim ID & tanpa produk"
);

/* -------------------------------- 5. Sync --------------------------------- */

const sheetRow = {
  claimId: "RFB-001",
  date: "2026-04-07",
  productId: "BARDI Smart Tag",
  quantity: "2",
  status: "Proses",
  pic: "Aji",
};

// Baris baru -> insert, semua field diambil dari sheet.
const inserted = planRepairRow({ sheet: sheetRow, app: null, baseline: null });
assert.equal(inserted.action, "insert", "Claim ID baru -> insert");

// Sudah sama persis -> tidak ada yang dikerjakan.
const same = planRepairRow({ sheet: sheetRow, app: sheetRow, baseline: inserted.baseline });
assert.equal(same.action, "skip", "nilai sama -> skip");
assert.deepEqual(same.changed, [], "tidak ada field yang berubah");

// Sheet berubah, app belum ikut -> field itu diambil dari sheet.
const fromSheet = planRepairRow({
  sheet: { ...sheetRow, status: "Done Repair" },
  app: sheetRow,
  baseline: inserted.baseline,
});
assert.equal(fromSheet.action, "update", "perubahan sheet -> update");
assert.deepEqual(fromSheet.apply, ["status"], "hanya field yang berubah yang diambil");
assert.deepEqual(fromSheet.conflicts, [], "tidak ada konflik");

// App berubah, sheet tidak -> tidak ada yang ditulis.
const appOnly = planRepairRow({
  sheet: sheetRow,
  app: { ...sheetRow, pic: "Roland" },
  baseline: inserted.baseline,
});
assert.equal(appOnly.action, "skip", "perubahan app saja -> dilewati");
assert.deepEqual(appOnly.changed, [], "perubahan app saja tidak dianggap beda");

// Dua-duanya berubah -> nilai app dipertahankan dan dilaporkan.
const both = planRepairRow({
  sheet: { ...sheetRow, status: "Done Kirim" },
  app: { ...sheetRow, status: "Done Repair" },
  baseline: inserted.baseline,
});
assert.equal(both.action, "keep-local", "dua sisi berubah -> keep-local");
assert.deepEqual(both.conflicts, ["status"], "field bentrok dilaporkan");
assert.equal(both.baseline.status, undefined, "baseline field bentrok tidak dimajukan");

// Perubahan sheet di field lain tetap masuk walau ada satu field bentrok.
const mixed = planRepairRow({
  sheet: { ...sheetRow, status: "Done Kirim", resi: "JNE999" },
  app: { ...sheetRow, status: "Done Repair", resi: "" },
  baseline: baselineFromSheet({ ...sheetRow, resi: "" }, REPAIR_FIELDS),
});
assert.equal(mixed.action, "update", "field lain tetap diambil dari sheet");
assert.deepEqual(mixed.apply, ["resi"], "hanya field yang tidak bentrok");
assert.deepEqual(mixed.conflicts, ["status"], "field bentrok tetap dilaporkan");

// Kolom app yang KOSONG diisi ulang sheet: isian yang dulu terlanjur dikosongkan
// (sparepart / Teknis Device belum ada di master) tidak dianggap pilihan manusia.
const refill = planRepairRow({
  sheet: { ...sheetRow, sparePart1Id: "Baterai" },
  app: { ...sheetRow, sparePart1Id: "" },
  baseline: inserted.baseline,
});
assert.equal(refill.action, "update", "app kosong -> diisi sheet, bukan dianggap konflik");
assert.deepEqual(refill.apply, ["sparePart1Id"], "kolom kosong ikut diambil dari sheet");
assert.deepEqual(refill.conflicts, [], "kolom kosong bukan konflik");

// Sparepart dari sheet: yang tidak ada di Data Master disimpan TEKS-nya, bukan dikosongkan.
const masters = new Map<string, number>([["baterai", 7]]);
assert.deepEqual(
  resolveSparePart("Baterai", masters),
  { id: 7, text: "Baterai" },
  "sparepart yang ada di master dapat id"
);
assert.deepEqual(
  resolveSparePart("  Kabel   Fleksibel ", masters),
  { id: null, text: "Kabel Fleksibel" },
  "sparepart yang belum ada di master tetap disimpan teksnya"
);
assert.deepEqual(resolveSparePart("", masters), { id: null, text: "" }, "sel kosong -> tanpa id dan tanpa teks");

/* ------------------- 6. Identitas baris: Claim ID tidak unik ------------------ */

// Satu Claim ID boleh dipakai beberapa baris selama tanggal/produknya beda.
assert.notEqual(
  repairMatchKey("202606793", "2026-04-01", 12),
  repairMatchKey("202606793", "2026-04-02", 12),
  "tanggal beda -> baris dianggap beda"
);
assert.notEqual(
  repairMatchKey("202606793", "2026-04-01", 12),
  repairMatchKey("202606793", "2026-04-01", 13),
  "produk beda -> baris dianggap beda"
);
assert.equal(
  repairMatchKey(" 202606793 ", "2026-04-01", 12),
  repairMatchKey("202606793", "2026-04-01", 12),
  "spasi/huruf besar-kecil tidak mengubah identitas"
);
assert.equal(
  repairMatchKey("202606793", "2026-04-01", null),
  repairMatchKey("202606793", "2026-04-01", null),
  "produk kosong tetap punya identitas"
);

console.log("repair-check: semua pemeriksaan lulus");
