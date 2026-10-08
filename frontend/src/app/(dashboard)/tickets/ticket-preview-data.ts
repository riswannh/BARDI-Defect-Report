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
/**
 * Ruang percakapan tiket: "all" = CS ↔ Tim Produk, "factory" = Tim Produk ↔ Tim Pabrik.
 * Tim Produk ikut di dua ruang dan meneruskan permintaan pabrik ke CS.
 */
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
  /** Terisi kalau pesan pernah diubah (UI menampilkan tanda "diedit"). */
  editedAt?: string;
  /** Pesan yang dikutip (balasan), selalu di ruang yang sama. */
  replyToId?: number | null;
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
  /** Pesan pemilik lampiran; lampiran tampil sebagai bubble tepat setelah pesannya. */
  messageId?: number;
  /** Id lampiran ruang CS asal kalau berkas ini hasil "teruskan ke Tim Pabrik". */
  forwardedFromId?: number;
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
  /**
   * ponytail: satu penghitung "ada pembaruan" per tiket, dibersihkan saat detail
   * dibuka. Fase 1 menggantinya dengan penanda baca per user (ticket_reads).
   */
  unread: number;
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

/**
 * Contoh percakapan panjang untuk menguji jendela pesan (10 tampil, muat 10 lagi
 * saat di-scroll ke atas, batas 50 lalu tombol "muat sisa").
 */
function longFactoryChat(firstId: number, count: number): TicketMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const fromFactory = index % 2 === 1;
    return {
      id: firstId + index,
      author: fromFactory ? "pabrik" : "produk",
      team: (fromFactory ? "pabrik" : "produk") as TicketTeam,
      body: fromFactory
        ? `工厂回复 #${index + 1}：已更换同批次模块，请复测并反馈。`
        : `Catatan uji lab #${index + 1}: gejala masih muncul pada 1 dari 3 unit uji.`,
      kind: "chat" as const,
      visibility: "factory" as const,
      createdAt: nowIso(-18 + index * 0.6),
    };
  });
}

function nowIso(offsetHours = 0): string {
  // Dibulatkan ke jam penuh supaya HTML server dan hasil hidrasi klien identik
  // (kalau memakai Date.now() mentah, menitnya beda → peringatan hidrasi React).
  const base = Math.floor(Date.now() / 3600_000) * 3600_000;
  return new Date(base + offsetHours * 3600_000).toISOString().slice(0, 16).replace("T", " ");
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
  // Lewati pabrik "Unknown" (baris placeholder di data asli) supaya tiket contoh
  // tidak menampilkan nama pabrik palsu.
  const namedFactories = factories.filter((item) => item.name.trim() && !/^unknown$/i.test(item.name.trim()));
  const factory = (index: number) =>
    namedFactories[index] ?? namedFactories[0] ?? factories[index] ?? { id: index + 1, name: `Pabrik contoh ${index + 1}` };
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
        { id: 1, fileName: "foto-unit-depan.jpg", mime: "image/jpeg", size: 842_311, storage: "drive", visibility: "all", messageId: 1 },
        { id: 2, fileName: "video-nyala.mp4", mime: "video/mp4", size: 12_884_901, storage: "drive", visibility: "all", messageId: 2 },
      ],
      defects: [],
      unread: 0,
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
        { id: 6, author: "produk", team: "produk", body: "Pabrik, mohon dicek modul speaker batch ini.", kind: "chat", visibility: "factory", createdAt: nowIso(-19), replyToId: null },
        { id: 7, author: "pabrik", team: "pabrik", body: "收到，我们检查同一批次的扬声器模块。", kind: "chat", visibility: "factory", createdAt: nowIso(-2), replyToId: 6 },
        { id: 12, author: "produk", team: "produk", body: "Pabrik minta foto kondisi kabel dalam unit. Bisa dibantu minta ke customer?", kind: "chat", visibility: "all", createdAt: nowIso(-1), editedAt: nowIso(-1) },
        ...longFactoryChat(20, 55),
      ],
      attachments: [
        // Lampiran CS (ruang all) + salinan yang sudah diteruskan Tim Produk ke ruang pabrik.
        { id: 3, fileName: "rekaman-kresek.mp3", mime: "audio/mpeg", size: 1_204_882, storage: "server", visibility: "all", messageId: 3 },
        { id: 4, fileName: "foto-speaker.jpg", mime: "image/jpeg", size: 604_120, storage: "server", visibility: "all", messageId: 3 },
        { id: 6, fileName: "rekaman-kresek.mp3", mime: "audio/mpeg", size: 1_204_882, storage: "server", visibility: "factory", forwardedFromId: 3 },
        { id: 7, fileName: "foto-speaker.jpg", mime: "image/jpeg", size: 604_120, storage: "server", visibility: "factory", forwardedFromId: 4 },
      ],
      defects: defectA.defectId ? [defectA, defectB.defectId ? defectB : defectA] : [],
      unread: 2,
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
      unread: 0,
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
/**
 * Pesan per ruang: CS hanya ruang CS ↔ Tim Produk, Tim Pabrik hanya ruang
 * Tim Produk ↔ Tim Pabrik, Tim Produk melihat kedua ruang.
 */
export function visibleMessages(ticket: PreviewTicket, viewer: PreviewViewer): TicketMessage[] {
  if (viewer.team === "cs") return ticket.messages.filter((m) => m.visibility === "all");
  if (viewer.team === "pabrik") return ticket.messages.filter((m) => m.visibility === "factory");
  return ticket.messages;
}

export function visibleAttachments(ticket: PreviewTicket, viewer: PreviewViewer): TicketAttachment[] {
  if (viewer.team === "cs") return ticket.attachments.filter((a) => a.visibility === "all");
  if (viewer.team === "pabrik") return ticket.attachments.filter((a) => a.visibility === "factory");
  return ticket.attachments;
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
  const openingId = nextMessageId++;
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
      { id: openingId, author: "cs", team: "cs", body: "Tiket baru dari CS.", kind: "chat", visibility: "all", createdAt: stamp },
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
      messageId: openingId,
    })),
    defects: [],
    unread: 0,
  };
  tickets = [ticket, ...tickets];
  nextTicketId += 1;
  return ticket;
}

export function addMessage(
  ticketId: number,
  input: {
    author: string;
    team: TicketTeam;
    body: string;
    kind?: "chat" | "sistem";
    visibility?: TicketVisibility;
    replyToId?: number | null;
    attachment?: { fileName: string; mime: string; size: number; objectUrl?: string };
  }
): void {
  const ticket = getTicket(ticketId);
  if (!ticket) return;
  const stamp = nowIso();
  // Ruang asal pesan. Pemanggil selalu mengirimnya eksplisit (satu composer per ruang);
  // cadangan di bawah hanya jaring pengaman.
  const visibility: TicketVisibility =
    input.visibility ?? (input.team === "cs" || ticket.stage === "produk" ? "all" : "factory");
  const messageId = nextMessageId++;
  ticket.messages.push({
    id: messageId,
    author: input.author,
    team: input.team,
    body: input.body,
    kind: input.kind ?? "chat",
    visibility,
    createdAt: stamp,
    replyToId: input.replyToId ?? null,
  });
  if (input.attachment) {
    ticket.attachments.push({
      id: nextAttachmentId++,
      fileName: input.attachment.fileName,
      mime: input.attachment.mime,
      size: input.attachment.size,
      storage: "server",
      visibility,
      objectUrl: input.attachment.objectUrl,
      messageId,
    });
  }
  ticket.updatedAt = stamp;
  ticket.unread += 1;
}

/** Ubah isi pesan sendiri; UI menampilkan tanda "diedit" dari `editedAt`. */
export function editMessage(ticketId: number, messageId: number, body: string): boolean {
  const ticket = getTicket(ticketId);
  const message = ticket?.messages.find((item) => item.id === messageId);
  if (!ticket || !message || message.kind !== "chat" || !body.trim()) return false;
  message.body = body.trim();
  message.editedAt = nowIso();
  ticket.updatedAt = message.editedAt;
  return true;
}

/**
 * Teruskan lampiran dari satu ruang ke ruang lain (Tim Produk: lampiran CS ke ruang
 * pabrik). Berkas disalin sebagai entri baru dengan `forwardedFromId` supaya aslinya
 * tetap tinggal di ruang CS.
 */
export function forwardAttachments(ticketId: number, attachmentIds: number[], to: TicketVisibility): number {
  const ticket = getTicket(ticketId);
  if (!ticket) return 0;
  const sources = ticket.attachments.filter(
    (item) => attachmentIds.includes(item.id) && item.visibility !== to && item.forwardedFromId === undefined,
  );
  for (const source of sources) {
    ticket.attachments.push({
      ...source,
      id: nextAttachmentId++,
      visibility: to,
      storage: "server",
      forwardedFromId: source.id,
      // Salinan berdiri sendiri di ruang tujuan (bukan menempel ke pesan ruang asal).
      messageId: undefined,
    });
  }
  if (sources.length > 0) {
    const stamp = nowIso();
    ticket.messages.push({
      id: nextMessageId++,
      author: "sistem",
      team: "produk",
      body: `Tim Produk meneruskan ${sources.length} lampiran dari CS ke Tim Pabrik.`,
      kind: "sistem",
      visibility: to,
      createdAt: stamp,
    });
    ticket.updatedAt = stamp;
    ticket.unread += 1;
  }
  return sources.length;
}

/** Tandai tiket sudah dibaca (dipanggil saat halaman detail dibuka). */
export function markTicketRead(ticketId: number): void {
  const ticket = getTicket(ticketId);
  if (ticket) ticket.unread = 0;
}

export function escalate(
  ticketId: number,
  input: {
    factoryId: number;
    factoryName: string;
    note: string;
    defects: TicketDefectLink[];
    /** Lampiran CS yang ikut diteruskan ke ruang pabrik saat eskalasi. */
    attachmentIds?: number[];
  }
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
  ticket.attachments = ticket.attachments.map((a) => ({ ...a, storage: "server" }));
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
  forwardAttachments(ticketId, input.attachmentIds ?? [], "factory");
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
