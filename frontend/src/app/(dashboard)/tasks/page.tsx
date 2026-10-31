"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleCheck,
  CircleDashed,
  FileText,
  History,
  KanbanSquare,
  LayoutDashboard,
  ListTree,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatTaskDate, todayISO } from "@/lib/task-dates";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailDialog, TaskLogList, TaskProgressDialog } from "./task-dialogs";
import { TaskCalendar } from "./task-calendar";
import { MultiFilter } from "./task-multi-filter";
import { TaskBoardView, TaskSummaryView, matchesQuickFilter, type QuickFilterKey } from "./task-views";
import { TaskDocsView } from "./task-docs-view";
import { TaskSettingsView } from "./task-settings-view";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL_KEYS,
  isTaskArchived,
  PRIORITIES,
  PRIORITY_LABEL_KEYS,
  priorityTone,
  typeName,
  type TaskActivityRow,
  type TaskRow,
  type TaskTypeRow,
  type TaskView,
} from "./task-types";

/** Label chip filter cepat di tab Daftar, mengikuti nama kartu KPI Ringkasan. */
const QUICK_FILTER_LABEL_KEYS: Record<QuickFilterKey, TranslationKey> = {
  created: "tasks.kpiCreated",
  updated: "tasks.kpiUpdated",
  done: "tasks.kpiDone",
  dueSoon: "tasks.kpiDueSoon",
};

/**
 * Pilihan "Arsip" di dropdown Status. Arsip bukan status sungguhan (turunan dari
 * completedAt), tapi user ingin mengelolanya lewat dropdown status yang sama.
 */
const ARCHIVE_FILTER = "__arsip";

export default function TasksPage() {
  const { t, language } = useLanguage();
  const { can, isAdmin, user, profile } = useAuth();
  const canWrite = can("tasks", "write");
  const today = todayISO();

  const { data: mineData, reload: reloadMine } = useApi<TaskRow[]>("/api/tasks?scope=mine");
  const { data: allData, reload: reloadAll } = useApi<TaskRow[]>(
    isAdmin ? "/api/tasks?scope=all" : null
  );
  const { data: calendarData, reload: reloadCalendars } = useApi<Array<{ id: string; name: string }>>(
    "/api/tasks/calendars"
  );
  const { data: ownerData } = useApi<Array<{ id: string; name: string }>>("/api/tasks/owners");
  const { data: typeData, reload: reloadTypes } = useApi<TaskTypeRow[]>("/api/task-types");
  const { data: viewData, reload: reloadView } = useApi<{ view: TaskView | null }>(
    "/api/tasks/view"
  );
  const { data: activityData } = useApi<TaskActivityRow[]>(
    "/api/tasks/activities?limit=30"
  );
  const mine = mineData ?? [];
  const everything = allData ?? [];
  const activities = activityData ?? [];
  const types = typeData ?? [];
  const owners = ownerData ?? [];
  /** Tampilan tersimpan akun; null di server berarti daftar. */
  const storedView: TaskView = viewData?.view === "board" ? "board" : "list";
  /** Admin melihat semua task di view ringkasan/board/timeline/kalender. */
  const viewRows = isAdmin ? everything : mine;

  const [tab, setTab] = useState("summary");
  /** Paksaan tampilan sesi ini (jalan pintas Ringkasan); null = ikut tersimpan. */
  const [overrideView, setOverrideView] = useState<TaskView | null>(null);
  const view: TaskView = overrideView ?? storedView;
  const [search, setSearch] = useState("");
  /** Filter multi-pilih; array kosong berarti "semua". */
  const [ownerFilter, setOwnerFilter] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  /** Filter cepat dari kartu KPI Ringkasan; null = tidak aktif. */
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /** undefined = dialog tertutup, null = task baru. */
  const [formTask, setFormTask] = useState<TaskRow | null | undefined>(undefined);
  const [progressTask, setProgressTask] = useState<TaskRow | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskRow | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);

  /** Admin membaca semua task; akun biasa hanya task miliknya (scope=mine). */
  const activeRows = isAdmin ? everything : mine;
  /**
   * Bawaan filter akun = diri sendiri ("Tugas Saya"); mengosongkan filter
   * berarti semua akun. Kolom pembuat hanya perlu saat tidak lagi satu akun.
   */
  const activeOwnerFilter = useMemo(
    () => ownerFilter ?? (user ? [user.id] : []),
    [ownerFilter, user],
  );
  const showOwnerColumn = !(
    activeOwnerFilter.length === 1 && activeOwnerFilter[0] === user?.id
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const archiveOnly = statusFilter.includes(ARCHIVE_FILTER);
    const pickedStatus = statusFilter.filter((value) => value !== ARCHIVE_FILTER);
    return activeRows.filter((task) => {
      if (activeOwnerFilter.length > 0 && !activeOwnerFilter.includes(task.userId)) {
        return false;
      }
      if (pickedStatus.length > 0 && !pickedStatus.includes(task.status)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority)) return false;
      if (difficultyFilter.length > 0 && !difficultyFilter.includes(task.difficulty)) {
        return false;
      }
      if (typeFilter.length > 0 && !typeFilter.includes(task.issueType || "task")) return false;
      if (quickFilter && !matchesQuickFilter(task, quickFilter)) return false;
      // Arsip hanya memengaruhi tab Tugas; Kalender & Ringkasan tetap memuatnya.
      // "Arsip" dicentang sendirian = daftar arsip; bila digabung status lain,
      // task arsip ikut muncul bersama task berstatus itu.
      const archived = isTaskArchived(task);
      if (archiveOnly) {
        if (pickedStatus.length === 0 && !archived) return false;
      } else if (archived) {
        return false;
      }
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.ownerName.toLowerCase().includes(needle)
      );
    });
  }, [
    activeOwnerFilter,
    activeRows,
    difficultyFilter,
    priorityFilter,
    quickFilter,
    search,
    statusFilter,
    typeFilter,
  ]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function refreshAll() {
    reloadMine();
    reloadAll();
  }

  async function patchStatus(task: TaskRow, nextStatus: string) {
    try {
      await apiPatch(`/api/tasks/${task.id}`, { status: nextStatus });
      toast.success(
        nextStatus === "Selesai" ? t("tasks.markedDone") : t("tasks.markedOpen")
      );
      refreshAll();
    } catch {
      toast.error(t("tasks.saveFailed"));
    }
  }

  async function toggleDone(task: TaskRow) {
    await patchStatus(task, task.status === "Selesai" ? "Belum" : "Selesai");
  }

  /** Ganti tampilan Daftar/Papan; pilihan langsung disimpan sebagai bawaan akun. */
  async function changeView(next: TaskView) {
    if (next === view) return;
    setOverrideView(next);
    try {
      await apiPatch("/api/tasks/view", { view: next });
      reloadView();
    } catch {
      setOverrideView(null);
      toast.error(t("tasks.viewSaveFailed"));
    }
  }

  /**
   * Jalan pintas Ringkasan: filter lama direset dulu supaya hasil klik tidak
   * menumpuk dengan filter yang sedang aktif, lalu pindah ke tab Tugas.
   */
  function applyQuick(patch: {
    quick?: QuickFilterKey;
    status?: string;
    priority?: string;
    type?: string;
  }) {
    setSearch("");
    setOwnerFilter(null);
    setStatusFilter(patch.status ? [patch.status] : []);
    setPriorityFilter(patch.priority ? [patch.priority] : []);
    setDifficultyFilter([]);
    setTypeFilter(patch.type ? [patch.type] : []);
    setQuickFilter(patch.quick ?? null);
    setPage(1);
    setTab("tasks");
  }

  async function handleDelete() {
    if (!deleteTask) return;
    try {
      await apiDelete(`/api/tasks/${deleteTask.id}`);
      toast.success(t("tasks.deleted"));
      setDeleteTask(null);
      refreshAll();
    } catch {
      toast.error(t("tasks.deleteFailed"));
    }
  }

  function renderTable(rows: TaskRow[], showOwner: boolean) {
    const columnCount = showOwner ? 9 : 8;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tasks.colTitle")}</TableHead>
            <TableHead>{t("tasks.colType")}</TableHead>
            {showOwner && <TableHead>{t("tasks.colOwner")}</TableHead>}
            <TableHead>{t("tasks.colPriority")}</TableHead>
            <TableHead>{t("tasks.colDue")}</TableHead>
            <TableHead>{t("tasks.colProgress")}</TableHead>
            <TableHead>{t("tasks.colStatus")}</TableHead>
            <TableHead className="text-right">{t("tasks.colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">
                {t("tasks.empty")}
              </TableCell>
            </TableRow>
          )}
          {rows.map((task) => {
            const overdue = task.status === "Belum" && task.dueDate < today;
            return (
              <TableRow key={task.id}>
                <TableCell className="max-w-[22rem]">
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => setDetailTask(task)}
                  >
                    {task.title}
                  </button>
                  {isTaskArchived(task) && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-500/12 px-1.5 py-0.5 align-middle text-[10px] font-medium text-slate-700 dark:text-slate-300">
                      {t("tasks.archiveBadge")}
                    </span>
                  )}
                  {task.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {typeName(types, task.issueType, task.userId)}
                </TableCell>
                {showOwner && (
                  <TableCell className="text-sm">{task.ownerName || "—"}</TableCell>
                )}
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ${priorityTone(task.priority)}`}
                  >
                    {t(PRIORITY_LABEL_KEYS[task.priority] ?? "tasks.priorityNormal")}
                  </span>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  <span className={overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                    {formatTaskDate(task.dueDate, language)}
                  </span>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTaskDate(task.startDate, language)} ·{" "}
                    {t(DIFFICULTY_LABEL_KEYS[task.difficulty] ?? "tasks.difficultyMedium")}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{task.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.status === "Selesai" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <CircleCheck className="size-3" /> {t("tasks.statusDone")}
                    </span>
                  ) : task.status === "Proses" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/12 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                      <CircleDashed className="size-3" /> {t("tasks.statusProses")}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                        overdue
                          ? "bg-red-500/12 text-red-700 dark:text-red-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <CircleDashed className="size-3" />
                      {overdue ? t("tasks.overdue") : t("tasks.statusOpen")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("tasks.updateProgress")}
                      onClick={() => setProgressTask(task)}
                    >
                      <TrendingUp className="size-3.5" />
                    </Button>
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("common.edit")}
                          onClick={() => setFormTask(task)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={
                            task.status === "Selesai" ? t("tasks.markOpen") : t("tasks.markDone")
                          }
                          className={
                            task.status === "Selesai"
                              ? "text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400"
                              : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                          }
                          onClick={() => toggleDone(task)}
                        >
                          {task.status === "Selesai" ? (
                            <RotateCcw className="size-4" />
                          ) : (
                            <CircleCheck className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("common.delete")}
                          onClick={() => setDeleteTask(task)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  function renderFilters() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("tasks.searchPlaceholder")}
          className="h-8 w-full sm:w-56"
        />
        {isAdmin && (
          <MultiFilter
            label={t("tasks.colOwner")}
            emptyLabel={t("tasks.exportAll")}
            options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
            selected={activeOwnerFilter}
            onChange={(next) => {
              setOwnerFilter(next);
              setPage(1);
            }}
          />
        )}
        <MultiFilter
          label={t("tasks.colStatus")}
          emptyLabel={t("tasks.allStatus")}
          options={[
            { value: "Belum", label: t("tasks.statusOpen") },
            { value: "Proses", label: t("tasks.statusProses") },
            { value: "Selesai", label: t("tasks.statusDone") },
            { value: ARCHIVE_FILTER, label: t("tasks.filterArchive") },
          ]}
          selected={statusFilter}
          onChange={(next) => {
            setStatusFilter(next);
            setPage(1);
          }}
        />
        <MultiFilter
          label={t("tasks.colType")}
          emptyLabel={t("tasks.allTypes")}
          options={types.map((item) => ({ value: item.code, label: item.name }))}
          selected={typeFilter}
          onChange={(next) => {
            setTypeFilter(next);
            setPage(1);
          }}
        />
        <MultiFilter
          label={t("tasks.colPriority")}
          emptyLabel={t("tasks.allPriority")}
          options={PRIORITIES.map((value) => ({
            value,
            label: t(PRIORITY_LABEL_KEYS[value]),
          }))}
          selected={priorityFilter}
          onChange={(next) => {
            setPriorityFilter(next);
            setPage(1);
          }}
        />
        <MultiFilter
          label={t("tasks.fieldDifficulty")}
          emptyLabel={t("tasks.allDifficulty")}
          options={DIFFICULTIES.map((value) => ({
            value,
            label: t(DIFFICULTY_LABEL_KEYS[value]),
          }))}
          selected={difficultyFilter}
          onChange={(next) => {
            setDifficultyFilter(next);
            setPage(1);
          }}
        />
        {quickFilter && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5"
            aria-label={`${t(QUICK_FILTER_LABEL_KEYS[quickFilter])} — ${t("tasks.quickFilterClear")}`}
            onClick={() => {
              setQuickFilter(null);
              setPage(1);
            }}
          >
            {t(QUICK_FILTER_LABEL_KEYS[quickFilter])}
            <X className="size-3.5" aria-hidden />
            <span className="sr-only">{t("tasks.quickFilterClear")}</span>
          </Button>
        )}
      </div>
    );
  }

  const tabs = [
    { value: "summary", label: t("tasks.tabSummary"), icon: LayoutDashboard },
    { value: "tasks", label: t("tasks.tabTasks"), icon: ListTree },
    { value: "calendar", label: t("tasks.tabCalendar"), icon: CalendarDays },
    { value: "docs", label: t("tasks.tabDocs"), icon: FileText },
    { value: "log", label: t("tasks.tabLog"), icon: History },
    ...(isAdmin ? [{ value: "settings", label: t("tasks.tabSettings"), icon: Settings }] : []),
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("tasks.title")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canWrite && (
              <Button size="sm" onClick={() => setFormTask(null)}>
                <Plus className="size-4" /> {t("tasks.newTask")}
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        className="flex flex-col"
        value={tab}
        onValueChange={(value) => {
          setTab(String(value));
          setPage(1);
        }}
      >
        <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.value} value={item.value}>
                <Icon className="size-3.5" />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <TaskSummaryView
            rows={viewRows}
            activities={activities}
            types={types}
            onQuickFilter={(key) => applyQuick({ quick: key })}
            onQuickStatus={(status) => applyQuick({ status })}
            onQuickPriority={(priority) => applyQuick({ priority })}
            onQuickType={(code) => applyQuick({ type: code })}
            onActivity={(taskId) => {
              const target = [...everything, ...mine].find((task) => task.id === taskId);
              if (target) setDetailTask(target);
            }}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {renderFilters()}
            </div>
            <div
              role="group"
              aria-label={t("tasks.viewSwitch")}
              className="ml-auto flex shrink-0 items-center gap-1"
            >
              {(["list", "board"] as TaskView[]).map((option) => {
                const Icon = option === "list" ? ListTree : KanbanSquare;
                return (
                  <Button
                    key={option}
                    size="sm"
                    variant={view === option ? "secondary" : "ghost"}
                    aria-pressed={view === option}
                    className="gap-1.5"
                    onClick={() => void changeView(option)}
                  >
                    <Icon className="size-4" />
                    {t(option === "list" ? "tasks.tabList" : "tasks.tabBoard")}
                  </Button>
                );
              })}
            </div>
          </div>

          {view === "list" ? (
            <Card size="sm" className="overflow-hidden py-0">
              <CardContent className="px-0">
                <div>
                  {renderTable(paged, showOwnerColumn)}
                </div>
                {filtered.length > 0 && (
                  <div className="border-t border-border/60 px-4 py-2">
                    <Pagination
                      totalItems={filtered.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <TaskBoardView
              rows={filtered}
              types={types}
              onOpen={setDetailTask}
              onStatusChange={canWrite ? patchStatus : undefined}
              onProgress={canWrite ? setProgressTask : undefined}
              onEdit={canWrite ? setFormTask : undefined}
              onDelete={canWrite ? setDeleteTask : undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card size="sm">
            <CardContent className="pt-3">
              <TaskCalendar
                tasks={viewRows}
                calendars={calendarData ?? []}
                onSelect={(task) => setDetailTask(task)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="mt-4 flex flex-col">
          <TaskDocsView canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("tasks.logAllTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskLogList taskId={null} showTask />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <TaskSettingsView
            types={types}
            me={{ id: user?.id ?? "", name: profile?.name || user?.name || "" }}
            users={calendarData ?? []}
            isAdmin={isAdmin}
            onChanged={() => {
              reloadTypes();
              reloadCalendars();
            }}
          />
        </TabsContent>
      </Tabs>

      {formTask !== undefined && (
        <TaskFormDialog
          task={formTask}
          types={types}
          me={{ id: user?.id ?? "", name: profile?.name || user?.name || "" }}
          users={calendarData ?? []}
          isAdmin={isAdmin}
          onSaved={() => {
            setFormTask(undefined);
            refreshAll();
          }}
          onCancel={() => setFormTask(undefined)}
        />
      )}

      {progressTask && (
        <TaskProgressDialog
          task={progressTask}
          onSaved={() => {
            setProgressTask(null);
            refreshAll();
          }}
          onCancel={() => setProgressTask(null)}
        />
      )}

      {detailTask && (
        <TaskDetailDialog task={detailTask} onClose={() => setDetailTask(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTask)}
        onOpenChange={(open) => {
          if (!open) setDeleteTask(null);
        }}
        title={t("tasks.deleteTitle")}
        description={t("tasks.deleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
