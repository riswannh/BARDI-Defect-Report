/**
 * Migrasi satu kali: keterangan PO dari master (foreign key) menjadi teks tetap.
 *
 * Sebelumnya `purchase_orders.keteranganId` menunjuk ke tabel master `keterangan`
 * yang bisa di-CRUD. User memutuskan ketiga nilainya cukup di-hardcode
 * (Product Order / Sparepart Order / Replacement), jadi:
 *   1. kolom `keterangan` (teks) ditambahkan,
 *   2. isinya diambil dari nama master lewat `keteranganId` baris lama,
 *   3. kolom `keteranganId` dan tabel master `keterangan` dibuang.
 *
 * `ALTER TABLE ... DROP COLUMN` TIDAK bisa dipakai di sini: SQLite menolak
 * menghapus kolom yang masih disebut di definisi foreign key
 * ("error in table purchase_orders after drop column"). Karena itu tabelnya
 * dibangun ulang mengikuti prosedur resmi SQLite (buat tabel baru, salin data,
 * tukar nama) dengan `foreign_keys` dimatikan selama proses.
 *
 * Idempotent: kalau kolom `keteranganId` sudah tidak ada, tidak ada yang diubah.
 * Jalankan: npx tsx scripts/migrate-keterangan.ts
 */
import Database from "better-sqlite3";
import path from "node:path";

const DEFAULT_KETERANGAN = "Product Order";

const dbPath = path.resolve(process.cwd(), "..", "data", "sqlite.db");
const db = new Database(dbPath);

const columns = (table: string) =>
  db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
const hasColumn = (table: string, name: string) =>
  columns(table).some((c) => c.name === name);
const tableExists = (name: string) =>
  !!db
    .prepare("select name from sqlite_master where type='table' and name = ?")
    .get(name);

if (!hasColumn("purchase_orders", "keteranganId")) {
  console.log("Tidak ada kolom keteranganId — migrasi sudah pernah dijalankan.");
  db.close();
  process.exit(0);
}

const before = db.prepare("select count(*) c from purchase_orders").get() as { c: number };
console.log(`Sebelum: ${before.c} baris PO,`, JSON.stringify(db.prepare("select keteranganId, count(*) j from purchase_orders group by keteranganId").all()));

// Peta id master -> nama, dibaca sebelum tabel master dibuang.
const nameById = new Map<number, string>();
if (tableExists("keterangan")) {
  for (const row of db.prepare("select id, name from keterangan").all() as Array<{ id: number; name: string }>) {
    nameById.set(row.id, row.name);
  }
}

db.pragma("foreign_keys = OFF");
db.exec("begin");
try {
  if (!hasColumn("purchase_orders", "keterangan")) {
    db.exec(
      `alter table purchase_orders add column keterangan text not null default '${DEFAULT_KETERANGAN}'`
    );
  }

  const rows = db
    .prepare("select id, keteranganId from purchase_orders")
    .all() as Array<{ id: number; keteranganId: number | null }>;
  const update = db.prepare("update purchase_orders set keterangan = ? where id = ?");
  let kosong = 0;
  for (const row of rows) {
    const nama = row.keteranganId === null ? undefined : nameById.get(row.keteranganId);
    // Nama di luar tiga pilihan tetap disimpan apa adanya supaya tidak ada data
    // yang hilang diam-diam; hanya baris tanpa keterangan yang jatuh ke default.
    const nilai = nama && nama.trim() !== "" ? nama.trim() : DEFAULT_KETERANGAN;
    if (!nama || nama.trim() === "") kosong++;
    update.run(nilai, row.id);
  }

  // Bangun ulang tabel tanpa kolom keteranganId (prosedur resmi SQLite).
  db.exec(`
    create table purchase_orders_new (
      id integer primary key autoincrement,
      poNumber text not null,
      poDate text not null,
      productId integer not null references products(id),
      factoryId integer not null references factories(id),
      quantity integer not null default 0,
      pricePerPcs real not null default 0,
      value real not null default 0,
      currency text not null default 'Rp',
      ppn text not null default 'Non PPN',
      keterangan text not null default '${DEFAULT_KETERANGAN}',
      createdAt integer not null default (unixepoch()),
      updatedAt integer not null default (unixepoch())
    )
  `);
  db.exec(`
    insert into purchase_orders_new
      (id, poNumber, poDate, productId, factoryId, quantity, pricePerPcs, value, currency, ppn, keterangan, createdAt, updatedAt)
    select id, poNumber, poDate, productId, factoryId, quantity, pricePerPcs, value, currency, ppn, keterangan, createdAt, updatedAt
    from purchase_orders
  `);
  db.exec("drop table purchase_orders");
  db.exec("alter table purchase_orders_new rename to purchase_orders");
  db.exec("drop index if exists purchase_orders_factory_idx");
  db.exec("drop index if exists purchase_orders_po_idx");
  db.exec("drop index if exists purchase_orders_keterangan_idx");
  db.exec("drop index if exists purchase_orders_date_idx");
  db.exec("create index purchase_orders_factory_idx on purchase_orders (factoryId)");
  db.exec("create index purchase_orders_po_idx on purchase_orders (poNumber)");
  db.exec("create index purchase_orders_keterangan_idx on purchase_orders (keterangan)");
  db.exec("create index purchase_orders_date_idx on purchase_orders (poDate)");
  db.exec("drop table if exists keterangan");

  db.exec("commit");
  console.log(`Selesai. Baris tanpa keterangan yang memakai default: ${kosong}`);
} catch (err) {
  db.exec("rollback");
  throw err;
} finally {
  db.pragma("foreign_keys = ON");
}

const after = db.prepare("select count(*) c from purchase_orders").get() as { c: number };
console.log("Sesudah:", JSON.stringify(db.prepare("select keterangan, count(*) j from purchase_orders group by keterangan").all()));
console.log(`baris PO: ${before.c} -> ${after.c}`);
console.log("tabel keterangan masih ada:", tableExists("keterangan"));
console.log("kolom sekarang:", columns("purchase_orders").map((c) => c.name).join(", "));
db.close();
