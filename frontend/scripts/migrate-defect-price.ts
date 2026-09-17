/**
 * Migrasi satu kali: kolom `defects.productPriceId` + penautan defect lama.
 *
 * `value` defect kini bisa dihitung dari harga master (quantity × harga), sama
 * seperti Value RW di PO Product. Baris defect menyimpan RUJUKAN ke
 * `product_prices`, bukan salinan angkanya.
 *
 * Data lama TIDAK dihitung ulang — value-nya sudah benar dan dibiarkan apa
 * adanya. Yang dilakukan hanya menautkan rujukan harga untuk defect yang
 * produknya memang PUNYA harga di bulan/tahun defect itu (saat ini hanya
 * sebagian kecil produk). Sisanya tetap tanpa rujukan dan value-nya manual.
 *
 * Idempotent. Jalankan: npx tsx scripts/migrate-defect-price.ts
 */
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "..", "data", "sqlite.db");
const db = new Database(dbPath);

const columns = (table: string) =>
  db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
const hasColumn = (table: string, name: string) =>
  columns(table).some((c) => c.name === name);

console.log(
  "Sebelum → defects.productPriceId ada:",
  hasColumn("defects", "productPriceId")
);

db.pragma("foreign_keys = OFF");
db.exec("begin");
try {
  if (!hasColumn("defects", "productPriceId")) {
    db.exec(
      "alter table defects add column productPriceId integer references product_prices(id)"
    );
    console.log("kolom defects.productPriceId ditambahkan");
  }

  const before = db.prepare("select count(*) c from defects").get() as { c: number };
  const rows = db
    .prepare(
      "select id, productId, timeStamp from defects where productPriceId is null"
    )
    .all() as Array<{ id: number; productId: number; timeStamp: string }>;
  const findPrice = db.prepare(
    "select id from product_prices where productId = ? and year = ? and month = ?"
  );
  const setPrice = db.prepare(
    "update defects set productPriceId = ? where id = ?"
  );

  let tertaut = 0;
  for (const row of rows) {
    const found = findPrice.get(
      row.productId,
      row.timeStamp.slice(0, 4),
      row.timeStamp.slice(5, 7)
    ) as { id: number } | undefined;
    if (found) {
      setPrice.run(found.id, row.id);
      tertaut++;
    }
  }

  db.exec("commit");
  console.log(
    `defect diperiksa: ${rows.length} dari ${before.c}, dapat rujukan harga: ${tertaut}`
  );
} catch (err) {
  db.exec("rollback");
  throw err;
} finally {
  db.pragma("foreign_keys = ON");
}

const cek = db.prepare("select count(*) c from defects where productPriceId is not null").get() as { c: number };
const cocok = db
  .prepare(
    `select count(*) c from defects d join product_prices p on p.id = d.productPriceId
     where d.value <> d.quantity * p.price`
  )
  .get() as { c: number };

console.log("Sesudah → defects.productPriceId ada:", hasColumn("defects", "productPriceId"));
console.log(`defect dengan rujukan harga: ${cek.c}`);
console.log(
  `defect bertaut yang value-nya TIDAK sama dengan qty × harga: ${cocok.c} (dibiarkan apa adanya)`
);
console.log("total defect:", (db.prepare("select count(*) c from defects").get() as { c: number }).c);
db.close();
