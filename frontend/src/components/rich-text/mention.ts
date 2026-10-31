"use client";

import Mention from "@tiptap/extension-mention";
import { renderMentionPopup } from "./mention-popup";

export type MentionKind = "user" | "task";

/** Satu baris di popup `@`: orang atau tugas. */
export interface MentionItem {
  kind: MentionKind;
  id: string;
  /** Nama orang atau judul tugas yang tampil di chip. */
  label: string;
  /** Baris kecil di popup: @username, atau status + pemilik tugas. */
  detail: string;
}

interface MentionPayload {
  users: Array<{ id: string; name: string; username: string }>;
  tasks: Array<{ id: number; title: string; status: string; ownerName: string }>;
}

async function fetchItems(query: string, signal: AbortSignal): Promise<MentionItem[]> {
  const response = await fetch(`/api/tasks/mentions?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) return [];
  const payload = (await response.json()) as MentionPayload;
  return [
    ...payload.users.map<MentionItem>((user) => ({
      kind: "user",
      id: user.id,
      label: user.name || user.username,
      detail: user.username ? `@${user.username}` : "",
    })),
    ...payload.tasks.map<MentionItem>((task) => ({
      kind: "task",
      id: String(task.id),
      label: task.title,
      detail: [task.status, task.ownerName].filter(Boolean).join(" · "),
    })),
  ];
}

/**
 * Ekstensi `@`: orang dan tugas. Atribut chip yang disimpan di HTML —
 * `data-type="mention"`, `data-id`, `data-label`, `data-mention-kind` —
 * adalah kontrak yang dipakai pembaca dokumen untuk membuka detail tugas.
 */
export const mentionExtension = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: "user",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-mention-kind") ?? "user",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-mention-kind": String(attributes.kind ?? "user"),
        }),
      },
    };
  },
}).configure({
  HTMLAttributes: { class: "mention-chip" },
  suggestion: {
    char: "@",
    allowSpaces: true,
    // Spasi mencegah email "nama@domain" memicu popup; awal baris tetap boleh
    // karena tiptap mengizinkan prefix kosong.
    allowedPrefixes: [" "],
    debounce: 150,
    items: ({ query, signal }) => fetchItems(query, signal),
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "mention", attrs: props },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: renderMentionPopup,
  },
});
