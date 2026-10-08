"use client";

import { useState } from "react";
import { Languages, Pencil, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { teamLabelKey } from "./ticket-badges";
import { factoryLanguage, translationSample } from "./ticket-translate";
import type { TicketMessage } from "./ticket-preview-data";

export function TicketMessageBubble({
  message,
  own,
  quoted,
  canEdit = false,
  canTranslate = false,
  autoTranslate = false,
  highlight = false,
  onEdit,
  onReply,
  onJumpToQuoted,
}: {
  message: TicketMessage;
  own: boolean;
  quoted?: TicketMessage | null;
  /** Hanya pesan sendiri dan belum dihapus yang bisa diubah. */
  canEdit?: boolean;
  /** Translate hanya ada di ruang Tim Produk ↔ Tim Pabrik. */
  canTranslate?: boolean;
  /** Tim pabrik: terjemahan langsung tampil tanpa menekan tombol. */
  autoTranslate?: boolean;
  highlight?: boolean;
  onEdit?: (messageId: number, body: string) => void;
  onReply?: (messageId: number) => void;
  onJumpToQuoted?: (messageId: number) => void;
}) {
  const { t, language } = useLanguage();
  const target = autoTranslate ? factoryLanguage(language) : language;
  // Terjemahan otomatis dihitung saat render (bukan disimpan) supaya ikut berubah
  // waktu bahasa UI diganti; `manual` menampung hasil klik tombol.
  const [manual, setManual] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const translated = showOriginal ? null : (manual ?? (autoTranslate ? translationSample(message.body, target) : null));

  if (message.kind === "sistem") {
    return (
      <div id={`ticket-message-${message.id}`} className="flex justify-center py-1">
        <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{message.body}</p>
      </div>
    );
  }

  const handleTranslate = () => {
    setShowOriginal(false);
    setManual(translationSample(message.body, target) ?? t("ticket.translate.sampleOnly"));
  };

  const handleShowOriginal = () => {
    setManual(null);
    setShowOriginal(true);
  };

  const saveEdit = () => {
    if (!draft.trim()) return;
    onEdit?.(message.id, draft);
    setEditing(false);
  };

  return (
    <div
      id={`ticket-message-${message.id}`}
      className={cn("flex flex-col gap-1 scroll-mt-4", own ? "items-end" : "items-start")}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{t(teamLabelKey(message.team))}</span>
        <span>{formatDateTime(message.createdAt)}</span>
        {message.editedAt && <span className="italic">{t("ticket.chat.edited")}</span>}
      </div>

      <div
        className={cn(
          "flex max-w-[42rem] flex-col gap-2 rounded-lg border px-3 py-2 text-sm",
          own ? "bg-primary/5" : "bg-muted/40",
          highlight && "ring-2 ring-primary",
        )}
      >
        {quoted && (
          <button
            type="button"
            onClick={() => onJumpToQuoted?.(quoted.id)}
            className="flex flex-col gap-0.5 rounded-md border-l-2 border-primary/60 bg-background/70 px-2 py-1 text-left text-xs"
          >
            <span className="font-medium text-muted-foreground">{t(teamLabelKey(quoted.team))}</span>
            <span className="line-clamp-2 text-muted-foreground">{quoted.body}</span>
          </button>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <div className="flex items-center gap-2">
              <Button size="xs" onClick={saveEdit} disabled={!draft.trim()}>
                {t("common.save")}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraft(message.body);
                  setEditing(false);
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{translated ?? message.body}</p>
        )}

        {translated && !editing && (
          <p className="border-t pt-1 text-xs text-muted-foreground">{t("ticket.translate.notice")}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onReply && (
          <Button variant="ghost" size="xs" onClick={() => onReply(message.id)}>
            <Reply className="size-3.5" />
            {t("ticket.chat.reply")}
          </Button>
        )}
        {canEdit && !editing && (
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            {t("ticket.chat.edit")}
          </Button>
        )}
        {canTranslate && (
          <Button variant="ghost" size="xs" onClick={translated ? handleShowOriginal : handleTranslate}>
            <Languages className="size-3.5" />
            {t(translated ? "ticket.translate.original" : "ticket.translate.action")}
          </Button>
        )}
      </div>
    </div>
  );
}
