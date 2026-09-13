"use client";

import { useLanguage } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { Camera, Video } from "lucide-react";
import type { DefectRow } from "./defect-form";
import type { Factory, Problem, Status } from "@/lib/types";

export function DefectDetailDialog({
  defect,
  onOpenChange,
  productName,
  factories,
  problems,
  statuses,
  isAdmin,
}: {
  defect: DefectRow | null;
  onOpenChange: (open: boolean) => void;
  productName: string;
  factories: Factory[];
  problems: Problem[];
  statuses: Status[];
  isAdmin: boolean;
}) {
  const { t } = useLanguage();

  return (
    <Dialog
      open={defect !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("defects.detailTitle")}</DialogTitle>
          <DialogDescription>{defect?.codeGaransi ?? "-"}</DialogDescription>
        </DialogHeader>
        {defect && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.codeGaransi")}
              </dt>
              <dd className="font-mono text-xs">{defect.codeGaransi}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.timestamp")}
              </dt>
              <dd>{formatDateTime(defect.timestamp)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.product")}
              </dt>
              <dd className="font-medium">{productName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.factory")}
              </dt>
              <dd>
                {factories.find((f) => f.id === defect.factoryId)?.name ?? "-"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.problem")}
              </dt>
              <dd>
                {problems.find((p) => p.id === defect.problemId)?.name ?? "-"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.status")}
              </dt>
              <dd>
                <Badge variant="secondary">
                  {statuses.find((s) => s.id === defect.statusId)?.name ?? "-"}
                </Badge>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.quantity")}
              </dt>
              <dd className="tabular-nums">{formatNumber(defect.quantity)}</dd>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t("common.value")}
                </dt>
                <dd className="tabular-nums">
                  {formatIDR(defect.value ?? 0)}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("defects.problemDetail")}
              </dt>
              <dd className="whitespace-pre-wrap">
                {defect.problemDetail || "-"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("common.media")}
              </dt>
              <dd className="flex gap-3">
                {defect.photosLink ? (
                  <a
                    href={defect.photosLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Camera className="size-4" /> {t("common.photo")}
                  </a>
                ) : null}
                {defect.videosLink ? (
                  <a
                    href={defect.videosLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Video className="size-4" /> {t("common.video")}
                  </a>
                ) : null}
                {!defect.photosLink && !defect.videosLink && (
                  <span className="text-muted-foreground">-</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
