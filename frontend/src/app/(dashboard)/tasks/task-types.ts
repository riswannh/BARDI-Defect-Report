/** Tipe data + konstanta bersama untuk halaman Task Planner. */

export interface TaskRow {
  id: number;
  userId: string;
  ownerName: string;
  title: string;
  description: string;
  progress: number;
  priority: string;
  difficulty: string;
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

export const PRIORITIES = ["Urgent", "Segera", "Normal"] as const;
export const DIFFICULTIES = ["Mudah", "Sedang", "Sulit"] as const;
export const REPEAT_RULES = ["", "daily", "weekly", "monthly"] as const;
export const TASK_STATUSES = ["Belum", "Selesai"] as const;

export type RepeatRule = (typeof REPEAT_RULES)[number];

export const REPEAT_LABEL_KEYS: Record<string, string> = {
  "": "tasks.repeatNone",
  daily: "tasks.repeatDaily",
  weekly: "tasks.repeatWeekly",
  monthly: "tasks.repeatMonthly",
};

export const PRIORITY_LABEL_KEYS: Record<string, string> = {
  Urgent: "tasks.priorityUrgent",
  Segera: "tasks.prioritySegera",
  Normal: "tasks.priorityNormal",
};

export const DIFFICULTY_LABEL_KEYS: Record<string, string> = {
  Mudah: "tasks.difficultyEasy",
  Sedang: "tasks.difficultyMedium",
  Sulit: "tasks.difficultyHard",
};

export const WEEKDAY_LABEL_KEYS = [
  "tasks.weekdayMon",
  "tasks.weekdayTue",
  "tasks.weekdayWed",
  "tasks.weekdayThu",
  "tasks.weekdayFri",
  "tasks.weekdaySat",
  "tasks.weekdaySun",
];

export const ACTION_LABEL_KEYS: Record<string, string> = {
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
