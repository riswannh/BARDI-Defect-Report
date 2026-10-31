import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles, user } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";

/**
 * Profil hak akses user yang sedang login. Dipakai klien untuk menyusun menu,
 * penjaga halaman, dan label nama di header — jadi isinya SENGAJA ringkasan
 * akun sendiri, bukan daftar seluruh user.
 */
export async function meGET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const sessionUser = guard.user;

  const [row] = await db
    .select({
      name: user.name,
      username: user.username,
      displayUsername: user.displayUsername,
      jabatan: user.jabatan,
      roleName: roles.name,
    })
    .from(user)
    .leftJoin(roles, eq(roles.id, user.roleId))
    .where(eq(user.id, sessionUser.id));

  return jsonOk({
    name: row?.name ?? sessionUser.name,
    username: row?.username ?? sessionUser.username,
    displayUsername: row?.displayUsername ?? row?.username ?? sessionUser.username,
    jabatan: row?.jabatan ?? "",
    roleId: sessionUser.roleId,
    roleCode: sessionUser.roleCode,
    roleName: row?.roleName ?? null,
    hideFinance: sessionUser.hideFinance,
    permissions: sessionUser.permissions,
  });
}
