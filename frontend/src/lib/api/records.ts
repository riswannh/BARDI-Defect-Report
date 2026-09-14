import { and, desc, eq, gte, inArray, like, lte, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  defects,
  factories,
  keterangan,
  problems,
  products,
  purchaseOrders,
  sales,
  statuses,
} from "@/lib/db/schema";
import {
  requireAdmin,
  requireUser,
  scopedFactoryId,
  type SessionUser,
} from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { backupDatabase } from "@/lib/api/bulk";
import {
  defectSchema,
  defectUpdateSchema,
  normalizeCurrency,
  normalizePpn,
  purchaseOrderSchema,
  purchaseOrderUpdateSchema,
  saleSchema,
  saleUpdateSchema,
} from "@/lib/api/validation";

function stripValue<T extends { value?: number }>(
  row: T,
  user: SessionUser
): T | Omit<T, "value"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.value;
  return copy as Omit<T, "value">;
}

/**
 * Field PO yang tidak boleh dilihat role Pabrik: harga satuan, total, mata uang,
 * dan status PPN.
 *
 * Dihapus di sini — bukan disembunyikan di UI — mengikuti aturan yang sama
 * dengan field `value` pada Defect/Sales.
 */
function stripPoFinance<
  T extends {
    value?: number;
    pricePerPcs?: number;
    currency?: string;
    ppn?: string;
  },
>(
  row: T,
  user: SessionUser
): T | Omit<T, "value" | "pricePerPcs" | "currency" | "ppn"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.value;
  delete copy.pricePerPcs;
  delete copy.currency;
  delete copy.ppn;
  return copy as Omit<T, "value" | "pricePerPcs" | "currency" | "ppn">;
}

const defectSelect = {
  id: defects.id,
  codeGaransi: defects.codeGaransi,
  timestamp: defects.timeStamp,
  photosLink: defects.photosLink,
  videosLink: defects.videosLink,
  problemId: defects.problemId,
  problemDetail: defects.problemDetail,
  productId: defects.productId,
  quantity: defects.quantity,
  statusId: defects.statusId,
  factoryId: defects.factoryId,
  value: defects.value,
  productName: products.name,
  factoryName: factories.name,
  problemName: problems.name,
  statusName: statuses.name,
};

const saleSelect = {
  id: sales.id,
  productId: sales.productId,
  factoryId: sales.factoryId,
  month: sales.month,
  quantity: sales.quantity,
  value: sales.value,
  productName: products.name,
  factoryName: factories.name,
};

const purchaseOrderSelect = {
  id: purchaseOrders.id,
  poNumber: purchaseOrders.poNumber,
  poDate: purchaseOrders.poDate,
  productId: purchaseOrders.productId,
  factoryId: purchaseOrders.factoryId,
  quantity: purchaseOrders.quantity,
  pricePerPcs: purchaseOrders.pricePerPcs,
  value: purchaseOrders.value,
  currency: purchaseOrders.currency,
  ppn: purchaseOrders.ppn,
  keteranganId: purchaseOrders.keteranganId,
  // SKU ikut dikirim supaya konsumen lain (mis. ekspor Excel) tidak kehilangan
  // informasi; SKU tetap melekat pada produk, bukan disalin ke baris PO.
  sku: products.sku,
  productName: products.name,
  factoryName: factories.name,
  keteranganName: keterangan.name,
};

function numParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export function defectConditions(
  user: SessionUser,
  params: URLSearchParams
): SQL[] {
  const factory = scopedFactoryId(user, numParam(params.get("factoryId")));
  const productId = numParam(params.get("productId"));
  const statusId = numParam(params.get("statusId"));
  const problemId = numParam(params.get("problemId"));
  const from = params.get("from");
  const to = params.get("to");
  const q = params.get("search")?.trim();

  const conditions: SQL[] = [];
  if (factory !== null) conditions.push(eq(defects.factoryId, factory));
  if (productId !== null) conditions.push(eq(defects.productId, productId));
  if (statusId !== null) conditions.push(eq(defects.statusId, statusId));
  if (problemId !== null) conditions.push(eq(defects.problemId, problemId));
  if (from) conditions.push(gte(defects.timeStamp, from));
  if (to) conditions.push(lte(defects.timeStamp, `${to}T23:59`));
  if (q) {
    const searchClause = or(
      like(defects.codeGaransi, `%${q}%`),
      like(defects.problemDetail, `%${q}%`),
      like(products.name, `%${q}%`),
      like(problems.name, `%${q}%`),
      like(statuses.name, `%${q}%`),
      like(factories.name, `%${q}%`)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export function saleConditions(
  user: SessionUser,
  params: URLSearchParams
): SQL[] {
  const factory = scopedFactoryId(user, numParam(params.get("factoryId")));
  const productId = numParam(params.get("productId"));
  const month = params.get("month");
  const q = params.get("search")?.trim();

  const conditions: SQL[] = [];
  if (factory !== null) conditions.push(eq(sales.factoryId, factory));
  if (productId !== null) conditions.push(eq(sales.productId, productId));
  if (month) conditions.push(eq(sales.month, month));
  if (q) {
    const searchClause = or(
      like(products.name, `%${q}%`),
      like(factories.name, `%${q}%`),
      like(sales.month, `%${q}%`)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

/**
 * Filter PO: mengikuti Sales (pabrik, produk, pencarian) ditambah Keterangan
 * serta Bulan/Tahun yang membaca `poDate`.
 *
 * Bulan dan tahun disaring lewat rentang string, bukan fungsi tanggal SQL,
 * supaya format `YYYY-MM-DDTHH:mm` dibandingkan apa adanya.
 */
export function purchaseOrderConditions(
  user: SessionUser,
  params: URLSearchParams
): SQL[] {
  const factory = scopedFactoryId(user, numParam(params.get("factoryId")));
  const productId = numParam(params.get("productId"));
  const keteranganId = numParam(params.get("keteranganId"));
  const month = params.get("month")?.trim();
  const year = params.get("year")?.trim();
  const q = params.get("search")?.trim();

  const conditions: SQL[] = [];
  if (factory !== null) conditions.push(eq(purchaseOrders.factoryId, factory));
  if (productId !== null)
    conditions.push(eq(purchaseOrders.productId, productId));
  if (keteranganId !== null)
    conditions.push(eq(purchaseOrders.keteranganId, keteranganId));
  if (year && /^\d{4}$/.test(year)) {
    if (month && /^\d{2}$/.test(month)) {
      conditions.push(gte(purchaseOrders.poDate, `${year}-${month}-01`));
      conditions.push(lte(purchaseOrders.poDate, `${year}-${month}-31T23:59`));
    } else {
      conditions.push(gte(purchaseOrders.poDate, `${year}-01-01`));
      conditions.push(lte(purchaseOrders.poDate, `${year}-12-31T23:59`));
    }
  } else if (month && /^\d{2}$/.test(month)) {
    // Bulan saja tanpa tahun: cocokkan bagian "-MM-" pada tanggal mana pun.
    conditions.push(like(purchaseOrders.poDate, `____-${month}-%`));
  }
  if (q) {
    const searchClause = or(
      like(purchaseOrders.poNumber, `%${q}%`),
      like(keterangan.name, `%${q}%`),
      like(products.name, `%${q}%`),
      like(products.sku, `%${q}%`),
      like(factories.name, `%${q}%`)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export async function listPurchaseOrderRows(
  user: SessionUser,
  params: URLSearchParams
) {
  const conditions = purchaseOrderConditions(user, params);
  return db
    .select(purchaseOrderSelect)
    .from(purchaseOrders)
    .leftJoin(products, eq(purchaseOrders.productId, products.id))
    .leftJoin(factories, eq(purchaseOrders.factoryId, factories.id))
    .leftJoin(keterangan, eq(purchaseOrders.keteranganId, keterangan.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(purchaseOrders.poDate), desc(purchaseOrders.id));
}

export async function listDefectRows(
  user: SessionUser,
  params: URLSearchParams
) {
  const conditions = defectConditions(user, params);
  const rows = await db
    .select(defectSelect)
    .from(defects)
    .leftJoin(products, eq(defects.productId, products.id))
    .leftJoin(factories, eq(defects.factoryId, factories.id))
    .leftJoin(problems, eq(defects.problemId, problems.id))
    .leftJoin(statuses, eq(defects.statusId, statuses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(defects.timeStamp), desc(defects.id));
  return rows;
}

export async function listSaleRows(user: SessionUser, params: URLSearchParams) {
  const conditions = saleConditions(user, params);
  const rows = await db
    .select(saleSelect)
    .from(sales)
    .leftJoin(products, eq(sales.productId, products.id))
    .leftJoin(factories, eq(sales.factoryId, factories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sales.id));
  return rows;
}

export { stripValue };

/* ============================== Defects ============================== */

export async function defectsGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const rows = await listDefectRows(guard.user, req.nextUrl.searchParams);
  return jsonOk(rows.map((row) => stripValue(row, guard.user)));
}

export async function defectsPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = defectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError("Data defect tidak valid.", 422);
  }

  const existing = await db
    .select({ id: defects.id })
    .from(defects)
    .where(eq(defects.codeGaransi, parsed.data.codeGaransi));
  if (existing.length > 0) {
    return jsonError("Code Garansi sudah ada.", 409);
  }

  const { timestamp, ...rest } = parsed.data;
  const [row] = await db
    .insert(defects)
    .values({ ...rest, timeStamp: timestamp })
    .returning();
  return jsonOk(row, 201);
}

export async function defectsPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = defectUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data defect tidak valid.", 422);

  if (parsed.data.codeGaransi) {
    const existing = await db
      .select({ id: defects.id })
      .from(defects)
      .where(eq(defects.codeGaransi, parsed.data.codeGaransi));
    if (existing.some((row) => row.id !== rowId)) {
      return jsonError("Code Garansi sudah ada.", 409);
    }
  }

  const { timestamp, ...rest } = parsed.data;
  const [row] = await db
    .update(defects)
    .set({
      ...rest,
      ...(timestamp ? { timeStamp: timestamp } : {}),
      updatedAt: new Date(),
    })
    .where(eq(defects.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk(row);
}

export async function defectsDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const [row] = await db
    .delete(defects)
    .where(eq(defects.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function defectsDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const backup = backupDatabase("defects");
  const rows = await db.delete(defects).returning({ id: defects.id });
  return jsonOk({ deleted: rows.length, backup });
}

export async function defectsBULKDELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json()) as { ids?: unknown };
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (ids.length === 0) return jsonError("Tidak ada data yang dipilih.", 422);

  const rows = await db
    .delete(defects)
    .where(inArray(defects.id, ids))
    .returning({ id: defects.id });
  return jsonOk({ deleted: rows.length });
}

/* =============================== Sales =============================== */

export async function salesGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const rows = await listSaleRows(guard.user, req.nextUrl.searchParams);
  return jsonOk(rows.map((row) => stripValue(row, guard.user)));
}

export async function salesPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = saleSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data sales tidak valid.", 422);

  const existing = await db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.productId, parsed.data.productId),
        eq(sales.factoryId, parsed.data.factoryId),
        eq(sales.month, parsed.data.month)
      )
    );
  if (existing.length > 0) {
    return jsonError("Kombinasi Produk + Pabrik + Bulan sudah ada.", 409);
  }

  const [row] = await db.insert(sales).values(parsed.data).returning();
  return jsonOk(row, 201);
}

export async function salesPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = saleUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data sales tidak valid.", 422);

  const current = await db
    .select()
    .from(sales)
    .where(eq(sales.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  const merged = {
    productId: parsed.data.productId ?? current[0].productId,
    factoryId: parsed.data.factoryId ?? current[0].factoryId,
    month: parsed.data.month ?? current[0].month,
  };
  const duplicate = await db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.productId, merged.productId),
        eq(sales.factoryId, merged.factoryId),
        eq(sales.month, merged.month)
      )
    );
  if (duplicate.some((row) => row.id !== rowId)) {
    return jsonError("Kombinasi Produk + Pabrik + Bulan sudah ada.", 409);
  }

  const [row] = await db
    .update(sales)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(sales.id, rowId))
    .returning();
  return jsonOk(row);
}

export async function salesDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const [row] = await db.delete(sales).where(eq(sales.id, rowId)).returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function salesDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const backup = backupDatabase("sales");
  const rows = await db.delete(sales).returning({ id: sales.id });
  return jsonOk({ deleted: rows.length, backup });
}

export async function salesBULKDELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json()) as { ids?: unknown };
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (ids.length === 0) return jsonError("Tidak ada data yang dipilih.", 422);

  const rows = await db
    .delete(sales)
    .where(inArray(sales.id, ids))
    .returning({ id: sales.id });
  return jsonOk({ deleted: rows.length });
}

/* ============================ PO Product ============================ */

export async function purchaseOrdersGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const rows = await listPurchaseOrderRows(guard.user, req.nextUrl.searchParams);
  return jsonOk(rows.map((row) => stripPoFinance(row, guard.user)));
}

export async function purchaseOrdersPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = purchaseOrderSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data PO tidak valid.", 422);

  const { poNumber, poDate, productId, factoryId } = parsed.data;
  // quantity/pricePerPcs opsional di skema; pada create nilainya di-default 0.
  const quantity = parsed.data.quantity ?? 0;
  const pricePerPcs = parsed.data.pricePerPcs ?? 0;

  // Tidak ada pemeriksaan duplikat: satu PO Number boleh diinput berkali-kali,
  // termasuk untuk produk yang sama (keputusan user, lihat SPEC-po-product.md).
  const [row] = await db
    .insert(purchaseOrders)
    .values({
      poNumber,
      poDate,
      productId,
      factoryId,
      quantity,
      pricePerPcs,
      // Total dihitung di server; angka dari klien tidak dipercaya.
      value: pricePerPcs * quantity,
      currency: normalizeCurrency(parsed.data.currency),
      ppn: normalizePpn(parsed.data.ppn),
      keteranganId: parsed.data.keteranganId ?? null,
    })
    .returning();
  return jsonOk(row, 201);
}

export async function purchaseOrdersPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = purchaseOrderUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError("Data PO tidak valid.", 422);

  const current = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  // Gabungkan dulu supaya total dihitung dari nilai final, bukan dari sebagian
  // field yang dikirim klien.
  const merged = {
    quantity: parsed.data.quantity ?? current[0].quantity,
    pricePerPcs: parsed.data.pricePerPcs ?? current[0].pricePerPcs,
  };

  const [row] = await db
    .update(purchaseOrders)
    .set({
      ...(parsed.data.poNumber !== undefined
        ? { poNumber: parsed.data.poNumber }
        : {}),
      ...(parsed.data.poDate !== undefined ? { poDate: parsed.data.poDate } : {}),
      ...(parsed.data.productId !== undefined
        ? { productId: parsed.data.productId }
        : {}),
      ...(parsed.data.factoryId !== undefined
        ? { factoryId: parsed.data.factoryId }
        : {}),
      quantity: merged.quantity,
      pricePerPcs: merged.pricePerPcs,
      value: merged.pricePerPcs * merged.quantity,
      ...(parsed.data.currency !== undefined
        ? { currency: normalizeCurrency(parsed.data.currency) }
        : {}),
      ...(parsed.data.ppn !== undefined ? { ppn: normalizePpn(parsed.data.ppn) } : {}),
      ...(parsed.data.keteranganId !== undefined
        ? { keteranganId: parsed.data.keteranganId }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk(row);
}

export async function purchaseOrdersDELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const [row] = await db
    .delete(purchaseOrders)
    .where(eq(purchaseOrders.id, rowId))
    .returning();
  if (!row) return jsonError("Data tidak ditemukan.", 404);
  return jsonOk({ deleted: rowId });
}

export async function purchaseOrdersDELETEALL() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const backup = backupDatabase("purchase-orders");
  const rows = await db
    .delete(purchaseOrders)
    .returning({ id: purchaseOrders.id });
  return jsonOk({ deleted: rows.length, backup });
}

export async function purchaseOrdersBULKDELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await req.json()) as { ids?: unknown };
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (ids.length === 0) return jsonError("Tidak ada data yang dipilih.", 422);

  const rows = await db
    .delete(purchaseOrders)
    .where(inArray(purchaseOrders.id, ids))
    .returning({ id: purchaseOrders.id });
  return jsonOk({ deleted: rows.length });
}
