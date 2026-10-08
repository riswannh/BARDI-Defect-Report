"use client";

import { useState } from "react";
import { Eye, FileAudio, FileText, FileVideo, Forward, ImageIcon, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TicketStorageBadge } from "./ticket-badges";
import type { TicketAttachment } from "./ticket-preview-data";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mime }: { mime: string }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime.startsWith("video/")) return <FileVideo className={className} />;
  if (mime.startsWith("audio/")) return <FileAudio className={className} />;
  return <FileText className={className} />;
}

/**
 * Lampiran sebagai bubble di dalam alur percakapan (bukan tumpukan di atas
 * textarea). Tombol pratinjau membuka berkas lewat object URL lokal.
 */
export function TicketAttachmentBubble({
  attachment,
  own = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  attachment: TicketAttachment;
  own?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (attachmentId: number) => void;
}) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<TicketAttachment | null>(null);

  return (
    <div
      className={cn(
        "flex max-w-[26rem] items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        own ? "bg-primary/5" : "bg-muted/40",
        selected && "ring-2 ring-primary",
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          className="size-4 shrink-0"
          checked={selected}
          onChange={() => onToggleSelect?.(attachment.id)}
          aria-label={attachment.fileName}
        />
      )}
      <AttachmentIcon mime={attachment.mime} />
      <span className="min-w-0 flex-1 truncate" title={attachment.fileName}>
        {attachment.fileName}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatSize(attachment.size)}</span>
      {attachment.forwardedFromId !== undefined && (
        <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
          <Forward className="size-3" />
          {t("ticket.forward.badge")}
        </Badge>
      )}
      <TicketStorageBadge storage={attachment.storage} />
      {attachment.objectUrl ? (
        <Button variant="ghost" size="xs" onClick={() => setPreview(attachment)}>
          <Eye className="size-3.5" />
          {t("ticket.attachments.preview")}
        </Button>
      ) : (
        <Badge variant="secondary" className="shrink-0 font-normal">
          {t("ticket.attachments.noPreview")}
        </Badge>
      )}

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="size-4" />
              {preview?.fileName}
            </DialogTitle>
            <DialogDescription>{t("ticket.attachments.localPreview")}</DialogDescription>
          </DialogHeader>
          {preview?.objectUrl && preview.mime.startsWith("image/") && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview.objectUrl} alt={preview.fileName} className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
          {preview?.objectUrl && preview.mime.startsWith("video/") && (
            <video src={preview.objectUrl} controls className="max-h-[70vh] w-full rounded-lg" />
          )}
          {preview?.objectUrl && preview.mime.startsWith("audio/") && (
            <audio src={preview.objectUrl} controls className="w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
