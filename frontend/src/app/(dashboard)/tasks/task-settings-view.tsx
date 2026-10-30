"use client";

import { useState } from "react";
import { Layers, Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { ownerColor, typesOfOwner, type TaskOwner, type TaskTypeRow } from "./task-types";

/** Pemilih akun yang dipakai bersama oleh kartu warna & kartu tipe. */
function OwnerPicker({
  ownerId,
  users,
  isAdmin,
  onChange,
}: {
  ownerId: string;
  users: TaskOwner[];
  isAdmin: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useLanguage();
  if (!isAdmin) return null;
  return (
    <div className="flex w-56 flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{t("tasks.settingsOwner")}</span>
      <Select
        value={ownerId}
        onValueChange={(value) => onChange(value as string)}
        items={users.map((item) => ({ value: item.id, label: item.name }))}
      >
        <SelectTrigger className="h-8 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {users.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Tab Pengaturan Rencana Kerja. Dua kartu terpisah: warna kartu kalender per
 * akun, dan daftar tipe pekerjaan per akun.
 */
export function TaskSettingsView({
  types,
  me,
  users,
  isAdmin,
  onChanged,
}: {
  types: TaskTypeRow[];
  me: { id: string; name: string };
  users: TaskOwner[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(me.id);
  const [saving, setSaving] = useState(false);

  const targetId = isAdmin ? ownerId : me.id;
  const targetName = users.find((item) => item.id === targetId)?.name ?? me.name;
  const owned = typesOfOwner(types, targetId);
  const cardColor = ownerColor(users, targetId);

  async function addType() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiPost("/api/task-types", { name: trimmed, userId: targetId });
      toast.success(t("tasks.settingsAdded"));
      setName("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  async function saveColor(next: string) {
    try {
      await apiPatch("/api/tasks/calendars", { userId: targetId, color: next });
      toast.success(t("tasks.settingsColorSaved"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks.errorSave"));
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
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="size-4 text-muted-foreground" />
            {t("tasks.settingsColorTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("tasks.settingsColorHint")}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <OwnerPicker ownerId={ownerId} users={users} isAdmin={isAdmin} onChange={setOwnerId} />
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
              style={{ borderLeftWidth: 6, borderLeftColor: cardColor }}
            >
              {targetName}
            </span>
            <input
              type="color"
              value={cardColor}
              onChange={(event) => void saveColor(event.target.value)}
              aria-label={t("tasks.settingsColor")}
              className="h-9 w-14 cursor-pointer rounded-md border bg-background p-0.5"
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="size-4 text-muted-foreground" />
            {t("tasks.settingsTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("tasks.settingsHint")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <OwnerPicker ownerId={ownerId} users={users} isAdmin={isAdmin} onChange={setOwnerId} />
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("tasks.settingsAddPlaceholder")}
              </span>
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

          <div className="flex flex-col divide-y rounded-lg border">
            {owned.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {t("tasks.settingsEmpty")}
              </p>
            )}
            {owned.map((type) => (
              <div key={`${type.userId}:${type.id}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{type.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {type.code}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {t("tasks.settingsUsed", { count: type.used })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={t("tasks.settingsDelete")}
                    onClick={() => void removeType(type)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
