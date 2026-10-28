/**
 * Menyiapkan role bawaan sekali per start server.
 *
 * `drizzle-kit push` hanya menambah tabel, tidak mengisi baris. Database
 * produksi yang sudah berisi juga tidak pernah menjalankan `db:seed`, jadi
 * `ensureRoles()` (idempoten) dipanggil di sini agar user lama tetap punya role.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureRoles } = await import("./lib/db/ensure-roles");
    await ensureRoles();
  } catch (error) {
    console.error("[ensure-roles] gagal menyiapkan role bawaan:", error);
  }
}
