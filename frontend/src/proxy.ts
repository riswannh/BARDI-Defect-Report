import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Gerbang sesi di sisi server (Next.js 16: `proxy.ts`, dulu `middleware.ts`).
 *
 * Tanpa berkas ini, halaman dashboard dirender di server lebih dulu, baru
 * `AuthGuard` di browser memeriksa sesi dan mengalihkan ke `/login`. Akibatnya
 * pengguna melihat kedipan halaman Report sebelum dilempar ke halaman login.
 * Proxy ini memeriksa cookie sesi SEBELUM halaman dirender, jadi kedipan itu
 * tidak terjadi.
 *
 * Catatan penting: ini hanya pemeriksaan KEBERADAAN cookie, bukan validasi.
 * Cookie palsu tetap lolos gerbang ini, jadi validasi sesungguhnya tetap
 * dilakukan server pada setiap permintaan API (`requireUser`/`requireAdmin`)
 * dan oleh `AuthGuard`. Jadi berkas ini murni memperbaiki UX — bukan lapisan
 * keamanan, dan tidak boleh diandalkan sebagai satu-satunya penjaga.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Hanya halaman dashboard yang dijaga. `/login`, `/api/*`, dan aset statis
   * sengaja dilewatkan supaya tidak ada pengalihan berulang.
   */
  matcher: [
    "/",
    "/report/:path*",
    "/po/:path*",
    "/master/:path*",
    "/defects/:path*",
    "/sales/:path*",
    "/users/:path*",
  ],
};
