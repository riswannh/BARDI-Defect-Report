"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { formatDateTime, formatIDR, formatNumber, MONTHS } from "@/lib/format";
import { matchesDefectPeriod, type PeriodFilter } from "@/lib/period";
import {
  apiDelete,
  apiPatch,
  apiPost,
  apiUpload,
  downloadUrl,
} from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type {
  Factory,
  ImportResult,
  PeriodType,
  Problem,
  Product,
  Status,
} from "@/lib/types";
import { productName } from "@/lib/analytics";
import { AdminGuard } from "@/components/admin-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
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
import {
  AlertTriangle,
  Camera,
  Download,
  FileDown,
  History,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  Wallet,
} from "lucide-react";
import { DefectFormDialog } from "./defect-form-dialog";
import { DefectDetailDialog } from "./defect-detail-dialog";
import {
  type DefectForm,
  type DefectRow,
  carryOverForm,
  emptyForm,
  localDateTimeValue,
  rowToForm,
} from "./defect-form";

export default function DefectsPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const { data: defectData, loading, reload } =
    useApi<DefectRow[]>("/api/defects");
  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: problemData } = useApi<Problem[]>("/api/problems");
  const { data: statusData } = useApi<Status[]>("/api/statuses");
  const { data: factoryData } = useApi<Factory[]>("/api/factories");

  const products = productData ?? [];
  const problems = problemData ?? [];
  const statuses = statusData ?? [];
  const factories = factoryData ?? [];

  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));
  const problemOptions = problems.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));
  const statusOptions = statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const factoryOptions = factories.map((f) => ({
    value: String(f.id),
    label: f.name,
  }));

  // Role Pabrik: filter produk hanya berisi produk yang punya data defect di pabriknya
  const scopedProductOptions = useMemo(() => {
    const allProducts = productData ?? [];
    if (isAdmin) {
      return allProducts.map((p) => ({ value: String(p.id), label: p.name }));
    }
    const seen = new Map<number, string>();
    for (const d of defectData ?? []) {
      const name =
        d.productName ?? allProducts.find((p) => p.id === d.productId)?.name;
      if (name) seen.set(d.productId, name);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [isAdmin, defectData, productData]);

  const [filterProduct, setFilterProduct] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProblem, setFilterProblem] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [month, setMonth] = useState("all");
  const [day, setDay] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQueue, setEditQueue] = useState<number[]>([]);
  const [editIndex, setEditIndex] = useState(0);
  const editingId = editQueue.length > 0 ? editQueue[editIndex] : null;
  const [form, setForm] = useState<DefectForm>(() => emptyForm());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailDefect, setDetailDefect] = useState<DefectRow | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Entri terakhir yang tersimpan/diubah → sumber nilai yang dibawa ke entri baru.
  const lastEntryRef = useRef<DefectForm | null>(null);

  const filterSignature = [
    filterProduct,
    filterFactory,
    filterStatus,
    filterProblem,
    search,
    period,
    month,
    day,
    weekEnd,
    from,
    to,
  ].join("|");
  const [pageState, setPageState] = useState({
    signature: filterSignature,
    page: 1,
  });
  const page =
    pageState.signature === filterSignature ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: filterSignature, page: next });
  const [pageSize, setPageSize] = useState(10);

  const visibleDefects = useMemo(() => {
    const defects = defectData ?? [];
    const products = productData ?? [];
    const problems = problemData ?? [];
    const statuses = statusData ?? [];
    const factories = factoryData ?? [];
    const f: PeriodFilter = {
      period,
      month,
      year: "",
      day,
      weekEnd,
      from,
      to,
    };
    const q = search.trim().toLowerCase();
    return defects.filter((d) => {
      if (filterProduct !== "all" && d.productId !== Number(filterProduct))
        return false;
      if (filterFactory !== "all" && d.factoryId !== Number(filterFactory))
        return false;
      if (filterStatus !== "all" && d.statusId !== Number(filterStatus))
        return false;
      if (filterProblem !== "all" && d.problemId !== Number(filterProblem))
        return false;
      if (!matchesDefectPeriod(d.timestamp, f)) return false;
      if (q) {
        const haystack = [
          d.codeGaransi,
          d.problemDetail,
          productName(products, d.productId),
          problems.find((p) => p.id === d.problemId)?.name ?? "",
          statuses.find((s) => s.id === d.statusId)?.name ?? "",
          factories.find((fx) => fx.id === d.factoryId)?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    defectData,
    productData,
    problemData,
    statusData,
    factoryData,
    filterProduct,
    filterFactory,
    filterStatus,
    filterProblem,
    search,
    period,
    month,
    day,
    weekEnd,
    from,
    to,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleDefects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedDefects = visibleDefects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalQty = visibleDefects.reduce((sum, d) => sum + d.quantity, 0);
  const totalVal = visibleDefects.reduce((sum, d) => sum + (d.value ?? 0), 0);

  function loadForm(id: number) {
    const d = (defectData ?? []).find((row) => row.id === id);
    if (!d) return;
    const next = rowToForm(d);
    lastEntryRef.current = next;
    setForm(next);
  }

  function openCreate() {
    setEditQueue([]);
    setEditIndex(0);
    // Satu shift biasanya mencatat beberapa defect pada produk/pabrik yang sama,
    // jadi pilihan terakhir dibawa lagi; sisanya dikosongkan dan timestamp diisi
    // waktu sekarang. Tanpa ini operator mengulang pilihan yang sama tiap entri.
    const seeded = lastEntryRef.current
      ? carryOverForm(lastEntryRef.current)
      : emptyForm();
    seeded.timestamp = localDateTimeValue();
    setForm(seeded);
    setDialogOpen(true);
  }

  function openEdit(d: DefectRow) {
    setEditQueue([d.id]);
    setEditIndex(0);
    loadForm(d.id);
    setDialogOpen(true);
  }

  function startBulkEdit() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setEditQueue(ids);
    setEditIndex(0);
    loadForm(ids[0]);
    setDialogOpen(true);
  }

  function finishEditFlow() {
    setEditQueue([]);
    setEditIndex(0);
    setDialogOpen(false);
    setSelectedIds(new Set());
    reload();
  }

  function advanceEdit() {
    if (editQueue.length === 0) return;
    const next = editIndex + 1;
    if (next < editQueue.length) {
      setEditIndex(next);
      loadForm(editQueue[next]);
    } else {
      finishEditFlow();
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (open) {
      setDialogOpen(true);
      return;
    }
    if (editingId !== null) {
      // Ubah / ubah massal: tombol X atau ESC lanjut ke data berikutnya
      // (atau selesai jika sudah yang terakhir).
      advanceEdit();
      return;
    }
    // Tambah baru: konfirmasi buang isian ditangani di dalam dialog form, yang
    // tahu apakah form sudah disentuh. Di sini cukup tutup.
    setDialogOpen(false);
  }

  async function handleSubmit(mode: "save" | "saveAndAddAnother" = "save") {
    const payload = {
      codeGaransi: form.codeGaransi.trim(),
      timestamp: form.timestamp,
      photosLink: form.photosLink.trim(),
      videosLink: form.videosLink.trim(),
      problemId: Number(form.problemId),
      problemDetail: form.problemDetail.trim(),
      productId: Number(form.productId),
      quantity: Number(form.quantity) || 0,
      statusId: Number(form.statusId),
      factoryId: Number(form.factoryId),
      value: Number(form.value) || 0,
    };
    if (!payload.codeGaransi || !payload.productId || !payload.factoryId) return;

    try {
      if (editingId === null) {
        await apiPost("/api/defects", payload);
        // Simpan sebagai acuan untuk entri berikutnya.
        lastEntryRef.current = form;
        if (mode === "saveAndAddAnother") {
          // Tetap di dialog, siap untuk defect berikutnya pada shift yang sama.
          const next = carryOverForm(form);
          next.timestamp = localDateTimeValue();
          setForm(next);
          reload();
          toast.success(t("defects.savedNext"));
          return;
        }
        setDialogOpen(false);
        reload();
      } else {
        await apiPatch(`/api/defects/${editingId}`, payload);
        lastEntryRef.current = form;
        advanceEdit();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  const allPageSelected =
    pagedDefects.length > 0 &&
    pagedDefects.every((d) => selectedIds.has(d.id));

  function toggleAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const d of pagedDefects) next.delete(d.id);
      } else {
        for (const d of pagedDefects) next.add(d.id);
      }
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    try {
      const res = await apiPost<{ deleted: number }>(
        "/api/defects/bulk-delete",
        { ids: Array.from(selectedIds) }
      );
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/defects/${id}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleDeleteAll() {
    try {
      const res = await apiDelete<{ deleted: number }>("/api/defects");
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<ImportResult>(
        "/api/excel/defects/import",
        file
      );
      setImportResult(result);
      setImportDialogOpen(true);
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati, ${result.errors.length} gagal.`
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  return (
    <AdminGuard>
      <div>
      <PageHeader
        title={t("defects.title")}
        description={t("defects.description")}
        actions={
          isAdmin && (
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
                onClick={() => downloadUrl("/api/excel/defects/template")}
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
                onClick={() => downloadUrl("/api/excel/defects/export")}
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
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> {t("common.add")}
              </Button>
            </>
          )
        }
      />

      <DefectFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingId={editingId}
        editPosition={{ index: editIndex, total: editQueue.length }}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        isAdmin={isAdmin}
        defects={defectData ?? []}
        factories={factories}
        productOptions={productOptions}
        problemOptions={problemOptions}
        statusOptions={statusOptions}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          title={t("defects.totalQty")}
          value={formatNumber(totalQty)}
          icon={AlertTriangle}
        />
        {isAdmin && (
          <SummaryCard
            title={t("defects.totalValue")}
            value={formatIDR(totalVal)}
            icon={Wallet}
          />
        )}
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("report.period")}</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(String(v) as PeriodType)}
              items={[
                { value: "daily", label: t("report.daily") },
                { value: "weekly", label: t("report.weekly") },
                { value: "monthly", label: t("report.monthly") },
                { value: "custom", label: t("report.custom") },
              ]}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("report.daily")}</SelectItem>
                <SelectItem value="weekly">{t("report.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("report.monthly")}</SelectItem>
                <SelectItem value="custom">{t("report.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "monthly" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.month")}</Label>
              <Select
                value={month}
                onValueChange={(v) => setMonth(String(v))}
                items={[
                  { value: "all", label: t("report.allMonths") },
                  ...MONTHS.map((m) => ({ value: m, label: m })),
                ]}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("report.allMonths")}</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {period === "daily" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("report.date")}</Label>
              <Input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          )}
          {period === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("report.weekEnd")}</Label>
              <Input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
              />
            </div>
          )}
          {period === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.from")}</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.to")}</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.search")}</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("defects.searchPlaceholder")}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.product")}</Label>
            <Select
              value={filterProduct}
              onValueChange={(v) => setFilterProduct(String(v))}
              items={[
                { value: "all", label: t("defects.allProducts") },
                ...scopedProductOptions,
              ]}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-80">
                <SelectItem value="all">{t("defects.allProducts")}</SelectItem>
                {scopedProductOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.problem")}</Label>
            <Select
              value={filterProblem}
              onValueChange={(v) => setFilterProblem(String(v))}
              items={[
                { value: "all", label: t("defects.allProblems") },
                ...problemOptions,
              ]}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("defects.allProblems")}</SelectItem>
                {problems.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.status")}</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(String(v))}
              items={[
                { value: "all", label: t("defects.allStatuses") },
                ...statusOptions,
              ]}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("defects.allStatuses")}</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.factory")}</Label>
              <Select
                value={filterFactory}
                onValueChange={(v) => setFilterFactory(String(v))}
                items={[
                  { value: "all", label: t("header.allFactories") },
                  ...factoryOptions,
                ]}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("header.allFactories")}
                  </SelectItem>
                  {factories.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium">
              {t("bulk.selected", { count: selectedIds.size })}
            </span>
            <Button size="sm" variant="outline" onClick={startBulkEdit}>
              <Pencil className="size-4" /> {t("bulk.edit")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> {t("bulk.delete")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("bulk.clear")}
            </Button>
          </div>
        )}

        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allPageSelected}
                    onChange={toggleAllPage}
                    aria-label="Pilih semua"
                  />
                </TableHead>
                <TableHead>{t("common.codeGaransi")}</TableHead>
                <TableHead>{t("common.timestamp")}</TableHead>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead>{t("common.problem")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.factory")}</TableHead>
                <TableHead className="text-right">
                  {t("common.quantity")}
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    {t("common.value")}
                  </TableHead>
                )}
                <TableHead>{t("common.media")}</TableHead>
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedDefects.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => setDetailDefect(d)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleOne(d.id)}
                      aria-label={`Pilih ${d.codeGaransi}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.codeGaransi}
                  </TableCell>
                  <TableCell>{formatDateTime(d.timestamp)}</TableCell>
                  <TableCell>{productName(products, d.productId)}</TableCell>
                  <TableCell>
                    {problems.find((p) => p.id === d.problemId)?.name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {statuses.find((s) => s.id === d.statusId)?.name ?? "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {factories.find((f) => f.id === d.factoryId)?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(d.quantity)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(d.value ?? 0)}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {d.photosLink && (
                        <a
                          href={d.photosLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Camera className="size-4" />
                        </a>
                      )}
                      {d.videosLink && (
                        <a
                          href={d.videosLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Video className="size-4" />
                        </a>
                      )}
                      {!d.photosLink && !d.videosLink && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(d.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {visibleDefects.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 11 : 9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {loading ? t("common.loading") : t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibleDefects.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              totalItems={visibleDefects.length}
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
      </Card>

      <DefectDetailDialog
        defect={detailDefect}
        onOpenChange={(open) => {
          if (!open) setDetailDefect(null);
        }}
        productName={
          detailDefect ? productName(products, detailDefect.productId) : ""
        }
        factories={factories}
        problems={problems}
        statuses={statuses}
        isAdmin={isAdmin}
      />

      <ImportResultDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        result={importResult}
      />

      <DeleteAllDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        label={t("defects.title")}
        onConfirm={handleDeleteAll}
      />

      <DeleteAllDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        label={t("defects.title")}
        title={t("bulk.deleteTitle", { count: selectedIds.size })}
        description={t("bulk.deleteWarning", { count: selectedIds.size })}
        confirmLabel={t("bulk.delete")}
        onConfirm={handleBulkDelete}
      />
      </div>
    </AdminGuard>
  );
}
