"use client";

import { useImperativeHandle, useState } from "react";
import { ListTodo, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MentionItem } from "./mention";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Popup `@` (dirender di luar dialog lewat portal Tiptap). Navigasi panah,
 * Enter memilih, Escape ditangani editor. `index` di-clamp saat daftar
 * menyusut supaya tidak ada state yang hilang/muncul di effect.
 */
export function MentionList({
  ref,
  items,
  loading,
  command,
}: {
  ref?: React.Ref<MentionListRef>;
  items: MentionItem[];
  loading: boolean;
  command: (item: MentionItem) => void;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const active = items.length > 0 ? Math.min(index, items.length - 1) : 0;

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command(items[active]);
          return true;
        }
        return false;
      },
    }),
    [items, active, command]
  );

  const users = items.filter((item) => item.kind === "user");
  const tasks = items.filter((item) => item.kind === "task");
  // Indeks baris dihitung, bukan diakumulasi di dalam render: daftar orang dan
  // daftar tugas berbagi satu indeks aktif yang sama.
  const taskOffset = users.length;

  return (
    <div
      role="listbox"
      data-slot="mention-list"
      className="max-h-72 w-72 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      {loading && items.length === 0 && (
        <p className="px-2 py-3 text-xs text-muted-foreground">{t("docs.mentionLoading")}</p>
      )}
      {!loading && items.length === 0 && (
        <p className="px-2 py-3 text-xs text-muted-foreground">{t("docs.mentionEmpty")}</p>
      )}
      {users.length > 0 && (
        <p className="px-2 pt-1 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("docs.mentionUsers")}
        </p>
      )}
      {users.map((item, index) => (
        <MentionRow
          key={`user-${item.id}`}
          item={item}
          active={index === active}
          onClick={() => command(item)}
        />
      ))}
      {tasks.length > 0 && (
        <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("docs.mentionTasks")}
        </p>
      )}
      {tasks.map((item, index) => (
        <MentionRow
          key={`task-${item.id}`}
          item={item}
          active={taskOffset + index === active}
          onClick={() => command(item)}
        />
      ))}
    </div>
  );
}

function MentionRow({
  item,
  active,
  onClick,
}: {
  item: MentionItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.kind === "task" ? ListTodo : UserRound;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-mention-item={item.kind}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
        active && "bg-muted"
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{item.label}</span>
        {item.detail && <span className="truncate text-[11px] text-muted-foreground">{item.detail}</span>}
      </span>
    </button>
  );
}
