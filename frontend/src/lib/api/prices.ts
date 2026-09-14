import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productPrices, products, purchaseOrders } from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { backupDatabase } from "@/lib/api/bulk";
import {
  normalizePriceMonth,
  normalizePriceYear,
  productPriceSchema,
  productPriceUpdateSchema,
} from "@/lib/api/validation";

/**
 * Harga produk per bulan dan tahun (Rupiah).
 *
 * Harga TIDAK diubah di tempat saat berganti periode: untuk bulan baru dibuat
 * baris baru. Karena baris PO merujuk ke baris harga lewat `productPriceId`,
 * nilai PO lama otomatis tetap memakai harga yang dulu dipilih.
 */
const priceSelect = {
  id: productPrices.id,
  productId: productPrices.productId,
  price: productPrices.price,
  month: productPrices.month,
  year: productPrices.year,
  sku: products.sku,
  productName: products.name,
  createdAt: productPrices.createdAt,
  updatedAt: productPrices.updatedAt,
};

/** Urut periode terbaru dulu supaya harga terkini muncul di atas. */
function listQuery() {
  return db
    .select(priceSelect)
    .from(productPrices)
    .leftJoin(products, eq(productPrices.productId, products.id))
    .orderBy(
      desc(productPrices.year),
      desc(productPrices.month),
      asc(products.name)
    );
}

export async function pricesGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const productId = Number(params.get("productId"));
  const year = normalizePriceYear(params.get("year"));
  const month = normalizePriceMonth(params.get("month"));

  const conditions = [];
  if (Number.isInteger(productId) && productId > 0) {
    conditions.push(eq(productPrices.productId, productId));
  }
  if (year) conditions.push(eq(productPrices.year, year));
  if (month) conditions.push(eq(productPrices.month, month));

  const rows = await listQuery().where(
    conditions.length ? and(...conditions) : undefined
  );
  return jsonOk(rows);
}

export async function pricesPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = productPriceSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data harga tidak valid.", 422);

  const month = normalizePriceMonth(parsed.data.month);
  const year = normalizePriceYear(parsed.data.year);
  if (!month) return jsonError("Bulan harus 01-12 atau nama bulan.", 422);
  if (!year) return jsonError("Tahun harus empat angka, mis. 2026.", 422);

  const product = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, parsed.data.productId));
  if (product.length === 0) return jsonError("Produk tidak ditemukan.", 422);

  const existing = await db
    .select({ id: productPrices.id })
    .from(productPrices)
    .where(
      and(
        eq(productPrices.productId, parsed.data.productId),
        eq(productPrices.year, year),
        eq(productPrices.month, month)
      )
    );
  if (existing.length > 0) {
    return jsonError(
      `Harga produk ini untuk ${month}/${year} sudah ada. Ubah baris itu, atau pakai periode lain.`,
      409
    );
  }

  const [row] = await db
    .insert(productPrices)
    .values({
      productId: parsed.data.productId,
      price: parsed.data.price,
      month,
      year,
    })
    .returning();
  return jsonOk(row, 201);
}

export async function pricePATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = productPriceUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data harga tidak valid.", 422);

  const current = await db
    .select()
    .from(productPrices)
    .where(eq(productPrices.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  const productId = parsed.data.productId ?? current[0].productId;
  const month = parsed.data.month
    ? normalizePriceMonth(parsed.data.month)
    : current[0].month;
  const year = parsed.data.year
    ? normalizePriceYear(parsed.data.year)
    : current[0].year;
  if (!month || !year) return jsonError("Bulan atau tahun tidak valid.", 422);

  // Jangan sampai dua baris menempati periode yang sama untuk produk yang sama.
  const clash = await db
    .select({ id: productPrices.id })
    .from(productPrices)
    .where(
      and(
        eq(productPrices.productId, productId),
        eq(productPrices.year, year),
        eq(productPrices.month, month)
      )
    );
  if (clash.some((row) => row.id !== rowId)) {
    return jsonError(
      `Harga produk ini untuk ${month}/${year} sudah ada di baris lain.`,
      409
    );
  }

  const [row] = await db
    .update(productPrices)
    .set({
      productId,
      month,
      year,
      ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
      updatedAt: new Date(),
    })
    .where(eq(productPrices.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk(row);
}

export async function priceDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  // Hapus harga yang masih dirujuk baris PO akan membuat nilai PO kehilangan
  // dasarnya, jadi ditolak — sama seperti aturan master lain yang masih dipakai.
  const used = await db
    .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.productPriceId, rowId));
  if (used.length > 0) {
    return jsonError(
      `Harga ini masih dipakai ${used.length} baris PO (mis. ${used[0].poNumber}).`,
      409
    );
  }

  const [row] = await db
    .delete(productPrices)
    .where(eq(productPrices.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function pricesDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const used = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(isNotNull(purchaseOrders.productPriceId));
  if (used.length > 0) {
    return jsonError(
      `Masih ada ${used.length} baris PO yang memakai harga produk. Hapus PO-nya dulu, atau hapus harga satu per satu.`,
      409
    );
  }

  const backup = backupDatabase("product-prices");
  const rows = await db.delete(productPrices).returning({ id: productPrices.id });
  return jsonOk({ deleted: rows.length, backup });
}

/**
 * Salin harga dari periode sebelumnya ke periode tujuan.
 *
 * SARAN EFISIENSI: harga biasanya hanya berubah untuk sebagian produk, dan
 * mengetik ulang ratusan produk tiap bulan tidak masuk akal. Dengan endpoint ini
 * pergantian bulan jadi satu klik, lalu baris yang harganya benar-benar berubah
 * tinggal disunting.
 *
 * Untuk tiap produk dipakai harga dari periode terakhir yang punya harga
 * SEBELUM periode tujuan — bukan hanya bulan tepat sebelumnya — supaya produk
 * yang jarang diisi tetap ikut tersalin. Baris yang sudah ada di periode tujuan
 * dilewati, jadi aman dijalankan berulang.
 */
export async function pricesCARRYFORWARD(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    month?: unknown;
    year?: unknown;
  };
  const month = normalizePriceMonth(body.month);
  const year = normalizePriceYear(body.year);
  if (!month || !year) {
    return jsonError("Bulan atau tahun tujuan tidak valid.", 422);
  }

  const allRows = await db
    .select({
      productId: productPrices.productId,
      price: productPrices.price,
      month: productPrices.month,
      year: productPrices.year,
    })
    .from(productPrices);

  /** Periode ini lebih awal dari periode tujuan? */
  const isBeforeTarget = (row: { year: string; month: string }) =>
    row.year < year || (row.year === year && row.month < month);

  // Sumber untuk tiap produk = periode terbesar yang masih sebelum tujuan.
  const best = new Map<number, { price: number; year: string; month: string }>();
  for (const row of allRows) {
    if (!isBeforeTarget(row)) continue;
    const current = best.get(row.productId);
    if (
      !current ||
      row.year > current.year ||
      (row.year === current.year && row.month > current.month)
    ) {
      best.set(row.productId, {
        price: row.price,
        year: row.year,
        month: row.month,
      });
    }
  }

  if (best.size === 0) {
    return jsonOk({
      inserted: 0,
      skipped: 0,
      message: "Belum ada harga sebelum periode itu untuk disalin.",
    });
  }

  const filled = await db
    .select({ productId: productPrices.productId })
    .from(productPrices)
    .where(and(eq(productPrices.year, year), eq(productPrices.month, month)));
  const sudahAda = new Set(filled.map((row) => row.productId));

  const toInsert = Array.from(best.entries())
    .filter(([productId]) => !sudahAda.has(productId))
    .map(([productId, src]) => ({ productId, price: src.price, month, year }));

  if (toInsert.length === 0) {
    return jsonOk({
      inserted: 0,
      skipped: sudahAda.size,
      message: "Semua produk sudah punya harga di periode itu.",
    });
  }

  await db.insert(productPrices).values(toInsert);
  return jsonOk({
    inserted: toInsert.length,
    skipped: sudahAda.size,
    message: `${toInsert.length} harga disalin ke ${month}/${year}.`,
  });
}
