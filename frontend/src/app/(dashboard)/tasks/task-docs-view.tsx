"use client";

import { useState } from "react";
import { FileText, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatStamp } from "@/lib/task-dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { htmlPreview, plainToHtml } from "@/components/rich-text/plain";
import { TaskDocsEditor } from "./task-docs-editor";

export interface TaskDocRow {
  id: number;
  title: string;
  bodyHtml: string;
  body: string;
  label: string;
  pinned: boolean;
  ownerName: string;
  updatedByName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

type SortMode = "newest" | "title";

/**
 * Tab Dokumentasi sebagai majalah dinding tim: kartu catatan (MOM, todo,
 * info) yang bisa dibaca sekilas, dengan penyematan dan pencarian.
 */
export function TaskDocsView({
  canWrite,
  onOpenTask,
}: {
  canWrite: boolean;
  onOpenTask: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const { data, reload } = useApi<TaskDocRow[]>("/api/task-docs");
  const docs = data ?? [];

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [readerId, setReaderId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; doc: TaskDocRow | null }>({ open: false, doc: null });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = docs
    .filter((doc) => {
      if (!needle) return true;
      return `${doc.title} ${doc.body}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "title") return a.title.localeCompare(b.title);
      return (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "");
    });

  const selected = docs.find((doc) => doc.id === readerId) ?? null;

  async function togglePinned(doc: TaskDocRow) {
    try {
      await apiPatch(`/api/task-docs/${doc.id}`, { pinned: !doc.pinned });
      reload();
    } catch {
      toast.error(t("docs.saveFailed"));
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      await apiDelete(`/api/task-docs/${deleteId}`);
      toast.success(t("docs.deleted"));
      if (readerId === deleteId) setReaderId(null);
      setDeleteId(null);
      reload();
    } catch {
      toast.error(t("docs.deleteFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("docs.search")}
            aria-label={t("docs.search")}
            className="h-8 w-56 pl-7 text-xs"
            data-field="docs-search"
          />
        </div>

        <Select
          value={sort}
          onValueChange={(value) => setSort(value === "title" ? "title" : "newest")}
          items={[
            { value: "newest", label: t("docs.sortNewest") },
            { value: "title", label: t("docs.sortTitle") },
          ]}
        >
          <SelectTrigger className="h-8 w-32 text-xs" aria-label={t("docs.sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("docs.sortNewest")}</SelectItem>
            <SelectItem value="title">{t("docs.sortTitle")}</SelectItem>
          </SelectContent>
        </Select>

        {canWrite && (
          <Button size="sm" className="ml-auto" onClick={() => setEditing({ open: true, doc: null })}>
            <Plus className="size-4" /> {t("docs.new")}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("docs.count", { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <Card size="sm">
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{t("docs.emptyTitle")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("docs.emptyHint")}</p>
            {canWrite && (
              <Button size="sm" className="mt-2" onClick={() => setEditing({ open: true, doc: null })}>
                <Plus className="size-4" /> {t("docs.new")}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((doc) => {
            const preview = htmlPreview(doc.bodyHtml ?? "", doc.body || t("docs.bodyEmpty"));
            return (
              <button
                key={doc.id}
                type="button"
                data-doc-card={doc.id}
                onClick={() => setReaderId(doc.id)}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-accent/40",
                  doc.pinned && "ring-1 ring-primary/25"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {doc.pinned && <Pin className="size-3 text-primary" aria-label={t("docs.pinned")} />}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatStamp(doc.updatedAt ?? doc.createdAt ?? "", language)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm font-medium">{doc.title}</p>
                <p className="line-clamp-3 text-xs text-muted-foreground">{preview}</p>
                <p className="mt-auto truncate text-[10px] text-muted-foreground">
                  {t("docs.updatedBy", { name: doc.updatedByName || doc.ownerName })}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setReaderId(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
          <DialogHeader className="shrink-0 pr-16">
            <DialogTitle className="text-base">{selected?.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
              <span>
                {selected
                  ? t("docs.updatedBy", {
                      name: selected.updatedByName || selected.ownerName,
                    })
                  : ""}
              </span>
              <span>·</span>
              <span>{selected ? formatStamp(selected.updatedAt ?? selected.createdAt ?? "", language) : ""}</span>
            </DialogDescription>
          </DialogHeader>

          {canWrite && selected && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={selected.pinned ? t("docs.unpin") : t("docs.pin")}
                title={selected.pinned ? t("docs.unpin") : t("docs.pin")}
                onClick={() => togglePinned(selected)}
                data-action="pin"
              >
                {selected.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t("docs.edit")}
                title={t("docs.edit")}
                onClick={() => setEditing({ open: true, doc: selected })}
                data-action="edit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t("common.delete")}
                title={t("common.delete")}
                onClick={() => setDeleteId(selected.id)}
                data-action="delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {selected && (
              <RichTextContent
                html={selected.bodyHtml || plainToHtml(selected.body)}
                emptyText={t("docs.bodyEmpty")}
                onOpenTask={onOpenTask}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setReaderId(null)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDocsEditor
        open={editing.open}
        doc={editing.doc}
        onOpenTask={onOpenTask}
        onClose={() => setEditing({ open: false, doc: null })}
        onSaved={() => {
          setEditing({ open: false, doc: null });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t("docs.deleteTitle")}
        description={t("docs.deleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
