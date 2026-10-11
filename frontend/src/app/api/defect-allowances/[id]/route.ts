import { and, eq, ne } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { defectAllowances } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { defectAllowanceUpdateSchema } from "@/lib/api/validation";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const parsed = defectAllowanceUpdateSchema.safeParse(
    await req.json().catch(() => ({}))
  );
  if (!parsed.success) return jsonError("Limit allowance tidak valid.", 422);

  const current = await db
    .select()
    .from(defectAllowances)
    .where(eq(defectAllowances.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  const year = parsed.data.year ?? current[0].year;
  if (year !== current[0].year) {
    const clash = await db
      .select({ id: defectAllowances.id })
      .from(defectAllowances)
      .where(
        and(
          eq(defectAllowances.year, year),
          ne(defectAllowances.id, rowId)
        )
      );
    if (clash.length > 0) {
      return jsonError(`Limit allowance ${year} sudah ada. Ubah baris itu.`, 409);
    }
  }

  const [row] = await db
    .update(defectAllowances)
    .set({
      year,
      limitValue: parsed.data.limitValue ?? current[0].limitValue,
      updatedAt: new Date(),
    })
    .where(eq(defectAllowances.id, rowId))
    .returning();
  return jsonOk(row);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const rowId = Number(id);
  if (!Number.isInteger(rowId)) return jsonError("ID tidak valid.", 400);

  const current = await db
    .select({ id: defectAllowances.id })
    .from(defectAllowances)
    .where(eq(defectAllowances.id, rowId));
  if (current.length === 0) return jsonError("Data tidak ditemukan.", 404);

  await db.delete(defectAllowances).where(eq(defectAllowances.id, rowId));
  return jsonOk({ ok: true });
}
