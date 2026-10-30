/** Tipe data + konstanta bersama untuk halaman Task Planner. */

import type { TranslationKey } from "@/lib/i18n";

export interface TaskRow {
  id: number;
  userId: string;
  ownerName: string;
  title: string;
  description: string;
  progress: number;
  priority: string;
  difficulty: string;
  /** task / bug / feature / subtask. */
  issueType: string;
  boardOrder: number;
  status: string;
  startDate: string;
  dueDate: string;
  repeatRule: string;
  repeatWeekday: number | null;
  repeatDay: number | null;
  repeatParentId: number | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TaskActivityRow {
  id: number;
  taskId: number | null;
  taskTitle: string;
  actorId: string;
  actorName: string;
  action: string;
  changes: string;
  note: string;
  createdAt: string | null;
}

export interface TaskTypeRow {
  id: number;
  /** Pemilik daftar (user.id). */
  userId: string;
  code: string;
  name: string;
  sortOrder: number;
  used: number;
}

/** Akun pemilik kalender + warna kartunya. */
export interface TaskOwner {
  id: string;
  name: string;
  color?: string | null;
}

export const PRIORITIES = ["Urgent", "Segera", "Normal"] as const;
export const DIFFICULTIES = ["Mudah", "Sedang", "Sulit"] as const;
export const REPEAT_RULES = ["", "daily", "weekly", "monthly"] as const;
export const TASK_STATUSES = ["Belum", "Proses", "Selesai"] as const;

/** Palet warna bawaan untuk akun yang belum memilih warna kartu sendiri. */
export const OWNER_COLORS = [
  "#2563eb",
  "#db2777",
  "#0d9488",
  "#f59e0b",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
];

/**
 * Warna kartu sebuah akun di kalender: warna pilihannya sendiri
 * (`user.calendarColor`), atau palet bawaan berdasarkan urutan akun.
 */
export function ownerColor(owners: TaskOwner[], userId: string): string {
  const index = owners.findIndex((item) => item.id === userId);
  const chosen = owners[index]?.color;
  if (chosen) return chosen;
  return OWNER_COLORS[(index < 0 ? 0 : index) % OWNER_COLORS.length];
}

/** Tipe milik satu akun, urut sesuai sortOrder. */
export function typesOfOwner(types: TaskTypeRow[], userId?: string): TaskTypeRow[] {
  if (!userId) return types;
  return types.filter((item) => item.userId === userId);
}

/**
 * Nama tipe dari daftar pemiliknya; kalau pemilik tidak diketahui, pakai
 * kecocokan kode pertama. Kode tak dikenal tampil apa adanya.
 */
export function typeName(types: TaskTypeRow[], code: string, userId?: string): string {
  const owned = typesOfOwner(types, userId);
  const found = owned.find((item) => item.code === code) ?? types.find((item) => item.code === code);
  return found ? found.name : code || "—";
}


export const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  Belum: "tasks.statusOpen",
  Proses: "tasks.statusProses",
  Selesai: "tasks.statusDone",
};

/** Warna badge status (aman mode gelap). */
export function statusTone(status: string): string {
  if (status === "Selesai") return "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400";
  if (status === "Proses") return "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:text-blue-400";
  return "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300";
}

export type RepeatRule = (typeof REPEAT_RULES)[number];

export const REPEAT_LABEL_KEYS: Record<string, TranslationKey> = {
  "": "tasks.repeatNone",
  daily: "tasks.repeatDaily",
  weekly: "tasks.repeatWeekly",
  monthly: "tasks.repeatMonthly",
};

export const PRIORITY_LABEL_KEYS: Record<string, TranslationKey> = {
  Urgent: "tasks.priorityUrgent",
  Segera: "tasks.prioritySegera",
  Normal: "tasks.priorityNormal",
};

export const DIFFICULTY_LABEL_KEYS: Record<string, TranslationKey> = {
  Mudah: "tasks.difficultyEasy",
  Sedang: "tasks.difficultyMedium",
  Sulit: "tasks.difficultyHard",
};

export const WEEKDAY_LABEL_KEYS: TranslationKey[] = [
  "tasks.weekdayMon",
  "tasks.weekdayTue",
  "tasks.weekdayWed",
  "tasks.weekdayThu",
  "tasks.weekdayFri",
  "tasks.weekdaySat",
  "tasks.weekdaySun",
];

export const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  create: "tasks.actionCreate",
  update: "tasks.actionUpdate",
  progress: "tasks.actionProgress",
  status: "tasks.actionStatus",
  repeat: "tasks.actionRepeat",
  delete: "tasks.actionDelete",
};

/** Warna badge prioritas (aman untuk mode gelap). */
export function priorityTone(priority: string): string {
  if (priority === "Urgent") return "bg-red-500/10 text-red-600 ring-red-500/25 dark:text-red-400";
  if (priority === "Segera") return "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400";
  return "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300";
}
