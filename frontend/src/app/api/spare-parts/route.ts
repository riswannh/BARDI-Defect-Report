import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { productSpareParts, products, spareParts } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import { masterCollectionHandlers } from "@/lib/api/master";

const handlers = masterCollectionHandlers(spareParts);

/**
 * Master sparepart + daftar produk yang memakainya.
 *
 * `productNames` dipakai dialog kaitan produk untuk menandai sparepart yang
 * sudah dipakai produk lain — penting karena satu sparepart boleh dipakai
 * beberapa produk (beda dengan kaitan produk → pabrik yang satu-ke-satu).
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: spareParts.id,
      name: spareParts.name,
      sku: spareParts.sku,
    })
    .from(spareParts)
    .orderBy(asc(spareParts.name));

  const links = await db
    .select({
      sparePartId: productSpareParts.sparePartId,
      productName: products.name,
    })
    .from(productSpareParts)
    .innerJoin(products, eq(productSpareParts.productId, products.id));

  const owners = new Map<number, string[]>();
  for (const link of links) {
    const list = owners.get(link.sparePartId) ?? [];
    list.push(link.productName);
    owners.set(link.sparePartId, list);
  }

  return jsonOk(
    rows.map((row) => ({
      ...row,
      productNames: owners.get(row.id) ?? [],
    }))
  );
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
