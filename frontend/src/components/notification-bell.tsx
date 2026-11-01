"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  actorName: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
}

/** Selang penyegaran lonceng; cukup sering untuk terasa hidup, hemat request. */
const POLL_MS = 60_000;

/** "5 menit lalu" / "2 jam lalu" / tanggal untuk yang lebih lama. */
function relativeTime(value: string, locale: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Lonceng notifikasi header. Sumber notifikasi saat ini hanya Task Planner:
 * mention (`@`) di Mading Dokumentasi dan mention di deskripsi task.
 *
 * Data disegarkan tiap menit dan setiap kali panel dibuka; menandai sudah
 * dibaca dikirim ke server supaya badge tidak kembali setelah muat ulang.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const router = useRouter();
  const [feed, setFeed] = useState<NotificationFeed>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<NotificationFeed>("/api/notifications");
      setFeed(data);
    } catch {
      // Loncatkan saja: lonceng tidak boleh mengganggu halaman bila server
      // sedang sibuk atau jaringan putus.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // Muat pertama ditunda ke timer supaya setState tidak terjadi sinkron di
    // badan effect (aturan react-hooks/set-state-in-effect).
    const kick = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [user, load]);

  if (!user) return null;

  const unread = feed.unread;

  const label = (item: NotificationItem) => {
    if (item.kind === "doc-mention") return t("notif.docMention", { title: item.title });
    if (item.kind === "task-mention") return t("notif.taskMention", { title: item.title });
    return item.title;
  };

  const openItem = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.readAt) {
      setFeed((current) => ({
        unread: Math.max(0, current.unread - 1),
        items: current.items.map((row) =>
          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
        ),
      }));
      await apiPost("/api/notifications/read", { id: item.id }).catch(() => {});
    }
    if (item.href) router.push(item.href);
  };

  const markAll = async () => {
    setFeed((current) => ({
      unread: 0,
      items: current.items.map((row) => ({
        ...row,
        readAt: row.readAt ?? new Date().toISOString(),
      })),
    }));
    await apiPost("/api/notifications/read", { all: true }).catch(() => {});
  };

  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void load();
    }}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={t("notif.bell")}
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">{t("notif.title")}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAll()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              {t("notif.markAll")}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {feed.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("notif.empty")}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {feed.items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => void openItem(item)}
                className="items-start gap-2 py-2"
              >
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    item.readAt ? "bg-transparent" : "bg-primary"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      item.readAt ? "font-normal" : "font-medium"
                    }`}
                  >
                    {label(item)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.body ? `${item.body} · ` : ""}
                    {relativeTime(item.createdAt, language)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
