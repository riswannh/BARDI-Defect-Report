import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productSpareParts, products, spareParts } from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";

async function productIdFrom(ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? id : null;
}

/** Sparepart yang dikaitkan ke produk ini. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const productId = await productIdFrom(ctx);
  if (productId === null) return jsonError("ID tidak valid.", 400);

  const rows = await db
    .select({ sparePartId: productSpareParts.sparePartId })
    .from(productSpareParts)
    .where(eq(productSpareParts.productId, productId));

  return jsonOk({ sparePartIds: rows.map((row) => row.sparePartId) });
}

/**
 * Ganti seluruh kaitan sparepart produk ini (POST karena klien hanya punya
 * helper POST/PATCH/DELETE).
 *
 * BERBEDA dari kaitan produk → pabrik: primary key-nya gabungan, jadi tidak ada
 * aturan "pindah". Mengaitkan sparepart ke produk ini tidak melepasnya dari
 * produk lain yang sudah memakainya — hanya produk inilah yang diganti.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const productId = await productIdFrom(ctx);
  if (productId === null) return jsonError("ID tidak valid.", 400);

  const body = (await req.json().catch(() => null)) as
    | { sparePartIds?: unknown }
    | null;
  const raw = Array.isArray(body?.sparePartIds) ? body.sparePartIds : null;
  if (!raw) return jsonError("sparePartIds wajib berupa array angka.", 422);

  const sparePartIds = raw
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  // Dicek dulu supaya id asing tidak meledak jadi 500 FOREIGN KEY (foreign_keys
  // ON di `@/lib/db`).
  const produk = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId));
  if (produk.length === 0) return jsonError("Produk tidak ditemukan.", 422);

  if (sparePartIds.length > 0) {
    const known = await db
      .select({ id: spareParts.id })
      .from(spareParts)
      .where(inArray(spareParts.id, sparePartIds));
    const knownIds = new Set(known.map((row) => row.id));
    const asing = sparePartIds.filter((id) => !knownIds.has(id));
    if (asing.length > 0) {
      return jsonError(
        `Sparepart tidak ditemukan: ${asing.join(", ")}.`,
        422
      );
    }
  }

  db.transaction((tx) => {
    tx.delete(productSpareParts)
      .where(eq(productSpareParts.productId, productId))
      .run();
    for (const sparePartId of sparePartIds) {
      tx.insert(productSpareParts)
        .values({ productId, sparePartId })
        .onConflictDoNothing()
        .run();
    }
  });

  return jsonOk({ productId, sparePartIds });
}
