import { db } from "../db";
import { statuses } from "../db/schema";

/**
 * Status defect sudah dihapus dari aplikasi (1 Nov 2026): tidak ada lagi pilihan
 * status di form, filter, dialog detail, Data Master, Excel, maupun Google Sheet.
 *
 * Kolom `defects.statusId` sengaja TIDAK di-drop dari database — migrasi ulang
 * tabel defect di produksi pernah menjatuhkan aplikasi, jadi kolom NOT NULL itu
 * tetap ada dan diisi nilai tetap ("Open") oleh semua jalur insert: POST defect,
 * impor Excel, dan sync Google Sheet.
 */
let cachedId: number | null = null;

export async function defaultStatusId(): Promise<number> {
  if (cachedId !== null) return cachedId;

  const [first] = await db
    .select({ id: statuses.id })
    .from(statuses)
    .orderBy(statuses.id)
    .limit(1);
  if (first) {
    cachedId = first.id;
    return cachedId;
  }

  const [created] = await db
    .insert(statuses)
    .values({ name: "Open" })
    .returning({ id: statuses.id });
  cachedId = created.id;
  return cachedId;
}
