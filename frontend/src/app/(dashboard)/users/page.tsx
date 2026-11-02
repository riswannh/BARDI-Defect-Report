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
import { PABRIK_ROLE_CODE } from "@/lib/permissions";
import type { Factory, ImportResult } from "@/lib/types";
import { AdminGuard } from "@/components/admin-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { MasterList } from "@/components/master-list";
import { FactoryProductsDialog } from "./factory-products-dialog";
import { RolesTab, type RoleRow } from "./roles-tab";
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
import { Download, FileDown, History, Pencil, Plus, Trash2, Upload } from "lucide-react";

interface UserRow {
  id: string;
  /** Nama tampilan (boleh spasi) — yang muncul di UI. */
  name: string;
  /** Kunci login, selalu lowercase. */
  username: string | null;
  /** Ejaan username asli seperti diketik. */
  displayUsername: string | null;
  jabatan: string;
  isAdmin: boolean;
  factoryId: number | null;
  factoryName: string | null;
  roleId: number | null;
  roleName: string | null;
  roleCode: string | null;
  /** Semua group role user (bisa lebih dari satu). */
  roles?: Array<{ id: number; name: string; code: string }>;
  roleIds?: number[];
}

interface UserForm {
  name: string;
  username: string;
  jabatan: string;
  password: string;
  factoryId: string;
  /** Super admin: semua menu, tidak terikat pabrik. */
  isAdmin: boolean;
  /** Group role terpilih; izinnya digabung (union) di server. */
  roleIds: number[];
}

const emptyUserForm: UserForm = {
  name: "",
  username: "",
  jabatan: "",
  password: "",
  factoryId: "",
  isAdmin: false,
  roleIds: [],
};

export default function UsersPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("users");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userData, reload: reloadUsers } =
    useApi<UserRow[]>("/api/users");
  const { data: roleData, reload: reloadRoles } =
    useApi<RoleRow[]>("/api/roles");
  const roles = roleData ?? [];
  const { data: factoryData, reload: reloadFactories } =
    useApi<Factory[]>("/api/factories");

  const factories = factoryData ?? [];
  /** Pabrik yang sedang dikaitkan produknya (null = dialog tertutup). */
  const [linkFactory, setLinkFactory] = useState<Factory | null>(null);
  const factoryOptions = factories.map((f) => ({
    value: String(f.id),
    label: f.name,
  }));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);

  // Akses akun: satu baris "Admin" plus daftar group role, semuanya bisa
  // dicentang langsung (multiple). Pilihan pabrik hanya relevan kalau akun
  // memegang group role Pabrik.
  const pickedRoles = roles.filter((role) => form.roleIds.includes(role.id));
  const hasFactoryRole = pickedRoles.some(
    (role) => role.code === PABRIK_ROLE_CODE || /pabrik|factory/i.test(role.name)
  );

  function toggleRole(roleId: number, checked: boolean) {
    setForm((f) => {
      const roleIds = checked
        ? [...f.roleIds, roleId]
        : f.roleIds.filter((id) => id !== roleId);
      // Begitu group role Pabrik dicentang dan pabriknya belum dipilih, isi
      // dengan pabrik pertama supaya akun tidak tersimpan tanpa pabrik.
      const isFactoryRole = roles.some(
        (role) =>
          role.id === roleId &&
          (role.code === PABRIK_ROLE_CODE || /pabrik|factory/i.test(role.name))
      );
      const factoryId =
        checked && isFactoryRole && !f.factoryId && factories.length > 0
          ? String(factories[0].id)
          : f.factoryId;
      return { ...f, roleIds, factoryId };
    });
  }

  const sortedUsers = useMemo(() => {
    const users = userData ?? [];
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [userData]);

  const [pageSize, setPageSize] = useState(10);
  const [pageState, setPageState] = useState({ signature: tab, page: 1 });
  const page = pageState.signature === tab ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: tab, page: next });

  const activeItems =
    tab === "users" ? sortedUsers : tab === "factories" ? factories : [];
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
      name: u.name,
      username: u.displayUsername ?? u.username ?? "",
      jabatan: u.jabatan ?? "",
      password: "",
      factoryId: u.factoryId ? String(u.factoryId) : "",
      isAdmin: u.isAdmin,
      roleIds:
        u.roleIds && u.roleIds.length > 0
          ? u.roleIds
          : u.roleId
            ? [u.roleId]
            : [],
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isAdmin = form.isAdmin;
    // Pabrik hanya disimpan kalau akun memang memegang group role Pabrik.
    const factoryId = isAdmin || !hasFactoryRole ? null : Number(form.factoryId) || null;
    const roleIds = isAdmin ? [] : form.roleIds;
    if (!form.name.trim() || !form.username.trim()) return;

    // Nama dan username dua hal terpisah: nama tampilan boleh spasi, username
    // kunci login (server menormalkan jadi lowercase & menyimpan ejaan asli).
    const name = form.name.trim();
    const username = form.username.trim();
    const jabatan = form.jabatan.trim();

    try {
      if (editingId === null) {
        await apiPost("/api/users", {
          name,
          username,
          jabatan,
          password: form.password,
          factoryId,
          isAdmin,
          roleIds,
          roleId: roleIds[0] ?? null,
        });
      } else {
        await apiPatch(`/api/users/${editingId}`, {
          name,
          username,
          jabatan,
          ...(form.password ? { password: form.password } : {}),
          factoryId,
          isAdmin,
          roleIds,
          roleId: roleIds[0] ?? null,
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
      const result = await apiUpload<ImportResult>(
        "/api/excel/users/import",
        file
      );
      setImportResult(result);
      setImportDialogOpen(true);
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati, ${result.errors.length} gagal.`
      );
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  const deleteAllLabel =
    tab === "users" ? t("users.tabAccounts") : t("common.factory");

  async function handleDeleteAll() {
    try {
      const endpoint = tab === "users" ? "/api/users" : "/api/factories";
      const res = await apiDelete<{ deleted: number }>(endpoint);
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      if (tab === "users") reloadUsers();
      else reloadFactories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <AdminGuard>
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
            {importResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <History className="size-4" /> {t("import.lastResult")}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="size-4" /> {t("deleteAll.button")}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="users">{t("users.tabAccounts")}</TabsTrigger>
          <TabsTrigger value="roles">{t("users.tabRoles")}</TabsTrigger>
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
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("common.username")}</TableHead>
                    <TableHead>{t("common.jabatan")}</TableHead>
                    <TableHead>{t("common.factory")}</TableHead>
                    <TableHead>{t("common.role")}</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.username ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.jabatan || "-"}
                      </TableCell>
                      <TableCell>
                        {u.isAdmin ? "-" : u.factoryName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isAdmin ? "default" : "secondary"}>
                          {u.isAdmin
                            ? t("common.admin")
                            : (u.roles && u.roles.length > 0
                                ? u.roles.map((role) => role.name).join(", ")
                                : u.roleName) ?? t("users.noRole")}
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

        <TabsContent value="roles" className="mt-4">
          <RolesTab
            onRolesChanged={() => {
              // Daftar role di tab Akun User ikut disegarkan; hapus role juga
              // mengosongkan role user, jadi daftar user ikut dimuat ulang.
              reloadRoles();
              reloadUsers();
            }}
          />
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
                onLink={(item) => setLinkFactory(item as Factory)}
                linkLabel={t("users.linkProducts")}
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

      <FactoryProductsDialog
        factory={linkFactory}
        onOpenChange={(open) => {
          if (!open) setLinkFactory(null);
        }}
        onSaved={reloadFactories}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? t("users.addUser") : t("users.editUser")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("users.namePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("users.nameHint")}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.username")}</Label>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="username"
              />
              <p className="text-xs text-muted-foreground">
                {t("users.usernameHint")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.jabatan")}</Label>
              <Input
                value={form.jabatan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, jabatan: e.target.value }))
                }
                placeholder={t("profile.jabatanPlaceholder")}
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
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>{t("common.role")}</Label>
              <div className="max-h-44 overflow-y-auto overscroll-contain rounded-xl border border-input p-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={form.isAdmin}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isAdmin: e.target.checked,
                        roleIds: e.target.checked ? [] : f.roleIds,
                      }))
                    }
                  />
                  <span className="font-medium">{t("common.admin")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("users.adminHint")}
                  </span>
                </label>
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={
                      form.isAdmin
                        ? "flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-sm opacity-50"
                        : "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                    }
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      disabled={form.isAdmin}
                      checked={form.roleIds.includes(role.id)}
                      onChange={(e) => toggleRole(role.id, e.target.checked)}
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.isAdmin ? t("users.adminRoleHint") : t("users.roleMultiHint")}
              </p>
            </div>
            {!form.isAdmin && hasFactoryRole && (
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

      <ImportResultDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        result={importResult}
      />

      <DeleteAllDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        label={deleteAllLabel}
        note={tab === "users" ? t("deleteAll.usersNote") : undefined}
        onConfirm={handleDeleteAll}
      />
      </div>
    </AdminGuard>
  );
}
