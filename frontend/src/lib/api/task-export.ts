import * as XLSX from "xlsx";
import { asc, eq, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { taskTypes, tasks } from "@/lib/db/schema";
import { requireMenu } from "@/lib/api/guard";
import { jsonError } from "@/lib/api/response";

/**
 * Ekspor Task Planner ke Excel: satu sheet rekap per akun + satu sheet detail
 * semua task. Admin bisa memilih akun lewat `?ownerId=`; akun non-admin selalu
 * diekspor untuk dirinya sendiri karena hanya task miliknya yang boleh dibaca.
 */

const TYPE_FALLBACK: Record<string, string> = {
  task: "Tugas",
  bug: "Bug",
  feature: "Fitur",
  subtask: "Sub-task",
};

const REPEAT_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};

const REKAP_HEADERS = [
  "Akun",
  "Total Task",
  "Belum",
  "Proses",
  "Selesai",
  "Lewat Tenggat",
  "Rata-rata Kemajuan (%)",
];

const DETAIL_HEADERS = [
  "ID",
  "Judul",
  "Keterangan",
  "Akun",
  "Tipe",
  "Prioritas",
  "Kesulitan",
  "Tanggal Mulai",
  "Tenggat",
  "Status",
  "Kemajuan (%)",
  "Pengulangan",
  "Dibuat",
  "Diperbarui",
];

type SheetRow = Record<string, string | number>;

function sheetBuffer(rows: SheetRow[], headers: string[], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

function prependSheet(
  workbook: XLSX.WorkBook,
  rows: SheetRow[],
  headers: string[],
  sheetName: string
) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function downloadResponse(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function slug(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "task-planner";
}

function todayISO() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Drizzle bisa mengembalikan Date valid, Date kosong, atau string ISO. */
function stamp(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export async function taskExportGET(req: NextRequest) {
  const guard = await requireMenu("tasks", "read");
  if (!guard.ok) return guard.response;

  const requested = req.nextUrl.searchParams.get("ownerId")?.trim();
  if (requested && !guard.user.isAdmin && requested !== guard.user.id) {
    return jsonError("Hanya admin yang bisa mengekspor task akun lain.", 403);
  }
  const ownerId = guard.user.isAdmin ? requested ?? "" : guard.user.id;

  const conditions: SQL[] = [];
  if (ownerId) conditions.push(eq(tasks.userId, ownerId));

  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(asc(tasks.ownerName), asc(tasks.dueDate), asc(tasks.id));

  const typeRows = await db
    .select({ userId: taskTypes.userId, code: taskTypes.code, name: taskTypes.name })
    .from(taskTypes);
  const typeMap = new Map(
    typeRows.map((item) => [`${item.userId}:${item.code}`, item.name] as const)
  );

  const today = todayISO();
  const perOwner = new Map<
    string,
    { name: string; total: number; open: number; proses: number; done: number; late: number; progress: number }
  >();

  const detail: SheetRow[] = rows.map((task) => {
    const bucket =
      perOwner.get(task.userId) ??
      { name: task.ownerName, total: 0, open: 0, proses: 0, done: 0, late: 0, progress: 0 };
    bucket.total += 1;
    bucket.progress += task.progress ?? 0;
    if (task.status === "Selesai") bucket.done += 1;
    else if (task.status === "Proses") bucket.proses += 1;
    else bucket.open += 1;
    if (task.status !== "Selesai" && task.dueDate && task.dueDate < today) bucket.late += 1;
    perOwner.set(task.userId, bucket);

    return {
      ID: task.id,
      Judul: task.title,
      Keterangan: task.description ?? "",
      Akun: task.ownerName,
      Tipe: typeMap.get(`${task.userId}:${task.issueType}`) ?? TYPE_FALLBACK[task.issueType] ?? task.issueType,
      Prioritas: task.priority,
      Kesulitan: task.difficulty,
      "Tanggal Mulai": task.startDate ?? "",
      Tenggat: task.dueDate ?? "",
      Status: task.status,
      "Kemajuan (%)": task.progress ?? 0,
      Pengulangan: task.repeatRule ? REPEAT_LABEL[task.repeatRule] ?? task.repeatRule : "-",
      Dibuat: stamp(task.createdAt),
      Diperbarui: stamp(task.updatedAt),
    };
  });

  const rekap: SheetRow[] = Array.from(perOwner.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bucket) => ({
      Akun: bucket.name,
      "Total Task": bucket.total,
      Belum: bucket.open,
      Proses: bucket.proses,
      Selesai: bucket.done,
      "Lewat Tenggat": bucket.late,
      "Rata-rata Kemajuan (%)": bucket.total > 0 ? Math.round(bucket.progress / bucket.total) : 0,
    }));

  const workbook = sheetBuffer(rekap, REKAP_HEADERS, "Rekap Akun");
  prependSheet(workbook, detail, DETAIL_HEADERS, "Detail Task");

  const label = ownerId
    ? slug(rows[0]?.ownerName || guard.user.name || guard.user.username || "akun")
    : "semua-akun";
  return downloadResponse(workbook, `task-planner-${label}-${today.replace(/-/g, "")}.xlsx`);
}
