"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  note?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}

export function DeleteAllDialog({
  open,
  onOpenChange,
  label,
  note,
  title,
  description,
  confirmLabel,
  onConfirm,
}: DeleteAllDialogProps) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </span>
            {title ?? t("deleteAll.title", { label })}
          </DialogTitle>
          <DialogDescription>
            {description ?? t("deleteAll.warning", { label })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
          <p>{t("deleteAll.backupNote")}</p>
          {note && <p>{note}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("deleteAll.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={busy}>
            {busy ? t("common.loading") : (confirmLabel ?? t("deleteAll.confirm"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
