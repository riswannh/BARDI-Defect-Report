import { and, asc, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sparePartPrices, spareParts } from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { backupDatabase } from "@/lib/api/bulk";
import { carryForwardMessage, lastPriceBefore } from "@/lib/api/price-period";
import {
  normalizePriceMonth,
  normalizePriceYear,
  sparePartPriceSchema,
  sparePartPriceUpdateSchema,
} from "@/lib/api/validation";

/**
 * Harga sparepart per bulan dan tahun (Rupiah) — mekanisme sama dengan harga
 * produk (`src/lib/api/prices.ts`): harga tidak diubah di tempat saat berganti
 * periode, untuk bulan baru dibuat baris baru, dan satu sparepart tidak boleh
 * punya dua baris di periode yang sama.
 *
 * Harga ini GLOBAL per sparepart (bukan per sparepart × produk), jadi sparepart
 * yang dipakai dua produk memakai harga yang sama.
 */
const priceSelect = {
  id: sparePartPrices.id,
  sparePartId: sparePartPrices.sparePartId,
  price: sparePartPrices.price,
  month: sparePartPrices.month,
  year: sparePartPrices.year,
  sku: spareParts.sku,
  sparePartName: spareParts.name,
  createdAt: sparePartPrices.createdAt,
  updatedAt: sparePartPrices.updatedAt,
};

/** Urut periode terbaru dulu supaya harga terkini muncul di atas. */
function listQuery() {
  return db
    .select(priceSelect)
    .from(sparePartPrices)
    .leftJoin(spareParts, eq(sparePartPrices.sparePartId, spareParts.id))
    .orderBy(
      desc(sparePartPrices.year),
      desc(sparePartPrices.month),
      asc(spareParts.name)
    );
}

export async function sparePartPricesGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const sparePartId = Number(params.get("sparePartId"));
  const year = normalizePriceYear(params.get("year"));
  const month = normalizePriceMonth(params.get("month"));

  const conditions = [];
  if (Number.isInteger(sparePartId) && sparePartId > 0) {
    conditions.push(eq(sparePartPrices.sparePartId, sparePartId));
  }
  if (year) conditions.push(eq(sparePartPrices.year, year));
  if (month) conditions.push(eq(sparePartPrices.month, month));

  const rows = await listQuery().where(
    conditions.length ? and(...conditions) : undefined
  );
  return jsonOk(rows);
}

export async function sparePartPricesPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = sparePartPriceSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data harga tidak valid.", 422);

  const month = normalizePriceMonth(parsed.data.month);
  const year = normalizePriceYear(parsed.data.year);
  if (!month) return jsonError("Bulan harus 01-12 atau nama bulan.", 422);
  if (!year) return jsonError("Tahun harus empat angka, mis. 2026.", 422);

  const sparePart = await db
    .select({ id: spareParts.id })
    .from(spareParts)
    .where(eq(spareParts.id, parsed.data.sparePartId));
  if (sparePart.length === 0) {
    return jsonError("Sparepart tidak ditemukan.", 422);
  }

  const existing = await db
    .select({ id: sparePartPrices.id })
    .from(sparePartPrices)
    .where(
      and(
        eq(sparePartPrices.sparePartId, parsed.data.sparePartId),
        eq(sparePartPrices.year, year),
        eq(sparePartPrices.month, month)
      )
    );
  if (existing.length > 0) {
    return jsonError(
      `Harga sparepart ini untuk ${month}/${year} sudah ada. Ubah baris itu, atau pakai periode lain.`,
      409
    );
  }

  const [row] = await db
    .insert(sparePartPrices)
    .values({
      sparePartId: parsed.data.sparePartId,
      price: parsed.data.price,
      month,
      year,
    })
    .returning();
  return jsonOk(row, 201);
}

export async function sparePartPricePATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = sparePartPriceUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data harga tidak valid.", 422);

  const current = await db
    .select()
    .from(sparePartPrices)
    .where(eq(sparePartPrices.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  const sparePartId = parsed.data.sparePartId ?? current[0].sparePartId;
  const month = parsed.data.month
    ? normalizePriceMonth(parsed.data.month)
    : current[0].month;
  const year = parsed.data.year
    ? normalizePriceYear(parsed.data.year)
    : current[0].year;
  if (!month || !year) return jsonError("Bulan atau tahun tidak valid.", 422);

  // Jangan sampai dua baris menempati periode yang sama untuk sparepart yang sama.
  const clash = await db
    .select({ id: sparePartPrices.id })
    .from(sparePartPrices)
    .where(
      and(
        eq(sparePartPrices.sparePartId, sparePartId),
        eq(sparePartPrices.year, year),
        eq(sparePartPrices.month, month)
      )
    );
  if (clash.some((row) => row.id !== rowId)) {
    return jsonError(
      `Harga sparepart ini untuk ${month}/${year} sudah ada di baris lain.`,
      409
    );
  }

  const [row] = await db
    .update(sparePartPrices)
    .set({
      sparePartId,
      month,
      year,
      ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
      updatedAt: new Date(),
    })
    .where(eq(sparePartPrices.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk(row);
}

/**
 * Hapus satu baris harga.
 *
 * Tidak ada pemeriksaan "masih dipakai": beda dengan harga produk yang dirujuk
 * baris PO lewat `productPriceId`, baris PO belum pernah merujuk harga sparepart.
 */
export async function sparePartPriceDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const [row] = await db
    .delete(sparePartPrices)
    .where(eq(sparePartPrices.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function sparePartPricesDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const backup = backupDatabase("spare-part-prices");
  const rows = await db
    .delete(sparePartPrices)
    .returning({ id: sparePartPrices.id });
  return jsonOk({ deleted: rows.length, backup });
}

/**
 * Salin harga dari periode sebelumnya ke periode tujuan (sama seperti harga
 * produk — lihat `src/lib/api/price-period.ts` untuk aturan pemilihannya).
 */
export async function sparePartPricesCARRYFORWARD(req: NextRequest) {
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
      sparePartId: sparePartPrices.sparePartId,
      price: sparePartPrices.price,
      month: sparePartPrices.month,
      year: sparePartPrices.year,
    })
    .from(sparePartPrices);

  const best = lastPriceBefore(
    allRows.map((row) => ({
      refId: row.sparePartId,
      price: row.price,
      month: row.month,
      year: row.year,
    })),
    month,
    year
  );

  if (best.size === 0) {
    return jsonOk({
      inserted: 0,
      skipped: 0,
      message: carryForwardMessage("sparepart", 0, 0, { month, year }),
    });
  }

  const filled = await db
    .select({ sparePartId: sparePartPrices.sparePartId })
    .from(sparePartPrices)
    .where(
      and(eq(sparePartPrices.year, year), eq(sparePartPrices.month, month))
    );
  const sudahAda = new Set(filled.map((row) => row.sparePartId));

  const toInsert = Array.from(best.entries())
    .filter(([sparePartId]) => !sudahAda.has(sparePartId))
    .map(([sparePartId, src]) => ({
      sparePartId,
      price: src.price,
      month,
      year,
    }));

  // Yang benar-benar dilewati = punya harga lama TAPI periode tujuan sudah
  // terisi. `sudahAda` sendiri memuat juga sparepart tanpa harga lama, jadi
  // angkanya tidak boleh dipakai mentah.
  const skipped = best.size - toInsert.length;

  if (toInsert.length === 0) {
    return jsonOk({
      inserted: 0,
      skipped,
      message: carryForwardMessage("sparepart", 0, skipped, {
        month,
        year,
      }),
    });
  }

  await db.insert(sparePartPrices).values(toInsert);
  return jsonOk({
    inserted: toInsert.length,
    skipped,
    message: carryForwardMessage("sparepart", toInsert.length, skipped, {
      month,
      year,
    }),
  });
}
