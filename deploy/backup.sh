#!/bin/sh
# ============================================================================
# Backup database BARDI Defect Report.
#
# PENTING: skrip ini menyimpan salinan di folder yang SAMA dengan VPS. Itu
# melindungi dari salah hapus data, TAPI TIDAK melindungi dari VPS hilang/rusak.
# Karena database hanya ~1,4 MB, biasakan menarik salinannya keluar server
# (object storage / komputer kantor) — misalnya dengan rsync ke mesin lain.
#
# Cara pakai di server:
#   1. chmod +x backup.sh
#   2. uji manual:  ./backup.sh
#   3. pasang cron harian jam 02:00:
#      crontab -e
#      0 2 * * * /opt/bardi/backup.sh >> /opt/bardi/backup.log 2>&1
# ============================================================================
set -eu

# Folder tempat skrip ini berada (default /opt/bardi)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$APP_DIR/data/sqlite.db"
DEST="$APP_DIR/backups"
KEEP_DAYS=30
STAMP="$(date +%F-%H%M)"

if [ ! -f "$DB" ]; then
  echo "[$(date '+%F %T')] GAGAL: database tidak ditemukan di $DB" >&2
  exit 1
fi

mkdir -p "$DEST"

# Salinan cepat berbasis berkas (konsisten untuk SQLite mode WAL karena
# disalin bersama -wal/-shm bila ada).
# Untuk salinan yang dijamin konsisten walau ada penulisan, jalankan VACUUM INTO
# lewat container (lihat baris komentar di bawah) — lebih lambat tapi paling aman.
cp "$DB" "$DEST/sqlite-$STAMP.db"
[ -f "$DB-wal" ] && cp "$DB-wal" "$DEST/sqlite-$STAMP.db-wal" || true
[ -f "$DB-shm" ] && cp "$DB-shm" "$DEST/sqlite-$STAMP.db-shm" || true

# Alternatif paling aman (butuh container hidup):
# docker exec bardi-app node -e "require('better-sqlite3')('/data/sqlite.db').exec(\"VACUUM INTO '/data/backups/sqlite-$STAMP.db'\")"

# Buang salinan lama
find "$DEST" -name 'sqlite-*.db*' -mtime +"$KEEP_DAYS" -delete

SIZE="$(du -h "$DEST/sqlite-$STAMP.db" | cut -f1)"
COUNT="$(find "$DEST" -name 'sqlite-*.db' | wc -l | tr -d ' ')"
echo "[$(date '+%F %T')] OK: $DEST/sqlite-$STAMP.db ($SIZE), total $COUNT berkas backup"
