/**
 * Saklar mode demo halaman PO Product.
 *
 * Saat aktif, halaman memakai data contoh dari `po-demo-data.ts` dan TIDAK
 * memanggil `/api/purchase-orders` sama sekali — jadi tidak ada data asli yang
 * dibaca maupun ditulis. Dipakai untuk meninjau tampilan sebelum backend PO
 * dibuat.
 *
 * Menyalakan (lalu buka http://localhost:3000/po):
 *   set NEXT_PUBLIC_PO_DEMO=on   di frontend/.env  → restart `npm run dev`
 *
 * Mematikan: hapus baris itu dari .env, atau set selain "on".
 *
 * `NEXT_PUBLIC_*` dibaca saat build, jadi mengubahnya butuh restart dev server.
 * Berkas ini beserta po-demo-data.ts boleh dihapus setelah backend asli selesai.
 */
export const poDemoEnabled = process.env.NEXT_PUBLIC_PO_DEMO === "on";
