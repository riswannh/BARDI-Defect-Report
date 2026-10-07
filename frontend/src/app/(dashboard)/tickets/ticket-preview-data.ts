/**
 * Data contoh Fitur Ticketing untuk mode pratinjau (Fase 0).
 *
 * ponytail: data contoh — ganti ke /api/tickets saat backend siap.
 * Semua isi di sini hidup di memori browser saja: hilang kalau halaman di-refresh
 * penuh. Produk, pabrik, dan defect yang dipakai sebagai contoh diambil dari data
 * ASLI (`GET /api/products`, `/api/factories`, `/api/defects`) lewat `seedPreview`.
 */

import type { Defect, Factory, Product } from "@/lib/types";

export type TicketStage = "produk" | "pabrik" | "selesai";
/** Siapa yang boleh melihat pesan/lampiran: semua tim, atau hanya Produk + Pabrik. */
export type TicketVisibility = "all" | "factory";
export type TicketTeam = "cs" | "produk" | "pabrik";
export type AttachmentStorage = "drive" | "server" | "lokal";

export interface TicketMessage {
  id: number;
  author: string;
  team: TicketTeam;
  body: string;
  kind: "chat" | "sistem";
  visibility: TicketVisibility;
  createdAt: string;
}

export interface TicketAttachment {
  id: number;
  fileName: string;
  mime: string;
  size: number;
  storage: AttachmentStorage;
  visibility: TicketVisibility;
  /** Hanya terisi untuk berkas yang dipilih di form pratinjau (belum diunggah). */
  objectUrl?: string;
}

export interface TicketDefectLink {
  defectId: number;
  codeGaransi: string;
  timeStamp: string;
  productId: number;
  productName: string;
  problemName: string;
  quantity: number;
  factoryId: number | null;
  factoryName: string;
  photosLink: string;
  videosLink: string;
}

export interface PreviewTicket {
  id: number;
  code: string;
  title: string;
  productId: number;
  productName: string;
  virtualId: string;
  problemDetail: string;
  chronology: string;
  triedSolutions: string;
  stage: TicketStage;
  factoryId: number | null;
  factoryName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  escalatedAt: string | null;
  solvedAt: string | null;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
  defects: TicketDefectLink[];
}

/** Siapa yang sedang "melihat" pratinjau; pabrikId dipakai role Pabrik. */
export interface PreviewViewer {
  team: TicketTeam;
  factoryId: number | null;
}

let nextMessageId = 1000;
let nextAttachmentId = 500;
let nextTicketId = 4;

let tickets: PreviewTicket[] = [];
let seeded = false;

function nowIso(offsetHours = 0): string {
  return new Date(Date.now() + offsetHours * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}

function emptyDefectLink(defectId: number): TicketDefectLink {
  return {
    defectId,
    codeGaransi: `CG-${defectId}`,
    timeStamp: "",
    productId: 0,
    productName: "",
    problemName: "",
    quantity: 0,
    factoryId: null,
    factoryName: "",
    photosLink: "",
    videosLink: "",
  };
}

/**
 * Isi 3 tiket contoh dari data asli. Idempoten: panggilan kedua tidak menambah
 * apa pun, jadi aman dipanggil dari useEffect halaman daftar.
 */
export function seedPreview(
  products: Product[],
  factories: Factory[],
  defects: Array<Defect & { productName?: string | null; factoryName?: string | null; problemName?: string | null }>
): void {
  if (seeded) return;
  seeded = true;

  const product = (index: number) => products[index] ?? { id: index + 1, name: `Produk contoh ${index + 1}` };
  const factory = (index: number) => factories[index] ?? { id: index + 1, name: `Pabrik contoh ${index + 1}` };
  const p1 = product(0);
  const p2 = product(1);
  const p3 = product(2);
  const f1 = factory(0);
  const f2 = factory(1);

  const defectA = defects[0] ? linkDefect(defects[0]) : emptyDefectLink(0);
  const defectB = defects[1] ? linkDefect(defects[1]) : emptyDefectLink(0);

  tickets = [
    {
      id: 1,
      code: "TKT-202610-0001",
      title: `Kendala ${p1.name}`,
      productId: p1.id,
      productName: p1.name,
      virtualId: "VID-88213",
      problemDetail: "Unit mati total setelah dipakai 3 hari, indikator tidak menyala.",
      chronology: "Diterima customer 1 Okt, dipakai normal, 3 Okt pagi tidak bisa dinyalakan.",
      triedSolutions: "Ganti adaptor, cek kabel, reset paksa — tidak ada perubahan.",
      stage: "produk",
      factoryId: f1.id,
      factoryName: f1.name,
      createdBy: "cs",
      createdAt: nowIso(-30),
      updatedAt: nowIso(-6),
      escalatedAt: null,
      solvedAt: null,
      messages: [
        { id: 1, author: "cs", team: "cs", body: "Tiket baru dari customer, mohon dibantu cek ya Tim Produk.", kind: "chat", visibility: "all", createdAt: nowIso(-30) },
        { id: 2, author: "produk", team: "produk", body: "Sudah kami cek, kemungkinan modul daya. Kami uji dulu di lab.", kind: "chat", visibility: "all", createdAt: nowIso(-6) },
      ],
      attachments: [
        { id: 1, fileName: "foto-unit-depan.jpg", mime: "image/jpeg", size: 842_311, storage: "drive", visibility: "all" },
        { id: 2, fileName: "video-nyala.mp4", mime: "video/mp4", size: 12_884_901, storage: "drive", visibility: "all" },
      ],
      defects: [],
    },
    {
      id: 2,
      code: "TKT-202610-0002",
      title: `Kendala ${p2.name}`,
      productId: p2.id,
      productName: p2.name,
      virtualId: "VID-88240",
      problemDetail: "Suara kresek saat volume di atas 70%, muncul sejak pemakaian minggu kedua.",
      chronology: "Muncul bertahap, makin sering setelah unit dipindah ke ruangan ber-AC.",
      triedSolutions: "Update firmware, ganti kabel audio, coba sumber lain.",
      stage: "pabrik",
      factoryId: f2.id,
      factoryName: f2.name,
      createdBy: "cs",
      createdAt: nowIso(-72),
      updatedAt: nowIso(-2),
      escalatedAt: nowIso(-20),
      solvedAt: null,
      messages: [
        { id: 3, author: "cs", team: "cs", body: "Unit kedua bulan ini dari toko yang sama.", kind: "chat", visibility: "all", createdAt: nowIso(-72) },
        { id: 4, author: "produk", team: "produk", body: "Kami sudah uji 2 unit, gejalanya sama. Kami eskalasi ke pabrik.", kind: "chat", visibility: "all", createdAt: nowIso(-21) },
        { id: 5, author: "sistem", team: "produk", body: "Dieskalasi ke Tim Pabrik — dengan 2 defect terkait.", kind: "sistem", visibility: "factory", createdAt: nowIso(-20) },
        { id: 6, author: "produk", team: "produk", body: "Pabrik, mohon dicek modul speaker batch ini.", kind: "chat", visibility: "factory", createdAt: nowIso(-19) },
        { id: 7, author: "pabrik", team: "pabrik", body: "收到，我们检查同一批次的扬声器模块。", kind: "chat", visibility: "factory", createdAt: nowIso(-2) },
      ],
      attachments: [
        { id: 3, fileName: "rekaman-kresek.mp3", mime: "audio/mpeg", size: 1_204_882, storage: "server", visibility: "factory" },
        { id: 4, fileName: "foto-speaker.jpg", mime: "image/jpeg", size: 604_120, storage: "server", visibility: "factory" },
      ],
      defects: defectA.defectId ? [defectA, defectB.defectId ? defectB : defectA] : [],
    },
    {
      id: 3,
      code: "TKT-202609-0007",
      title: `Kendala ${p3.name}`,
      productId: p3.id,
      productName: p3.name,
      virtualId: "VID-87980",
      problemDetail: "Baut pengunci longgar, unit goyang saat dipakai.",
      chronology: "Dilaporkan 20 Sep, diperbaiki 24 Sep.",
      triedSolutions: "Kencangkan baut, ganti baut cadangan.",
      stage: "selesai",
      factoryId: f1.id,
      factoryName: f1.name,
      createdBy: "cs",
      createdAt: nowIso(-240),
      updatedAt: nowIso(-60),
      escalatedAt: nowIso(-200),
      solvedAt: nowIso(-60),
      messages: [
        { id: 8, author: "cs", team: "cs", body: "Customer minta unit diganti kalau tidak bisa diperbaiki.", kind: "chat", visibility: "all", createdAt: nowIso(-240) },
        { id: 9, author: "produk", team: "produk", body: "Kami kirim baut pengunci versi baru.", kind: "chat", visibility: "all", createdAt: nowIso(-90) },
        { id: 10, author: "sistem", team: "produk", body: "Tiket ditandai selesai oleh Tim Produk.", kind: "sistem", visibility: "all", createdAt: nowIso(-60) },
      ],
      attachments: [{ id: 5, fileName: "foto-baut.jpg", mime: "image/jpeg", size: 512_004, storage: "drive", visibility: "all" }],
      defects: [],
    },
  ];
}

export function linkDefect(defect: {
  id: number;
  codeGaransi: string;
  timestamp?: string;
  timeStamp?: string;
  productId: number;
  productName?: string | null;
  problemName?: string | null;
  quantity: number;
  factoryId: number;
  factoryName?: string | null;
  photosLink?: string;
  videosLink?: string;
}): TicketDefectLink {
  return {
    defectId: defect.id,
    codeGaransi: defect.codeGaransi,
    timeStamp: defect.timeStamp ?? defect.timestamp ?? "",
    productId: defect.productId,
    productName: defect.productName ?? "",
    problemName: defect.problemName ?? "",
    quantity: defect.quantity,
    factoryId: defect.factoryId ?? null,
    factoryName: defect.factoryName ?? "",
    photosLink: defect.photosLink ?? "",
    videosLink: defect.videosLink ?? "",
  };
}

/** Tiket yang boleh dilihat seorang penonton (role Pabrik hanya tiket pabriknya). */
export function visibleTickets(viewer: PreviewViewer): PreviewTicket[] {
  const list = viewer.team === "pabrik" ? tickets.filter((t) => t.stage !== "produk" && t.factoryId === viewer.factoryId) : tickets;
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Pesan yang boleh dilihat penonton: CS tidak pernah menerima pesan pasca-eskalasi. */
export function visibleMessages(ticket: PreviewTicket, viewer: PreviewViewer): TicketMessage[] {
  return ticket.messages.filter((m) => viewer.team !== "cs" || m.visibility === "all");
}

export function visibleAttachments(ticket: PreviewTicket, viewer: PreviewViewer): TicketAttachment[] {
  return ticket.attachments.filter((a) => viewer.team !== "cs" || a.visibility === "all");
}

export function getTicket(id: number): PreviewTicket | undefined {
  return tickets.find((t) => t.id === id);
}

export function nextCode(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  return `TKT-${d.getFullYear()}${month}-${`${nextTicketId}`.padStart(4, "0")}`;
}

export function addTicket(input: {
  title: string;
  productId: number;
  productName: string;
  factoryId: number | null;
  factoryName: string;
  virtualId: string;
  problemDetail: string;
  chronology: string;
  triedSolutions: string;
  attachments: Array<{ fileName: string; mime: string; size: number; objectUrl?: string }>;
}): PreviewTicket {
  const stamp = nowIso();
  const ticket: PreviewTicket = {
    id: nextTicketId,
    code: nextCode(),
    title: input.title,
    productId: input.productId,
    productName: input.productName,
    virtualId: input.virtualId,
    problemDetail: input.problemDetail,
    chronology: input.chronology,
    triedSolutions: input.triedSolutions,
    stage: "produk",
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    createdBy: "cs",
    createdAt: stamp,
    updatedAt: stamp,
    escalatedAt: null,
    solvedAt: null,
    messages: [
      { id: nextMessageId++, author: "cs", team: "cs", body: "Tiket baru dari CS.", kind: "sistem", visibility: "all", createdAt: stamp },
    ],
    // Semua lampiran tiket baru disimpan ke Drive saat dibuat (belum disalin ke server).
    attachments: input.attachments.map((a) => ({
      id: nextAttachmentId++,
      fileName: a.fileName,
      mime: a.mime,
      size: a.size,
      storage: "drive" as AttachmentStorage,
      visibility: "all" as TicketVisibility,
      objectUrl: a.objectUrl,
    })),
    defects: [],
  };
  tickets = [ticket, ...tickets];
  nextTicketId += 1;
  return ticket;
}

export function addMessage(
  ticketId: number,
  input: { author: string; team: TicketTeam; body: string; kind?: "chat" | "sistem"; visibility?: TicketVisibility; attachment?: { fileName: string; mime: string; size: number; objectUrl?: string } }
): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  const stamp = nowIso();
  const hidden = ticket.stage === "pabrik" || ticket.stage === "selesai";
  ticket.messages.push({
    id: nextMessageId++,
    author: input.author,
    team: input.team,
    body: input.body,
    kind: input.kind ?? "chat",
    visibility: input.visibility ?? (hidden && input.team !== "cs" ? "factory" : "all"),
    createdAt: stamp,
  });
  if (input.attachment) {
    ticket.attachments.push({
      id: nextAttachmentId++,
      fileName: input.attachment.fileName,
      mime: input.attachment.mime,
      size: input.attachment.size,
      storage: "server",
      visibility: ticket.stage === "pabrik" ? "factory" : "all",
      objectUrl: input.attachment.objectUrl,
    });
  }
  ticket.updatedAt = stamp;
}

export function escalate(
  ticketId: number,
  input: { factoryId: number; factoryName: string; note: string; defects: TicketDefectLink[] }
): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  const stamp = nowIso();
  ticket.stage = "pabrik";
  ticket.factoryId = input.factoryId;
  ticket.factoryName = input.factoryName;
  ticket.escalatedAt = stamp;
  ticket.updatedAt = stamp;
  // Salinan lampiran ke server baru terjadi di titik ini (koreksi user).
  ticket.attachments = ticket.attachments.map((a) => ({ ...a, storage: "server", visibility: "factory" }));
  ticket.defects = input.defects;
  const codes = input.defects.map((d) => d.codeGaransi).join(", ");
  ticket.messages.push({
    id: nextMessageId++,
    author: "sistem",
    team: "produk",
    body: input.defects.length
      ? `Dieskalasi ke Tim Pabrik — dengan ${input.defects.length} defect terkait: ${codes}.`
      : "Dieskalasi ke Tim Pabrik.",
    kind: "sistem",
    visibility: "factory",
    createdAt: stamp,
  });
  if (input.note.trim()) {
    ticket.messages.push({
      id: nextMessageId++,
      author: "produk",
      team: "produk",
      body: input.note.trim(),
      kind: "chat",
      visibility: "factory",
      createdAt: stamp,
    });
  }
}

export function setDefects(ticketId: number, defects: TicketDefectLink[]): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  ticket.defects = defects;
  ticket.updatedAt = nowIso();
}

export function solveTicket(ticketId: number, author = "produk"): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  const stamp = nowIso();
  ticket.stage = "selesai";
  ticket.solvedAt = stamp;
  ticket.updatedAt = stamp;
  ticket.messages.push({
    id: nextMessageId++,
    author: "sistem",
    team: "produk",
    body: "Tiket ditandai selesai.",
    kind: "sistem",
    // Tiket yang selesai dari jalur pabrik tetap tertutup untuk CS.
    visibility: ticket.escalatedAt ? "factory" : "all",
    createdAt: stamp,
  });
  void author;
}

export function reopenTicket(ticketId: number): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  const stamp = nowIso();
  ticket.stage = ticket.escalatedAt ? "pabrik" : "produk";
  ticket.solvedAt = null;
  ticket.updatedAt = stamp;
  ticket.messages.push({
    id: nextMessageId++,
    author: "sistem",
    team: "produk",
    body: "Tiket dibuka lagi.",
    kind: "sistem",
    visibility: ticket.escalatedAt ? "factory" : "all",
    createdAt: stamp,
  });
}

export function removeTicket(ticketId: number): void {
  tickets = tickets.filter((t) => t.id !== ticketId);
}

export function resetPreview(): void {
  seeded = false;
  tickets = [];
  nextTicketId = 4;
  nextMessageId = 1000;
  nextAttachmentId = 500;
}
