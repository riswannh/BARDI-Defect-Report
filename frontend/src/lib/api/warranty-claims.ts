import { and, desc, eq, like, ne, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { products, warrantyClaims } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";

/**
 * Modul Claim Garansi BARDI — baca saja.
 *
 * Isinya cermin tab "Raw Combine CG"; semua perubahan datang dari sync sheet,
 * jadi tidak ada endpoint tulis (tambah/ubah/hapus) di sini.
 */
const warrantySelect = {
  id: warrantyClaims.id,
  claimId: warrantyClaims.claimId,
  date: warrantyClaims.date,
  month: warrantyClaims.month,
  timeStamp: warrantyClaims.timeStamp,
  customerName: warrantyClaims.customerName,
  customerPhone: warrantyClaims.customerPhone,
  customerEmail: warrantyClaims.customerEmail,
  city: warrantyClaims.city,
  courier: warrantyClaims.courier,
  resiUnit: warrantyClaims.resiUnit,
  resi: warrantyClaims.resi,
  productForm: warrantyClaims.productForm,
  officialName: warrantyClaims.officialName,
  productId: warrantyClaims.productId,
  productName: products.name,
  quantity: warrantyClaims.quantity,
  status: warrantyClaims.status,
  sla: warrantyClaims.sla,
  pic: warrantyClaims.pic,
  note: warrantyClaims.note,
  value: warrantyClaims.value,
  priceType: warrantyClaims.priceType,
  productPriceId: warrantyClaims.productPriceId,
  incompleteFields: warrantyClaims.incompleteFields,
  sheetSyncedAt: warrantyClaims.sheetSyncedAt,
};

const num = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
};

function warrantyConditions(params: URLSearchParams): SQL[] {
  const conditions: SQL[] = [];

  const productId = num(params, "productId");
  if (productId !== null) conditions.push(eq(warrantyClaims.productId, productId));

  const status = params.get("status")?.trim();
  if (status) conditions.push(eq(warrantyClaims.status, status));
  const pic = params.get("pic")?.trim();
  if (pic) conditions.push(eq(warrantyClaims.pic, pic));

  // Bulan disimpan "YYYY-MM", jadi rentang tahun/bulan cukup dicek awalan teks.
  const year = params.get("year")?.trim() ?? "";
  const month = params.get("month")?.trim() ?? "";
  if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
    conditions.push(eq(warrantyClaims.month, `${year}-${month}`));
  } else if (/^\d{4}$/.test(year)) {
    conditions.push(like(warrantyClaims.month, `${year}-%`));
  } else if (/^\d{2}$/.test(month)) {
    conditions.push(like(warrantyClaims.month, `%-${month}`));
  }

  const incomplete = params.get("incomplete")?.trim();
  if (incomplete === "1") conditions.push(ne(warrantyClaims.incompleteFields, ""));

  const q = params.get("search")?.trim();
  if (q) {
    const clause = or(
      like(warrantyClaims.claimId, `%${q}%`),
      like(warrantyClaims.resi, `%${q}%`),
      like(warrantyClaims.resiUnit, `%${q}%`),
      like(warrantyClaims.customerName, `%${q}%`),
      like(warrantyClaims.officialName, `%${q}%`)
    );
    if (clause) conditions.push(clause);
  }
  return conditions;
}

export async function listWarrantyRows(params: URLSearchParams) {
  const conditions = warrantyConditions(params);
  return db
    .select(warrantySelect)
    .from(warrantyClaims)
    .leftJoin(products, eq(warrantyClaims.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(warrantyClaims.date), desc(warrantyClaims.id));
}

/** GET /api/warranty-claims — daftar claim garansi (admin saja; memuat Rupiah). */
export async function warrantyClaimsGET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await listWarrantyRows(req.nextUrl.searchParams);
  return jsonOk(rows);
}
