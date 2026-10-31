"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  FileText,
  ListChecks,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatTaskDate, todayISO } from "@/lib/task-dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  typeName,
  DIFFICULTY_LABEL_KEYS,
  PRIORITIES,
  PRIORITY_LABEL_KEYS,
  STATUS_LABEL_KEYS,
  TASK_STATUSES,
  priorityTone,
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

export type QuickFilterKey = "created" | "updated" | "done" | "dueSoon";

/** Predikat kartu KPI Ringkasan — dipakai juga oleh filter cepat tab Daftar. */
export function matchesQuickFilter(task: TaskRow, key: QuickFilterKey): boolean {
  if (key === "created") return within(task.createdAt, 7);
  if (key === "updated") return within(task.updatedAt, 7);
  if (key === "done") return task.status === "Selesai";
  return task.status !== "Selesai" && within(task.dueDate, 7);
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

export function TaskSummaryView({
  rows,
  activities,
  types,
  onQuickFilter,
  onQuickStatus,
  onQuickPriority,
  onQuickType,
  onActivity,
}: {
  rows: TaskRow[];
  activities: TaskActivityRow[];
  types: TaskTypeRow[];
  onQuickFilter?: (key: QuickFilterKey) => void;
  onQuickStatus?: (status: string) => void;
  onQuickPriority?: (priority: string) => void;
  onQuickType?: (code: string) => void;
  onActivity?: (taskId: number | null) => void;
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
      // Beban tim = task yang masih dikerjakan saja (selesai tidak dihitung).
      if (task.status === "Selesai") continue;
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
          { key: "created" as const, label: t("tasks.kpiCreated"), value: stats.created, hint: t("tasks.kpiWeekHint") },
          { key: "updated" as const, label: t("tasks.kpiUpdated"), value: stats.updated, hint: t("tasks.kpiWeekHint") },
          { key: "done" as const, label: t("tasks.kpiDone"), value: stats.done, hint: t("tasks.kpiWeekHint") },
          { key: "dueSoon" as const, label: t("tasks.kpiDueSoon"), value: stats.dueSoon, hint: t("tasks.kpiNextWeek") },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onQuickFilter?.(item.key)}
            className="group text-left"
            aria-label={`${item.label}: ${item.value}`}
          >
            <Card
              size="sm"
              className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30"
            >
              <CardContent className="flex flex-col gap-0.5 py-3">
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                <span className="text-2xl font-semibold tabular-nums">{item.value}</span>
                <span className="text-[11px] text-muted-foreground">{item.hint}</span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
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
                <button
                  key={segment.status}
                  type="button"
                  aria-label={`${t(STATUS_LABEL_KEYS[segment.status])}: ${segment.count}`}
                  className={cn("h-full cursor-pointer transition-all hover:opacity-80", segment.tone)}
                  style={{ width: `${(segment.count / total) * 100}%` }}
                  title={`${t(STATUS_LABEL_KEYS[segment.status])}: ${segment.count}`}
                  onClick={() => onQuickStatus?.(segment.status)}
                  onMouseEnter={() => setHoverStatus(segment.status)}
                  onMouseLeave={() => setHoverStatus(null)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {segments.map((segment) => (
                <button
                  key={segment.status}
                  type="button"
                  aria-label={`${t(STATUS_LABEL_KEYS[segment.status])}: ${segment.count}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors hover:bg-muted",
                    hoverStatus === segment.status ? "bg-muted" : ""
                  )}
                  onClick={() => onQuickStatus?.(segment.status)}
                  onMouseEnter={() => setHoverStatus(segment.status)}
                  onMouseLeave={() => setHoverStatus(null)}
                >
                  <span className={cn("size-2 rounded-full", segment.tone)} />
                  {t(STATUS_LABEL_KEYS[segment.status])}
                  <span className="font-semibold tabular-nums">{segment.count}</span>
                </button>
              ))}
              <span className="ml-auto text-muted-foreground">
                {t("tasks.total")} <span className="font-semibold text-foreground">{rows.length}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              {t("tasks.sectionPriority")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {stats.byPriority.map((item) => (
              <button
                key={item.priority}
                type="button"
                aria-label={`${t(PRIORITY_LABEL_KEYS[item.priority])}: ${item.count}`}
                onClick={() => onQuickPriority?.(item.priority)}
                className="flex flex-col gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center justify-between text-xs">
                  <span>{t(PRIORITY_LABEL_KEYS[item.priority])}</span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </span>
                <Bar value={item.count} max={stats.maxPriority} tone="bg-amber-400" />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4 text-muted-foreground" />
              {t("tasks.sectionTypes")}
            </CardTitle>
            {typePages > 1 && (
              <MiniPager
                page={typePageSafe}
                pages={typePages}
                onPrev={() => setTypePage(Math.max(1, typePageSafe - 1))}
                onNext={() => setTypePage(Math.min(typePages, typePageSafe + 1))}
                prevLabel={t("tasks.prevPeriod")}
                nextLabel={t("tasks.nextPeriod")}
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {typeRows.map((item) => (
              <button
                key={item.type}
                type="button"
                aria-label={`${typeName(types, item.type)}: ${item.count}`}
                onClick={() => onQuickType?.(item.type)}
                className="flex flex-col gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">{typeName(types, item.type)}</span>
                  <span className="tabular-nums text-muted-foreground">{item.count}</span>
                </span>
                <Bar value={item.count} max={stats.maxType} tone="bg-blue-400" />
              </button>
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
          <CardContent className="flex min-h-[10rem] flex-col gap-2">
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
            {activityPages > 1 && (
              <MiniPager
                page={activityPageSafe}
                pages={activityPages}
                onPrev={() => setActivityPage(Math.max(1, activityPageSafe - 1))}
                onNext={() => setActivityPage(Math.min(activityPages, activityPageSafe + 1))}
                prevLabel={t("tasks.prevPeriod")}
                nextLabel={t("tasks.nextPeriod")}
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {activities.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("tasks.logEmpty")}</p>
            )}
            {activityRows.map((activity) => (
              <button
                key={activity.id}
                type="button"
                aria-label={`${t("tasks.activityOpen")}: ${activity.taskTitle || t("tasks.logTitle")}`}
                onClick={() => onActivity?.(activity.taskId)}
                className="flex flex-col gap-0.5 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted/60"
              >
                <span className="truncate font-medium">{activity.taskTitle || t("tasks.logTitle")}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {activity.actorName} · {formatTaskDate(String(activity.createdAt ?? ""), language)}
                </span>
              </button>
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
  onProgress,
  onEdit,
  onDelete,
}: {
  rows: TaskRow[];
  types: TaskTypeRow[];
  onOpen: (task: TaskRow) => void;
  onStatusChange?: (task: TaskRow, status: string) => void;
  onProgress?: (task: TaskRow) => void;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
}) {
  const { t, language } = useLanguage();
  const today = todayISO();
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

          {column.items.map((task) => {
            const overdue = task.status === "Belum" && task.dueDate < today;
            const progress = Math.min(100, Math.max(0, task.progress || 0));
            const startText = formatTaskDate(task.startDate, language);
            const dueText = formatTaskDate(task.dueDate, language);
            const dateRange = startText ? `${startText} → ${dueText}` : dueText;

            return (
              <div
                key={task.id}
                data-board-card="1"
                className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      #{task.id}
                      <Badge
                        variant="outline"
                        className={cn("h-5 px-1.5 text-[10px]", priorityTone(task.priority))}
                      >
                        {t(PRIORITY_LABEL_KEYS[task.priority] ?? "tasks.priorityNormal")}
                      </Badge>
                      {overdue && (
                        <span className="rounded-full bg-red-500/12 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                          {t("tasks.overdue")}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpen(task)}
                      className="text-left text-sm font-medium"
                    >
                      <span className="line-clamp-2">{task.title}</span>
                    </button>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {typeName(types, task.issueType, task.userId)} ·{" "}
                      {t(DIFFICULTY_LABEL_KEYS[task.difficulty] ?? "tasks.difficultyMedium")}
                    </span>
                  </div>
                  {(onEdit || onDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("tasks.colActions")}
                            className="shrink-0 text-muted-foreground"
                          />
                        }
                      >
                        <MoreVertical className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 p-1">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(task)}>
                            <Pencil className="size-3.5" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                            <Trash2 className="size-3.5" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {progress}%
                  </span>
                  {onProgress && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("tasks.updateProgress")}
                      onClick={() => onProgress(task)}
                      className="-mr-1 shrink-0 text-muted-foreground"
                    >
                      <TrendingUp className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="size-3 shrink-0" />
                  <span className={cn("truncate", overdue && "text-red-600 dark:text-red-400")}>
                    {dateRange}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase">
                      {(task.ownerName || "?").slice(0, 2)}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {task.ownerName || "—"}
                    </span>
                  </div>
                  {onStatusChange && (
                    <div className="flex shrink-0 items-center gap-0.5">
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
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
