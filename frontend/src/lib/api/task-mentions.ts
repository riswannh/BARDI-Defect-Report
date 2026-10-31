import { desc, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, user as userTable } from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import type { NextRequest } from "next/server";

/** Jumlah maksimum saran per kelompok di popup `@`. */
const MENTION_LIMIT = 8;

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

  const userRows = await db
    .select({ id: userTable.id, name: userTable.name, username: userTable.username })
    .from(userTable)
    .where(query ? or(like(userTable.name, pattern), like(userTable.username, pattern)) : undefined)
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
