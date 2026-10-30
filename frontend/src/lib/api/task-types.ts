import { asc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { taskTypes, tasks } from "@/lib/db/schema";
import { requireAdmin, requireMenu } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { taskTypeCreateSchema } from "@/lib/api/validation";

/** Tipe awal saat tabel masih kosong (kode lama tetap dipakai tasks.issueType). */
const DEFAULT_TYPES = [
  { code: "task", name: "Tugas" },
  { code: "bug", name: "Bug" },
  { code: "feature", name: "Fitur" },
  { code: "subtask", name: "Sub-task" },
];

/** "Bug UI/UX!" → "bug-ui-ux"; dipakai sebagai nilai tasks.issueType. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "tipe";
}

/** Isi daftar bawaan sekali saja, supaya instalasi lama tetap punya pilihan. */
async function ensureDefaults() {
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(taskTypes);
  if (Number(row?.total ?? 0) > 0) return;

  const now = new Date();
  await db.insert(taskTypes).values(
    DEFAULT_TYPES.map((item, index) => ({
      code: item.code,
      name: item.name,
      sortOrder: index,
      createdAt: now,
    }))
  );
}

async function usedCounts() {
  const rows = await db
    .select({ code: tasks.issueType, total: sql<number>`count(*)` })
    .from(tasks)
    .groupBy(tasks.issueType);
  return new Map(rows.map((row) => [row.code, Number(row.total)]));
}

export async function taskTypesGET() {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  await ensureDefaults();

  const [rows, used] = await Promise.all([
    db.select().from(taskTypes).orderBy(asc(taskTypes.sortOrder), asc(taskTypes.id)),
    usedCounts(),
  ]);

  return jsonOk(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
      used: used.get(row.code) ?? 0,
    }))
  );
}

export async function taskTypesPOST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = taskTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  await ensureDefaults();

  const base = slugify(parsed.data.name);
  let code = base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const [exists] = await db.select({ id: taskTypes.id }).from(taskTypes).where(eq(taskTypes.code, code));
    if (!exists) break;
    code = `${base}-${suffix}`;
  }

  const [last] = await db
    .select({ sortOrder: taskTypes.sortOrder })
    .from(taskTypes)
    .orderBy(sql`${taskTypes.sortOrder} desc`)
    .limit(1);

  const [row] = await db
    .insert(taskTypes)
    .values({
      code,
      name: parsed.data.name,
      sortOrder: Number(last?.sortOrder ?? 0) + 1,
      createdAt: new Date(),
    })
    .returning();

  return jsonOk({ ...row, used: 0 });
}

export async function taskTypesDELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) return jsonError("ID tipe tidak valid", 400);

  const [current] = await db.select().from(taskTypes).where(eq(taskTypes.id, typeId));
  if (!current) return jsonError("Tipe tidak ditemukan", 404);

  const [used] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.issueType, current.code));
  const total = Number(used?.total ?? 0);
  if (total > 0) {
    return jsonError(`Tipe "${current.name}" masih dipakai ${total} task.`, 409);
  }

  await db.delete(taskTypes).where(eq(taskTypes.id, typeId));
  return jsonOk({ deleted: typeId });
}
