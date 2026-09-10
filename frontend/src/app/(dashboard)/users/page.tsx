"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import {
  apiDelete,
  apiPatch,
  apiPost,
  apiUpload,
  downloadUrl,
} from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type { Factory } from "@/lib/types";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
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
import { Download, FileDown, Pencil, Plus, Trash2, Upload } from "lucide-react";

interface UserRow {
  id: string;
  username: string | null;
  name: string;
  isAdmin: boolean;
  factoryId: number | null;
  factoryName: string | null;
}

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

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
  const [tab, setTab] = useState("users");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userData, reload: reloadUsers } =
    useApi<UserRow[]>("/api/users");
  const { data: factoryData, reload: reloadFactories } =
    useApi<Factory[]>("/api/factories");

  const factories = factoryData ?? [];
  const factoryOptions = factories.map((f) => ({
    value: String(f.id),
    label: f.name,
  }));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);

  const sortedUsers = useMemo(() => {
    const users = userData ?? [];
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [userData]);

  const [pageSize, setPageSize] = useState(10);
  const [pageState, setPageState] = useState({ signature: tab, page: 1 });
  const page = pageState.signature === tab ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: tab, page: next });

  const activeItems = tab === "users" ? sortedUsers : factories;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pagedUsers = sortedUsers.slice(start, end);
  const pagedFactories = factories.slice(start, end);

  function openCreate() {
    setEditingId(null);
    setForm(emptyUserForm);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditingId(u.id);
    setForm({
      username: u.username ?? u.name,
      password: "",
      factoryId: u.factoryId ? String(u.factoryId) : "",
      isAdmin: u.isAdmin ? "true" : "false",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isAdmin = form.isAdmin === "true";
    const factoryId = isAdmin ? null : Number(form.factoryId) || null;
    if (!form.username.trim()) return;

    try {
      if (editingId === null) {
        await apiPost("/api/users", {
          username: form.username.trim(),
          password: form.password,
          factoryId,
          isAdmin,
        });
      } else {
        await apiPatch(`/api/users/${editingId}`, {
          username: form.username.trim(),
          ...(form.password ? { password: form.password } : {}),
          factoryId,
          isAdmin,
        });
      }
      setDialogOpen(false);
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await apiDelete(`/api/users/${id}`);
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function addFactory(name: string) {
    try {
      await apiPost("/api/factories", { name });
      reloadFactories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah.");
    }
  }

  async function renameFactory(id: number, name: string) {
    try {
      await apiPatch(`/api/factories/${id}`, { name });
      reloadFactories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah.");
    }
  }

  async function deleteFactory(id: number) {
    try {
      await apiDelete(`/api/factories/${id}`);
      reloadFactories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<ImportSummary>(
        "/api/excel/users/import",
        file
      );
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati.`
      );
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} baris bermasalah.`);
      }
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadUrl("/api/excel/users/template")}
            >
              <FileDown className="size-4" /> {t("common.template")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" /> {t("common.importExcel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadUrl("/api/excel/users/export")}
            >
              <Download className="size-4" /> {t("common.exportExcel")}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
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
                  {pagedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        {u.isAdmin ? "-" : u.factoryName ?? "-"}
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
              {sortedUsers.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={sortedUsers.length}
                    page={currentPage}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factories" className="mt-4">
          <Card size="sm">
            <CardContent className="pt-4">
              <MasterList
                items={pagedFactories}
                addPlaceholder={t("users.newFactory")}
                onAdd={addFactory}
                onRename={renameFactory}
                onDelete={deleteFactory}
              />
              {factories.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={factories.length}
                    page={currentPage}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </div>
              )}
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
