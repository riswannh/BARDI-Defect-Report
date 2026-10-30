import { and, asc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { taskTypes, tasks, user as userTable } from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { taskTypeCreateSchema, taskTypeUpdateSchema } from "@/lib/api/validation";

/**
 * Tipe bawaan untuk setiap akun baru. `code` inilah yang disimpan di
 * `tasks.issueType`, jadi tipe contoh di task lama tetap terbaca.
 */
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

/** Isi daftar bawaan sekali per akun, supaya dropdown tidak pernah kosong. */
async function ensureDefaults(userId: string) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(taskTypes)
    .where(eq(taskTypes.userId, userId));
  if (Number(row?.total ?? 0) > 0) return;

  const now = new Date();
  await db
    .insert(taskTypes)
    .values(
      DEFAULT_TYPES.map((item, index) => ({
        userId,
        code: item.code,
        name: item.name,
        sortOrder: index,
        createdAt: now,
      }))
    )
    .onConflictDoNothing();
}

/** Jumlah task per (pemilik, kode) — dipakai untuk badge & larangan hapus. */
async function usedCounts() {
  const rows = await db
    .select({
      userId: tasks.userId,
      code: tasks.issueType,
      total: sql<number>`count(*)`,
    })
    .from(tasks)
    .groupBy(tasks.userId, tasks.issueType);
  return new Map(
    rows.map((row) => [`${row.userId}::${row.code}`, Number(row.total)])
  );
}

async function userExists(userId: string) {
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return Boolean(row);
}

/**
 * Daftar tipe SEMUA akun (nama & warna tidak sensitif) supaya kalender dan
 * dropdown pemilik bisa menampilkan penanda tipe milik orang lain. Menulis
 * tetap dibatasi pemiliknya sendiri (atau admin).
 */
export async function taskTypesGET() {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  await ensureDefaults(guard.user.id);

  const [rows, used] = await Promise.all([
    db
      .select()
      .from(taskTypes)
      .orderBy(asc(taskTypes.userId), asc(taskTypes.sortOrder), asc(taskTypes.id)),
    usedCounts(),
  ]);

  return jsonOk(
    rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
      used: used.get(`${row.userId}::${row.code}`) ?? 0,
    }))
  );
}

export async function taskTypesPOST(req: NextRequest) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = taskTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  const requested = parsed.data.userId;
  const targetUserId = requested && requested !== guard.user.id ? requested : guard.user.id;
  if (targetUserId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya admin yang bisa mengatur tipe akun lain.", 403);
  }
  if (targetUserId !== guard.user.id && !(await userExists(targetUserId))) {
    return jsonError("Akun pemilik tipe tidak ditemukan.", 400);
  }

  await ensureDefaults(targetUserId);

  const base = slugify(parsed.data.name);
  let code = base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const [exists] = await db
      .select({ id: taskTypes.id })
      .from(taskTypes)
      .where(and(eq(taskTypes.userId, targetUserId), eq(taskTypes.code, code)));
    if (!exists) break;
    code = `${base}-${suffix}`;
  }

  const [last] = await db
    .select({ sortOrder: taskTypes.sortOrder })
    .from(taskTypes)
    .where(eq(taskTypes.userId, targetUserId))
    .orderBy(sql`${taskTypes.sortOrder} desc`)
    .limit(1);

  const [row] = await db
    .insert(taskTypes)
    .values({
      userId: targetUserId,
      code,
      name: parsed.data.name,
      sortOrder: Number(last?.sortOrder ?? 0) + 1,
      createdAt: new Date(),
    })
    .returning();

  return jsonOk({ ...row, used: 0 });
}

export async function taskTypesPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) return jsonError("ID tipe tidak valid", 400);

  const [current] = await db.select().from(taskTypes).where(eq(taskTypes.id, typeId));
  if (!current) return jsonError("Tipe tidak ditemukan", 404);
  if (current.userId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya pemilik daftar atau admin yang bisa mengubah tipe.", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = taskTypeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }
  if (!parsed.data.name) return jsonError("Tidak ada perubahan.", 400);

  const [updated] = await db
    .update(taskTypes)
    .set({ name: parsed.data.name })
    .where(eq(taskTypes.id, typeId))
    .returning();

  return jsonOk(updated);
}

export async function taskTypesDELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) return jsonError("ID tipe tidak valid", 400);

  const [current] = await db.select().from(taskTypes).where(eq(taskTypes.id, typeId));
  if (!current) return jsonError("Tipe tidak ditemukan", 404);
  if (current.userId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya pemilik daftar atau admin yang bisa menghapus tipe.", 403);
  }

  const [used] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.userId, current.userId), eq(tasks.issueType, current.code)));
  const total = Number(used?.total ?? 0);
  if (total > 0) {
    return jsonError(`Tipe "${current.name}" masih dipakai ${total} task.`, 409);
  }

  await db.delete(taskTypes).where(eq(taskTypes.id, typeId));
  return jsonOk({ deleted: typeId });
}
