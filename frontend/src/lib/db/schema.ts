import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
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
  /** Role grup penentu menu yang boleh diakses; NULL = belum diatur. */
  roleId: integer("roleId").references(() => roles.id, {
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

/**
 * Kaitan produk → pabrik, dikelola di User Management › daftar pabrik.
 *
 * Satu produk hanya boleh terikat ke SATU pabrik (`productId` sebagai primary
 * key), karena kaitannya dipakai terbalik di form: begitu produk dipilih, kolom
 * Pabrik terisi otomatis — kalau satu produk bisa punya banyak pabrik, isian itu
 * jadi ambigu. Memilih produk di pabrik lain berarti memindahkannya.
 */
export const productFactories = sqliteTable(
  "product_factories",
  {
    productId: integer("productId")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    factoryId: integer("factoryId")
      .notNull()
      .references(() => factories.id, { onDelete: "cascade" }),
  },
  (t) => [index("product_factories_factory_idx").on(t.factoryId)]
);

/**
 * Master sparepart — child dari produk.
 *
 * Bentuknya sengaja seperti `products` (nama wajib, SKU opsional tapi unik)
 * karena sparepart dijual seperti produk dan punya harga sendiri per periode.
 * SKU sparepart unik di antara sparepart saja; boleh sama dengan SKU produk,
 * karena keduanya daftar yang berbeda.
 */
export const spareParts = sqliteTable("spare_parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /** SKU opsional tapi unik kalau diisi (sama seperti SKU produk). */
  sku: text("sku").unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Kaitan produk → sparepart (banyak-ke-banyak).
 *
 * BERBEDA dari `product_factories` yang `productId`-nya jadi primary key: di
 * sini primary key-nya GABUNGAN, jadi satu sparepart boleh dipakai beberapa
 * produk sekaligus dan mengaitkannya ke produk kedua tidak memindahkannya dari
 * produk pertama.
 */
export const productSpareParts = sqliteTable(
  "product_spare_parts",
  {
    productId: integer("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sparePartId: integer("sparePartId")
      .notNull()
      .references(() => spareParts.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.sparePartId] }),
    index("product_spare_parts_spare_idx").on(t.sparePartId),
  ]
);

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
 * Limit allowance defect per tahun — satu baris per tahun, dipakai kartu
 * "Allowance Defect" di halaman Report (admin saja).
 *
 * Namanya `limitValue` karena `limit` kata kunci SQL. Angkanya Rupiah; limit
 * diprorata mengikuti periode filter (lihat `src/lib/allowance.ts`), jadi yang
 * disimpan di sini selalu limit SETAHUN penuh.
 */
export const defectAllowances = sqliteTable(
  "defect_allowances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Tahun allowance, "YYYY" (teks, sama seperti kolom `year` tabel harga). */
    year: text("year").notNull(),
    limitValue: real("limitValue").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [unique("defect_allowances_year_unique").on(t.year)]
);

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
    /**
     * Jenis harga master yang dipakai form saat mengisi `value` (Website,
     * Reseller, Key Account, Buyback, Collection Point, Experience Store,
     * Regional Warehouse). Nilai tetap di `PRICE_TYPES`
     * (`src/lib/api/validation.ts`); disimpan sebagai teks supaya tidak perlu
     * join. Baris lama memakai "Regional Warehouse" — satu-satunya jenis yang
     * ada sebelum fitur ini.
     */
    priceType: text("priceType").notNull().default("Regional Warehouse"),
    /**
     * WARISAN — tidak dipakai lagi oleh jalur defect.
     *
     * Dulu baris defect merujuk ke `product_prices` supaya `value = quantity × harga`;
     * sekarang `value` disimpan apa adanya dari isian operator / kolom Value impor
     * Excel, `productPriceId` selalu NULL untuk baris baru, dan ikut dikosongkan saat
     * baris lama disunting. Kolomnya sengaja tidak dihapus supaya baris lama yang
     * masih menyimpan rujukan tidak kehilangan datanya. Pola `quantity × harga`
     * sekarang hanya dipakai modul PO Product.
     */
    productPriceId: integer("productPriceId").references(() => productPrices.id),
    /**
     * Pembukuan sync Google Sheet (tab "Big Data").
     *
     * `sheetFields` menyimpan hash nilai tiap field yang terakhir kali disepakati
     * kedua sisi (JSON {field: hash}). Dari situ sync bisa membedakan "berubah di
     * app" dan "berubah di sheet", sehingga popup konflik hanya muncul kalau
     * memang dua-duanya berubah. `sheetSyncedAt` menandai sync terakhir yang
     * menyentuh baris ini.
     */
    sheetFields: text("sheetFields"),
    sheetSyncedAt: integer("sheetSyncedAt", { mode: "timestamp" }),
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
    /**
     * Pembukuan sync Google Sheet (tab "Data Penjualan") — pola sama dengan
     * `defects.sheetFields`: hash nilai sheet terakhir yang disepakati per field
     * ({"quantity": hash, "value": hash}). Dipakai untuk membedakan "berubah di
     * app" dan "berubah di sheet", jadi konflik cuma muncul kalau dua-duanya
     * berubah. Tab itu read-only (semua selnya rumus INDEX), jadi tidak ada
     * penulisan balik ke sheet.
     */
    sheetFields: text("sheetFields"),
    sheetSyncedAt: integer("sheetSyncedAt", { mode: "timestamp" }),
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
 * Riwayat harga produk per bulan dan tahun — selalu dalam Rupiah.
 *
 * Satu produk boleh punya banyak baris (satu per bulan/tahun), sehingga harga
 * lama tidak pernah ditimpa: kalau harga berubah, buat baris baru untuk periode
 * berikutnya. Baris PO merujuk ke salah satu baris di sini lewat `productPriceId`,
 * jadi nilai PO lama tetap memakai harga yang dulu dipilih.
 */
export const productPrices = sqliteTable(
  "product_prices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("productId")
      .notNull()
      .references(() => products.id),
    /** Rupiah; boleh pecahan seperti harga PO. */
    price: real("price").notNull().default(0),
    /**
     * Jenis harga: satu produk boleh punya harga berbeda per jenis (Website,
     * Reseller, … Regional Warehouse) untuk periode yang sama. Nilai tetap di
     * `PRICE_TYPES`; "Regional Warehouse" = jenis yang dipakai sistem sebelum
     * fitur jenis harga, jadi baris lama memakai nilai itu.
     */
    priceType: text("priceType").notNull().default("Regional Warehouse"),
    /** "01".."12" (dua digit, supaya bisa diurutkan sebagai teks). */
    month: text("month").notNull(),
    year: text("year").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Satu harga per produk per jenis per bulan/tahun — inilah yang menjaga
    // harga lama tetap unik dan tidak bisa tertimpa diam-diam.
    unique("product_prices_unique").on(
      t.productId,
      t.priceType,
      t.year,
      t.month
    ),
    index("product_prices_product_idx").on(t.productId),
    index("product_prices_period_idx").on(t.year, t.month),
    index("product_prices_type_idx").on(t.priceType, t.year, t.month),
  ]
);

/**
 * Riwayat harga SPAREPART per bulan dan tahun — mekanismenya sama persis dengan
 * `product_prices`: satu sparepart boleh punya banyak baris (satu per periode),
 * harga lama tidak pernah ditimpa, dan periode yang sama tidak boleh dobel.
 *
 * Harga sparepart bersifat GLOBAL per sparepart, bukan per (sparepart × produk):
 * satu sparepart yang dipakai dua produk memakai harga yang sama.
 */
export const sparePartPrices = sqliteTable(
  "spare_part_prices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sparePartId: integer("sparePartId")
      .notNull()
      .references(() => spareParts.id),
    /** Rupiah; boleh pecahan seperti harga produk. */
    price: real("price").notNull().default(0),
    /** "01".."12" (dua digit, supaya bisa diurutkan sebagai teks). */
    month: text("month").notNull(),
    year: text("year").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique("spare_part_prices_unique").on(t.sparePartId, t.year, t.month),
    index("spare_part_prices_spare_idx").on(t.sparePartId),
    index("spare_part_prices_period_idx").on(t.year, t.month),
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
     * Harga master (Rupiah) yang dipakai baris PO ini.
     *
     * Rujukan ke baris `product_prices`, bukan salinan angkanya — sehingga
     * "Value RW = quantity × harga" selalu konsisten dengan harga yang dipilih,
     * dan PO lama tidak ikut berubah saat harga baru ditambahkan untuk periode
     * berikutnya (baris harganya tidak diubah, hanya ditambah baris baru).
     *
     * NULL berarti produk ini belum punya harga untuk bulan/tahun PO tersebut;
     * baris PO tetap boleh disimpan dan Value RW-nya dikosongkan.
     */
    productPriceId: integer("productPriceId").references(() => productPrices.id),
    /**
     * Jenis harga master yang dipilih operator di form PO (lihat `PRICE_TYPES`).
     * Disimpan agar pilihan jenis tetap terbaca saat baris disunting.
     */
    priceType: text("priceType").notNull().default("Regional Warehouse"),
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
);

/**
 * Kurs mata uang asing PO ke Rupiah — satu baris per mata uang ("USD", "RMB").
 *
 * Dipakai kartu "Total Value PO" di halaman PO Product untuk mengubah
 * `purchase_orders.value` (yang mengikuti `currency` barisnya) menjadi Rupiah.
 * Disimpan di server, bukan di browser, supaya angkanya sama untuk semua admin
 * dan bisa diubah lewat menu edit kurs di kartu tersebut.
 */
export const currencyRates = sqliteTable("currency_rates", {
  /** "USD" | "RMB" — hanya dua itu yang punya kurs; Rupiah selalu 1. */
  currency: text("currency").primaryKey(),
  /** Berapa Rupiah untuk 1 unit mata uang ini. */
  rate: real("rate").notNull().default(0),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Repair Data — satu baris = satu klaim reparasi, inputannya mengikuti tab
 * "Data Reparasi" pada spreadsheet "Reparasi RFB".
 *
 * Modul ini ADMIN SAJA (semua endpoint `requireAdmin()`) karena memuat angka
 * Rupiah pada `value`.
 *
 * Dua hal yang sengaja tidak mengikuti sheet:
 * - Kolom "Bulan" di sheet isinya campur (serial tanggal dan teks bebas),
 *   jadi `month` di sini DITURUNKAN dari `date` (format `YYYY-MM-DD`).
 * - `value` (Saving Value) = `quantity` × harga master jenis
 *   "Regional Warehouse" produk itu; form mengisinya otomatis, operator boleh
 *   mengubahnya. `productPriceId` menyimpan baris harga yang dipakai supaya
 *   asal angkanya bisa ditelusuri.
 */
export const repairs = sqliteTable(
  "repairs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /**
     * CLAIM ID dari sheet. TIDAK unik: satu Claim ID boleh dipakai beberapa
     * baris selama tanggal/produknya beda. Kunci pencocokan sync/impor =
     * `repairMatchKey()` di `src/lib/repair-match.ts`.
     */
    claimId: text("claimId").notNull(),
    /** "YYYY-MM-DD" (sheet menyimpannya sebagai serial tanggal). */
    date: text("date").notNull(),
    /** "YYYY-MM", diturunkan dari `date` — dipakai filter bulan/tahun. */
    month: text("month").notNull().default(""),
    /**
     * Produk dari master. NULL = nama produk di sheet belum ada di Data Master.
     * Barisnya TETAP diimpor dan ditandai lewat `incompleteFields`, bukan dibuang
     * (keputusan user 12 Okt 2026).
     */
    productId: integer("productId").references(() => products.id),
    quantity: integer("quantity").notNull().default(0),
    /** Saving Value (Rupiah), angka bulat seperti `defects.value`. */
    value: integer("value").notNull().default(0),
    priceType: text("priceType").notNull().default("Regional Warehouse"),
    /** Baris harga master yang dipakai; NULL kalau produk belum punya harga RW. */
    productPriceId: integer("productPriceId").references(() => productPrices.id),
    /** Asal unit: "Distri" | "OR" | "Customer" (lihat REPAIR_ORIGINS). */
    origin: text("origin").notNull().default(""),
    /** Nama & nomor telepon customer (kolom "Nama" dan "No Telp" sheet). */
    customerName: text("customerName").notNull().default(""),
    customerPhone: text("customerPhone").notNull().default(""),
    resi: text("resi").notNull().default(""),
    /** "Kendala dari cust" — teks bebas (di sheet asalnya hasil XLOOKUP). */
    customerIssue: text("customerIssue").notNull().default(""),
    photoPackageLink: text("photoPackageLink").notNull().default(""),
    photoCompletenessLink: text("photoCompletenessLink").notNull().default(""),
    /** "Done Repair" | "Proses" | … (lihat REPAIR_STATUSES). */
    status: text("status").notNull().default(""),
    /** "YYYY-MM-DD HH:mm" seperti `defects.timeStamp`; boleh kosong. */
    startAt: text("startAt").notNull().default(""),
    finishAt: text("finishAt").notNull().default(""),
    /** Kolom P sheet. */
    note: text("note").notNull().default(""),
    /** PIC pengerjaan (lihat REPAIR_PICS). */
    pic: text("pic").notNull().default(""),
    /** "Penyelesaian" (lihat REPAIR_RESOLUTIONS). */
    resolution: text("resolution").notNull().default(""),
    /** Kolom "Teknis Device" — master Problem yang sama dengan modul Defect. */
    problemId: integer("problemId").references(() => problems.id),
    sparePart1Id: integer("sparePart1Id").references(() => spareParts.id),
    sparePart2Id: integer("sparePart2Id").references(() => spareParts.id),
    sparePart3Id: integer("sparePart3Id").references(() => spareParts.id),
    /**
     * Nama sparepart apa adanya dari sheet (kolom T/U/V). Diisi juga saat
     * sparepart-nya ketemu di Data Master, tapi yang penting: nama yang TIDAK ada
     * di master tetap disimpan utuh di sini, tidak dikosongkan.
     */
    sparePart1Text: text("sparePart1Text").notNull().default(""),
    sparePart2Text: text("sparePart2Text").notNull().default(""),
    sparePart3Text: text("sparePart3Text").notNull().default(""),
    /** Kolom W sheet — header di sheet juga "Note", jadi diberi nama sendiri. */
    noteClosing: text("noteClosing").notNull().default(""),
    /**
     * Daftar kolom yang kosong/tidak dikenal saat baris ini diimpor dari sheet,
     * dipisah koma (mis. "claimId,product"). Kosong = baris lengkap. Baris tidak
     * lengkap tetap masuk sistem dan cuma ditandai (keputusan user 12 Okt 2026).
     */
    incompleteFields: text("incompleteFields").notNull().default(""),
    /**
     * Pembukuan sync Google Sheet — pola sama dengan `defects`: hash nilai tiap
     * field saat sync terakhir, sehingga sync tahu baris mana yang sudah diubah
     * di aplikasi dan tidak boleh ditimpa diam-diam.
     */
    sheetFields: text("sheetFields"),
    sheetSyncedAt: integer("sheetSyncedAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("repairs_product_idx").on(t.productId),
    index("repairs_status_idx").on(t.status),
    index("repairs_date_idx").on(t.date),
  ]
);

/**
 * Claim Garansi BARDI — cermin tab "Raw Combine CG" (sheet "Data Garansi
 * Produk"). Seluruh isinya datang dari sheet (satu arah, sheet = sumber);
 * yang dihitung di app cuma `value` = jumlah unit × harga Regional Warehouse
 * bulan klaim dari Price List app (keputusan user 17 Okt 2026: JANGAN pakai
 * harga dari tab "Data Produk" sheet).
 *
 * Produk dicocokkan lewat kolom AC "Official Name" — bukan kolom N (pilihan
 * customer), karena kolom N ditulis bebas oleh customer.
 */
export const warrantyClaims = sqliteTable(
  "warranty_claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** CLAIM ID (kolom A). Tidak unik: kunci baris = claim + tanggal + produk. */
    claimId: text("claimId").notNull(),
    /** "YYYY-MM-DD", diturunkan dari kolom B. */
    date: text("date").notNull().default(""),
    /** "YYYY-MM", untuk filter bulan/tahun. */
    month: text("month").notNull().default(""),
    /** "YYYY-MM-DDTHH:mm" seperti `defects.timeStamp`. */
    timeStamp: text("timeStamp").notNull().default(""),
    customerName: text("customerName").notNull().default(""),
    customerPhone: text("customerPhone").notNull().default(""),
    customerEmail: text("customerEmail").notNull().default(""),
    /** Kota asal pengiriman (kolom P). */
    city: text("city").notNull().default(""),
    /** Collection Point (kolom O). */
    collectionPoint: text("collectionPoint").notNull().default(""),
    /** Kurir (kolom G). */
    courier: text("courier").notNull().default(""),
    /** Resi pengiriman unit ke BARDI (kolom H). */
    resiUnit: text("resiUnit").notNull().default(""),
    /** Resi pengiriman balik ke customer (kolom V). */
    resi: text("resi").notNull().default(""),
    /** Produk yang dipilih customer di formulir garansi (kolom N). */
    productForm: text("productForm").notNull().default(""),
    /** Kolom AC "Official Name" — acuan pencocokan produk. */
    officialName: text("officialName").notNull().default(""),
    /** NULL = Official Name-nya belum ada di Data Master (baris tetap masuk). */
    productId: integer("productId").references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
    /** Status Kondisi Barang (kolom X). */
    status: text("status").notNull().default(""),
    /** SLA (kolom Z). */
    sla: text("sla").notNull().default(""),
    /** PIC (kolom AA). */
    pic: text("pic").notNull().default(""),
    /** Notes (kolom AB). */
    note: text("note").notNull().default(""),
    /** Rupiah bulat = jumlah unit × harga RW bulan klaim. */
    value: integer("value").notNull().default(0),
    priceType: text("priceType").notNull().default("Regional Warehouse"),
    productPriceId: integer("productPriceId").references(() => productPrices.id),
    /** Kolom kosong/tak dikenal saat sync, dipisah koma (mis. "product"). */
    incompleteFields: text("incompleteFields").notNull().default(""),
    sheetSyncedAt: integer("sheetSyncedAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("warranty_claims_claim_idx").on(t.claimId),
    index("warranty_claims_date_idx").on(t.date),
    index("warranty_claims_product_idx").on(t.productId),
    index("warranty_claims_status_idx").on(t.status),
  ]
);

/* ============================================================
 * Role grup & hak akses menu
 * ============================================================ */

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Nama tampilan role, mis. "Pabrik". */
  name: text("name").notNull().unique(),
  /** Kode tetap untuk aturan yang di-hardcode di server ("pabrik"). */
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  /**
   * Role bawaan sistem: nama & kode terkunci dan tidak bisa dihapus.
   * Saat ini hanya "pabrik" — aturan penyembunyian nilai Rupiah menempel
   * pada kode tersebut, bukan pada permission di tabel.
   */
  isSystem: integer("isSystem", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Satu baris per (role, menu). Menu tanpa baris = tidak punya akses.
 * Write selalu menyertakan Read (dinormalkan di `src/lib/api/validation.ts`).
 */
export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roleId: integer("roleId")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    /** Kunci menu — lihat MENU_KEYS di `src/lib/permissions.ts`. */
    menu: text("menu").notNull(),
    canRead: integer("canRead", { mode: "boolean" }).notNull().default(false),
    canWrite: integer("canWrite", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [unique("role_permissions_role_menu").on(t.roleId, t.menu)]
);