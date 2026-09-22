# Deploy BARDI Defect Report ke VPS Hostinger

> **STATUS: SUDAH TER-DEPLOY** (20 September 2026) di
> **https://portalbardi.cloud** — VPS Hostinger `srv1992782`
> (Ubuntu 26.04, 2 vCPU / 7,9 GB RAM / 96 GB, IP `76.13.182.114`).
>
> Berkas ini tetap dipakai sebagai panduan kalau nanti perlu deploy ulang,
> pindah server, atau menyiapkan environment baru. Bagian "Yang sudah berjalan
> di server" di bawah merangkum kondisi nyatanya.

---

## Yang sudah berjalan di server

| Komponen | Kondisi |
|---|---|
| Aplikasi | `https://portalbardi.cloud` — container `bardi-app` (healthy) |
| HTTPS | Let's Encrypt, diterbitkan & diperpanjang otomatis oleh Caddy |
| Database | `/opt/bardi/data/sqlite.db` (1,5 MB) berisi data produksi |
| Backup | `/opt/bardi/backups/` + cron harian 02:00 |
| Firewall | ufw aktif — hanya 22, 80, 443 |
| Pemakaian | app ~92 MB RAM, caddy ~13 MB RAM (dari 7,9 GB) |
| Berkas | `/opt/bardi/`: `docker-compose.yml`, `Caddyfile`, `backup.sh`, `.env` |

Perintah harian di server:

```bash
cd /opt/bardi
docker compose ps                  # status container
docker compose logs -f app         # log aplikasi
docker compose restart app         # restart aplikasi
/opt/bardi/backup.sh               # backup manual
```

---

## Panduan lengkap (untuk deploy berikutnya)

Panduan langkah demi langkah. Semua perintah dijalankan **di VPS** kecuali yang
ditandai *(di komputer Anda)*.

Isi folder ini:

| Berkas | Fungsi |
|---|---|
| `docker-compose.yml` | Menjalankan aplikasi + Caddy (HTTPS otomatis) |
| `Caddyfile` | Aturan reverse proxy; domain diisi dari `.env` |
| `backup.sh` | Backup database harian + hapus salinan lama |
| `.env` | **(Anda buat sendiri, jangan di-commit)** — secret + domain |

---

## 0. Yang perlu disiapkan

- IP VPS dan password/SSH key dari email Hostinger (hPanel → VPS → SSH access)
- Domain gratis dari paket VPS, mis. `defect.domainanda.com`
- Image `bardi-defect-report:latest` dari komputer Anda (langkah 2)

> **Jangan** memasang Node.js/npm di VPS. Semuanya sudah ada di dalam image.
> Kalau dipasang di host, Anda dapat dua versi Node yang saling membingungkan.

---

## 1. Login ke VPS & pembaruan awal

```bash
ssh root@IP_VPS

apt update && apt upgrade -y
apt install -y ufw
```

Aktifkan firewall — hanya SSH dan web yang terbuka. **Port 3000 tidak dibuka**,
karena aplikasi hanya dijangkau Caddy lewat jaringan internal Docker.

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

Siapkan folder aplikasi:

```bash
mkdir -p /opt/bardi/data
cd /opt/bardi
```

---

## 2. Pindahkan image dari komputer Anda

*(di komputer Anda)* — image dibangun di development supaya VPS tidak perlu
mengompilasi apa pun:

```bash
cd "C:\Users\bardi\Documents\Deepseek Project\BARDI-Defect-Report"
docker compose build
docker save bardi-defect-report:latest -o bardi-defect-report.tar
```

Berkasnya ±1,23 GB. Kirim ke server:

```bash
# dari komputer Anda (PowerShell/CMD), ganti IP_VPS
scp bardi-defect-report.tar root@IP_VPS:/opt/bardi/
```

> Kalau koneksi upload lambat/terputus, unggah `.tar` lewat **File Manager
> hPanel** ke `/opt/bardi/`, atau pakai `rsync --partial --progress` agar bisa
> dilanjutkan.

Di server, muat image-nya:

```bash
cd /opt/bardi
docker load -i bardi-defect-report.tar
docker images bardi-defect-report     # harus muncul :latest
rm bardi-defect-report.tar            # hemat 1,2 GB
```

---

### Alternatif: build di VPS (dipakai 22 September 2026)

Cara di atas memindahkan image ±1,2 GB. Kalau koneksi ke VPS sedang tidak stabil, unggahan sebesar
itu rawan putus di tengah. Alternatifnya kirim source saja (±0,25 MB) lalu build di server:

```bash
# di komputer Anda
tar -czf bardi-src.tar.gz --exclude=node_modules --exclude=.next --exclude=".env*" \
  --exclude="*.db*" --exclude=.git -C frontend .
scp -i ~/.ssh/bardi-vps bardi-src.tar.gz root@IP_VPS:/tmp/

# di VPS
docker tag bardi-defect-report:latest bardi-defect-report:sebelum-fix    # jaring pengaman
mkdir -p /opt/bardi/src && tar -xzf /tmp/bardi-src.tar.gz -C /opt/bardi/src
cd /opt/bardi/src && docker build -t bardi-defect-report:baru .
docker tag bardi-defect-report:baru bardi-defect-report:latest
/opt/bardi/backup.sh                        # backup database dulu
cd /opt/bardi && docker compose up -d app   # jalankan image baru
docker image prune                          # opsional: buang image <none>
```

Yang perlu diketahui:

- `docker build` berjalan **di dalam container**, jadi Node/npm tetap tidak dipasang di host —
  peringatan di bagian 0 tetap berlaku.
- Base image `node:22-bookworm-slim` sudah ada di server karena ikut saat image pertama dimuat;
  tahap build butuh akses ke repo Debian (apt) dan npmjs.org.
- Tool build (python3/make/g++) hanya dipakai di tahap `builder`, tidak ikut ke image akhir.
- Build memakan 5–15 menit di 2 vCPU. Aplikasi lama tetap melayani permintaan sampai
  `docker compose up -d app` dijalankan.
- **Rollback**: `docker tag bardi-defect-report:sebelum-fix bardi-defect-report:latest && docker compose up -d app`.

Kalau `.env` sampai ikut di tarball, tidak apa-apa untuk build (`.dockerignore` mengecualikannya),
tapi sebaiknya tetap dikecualikan: berkas itu berisi `BETTER_AUTH_SECRET`.

## 3. Salin berkas deploy

Salin `docker-compose.yml`, `Caddyfile`, dan `backup.sh` dari folder `deploy/`
di repo ke `/opt/bardi/`. Bisa lewat `scp`:

```bash
# dari komputer Anda
scp deploy/docker-compose.yml deploy/Caddyfile deploy/backup.sh root@IP_VPS:/opt/bardi/
```

---

## 4. Buat berkas `.env`

Di server:

```bash
cd /opt/bardi
cat > .env <<'EOF'
# Ganti dengan domain gratis dari Hostinger (tanpa https://)
DOMAIN=defect.domainanda.com

# WAJIB diganti. Minimal 32 karakter. Buat yang acak:
#   openssl rand -base64 48
BETTER_AUTH_SECRET=GANTI_DENGAN_STRING_ACAK_MINIMAL_32_KARAKTER
EOF
chmod 600 .env
```

> `BETTER_AUTH_SECRET` **jangan di-commit** dan jangan dipakai ulang dari
> development. Kalau secret berubah setelah ada sesi login, semua pengguna
> otomatis logout.

---

## 5. Arahkan domain ke VPS

Di hPanel Hostinger → **DNS Zone** domain Anda, pastikan:

| Tipe | Nama | Nilai |
|---|---|---|
| A | `defect` (atau `@` untuk domain utama) | IP VPS Anda |

Tunggu propagasi DNS (biasanya beberapa menit, kadang sampai 1 jam). Cek dari
komputer Anda:

```bash
nslookup defect.domainanda.com
```

Kalau IP-nya sudah benar, lanjut. **Jangan lompat ke langkah 6 sebelum DNS
mengarah ke VPS**, karena Caddy akan gagal mengambil sertifikat HTTPS.

---

## 6. Jalankan aplikasi

```bash
cd /opt/bardi
docker compose up -d
docker compose ps          # tunggu sampai (healthy), ±30–90 detik
docker compose logs -f app # pantau start: "drizzle-kit push" lalu "Ready"
```

Urutan yang terjadi otomatis saat container start:

1. `drizzle-kit push --force` — menyinkronkan schema database
2. `npm run db:seed` — dilewati kalau database sudah berisi data
3. `next start` — server produksi

Buka **https://defect.domainanda.com** dan login dengan `admin` / `admin123`.

> **Segera ganti password admin** setelah login pertama kali:
> User Management → ubah password. Juga hapus akun seed yang tidak dipakai
> (`pabrik_jkt`, `pabrik_sby`, `pabrik_bdg`).

---

## 7. Pasang backup harian

```bash
cd /opt/bardi
chmod +x backup.sh
./backup.sh                 # uji manual dulu, pastikan muncul "OK: ..."
crontab -e
```

Tambahkan satu baris:

```
0 2 * * * /opt/bardi/backup.sh >> /opt/bardi/backup.log 2>&1
```

Cek hasilnya besok: `cat /opt/bardi/backups/` dan `tail /opt/bardi/backup.log`.

> **Ini belum cukup.** Salinan itu masih di VPS yang sama — kalau VPS hilang,
> database dan semua backup ikut hilang. Karena ukurannya hanya ~1,4 MB,
> tarik salinannya keluar server secara berkala, mis. dari komputer kantor:
> `scp root@IP_VPS:/opt/bardi/backups/*.db ./backup-bardi/`

---

## 8. Membawa data yang sudah ada (opsional)

Kalau ingin memakai data dari komputer development, salin database-nya
**sebelum** langkah 6 (atau hentikan container dulu):

```bash
docker compose stop app
# dari komputer Anda:
#   scp data/sqlite.db root@IP_VPS:/opt/bardi/data/
docker compose start app
```

Tanpa ini, server membuat database baru lalu mengisinya dengan data seed.

---

## 9. Update aplikasi di kemudian hari

*(di komputer Anda)*

```bash
docker compose build                      # build image baru
docker save bardi-defect-report:latest -o bardi-defect-report.tar
scp bardi-defect-report.tar root@IP_VPS:/opt/bardi/
```

Di server:

```bash
cd /opt/bardi
cp data/sqlite.db "backups/sebelum-update-$(date +%F-%H%M).db"   # WAJIB
docker compose stop app
docker load -i bardi-defect-report.tar
docker compose up -d
docker compose logs -f app
```

Migrasi schema dijalankan otomatis saat start. Backup sebelum update penting
kalau perubahan schema ternyata bermasalah.

---

## Perintah harian yang berguna

| Kebutuhan | Perintah |
|---|---|
| Lihat status | `docker compose ps` |
| Lihat log aplikasi | `docker compose logs -f app` |
| Restart aplikasi | `docker compose restart app` |
| Hentikan semua | `docker compose down` |
| Pemakaian disk | `df -h` lalu `docker system df` |
| Bersihkan image lama | `docker image prune -a` |
| Backup manual | `/opt/bardi/backup.sh` |

---

## Kalau ada masalah

| Gejala | Penyebab yang paling sering |
|---|---|
| Situs tidak bisa dibuka, sertifikat error | DNS belum mengarah ke IP VPS, atau port 80/443 tertutup |
| Login berhasil di server tapi gagal dari browser lain | `BETTER_AUTH_URL` bukan alamat publik (masih `localhost`) |
| Container `unhealthy` | Lihat `docker compose logs app` — biasanya database terkunci atau schema gagal |
| Data hilang setelah update | Database ditimpa; pulihkan dari `backups/` |
| Halaman lambat | Cek `docker stats` — kalau RAM penuh, lihat log untuk OOM |
