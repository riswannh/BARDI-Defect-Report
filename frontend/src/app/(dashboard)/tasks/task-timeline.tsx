"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatTaskDate, isWithin, monthGrid, todayISO } from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LABEL_KEYS, type TaskRow } from "./task-types";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Kartu kalender bulanan: menandai rentang tanggal mulai → deadline tiap task. */
export function TaskTimeline({
  tasks,
  onSelect,
}: {
  tasks: TaskRow[];
  onSelect: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month };
  });

  const cells = monthGrid(cursor.year, cursor.month);

  function shift(delta: number) {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t("tasks.prevMonth")}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-heading text-sm font-semibold">
            {MONTH_NAMES[cursor.month - 1]} {cursor.year}
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t("tasks.nextMonth")}
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("tasks.timelineHint")}</p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAY_LABEL_KEYS.map((key) => (
          <div key={key} className="py-1">
            {t(key)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dayTasks = tasks.filter(
            (task) => isWithin(cell.iso, task.startDate, task.dueDate)
          );
          const isToday = cell.iso === today;
          return (
            <div
              key={cell.iso}
              className={[
                "flex min-h-20 flex-col gap-1 rounded-md border p-1 text-[11px]",
                cell.inMonth ? "border-border/70" : "border-transparent bg-muted/30 text-muted-foreground/60",
                isToday ? "ring-2 ring-primary/40" : "",
              ].join(" ")}
            >
              <span className={isToday ? "font-semibold text-primary" : ""}>{cell.day}</span>
              {dayTasks.slice(0, 2).map((task) => {
                const overdue = task.status === "Belum" && task.dueDate < today;
                const done = task.status === "Selesai";
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelect(task)}
                    title={`${task.title} · ${formatTaskDate(task.dueDate)}`}
                    className={[
                      "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left",
                      done
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : overdue
                          ? "bg-red-500/15 text-red-700 dark:text-red-300"
                          : "bg-primary/12 text-foreground",
                    ].join(" ")}
                  >
                    {task.repeatRule && <Repeat className="size-2.5 shrink-0" aria-hidden />}
                    <span className="truncate">{task.title}</span>
                  </button>
                );
              })}
              {dayTasks.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  {t("tasks.moreCount", { count: dayTasks.length - 2 })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
