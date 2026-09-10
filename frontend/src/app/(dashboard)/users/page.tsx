"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { factories as initialFactories, factoryOptions, users as initialUsers } from "@/lib/mock-data";
import type { Factory, User } from "@/lib/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface UserForm {
  username: string;
  password: string;
  factoryId: string;
  isAdmin: string;
}

const emptyUserForm: UserForm = {
  username: "",
  password: "",
  factoryId: "",
  isAdmin: "false",
};

export default function UsersPage() {
  const { t } = useLanguage();
  const [factories, setFactories] = useState<Factory[]>(initialFactories);
  const [users, setUsers] = useState<User[]>(initialUsers);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.id - b.id),
    [users]
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyUserForm);
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditingId(u.id);
    setForm({
      username: u.username,
      password: "",
      factoryId: u.factoryId ? String(u.factoryId) : "",
      isAdmin: u.isAdmin ? "true" : "false",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isAdmin = form.isAdmin === "true";
    const factoryId = isAdmin ? null : Number(form.factoryId) || null;
    if (!form.username.trim()) return;

    if (editingId === null) {
      const id = Math.max(0, ...users.map((u) => u.id)) + 1;
      setUsers((prev) => [
        ...prev,
        {
          id,
          username: form.username.trim(),
          factoryId,
          isAdmin,
        },
      ]);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingId
            ? { ...u, username: form.username.trim(), factoryId, isAdmin }
            : u
        )
      );
    }
    setDialogOpen(false);
  }

  function handleDeleteUser(id: number) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
      />

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">{t("users.tabAccounts")}</TabsTrigger>
          <TabsTrigger value="factories">{t("users.tabFactories")}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card size="sm">
            <CardContent className="pt-4">
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> {t("users.addUser")}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.username")}</TableHead>
                    <TableHead>{t("common.factory")}</TableHead>
                    <TableHead>{t("common.role")}</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>
                        {u.isAdmin
                          ? "-"
                          : factories.find((f) => f.id === u.factoryId)?.name ??
                            "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isAdmin ? "default" : "secondary"}>
                          {u.isAdmin ? t("common.admin") : t("common.factory")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteUser(u.id)}
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
        </TabsContent>

        <TabsContent value="factories" className="mt-4">
          <Card size="sm">
            <CardContent className="pt-4">
              <MasterList
                items={factories}
                addPlaceholder={t("users.newFactory")}
                onAdd={(name) =>
                  setFactories((prev) => [
                    ...prev,
                    { id: Math.max(0, ...prev.map((f) => f.id)) + 1, name },
                  ])
                }
                onRename={(id, name) =>
                  setFactories((prev) =>
                    prev.map((f) => (f.id === id ? { ...f, name } : f))
                  )
                }
                onDelete={(id) =>
                  setFactories((prev) => prev.filter((f) => f.id !== id))
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? t("users.addUser") : t("users.editUser")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.username")}</Label>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                {editingId === null
                  ? t("common.password")
                  : t("users.passwordHint")}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="••••••••"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.role")}</Label>
              <Select
                value={form.isAdmin}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, isAdmin: String(v) }))
                }
                items={[
                  { value: "false", label: t("common.factory") },
                  { value: "true", label: t("common.admin") },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">{t("common.factory")}</SelectItem>
                  <SelectItem value="true">{t("common.admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.isAdmin !== "true" && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.factory")}</Label>
                <Select
                  value={form.factoryId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, factoryId: String(v) }))
                  }
                  items={factoryOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="submit">
                {editingId === null
                  ? t("common.save")
                  : t("common.update")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
