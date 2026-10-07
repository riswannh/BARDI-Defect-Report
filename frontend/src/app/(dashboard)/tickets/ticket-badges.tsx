"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import type { AttachmentStorage, PreviewViewer, TicketStage, TicketTeam } from "./ticket-preview-data";

const STAGE_VARIANT: Record<TicketStage, "default" | "secondary" | "outline"> = {
  produk: "secondary",
  pabrik: "default",
  selesai: "outline",
};

const TEAM_LABEL: Record<TicketTeam, TranslationKey> = {
  cs: "ticket.team.cs",
  produk: "ticket.team.produk",
  pabrik: "ticket.team.pabrik",
};

const STORAGE_LABEL: Record<AttachmentStorage, TranslationKey> = {
  drive: "ticket.storage.drive",
  server: "ticket.storage.server",
  lokal: "ticket.storage.lokal",
};

export function teamLabelKey(team: TicketTeam): TranslationKey {
  return TEAM_LABEL[team];
}

export function storageLabelKey(storage: AttachmentStorage): TranslationKey {
  return STORAGE_LABEL[storage];
}

/** Tahap tiket. Untuk role CS, tahap "pabrik" tidak pernah disebut "Pabrik". */
export function TicketStageBadge({ stage, viewer }: { stage: TicketStage; viewer: PreviewViewer }) {
  const { t } = useLanguage();
  const key: TranslationKey =
    stage === "produk"
      ? "ticket.stage.produk"
      : stage === "pabrik"
        ? viewer.team === "cs"
          ? "ticket.stage.pabrikForCs"
          : "ticket.stage.pabrik"
        : "ticket.stage.selesai";

  return <Badge variant={STAGE_VARIANT[stage]}>{t(key)}</Badge>;
}

export function TicketStorageBadge({ storage }: { storage: AttachmentStorage }) {
  const { t } = useLanguage();
  return (
    <Badge variant="outline" className="font-normal">
      {t(STORAGE_LABEL[storage])}
    </Badge>
  );
}
