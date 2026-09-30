import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productFactories, products } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import { masterCollectionHandlers } from "@/lib/api/master";

const handlers = masterCollectionHandlers(products);

/**
 * Produk + pabrik yang dikaitkan ke produk itu (`product_factories`).
 *
 * Digabung di sini supaya form Defect/PO/Sales bisa mengisi kolom Pabrik
 * otomatis tanpa permintaan tambahan.
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      factoryId: productFactories.factoryId,
    })
    .from(products)
    .leftJoin(productFactories, eq(productFactories.productId, products.id))
    .orderBy(asc(products.id));

  return jsonOk(rows);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
