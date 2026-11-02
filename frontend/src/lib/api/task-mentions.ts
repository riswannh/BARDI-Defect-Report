import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { rolePermissions, tasks, user as userTable, userRoles } from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import type { NextRequest } from "next/server";

/** Jumlah maksimum saran per kelompok di popup `@`. */
const MENTION_LIMIT = 8;

/**
 * Id akun yang boleh menulis Rencana Kerja — sumber daftar orang di popup `@`.
 * Aturannya SAMA dengan filter pemilik tugas dan panel kalender: admin selalu
 * ikut, akun lain harus punya izin tulis di menu tasks. Izin dibaca dari tautan
 * `user_roles` (multi group role) DAN kolom lama `user.roleId`, karena akun yang
 * belum pernah disunting masih hanya punya role utama.
 */
async function taskWriterIds(): Promise<string[]> {
  const linked = await db
    .select({ userId: userRoles.userId, canWrite: rolePermissions.canWrite })
    .from(userRoles)
    .innerJoin(
      rolePermissions,
      and(eq(rolePermissions.roleId, userRoles.roleId), eq(rolePermissions.menu, "tasks"))
    );

  const legacy = await db
    .select({ userId: userTable.id, canWrite: rolePermissions.canWrite })
    .from(userTable)
    .innerJoin(
      rolePermissions,
      and(eq(rolePermissions.roleId, userTable.roleId), eq(rolePermissions.menu, "tasks"))
    );

  const ids = new Set<string>();
  for (const row of [...linked, ...legacy]) {
    if (row.canWrite === true) ids.add(row.userId);
  }
  return [...ids];
}

export interface MentionUser {
  id: string;
  name: string;
  username: string;
}

export interface MentionTask {
  id: number;
  title: string;
  status: string;
  ownerName: string;
  dueDate: string;
}

export interface MentionResponse {
  users: MentionUser[];
  tasks: MentionTask[];
}

/**
 * Sumber data popup `@` di editor Mading Dokumentasi: orang (nama tampilan)
 * dan tugas (judul) yang bisa disebut. Tanpa `q`, kembalikan saran awal supaya
 * popup tidak kosong saat `@` baru diketik.
 */
export async function taskMentionsGET(req: NextRequest) {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  const pattern = `%${query}%`;

  const writerIds = await taskWriterIds();
  const whoFilter = writerIds.length
    ? or(eq(userTable.isAdmin, true), inArray(userTable.id, writerIds))
    : eq(userTable.isAdmin, true);
  const searchFilter = query
    ? or(like(userTable.name, pattern), like(userTable.username, pattern))
    : undefined;

  const userRows = await db
    .select({ id: userTable.id, name: userTable.name, username: userTable.username })
    .from(userTable)
    .where(searchFilter ? and(whoFilter, searchFilter) : whoFilter)
    .orderBy(userTable.name)
    .limit(MENTION_LIMIT);

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      ownerName: tasks.ownerName,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(query ? like(tasks.title, pattern) : undefined)
    .orderBy(desc(tasks.updatedAt), desc(tasks.id))
    .limit(MENTION_LIMIT);

  const payload: MentionResponse = {
    users: userRows.map((row) => ({
      id: row.id,
      name: row.name || row.username || "",
      username: row.username ?? "",
    })),
    tasks: taskRows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      ownerName: row.ownerName,
      dueDate: row.dueDate,
    })),
  };

  return jsonOk(payload);
}
