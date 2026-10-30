import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { taskDocs } from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { taskDocCreateSchema, taskDocUpdateSchema } from "@/lib/api/validation";

export async function taskDocsGET() {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const rows = await db.select().from(taskDocs).orderBy(desc(taskDocs.updatedAt), desc(taskDocs.id));
  return jsonOk(rows);
}

export async function taskDocsPOST(req: NextRequest) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = taskDocCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  const now = new Date();
  const [row] = await db
    .insert(taskDocs)
    .values({
      ...parsed.data,
      ownerId: guard.user.id,
      ownerName: guard.user.username,
      updatedByName: guard.user.username,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return jsonOk(row);
}

export async function taskDocsPATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) return jsonError("ID dokumen tidak valid", 400);

  const [current] = await db.select().from(taskDocs).where(eq(taskDocs.id, docId));
  if (!current) return jsonError("Dokumen tidak ditemukan", 404);

  const body = await req.json().catch(() => null);
  const parsed = taskDocUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }
  if (Object.keys(parsed.data).length === 0) return jsonError("Tidak ada perubahan.", 400);

  const [updated] = await db
    .update(taskDocs)
    .set({
      ...parsed.data,
      updatedByName: guard.user.username,
      updatedAt: new Date(),
    })
    .where(eq(taskDocs.id, docId))
    .returning();

  return jsonOk(updated);
}

export async function taskDocsDELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) return jsonError("ID dokumen tidak valid", 400);

  const deleted = await db.delete(taskDocs).where(eq(taskDocs.id, docId)).returning();
  if (deleted.length === 0) return jsonError("Dokumen tidak ditemukan", 404);

  return jsonOk({ deleted: docId });
}
