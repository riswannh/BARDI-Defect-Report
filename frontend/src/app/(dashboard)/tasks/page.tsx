"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CircleCheck,
  CircleDashed,
  History,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TaskDetailDialog, TaskLogDialog, TaskLogList, TaskProgressDialog } from "./task-dialogs";
import { TaskCalendar } from "./task-calendar";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL_KEYS,
  PRIORITIES,
  PRIORITY_LABEL_KEYS,
  priorityTone,
  type TaskRow,
} from "./task-types";

const ALL = "all";

export default function TasksPage() {
  const { t } = useLanguage();
  const { can, isAdmin } = useAuth();
  const canWrite = can("tasks", "write");
  const today = todayISO();

  const { data: mineData, reload: reloadMine } = useApi<TaskRow[]>("/api/tasks?scope=mine");
  const { data: allData, reload: reloadAll } = useApi<TaskRow[]>(
    isAdmin ? "/api/tasks?scope=all" : null
  );
  const { data: calendarData } = useApi<Array<{ id: string; name: string }>>("/api/tasks/calendars");
  const mine = mineData ?? [];
  const everything = allData ?? [];

  const [tab, setTab] = useState("calendar");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Belum");
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /** undefined = dialog tertutup, null = task baru. */
  const [formTask, setFormTask] = useState<TaskRow | null | undefined>(undefined);
  const [progressTask, setProgressTask] = useState<TaskRow | null>(null);
  const [logTask, setLogTask] = useState<TaskRow | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskRow | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);

  const activeRows = tab === "all" ? everything : mine;
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activeRows.filter((task) => {
      if (statusFilter !== ALL && task.status !== statusFilter) return false;
      if (priorityFilter !== ALL && task.priority !== priorityFilter) return false;
      if (difficultyFilter !== ALL && task.difficulty !== difficultyFilter) return false;
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.ownerName.toLowerCase().includes(needle)
      );
    });
  }, [activeRows, search, statusFilter, priorityFilter, difficultyFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function refreshAll() {
    reloadMine();
    reloadAll();
  }

  async function toggleDone(task: TaskRow) {
    const nextStatus = task.status === "Selesai" ? "Belum" : "Selesai";
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
    const columnCount = showOwner ? 8 : 7;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tasks.colTitle")}</TableHead>
            {showOwner && <TableHead>{t("tasks.colOwner")}</TableHead>}
            <TableHead>{t("tasks.colPriority")}</TableHead>
            <TableHead>{t("tasks.colDuration")}</TableHead>
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
                  {task.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
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
                    {formatTaskDate(task.startDate)} – {formatTaskDate(task.dueDate)}
                  </span>
                  <div className="text-[11px] text-muted-foreground">
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
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("tasks.logTitle")}
                      onClick={() => setLogTask(task)}
                    >
                      <History className="size-3.5" />
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
                          onClick={() => toggleDone(task)}
                        >
                          <CircleCheck className="size-3.5" />
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
    const statusOptions = [
      { value: ALL, label: t("tasks.allStatus") },
      { value: "Belum", label: t("tasks.statusOpen") },
      { value: "Selesai", label: t("tasks.statusDone") },
    ];
    const priorityOptions = [
      { value: ALL, label: t("tasks.allPriority") },
      ...PRIORITIES.map((value) => ({
        value,
        label: t(PRIORITY_LABEL_KEYS[value]),
      })),
    ];
    const difficultyOptions = [
      { value: ALL, label: t("tasks.allDifficulty") },
      ...DIFFICULTIES.map((value) => ({
        value,
        label: t(DIFFICULTY_LABEL_KEYS[value]),
      })),
    ];

    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("tasks.searchPlaceholder")}
          className="h-8 w-full sm:w-56"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(String(value));
            setPage(1);
          }}
          items={statusOptions}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(value) => {
            setPriorityFilter(String(value));
            setPage(1);
          }}
          items={priorityOptions}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={difficultyFilter}
          onValueChange={(value) => {
            setDifficultyFilter(String(value));
            setPage(1);
          }}
          items={difficultyOptions}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {difficultyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t("tasks.title")}
        actions={
          canWrite && (
            <Button size="sm" onClick={() => setFormTask(null)}>
              <Plus className="size-4" /> {t("tasks.newTask")}
            </Button>
          )
        }
      />

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        value={tab}
        onValueChange={(value) => {
          setTab(String(value));
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="calendar">{t("tasks.tabCalendar")}</TabsTrigger>
          <TabsTrigger value="mine">{t("tasks.tabMine")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="all">{t("tasks.tabAll")}</TabsTrigger>}
          <TabsTrigger value="log">{t("tasks.tabLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {renderFilters()}
          <Card size="sm" className="overflow-hidden py-0">
            <CardContent className="px-0">
              {renderTable(paged, false)}
              {filtered.length > 0 && (
                <div className="px-4 pb-4">
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
        </TabsContent>

        <TabsContent value="all" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {renderFilters()}
          <Card size="sm" className="overflow-hidden py-0">
            <CardContent className="px-0">
              {renderTable(paged, true)}
              {filtered.length > 0 && (
                <div className="px-4 pb-4">
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
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 flex min-h-0 flex-1 flex-col">
          <Card size="sm" className="flex min-h-0 flex-1 flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col pt-3">
              <TaskCalendar
                tasks={isAdmin ? everything : mine}
                calendars={calendarData ?? []}
                onSelect={(task) => setDetailTask(task)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("tasks.logAllTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskLogList taskId={null} showTask />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {formTask !== undefined && (
        <TaskFormDialog
          task={formTask}
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

      {logTask && <TaskLogDialog task={logTask} onClose={() => setLogTask(null)} />}

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
