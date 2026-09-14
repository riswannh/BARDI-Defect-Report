import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/* ============================================================
 * Application tables
 * ============================================================ */

export const factories = sqliteTable("factories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/* ============================================================
 * Better Auth tables
 * ============================================================ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  // username plugin
  username: text("username").unique(),
  displayUsername: text("displayUsername"),
  // app fields
  isAdmin: integer("isAdmin", { mode: "boolean" }).notNull().default(false),
  factoryId: integer("factoryId").references(() => factories.id, {
    onDelete: "set null",
  }),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

/* ============================================================
 * Application tables (lanjutan)
 * ============================================================ */

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /**
   * SKU opsional tapi unik kalau diisi.
   *
   * Kolomnya nullable karena produk lama belum punya SKU; di SQLite beberapa
   * baris NULL tidak saling bentrok pada constraint UNIQUE, jadi produk lama
   * tetap valid sementara SKU baru tetap tidak bisa terduplikasi.
   */
  sku: text("sku").unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const problems = sqliteTable("problems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const statuses = sqliteTable("statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Master keterangan DIHAPUS. Keterangan PO kini nilai tetap — lihat
 * `KETERANGAN_OPTIONS` di `src/lib/api/validation.ts` — sehingga tidak perlu
 * tabel, CRUD, maupun tab Data Master. Baris PO menyimpan namanya langsung
 * sebagai teks.
 */

export const defects = sqliteTable(
  "defects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    codeGaransi: text("codeGaransi").notNull().unique(),
    timeStamp: text("timeStamp").notNull(),
    photosLink: text("photosLink").notNull().default(""),
    videosLink: text("videosLink").notNull().default(""),
    problemId: integer("problemId")
      .notNull()
      .references(() => problems.id),
    problemDetail: text("problemDetail").notNull().default(""),
    productId: integer("productId")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(0),
    statusId: integer("statusId")
      .notNull()
      .references(() => statuses.id),
    factoryId: integer("factoryId")
      .notNull()
      .references(() => factories.id),
    value: integer("value").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("defects_factory_idx").on(t.factoryId),
    index("defects_product_idx").on(t.productId),
    index("defects_timestamp_idx").on(t.timeStamp),
  ]
);

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("productId")
      .notNull()
      .references(() => products.id),
    factoryId: integer("factoryId")
      .notNull()
      .references(() => factories.id),
    month: text("month").notNull(),
    quantity: integer("quantity").notNull().default(0),
    value: integer("value").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("sales_unique_row").on(t.productId, t.factoryId, t.month),
    index("sales_factory_idx").on(t.factoryId),
  ]
);

/**
 * Purchase Order (PO) — satu baris per produk per PO.
 *
 * SENGAJA TANPA constraint UNIQUE: user memutuskan satu PO Number boleh diinput
 * berkali-kali, termasuk untuk produk yang sama, tanpa kolom pembeda. Jadi tidak
 * ada aturan yang menolak baris duplikat.
 *
 * SKU tidak disimpan di sini: SKU melekat pada `products.sku` dan `productId`
 * sudah menjadi rujukannya. Menyalin SKU sebagai teks bebas akan membuat dua
 * sumber kebenaran yang bisa saling bertentangan saat SKU produk diubah.
 */
export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Diinput manual; boleh berulang. */
    poNumber: text("poNumber").notNull(),
    /**
     * TANGGAL PO yang diisi operator (bukan waktu input baris). Formatnya sama
     * dengan `defects.timeStamp`: `YYYY-MM-DDTHH:mm`, sehingga helper
     * normalisasi dan tampilan yang sudah ada bisa dipakai ulang.
     */
    poDate: text("poDate").notNull(),
    productId: integer("productId")
      .notNull()
      .references(() => products.id),
    factoryId: integer("factoryId")
      .notNull()
      .references(() => factories.id),
    quantity: integer("quantity").notNull().default(0),
    /** real, bukan integer: PO memakai USD/RMB yang butuh 2 angka desimal. */
    pricePerPcs: real("pricePerPcs").notNull().default(0),
    /** Hasil pricePerPcs x quantity; selalu dihitung ulang di server. */
    value: real("value").notNull().default(0),
    currency: text("currency").notNull().default("Rp"),
    /**
     * Status PPN baris PO: "PPN" atau "Non PPN".
     *
     * Hanya penanda — TIDAK ikut dihitung ke `value` (keputusan user). Role
     * Pabrik tidak boleh melihatnya, jadi field ini dihapus dari respons API
     * bersama pricePerPcs/value/currency.
     */
    ppn: text("ppn").notNull().default("Non PPN"),
    /**
     * Nilai tetap: "Product Order" | "Sparepart Order" | "Replacement".
     *
     * Dulu foreign key ke tabel master `keterangan`, tetapi user memutuskan
     * ketiga nilai itu cukup di-hardcode di kode sehingga CRUD tidak diperlukan.
     * Disimpan sebagai teks supaya baris PO tidak perlu di-join.
     */
    keterangan: text("keterangan").notNull().default("Product Order"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("purchase_orders_factory_idx").on(t.factoryId),
    index("purchase_orders_po_idx").on(t.poNumber),
    index("purchase_orders_keterangan_idx").on(t.keterangan),
    index("purchase_orders_date_idx").on(t.poDate),
  ]
)