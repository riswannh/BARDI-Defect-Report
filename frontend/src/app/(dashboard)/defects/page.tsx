"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatIDR, formatNumber, MONTHS } from "@/lib/format";
import { matchesDefectPeriod, type PeriodFilter } from "@/lib/period";
import {
  defects as initialDefects,
  factories,
  factoryOptions,
  problems,
  problemOptions,
  products,
  productOptions,
  statuses,
  statusOptions,
} from "@/lib/mock-data";
import type { Defect, PeriodType } from "@/lib/types";
import { productName } from "@/lib/analytics";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Camera,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  Wallet,
} from "lucide-react";

interface DefectForm {
  codeGaransi: string;
  timestamp: string;
  photosLink: string;
  videosLink: string;
  problemId: string;
  problemDetail: string;
  productId: string;
  quantity: string;
  statusId: string;
  factoryId: string;
  value: string;
}

const emptyForm: DefectForm = {
  codeGaransi: "",
  timestamp: "2026-01-01T00:00",
  photosLink: "",
  videosLink: "",
  problemId: "",
  problemDetail: "",
  productId: "",
  quantity: "",
  statusId: "",
  factoryId: "",
  value: "",
};

export default function DefectsPage() {
  const { isAdmin, user } = useAuth();
  const [defects, setDefects] = useState<Defect[]>(initialDefects);
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DefectForm>(emptyForm);
  const [detailDefect, setDetailDefect] = useState<Defect | null>(null);

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

  const scopedDefects = useMemo(() => {
    return defects.filter((d) =>
      user?.isAdmin ? true : d.factoryId === user?.factoryId
    );
  }, [defects, user]);

  const visibleDefects = useMemo(() => {
    const f: PeriodFilter = { period, month, day, weekEnd, from, to };
    const q = search.trim().toLowerCase();
    return scopedDefects.filter((d) => {
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
    scopedDefects,
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
  const totalVal = visibleDefects.reduce((sum, d) => sum + d.value, 0);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(d: Defect) {
    setEditingId(d.id);
    setForm({
      codeGaransi: d.codeGaransi,
      timestamp: d.timestamp,
      photosLink: d.photosLink,
      videosLink: d.videosLink,
      problemId: String(d.problemId),
      problemDetail: d.problemDetail,
      productId: String(d.productId),
      quantity: String(d.quantity),
      statusId: String(d.statusId),
      factoryId: String(d.factoryId),
      value: String(d.value),
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    if (editingId === null) {
      const id = Math.max(0, ...defects.map((d) => d.id)) + 1;
      setDefects((prev) => [...prev, { id, ...payload }]);
    } else {
      setDefects((prev) =>
        prev.map((d) => (d.id === editingId ? { ...d, ...payload } : d))
      );
    }
    setDialogOpen(false);
  }

  function handleDelete(id: number) {
    setDefects((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="Data Defect"
        description="Kelola data produk cacat per pabrik."
        actions={
          isAdmin && (
            <>
              <Button variant="outline" size="sm">
                <Upload className="size-4" /> Import Excel
              </Button>
              <Button variant="outline" size="sm">
                <Download className="size-4" /> Export Excel
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> Tambah
              </Button>
            </>
          )
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "Tambah Data Defect" : "Ubah Data Defect"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Code Garansi</Label>
                <Input
                  value={form.codeGaransi}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codeGaransi: e.target.value }))
                  }
                  placeholder="WJKT-0001"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Timestamp</Label>
                <Input
                  type="datetime-local"
                  value={form.timestamp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, timestamp: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Link Foto</Label>
                <Input
                  value={form.photosLink}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, photosLink: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Link Video</Label>
                <Input
                  value={form.videosLink}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, videosLink: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Problem</Label>
                <Select
                  value={form.problemId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, problemId: String(v) }))
                  }
                  items={problemOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {problems.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.statusId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, statusId: String(v) }))
                  }
                  items={statusOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Produk</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, productId: String(v) }))
                  }
                  items={productOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Pabrik</Label>
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
              <div className="flex flex-col gap-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1.5">
                  <Label>Value (IDR)</Label>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, value: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Problem Detail</Label>
              <Textarea
                value={form.problemDetail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, problemDetail: e.target.value }))
                }
                placeholder="Penjelasan detail problem"
              />
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingId === null ? "Simpan" : "Perbarui"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          title="Total Quantity Defect"
          value={formatNumber(totalQty)}
          icon={AlertTriangle}
        />
        {isAdmin && (
          <SummaryCard
            title="Total Value Defect"
            value={formatIDR(totalVal)}
            icon={Wallet}
          />
        )}
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Periode</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(String(v) as PeriodType)}
              items={[
                { value: "daily", label: "Harian" },
                { value: "weekly", label: "Mingguan" },
                { value: "monthly", label: "Bulanan" },
                { value: "custom", label: "Rentang Tanggal" },
              ]}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Harian</SelectItem>
                <SelectItem value="weekly">Mingguan</SelectItem>
                <SelectItem value="monthly">Bulanan</SelectItem>
                <SelectItem value="custom">Rentang Tanggal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "monthly" && (
            <div className="flex flex-col gap-1.5">
              <Label>Bulan</Label>
              <Select
                value={month}
                onValueChange={(v) => setMonth(String(v))}
                items={[
                  { value: "all", label: "Semua Bulan" },
                  ...MONTHS.map((m) => ({ value: m, label: m })),
                ]}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bulan</SelectItem>
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
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          )}
          {period === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <Label>Akhir Minggu</Label>
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
                <Label>Dari</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Sampai</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Cari</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari code, problem, produk…"
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Produk</Label>
            <Select
              value={filterProduct}
              onValueChange={(v) => setFilterProduct(String(v))}
              items={[{ value: "all", label: "Semua Produk" }, ...productOptions]}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Produk</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Problem</Label>
            <Select
              value={filterProblem}
              onValueChange={(v) => setFilterProblem(String(v))}
              items={[{ value: "all", label: "Semua Problem" }, ...problemOptions]}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Problem</SelectItem>
                {problems.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(String(v))}
              items={[{ value: "all", label: "Semua Status" }, ...statusOptions]}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
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
              <Label>Pabrik</Label>
              <Select
                value={filterFactory}
                onValueChange={(v) => setFilterFactory(String(v))}
                items={[{ value: "all", label: "Semua Pabrik" }, ...factoryOptions]}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pabrik</SelectItem>
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

        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code Garansi</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pabrik</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Value</TableHead>
                )}
                <TableHead>Media</TableHead>
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
                      {formatIDR(d.value)}
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
                    colSpan={isAdmin ? 10 : 8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Tidak ada data.
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

      <Dialog
        open={detailDefect !== null}
        onOpenChange={(open) => {
          if (!open) setDetailDefect(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Defect</DialogTitle>
            <DialogDescription>
              {detailDefect?.codeGaransi ?? "-"}
            </DialogDescription>
          </DialogHeader>
          {detailDefect && (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Code Garansi</dt>
                <dd className="font-mono text-xs">{detailDefect.codeGaransi}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Timestamp</dt>
                <dd>{formatDateTime(detailDefect.timestamp)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Produk</dt>
                <dd className="font-medium">
                  {productName(products, detailDefect.productId)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Pabrik</dt>
                <dd>
                  {factories.find((f) => f.id === detailDefect.factoryId)
                    ?.name ?? "-"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Problem</dt>
                <dd>
                  {problems.find((p) => p.id === detailDefect.problemId)
                    ?.name ?? "-"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="secondary">
                    {statuses.find((s) => s.id === detailDefect.statusId)
                      ?.name ?? "-"}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Quantity</dt>
                <dd>{formatNumber(detailDefect.quantity)}</dd>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Value</dt>
                  <dd>{formatIDR(detailDefect.value)}</dd>
                </div>
              )}
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Problem Detail
                </dt>
                <dd className="whitespace-pre-wrap">
                  {detailDefect.problemDetail || "-"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Media</dt>
                <dd className="flex gap-3">
                  {detailDefect.photosLink ? (
                    <a
                      href={detailDefect.photosLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Camera className="size-4" /> Foto
                    </a>
                  ) : null}
                  {detailDefect.videosLink ? (
                    <a
                      href={detailDefect.videosLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Video className="size-4" /> Video
                    </a>
                  ) : null}
                  {!detailDefect.photosLink && !detailDefect.videosLink && (
                    <span className="text-muted-foreground">-</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
