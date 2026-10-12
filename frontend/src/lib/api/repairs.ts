import { and, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { problems, productPrices, products, repairs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { backupDatabase } from "@/lib/api/bulk";
import {
  DEFAULT_PRICE_TYPE,
  normalizeDateOnly,
  repairSchema,
  repairUpdateSchema,
} from "@/lib/api/validation";
import { pickProductPrice } from "@/lib/prices";
import { normalizeCode } from "@/lib/gsheet/mapping";
import type { ProductPrice } from "@/lib/types";

/**
 * Modul Repair Data (isi tab "Data Reparasi" sheet Reparasi RFB).
 *
 * Semua endpoint admin saja — Saving Value memuat Rupiah, jadi role Pabrik tidak
 * boleh menerimanya sama sekali (aturan yang sama dengan kartu Allowance Defect).
 * Satu baris = satu CLAIM ID; itu kunci dedupe impor dan sync.
 *
 * Catatan: nama Sparepart 1/2/3 tidak ikut di-join di sini — daftar sparepart
 * sudah tersedia di app (`/api/spare-parts`) dan barisnya cuma menyimpan id,
 * jadi nama diterjemahkan di tempat yang membutuhkannya (Excel & dialog detail).
 */

const repairSelect = {
  id: repairs.id,
  claimId: repairs.claimId,
  date: repairs.date,
  month: repairs.month,
  productId: repairs.productId,
  productName: products.name,
  quantity: repairs.quantity,
  value: repairs.value,
  priceType: repairs.priceType,
  productPriceId: repairs.productPriceId,
  origin: repairs.origin,
  customerName: repairs.customerName,
  customerPhone: repairs.customerPhone,
  resi: repairs.resi,
  customerIssue: repairs.customerIssue,
  photoPackageLink: repairs.photoPackageLink,
  photoCompletenessLink: repairs.photoCompletenessLink,
  status: repairs.status,
  startAt: repairs.startAt,
  finishAt: repairs.finishAt,
  note: repairs.note,
  pic: repairs.pic,
  resolution: repairs.resolution,
  problemId: repairs.problemId,
  problemName: problems.name,
  sparePart1Id: repairs.sparePart1Id,
  sparePart2Id: repairs.sparePart2Id,
  sparePart3Id: repairs.sparePart3Id,
  sparePart1Text: repairs.sparePart1Text,
  sparePart2Text: repairs.sparePart2Text,
  sparePart3Text: repairs.sparePart3Text,
  noteClosing: repairs.noteClosing,
  sheetSyncedAt: repairs.sheetSyncedAt,
};

/** "2026-04-07" -> "2026-04" (dipakai filter bulan dan pencarian harga). */
export function repairMonth(date: string): string {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

/** Baris harga master (jenis RW) untuk sebuah produk pada periode tanggal. */
async function resolveRepairPrice(
  productId: number,
  date: string,
  priceType: string
) {
  const rows = await db
    .select({
      id: productPrices.id,
      productId: productPrices.productId,
      price: productPrices.price,
      priceType: productPrices.priceType,
      month: productPrices.month,
      year: productPrices.year,
    })
    .from(productPrices)
    .where(
      and(
        eq(productPrices.productId, productId),
        eq(productPrices.priceType, priceType)
      )
    );
  const picked = pickProductPrice(
    rows as ProductPrice[],
    productId,
    repairMonth(date),
    priceType
  );
  return picked ? { id: picked.id, price: Number(picked.price) || 0 } : null;
}

function repairConditions(params: URLSearchParams): SQL[] {
  const conditions: SQL[] = [];
  const q = params.get("search")?.trim();
  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isInteger(value) ? value : null;
  };

  const productId = num("productId");
  if (productId !== null) conditions.push(eq(repairs.productId, productId));
  const problemId = num("problemId");
  if (problemId !== null) conditions.push(eq(repairs.problemId, problemId));

  const status = params.get("status")?.trim();
  if (status) conditions.push(eq(repairs.status, status));
  const pic = params.get("pic")?.trim();
  if (pic) conditions.push(eq(repairs.pic, pic));
  const origin = params.get("origin")?.trim();
  if (origin) conditions.push(eq(repairs.origin, origin));
  const resolution = params.get("resolution")?.trim();
  if (resolution) conditions.push(eq(repairs.resolution, resolution));

  // Bulan disimpan sebagai "YYYY-MM", jadi rentang tahun/bulan cukup dicek
  // sebagai awalan teks — tidak perlu fungsi tanggal SQL.
  const year = params.get("year")?.trim() ?? "";
  const month = params.get("month")?.trim() ?? "";
  if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
    conditions.push(eq(repairs.month, `${year}-${month}`));
  } else if (/^\d{4}$/.test(year)) {
    conditions.push(like(repairs.month, `${year}-%`));
  } else if (/^\d{2}$/.test(month)) {
    conditions.push(like(repairs.month, `%-${month}`));
  }

  if (q) {
    const clause = or(
      like(repairs.claimId, `%${q}%`),
      like(repairs.resi, `%${q}%`),
      like(repairs.customerName, `%${q}%`),
      like(products.name, `%${q}%`)
    );
    if (clause) conditions.push(clause);
  }
  return conditions;
}

export async function listRepairRows(params: URLSearchParams) {
  const conditions = repairConditions(params);
  return db
    .select(repairSelect)
    .from(repairs)
    .leftJoin(products, eq(repairs.productId, products.id))
    .leftJoin(problems, eq(repairs.problemId, problems.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(repairs.date), desc(repairs.id));
}

export async function repairsGET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await listRepairRows(req.nextUrl.searchParams);
  return jsonOk(rows);
}

export async function repairsPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = repairSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data repair tidak valid.", 422);

  const claimId = normalizeCode(parsed.data.claimId);
  if (!claimId) return jsonError("Claim ID wajib diisi.", 422);
  const date = normalizeDateOnly(parsed.data.date);
  if (!date) return jsonError("Tanggal tidak valid.", 422);

  const existing = await db
    .select({ id: repairs.id })
    .from(repairs)
    .where(eq(repairs.claimId, claimId));
  if (existing.length > 0) return jsonError("Claim ID sudah ada.", 409);

  const priceType = parsed.data.priceType || DEFAULT_PRICE_TYPE;
  const quantity = parsed.data.quantity ?? 0;
  const sentValue = parsed.data.value ?? 0;
  const price = await resolveRepairPrice(parsed.data.productId, date, priceType);
  const value = sentValue > 0 ? sentValue : Math.round((price?.price ?? 0) * quantity);

  const [row] = await db
    .insert(repairs)
    .values({
      ...parsed.data,
      claimId,
      date,
      quantity,
      month: repairMonth(date),
      value,
      priceType,
      productPriceId: price?.id ?? null,
      problemId: parsed.data.problemId || null,
      sparePart1Id: parsed.data.sparePart1Id || null,
      sparePart2Id: parsed.data.sparePart2Id || null,
      sparePart3Id: parsed.data.sparePart3Id || null,
    })
    .returning();
  return jsonOk(row, 201);
}

export async function repairsPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = repairUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data repair tidak valid.", 422);

  const current = await db.select().from(repairs).where(eq(repairs.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);
  const before = current[0];

  const claimId =
    parsed.data.claimId !== undefined
      ? normalizeCode(parsed.data.claimId)
      : before.claimId;
  if (!claimId) return jsonError("Claim ID wajib diisi.", 422);

  const date =
    parsed.data.date !== undefined
      ? normalizeDateOnly(parsed.data.date)
      : before.date;
  if (!date) return jsonError("Tanggal tidak valid.", 422);

  const duplicate = await db
    .select({ id: repairs.id })
    .from(repairs)
    .where(eq(repairs.claimId, claimId));
  if (duplicate.some((row) => row.id !== rowId)) {
    return jsonError("Claim ID sudah ada.", 409);
  }

  const productId = parsed.data.productId ?? before.productId;
  const priceType = parsed.data.priceType || before.priceType || DEFAULT_PRICE_TYPE;
  const quantity = parsed.data.quantity ?? before.quantity;
  const price = await resolveRepairPrice(productId, date, priceType);
  // Saving Value hanya dihitung ulang kalau form tidak mengirim angkanya —
  // angka yang sudah diisi operator tidak boleh ditimpa diam-diam.
  const value =
    parsed.data.value !== undefined
      ? parsed.data.value
      : Math.round((price?.price ?? 0) * quantity);

  const [row] = await db
    .update(repairs)
    .set({
      ...parsed.data,
      claimId,
      date,
      month: repairMonth(date),
      productId,
      quantity,
      value,
      priceType,
      productPriceId: price?.id ?? null,
      problemId: parsed.data.problemId ? parsed.data.problemId : before.problemId,
      sparePart1Id:
        parsed.data.sparePart1Id !== undefined
          ? parsed.data.sparePart1Id || null
          : before.sparePart1Id,
      sparePart2Id:
        parsed.data.sparePart2Id !== undefined
          ? parsed.data.sparePart2Id || null
          : before.sparePart2Id,
      sparePart3Id:
        parsed.data.sparePart3Id !== undefined
          ? parsed.data.sparePart3Id || null
          : before.sparePart3Id,
      updatedAt: new Date(),
    })
    .where(eq(repairs.id, rowId))
    .returning();
  return jsonOk(row);
}

export async function repairsDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const [row] = await db.delete(repairs).where(eq(repairs.id, rowId)).returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function repairsDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const backup = backupDatabase("repairs");
  const rows = await db.delete(repairs).returning({ id: repairs.id });
  return jsonOk({ deleted: rows.length, backup });
}

export async function repairsBULKDELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json()) as { ids?: unknown };
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (ids.length === 0) return jsonError("Tidak ada data yang dipilih.", 422);

  const rows = await db
    .delete(repairs)
    .where(inArray(repairs.id, ids))
    .returning({ id: repairs.id });
  return jsonOk({ deleted: rows.length });
}
