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
import { mentionedIdsFromText } from "./task-mentions";
import {
  DIFFICULTIES,
  PRIORITIES,
  TASK_STATUSES,
  WEEKDAY_LABEL_KEYS,
  typeName,
  typesOfOwner,
  type TaskRow,
  type TaskTypeRow,
} from "./task-types";

const NONE = "none";

export function TaskFormDialog({
  task,
  types,
  me,
  users,
  isAdmin,
  onSaved,
  onCancel,
}: {
  task: TaskRow | null;
  types: TaskTypeRow[];
  me: { id: string; name: string };
  users: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const today = todayISO();
  const [saving, setSaving] = useState(false);

  /** Pemilik task: admin boleh memilih akun lain, tipe ikut daftar pemilik. */
  const [ownerId, setOwnerId] = useState(task?.userId ?? me.id);
  const ownerTypes = typesOfOwner(types, isAdmin ? ownerId : me.id);

  function changeOwner(next: string) {
    setOwnerId(next);
    setIssueType(typesOfOwner(types, next)[0]?.code ?? "task");
  }

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  /**
   * Penyebutan @user langsung di dalam deskripsi (tanpa dropdown terpisah).
   * Saat mengetik "@" muncul daftar akun yang bisa disebut; daftar akunnya sama
   * dengan pilihan pemilik task dan panel kalender (akun yang boleh menulis
   * Rencana Kerja).
   */
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [issueType, setIssueType] = useState(task?.issueType ?? ownerTypes[0]?.code ?? "task");
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
  // Tipe dari master milik pemilik task; kalau task lama memakai kode yang
  // sudah dihapus, tetap ditampilkan supaya tidak berubah tanpa disengaja.
  const typeCodes = ownerTypes.some((item) => item.code === issueType)
    ? ownerTypes.map((item) => item.code)
    : [...ownerTypes.map((item) => item.code), issueType];
  const issueOptions = typeCodes.map((value) => ({
    value,
    label: typeName(types, value, isAdmin ? ownerId : me.id),
  }));
  const statusOptions = TASK_STATUSES.map((value) => ({
    value,
    label: t(value === "Selesai" ? "tasks.statusDone" : value === "Proses" ? "tasks.statusProses" : "tasks.statusOpen"),
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

  /** Pilihan akun untuk penyebutan @, disaring dari kata yang sedang diketik. */
  const mentionMatches = mention
    ? users.filter((item) =>
        item.name.toLowerCase().includes(mention.query.trim().toLowerCase())
      )
    : [];

  /** Buka/tutup daftar akun berdasarkan teks sebelum kursor. */
  function syncMentionList(value: string, caret: number | null) {
    if (caret === null) {
      setMention(null);
      return;
    }
    const before = value.slice(0, caret);
    const match = /(^|\s)@([\p{L}\p{N}._-]*(?: [\p{L}\p{N}._-]+)?)$/u.exec(before);
    if (!match) {
      setMention(null);
      return;
    }
    const query = match[2] ?? "";
    // Spasi hanya boleh satu di dalam nama; kalau sudah lebih, anggap selesai.
    if (query.split(" ").length > 3) {
      setMention(null);
      return;
    }
    setMention({ start: before.length - query.length - 1, query });
    setMentionIndex(0);
  }

  /** Pasang nama terpilih menggantikan "@kata" yang sedang diketik. */
  function pickMention(person: { id: string; name: string }) {
    if (!mention) return;
    setDescription((current) => {
      const caret = mention.start + mention.query.length + 1;
      const before = current.slice(0, mention.start);
      const after = current.slice(caret);
      const trailing = after.startsWith(" ") ? after.slice(1) : after;
      return `${before}@${person.name} ${trailing}`;
    });
    setMention(null);
  }

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
      priority,
      difficulty,
      issueType,
      startDate,
      dueDate,
      repeatRule,
      repeatWeekday: repeatRule === "weekly" ? Number(repeatWeekday) : null,
      repeatDay: repeatRule === "monthly" ? Number(repeatDay) : null,
      // Hanya admin yang boleh membuat/memindahkan task ke akun lain.
      ownerId: isAdmin ? ownerId : undefined,
      mentionedUserIds: mentionedIdsFromText(description, users),
    };
    // Status & progres hanya diisi saat membuat task. Setelah task ada, dua
    // field itu diubah lewat tombol Progres / Selesai agar tidak bentrok.
    const body = task ? payload : { ...payload, progress: Number(progress) || 0, status };

    setSaving(true);
    try {
      if (task) {
        await apiPatch(`/api/tasks/${task.id}`, body);
      } else {
        await apiPost("/api/tasks", body);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto overscroll-contain supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? t("tasks.editTask") : t("tasks.newTask")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="relative flex flex-col gap-1.5">
            <Label>{t("tasks.fieldDescription")}</Label>
            <Textarea
              value={description}
              onChange={(event) => {
                const value = event.target.value;
                setDescription(value);
                syncMentionList(value, event.target.selectionStart);
              }}
              onKeyDown={(event) => {
                if (!mention || mentionMatches.length === 0) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMentionIndex((current) => (current + 1) % mentionMatches.length);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setMentionIndex(
                    (current) => (current - 1 + mentionMatches.length) % mentionMatches.length
                  );
                } else if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  pickMention(mentionMatches[Math.min(mentionIndex, mentionMatches.length - 1)]);
                } else if (event.key === "Escape") {
                  event.stopPropagation();
                  setMention(null);
                }
              }}
              rows={3}
            />
            {mention && mentionMatches.length > 0 && (
              <div
                className="absolute top-full left-0 z-50 mt-1 w-56 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 shadow-md"
                style={{ maxHeight: "12rem" }}
              >
                {mentionMatches.map((person, index) => (
                  <button
                    key={person.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickMention(person)}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm ${
                      index === mentionIndex ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("tasks.mentionHint")}</p>
          </div>

          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldOwner")}</Label>
              <Select
                value={ownerId}
                onValueChange={(value) => changeOwner(String(value))}
                items={users.map((item) => ({ value: item.id, label: item.name }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("tasks.fieldOwnerHint")}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t("tasks.fieldIssueType")}</Label>
            <Select
              value={issueType}
              onValueChange={(value) => setIssueType(String(value))}
              items={issueOptions}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {issueOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                disabled
              />
              <p className="text-xs text-muted-foreground">{t("tasks.startFixedHint")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks.fieldDue")}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {!task && (
              <>
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
              </>
            )}
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
