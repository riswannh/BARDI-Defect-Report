import { eq, getTableName } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  factories,
  problems,
  products,
  sparePartPrices,
  spareParts,
  statuses,
} from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { backupDatabase } from "@/lib/api/bulk";
import {
  masterNameSchema,
  normalizeSku,
  productSchema,
} from "@/lib/api/validation";

export type MasterTable =
  | typeof factories
  | typeof products
  | typeof spareParts
  | typeof problems
  | typeof statuses;

/**
 * Master yang punya kolom SKU: produk dan sparepart. Keduanya memakai schema
 * input yang sama, hanya berbeda ruang keunikan SKU-nya.
 */
function hasSku(table: MasterTable): boolean {
  return table === products || table === spareParts;
}

/** Master tanpa SKU hanya menerima nama. */
function masterInputSchema(table: MasterTable) {
  return hasSku(table) ? productSchema : masterNameSchema;
}

/** Label master untuk pesan error yang dibaca pengguna. */
function skuOwner(table: MasterTable): string {
  return table === spareParts ? "sparepart" : "produk";
}

export async function listMasterRows(table: MasterTable) {
  return db.select().from(table).orderBy(table.id);
}

export async function masterNameExists(
  table: MasterTable,
  name: string,
  exceptId?: number
) {
  const rows = await db.select().from(table).where(eq(table.name, name));
  return rows.some((row) => row.id !== exceptId);
}

/**
 * SKU unik di dalam daftarnya sendiri: SKU produk tidak boleh bentrok dengan
 * produk lain, SKU sparepart tidak boleh bentrok dengan sparepart lain. Kedua
 * daftar punya ruang SKU terpisah, jadi SKU yang sama boleh ada di keduanya.
 * Null (tidak diisi) tidak pernah dianggap bentrok.
 */
export async function skuExists(
  table: MasterTable,
  sku: string,
  exceptId?: number
) {
  if (table === products) {
    const rows = await db.select().from(products).where(eq(products.sku, sku));
    return rows.some((row) => row.id !== exceptId);
  }
  if (table === spareParts) {
    const rows = await db
      .select()
      .from(spareParts)
      .where(eq(spareParts.sku, sku));
    return rows.some((row) => row.id !== exceptId);
  }
  return false;
}

/**
 * Sparepart yang harganya masih ada tidak boleh dihapus — harga tidak memakai
 * cascade supaya tidak ada riwayat harga yang hilang tanpa disadari.
 */
async function sparePartHasPrices(sparePartId?: number) {
  const rows = await db
    .select({ id: sparePartPrices.id })
    .from(sparePartPrices)
    .where(
      sparePartId === undefined
        ? undefined
        : eq(sparePartPrices.sparePartId, sparePartId)
    );
  return rows.length > 0;
}

/**
 * Insert baris master baru.
 *
 * Ditulis bercabang (bukan satu objek nilai gabungan) supaya TypeScript bisa
 * menyempitkan tipe per tabel: hanya `products` yang punya kolom `sku`.
 */
async function insertMaster(
  table: MasterTable,
  name: string,
  sku: unknown
) {
  if (table === products) {
    return db
      .insert(products)
      .values({ name, sku: normalizeSku(sku) })
      .returning();
  }
  if (table === spareParts) {
    return db
      .insert(spareParts)
      .values({ name, sku: normalizeSku(sku) })
      .returning();
  }
  return db.insert(table).values({ name }).returning();
}

/** Ubah baris master; sama seperti insert, produk ikut menyimpan SKU. */
async function updateMaster(
  table: MasterTable,
  id: number,
  name: string,
  sku: unknown
) {
  if (table === products) {
    return db
      .update(products)
      .set({ name, sku: normalizeSku(sku) })
      .where(eq(products.id, id))
      .returning();
  }
  if (table === spareParts) {
    return db
      .update(spareParts)
      .set({ name, sku: normalizeSku(sku) })
      .where(eq(spareParts.id, id))
      .returning();
  }
  return db
    .update(table)
    .set({ name })
    .where(eq(table.id, id))
    .returning();
}

/** Pesan error yang bisa ditampilkan langsung ke pengguna. */
async function masterConflict(
  table: MasterTable,
  name: string,
  sku: unknown,
  exceptId?: number
): Promise<string | null> {
  if (await masterNameExists(table, name, exceptId)) return "Nama sudah ada.";
  if (hasSku(table)) {
    const normalized = normalizeSku(sku);
    if (normalized && (await skuExists(table, normalized, exceptId))) {
      return `SKU sudah dipakai ${skuOwner(table)} lain.`;
    }
  }
  return null;
}

function isFactoriesTable(table: MasterTable): boolean {
  return table === factories;
}

export function masterCollectionHandlers(table: MasterTable) {
  return {
    GET: async () => {
      const guard = await requireUser();
      if (!guard.ok) return guard.response;

      // Daftar pabrik hanya relevan untuk admin (pemilih pabrik di Report) dan
      // dikelola di User Management yang memang admin-only. Role Pabrik cuma
      // butuh namanya sendiri untuk header, jadi jangan bocorkan daftar seluruh
      // pabrik ke mereka.
      if (isFactoriesTable(table) && !guard.user.isAdmin) {
        const rows = guard.user.factoryId
          ? await db
              .select()
              .from(factories)
              .where(eq(factories.id, guard.user.factoryId))
          : [];
        return jsonOk(rows);
      }

      const rows = await listMasterRows(table);
      return jsonOk(rows);
    },

    POST: async (req: NextRequest) => {
      const guard = await requireAdmin();
      if (!guard.ok) return guard.response;

      const parsed = masterInputSchema(table).safeParse(await req.json());
      if (!parsed.success) return jsonError("Nama wajib diisi.", 422);

      const name = parsed.data.name.trim();
      const sku = "sku" in parsed.data ? parsed.data.sku : undefined;
      const conflict = await masterConflict(table, name, sku);
      if (conflict) return jsonError(conflict, 409);

      const [row] = await insertMaster(table, name, sku);
      return jsonOk(row, 201);
    },

    DELETE: async () => {
      const guard = await requireAdmin();
      if (!guard.ok) return guard.response;

      if (table === spareParts && (await sparePartHasPrices())) {
        return jsonError(
          "Masih ada harga sparepart. Hapus dulu di tab Harga Sparepart.",
          409
        );
      }

      const moduleName = getTableName(table);
      const backup = backupDatabase(moduleName);
      try {
        const rows = await db
          .delete(table)
          .returning({ id: table.id });
        return jsonOk({ deleted: rows.length, backup });
      } catch {
        return jsonError(
          "Tidak bisa menghapus semua data karena masih dipakai di data lain (mis. Defect/Sales). Hapus data terkait terlebih dahulu.",
          409
        );
      }
    },
  };
}

export function masterItemHandlers(table: MasterTable) {
  return {
    PATCH: async (
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> }
    ) => {
      const guard = await requireAdmin();
      if (!guard.ok) return guard.response;

      const { id } = await ctx.params;
      const rowId = Number(id);
      if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

      const parsed = masterInputSchema(table).safeParse(await req.json());
      if (!parsed.success) return jsonError("Nama wajib diisi.", 422);

      const name = parsed.data.name.trim();
      const sku = "sku" in parsed.data ? parsed.data.sku : undefined;
      const conflict = await masterConflict(table, name, sku, rowId);
      if (conflict) return jsonError(conflict, 409);

      const [row] = await updateMaster(table, rowId, name, sku);
      if (!row) return jsonError("Data tidak ditemukan.", 404);
      return jsonOk(row);
    },

    DELETE: async (
      _req: NextRequest,
      ctx: { params: Promise<{ id: string }> }
    ) => {
      const guard = await requireAdmin();
      if (!guard.ok) return guard.response;

      const { id } = await ctx.params;
      const rowId = Number(id);
      if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

      if (table === spareParts && (await sparePartHasPrices(rowId))) {
        return jsonError(
          "Sparepart ini masih punya harga. Hapus harganya dulu di tab Harga Sparepart.",
          409
        );
      }

      try {
        const [row] = await db
          .delete(table)
          .where(eq(table.id, rowId))
          .returning();
        if (!row) return jsonError("Data tidak ditemukan.", 404);
        return jsonOk({ deleted: rowId });
      } catch {
        return jsonError(
          "Data tidak bisa dihapus karena masih dipakai di data lain.",
          409
        );
      }
    },
  };
}
