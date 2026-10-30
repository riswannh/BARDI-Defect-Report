"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  FileText,
  ListChecks,
  Users,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { addDays, dateToISO, formatTaskDate, todayISO } from "@/lib/task-dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  typeName,
  PRIORITIES,
  PRIORITY_LABEL_KEYS,
  STATUS_LABEL_KEYS,
  TASK_STATUSES,
  priorityTone,
  statusTone,
  type TaskActivityRow,
  type TaskRow,
  type TaskTypeRow,
} from "./task-types";

const DAY = 86_400_000;
/** Jumlah baris per halaman di kartu ringkasan (Jenis pekerjaan & Aktivitas). */
const SUMMARY_PAGE = 5;

function toDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

function within(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const diff = daysBetween(toDate(String(iso).slice(0, 10)), toDate(todayISO()));
  return Math.abs(diff) <= days;
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Pager kecil untuk kartu ringkasan: hanya panah + nomor halaman. */
function MiniPager({
  page,
  pages,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
      <button
        type="button"
        aria-label={prevLabel}
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded p-0.5 hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="tabular-nums">
        {page}/{pages}
      </span>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={page >= pages}
        className="rounded p-0.5 hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </span>
  );
}

export function TaskSummaryView({  rows,
  activities,
  types,
  onOpen,
}: {
  rows: TaskRow[];
  activities: TaskActivityRow[];
  types: TaskTypeRow[];
  onOpen: (task: TaskRow) => void;
}) {
  const { t, language } = useLanguage();
  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const [typePage, setTypePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const stats = useMemo(() => {
    const done = rows.filter((task) => task.status === "Selesai").length;
    const progress = rows.filter((task) => task.status === "Proses").length;
    const open = rows.filter((task) => task.status === "Belum").length;
    const created = rows.filter((task) => within(task.createdAt, 7)).length;
    const updated = rows.filter((task) => within(task.updatedAt, 7)).length;
    const dueSoon = rows.filter(
      (task) => task.status !== "Selesai" && within(task.dueDate, 7)
    ).length;
    const byPriority = PRIORITIES.map((priority) => ({
      priority,
      count: rows.filter((task) => task.priority === priority).length,
    }));
    // Daftar tipe ikut master; kode lama yang sudah tak ada tetap dihitung.
    const typeCodes = [
      ...types.map((item) => item.code),
      ...Array.from(new Set(rows.map((task) => task.issueType || "task"))).filter(
        (code) => !types.some((item) => item.code === code)
      ),
    ];
    const byType = typeCodes.map((type) => ({
      type,
      count: rows.filter((task) => (task.issueType || "task") === type).length,
    }));
    const owners = new Map<string, number>();
    for (const task of rows) {
      const key = task.ownerName || t("tasks.colOwner");
      owners.set(key, (owners.get(key) ?? 0) + 1);
    }
    const workload = Array.from(owners.entries()).sort((a, b) => b[1] - a[1]);
    return {
      done,
      progress,
      open,
      created,
      updated,
      dueSoon,
      byPriority,
      byType,
      workload,
      maxPriority: Math.max(1, ...byPriority.map((item) => item.count)),
      maxType: Math.max(1, ...byType.map((item) => item.count)),
    };
  }, [rows, t, types]);

  const total = rows.length || 1;
  const segments = [
    { status: "Selesai", count: stats.done, tone: "bg-emerald-500" },
    { status: "Proses", count: stats.progress, tone: "bg-blue-500" },
    { status: "Belum", count: stats.open, tone: "bg-slate-400" },
  ];

  const typePages = Math.max(1, Math.ceil(stats.byType.length / SUMMARY_PAGE));
  const typePageSafe = Math.min(typePage, typePages);
  const typeRows = stats.byType.slice(
    (typePageSafe - 1) * SUMMARY_PAGE,
    typePageSafe * SUMMARY_PAGE
  );
  const activityPages = Math.max(1, Math.ceil(activities.length / SUMMARY_PAGE));
  const activityPageSafe = Math.min(activityPage, activityPages);
  const activityRows = activities.slice(
    (activityPageSafe - 1) * SUMMARY_PAGE,
    activityPageSafe * SUMMARY_PAGE
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("tasks.kpiCreated"), value: stats.created, hint: t("tasks.kpiWeekHint") },
          { label: t("tasks.kpiUpdated"), value: stats.updated, hint: t("tasks.kpiWeekHint") },
          { label: t("tasks.kpiDone"), value: stats.done, hint: t("tasks.kpiWeekHint") },
          { label: t("tasks.kpiDueSoon"), value: stats.dueSoon, hint: t("tasks.kpiNextWeek") },
        ].map((item) => (
          <Card key={item.label} size="sm">
            <CardContent className="flex flex-col gap-0.5 py-3">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{item.value}</span>
              <span className="text-[11px] text-muted-foreground">{item.hint}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card size="sm" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CircleDashed className="size-4 text-muted-foreground" />
              {t("tasks.sectionStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {segments.map((segment) => (
                <div
                  key={segment.status}
                  className={cn("h-full transition-all", segment.tone)}
                  style={{ width: `${(segment.count / total) * 100}%` }}
                  title={`${t(STATUS_LABEL_KEYS[segment.status])}: ${segment.count}`}
                  onMouseEnter={() => setHoverStatus(segment.status)}
                  onMouseLeave={() => setHoverStatus(null)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {segments.map((segment) => (
                <span
                  key={segment.status}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5",
                    hoverStatus === segment.status ? "bg-muted" : ""
                  )}
                >
                  <span className={cn("size-2 rounded-full", segment.tone)} />
                  {t(STATUS_LABEL_KEYS[segment.status])}
                  <span className="font-semibold tabular-nums">{segment.count}</span>
                </span>
              ))}
              <span className="ml-auto text-muted-foreground">
                {t("tasks.total")} <span className="font-semibold text-foreground">{rows.length}</span>
              </span>
            </div>
            <div className="flex flex-col divide-y">
              {rows.slice(0, 6).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpen(task)}
                  className="flex items-center gap-2 py-1.5 text-left text-xs hover:text-primary"
                >
                  <span className="truncate font-medium">{task.title}</span>
                  <Badge variant="outline" className={cn("ml-auto shrink-0", statusTone(task.status))}>
                    {t(STATUS_LABEL_KEYS[task.status] ?? "tasks.statusOpen")}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              {t("tasks.sectionPriority")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {stats.byPriority.map((item) => (
              <div key={item.priority} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{t(PRIORITY_LABEL_KEYS[item.priority])}</span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <Bar value={item.count} max={stats.maxPriority} tone="bg-amber-400" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4 text-muted-foreground" />
              {t("tasks.sectionTypes")}
            </CardTitle>
            <MiniPager
              page={typePageSafe}
              pages={typePages}
              onPrev={() => setTypePage(Math.max(1, typePageSafe - 1))}
              onNext={() => setTypePage(Math.min(typePages, typePageSafe + 1))}
              prevLabel={t("tasks.prevPeriod")}
              nextLabel={t("tasks.nextPeriod")}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {typeRows.map((item) => (
              <div key={item.type} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {typeName(types, item.type)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <Bar value={item.count} max={stats.maxType} tone="bg-blue-400" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              {t("tasks.sectionWorkload")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {stats.workload.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("tasks.empty")}</p>
            )}
            {stats.workload.slice(0, 6).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
                  {name.slice(0, 2)}
                </span>
                <span className="truncate">{name}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              {t("tasks.sectionActivity")}
            </CardTitle>
            <MiniPager
              page={activityPageSafe}
              pages={activityPages}
              onPrev={() => setActivityPage(Math.max(1, activityPageSafe - 1))}
              onNext={() => setActivityPage(Math.min(activityPages, activityPageSafe + 1))}
              prevLabel={t("tasks.prevPeriod")}
              nextLabel={t("tasks.nextPeriod")}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {activities.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("tasks.logEmpty")}</p>
            )}
            {activityRows.map((activity) => (
              <div key={activity.id} className="flex flex-col gap-0.5 border-b pb-2 text-xs last:border-0 last:pb-0">
                <span className="font-medium">{activity.taskTitle || t("tasks.logTitle")}</span>
                <span className="text-[11px] text-muted-foreground">
                  {activity.actorName} · {formatTaskDate(String(activity.createdAt ?? ""), language)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TaskBoardView({
  rows,
  types,
  onOpen,
  onStatusChange,
}: {
  rows: TaskRow[];
  types: TaskTypeRow[];
  onOpen: (task: TaskRow) => void;
  onStatusChange?: (task: TaskRow, status: string) => void;
}) {
  const { t } = useLanguage();
  const columns = TASK_STATUSES.map((status) => ({
    status,
    items: rows
      .filter((task) => task.status === status)
      .sort((a, b) => (a.boardOrder || 0) - (b.boardOrder || 0)),
  }));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {columns.map((column, index) => (
        <div key={column.status} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-2">
          <div className="flex items-center gap-2 px-1 py-0.5">
            <span
              className={cn(
                "size-2 rounded-full",
                column.status === "Selesai"
                  ? "bg-emerald-500"
                  : column.status === "Proses"
                    ? "bg-blue-500"
                    : "bg-slate-400"
              )}
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(STATUS_LABEL_KEYS[column.status])}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{column.items.length}</span>
          </div>

          {column.items.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">{t("tasks.noTasks")}</p>
          )}

          {column.items.map((task) => (
            <div
              key={task.id}
              className="group flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 shadow-xs"
            >
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex flex-col items-start gap-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  #{task.id}
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", priorityTone(task.priority))}>
                    {t(PRIORITY_LABEL_KEYS[task.priority] ?? "tasks.priorityNormal")}
                  </Badge>
                </span>
                <span className="line-clamp-2 text-sm font-medium">{task.title}</span>
              </button>

              <span className="inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {typeName(types, task.issueType, task.userId)}
              </span>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase">
                  {(task.ownerName || "?").slice(0, 2)}
                </span>
                <span className="truncate">{task.ownerName || "—"}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatTaskDate(task.dueDate)}
                </span>
              </div>

              {onStatusChange && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("tasks.movePrev")}
                    disabled={index === 0}
                    onClick={() => onStatusChange(task, TASK_STATUSES[index - 1])}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("tasks.moveNext")}
                    disabled={index === TASK_STATUSES.length - 1}
                    onClick={() => onStatusChange(task, TASK_STATUSES[index + 1])}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TaskTimelineView({
  rows,
  onOpen,
}: {
  rows: TaskRow[];
  onOpen: (task: TaskRow) => void;
}) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const rangeStart = useMemo(() => addDays(dateToISO(startOfWeek(toDate(todayISO()))), offset * 7), [offset]);
  const rangeDays = 56;
  const startDate = toDate(rangeStart);
  const endDate = addDays(rangeStart, rangeDays - 1);
  const todayOffset = daysBetween(startDate, toDate(todayISO()));

  const visible = rows
    .map((task) => {
      const from = daysBetween(startDate, toDate(task.startDate));
      const to = daysBetween(startDate, toDate(task.dueDate));
      return { task, from, to };
    })
    .filter((item) => item.to >= 0 && item.from <= rangeDays - 1)
    .sort((a, b) => a.from - b.from);

  const weeks = Array.from({ length: rangeDays / 7 }, (_, index) => addDays(rangeStart, index * 7));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft className="size-4" />
          {t("tasks.prevMonth")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOffset(0)}
          disabled={offset === 0}
        >
          {t("tasks.today")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOffset(offset + 1)}>
          {t("tasks.nextMonth")}
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">
          {formatTaskDate(rangeStart)} – {formatTaskDate(endDate)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[200px_1fr] border-b bg-muted/40 text-[11px] font-medium text-muted-foreground">
            <div className="px-3 py-1.5">{t("tasks.colWork")}</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${rangeDays / 7}, minmax(0, 1fr))` }}>
              {weeks.map((week) => (
                <div key={week} className="border-l px-2 py-1.5">
                  {formatTaskDate(week)}
                </div>
              ))}
            </div>
          </div>

          {visible.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">{t("tasks.timelineEmpty")}</p>
          )}

          {visible.map(({ task, from, to }) => {
            const left = Math.max(0, from) / rangeDays;
            const width = (Math.min(rangeDays - 1, to) - Math.max(0, from) + 1) / rangeDays;
            return (
              <div key={task.id} className="grid grid-cols-[200px_1fr] border-b text-xs last:border-0">
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="flex min-w-0 items-center gap-1.5 px-3 py-2 text-left hover:text-primary"
                >
                  <span className="truncate font-medium">{task.title}</span>
                </button>
                <div className="relative py-2">
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${rangeDays / 7}, minmax(0, 1fr))` }}
                  >
                    {weeks.map((week) => (
                      <span key={week} className="border-l" />
                    ))}
                  </div>
                  {todayOffset >= 0 && todayOffset < rangeDays && (
                    <span
                      className="pointer-events-none absolute inset-y-0 w-px bg-primary/60"
                      style={{ left: `${(todayOffset / rangeDays) * 100}%` }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(task)}
                    className={cn(
                      "absolute inset-y-1.5 flex items-center overflow-hidden rounded-full px-2 text-[10px] font-medium text-white",
                      task.status === "Selesai"
                        ? "bg-emerald-500"
                        : task.status === "Proses"
                          ? "bg-blue-500"
                          : "bg-slate-400"
                    )}
                    style={{ left: `${left * 100}%`, width: `${Math.max(width * 100, 3)}%` }}
                    title={`${task.title} · ${formatTaskDate(task.startDate)} – ${formatTaskDate(task.dueDate)}`}
                  >
                    <span className="truncate">
                      {task.progress > 0 ? `${task.progress}%` : t(STATUS_LABEL_KEYS[task.status] ?? "tasks.statusOpen")}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
