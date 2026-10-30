"use client";

import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiDelete, apiPost } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import type { TaskTypeRow } from "./task-types";

/**
 * Tab Pengaturan: daftar tipe pekerjaan yang bisa ditambah admin. Nilai yang
 * disimpan di task adalah `code`, jadi mengganti nama tetap aman.
 */
export function TaskSettingsView({
  types,
  canEdit,
  onChanged,
}: {
  types: TaskTypeRow[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addType() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiPost("/api/task-types", { name: trimmed });
      toast.success(t("tasks.settingsAdded"));
      setName("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  async function removeType(type: TaskTypeRow) {
    if (type.used > 0) {
      toast.error(t("tasks.settingsDeleteBlocked", { count: type.used }));
      return;
    }
    try {
      await apiDelete(`/api/task-types/${type.id}`);
      toast.success(t("tasks.settingsDeleted"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks.errorSave"));
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="size-4 text-muted-foreground" />
          {t("tasks.settingsTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("tasks.settingsHint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addType();
                }}
                placeholder={t("tasks.settingsAddPlaceholder")}
                maxLength={60}
              />
            </div>
            <Button size="sm" onClick={() => void addType()} disabled={saving || !name.trim()}>
              <Plus className="size-4" /> {t("tasks.settingsAdd")}
            </Button>
          </div>
        )}

        <div className="flex flex-col divide-y rounded-lg border">
          {types.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("tasks.settingsEmpty")}</p>
          )}
          {types.map((type) => (
            <div key={type.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{type.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{type.code}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {t("tasks.settingsUsed", { count: type.used })}
                </Badge>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={t("tasks.settingsDelete")}
                    onClick={() => void removeType(type)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
