# Spec: Fitur Ticketing (Kendala) — Rencana Master

> Dokumen induk untuk seluruh pekerjaan modul tiket di Portal BARDI. Menggabungkan semua keputusan yang sudah diambil; kalau ada bagian di sini yang bertentangan dengan catatan lama, dokumen ini yang dipakai.
>
> Status: **disetujui 3 Okt 2026** — Fase 0 sedang dikerjakan (lihat bagian 10).

## 1. Objective

Tiket kendala berlabuh dari **CS → Tim Produk → Tim Pabrik (China)**; tiap perpindahan (`<>`) adalah pertukaran informasi berbentuk chat. Tiket pertama diterbitkan **CS**; kalau Tim Produk tidak bisa menyelesaikan, tiket **di-eskalasi ke Tim Pabrik**.

Isi tiket: **Produk, Virtual ID, lampiran Foto/Video (banyak berkas), Penjelasan Kendala, Kronologi, Solusi yang sudah dicoba**.

Modul berdiri **di dalam Portal BARDI** (bukan aplikasi terpisah) dan aman untuk jaringan China: seluruh aset browser disajikan aplikasi sendiri, tanpa panggilan ke Google/CDN dari halaman (`PRODUCT.md:57-58`).

## 2. Keputusan yang dikunci

| # | Keputusan | Dasar |
|---|---|---|
| 1 | Lampiran **selalu disimpan ke Google Drive saat tiket dibuat**; **salinan ke penyimpanan server HANYA saat eskalasi** ke pabrik; retensi server **30 hari setelah tiket selesai** | koreksi user, 3 Okt 2026 |
| 2 | Semua tim internal (CS, Produk) melihat semua tiket; **Tim Pabrik hanya melihat tiket yang di-eskalasi ke pabriknya** | jawaban user |
| 3 | **Privasi CS**: CS tetap melihat tiket + pesan **sebelum** eskalasi + status, tetapi **seluruh pesan/lampiran setelah eskalasi tidak dikirim sama sekali oleh API** (bukan cuma disembunyikan di UI). Tahap versi CS: `pabrik` → "Ditangani Tim Produk", `selesai` → "Selesai" — kata "Pabrik" tidak pernah muncul untuk CS | permintaan user + opsi A |
| 4 | **Terjemahan per gelembung chat** ke bahasa UI yang sedang dipakai (id/en/zh), memakai **LibreTranslate self-hosted di VPS BARDI yang sama** | permintaan user + opsi A |
| 5 | **Eskalasi Produk → Pabrik bisa mengaitkan baris Data Defect** yang sudah ada sebagai informasi tambahan | permintaan user |
| 6 | **Frontend lebih dulu** untuk verifikasi; Produk, Pabrik, dan Data Defect memakai data **asli** dari API yang ada, data tiket sendiri contoh dulu | permintaan user |
| 7 | Nilai IDR tidak boleh sampai ke role Pabrik (`PRODUCT.md:84`, `stripValue` di `frontend/src/lib/api/records.ts:46`) — berlaku juga untuk defect yang dikaitkan | aturan proyek |

## 3. Status tiket & hak akses

Status: `baru` → `produk` → `pabrik` → `selesai` (plus aksi "Buka lagi" yang mengembalikan ke tahap sebelumnya).

| Aksi | CS | Tim Produk | Tim Pabrik |
|---|---|---|---|
| Tulis tiket baru | ya (satu-satunya) | — | — |
| Lihat tiket | semua | semua | hanya eskalasi pabriknya (`frontend/src/lib/api/guard.ts:54-60`) |
| Chat | sebelum eskalasi | ya | ya |
| Eskalasi ke pabrik | tidak | ya | tidak |
| Selesai / Buka lagi | ya | ya | tidak |
| Hapus tiket | admin + CS pembuat | admin | tidak |
| Lihat Defect terkait | **tidak** | ya | ya (tanpa kolom nilai) |

Aturan visibilitas terpusat di satu modul: `canSeeTicket(user, ticket)` dan `canSeeMessage(user, ticket, message)`, wajib dipakai semua route tiket.

## 4. Data Model (Fase 1)

Semua tabel di `frontend/src/lib/db/schema.ts`, mengikuti pola tabel `defects` (properti camelCase, kolom DB snake_case):

- `tickets` — `id`, `code` unik `TKT-YYYYMM-####`, `title`, `productId`, `virtualId`, `problemDetail`, `chronology`, `triedSolutions`, `status`, `factoryId`, `createdById` (CS), `escalatedById`, `escalatedAt`, `solvedAt`, `createdAt`.
- `ticket_messages` — `id`, `ticketId`, `userId`, `body`, `kind` (`chat`/`sistem`), `visibility` (`all`/`factory`), `createdAt`.
- `ticket_attachments` — `id`, `ticketId`, `messageId` (opsional), `fileName`, `mime`, `size`, `driveFileId`, `driveUrl`, `serverPath`, `visibility`, `createdAt`.
- `visibility` adalah **penanda ruang**, bukan sekadar izin lihat: `all` = ruang "CS ↔ Tim Produk", `factory` = ruang "Tim Produk ↔ Tim Pabrik". Ruang tetap sama seumur tiket (tidak berubah saat eskalasi), jadi jumlah kolomnya tidak perlu ditambah.
- `ticket_defects` — `ticketId` + `defectId` PK gabungan, cascade, index; pola `product_spare_parts`.
- `translation_cache` — `hash` PK (teks + sumber + tujuan), `translated`, `createdAt`; pembersihan lazy.
- `user.team` — `"cs" | "produk" | "pabrik"`; role Pabrik tetap memakai `user.factoryId`.

## 5. Lampiran: Drive saat dibuat, server saat eskalasi

1. **Saat dibuat (CS)**: berkas dialirkan ke Shared Drive `Portal BARDI` (`0AIIAgECt1SvGUk9PVA`) di folder `Media Vault` (`1nmFiMg9QOEzlMqPdFut-Q1n9sXFfrHGe`) lewat satu PUT resumable dengan 3 percobaan. Service account tidak punya kuota My Drive → **wajib Shared Drive + `supportsAllDrives=true`** (kalau tidak: `403 storageQuotaExceeded`).
2. **Saat eskalasi**: route eskalasi menyalin berkas dari Drive ke `<dataDir>/ticket-files/<ticketId>/` dan mengisi `serverPath`. Mulai titik ini role Pabrik **tidak** memakai tautan Drive (jaringan China) — mereka mengunduh lewat `GET /api/ticket-attachments/[id]/file`.
3. Otorisasi Drive memakai `getAccessToken()` di `frontend/src/lib/gsheet/auth.ts:70`; scope di `frontend/src/lib/gsheet/auth.ts:5` dilebarkan ke `https://www.googleapis.com/auth/drive`.
4. Unggah **binari mentah, bukan multipart** (tidak ada `busboy`/`multer` di dependency): badan request dialirkan ke disk dalam potongan, ada batas ukuran eksplisit + daftar mime yang diizinkan; nama berkas dari header, disanitasi.
5. Retensi: pembersihan lazy saat listing/detail tiket (pola `frontend/src/app/api/client-errors/route.ts:62-71`) menghapus berkas server yang lebih tua dari 30 hari setelah `solvedAt`; berkas di Drive dibiarkan (itu arsipnya).
6. Tautan foto/video dari Data Defect yang dikaitkan **tidak bisa dibuka tim pabrik** — UI menampilkan peringatan dan menyarankan mengunggah ulang berkasnya sebagai lampiran tiket.

## 6. Chat, privasi CS, dan terjemahan

- Thread chat di halaman detail: **dua kartu ruang** — "CS ↔ Tim Produk" (`visibility='all'`) dan "Tim Produk ↔ Tim Pabrik" (`visibility='factory'`); gelembung kiri/kanan, pesan `sistem` untuk kejadian (eskalasi, selesai, buka lagi), segarkan otomatis tiap 10 detik.
- **Penyaringan di server**, bukan di UI: CS hanya menerima ruang `all`, Tim Pabrik hanya ruang `factory`, Tim Produk menerima keduanya. Pesan/lampiran ruang `factory` tidak pernah masuk respons untuk user CS.
- **Relay permintaan pabrik ke CS**: Tim Produk menuliskan permintaan pabrik di ruang `all` supaya CS membacanya, jadi CS tetap boleh mengirim pesan di ruang `all` setelah tiket dieskalasi (ruang CS tidak dikunci).
- **Terjemahan per bubble**: tiap gelembung punya aksi "Terjemahkan ke <bahasa UI aktif>" (mengikuti bahasa aktif di `frontend/src/lib/i18n.ts`); hasil tampil di bawah teks asli + tombol sembunyikan, teks asli tidak pernah ditimpa.
- `POST /api/translate` meneruskan ke `http://libretranslate:5000/translate` (jaringan internal Docker), hasilnya disimpan ke `translation_cache` supaya teks yang sama tidak dihitung ulang. Kalau layanan mati → 503, UI menampilkan "Terjemahan tidak tersedia".

## 7. API Contract (Fase 1)

```
GET/POST   /api/tickets                          # daftar (filter status/produk/q) & buat tiket (CS)
GET/PATCH/DELETE /api/tickets/[id]               # detail, ubah, hapus (admin/CS pembuat)
GET/POST   /api/tickets/[id]/messages            # thread chat (tersaring visibilitas)
POST       /api/tickets/[id]/escalate            # Tim Produk → Pabrik (+ defectIds[])
POST       /api/tickets/[id]/solve               # tandai selesai (set solvedAt)
POST       /api/tickets/[id]/reopen              # buka lagi
POST       /api/tickets/[id]/attachments         # unggah binari mentah (stream ke disk/Drive)
GET        /api/ticket-attachments/[id]/file     # unduh dari server (dipakai role Pabrik)
POST       /api/ticket-attachments/[id]/sync     # salin Drive → server (dipanggil saat eskalasi)
DELETE     /api/ticket-attachments/[id]          # hapus lampiran
GET/POST/DELETE /api/tickets/[id]/defects        # kaitan Data Defect (POST body: defectIds[])
POST       /api/translate                        # {q, source?, target} → {translatedText}
```

Semua route lewat `requireUser()` (`frontend/src/lib/api/guard.ts:35`); hapus tiket & pengaturan `team` user lewat `requireAdmin()` (`frontend/src/lib/api/guard.ts:41`). Response defect yang dikaitkan **tidak** memuat kolom nilai untuk role Pabrik.

## 8. Boundaries

- Tidak menyentuh modul Defect/Sales/PO yang sudah jalan kecuali membaca `GET /api/defects` (sudah ada, `frontend/src/lib/api/records.ts:419-424`).
- Tidak ada master baru: Produk, Pabrik, Defect memakai data yang sudah ada.
- Tidak memakai library baru untuk unggah berkas (dialirkan manual) dan tidak memakai paket Google baru (`googleapis` tidak ada; akses Drive memakai `node:crypto` + `fetch` seperti modul gsheet).
- Riwayat chat tidak boleh diubah/dihapus (hanya pesan sistem yang dibuat server).

## 9. Fase 0 — Frontend pratinjau (yang sedang dikerjakan)

Tampilan saja: data tiket contoh di memori browser (`ticket-preview-data.ts`, ditandai `ponytail: data contoh — ganti ke /api/tickets saat backend siap`), sementara **Produk / Pabrik / Defect memakai data asli** dari `GET /api/products`, `GET /api/factories` (`frontend/src/lib/api/master.ts:178`) dan `GET /api/defects`. Tidak ada tabel, API tiket, migrasi, atau deploy di fase ini.

Berkas baru di `frontend/src/app/(dashboard)/tickets/`:

- `page.tsx` — daftar + 4 SummaryCard + filter (status, produk, pencarian) + Table + Pagination (pola `frontend/src/app/(dashboard)/defects/page.tsx`).
- `[id]/page.tsx` — halaman detail pertama di aplikasi ini: kartu info + badge status, kartu **Defect terkait**, lampiran, thread chat, kotak kirim, aksi Eskalasi / Selesai / Buka lagi / Hapus.
- `ticket-form-dialog.tsx`, `ticket-status-badge.tsx`, `ticket-message-bubble.tsx` (aksi terjemahkan), `ticket-attachment-list.tsx`, `ticket-defect-picker.tsx` (pencarian kode garansi + checkbox, tersaring ke produk tiket + peringatan tautan Google), `ticket-defect-list.tsx`, `ticket-preview-data.ts`.

Diubah: `frontend/src/components/sidebar-nav.tsx:25-43` (+`{href:"/tickets", labelKey:"nav.tickets", icon:Headset}`), `frontend/src/proxy.ts:35-43` (+`"/tickets/:path*"`), `frontend/src/lib/i18n.ts` (+`nav.tickets` dan kunci `ticket.*`, lengkap id/en/zh).

Pratinjau memuat: banner "Mode pratinjau — data contoh, belum tersimpan ke server", pemilih **"Lihat sebagai"** (CS / Tim Produk / Tim Pabrik) yang menyimulasikan aturan visibilitas, chip lampiran dengan pratinjau gambar lokal (`URL.createObjectURL`), dan polling 10 detik.

## 10. Fase kerja & Success Criteria

| Fase | Isi | Selesai kalau |
|---|---|---|
| **0** | Dokumen ini + frontend pratinjau | `/tickets` + detail jalan dengan data contoh & produk/pabrik/defect asli; aturan 3 role terlihat saat "Lihat sebagai"; form tiket baru auto-isi pabrik dari produk; eskalasi + defect terkait + pesan sistem + selesai/buka lagi/hapus jalan; tombol terjemahan mengikuti bahasa UI; `npx tsc --noEmit` dan `npx eslint src` exit 0; dev server hidup di `http://localhost:3100` (login `admin/admin123`) + screenshot untuk verifikasi user |
| **1** | Skema + API + Drive/server + retensi | Tiket nyata tersimpan di SQLite; unggah banyak berkas; salinan server hanya muncul setelah eskalasi; CS tidak menerima satu pun data pasca-eskalasi (dibuktikan lewat respons API mentah); Pabrik hanya melihat tiketnya, tanpa IDR; pembersihan >30 hari terbukti menghapus berkas |
| **2** | LibreTranslate + `/api/translate` + cache | Terjemahan nyata id/en/zh per gelembung; RAM VPS tetap di bawah batas; `docker compose` naik bersih; aplikasi tetap sehat |
| **3** | Dokumentasi + deploy | `README.md` (modul, API, status), `PRODUCT.md` (foto/video tiket kini unggahan, bukan sekadar tautan), `AGENTS.md:119-123` menyebut `SPEC-ticketing.md`; commit + push `main`; deploy `deploy/deploy-19.sh` dengan tag rollback `:sebelum-fix` |

## 11. Terjemahan: layanan & beban server

Server ukur (3 Okt 2026): 2 vCPU EPYC 9355P, RAM 7935 MB (terpakai 3333, tersedia 4602, **tanpa swap**), disk 96 GB (terpakai 6.8 GB). Kontainer berjalan: `bardi-app` 182 MiB, `bardi-headroom` 1556 MiB, `bardi-9router` 148 MiB, `bardi-caddy` 15 MiB.

LibreTranslate: image `libretranslate/libretranslate:latest` ±209 MB terkompresi (varian CUDA 1,9 GB, tidak dipakai), model Argos 60–120 MB per pasangan ⇒ id+en+zh ±300 MB. Pivot lewat Inggris otomatis (dokumentasi resmi) ⇒ id↔zh aman. Verdict: **tidak berat** karena terjemahan hanya saat tombol ditekan; tapi tanpa swap, pengaman wajib:

- `mem_limit: 1.2g`, `LT_THREADS=2`, `LT_LOAD_ONLY=en,id,zh`, `LT_CHAR_LIMIT`, `ARGOS_CHUNK_TYPE=MINISBD`.
- `restart: unless-stopped` + healthcheck, volume model `libretranslate_models:/home/libretranslate/.local`.
- Port **tidak** dipublikasikan ke host (hanya jaringan internal compose).
- `translation_cache` di aplikasi supaya teks yang sama tidak dihitung ulang.

## 12. Risiko & asumsi

- **Drive**: service account tidak punya kuota pribadi → semua tulisan harus ke Shared Drive; kalau folder target berubah, satu konstanta yang diganti.
- **Video besar**: tanpa `busboy`, badan request dialirkan; batas ukuran harus eksplisit supaya RAM tidak habis.
- **Tanpa swap**: LibreTranslate dibatasi memori; naikkan `mem_limit` sebelum menambah model bahasa.
- **Terjemahan bukan pengganti bahasa**: teks asli selalu ditampilkan.
- Asumsi: user CS/Produk adalah user Portal BARDI biasa yang kolom `team`-nya diisi admin.

## 13. Open Questions

1. Nama folder Drive khusus tiket di dalam `Media Vault` (usulan: `Tiket`).
2. Batas ukuran berkas & jumlah lampiran per tiket (usulan: 200 MB/berkas, 10 berkas).
3. Apakah CS pembuat boleh menghapus tiketnya sendiri setelah selesai (usulan: tidak, hanya admin).
4. Notifikasi "ada tiket baru" untuk Tim Produk (belum diminta; di luar rencana ini).
