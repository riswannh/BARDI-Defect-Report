import fs from "node:fs";
import path from "node:path";
import { sqliteClient } from "@/lib/db";

/**
 * Membuat backup file database (VACUUM INTO) sebelum operasi hapus besar.
 * Mengembalikan path backup, atau null jika gagal (tidak menggagalkan operasi).
 */
export function backupDatabase(label: string): string | null {
  try {
    const dbFile = process.env.DB_FILE_NAME ?? "sqlite.db";
    const dir = path.dirname(path.resolve(dbFile));
    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    const backupPath = path.join(dir, `backup-${label}-${stamp}.db`);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    sqliteClient.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    console.log(`[backup] ${label} -> ${backupPath}`);
    return backupPath;
  } catch (err) {
    console.error("[backup] gagal membuat backup:", err);
    return null;
  }
}
