import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { notifications, user } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";

export type NotificationKind = "doc-mention" | "task-mention";

export interface MentionNotice {
  /** Penerima. */
  userId: string;
  kind: NotificationKind;
  /** Judul BENDA sumber (judul task/dokumen), bukan kalimat jadi — kalimatnya
   *  disusun di klien mengikuti bahasa yang dipilih user. */
  title: string;
  body?: string;
  href: string;
  actorName: string;
  sourceType: "doc" | "task";
  sourceId: string;
}

/**
 * Simpan notifikasi mention. Pelaku tidak pernah menerima notifikasi atas
 * namanya sendiri, dan mention ganda ke orang yang sama dalam satu aksi
 * diabaikan supaya lonceng tidak berbunyi dua kali.
 */
export async function notifyMentions(actorId: string, notices: MentionNotice[]) {
  const seen = new Set<string>();
  const rows = notices
    .filter((notice) => {
      if (!notice.userId || notice.userId === actorId) return false;
      const key = `${notice.kind}:${notice.sourceId}:${notice.userId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((notice) => ({
      userId: notice.userId,
      kind: notice.kind,
      title: notice.title,
      body: notice.body ?? "",
      href: notice.href,
      actorName: notice.actorName,
      sourceType: notice.sourceType,
      sourceId: notice.sourceId,
      createdAt: new Date(),
    }));

  if (rows.length === 0) return 0;
  await db.insert(notifications).values(rows);
  return rows.length;
}

/** Buang notifikasi mention untuk sumber yang isinya sudah tidak menyebut lagi. */
export async function clearMentions(
  sourceType: "doc" | "task",
  sourceId: string,
  keepUserIds: string[]
) {
  const base = and(
    eq(notifications.sourceType, sourceType),
    eq(notifications.sourceId, sourceId)
  );
  const where =
    keepUserIds.length > 0
      ? and(base, notInArray(notifications.userId, keepUserIds))
      : base;
  await db.delete(notifications).where(where);
}

/** Lonceng ditampilkan per user; maksimal 20 notifikasi terbaru. */
export async function notificationsGET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const [rows, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, guard.user.id))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(20),
    db
      .select({ total: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, guard.user.id), isNull(notifications.readAt))),
  ]);

  return jsonOk({
    items: rows,
    unread: Number(unread[0]?.total ?? 0),
  });
}

/** Tandai satu notifikasi (atau semua) sebagai sudah dibaca. */
export async function notificationsReadPOST(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    id?: number | string;
    all?: boolean;
  };

  if (body.all) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, guard.user.id), isNull(notifications.readAt)));
    return jsonOk({ ok: true });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) return jsonError("Notifikasi tidak valid.", 422);

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, guard.user.id), eq(notifications.id, id)));

  return jsonOk({ ok: true });
}

/**
 * Validasi daftar user yang boleh di-mention: id harus benar-benar ada.
 * Dipakai tasks & docs supaya mencion ke id asing tidak menghasilkan
 * notifikasi yatim dan tidak menggagalkan penyimpanan.
 */
export async function validMentionIds(ids: string[] | undefined): Promise<string[]> {
  const unique = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, unique));
  return rows.map((row) => row.id);
}
