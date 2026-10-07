"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { teamLabelKey } from "./ticket-badges";
import type { TicketMessage } from "./ticket-preview-data";

/**
 * ponytail: kamus contoh untuk pratinjau — Fase 2 menggantinya dengan
 * POST /api/translate (LibreTranslate self-host di VPS BARDI + cache).
 */
const SAMPLE: Record<string, { id: string; en: string; zh: string }> = {
  "收到，我们检查同一批次的扬声器模块。": {
    id: "Diterima, kami periksa modul speaker dari batch yang sama.",
    en: "Received, we are checking the speaker module from the same batch.",
    zh: "收到，我们检查同一批次的扬声器模块。",
  },
  "Pabrik, mohon dicek modul speaker batch ini.": {
    id: "Pabrik, mohon dicek modul speaker batch ini.",
    en: "Factory, please check the speaker module for this batch.",
    zh: "工厂，请检查这一批次的扬声器模块。",
  },
  "Sudah kami cek, kemungkinan modul daya. Kami uji dulu di lab.": {
    id: "Sudah kami cek, kemungkinan modul daya. Kami uji dulu di lab.",
    en: "We have checked it; it is likely the power module. We will test it in the lab first.",
    zh: "我们已检查，可能是电源模块。先在实验室测试。",
  },
  "Kami sudah uji 2 unit, gejalanya sama. Kami eskalasi ke pabrik.": {
    id: "Kami sudah uji 2 unit, gejalanya sama. Kami eskalasi ke pabrik.",
    en: "We tested 2 units, the symptom is the same. We are escalating to the factory.",
    zh: "我们测试了 2 台，症状相同。我们升级到工厂处理。",
  },
};

export function TicketMessageBubble({ message, own }: { message: TicketMessage; own: boolean }) {
  const { t, language } = useLanguage();
  const [translated, setTranslated] = useState<string | null>(null);

  if (message.kind === "sistem") {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{message.body}</p>
      </div>
    );
  }

  const handleTranslate = () => {
    const sample = SAMPLE[message.body];
    setTranslated(sample ? sample[language] : t("ticket.translate.sampleOnly"));
  };

  return (
    <div className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{t(teamLabelKey(message.team))}</span>
        <span>{formatDateTime(message.createdAt)}</span>
      </div>
      <div
        className={cn(
          "max-w-[42rem] rounded-lg border px-3 py-2 text-sm",
          own ? "bg-primary/5" : "bg-muted/40",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{translated ?? message.body}</p>
        {translated && (
          <p className="mt-1 border-t pt-1 text-xs text-muted-foreground">{t("ticket.translate.notice")}</p>
        )}
      </div>
      <Button variant="ghost" size="xs" onClick={translated ? () => setTranslated(null) : handleTranslate}>
        <Languages className="size-3.5" />
        {t(translated ? "ticket.translate.original" : "ticket.translate.action")}
      </Button>
    </div>
  );
}
