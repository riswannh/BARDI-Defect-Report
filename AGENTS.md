# AGENTS.md

## Git Workflow (WAJIB)

Setiap selesai mengerjakan perubahan fitur, commit dan push ke git:

1. Jalankan pengecekan di folder `frontend`:
   - `npx tsc --noEmit`
   - `npx eslint`
2. `git add -A`
3. `git commit -m "<pesan deskriptif>"`
4. `git push`

- Repo: https://github.com/riswannh/BARDI-Defect-Report (branch: `main`)
- Gunakan pesan commit yang jelas dan deskriptif.
- Jangan commit file yang di-ignore (`node_modules`, `.next`, settings lokal `.claude`).

## Tools

Jika `git` atau `gh` tidak dikenali di PATH, pakai path lengkap:

- Git: `C:\Program Files\Git\cmd\git.exe`
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe`

## Struktur Project

- `PRD.md` — dokumen kebutuhan produk (Web Analisa Defect dan Sales Produk)
- `frontend/` — aplikasi Next.js 16 (App Router, Tailwind v4, Base UI, Recharts)

## Backend (di `frontend/`)

- **Stack**: Next.js Route Handlers + Drizzle ORM + SQLite (better-sqlite3) + Better Auth + SheetJS (xlsx)
- **Env** (`.env`, tidak di-commit): `DB_FILE_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Perintah**:
  - `npm run db:push` — sinkronkan schema ke SQLite
  - `npm run db:seed` — isi data awal (idempotent, skip jika sudah ada data)
- **Kredensial seed**: `admin/admin123`, `pabrik_jkt/pabrik123`, `pabrik_sby/pabrik123`, `pabrik_bdg/pabrik123`
- **Struktur**:
  - `src/lib/db/schema.ts` — tabel (auth + factories/products/problems/statuses/defects/sales)
  - `src/lib/db/index.ts` — koneksi Drizzle
  - `src/lib/auth.ts` — konfigurasi Better Auth (username plugin, field `isAdmin` & `factoryId`)
  - `src/lib/api/*` — guard role, validasi zod, CRUD, report, Excel
  - `src/app/api/*` — route handlers
- **Aturan akses**: Admin bisa semua; role Pabrik hanya data pabriknya & field `value` dihapus dari respons
- **Excel**: `GET /api/excel/{module}/export`, `POST /api/excel/{module}/import`, `GET /api/excel/{module}/template` (module: products, problems, statuses, factories, defects, sales, users)

## Konvensi Aplikasi

- Bahasa UI: Indonesia (i18n: Indonesia/English/中文)
- Auth: Better Auth session cookie via `src/lib/auth-client.ts`; frontend fetch API di `src/lib/api-client.ts` + hook `src/lib/use-api.ts`
- Kredensial seed: `admin/admin123`, `pabrik_jkt/pabrik123`, `pabrik_sby/pabrik123`, `pabrik_bdg/pabrik123`
- Value (IDR) hanya tampil untuk role admin (dihapus dari respons API untuk role pabrik)
- Data defect pakai timestamp lengkap (tanggal + jam); data sales per bulan (avg per hari untuk chart harian/mingguan/rentang)
- Halaman Report mengambil data dari `GET /api/report` (recap + buckets + totals dihitung di server)
