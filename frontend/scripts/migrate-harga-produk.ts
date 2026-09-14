/**
 * Migrasi satu kali: master harga produk per bulan/tahun + rujukan harga di PO.
 *
 * `drizzle-kit push` gagal untuk perubahan ini ("no such column: productPriceId")
 * karena ia membuat indeks sebelum kolomnya ada, jadi DDL-nya diterapkan di sini
 * lebih dulu — setelah itu `push` tinggal membandingkan dan tidak mengubah apa pun.
 *
 * Idempotent. Jalankan: npx tsx scripts/migrate-harga-produk.ts
 */
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "..", "data", "sqlite.db");
const db = new Database(dbPath);

const tableExists = (name: string) =>
  !!db
    .prepare("select name from sqlite_master where type='table' and name = ?")
    .get(name);
const columns = (table: string) =>
  db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
const hasColumn = (table: string, name: string) =>
  columns(table).some((c) => c.name === name);

console.log(
  "Sebelum → product_prices ada:",
  tableExists("product_prices"),
  "| purchase_orders.productPriceId ada:",
  hasColumn("purchase_orders", "productPriceId")
);

db.pragma("foreign_keys = OFF");
db.exec("begin");
try {
  if (!tableExists("product_prices")) {
    db.exec(`
      create table product_prices (
        id integer primary key autoincrement,
        productId integer not null references products(id),
        price real not null default 0,
        month text not null,
        year text not null,
        createdAt integer not null default (unixepoch()),
        updatedAt integer not null default (unixepoch())
      )
    `);
    console.log("tabel product_prices dibuat");
  }
  db.exec(
    "create unique index if not exists product_prices_unique on product_prices (productId, year, month)"
  );
  db.exec(
    "create index if not exists product_prices_product_idx on product_prices (productId)"
  );
  db.exec(
    "create index if not exists product_prices_period_idx on product_prices (year, month)"
  );

  if (!hasColumn("purchase_orders", "productPriceId")) {
    db.exec(
      "alter table purchase_orders add column productPriceId integer references product_prices(id)"
    );
    console.log("kolom purchase_orders.productPriceId ditambahkan");
  }

  // PO lama belum punya rujukan harga. Kalau produknya sudah punya harga untuk
  // bulan/tahun PO-nya, rujukan diisi otomatis; kalau belum, dibiarkan kosong
  // (Value RW memang dikosongkan sampai harganya diisi).
  const poRows = db
    .prepare(
      "select id, productId, poDate from purchase_orders where productPriceId is null"
    )
    .all() as Array<{ id: number; productId: number; poDate: string }>;
  const findPrice = db.prepare(
    "select id from product_prices where productId = ? and year = ? and month = ?"
  );
  const setPrice = db.prepare(
    "update purchase_orders set productPriceId = ? where id = ?"
  );
  let terisi = 0;
  for (const row of poRows) {
    const found = findPrice.get(
      row.productId,
      row.poDate.slice(0, 4),
      row.poDate.slice(5, 7)
    ) as { id: number } | undefined;
    if (found) {
      setPrice.run(found.id, row.id);
      terisi++;
    }
  }

  db.exec("commit");
  console.log(`PO lama diperiksa: ${poRows.length}, dapat rujukan harga: ${terisi}`);
} catch (err) {
  db.exec("rollback");
  throw err;
} finally {
  db.pragma("foreign_keys = ON");
}

console.log(
  "Sesudah → product_prices ada:",
  tableExists("product_prices"),
  "| purchase_orders.productPriceId ada:",
  hasColumn("purchase_orders", "productPriceId")
);
console.log(
  "kolom purchase_orders:",
  columns("purchase_orders")
    .map((c) => c.name)
    .join(", ")
);
db.close();
