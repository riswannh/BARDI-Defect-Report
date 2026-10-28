"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Repeat, Users } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { addDays, dateToISO, formatTaskDate, isWithin, isoWeekday, monthGrid, todayISO } from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LABEL_KEYS, type TaskRow } from "./task-types";

type ViewMode = "day" | "week" | "month";

interface CalendarUser {
  id: string;
  name: string;
}

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

/** Warna pembeda per pemilik task, meniru daftar kalender Google Calendar. */
const OWNER_DOTS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
];

const OWNER_EDGES = [
  "border-l-sky-500",
  "border-l-violet-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-teal-500",
  "border-l-indigo-500",
  "border-l-orange-500",
];

const VIEW_LABEL_KEYS: Record<ViewMode, TranslationKey> = {
  day: "tasks.viewDay",
  week: "tasks.viewWeek",
  month: "tasks.viewMonth",
};

function ownerIndex(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 9973;
  }
  return hash % OWNER_DOTS.length;
}

/** Kartu satu task di tampilan hari/minggu (tanpa jam, meniru Google Calendar). */
function TaskCard({
  task,
  today,
  showOwner,
  onSelect,
}: {
  task: TaskRow;
  today: string;
  showOwner: boolean;
  onSelect: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  const done = task.status === "Selesai";
  const overdue = !done && task.dueDate < today;

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      title={`${task.title} · ${formatTaskDate(task.dueDate)}`}
      className={[
        "flex w-full flex-col gap-0.5 rounded-md border border-l-4 bg-card px-1.5 py-1 text-left shadow-xs transition-colors hover:bg-accent",
        OWNER_EDGES[ownerIndex(task.userId)],
        done ? "opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "line-clamp-2 text-[11px] leading-4",
          done ? "text-muted-foreground line-through" : "font-medium",
        ].join(" ")}
      >
        {task.title}
      </span>
      <span className="flex items-center gap-1 text-[10px] leading-3 text-muted-foreground">
        {showOwner && <span className="truncate">{task.ownerName}</span>}
        {overdue && (
          <span className="shrink-0 text-red-600 dark:text-red-400">{t("tasks.overdueShort")}</span>
        )}
        {task.repeatRule && <Repeat className="size-2.5 shrink-0" aria-hidden />}
      </span>
    </button>
  );
}

/** Kalender Task Planner: panel kalender per akun + tampilan Hari/Minggu/Bulan. */
export function TaskCalendar({
  tasks,
  calendars,
  onSelect,
}: {
  tasks: TaskRow[];
  calendars: CalendarUser[];
  onSelect: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  const today = todayISO();
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(today);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  /** Daftar kalender: semua akun; kalau endpoint belum siap pakai pemilik task. */
  const owners = useMemo<CalendarUser[]>(() => {
    if (calendars.length > 0) return calendars;
    const map = new Map<string, CalendarUser>();
    for (const task of tasks) {
      if (!map.has(task.userId)) {
        map.set(task.userId, { id: task.userId, name: task.ownerName || task.userId });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [calendars, tasks]);

  const visibleOwners = owners.filter((owner) => !hidden.has(owner.id));
  const visibleTasks = tasks.filter((task) => !hidden.has(task.userId));

  function toggleOwner(id: string, checked: boolean) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function shiftAnchor(delta: number) {
    if (view === "day") {
      setAnchor(addDays(anchor, delta));
      return;
    }
    if (view === "week") {
      setAnchor(addDays(anchor, delta * 7));
      return;
    }
    const [year, month] = anchor.split("-").map(Number);
    setAnchor(dateToISO(new Date(Date.UTC(year, month - 1 + delta, 1))));
  }

  const weekStart = addDays(anchor, -(isoWeekday(anchor) - 1));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
  const periodLabel =
    view === "month"
      ? `${MONTH_NAMES[anchorMonth - 1]} ${anchorYear}`
      : view === "week"
        ? `${formatTaskDate(weekStart)} – ${formatTaskDate(addDays(weekStart, 6))}`
        : `${t(WEEKDAY_LABEL_KEYS[isoWeekday(anchor) - 1])}, ${formatTaskDate(anchor)}`;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-2 rounded-lg border p-2 lg:w-52">
        <p className="px-1 text-xs font-medium text-muted-foreground">
          {t("tasks.calendars")}{" "}
          <span className="text-foreground">
            {visibleOwners.length}/{owners.length}
          </span>
        </p>
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto lg:max-h-[340px]">
          {owners.map((owner) => {
            const checked = !hidden.has(owner.id);
            return (
              <label
                key={owner.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(event) => toggleOwner(owner.id, event.target.checked)}
                  aria-label={owner.name}
                />
                <span
                  className={[
                    "flex size-3.5 shrink-0 items-center justify-center rounded-xs border transition-colors",
                    checked
                      ? `${OWNER_DOTS[ownerIndex(owner.id)]} border-transparent`
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {checked && <Check className="size-2.5 text-white" aria-hidden />}
                </span>
                <span className="truncate">{owner.name}</span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t pt-1">
          <Button variant="ghost" size="sm" onClick={() => setHidden(new Set())}>
            {t("tasks.showAllUsers")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHidden(new Set(owners.map((owner) => owner.id)))}
          >
            {t("tasks.hideAllUsers")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t("tasks.prevPeriod")}
              onClick={() => shiftAnchor(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>
              {t("tasks.today")}
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={t("tasks.nextPeriod")}
              onClick={() => shiftAnchor(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <span className="ml-1 font-heading text-sm font-semibold">{periodLabel}</span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(Object.keys(VIEW_LABEL_KEYS) as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={view === mode ? "default" : "ghost"}
                onClick={() => setView(mode)}
              >
                {t(VIEW_LABEL_KEYS[mode])}
              </Button>
            ))}
          </div>
        </div>

        {view === "month" && (
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAY_LABEL_KEYS.map((key) => (
                <div key={key} className="py-1">
                  {t(key)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid(anchorYear, anchorMonth).map((cell) => {
                const dayTasks = visibleTasks.filter((task) =>
                  isWithin(cell.iso, task.startDate, task.dueDate)
                );
                const isToday = cell.iso === today;
                return (
                  <div
                    key={cell.iso}
                    className={[
                      "flex min-h-24 flex-col gap-1 rounded-md border p-1 text-[11px]",
                      cell.inMonth
                        ? "border-border/70"
                        : "border-transparent bg-muted/30 text-muted-foreground/60",
                      isToday ? "ring-2 ring-primary/40" : "",
                    ].join(" ")}
                  >
                    <span
                      className={
                        isToday
                          ? "flex size-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                          : ""
                      }
                    >
                      {cell.day}
                    </span>
                    {dayTasks.slice(0, 3).map((task) => {
                      const done = task.status === "Selesai";
                      const overdue = !done && task.dueDate < today;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onSelect(task)}
                          title={`${task.title} · ${formatTaskDate(task.dueDate)}`}
                          className={[
                            "flex items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left",
                            OWNER_EDGES[ownerIndex(task.userId)],
                            done
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : overdue
                                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                : "bg-muted/60 text-foreground",
                          ].join(" ")}
                        >
                          {task.repeatRule && <Repeat className="size-2.5 shrink-0" aria-hidden />}
                          <span className="truncate">{task.title}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("tasks.moreCount", { count: dayTasks.length - 3 })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((iso) => {
              const dayTasks = visibleTasks.filter((task) =>
                isWithin(iso, task.startDate, task.dueDate)
              );
              const isToday = iso === today;
              return (
                <div key={iso} className="flex min-h-[420px] flex-col gap-1 rounded-md border p-1">
                  <div
                    className={[
                      "mb-1 flex flex-col items-center rounded px-1 py-0.5 text-[11px]",
                      isToday ? "text-primary" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <span>{t(WEEKDAY_LABEL_KEYS[isoWeekday(iso) - 1])}</span>
                    <span
                      className={
                        isToday
                          ? "flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                          : ""
                      }
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                  </div>
                  {dayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} today={today} showOwner onSelect={onSelect} />
                  ))}
                  {dayTasks.length === 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">{t("tasks.noTasks")}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {view === "day" && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleOwners.length === 0 && (
                <div className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed py-10 text-xs text-muted-foreground">
                  <CalendarRange className="size-4" />
                  {t("tasks.noUsersSelected")}
                </div>
              )}
              {visibleOwners.map((owner) => {
                const dayTasks = visibleTasks.filter(
                  (task) => task.userId === owner.id && isWithin(anchor, task.startDate, task.dueDate)
                );
                return (
                  <div
                    key={owner.id}
                    data-calendar-column
                    className="flex min-h-[420px] w-48 min-w-48 shrink-0 flex-col gap-1 rounded-md border p-1"
                  >
                    <div className="mb-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px]">
                      <span
                        className={`size-2.5 shrink-0 rounded-xs ${OWNER_DOTS[ownerIndex(owner.id)]}`}
                      />
                      <span className="truncate font-medium">{owner.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {dayTasks.length}
                      </span>
                    </div>
                    {dayTasks.map((task) => (
                      <TaskCard key={task.id} task={task} today={today} showOwner={false} onSelect={onSelect} />
                    ))}
                    {dayTasks.length === 0 && (
                      <span className="px-1 text-[10px] text-muted-foreground">{t("tasks.noTasks")}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {visibleOwners.length > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="size-3.5" />
                {t("tasks.calendars")}: {visibleOwners.length}/{owners.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
