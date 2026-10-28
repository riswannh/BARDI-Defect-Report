/**
 * Kunci menu & tipe hak akses role.
 *
 * Modul ini dipakai SERVER (`src/lib/api/*`) dan KLIEN. Jangan menambah
 * dependensi React/i18n di sini supaya aman diimpor dari route handler.
 */

export const MENU_KEYS = [
  "report",
  "sales",
  "po",
  "tickets",
  "tasks",
  "defects",
  "repairs",
  "claim-garansi",
  "master",
  "users",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];
export type AccessMode = "read" | "write";

export interface Access {
  read: boolean;
  write: boolean;
}

export type PermissionMap = Record<MenuKey, Access>;

/** Satu baris matriks hak akses (bentuk yang dipakai API role). */
export interface PermissionEntry {
  menu: MenuKey;
  read: boolean;
  write: boolean;
}

/** Path halaman tiap menu. */
export const MENU_HREF: Record<MenuKey, string> = {
  report: "/report",
  sales: "/sales",
  po: "/po",
  tickets: "/tickets",
  tasks: "/tasks",
  defects: "/defects",
  repairs: "/repairs",
  "claim-garansi": "/claim-garansi",
  master: "/master",
  users: "/users",
};

/** Kunci i18n label menu (dipakai UI; sengaja string agar server aman). */
export const MENU_LABEL_KEY: Record<MenuKey, string> = {
  report: "nav.report",
  sales: "nav.sales",
  po: "nav.po",
  tickets: "nav.tickets",
  tasks: "nav.tasks",
  defects: "nav.defects",
  repairs: "nav.repairs",
  "claim-garansi": "nav.warrantyClaims",
  master: "nav.master",
  users: "nav.users",
};

/**
 * Menu yang TIDAK bisa didelegasikan lewat matriks: hanya super admin
 * (`user.isAdmin`). Mencegah user biasa menaikkan hak aksesnya sendiri.
 */
export const ADMIN_ONLY_MENUS: readonly MenuKey[] = ["users"];

/** Menu yang masih bisa diberikan ke role (semua kecuali admin-only). */
export const GRANTABLE_MENUS: readonly MenuKey[] = MENU_KEYS.filter(
  (menu) => !ADMIN_ONLY_MENUS.includes(menu)
);

export function isMenuKey(value: unknown): value is MenuKey {
  return typeof value === "string" && MENU_KEYS.includes(value as MenuKey);
}

export function emptyPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const menu of MENU_KEYS) {
    map[menu] = { read: false, write: false };
  }
  return map;
}

export function fullPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const menu of MENU_KEYS) {
    map[menu] = { read: true, write: true };
  }
  return map;
}

export function can(
  permissions: PermissionMap,
  menu: MenuKey,
  mode: AccessMode = "read"
): boolean {
  const access = permissions[menu];
  if (!access) return false;
  // Matriks menyimpan read/write terpisah (admin boleh menyalakan write saja).
  // Halaman tetap bisa dibuka kalau write menyala, supaya izin ubah tidak
  // berubah jadi izin kosong yang tidak bisa dipakai.
  if (mode === "write") return access.write;
  return access.read || access.write;
}

/** Halaman pertama yang boleh dibuka — tujuan redirect setelah login. */
export function homeHref(permissions: PermissionMap): string | null {
  for (const menu of MENU_KEYS) {
    if (ADMIN_ONLY_MENUS.includes(menu)) continue;
    if (permissions[menu]?.read) return MENU_HREF[menu];
  }
  return null;
}

/** Permission default role Pabrik saat role sistem dibuat. */
export const PABRIK_DEFAULT_PERMISSIONS: ReadonlyArray<{
  menu: MenuKey;
  read: boolean;
  write: boolean;
}> = [
  { menu: "report", read: true, write: false },
  { menu: "po", read: true, write: false },
  // Alur eskalasi tiket butuh tim pabrik membalas chat.
  { menu: "tickets", read: true, write: true },
  // Task planner dipakai semua tim, termasuk tim pabrik.
  { menu: "tasks", read: true, write: true },
];

/** Kode role yang aturannya di-hardcode di server (nilai Rupiah disembunyikan). */
export const PABRIK_ROLE_CODE = "pabrik";
