"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatIDR, formatNumber, MONTHS } from "@/lib/format";
import {
  factories,
  factoryOptions,
  products,
  productOptions,
  sales as initialSales,
} from "@/lib/mock-data";
import type { Sale } from "@/lib/types";
import { productName } from "@/lib/analytics";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

interface SaleForm {
  productId: string;
  factoryId: string;
  month: string;
  quantity: string;
  value: string;
}

const emptyForm: SaleForm = {
  productId: "",
  factoryId: "",
  month: "Jan",
  quantity: "",
  value: "",
};

export default function SalesPage() {
  const { isAdmin, user } = useAuth();
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SaleForm>(emptyForm);

  const filterSignature = [filterProduct, filterFactory, filterMonth, search].join(
    "|"
  );
  const [pageState, setPageState] = useState({
    signature: filterSignature,
    page: 1,
  });
  const page =
    pageState.signature === filterSignature ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: filterSignature, page: next });
  const [pageSize, setPageSize] = useState(10);

  const scopedSales = useMemo(() => {
    return sales.filter((s) =>
      user?.isAdmin ? true : s.factoryId === user?.factoryId
    );
  }, [sales, user]);

  const visibleSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedSales.filter((s) => {
      if (filterProduct !== "all" && s.productId !== Number(filterProduct))
        return false;
      if (filterFactory !== "all" && s.factoryId !== Number(filterFactory))
        return false;
      if (filterMonth !== "all" && s.month !== filterMonth) return false;
      if (q) {
        const haystack = [
          productName(products, s.productId),
          factories.find((f) => f.id === s.factoryId)?.name ?? "",
          s.month,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scopedSales, filterProduct, filterFactory, filterMonth, search]);

  const totalPages = Math.max(1, Math.ceil(visibleSales.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSales = visibleSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalQty = visibleSales.reduce((sum, s) => sum + s.quantity, 0);
  const totalVal = visibleSales.reduce((sum, s) => sum + s.value, 0);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: Sale) {
    setEditingId(s.id);
    setForm({
      productId: String(s.productId),
      factoryId: String(s.factoryId),
      month: s.month,
      quantity: String(s.quantity),
      value: String(s.value),
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      productId: Number(form.productId),
      factoryId: Number(form.factoryId),
      month: form.month,
      quantity: Number(form.quantity) || 0,
      value: Number(form.value) || 0,
    };
    if (!payload.productId || !payload.factoryId) return;

    if (editingId === null) {
      const id = Math.max(0, ...sales.map((s) => s.id)) + 1;
      setSales((prev) => [...prev, { id, ...payload }]);
    } else {
      setSales((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...payload } : s))
      );
    }
    setDialogOpen(false);
  }

  function handleDelete(id: number) {
    setSales((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="Data Sales"
        description="Kelola data penjualan per produk, pabrik, dan bulan."
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "Tambah Sales" : "Ubah Sales"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <Label>Bulan</Label>
              <Select
                value={form.month}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, month: String(v) }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
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
          title="Total Quantity Sales"
          value={formatNumber(totalQty)}
          icon={ShoppingCart}
        />
        {isAdmin && (
          <SummaryCard
            title="Total Value Sales"
            value={formatIDR(totalVal)}
            icon={Wallet}
          />
        )}
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Produk</Label>
            <Select
              value={filterProduct}
              onValueChange={(v) => setFilterProduct(String(v))}
              items={[{ value: "all", label: "Semua Produk" }, ...productOptions]}
            >
              <SelectTrigger className="w-44">
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
          <div className="flex flex-col gap-1.5">
            <Label>Bulan</Label>
            <Select
              value={filterMonth}
              onValueChange={(v) => setFilterMonth(String(v))}
              items={[
                { value: "all", label: "Semua" },
                ...MONTHS.map((m) => ({ value: m, label: m })),
              ]}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Cari</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk, pabrik, bulan…"
              className="w-56"
            />
          </div>
        </CardContent>

        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Pabrik</TableHead>
                <TableHead>Bulan</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Value</TableHead>
                )}
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {productName(products, s.productId)}
                  </TableCell>
                  <TableCell>
                    {factories.find((f) => f.id === s.factoryId)?.name ?? "-"}
                  </TableCell>
                  <TableCell>{s.month}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(s.quantity)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(s.value)}
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {visibleSales.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 6 : 4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibleSales.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              totalItems={visibleSales.length}
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
    </div>
  );
}
