import { sql } from "drizzle-orm";
import {
  index,
  integer,
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
