/**
 * Hitung ulang `repairs.value` (dan `repairs.productPriceId`) dari Price List.
 *
 * Dipakai setelah aturan harga diperbaiki (12 Okt 2026): baris yang bulannya
 * belum punya harga dulu memakai harga TERBARU produk, sekarang memakai harga
 * yang BERLAKU saat itu (periode terakhir <= bulan baris). Sync Google Sheet
 * cuma menghitung ulang baris yang berubah, jadi baris lama perlu pass ini.
 *
 * Jalankan dari folder `frontend` (tanpa `--apply` = lihat dampaknya saja):
 *   $env:DB_FILE_NAME='C:/.../sqlite.db'
 *   cmd /c "npx tsx scripts/repair-value-recalc.ts"
 *   cmd /c "npx tsx scripts/repair-value-recalc.ts --apply"
 */
import { sqliteClient } from "../src/lib/db";
import { pickProductPrice } from "../src/lib/prices";
import { DEFAULT_PRICE_TYPE } from "../src/lib/api/validation";
import type { ProductPrice } from "../src/lib/types";

const apply = process.argv.includes("--apply");

const priceRows = sqliteClient
  .prepare(
    `select id, productId, price, priceType, month, year from product_prices where priceType = ?`
  )
  .all(DEFAULT_PRICE_TYPE) as ProductPrice[];

const rows = sqliteClient
  .prepare(
    `select id, claimId, date, quantity, value, productId from repairs where productId is not null`
  )
  .all() as Array<{
  id: number;
  claimId: string;
  date: string;
  quantity: number;
  value: number;
  productId: number;
}>;

const update = sqliteClient.prepare(
  `update repairs set value = ?, productPriceId = ? where id = ?`
);

let berubah = 0;
let sebelum = 0;
let sesudah = 0;
const contoh: string[] = [];

sqliteClient.exec("begin");
try {
  for (const row of rows) {
    const price = pickProductPrice(
      priceRows,
      row.productId,
      row.date.slice(0, 7),
      DEFAULT_PRICE_TYPE
    );
    if (!price) continue;
    const next = row.quantity * price.price;
    if (next === row.value) continue;
    berubah += 1;
    sebelum += row.value;
    sesudah += next;
    if (contoh.length < 10) {
      contoh.push(
        `${row.claimId} ${row.date} qty ${row.quantity}: ${row.value} -> ${next} (harga ${price.year}-${price.month})`
      );
    }
    if (apply) update.run(next, price.id, row.id);
  }
  if (apply) sqliteClient.exec("commit");
  else sqliteClient.exec("rollback");
} catch (err) {
  sqliteClient.exec("rollback");
  throw err;
}

console.log(
  `${apply ? "DITERAPKAN" : "PRATINJAU (jalankan dengan --apply untuk menulis)"} — baris diperiksa: ${rows.length}, value berubah: ${berubah}`
);
console.log(
  `total: ${sebelum.toLocaleString("id-ID")} -> ${sesudah.toLocaleString("id-ID")} (${(sesudah - sebelum).toLocaleString("id-ID")})`
);
for (const line of contoh) console.log("  " + line);
sqliteClient.close();
