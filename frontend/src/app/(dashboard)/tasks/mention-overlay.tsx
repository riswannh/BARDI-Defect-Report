"use client";

import { mentionRuns } from "./task-mentions";

/**
 * Lapisan sorotan di atas Textarea deskripsi task.
 *
 * Textarea tidak bisa menata sebagian teksnya sendiri, jadi sebutan "@Nama"
 * yang sudah cocok dengan akun digambar ulang di lapisan transparan di atas
 * isian — persis seperti chip di editor Docs, supaya orang tahu sebutannya
 * berhasil dipasang. Lapisan ini `pointer-events-none`, jadi klik, kursor,
 * dan seleksi tetap masuk ke Textarea di bawahnya.
 */
export function MentionOverlay({
  text,
  users,
  scrollTop,
}: {
  text: string;
  users: Array<{ id: string; name: string }>;
  scrollTop: number;
}) {
  const runs = mentionRuns(text, users);
  if (runs.length === 0) return null;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  runs.forEach((run, index) => {
    if (run.start > cursor) {
      parts.push(<span key={`plain-${index}`}>{text.slice(cursor, run.start)}</span>);
    }
    parts.push(
      <mark
        key={`mention-${index}`}
        className="rounded-sm bg-primary/20 text-transparent"
        style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}
      >
        {text.slice(run.start, run.end)}
      </mark>
    );
    cursor = run.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-lg px-2.5 py-2 text-base whitespace-pre-wrap break-words md:text-sm"
    >
      <div
        className="text-transparent"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {parts}
      </div>
    </div>
  );
}
