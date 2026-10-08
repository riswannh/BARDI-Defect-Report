"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Headset, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import type { Factory, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { TicketStageBadge } from "./ticket-badges";
import { TicketFormDialog } from "./ticket-form-dialog";
import type { DefectPickerRow } from "./ticket-defect-picker";
import {
  getTicket,
  linkDefect,
  removeTicket,
  seedPreview,
  setDefects,
  visibleTickets,
  type PreviewTicket,
  type PreviewViewer,
  type TicketStage,
  type TicketTeam,
} from "./ticket-preview-data";

const TEAM_ITEMS = [
  { value: "cs", labelKey: "ticket.team.cs" },
  { value: "produk", labelKey: "ticket.team.produk" },
  { value: "pabrik", labelKey: "ticket.team.pabrik" },
] as const;

export default function TicketsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: factoryData } = useApi<Factory[]>("/api/factories");
  const products = useMemo(() => productData ?? [], [productData]);
  const factories = useMemo(() => factoryData ?? [], [factoryData]);

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((prev) => prev + 1);

  // ponytail: penyemaian data contoh dilakukan saat render (idempoten) supaya daftar
  // langsung terisi pada render yang sama dengan datangnya data master. Ganti ke
  // useApi("/api/tickets") saat backend Fase 1 siap.
  const seeded = Boolean(productData && factoryData);
  if (productData && factoryData) seedPreview(productData, factoryData, []);

  // Peran yang sedang dilihat (Fase 1: diambil dari user.team).
  const [team, setTeam] = useState<TicketTeam>("cs");
  const [factoryId, setFactoryId] = useState("");
  const activeFactoryId = factoryId ? Number(factoryId) : (factories[0]?.id ?? null);
  const viewer: PreviewViewer = useMemo(
    () => ({ team, factoryId: team === "pabrik" ? activeFactoryId : null }),
    [team, activeFactoryId],
  );

  // Contoh defect terkait: data asli dari API Data Defect untuk produk tiket ke-2.
  const linkedTicket = seeded ? getTicket(2) : undefined;
  const { data: defectData } = useApi<DefectPickerRow[]>(
    linkedTicket ? `/api/defects?productId=${linkedTicket.productId}` : null,
  );
  const linkedRef = useRef(false);
  useEffect(() => {
    if (!defectData || !linkedTicket || linkedRef.current) return;
    setDefects(linkedTicket.id, defectData.slice(0, 2).map(linkDefect));
    linkedRef.current = true;
    const timer = setTimeout(() => setVersion((prev) => prev + 1), 0);
    return () => clearTimeout(timer);
  }, [defectData, linkedTicket]);

  const tickets = useMemo(
    () => (seeded ? visibleTickets(viewer) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seeded, viewer, version],
  );

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const productOptions = products.map((product) => ({ value: String(product.id), label: product.name }));
  const stageOptions: Array<{ value: TicketStage; label: string }> = [
    { value: "produk", label: t("ticket.stage.produk") },
    { value: "pabrik", label: t(viewer.team === "cs" ? "ticket.stage.pabrikForCs" : "ticket.stage.pabrik") },
    { value: "selesai", label: t("ticket.stage.selesai") },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (productFilter !== "all" && String(ticket.productId) !== productFilter) return false;
      if (stageFilter !== "all" && ticket.stage !== stageFilter) return false;
      if (!q) return true;
      return [ticket.code, ticket.title, ticket.productName, ticket.virtualId, ticket.problemDetail]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q));
    });
  }, [tickets, search, productFilter, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const countBy = (stage: TicketStage) => tickets.filter((ticket) => ticket.stage === stage).length;

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreviewTicket | null>(null);

  const openTicket = (ticket: PreviewTicket) => {
    const query = new URLSearchParams({ as: viewer.team });
    if (viewer.factoryId) query.set("factoryId", String(viewer.factoryId));
    router.push(`/tickets/${ticket.id}?${query.toString()}`);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    removeTicket(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    toast.success(t("ticket.deleted"));
  };

  return (
    <>
      <PageHeader
        title={t("ticket.title")}
        description={t("ticket.description")}
        actions={
          team !== "pabrik" ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t("ticket.new")}
            </Button>
          ) : null
        }
      />

      <Card size="sm" className="mb-6 border-amber-300 bg-amber-50/60">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-sm">
          <span className="font-medium">{t("ticket.preview.banner")}</span>
          <span className="text-muted-foreground">{t("ticket.preview.note")}</span>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title={t("ticket.summary.total")} value={tickets.length} icon={Headset} />
        <SummaryCard title={t("ticket.summary.produk")} value={countBy("produk")} />
        <SummaryCard
          title={t(viewer.team === "cs" ? "ticket.summary.pabrikForCs" : "ticket.summary.pabrik")}
          value={countBy("pabrik")}
        />
        <SummaryCard title={t("ticket.summary.selesai")} value={countBy("selesai")} />
      </div>

      <Card size="sm" className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("ticket.viewAs")}</Label>
            <Select
              value={team}
              items={TEAM_ITEMS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
              onValueChange={(value) => {
                if (value === null) return;
                setTeam(value as TicketTeam);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {team === "pabrik" && factories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.factory")}</Label>
              <Select
                value={factoryId || String(activeFactoryId)}
                items={factories.map((factory) => ({ value: String(factory.id), label: factory.name }))}
                onValueChange={(value) => {
                  if (value === null) return;
                  setFactoryId(String(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {factories.map((factory) => (
                    <SelectItem key={factory.id} value={String(factory.id)}>
                      {factory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="ticket-search">{t("common.search")}</Label>
            <Input
              id="ticket-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("ticket.searchPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("common.product")}</Label>
            <Select
              value={productFilter}
              items={[{ value: "all", label: t("common.all") }, ...productOptions]}
              onValueChange={(value) => {
                if (value === null) return;
                setProductFilter(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-80">
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {productOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("common.status")}</Label>
            <Select
              value={stageFilter}
              items={[{ value: "all", label: t("common.all") }, ...stageOptions]}
              onValueChange={(value) => {
                if (value === null) return;
                setStageFilter(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {stageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ticket.table.code")}</TableHead>
              <TableHead>{t("ticket.table.title")}</TableHead>
              <TableHead>{t("common.product")}</TableHead>
              <TableHead>Virtual ID</TableHead>
              <TableHead>{t("ticket.table.stage")}</TableHead>
              {team !== "cs" && <TableHead>{t("common.factory")}</TableHead>}
              <TableHead>{t("ticket.table.updated")}</TableHead>
              <TableHead className="text-right">{t("ticket.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={team === "cs" ? 7 : 8} className="py-8 text-center text-muted-foreground">
                  {seeded ? t("ticket.empty") : t("common.loading")}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((ticket) => (
              <TableRow key={ticket.id} className="cursor-pointer" onClick={() => openTicket(ticket)}>
                <TableCell className="font-medium">{ticket.code}</TableCell>
                <TableCell className="max-w-64 truncate" title={ticket.title}>
                  {ticket.title}
                </TableCell>
                <TableCell>{ticket.productName}</TableCell>
                <TableCell>{ticket.virtualId}</TableCell>
                <TableCell>
                  <TicketStageBadge stage={ticket.stage} viewer={viewer} />
                </TableCell>
                {team !== "cs" && <TableCell>{ticket.factoryName || "-"}</TableCell>}
                <TableCell>{formatDateTime(ticket.updatedAt)}</TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  {team !== "pabrik" && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(ticket)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        totalItems={filtered.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <TicketFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        products={products}
        factories={factories}
        onCreated={(ticket) => {
          refresh();
          openTicket(ticket);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("ticket.deleteTitle")}
        description={t("ticket.deleteNote")}
        confirmLabel={t("ticket.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
