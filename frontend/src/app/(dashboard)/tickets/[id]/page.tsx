"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Paperclip, RotateCcw, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import type { Factory, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { TicketAttachmentList } from "../ticket-attachment-list";
import { TicketStageBadge } from "../ticket-badges";
import { TicketDefectList, TicketDefectPicker, type DefectPickerRow } from "../ticket-defect-picker";
import { TicketMessageBubble } from "../ticket-message-bubble";
import {
  addMessage,
  escalate,
  getTicket,
  linkDefect,
  reopenTicket,
  seedPreview,
  setDefects,
  solveTicket,
  visibleAttachments,
  visibleMessages,
  type PreviewViewer,
  type TicketDefectLink,
  type TicketTeam,
} from "../ticket-preview-data";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "-"}</dd>
    </div>
  );
}

export default function TicketDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const ticketId = Number(params.id);

  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: factoryData } = useApi<Factory[]>("/api/factories");
  const products = useMemo(() => productData ?? [], [productData]);
  const factories = useMemo(() => factoryData ?? [], [factoryData]);

  // ponytail: penyemaian data contoh dilakukan saat render (idempoten) supaya tiket
  // sudah ada pada render yang sama dengan datangnya data master.
  const seeded = Boolean(productData && factoryData);
  if (productData && factoryData) seedPreview(productData, factoryData, []);

  // Penyegaran: perubahan penghitung memaksa render ulang dari data pratinjau di memori.
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  // Simulasi tanya-jawab lintas tim: halaman ini menyegarkan diri tiap 10 detik.
  useEffect(() => {
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, []);

  const team = (searchParams.get("as") ?? "cs") as TicketTeam;
  const factoryParam = searchParams.get("factoryId");

  const ticket = seeded ? getTicket(ticketId) : undefined;
  const viewer: PreviewViewer = useMemo(
    () => ({
      team,
      factoryId: team === "pabrik" ? (factoryParam ? Number(factoryParam) : (ticket?.factoryId ?? null)) : null,
    }),
    [team, factoryParam, ticket],
  );

  // Lengkapi defect terkait dari API Data Defect kalau dibuka langsung dari URL.
  const needsDefects = Boolean(ticket && ticket.stage !== "produk" && ticket.defects.length === 0);
  const { data: defectData } = useApi<DefectPickerRow[]>(
    needsDefects && ticket ? `/api/defects?productId=${ticket.productId}` : null,
  );
  const linkedRef = useRef(false);
  useEffect(() => {
    if (!defectData || !ticket || linkedRef.current) return;
    setDefects(ticket.id, defectData.slice(0, 2).map(linkDefect));
    linkedRef.current = true;
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [defectData, ticket]);

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateFactoryId, setEscalateFactoryId] = useState("");
  const [pickedDefects, setPickedDefects] = useState<TicketDefectLink[]>([]);
  const [solveOpen, setSolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [chat, setChat] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!seeded) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!ticket) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <p className="text-sm text-muted-foreground">{t("ticket.detail.notFound")}</p>
          <Button variant="outline" onClick={() => router.push("/tickets")}>
            <ArrowLeft className="size-4" />
            {t("ticket.detail.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCs = viewer.team === "cs";
  const messages = visibleMessages(ticket, viewer);
  const attachments = visibleAttachments(ticket, viewer);
  const canChat = !isCs || ticket.stage === "produk";
  const authorTeam: TicketTeam = viewer.team;

  const activeFactoryId = escalateFactoryId
    ? Number(escalateFactoryId)
    : (ticket.factoryId ?? products.find((product) => product.id === ticket.productId)?.factoryId ?? factories[0]?.id ?? null);

  const handleSend = () => {
    const body = chat.trim();
    if (!body) return;
    addMessage(ticket.id, { author: authorTeam, team: authorTeam, body });
    setChat("");
    refresh();
  };

  const handleFile = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    addMessage(ticket.id, {
      author: authorTeam,
      team: authorTeam,
      body: file.name,
      attachment: {
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        objectUrl: URL.createObjectURL(file),
      },
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
    toast.success(t("ticket.chat.attached"));
  };

  const handleEscalate = () => {
    if (pickedDefects.length === 0 && !escalateNote.trim()) {
      toast.error(t("ticket.escalate.required"));
      return;
    }
    const factory = factories.find((item) => item.id === activeFactoryId);
    escalate(ticket.id, {
      factoryId: activeFactoryId ?? 0,
      factoryName: factory?.name ?? ticket.factoryName,
      note: escalateNote.trim(),
      defects: pickedDefects,
    });
    setEscalateOpen(false);
    setEscalateNote("");
    setPickedDefects([]);
    refresh();
    toast.success(t("ticket.escalated"));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="size-4" />
          {t("ticket.detail.back")}
        </Button>
        <h1 className="text-xl font-semibold">{ticket.code}</h1>
        <TicketStageBadge stage={ticket.stage} viewer={viewer} />
        {viewer.team === "pabrik" && <Badge variant="outline">{t("ticket.role.pabrikReadOnly")}</Badge>}
        <span className="text-xs text-muted-foreground">{t("ticket.preview.polling")}</span>
      </div>

      <Card size="sm" className="mb-6 border-amber-300 bg-amber-50/60">
        <CardContent className="pt-4 text-sm">
          <span className="font-medium">{t("ticket.preview.banner")}</span>{" "}
          <span className="text-muted-foreground">{t("ticket.preview.note")}</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>{ticket.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <InfoRow label={t("common.product")} value={ticket.productName} />
                <InfoRow label="Virtual ID" value={ticket.virtualId} />
                <InfoRow label={t("common.factory")} value={ticket.factoryName} />
                <InfoRow label={t("ticket.detail.createdAt")} value={formatDateTime(ticket.createdAt)} />
                <InfoRow label={t("ticket.detail.escalatedAt")} value={ticket.escalatedAt ? formatDateTime(ticket.escalatedAt) : "-"} />
                <InfoRow label={t("ticket.detail.solvedAt")} value={ticket.solvedAt ? formatDateTime(ticket.solvedAt) : "-"} />
              </dl>

              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{t("ticket.detail.problemDetail")}</p>
                <p className="whitespace-pre-wrap text-sm">{ticket.problemDetail}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{t("ticket.detail.chronology")}</p>
                <p className="whitespace-pre-wrap text-sm">{ticket.chronology || "-"}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{t("ticket.detail.triedSolutions")}</p>
                <p className="whitespace-pre-wrap text-sm">{ticket.triedSolutions || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">{t("ticket.detail.chat")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
              ) : (
                messages.map((message) => (
                  <TicketMessageBubble key={message.id} message={message} own={message.team === viewer.team} />
                ))
              )}

              {isCs && ticket.stage !== "produk" && (
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {t("ticket.detail.csLocked")}
                </p>
              )}

              {canChat && (
                <div className="flex flex-col gap-2 border-t pt-4">
                  <Textarea
                    rows={2}
                    value={chat}
                    onChange={(event) => setChat(event.target.value)}
                    placeholder={t("ticket.chat.placeholder")}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSend} disabled={!chat.trim()}>
                      <Send className="size-4" />
                      {t("ticket.chat.send")}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => handleFile(event.target.files)}
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="size-4" />
                      {t("ticket.chat.attach")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">{t("ticket.detail.attachments")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <TicketAttachmentList attachments={attachments} />
              <p className="text-xs text-muted-foreground">{t("ticket.detail.attachmentRule")}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">{t("ticket.detail.relatedDefects")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketDefectList defects={ticket.defects} />
            </CardContent>
          </Card>

          {!isCs || ticket.stage === "produk" ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-base">{t("ticket.detail.actions")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {viewer.team === "produk" && ticket.stage === "produk" && (
                  <Button onClick={() => setEscalateOpen(true)}>
                    <Upload className="size-4" />
                    {t("ticket.action.escalate")}
                  </Button>
                )}
                {viewer.team !== "cs" && ticket.stage !== "selesai" && (
                  <Button variant="outline" onClick={() => setSolveOpen(true)}>
                    {t("ticket.action.solve")}
                  </Button>
                )}
                {viewer.team !== "cs" && ticket.stage === "selesai" && (
                  <Button variant="outline" onClick={() => setReopenOpen(true)}>
                    <RotateCcw className="size-4" />
                    {t("ticket.action.reopen")}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t("ticket.detail.actionHint")}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ticket.escalate.title")}</DialogTitle>
            <DialogDescription>{t("ticket.escalate.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("ticket.escalate.factory")}</Label>
              <Select
                value={activeFactoryId ? String(activeFactoryId) : ""}
                items={factories.map((factory) => ({ value: String(factory.id), label: factory.name }))}
                onValueChange={(value) => {
                  if (value === null) return;
                  setEscalateFactoryId(String(value));
                }}
              >
                <SelectTrigger className="w-full">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-escalate-note">{t("ticket.escalate.note")}</Label>
              <Textarea
                id="ticket-escalate-note"
                rows={3}
                value={escalateNote}
                onChange={(event) => setEscalateNote(event.target.value)}
                placeholder={t("ticket.escalate.notePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("ticket.escalate.defects")}</Label>
              <p className="text-xs text-muted-foreground">{t("ticket.escalate.defectsHint")}</p>
              <TicketDefectPicker
                productId={ticket.productId}
                selected={pickedDefects}
                onToggle={(link) =>
                  setPickedDefects((prev) =>
                    prev.some((item) => item.defectId === link.defectId)
                      ? prev.filter((item) => item.defectId !== link.defectId)
                      : [...prev, link],
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("ticket.picker.selected")}: {pickedDefects.length}
              </p>
            </div>

            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t("ticket.escalate.fileNotice")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleEscalate}>{t("ticket.escalate.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={solveOpen}
        onOpenChange={setSolveOpen}
        title={t("ticket.solve.title")}
        description={t("ticket.solve.description")}
        confirmLabel={t("ticket.solve.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          solveTicket(ticket.id, authorTeam);
          setSolveOpen(false);
          refresh();
          toast.success(t("ticket.solved"));
        }}
      />

      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title={t("ticket.reopen.title")}
        description={t("ticket.reopen.description")}
        confirmLabel={t("ticket.reopen.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          reopenTicket(ticket.id);
          setReopenOpen(false);
          refresh();
          toast.success(t("ticket.reopened"));
        }}
      />
    </>
  );
}
