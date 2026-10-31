"use client";

import { useState } from "react";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiPatch, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { htmlToPlain, plainToHtml } from "@/components/rich-text/plain";
import type { TaskDocRow } from "./task-docs-view";

type EditorProps = {
  open: boolean;
  doc: TaskDocRow | null;
  labelOptions: string[];
  onOpenTask: (id: string) => void;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Dialog tulis/ubah catatan Mading: judul, label, sematan, dan isi kaya
 * (Tiptap) dengan mention orang/tugas.
 *
 * Isian tinggal di `TaskDocsForm` yang di-`key` per catatan, jadi membuka
 * catatan lain menghasilkan isian baru tanpa efek penyelaras state.
 */
export function TaskDocsEditor({
  open,
  doc,
  labelOptions,
  onOpenTask,
  onClose,
  onSaved,
}: EditorProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-4xl">
        <TaskDocsForm
          key={doc ? `doc-${doc.id}` : "new"}
          doc={doc}
          labelOptions={labelOptions}
          onOpenTask={onOpenTask}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskDocsForm({ doc, labelOptions, onOpenTask, onClose, onSaved }: Omit<EditorProps, "open">) {
  const { t } = useLanguage();
  const initialHtml = doc ? doc.bodyHtml || plainToHtml(doc.body) : "";
  const [title, setTitle] = useState(doc?.title ?? "");
  const [label, setLabel] = useState(doc?.label ?? "");
  const [pinned, setPinned] = useState(doc?.pinned ?? false);
  const [html, setHtml] = useState(initialHtml);
  const [plain, setPlain] = useState(doc?.body || htmlToPlain(initialHtml));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      toast.error(t("docs.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: cleanTitle,
        body: plain || htmlToPlain(html),
        bodyHtml: html,
        label: label.trim(),
        pinned,
      };
      if (doc) {
        await apiPatch(`/api/task-docs/${doc.id}`, payload);
      } else {
        await apiPost("/api/task-docs", payload);
      }
      toast.success(t("docs.saved"));
      onSaved();
    } catch {
      toast.error(t("docs.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 pr-8">
        <DialogTitle>{doc ? t("docs.editorTitleEdit") : t("docs.editorTitleNew")}</DialogTitle>
        <DialogDescription>{t("docs.bodyPlaceholder")}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-title">{t("docs.titleLabel")}</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("docs.titlePlaceholder")}
            maxLength={160}
            data-field="doc-title"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <Label htmlFor="doc-label">{t("docs.labelLabel")}</Label>
            <Input
              id="doc-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t("docs.labelPlaceholder")}
              list="doc-label-options"
              maxLength={24}
              data-field="doc-label"
            />
            <datalist id="doc-label-options">
              {labelOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <Button
            type="button"
            variant={pinned ? "secondary" : "outline"}
            size="sm"
            onClick={() => setPinned((prev) => !prev)}
            aria-pressed={pinned}
            data-field="doc-pinned"
          >
            <Pin className="size-4" /> {t("docs.pinLabel")}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Label>{t("docs.bodyLabel")}</Label>
          <RichTextEditor
            value={html}
            onChange={(nextHtml, nextText) => {
              setHtml(nextHtml);
              setPlain(nextText);
            }}
            placeholder={t("docs.bodyPlaceholder")}
            onOpenTask={onOpenTask}
          />
        </div>
      </div>

      <DialogFooter className="shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving} data-action="doc-save">
          {saving ? t("docs.saving") : t("common.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
