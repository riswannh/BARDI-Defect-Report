"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Forward, Paperclip, RotateCcw, Send, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { TicketAttachmentBubble } from "../ticket-attachment-bubble";
import { TicketStageBadge } from "../ticket-badges";
import { TicketDefectList, TicketDefectPicker, type DefectPickerRow } from "../ticket-defect-picker";
import { TicketMessageBubble } from "../ticket-message-bubble";
import {
  addMessage,
  editMessage,
  escalate,
  forwardAttachments,
  getTicket,
  linkDefect,
  markTicketRead,
  reopenTicket,
  seedPreview,
  setDefects,
  solveTicket,
  visibleAttachments,
  visibleMessages,
  type PreviewViewer,
  type TicketAttachment,
  type TicketDefectLink,
  type TicketMessage,
  type TicketTeam,
  type TicketVisibility,
} from "../ticket-preview-data";

/**
 * Satu ruang percakapan tiket.
 *
 * Ruang `all` = CS ↔ Tim Produk, ruang `factory` = Tim Produk ↔ Tim Pabrik.
 * Tim Produk ada di dua ruang: kalau pabrik minta sesuatu, permintaan itu
 * diteruskan ke CS lewat ruang `all`. Tim Pabrik tidak pernah melihat ruang CS,
 * dan CS tidak pernah melihat ruang pabrik.
 */
/** Jendela pesan: tampil 10, muat 10 lagi saat scroll ke atas, batas 50 lalu muat sisa. */
const WINDOW_START = 10;
const WINDOW_MAX = 50;

function ChatRoom({
  title,
  hint,
  messages,
  attachments,
  viewer,
  canPost,
  canForward,
  canTranslate,
  draft,
  onDraftChange,
  onSend,
  onEdit,
  onForward,
  onAttach,
}: {
  title: string;
  hint: string;
  room: TicketVisibility;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
  viewer: PreviewViewer;
  canPost: boolean;
  /** Tim Produk: teruskan lampiran dari ruang CS ke ruang pabrik. */
  canForward?: boolean;
  /** Translate hanya tersedia di ruang Tim Produk ↔ Tim Pabrik. */
  canTranslate?: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (replyToId: number | null) => void;
  onEdit: (messageId: number, body: string) => void;
  onForward?: () => void;
  onAttach?: () => void;
}) {
  const { t } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const [windowCount, setWindowCount] = useState(WINDOW_START);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const total = messages.length;
  const shownCount = Math.min(windowCount, total);
  const shown = messages.slice(total - shownCount);
  const filesFor = (messageId: number) => attachments.filter((item) => item.messageId === messageId);
  // Lampiran hasil teruskan tidak menempel pada pesan ruang asal → bubble sendiri.
  const forwardedFiles = attachments.filter((item) => item.messageId === undefined);

  // Muat pesan lama: jaga posisi baca (tinggi yang hilang dikompensasi).
  useEffect(() => {
    const el = listRef.current;
    if (!el || anchorRef.current === null) return;
    el.scrollTop = el.scrollHeight - anchorRef.current;
    anchorRef.current = null;
  }, [windowCount]);

  // Pesan baru masuk (polling 10 detik): kalau sedang di bawah, ikut ke bawah.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [total]);

  const loadMore = (count: number) => {
    const el = listRef.current;
    if (!el || shownCount >= total) return;
    anchorRef.current = el.scrollHeight - el.scrollTop;
    setWindowCount(Math.min(shownCount + count, total));
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop <= 24 && shownCount < total && shownCount < WINDOW_MAX) loadMore(WINDOW_START);
  };

  const jumpToQuoted = (messageId: number) => {
    const index = messages.findIndex((item) => item.id === messageId);
    if (index < 0) return;
    const needed = total - index;
    if (needed > shownCount) setWindowCount(needed <= WINDOW_MAX ? needed : total);
    setHighlight(messageId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(`ticket-message-${messageId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }),
    );
    window.setTimeout(() => setHighlight(null), 2500);
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{hint}</p>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        ) : (
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex max-h-[32rem] min-h-[14rem] flex-col gap-4 overflow-y-auto pr-1"
          >
            {shownCount < total && (
              <div className="flex flex-col items-center gap-1 py-1">
                {shownCount < WINDOW_MAX ? (
                  <Button variant="ghost" size="xs" onClick={() => loadMore(WINDOW_START)}>
                    {t("ticket.chat.loadMore")}
                  </Button>
                ) : (
                  <Button variant="ghost" size="xs" onClick={() => setWindowCount(total)}>
                    {t("ticket.chat.loadRest")}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("ticket.chat.window", { shown: shownCount, total })}
                </p>
              </div>
            )}

            {shown.map((message) => {
              const own = message.team === viewer.team;
              const files = filesFor(message.id);
              return (
                <div key={message.id} className={cn("flex flex-col gap-2", own ? "items-end" : "items-start")}>
                  <TicketMessageBubble
                    message={message}
                    own={own}
                    quoted={message.replyToId ? (messages.find((item) => item.id === message.replyToId) ?? null) : null}
                    canEdit={own && message.kind === "chat"}
                    canTranslate={canTranslate}
                    highlight={highlight === message.id}
                    onEdit={onEdit}
                    onReply={(messageId) => setReplyTo(messageId)}
                    onJumpToQuoted={jumpToQuoted}
                  />
                  {files.length > 0 && (
                    <div className={cn("flex flex-col gap-2", own ? "items-end" : "items-start")}>
                      {files.map((file) => (
                        <TicketAttachmentBubble key={file.id} attachment={file} own={own} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {forwardedFiles.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">{t("ticket.chat.forwardedFiles")}</p>
                {forwardedFiles.map((file) => (
                  <TicketAttachmentBubble key={file.id} attachment={file} />
                ))}
              </div>
            )}
          </div>
        )}

        {canPost && (
          <div className="flex flex-col gap-2 border-t pt-4">
            {replyTo !== null && (
              <div className="flex items-center justify-between gap-2 rounded-md border-l-2 border-primary/60 bg-muted/40 px-2 py-1 text-xs">
                <span className="truncate text-muted-foreground">
                  {t("ticket.chat.replying")}: {messages.find((item) => item.id === replyTo)?.body}
                </span>
                <Button variant="ghost" size="xs" onClick={() => setReplyTo(null)}>
                  {t("ticket.chat.replyCancel")}
                </Button>
              </div>
            )}
            <Textarea
              rows={2}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={t("ticket.chat.placeholder")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onSend(replyTo);
                  setReplyTo(null);
                }}
                disabled={!draft.trim()}
              >
                <Send className="size-4" />
                {t("ticket.chat.send")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAttach?.()}>
                <Paperclip className="size-4" />
                {t("ticket.chat.attach")}
              </Button>
              {canForward && (
                <Button variant="outline" size="sm" onClick={() => onForward?.()}>
                  <Forward className="size-4" />
                  {t("ticket.forward.action")}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const [drafts, setDrafts] = useState<Record<TicketVisibility, string>>({ all: "", factory: "" });
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardIds, setForwardIds] = useState<number[]>([]);
  const [escalateAttachmentIds, setEscalateAttachmentIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRoomRef = useRef<TicketVisibility>("all");

  // Membuka tiket = pembaruan dianggap terbaca (badge di daftar ikut hilang).
  useEffect(() => {
    markTicketRead(ticketId);
  }, [ticketId]);

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
  const isPabrik = viewer.team === "pabrik";
  const messages = visibleMessages(ticket, viewer);
  const attachments = visibleAttachments(ticket, viewer);
  const roomCs = {
    messages: messages.filter((message) => message.visibility === "all"),
    attachments: attachments.filter((item) => item.visibility === "all"),
  };
  const roomPabrik = {
    messages: messages.filter((message) => message.visibility === "factory"),
    attachments: attachments.filter((item) => item.visibility === "factory"),
  };
  // Ruang CS ↔ Tim Produk: Tim Pabrik tidak melihatnya sama sekali.
  const showCsRoom = !isPabrik;
  const canPostCsRoom = !isPabrik;
  // Ruang Tim Produk ↔ Tim Pabrik: muncul setelah eskalasi, tertutup untuk CS.
  const showPabrikRoom = !isCs && ticket.stage !== "produk";
  const canPostPabrikRoom = !isCs;
  const authorTeam: TicketTeam = viewer.team;
  // Lampiran ruang CS yang belum pernah diteruskan ke ruang pabrik.
  const csForwardable = ticket.attachments.filter(
    (item) => item.visibility === "all" && item.forwardedFromId === undefined,
  );

  const activeFactoryId = escalateFactoryId
    ? Number(escalateFactoryId)
    : (ticket.factoryId ?? products.find((product) => product.id === ticket.productId)?.factoryId ?? factories[0]?.id ?? null);

  const handleSend = (room: TicketVisibility, replyToId: number | null) => {
    const body = drafts[room].trim();
    if (!body) return;
    addMessage(ticket.id, { author: authorTeam, team: authorTeam, body, visibility: room, replyToId });
    setDrafts((prev) => ({ ...prev, [room]: "" }));
    refresh();
  };

  const handleEdit = (messageId: number, body: string) => {
    if (editMessage(ticket.id, messageId, body)) {
      toast.success(t("ticket.chat.editedToast"));
      refresh();
    }
  };

  const toggleForwardId = (attachmentId: number) => {
    setForwardIds((prev) =>
      prev.includes(attachmentId) ? prev.filter((id) => id !== attachmentId) : [...prev, attachmentId],
    );
  };

  const toggleEscalateAttachment = (attachmentId: number) => {
    setEscalateAttachmentIds((prev) =>
      prev.includes(attachmentId) ? prev.filter((id) => id !== attachmentId) : [...prev, attachmentId],
    );
  };

  const handleForward = () => {
    const count = forwardAttachments(ticket.id, forwardIds, "factory");
    setForwardOpen(false);
    setForwardIds([]);
    if (count > 0) toast.success(t("ticket.forward.done", { count }));
    refresh();
  };

  const handleFile = (room: TicketVisibility, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    addMessage(ticket.id, {
      author: authorTeam,
      team: authorTeam,
      body: file.name,
      visibility: room,
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
      attachmentIds: escalateAttachmentIds,
    });
    setEscalateOpen(false);
    setEscalateNote("");
    setPickedDefects([]);
    setEscalateAttachmentIds([]);
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
                {viewer.team !== "cs" && <InfoRow label={t("common.factory")} value={ticket.factoryName} />}
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

          {showCsRoom && (
            <ChatRoom
              title={t("ticket.room.cs")}
              hint={t("ticket.room.csHint")}
              room="all"
              messages={roomCs.messages}
              attachments={roomCs.attachments}
              viewer={viewer}
              canPost={canPostCsRoom}
              draft={drafts.all}
              onDraftChange={(value) => setDrafts((prev) => ({ ...prev, all: value }))}
              onSend={(replyToId) => handleSend("all", replyToId)}
              onEdit={handleEdit}
              onAttach={() => {
                fileRoomRef.current = "all";
                fileInputRef.current?.click();
              }}
            />
          )}

          {showPabrikRoom && (
            <ChatRoom
              title={t("ticket.room.pabrik")}
              hint={t("ticket.room.pabrikHint")}
              room="factory"
              messages={roomPabrik.messages}
              attachments={roomPabrik.attachments}
              viewer={viewer}
              canPost={canPostPabrikRoom}
              draft={drafts.factory}
              onDraftChange={(value) => setDrafts((prev) => ({ ...prev, factory: value }))}
              onSend={(replyToId) => handleSend("factory", replyToId)}
              onEdit={handleEdit}
              canTranslate
              canForward={viewer.team === "produk"}
              onForward={() => {
                setForwardIds([]);
                setForwardOpen(true);
              }}
              onAttach={() => {
                fileRoomRef.current = "factory";
                fileInputRef.current?.click();
              }}
            />
          )}

          <p className="text-xs text-muted-foreground">{t("ticket.detail.attachmentRule")}</p>
        </div>

        <div className="flex flex-col gap-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => handleFile(fileRoomRef.current, event.target.files)}
          />

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-base">{t("ticket.detail.relatedDefects")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketDefectList defects={ticket.defects} showFactory={!isCs} />
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

            <div className="flex flex-col gap-1.5">
              <Label>{t("ticket.escalate.attachments")}</Label>
              <p className="text-xs text-muted-foreground">{t("ticket.escalate.attachmentsHint")}</p>
              {csForwardable.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("ticket.escalate.attachmentsEmpty")}</p>
              ) : (
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                  {csForwardable.map((file) => (
                    <TicketAttachmentBubble
                      key={file.id}
                      attachment={file}
                      selectable
                      selected={escalateAttachmentIds.includes(file.id)}
                      onToggleSelect={toggleEscalateAttachment}
                    />
                  ))}
                </div>
              )}
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

      <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
        <DialogContent className="grid-cols-1 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("ticket.forward.title")}</DialogTitle>
            <DialogDescription>{t("ticket.forward.description")}</DialogDescription>
          </DialogHeader>
          {csForwardable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ticket.forward.empty")}</p>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {csForwardable.map((file) => (
                <TicketAttachmentBubble
                  key={file.id}
                  attachment={file}
                  selectable
                  selected={forwardIds.includes(file.id)}
                  onToggleSelect={toggleForwardId}
                />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleForward} disabled={forwardIds.length === 0}>
              {t("ticket.forward.confirm")}
            </Button>
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
