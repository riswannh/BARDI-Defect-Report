import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productFactories } from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";

async function factoryIdFrom(ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? id : null;
}

/** Produk yang dikaitkan ke pabrik ini. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const factoryId = await factoryIdFrom(ctx);
  if (factoryId === null) return jsonError("ID tidak valid.", 400);

  const rows = await db
    .select({ productId: productFactories.productId })
    .from(productFactories)
    .where(eq(productFactories.factoryId, factoryId));

  return jsonOk({ productIds: rows.map((row) => row.productId) });
}

/**
 * Ganti seluruh kaitan produk pabrik ini (POST, bukan PUT, karena klien hanya
 * punya helper POST/PATCH/DELETE).
 *
 * Satu produk hanya boleh terikat satu pabrik, jadi produk yang tadinya milik
 * pabrik lain ikut PINDAH ke sini — itulah kenapa baris lama di-upsert.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const factoryId = await factoryIdFrom(ctx);
  if (factoryId === null) return jsonError("ID tidak valid.", 400);

  const body = (await req.json().catch(() => null)) as
    | { productIds?: unknown }
    | null;
  const raw = Array.isArray(body?.productIds) ? body.productIds : null;
  if (!raw) return jsonError("productIds wajib berupa array angka.", 422);

  const productIds = raw.map(Number).filter((id) => Number.isInteger(id));

  db.transaction((tx) => {
    tx.delete(productFactories)
      .where(eq(productFactories.factoryId, factoryId))
      .run();
    for (const productId of productIds) {
      tx.insert(productFactories)
        .values({ productId, factoryId })
        .onConflictDoUpdate({
          target: productFactories.productId,
          set: { factoryId },
        })
        .run();
    }
  });

  return jsonOk({ factoryId, productIds });
}
