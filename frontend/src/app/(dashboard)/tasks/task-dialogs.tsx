"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiPatch } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatStamp, formatTaskDate } from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTION_LABEL_KEYS,
  DIFFICULTY_LABEL_KEYS,
  PRIORITY_LABEL_KEYS,
  REPEAT_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
  type TaskActivityRow,
  type TaskRow,
} from "./task-types";

/** Update progress task + catatan opsional (tercatat di log aktivitas). */
export function TaskProgressDialog({
  task,
  onSaved,
  onCancel,
}: {
  task: TaskRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(String(task.progress));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiPatch(`/api/tasks/${task.id}`, {
        progress: Number(progress) || 0,
        note: note.trim(),
      });
      toast.success(t("tasks.saved"));
      onSaved();
    } catch {
      toast.error(t("tasks.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tasks.updateProgress")}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {task.title}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldProgress")}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldNote")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ChangeEntry {
  field: string;
  from: unknown;
  to: unknown;
}

function describeChanges(changes: string): ChangeEntry[] {
  if (!changes) return [];
  try {
    const parsed = JSON.parse(changes);
    return Array.isArray(parsed) ? (parsed as ChangeEntry[]) : [];
  } catch {
    return [];
  }
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** Daftar log aktivitas (dipakai dialog maupun tab Log Aktivitas), dengan paging. */
export function TaskLogList({ taskId, showTask }: { taskId: number | null; showTask?: boolean }) {
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const url = taskId
    ? `/api/tasks/activities?taskId=${taskId}&limit=500`
    : "/api/tasks/activities?limit=500";
  const { data } = useApi<TaskActivityRow[]>(url);
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("tasks.logEmpty")}
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-3">
        {pageRows.map((row) => {
          const changes = describeChanges(row.changes);
          return (
            <li key={row.id} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.actorName || "—"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t(ACTION_LABEL_KEYS[row.action] ?? "tasks.actionUpdate")}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {row.createdAt ? formatStamp(row.createdAt, language) : "—"}
                </span>
              </div>
              {showTask && row.taskTitle && (
                <p className="mt-1 text-xs text-muted-foreground">{row.taskTitle}</p>
              )}
              {changes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  {changes.map((change) => (
                    <li key={`${row.id}-${change.field}`}>
                      <span className="font-medium text-foreground">{change.field}</span>
                      {": "}
                      {renderValue(change.from)} → {renderValue(change.to)}
                    </li>
                  ))}
                </ul>
              )}
              {row.note && <p className="mt-2 text-xs">{row.note}</p>}
            </li>
          );
        })}
      </ol>
      <Pagination
        totalItems={rows.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

/** Detail satu task (pemilik, tanggal, prioritas, progres) + riwayat aktivitasnya. */
export function TaskDetailDialog({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { t, language } = useLanguage();
  const repeatLabel = t(REPEAT_LABEL_KEYS[task.repeatRule] ?? "tasks.repeatNone");
  const repeatDetail =
    task.repeatRule === "weekly" && task.repeatWeekday
      ? `${repeatLabel} · ${t(WEEKDAY_LABEL_KEYS[task.repeatWeekday - 1])}`
      : task.repeatRule === "monthly" && task.repeatDay
        ? `${repeatLabel} · ${task.repeatDay}`
        : repeatLabel;

  const fields: Array<{ label: string; value: string }> = [
    { label: t("tasks.colOwner"), value: task.ownerName || "—" },
    { label: t("tasks.fieldStatus"), value: t(task.status === "Selesai" ? "tasks.statusDone" : "tasks.statusOpen") },
    { label: t("tasks.fieldPriority"), value: t(PRIORITY_LABEL_KEYS[task.priority] ?? "tasks.priorityNormal") },
    { label: t("tasks.fieldDifficulty"), value: t(DIFFICULTY_LABEL_KEYS[task.difficulty] ?? "tasks.difficultyMedium") },
    { label: t("tasks.fieldStart"), value: formatTaskDate(task.startDate, language) },
    { label: t("tasks.fieldDue"), value: formatTaskDate(task.dueDate, language) },
    { label: t("tasks.fieldRepeat"), value: repeatDetail },
    { label: t("tasks.detailCreated"), value: task.createdAt ? formatStamp(task.createdAt, language) : "—" },
    { label: t("tasks.detailUpdated"), value: task.updatedAt ? formatStamp(task.updatedAt, language) : "—" },
  ];
  if (task.completedAt) {
    fields.push({ label: t("tasks.detailCompleted"), value: formatStamp(task.completedAt, language) });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("tasks.detailTitle")}</DialogTitle>
          <DialogDescription className="line-clamp-2">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {task.description && <p className="text-sm whitespace-pre-line">{task.description}</p>}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("tasks.fieldProgress")}</span>
              <span className="font-medium text-foreground">{task.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={task.progress >= 100 ? "h-full bg-emerald-500" : "h-full bg-primary"}
                style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
              />
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col">
                <dt className="text-[11px] text-muted-foreground">{field.label}</dt>
                <dd className="font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t("tasks.detailActivity")}</p>
            <TaskLogList taskId={task.id} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Log aktivitas satu task, atau seluruh task bila `task` null. */
export function TaskLogDialog({
  task,
  onClose,
}: {
  task: TaskRow | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {task ? t("tasks.logTitle") : t("tasks.logAllTitle")}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {task ? task.title : t("tasks.logAllHint")}
          </DialogDescription>
        </DialogHeader>

        <TaskLogList taskId={task?.id ?? null} showTask={!task} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
