"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FilePlus2, FileText, Pencil, Save, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatStamp } from "@/lib/task-dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

interface TaskDocRow {
  id: number;
  title: string;
  body: string;
  ownerName: string;
  updatedByName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Tab Docs: dokumen bebas per tim, sejajar dengan "Docs" di Jira. */
export function TaskDocsView({ canWrite }: { canWrite: boolean }) {
  const { t, language } = useLanguage();
  const { data, reload } = useApi<TaskDocRow[]>("/api/task-docs");
  const docs = data ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Dokumen pertama otomatis tampil supaya panel kanan tidak kosong (tanpa
  // setState di effect — dilarang oleh react-hooks/set-state-in-effect).
  const selected = docs.find((doc) => doc.id === selectedId) ?? docs[0] ?? null;

  function startEdit(doc: TaskDocRow | null) {
    setDraftTitle(doc?.title ?? "");
    setDraftBody(doc?.body ?? "");
    setEditing(true);
    if (doc) setSelectedId(doc.id);
  }

  async function handleSave() {
    if (!draftTitle.trim()) {
      toast.error(t("tasks.docsTitleRequired"));
      return;
    }
    setSaving(true);
    try {
      if (selected && editing) {
        await apiPatch(`/api/task-docs/${selected.id}`, {
          title: draftTitle.trim(),
          body: draftBody,
        });
      } else {
        await apiPost("/api/task-docs", { title: draftTitle.trim(), body: draftBody });
      }
      toast.success(t("tasks.docsSaved"));
      setEditing(false);
      reload();
    } catch {
      toast.error(t("tasks.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      await apiDelete(`/api/task-docs/${deleteId}`);
      toast.success(t("tasks.docsDeleted"));
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      setEditing(false);
      reload();
    } catch {
      toast.error(t("tasks.deleteFailed"));
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
      <Card size="sm" className="flex flex-col">
        <CardContent className="flex flex-col gap-2 pt-3">
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => startEdit(null)}>
              <FilePlus2 className="size-4" /> {t("tasks.docsNew")}
            </Button>
          )}
          <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
            {docs.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                {t("tasks.docsEmpty")}
              </p>
            )}
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setSelectedId(doc.id);
                  setEditing(false);
                }}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                  selectedId === doc.id && "bg-muted font-medium"
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.title}</span>
                </span>
                <span className="pl-5 text-[11px] text-muted-foreground">
                  {formatStamp(doc.updatedAt ?? doc.createdAt ?? "", language)}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="flex flex-col">
        <CardContent className="flex flex-col gap-2 pt-3">
          {editing ? (
            <>
              <Input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={t("tasks.docsTitlePlaceholder")}
              />
              <Textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                placeholder={t("tasks.docsBodyPlaceholder")}
                className="min-h-[380px] resize-y font-mono text-xs"
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="size-4" /> {t("common.save")}
                </Button>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="flex flex-wrap items-start gap-2 border-b pb-2">
                <h3 className="text-base font-semibold">{selected.title}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {t("tasks.docsUpdatedBy", { name: selected.updatedByName })}
                </span>
                {canWrite && (
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.edit")}
                      onClick={() => startEdit(selected)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.delete")}
                      onClick={() => setDeleteId(selected.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="min-h-[380px] whitespace-pre-wrap text-sm">
                {selected.body || t("tasks.docsBodyEmpty")}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {t("tasks.docsSelect")}
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t("tasks.docsDeleteTitle")}
        description={t("tasks.docsDeleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
