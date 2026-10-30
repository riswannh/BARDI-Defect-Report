import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rolePermissions, roles, taskActivities, tasks, user as userTable } from "@/lib/db/schema";
import { requireMenu, type SessionUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { calendarColorSchema, taskCreateSchema, taskUpdateSchema } from "@/lib/api/validation";
import { nextOccurrence } from "@/lib/task-dates";

type TaskRow = typeof tasks.$inferSelect;

/** Satu kolom "kalender" di panel kiri Task Planner (satu akun = satu kalender). */
export interface TaskCalendarUser {
  id: string;
  name: string;
  /** Warna kartu akun di kalender (#rrggbb); null = pakai warna bawaan. */
  color: string | null;
}

interface TaskValues {
  title: string;
  description: string;
  progress: number;
  priority: string;
  difficulty: string;
  issueType: string;
  labels: string;
  boardOrder: number;
  status: string;
  startDate: string;
  dueDate: string;
  repeatRule: string;
  repeatWeekday: number | null;
  repeatDay: number | null;
}

const DIFF_FIELDS = [
  "title",
  "description",
  "progress",
  "priority",
  "difficulty",
  "issueType",
  "labels",
  "boardOrder",
  "status",
  "startDate",
  "dueDate",
  "repeatRule",
  "repeatWeekday",
  "repeatDay",
] as const;

/**
 * Status "Selesai" berarti 100% dan sebaliknya: progress 100 tidak boleh
 * berstatus lain. Dipakai di POST dan PATCH supaya papan, daftar, dan
 * kalender tidak pernah bertentangan.
 */
function syncStatusProgress<T extends { status: string; progress: number }>(values: T): T {
  if (values.status === "Selesai") return { ...values, progress: 100 };
  if (values.progress >= 100) return { ...values, progress: 99 };
  return values;
}

function validateTask(
  values: Pick<TaskValues, "startDate" | "dueDate" | "repeatRule" | "repeatWeekday" | "repeatDay">
): string | null {
  if (values.dueDate < values.startDate) {
    return "Deadline tidak boleh sebelum tanggal mulai.";
  }
  if (values.repeatRule === "weekly" && !values.repeatWeekday) {
    return "Repeat mingguan butuh pilihan hari.";
  }
  if (values.repeatRule === "monthly" && !values.repeatDay) {
    return "Repeat bulanan butuh pilihan tanggal.";
  }
  return null;
}

async function logActivity(input: {
  taskId: number | null;
  taskTitle: string;
  user: SessionUser;
  action: string;
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  note?: string;
}) {
  await db.insert(taskActivities).values({
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    actorId: input.user.id,
    actorName: input.user.username,
    action: input.action,
    changes: input.changes?.length ? JSON.stringify(input.changes) : "",
    note: input.note ?? "",
    createdAt: new Date(),
  });
}

function diffTask(before: TaskRow, after: TaskValues) {
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const field of DIFF_FIELDS) {
    const from = before[field];
    const to = after[field];
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

export async function tasksGET(req: NextRequest) {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const scope = params.get("scope") === "all" ? "all" : "mine";
  const conditions: SQL[] = [];

  if (scope === "all" && !guard.user.isAdmin) {
    return jsonError("Hanya admin yang bisa melihat semua task.", 403);
  }

  if (scope === "mine") conditions.push(eq(tasks.userId, guard.user.id));

  const status = params.get("status")?.trim();
  if (status) conditions.push(eq(tasks.status, status));

  const priority = params.get("priority")?.trim();
  if (priority) conditions.push(eq(tasks.priority, priority));

  const difficulty = params.get("difficulty")?.trim();
  if (difficulty) conditions.push(eq(tasks.difficulty, difficulty));

  const search = params.get("q")?.trim();
  if (search) {
    const clause = or(
      like(tasks.title, `%${search}%`),
      like(tasks.description, `%${search}%`),
      like(tasks.ownerName, `%${search}%`)
    );
    if (clause) conditions.push(clause);
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.updatedAt), desc(tasks.id));

  return jsonOk(rows);
}

export async function tasksPOST(req: NextRequest) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  const { note, ...raw } = parsed.data;
  const synced = syncStatusProgress({
    status: raw.status ?? "Belum",
    progress: raw.progress ?? 0,
  });
  const values = {
    title: raw.title,
    description: raw.description ?? "",
    priority: raw.priority ?? "Normal",
    difficulty: raw.difficulty ?? "Sedang",
    issueType: raw.issueType ?? "task",
    labels: raw.labels ?? "",
    // Kartu baru masuk paling bawah kolom papan (urutan naik = Date.now()).
    boardOrder:
      Number(raw.boardOrder ?? 0) > 0 ? Number(raw.boardOrder) : Date.now(),
    status: synced.status,
    progress: synced.progress,
    startDate: raw.startDate,
    dueDate: raw.dueDate,
    repeatRule: raw.repeatRule ?? "",
    repeatWeekday: raw.repeatWeekday ?? null,
    repeatDay: raw.repeatDay ?? null,
  };
  const invalid = validateTask({
    startDate: values.startDate,
    dueDate: values.dueDate,
    repeatRule: values.repeatRule,
    repeatWeekday: values.repeatWeekday,
    repeatDay: values.repeatDay,
  });
  if (invalid) return jsonError(invalid, 400);

  // Admin boleh membuat task untuk akun lain (pilih pemilik di form); akun
  // biasa selalu membuat task untuk dirinya sendiri.
  const ownerId = guard.user.isAdmin && raw.ownerId ? raw.ownerId : guard.user.id;
  let ownerName = guard.user.username;
  if (ownerId !== guard.user.id) {
    const [owner] = await db
      .select({ username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, ownerId));
    if (!owner) return jsonError("Akun pemilik task tidak ditemukan.", 400);
    ownerName = owner.username ?? guard.user.username;
  }

  const now = new Date();
  const [row] = await db
    .insert(tasks)
    .values({
      ...values,
      userId: ownerId,
      ownerName,
      completedAt: values.status === "Selesai" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logActivity({
    taskId: row.id,
    taskTitle: row.title,
    user: guard.user,
    action: "create",
    note,
  });

  return jsonOk(row);
}

export async function tasksPATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return jsonError("ID task tidak valid", 400);

  const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!current) return jsonError("Task tidak ditemukan", 404);
  if (current.userId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya pembuat task atau admin yang bisa mengubah.", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  const { note, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0 && !note) {
    return jsonError("Tidak ada perubahan.", 400);
  }

  const merged: TaskValues = syncStatusProgress({
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    progress: patch.progress ?? current.progress,
    priority: patch.priority ?? current.priority,
    difficulty: patch.difficulty ?? current.difficulty,
    issueType: patch.issueType ?? current.issueType,
    labels: patch.labels ?? current.labels,
    boardOrder: patch.boardOrder ?? current.boardOrder,
    status: patch.status ?? current.status,
    startDate: patch.startDate ?? current.startDate,
    dueDate: patch.dueDate ?? current.dueDate,
    repeatRule: patch.repeatRule ?? current.repeatRule,
    repeatWeekday:
      patch.repeatWeekday !== undefined ? patch.repeatWeekday : current.repeatWeekday,
    repeatDay: patch.repeatDay !== undefined ? patch.repeatDay : current.repeatDay,
  });

  const invalid = validateTask(merged);
  if (invalid) return jsonError(invalid, 400);

  // Pindah pemilik task: hanya admin.
  let nextOwnerId = current.userId;
  let nextOwnerName = current.ownerName;
  if (patch.ownerId && patch.ownerId !== current.userId) {
    if (!guard.user.isAdmin) {
      return jsonError("Hanya admin yang bisa memindahkan task ke akun lain.", 403);
    }
    const [owner] = await db
      .select({ username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, patch.ownerId));
    if (!owner) return jsonError("Akun pemilik task tidak ditemukan.", 400);
    nextOwnerId = patch.ownerId;
    nextOwnerName = owner.username ?? current.ownerName;
  }

  const now = new Date();
  const becomingDone = merged.status === "Selesai" && current.status !== "Selesai";
  const [updated] = await db
    .update(tasks)
    .set({
      ...merged,
      userId: nextOwnerId,
      ownerName: nextOwnerName,
      completedAt: becomingDone
        ? now
        : merged.status === "Selesai"
          ? current.completedAt
          : null,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  const changes = diffTask(current, merged);
  await logActivity({
    taskId: updated.id,
    taskTitle: updated.title,
    user: guard.user,
    action: becomingDone ? "status" : "update",
    changes,
    note,
  });

  // Task repeatable: selesai → buat occurrence berikutnya (baris baru).
  let occurrence: TaskRow | null = null;
  if (becomingDone) {
    const nextDue = nextOccurrence(merged);
    if (nextDue) {
      const span = Math.max(
        0,
        Math.round(
          (Date.parse(`${merged.dueDate}T00:00:00Z`) -
            Date.parse(`${merged.startDate}T00:00:00Z`)) /
            86_400_000
        )
      );
      const nextStart = new Date(Date.parse(`${nextDue}T00:00:00Z`));
      nextStart.setUTCDate(nextStart.getUTCDate() - span);
      const nextStartISO = nextStart.toISOString().slice(0, 10);

      [occurrence] = await db
        .insert(tasks)
        .values({
          userId: current.userId,
          ownerName: current.ownerName,
          title: merged.title,
          description: merged.description,
          progress: 0,
          priority: merged.priority,
          difficulty: merged.difficulty,
          issueType: merged.issueType,
          labels: merged.labels,
          boardOrder: Date.now(),
          status: "Belum",
          startDate: nextStartISO,
          dueDate: nextDue,
          repeatRule: merged.repeatRule,
          repeatWeekday: merged.repeatWeekday,
          repeatDay: merged.repeatDay,
          repeatParentId: current.repeatParentId ?? current.id,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await logActivity({
        taskId: null,
        taskTitle: occurrence.title,
        user: guard.user,
        action: "repeat",
        note: `Occurrence berikutnya otomatis dibuat untuk deadline ${nextDue}.`,
      });
    }
  }

  return jsonOk({ task: updated, occurrence });
}

export async function tasksDELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireMenu("tasks", "write");
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return jsonError("ID task tidak valid", 400);

  const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!current) return jsonError("Task tidak ditemukan", 404);
  if (current.userId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya pembuat task atau admin yang bisa menghapus.", 403);
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));
  await logActivity({
    taskId: current.id,
    taskTitle: current.title,
    user: guard.user,
    action: "delete",
  });

  return jsonOk({ id: taskId });
}

export async function taskActivitiesGET(req: NextRequest) {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const taskId = Number(params.get("taskId"));
  // `params.get` null jangan di-Number-kan: Number(null) = 0 (finite) sehingga
  // tanpa parameter limit endpoint ini dulu hanya mengembalikan 1 baris log.
  const limitParam = params.get("limit");
  const limit =
    limitParam === null ? 200 : Math.min(Math.max(Number(limitParam) || 1, 1), 500);

  const rows = await db
    .select()
    .from(taskActivities)
    .where(Number.isFinite(taskId) && taskId > 0 ? eq(taskActivities.taskId, taskId) : undefined)
    .orderBy(desc(taskActivities.createdAt), desc(taskActivities.id))
    .limit(limit);

  return jsonOk(rows);
}

/**
 * Daftar akun untuk panel "kalender" Task Planner. Hanya akun yang role-nya
 * boleh MENULIS di menu `tasks` — grup role yang cuma punya akses baca tidak
 * ikut tampil, jadi kalender bersama hanya berisi tim yang memang mengerjakan
 * task. Akun Super Admin dikecualikan (permintaan user): admin tidak muncul di
 * filter walau bypass permission.
 */
export async function taskCalendarsGET() {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: userTable.id,
      username: userTable.username,
      name: userTable.name,
      isAdmin: userTable.isAdmin,
      canRead: rolePermissions.canRead,
      canWrite: rolePermissions.canWrite,
      calendarColor: userTable.calendarColor,
    })
    .from(userTable)
    .leftJoin(roles, eq(userTable.roleId, roles.id))
    .leftJoin(
      rolePermissions,
      and(eq(rolePermissions.roleId, roles.id), eq(rolePermissions.menu, "tasks"))
    )
    .orderBy(userTable.username);

  const calendars: TaskCalendarUser[] = rows
    // Kalender menampilkan semua akun yang boleh membuka Rencana Kerja (baca
    // pun cukup, karena warna kartu hanya penanda visual).
    .filter((row) => row.isAdmin || row.canRead === true || row.canWrite === true)
    .map((row) => ({
      id: row.id,
      name: row.username || row.name || row.id,
      color: row.calendarColor ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return jsonOk(calendars);
}

/**
 * Atur warna kartu sebuah akun di kalender. Pemilik boleh mengatur warnanya
 * sendiri; admin boleh mengatur akun lain.
 */
export async function taskCalendarsPATCH(req: NextRequest) {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = calendarColorSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Data tidak valid", 400);
  }

  const targetId = parsed.data.userId || guard.user.id;
  if (targetId !== guard.user.id && !guard.user.isAdmin) {
    return jsonError("Hanya admin yang bisa mengatur warna akun lain.", 403);
  }

  const [row] = await db
    .update(userTable)
    .set({ calendarColor: parsed.data.color })
    .where(eq(userTable.id, targetId))
    .returning({ id: userTable.id, calendarColor: userTable.calendarColor });
  if (!row) return jsonError("Akun tidak ditemukan.", 404);

  return jsonOk({ id: row.id, color: row.calendarColor });
}
