/**
 * Memulihkan baris purchase_orders dari backup "hapus semua".
 *
 * Dibuat karena fitur Hapus Semua di halaman PO menghapus seluruh baris, dan
 * backup otomatisnya masih menyimpan datanya. Baris disalin apa adanya
 * (termasuk id) supaya rujukan ke produk/pabrik tidak berubah.
 *
 * Jalankan: npx tsx scripts/restore-purchase-orders.ts <backup.db> <target.db>
 */
import Database from "better-sqlite3";

const [backupPath, targetPath] = process.argv.slice(2);
if (!backupPath || !targetPath) {
  console.error(
    "Pakai: npx tsx scripts/restore-purchase-orders.ts <backup.db> <target.db>"
  );
  process.exit(1);
}

const src = new Database(backupPath, { readonly: true });
const dst = new Database(targetPath);

const rows = src.prepare("select * from purchase_orders order by id").all() as Array<
  Record<string, unknown>
>;
if (rows.length === 0) {
  console.log("Backup tidak berisi baris purchase_orders.");
  src.close();
  dst.close();
  process.exit(0);
}

const cols = Object.keys(rows[0]);
console.log(`Backup berisi ${rows.length} baris. Kolom: ${cols.join(", ")}`);

const existing = (
  dst.prepare("select count(*) c from purchase_orders").get() as { c: number }
).c;
if (existing > 0) {
  console.log(`Target sudah berisi ${existing} baris — tidak ada yang ditulis.`);
  src.close();
  dst.close();
  process.exit(0);
}

const insert = dst.prepare(
  `insert into purchase_orders (${cols.join(", ")}) values (${cols
    .map((c) => `@${c}`)
    .join(", ")})`
);
const restore = dst.transaction((list: Array<Record<string, unknown>>) => {
  for (const row of list) insert.run(row);
});
restore(rows);

const after = (
  dst.prepare("select count(*) c from purchase_orders").get() as { c: number }
).c;
const perKeterangan = dst
  .prepare("select keterangan, count(*) c from purchase_orders group by keterangan")
  .all();
console.log(`Dipulihkan: ${after} baris. Per keterangan: ${JSON.stringify(perKeterangan)}`);
const inconsistent = (
  dst
    .prepare(
      "select count(*) c from purchase_orders where value <> pricePerPcs * quantity"
    )
    .get() as { c: number }
).c;
console.log(`Baris dengan total tidak konsisten: ${inconsistent} (harap 0)`);

src.close();
dst.close();
