"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "./sanitize";

/**
 * Pembaca isi dokumentasi. HTML disimpan apa adanya di database, jadi
 * disanitasi di sini — satu-satunya tempat HTML itu dirender.
 * Chip tugas bisa diklik untuk membuka dialog Rincian Tugas.
 */
export function RichTextContent({
  html,
  emptyText,
  onOpenTask,
  className,
}: {
  html: string;
  emptyText: string;
  onOpenTask?: (id: string) => void;
  className?: string;
}) {
  const clean = useMemo(() => sanitizeRichText(html), [html]);

  if (!clean) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div
      data-slot="rich-text-content"
      className={cn("rich-text text-sm", className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const chip = target.closest('[data-mention-kind="task"]');
        const id = chip?.getAttribute("data-id");
        if (!id || !onOpenTask) return;
        event.preventDefault();
        onOpenTask(id);
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
