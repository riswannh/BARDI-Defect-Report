"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Funnel,
  Repeat,
  Users,
} from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import {
  addDays,
  dateToISO,
  formatTaskDate,
  isWithin,
  isoWeekday,
  monthGrid,
  monthNames,
  todayISO,
} from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ownerColor, WEEKDAY_LABEL_KEYS, type TaskOwner, type TaskRow } from "./task-types";

type ViewMode = "day" | "week" | "month";

/**
 * Warna kartu per akun (diatur sendiri di tab Pengaturan), meniru daftar
 * kalender Google Calendar. Ditaruh di context supaya kartu di dalam strip
 * minggu/bulan tidak perlu menerima daftar akun lewat berlapis-lapis props.
 */
const OwnerColorContext = createContext<TaskOwner[]>([]);

function useOwnerColor() {
  const owners = useContext(OwnerColorContext);
  return (userId: string) => ownerColor(owners, userId);
}

const VIEW_LABEL_KEYS: Record<ViewMode, TranslationKey> = {
  day: "tasks.viewDay",
  week: "tasks.viewWeek",
  month: "tasks.viewMonth",
};


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
  const { t, language } = useLanguage();
  const colorFor = useOwnerColor();
  const done = task.status === "Selesai";
  const overdue = !done && task.dueDate < today;

  return (
    <button
      type="button"
      data-task-card
      data-type-color={colorFor(task.userId)}
      onClick={() => onSelect(task)}
      title={`${task.title} · ${formatTaskDate(task.dueDate, language)}`}
      className={[
        "flex w-full flex-col gap-0.5 rounded-md border border-l-[6px] px-1.5 py-1 text-left shadow-xs transition-colors hover:bg-accent",
        done
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : overdue
            ? "bg-red-500/10 text-red-700 dark:text-red-300"
            : "bg-card text-foreground",
      ].join(" ")}
      style={{ borderLeftColor: colorFor(task.userId) }}
    >
      <span className="line-clamp-2 text-[11px] leading-4 font-medium">{task.title}</span>
      <span className="flex items-center gap-1 text-[10px] leading-3 text-muted-foreground">
        {showOwner && (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorFor(task.userId) }}
            aria-hidden
          />
        )}
        {showOwner && <span className="truncate">{task.ownerName}</span>}
        {overdue && (
          <span className="shrink-0 text-red-600 dark:text-red-400">{t("tasks.overdueShort")}</span>
        )}
        {task.repeatRule && <Repeat className="size-2.5 shrink-0" aria-hidden />}
      </span>
    </button>
  );
}

const LANE_HEIGHT = 22;

interface BarSegment {
  task: TaskRow;
  startIdx: number;
  endIdx: number;
  lane: number;
}

/**
 * Susun task satu minggu jadi batang selebar rentang tanggalnya (bukan kartu
 * terpisah di tiap hari). Task lintas minggu dipotong di tepi minggu.
 */
function layoutWeek(tasks: TaskRow[], days: string[], maxLanes: number) {
  const weekStart = days[0];
  const weekEnd = days[6];
  const laneEnds: number[] = [];
  const segments: BarSegment[] = [];
  const candidates = tasks
    .filter((task) => task.startDate <= weekEnd && task.dueDate >= weekStart)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.dueDate.localeCompare(b.dueDate)
    );

  for (const task of candidates) {
    const startIdx = task.startDate <= weekStart ? 0 : days.indexOf(task.startDate);
    const endIdx = task.dueDate >= weekEnd ? 6 : days.indexOf(task.dueDate);
    if (startIdx < 0 || endIdx < 0) continue;
    let lane = laneEnds.findIndex((end) => end < startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endIdx);
    } else {
      laneEnds[lane] = endIdx;
    }
    segments.push({ task, startIdx, endIdx, lane });
  }

  const overflow = days.map((_, index) =>
    segments.filter(
      (segment) =>
        segment.lane >= maxLanes && segment.startIdx <= index && segment.endIdx >= index
    ).length
  );

  return {
    segments: segments.filter((segment) => segment.lane < maxLanes),
    overflow,
    laneCount: Math.min(laneEnds.length, maxLanes),
  };
}

/** Satu baris minggu: 7 kolom tanggal + batang task yang membentang beberapa hari. */
function WeekStrip({
  days,
  tasks,
  today,
  maxLanes,
  height,
  large,
  onSelect,
  onMore,
}: {
  days: string[];
  tasks: TaskRow[];
  today: string;
  maxLanes: number;
  /** Tinggi strip dari sisa layar; 0 = pakai tinggi bawaan. */
  height?: number;
  large?: boolean;
  onSelect: (task: TaskRow) => void;
  onMore: (iso: string) => void;
}) {
  const { t, language } = useLanguage();
  const colorFor = useOwnerColor();
  const { segments, overflow } = layoutWeek(tasks, days, maxLanes);
  const headHeight = large ? 44 : 24;
  const rows = Math.max(maxLanes, 1);
  const hasOverflow = overflow.some((count) => count > 0);
  // Tanpa tinggi dari luar, strip memakai tinggi kapasitas lane (dipakai sebelum
  // pengukuran selesai). Dengan tinggi dari luar, strip mengikuti sisa layar.
  const fallbackHeight = headHeight + rows * LANE_HEIGHT + 18 + 6;
  const stripHeight = height && height > 0 ? height : fallbackHeight;

  return (
    <div
      data-calendar-strip
      data-strip-lanes={rows}
      className="relative shrink-0 overflow-hidden rounded-md border"
      style={{ height: large ? Math.max(420, stripHeight) : stripHeight }}
    >
      <div className="absolute inset-0 grid grid-cols-7">
        {days.map((iso) => {
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={[
                "flex flex-col items-center gap-0.5 border-r border-border/60 px-0.5 pt-1 text-[11px] last:border-r-0",
                isToday ? "bg-primary/5" : "",
              ].join(" ")}
            >
              {large && (
                <span className={isToday ? "text-primary" : "text-muted-foreground"}>
                  {t(WEEKDAY_LABEL_KEYS[isoWeekday(iso) - 1])}
                </span>
              )}
              <button
                type="button"
                onClick={() => onMore(iso)}
                title={t("tasks.openDay")}
                className={
                  isToday
                    ? "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                    : "rounded px-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              >
                {Number(iso.slice(8, 10))}
              </button>
            </div>
          );
        })}
      </div>

      {segments.map((segment) => {
        const done = segment.task.status === "Selesai";
        const overdue = !done && segment.task.dueDate < today;
        return (
          <button
            key={segment.task.id}
            type="button"
            data-task-bar
            data-type-color={colorFor(segment.task.userId)}
            onClick={() => onSelect(segment.task)}
            title={`${segment.task.title} · ${formatTaskDate(segment.task.startDate, language)} – ${formatTaskDate(segment.task.dueDate, language)}`}
            className={[
              "absolute flex h-[18px] items-center gap-1 truncate rounded-sm border-l-[4px] px-1 text-left text-[10px] leading-none",
              done
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : overdue
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : "bg-muted/70 text-foreground hover:bg-accent",
            ].join(" ")}
            style={{
              left: `calc(${(segment.startIdx / 7) * 100}% + 2px)`,
              width: `calc(${((segment.endIdx - segment.startIdx + 1) / 7) * 100}% - 4px)`,
              top: headHeight + segment.lane * LANE_HEIGHT,
              borderLeftColor: colorFor(segment.task.userId),
            }}
          >
            {segment.task.repeatRule && <Repeat className="size-2.5 shrink-0" aria-hidden />}
            <span className="truncate">{segment.task.title}</span>
          </button>
        );
      })}

      {hasOverflow &&
        days.map((iso, index) =>
          overflow[index] > 0 ? (
            <button
              key={`more-${iso}`}
              type="button"
              onClick={() => onMore(iso)}
              className="absolute truncate text-left text-[10px] text-muted-foreground hover:text-foreground hover:underline"
              style={{
                left: `${(index / 7) * 100}%`,
                width: `${100 / 7}%`,
                top: headHeight + rows * LANE_HEIGHT,
                paddingLeft: 4,
              }}
            >
              {t("tasks.moreCount", { count: overflow[index] })}
            </button>
          ) : null
        )}
    </div>
  );
}

/** Kalender Task Planner: panel kalender per akun + tampilan Hari/Minggu/Bulan. */
export function TaskCalendar({
  tasks,
  calendars,
  onSelect,
}: {
  tasks: TaskRow[];
  calendars: TaskOwner[];
  onSelect: (task: TaskRow) => void;
}) {
  const { t, language } = useLanguage();
  const today = todayISO();
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(today);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number(today.slice(0, 4)));
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");

  const areaRef = useRef<HTMLDivElement | null>(null);
  const [areaHeight, setAreaHeight] = useState(0);

  // Kalender selalu setinggi sisa layar: ukur area yang tersedia lalu bagi ke
  // baris minggu. Diukur lewat ResizeObserver (callback, bukan body effect)
  // supaya tidak melanggar aturan react-hooks/set-state-in-effect.
  useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setAreaHeight(Math.round(entries[0]?.contentRect.height ?? 0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Daftar kalender: semua akun; kalau endpoint belum siap pakai pemilik task. */
  const owners = useMemo<TaskOwner[]>(() => {
    if (calendars.length > 0) return calendars;
    const map = new Map<string, TaskOwner>();
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

  /** Lompat ke bulan/tahun tertentu dari pemilih judul. */
  function pickMonth(year: number, month: number) {
    setAnchor(`${year}-${String(month).padStart(2, "0")}-01`);
    setPickerOpen(false);
  }

  /** Tekan "+N more": buka tampilan Hari pada tanggal itu. */
  function jumpToDay(iso: string) {
    setAnchor(iso);
    setView("day");
  }

  const weekStart = addDays(anchor, -(isoWeekday(anchor) - 1));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
  // Bulan dibagi per minggu supaya tiap baris bisa memuat batang lintas hari.
  const monthWeeks = monthGrid(anchorYear, anchorMonth).reduce<string[][]>(
    (weeks, cell, index) => {
      if (index % 7 === 0) weeks.push([]);
      weeks[weeks.length - 1].push(cell.iso);
      return weeks;
    },
    []
  );
  // Tinggi kalender tidak boleh berubah antar bulan/tahun: selalu 6 baris minggu.
  while (monthWeeks.length < 6) {
    const lastDay = monthWeeks[monthWeeks.length - 1][6];
    monthWeeks.push(Array.from({ length: 7 }, (_, index) => addDays(lastDay, index + 1)));
  }

  // Tinggi dinamis: kalender memakai sisa layar, jadi tidak perlu scroll. Di
  // layar sangat pendek baris tetap setinggi MIN_STRIP dan area kalender yang
  // menggulir sendiri (bukan halaman).
  const STRIP_GAP = 4;
  const MONTH_HEAD = 26;
  const MIN_STRIP = 70;
  const monthStripHeight = areaHeight
    ? Math.max(MIN_STRIP, Math.floor((areaHeight - MONTH_HEAD - STRIP_GAP * 5) / 6))
    : 0;
  const monthLanes = monthStripHeight
    ? Math.max(1, Math.floor((monthStripHeight - 24 - 24) / LANE_HEIGHT))
    : 4;
  const weekLanes = areaHeight
    ? Math.max(2, Math.floor((areaHeight - 44 - 24) / LANE_HEIGHT))
    : 12;
  const dayColumnHeight = areaHeight ? Math.max(160, areaHeight - 24) : 420;

  const periodLabel =
    view === "month"
      ? `${monthNames(language)[anchorMonth - 1]} ${anchorYear}`
      : view === "week"
        ? `${formatTaskDate(weekStart, language)} – ${formatTaskDate(addDays(weekStart, 6), language)}`
        : `${t(WEEKDAY_LABEL_KEYS[isoWeekday(anchor) - 1])}, ${formatTaskDate(anchor, language)}`;

  return (
    <OwnerColorContext.Provider value={owners}>
      <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("tasks.prevPeriod")}
              onClick={() => shiftAnchor(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPickerYear(Number(anchor.slice(0, 4)));
                  setPickerMode("month");
                  setPickerOpen((open) => !open);
                }}
                className="min-w-32 rounded-md px-2 py-1 text-center font-heading text-sm font-semibold hover:bg-muted"
              >
                {periodLabel}
              </button>
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
                  <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border bg-popover p-2 shadow-md">
                    <div className="mb-1 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={pickerMode === "month" ? t("tasks.prevYear") : t("tasks.prevYears")}
                        onClick={() =>
                          setPickerYear((year) => year - (pickerMode === "month" ? 1 : 12))
                        }
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <button
                        type="button"
                        onClick={() => setPickerMode((mode) => (mode === "month" ? "year" : "month"))}
                        className="rounded-md px-2 py-0.5 font-heading text-sm font-semibold hover:bg-muted"
                      >
                        {pickerMode === "month"
                          ? pickerYear
                          : `${Math.floor(pickerYear / 12) * 12} – ${Math.floor(pickerYear / 12) * 12 + 11}`}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={pickerMode === "month" ? t("tasks.nextYear") : t("tasks.nextYears")}
                        onClick={() =>
                          setPickerYear((year) => year + (pickerMode === "month" ? 1 : 12))
                        }
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    {pickerMode === "year" ? (
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, index) => Math.floor(pickerYear / 12) * 12 + index).map(
                          (year) => (
                            <button
                              key={year}
                              type="button"
                              onClick={() => {
                                setPickerYear(year);
                                setPickerMode("month");
                              }}
                              className={cn(
                                "rounded-md px-1 py-1.5 text-xs hover:bg-muted",
                                anchor.slice(0, 4) === String(year) &&
                                  "bg-primary text-primary-foreground hover:bg-primary"
                              )}
                            >
                              {year}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1">
                        {monthNames(language).map((name, index) => {
                          const value = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => pickMonth(pickerYear, index + 1)}
                              className={cn(
                                "rounded-md px-1 py-1.5 text-xs hover:bg-muted",
                                anchor.slice(0, 7) === value &&
                                  "bg-primary text-primary-foreground hover:bg-primary"
                              )}
                            >
                              {name.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("tasks.nextPeriod")}
              onClick={() => shiftAnchor(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 text-muted-foreground"
              onClick={() => setAnchor(today)}
            >
              {t("tasks.today")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" className="mr-1 gap-1.5" />}
              >
                <Funnel className="size-3.5" />
                {t("tasks.filter")}
                <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                  {visibleOwners.length}/{owners.length}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                  {t("tasks.calendars")}{" "}
                  <span className="text-foreground">
                    {visibleOwners.length}/{owners.length}
                  </span>
                </p>
                <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
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
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                            checked ? "border-transparent" : "border-muted-foreground/40",
                          ].join(" ")}
                          style={
                            checked ? { backgroundColor: ownerColor(owners, owner.id) } : undefined
                          }
                        >
                          {checked && <Check className="size-3 text-white" aria-hidden />}
                        </span>
                        <span className="truncate">{owner.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-1 flex items-center gap-1 border-t pt-1">
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
              </DropdownMenuContent>
            </DropdownMenu>
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
            {/* Legenda warna card ikut baris toolbar supaya kalender dapat sisa layar. */}
            <span className="ml-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-xs bg-red-500/70" aria-hidden />
                {t("tasks.legendOverdue")}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-xs bg-emerald-500/70" aria-hidden />
                {t("tasks.legendDone")}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-xs bg-muted-foreground/40" aria-hidden />
                {t("tasks.legendProgress")}
              </span>
            </span>
          </div>
        </div>

        <div
          ref={areaRef}
          data-calendar-area
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
        >
          {view === "month" && (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
                {WEEKDAY_LABEL_KEYS.map((key) => (
                  <div key={key} className="py-1">
                    {t(key)}
                  </div>
                ))}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1">
                {monthWeeks.map((days) => (
                  <WeekStrip
                    key={days[0]}
                    days={days}
                    tasks={visibleTasks}
                    today={today}
                    maxLanes={monthLanes}
                    height={monthStripHeight}
                    onSelect={onSelect}
                    onMore={jumpToDay}
                  />
                ))}
              </div>
            </>
          )}

          {view === "week" && (
            <WeekStrip
              days={weekDays}
              tasks={visibleTasks}
              today={today}
              maxLanes={weekLanes}
              height={areaHeight}
              large
              onSelect={onSelect}
              onMore={jumpToDay}
            />
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
                    className="flex w-48 min-w-48 shrink-0 flex-col gap-1 overflow-y-auto rounded-md border p-1"
                    style={{ height: dayColumnHeight }}
                  >
                    <div className="mb-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px]">
                      <span
                        className="size-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: ownerColor(owners, owner.id) }}
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
      </div>
    </OwnerColorContext.Provider>
  );
}
