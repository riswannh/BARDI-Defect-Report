"use client";

import { useState } from "react";
import { FileAudio, FileText, FileVideo, ImageIcon, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { TicketStorageBadge } from "./ticket-badges";
import type { TicketAttachment } from "./ticket-preview-data";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  return FileText;
}

export function TicketAttachmentList({ attachments }: { attachments: TicketAttachment[] }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<TicketAttachment | null>(null);

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("ticket.attachments.empty")}</p>;
  }

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((file) => {
          const Icon = iconFor(file.mime);
          const canPreview = Boolean(file.objectUrl);
          return (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="max-w-[14rem] truncate" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
              <TicketStorageBadge storage={file.storage} />
              {canPreview ? (
                <Button variant="ghost" size="xs" onClick={() => setPreview(file)}>
                  {t("ticket.attachments.preview")}
                </Button>
              ) : (
                <Badge variant="secondary" className="font-normal">
                  {t("ticket.attachments.noPreview")}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="size-4" />
              {preview?.fileName}
            </DialogTitle>
            <DialogDescription>
              {t("ticket.attachments.localPreview")}
            </DialogDescription>
          </DialogHeader>
          {preview?.objectUrl && preview.mime.startsWith("image/") && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview.objectUrl} alt={preview.fileName} className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
          {preview?.objectUrl && preview.mime.startsWith("video/") && (
            <video src={preview.objectUrl} controls className="max-h-[70vh] w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
