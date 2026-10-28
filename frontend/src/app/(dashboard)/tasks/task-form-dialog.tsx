"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiPatch, apiPost } from "@/lib/api-client";
import { isoWeekday, todayISO } from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DIFFICULTIES,
  PRIORITIES,
  TASK_STATUSES,
  WEEKDAY_LABEL_KEYS,
  type TaskRow,
} from "./task-types";

const NONE = "none";

export function TaskFormDialog({
  task,
  onSaved,
  onCancel,
}: {
  task: TaskRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = todayISO();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [progress, setProgress] = useState(String(task?.progress ?? 0));
  const [priority, setPriority] = useState(task?.priority ?? "Normal");
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? "Sedang");
  const [status, setStatus] = useState(task?.status ?? "Belum");
  const [startDate, setStartDate] = useState(task?.startDate ?? today);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? today);
  const [repeatRule, setRepeatRule] = useState(task?.repeatRule ?? "");
  const [repeatWeekday, setRepeatWeekday] = useState(
    String(task?.repeatWeekday ?? isoWeekday(task?.startDate ?? today))
  );
  const [repeatDay, setRepeatDay] = useState(
    String(task?.repeatDay ?? Number((task?.startDate ?? today).slice(8, 10)))
  );

  const priorityOptions = PRIORITIES.map((value) => ({
    value,
    label: t(`tasks.priority${value === "Urgent" ? "Urgent" : value === "Segera" ? "Segera" : "Normal"}`),
  }));
  const difficultyOptions = DIFFICULTIES.map((value) => ({
    value,
    label: t(
      `tasks.difficulty${value === "Mudah" ? "Easy" : value === "Sedang" ? "Medium" : "Hard"}`
    ),
  }));
  const statusOptions = TASK_STATUSES.map((value) => ({
    value,
    label: t(value === "Selesai" ? "tasks.statusDone" : "tasks.statusOpen"),
  }));
  const repeatOptions = [
    { value: NONE, label: t("tasks.repeatNone") },
    { value: "daily", label: t("tasks.repeatDaily") },
    { value: "weekly", label: t("tasks.repeatWeekly") },
    { value: "monthly", label: t("tasks.repeatMonthly") },
  ];
  const weekdayOptions = WEEKDAY_LABEL_KEYS.map((key, index) => ({
    value: String(index + 1),
    label: t(key),
  }));
  const dayOptions = Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error(t("tasks.errorTitle"));
      return;
    }
    if (dueDate < startDate) {
      toast.error(t("tasks.errorDates"));
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      progress: Number(progress) || 0,
      priority,
      difficulty,
      status,
      startDate,
      dueDate,
      repeatRule,
      repeatWeekday: repeatRule === "weekly" ? Number(repeatWeekday) : null,
      repeatDay: repeatRule === "monthly" ? Number(repeatDay) : null,
    };

    setSaving(true);
    try {
      if (task) {
        await apiPatch(`/api/tasks/${task.id}`, payload);
      } else {
        await apiPost("/api/tasks", payload);
      }
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? t("tasks.editTask") : t("tasks.newTask")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldDescription")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldPriority")}</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(String(value))}
                items={priorityOptions}
              >
                <SelectTrigger className="w-full">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldDifficulty")}</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(String(value))}
                items={difficultyOptions}
              >
                <SelectTrigger className="w-full">
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

            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldStart")}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!task}
              />
              {!task && (
                <p className="text-xs text-muted-foreground">{t("tasks.startFixedHint")}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldDue")}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldStatus")}</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(String(value))}
                items={statusOptions}
              >
                <SelectTrigger className="w-full">
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
            </div>

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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldRepeat")}</Label>
              <Select
                value={repeatRule === "" ? NONE : repeatRule}
                onValueChange={(value) => {
                  const next = String(value);
                  setRepeatRule(next === NONE ? "" : next);
                }}
                items={repeatOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {repeatOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {repeatRule === "weekly" && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("tasks.fieldWeekday")}</Label>
                <Select
                  value={repeatWeekday}
                  onValueChange={(value) => setRepeatWeekday(String(value))}
                  items={weekdayOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdayOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {repeatRule === "monthly" && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("tasks.fieldRepeatDay")}</Label>
                <Select
                  value={repeatDay}
                  onValueChange={(value) => setRepeatDay(String(value))}
                  items={dayOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {repeatRule !== "" && (
            <p className="text-xs text-muted-foreground">{t("tasks.repeatHint")}</p>
          )}

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

/** Dipakai dialog lain: label repeat yang sedang aktif. */
export function repeatRuleLabel(
  t: (key: string) => string,
  rule: string,
  weekday?: number | null,
  day?: number | null
): string {
  if (rule === "daily") return t("tasks.repeatDaily");
  if (rule === "weekly") {
    const name = weekday ? t(WEEKDAY_LABEL_KEYS[weekday - 1]) : "";
    return `${t("tasks.repeatWeekly")} · ${name}`;
  }
  if (rule === "monthly") {
    return `${t("tasks.repeatMonthly")} · ${day ?? ""}`;
  }
  return t("tasks.repeatNone");
}
