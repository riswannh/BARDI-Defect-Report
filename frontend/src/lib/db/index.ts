import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

function createClient(): Database.Database {
  const client = new Database(process.env.DB_FILE_NAME ?? "sqlite.db");
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  return client;
}

const sqlite = globalForDb.sqlite ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export const sqliteClient = sqlite;
export { schema };
