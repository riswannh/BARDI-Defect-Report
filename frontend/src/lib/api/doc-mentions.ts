/**
 * Utilitas mention untuk Mading Dokumentasi.
 *
 * Chip mention disimpan di `bodyHtml` sebagai elemen HTML ber-atribut
 * `data-type="mention"`, `data-id` (id user), `data-label`, dan
 * `data-mention-kind` ("user" atau "task") — lihat `components/rich-text/
 * mention.ts` yang membuatnya. Server hanya perlu tahu ID user yang disebut,
 * jadi parsing-nya sengaja tidak memakai parser HTML penuh.
 */

const MENTION_TAG = /<[^>]*\bdata-type\s*=\s*["']mention["'][^>]*>/gi;
const ATTR = (name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");

/** Ambil id user yang disebut di HTML dokumen (tanpa duplikat). */
export function docMentionedUserIds(bodyHtml: string | null | undefined): string[] {
  if (!bodyHtml) return [];
  const ids = new Set<string>();
  for (const tag of bodyHtml.match(MENTION_TAG) ?? []) {
    const kind = ATTR("data-mention-kind").exec(tag)?.[1]?.toLowerCase();
    // Chip tugas memakai data-id berisi id task, bukan id user.
    if (kind && kind !== "user") continue;
    const id = ATTR("data-id").exec(tag)?.[1]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}
