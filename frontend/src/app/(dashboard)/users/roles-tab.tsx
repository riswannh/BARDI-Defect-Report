"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import {
  GRANTABLE_MENUS,
  MENU_LABEL_KEY,
  type MenuKey,
} from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface RoleRow {
  id: number;
  name: string;
  code: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: Record<string, { read: boolean; write: boolean }>;
}

type Matrix = Record<string, { read: boolean; write: boolean }>;

interface RoleForm {
  name: string;
  description: string;
  matrix: Matrix;
}

function blankMatrix(): Matrix {
  const matrix: Matrix = {};
  for (const menu of GRANTABLE_MENUS) {
    matrix[menu] = { read: false, write: false };
  }
  return matrix;
}

function isChecked(matrix: Matrix, menu: MenuKey, mode: "read" | "write") {
  const access = matrix[menu];
  if (!access) return false;
  return mode === "write" ? access.write : access.read;
}

export function RolesTab({
  onRolesChanged,
}: {
  /** Dipanggil setelah role dibuat/diubah/dihapus supaya induk ikut menyegarkan. */
  onRolesChanged?: () => void;
}) {
  const { t } = useLanguage();
  const { data, reload } = useApi<RoleRow[]>("/api/roles");
  const roles = data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState<RoleForm>({
    name: "",
    description: "",
    matrix: blankMatrix(),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", matrix: blankMatrix() });
    setOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    const matrix = blankMatrix();
    for (const menu of GRANTABLE_MENUS) {
      const access = role.permissions[menu];
      matrix[menu] = { read: access?.read ?? false, write: access?.write ?? false };
    }
    setForm({ name: role.name, description: role.description, matrix });
    setOpen(true);
  }

  // Dua saklar terpisah: mengubah Lihat tidak menyentuh Ubah, dan sebaliknya.
  function toggle(menu: MenuKey, mode: "read" | "write") {
    setForm((current) => {
      const matrix: Matrix = { ...current.matrix };
      const access = { ...(matrix[menu] ?? { read: false, write: false }) };
      access[mode] = !access[mode];
      matrix[menu] = access;
      return { ...current, matrix };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      permissions: GRANTABLE_MENUS.map((menu) => {
        const access = form.matrix[menu] ?? { read: false, write: false };
        return { menu, read: access.read, write: access.write };
      }),
    };

    try {
      if (editing === null) {
        await apiPost("/api/roles", payload);
        toast.success(t("users.roleCreated"));
      } else {
        await apiPatch(`/api/roles/${editing.id}`, payload);
        toast.success(t("users.roleUpdated"));
      }
      setOpen(false);
      reload();
      onRolesChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.roleSaveFailed"));
    }
  }

  async function handleDelete(role: RoleRow) {
    if (!window.confirm(t("users.roleDeleteConfirm", { name: role.name }))) {
      return;
    }
    try {
      await apiDelete(`/api/roles/${role.id}`);
      toast.success(t("users.roleDeleted"));
      reload();
      onRolesChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.roleSaveFailed"));
    }
  }

  return (
    <>
      <Card size="sm">
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t("users.rolesHint")}
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> {t("users.addRole")}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.roleName")}</TableHead>
              <TableHead>{t("users.roleDescription")}</TableHead>
              <TableHead className="w-32">{t("users.roleUsers")}</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                        {t("users.systemRole")}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {role.description || "-"}
                </TableCell>
                <TableCell>{role.userCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(role)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={role.isSystem}
                      onClick={() => handleDelete(role)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing === null ? t("users.addRole") : t("users.editRole")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.roleName")}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("users.roleNamePlaceholder")}
                required
                disabled={editing?.isSystem}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.roleDescription")}</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={editing?.isSystem}
              />
              {editing?.isSystem && (
                <p className="text-xs text-muted-foreground">
                  {t("users.systemRoleLocked")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("users.permissionMatrix")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("users.permissionMatrixHint")}
              </p>
              <div className="flex flex-col gap-1.5">
                {GRANTABLE_MENUS.map((menu) => {
                  const read = isChecked(form.matrix, menu, "read");
                  const write = isChecked(form.matrix, menu, "write");
                  return (
                    <div
                      key={menu}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm">
                        {t(MENU_LABEL_KEY[menu] as TranslationKey)}
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={read ? "default" : "outline"}
                          onClick={() => toggle(menu, "read")}
                        >
                          {read ? t("users.readOn") : t("users.readOff")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={write ? "default" : "outline"}
                          onClick={() => toggle(menu, "write")}
                        >
                          {write ? t("users.writeOn") : t("users.writeOff")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                {editing === null ? t("common.save") : t("common.update")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
