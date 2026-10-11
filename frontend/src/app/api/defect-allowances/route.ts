import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { defectAllowances } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { defectAllowanceSchema } from "@/lib/api/validation";

/**
 * Limit allowance defect per tahun (Rupiah) — data master halaman Report.
 *
 * GET pun admin saja: user meminta limit ini "tidak bisa dilihat selain admin",
 * jadi penyembunyiannya di server, bukan hanya di UI.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select()
    .from(defectAllowances)
    .orderBy(desc(defectAllowances.year));
  return jsonOk(rows);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = defectAllowanceSchema.safeParse(
    await req.json().catch(() => ({}))
  );
  if (!parsed.success) return jsonError("Limit allowance tidak valid.", 422);

  const existing = await db
    .select({ id: defectAllowances.id })
    .from(defectAllowances)
    .where(eq(defectAllowances.year, parsed.data.year));
  if (existing.length > 0) {
    return jsonError(
      `Limit allowance ${parsed.data.year} sudah ada. Ubah baris itu.`,
      409
    );
  }

  const [row] = await db
    .insert(defectAllowances)
    .values({
      year: parsed.data.year,
      limitValue: parsed.data.limitValue,
    })
    .returning();
  return jsonOk(row, 201);
}
