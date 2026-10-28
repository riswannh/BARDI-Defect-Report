import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { requireUser } from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";

/**
 * Profil hak akses user yang sedang login. Dipakai klien untuk menyusun menu
 * dan penjaga halaman, jadi isinya SENGAJA hanya ringkasan role — bukan daftar
 * seluruh user.
 */
export async function meGET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let roleName: string | null = null;
  if (user.roleId !== null) {
    const [row] = await db
      .select({ name: roles.name })
      .from(roles)
      .where(eq(roles.id, user.roleId));
    roleName = row?.name ?? null;
  }

  return jsonOk({
    roleId: user.roleId,
    roleCode: user.roleCode,
    roleName,
    hideFinance: user.hideFinance,
    permissions: user.permissions,
  });
}
