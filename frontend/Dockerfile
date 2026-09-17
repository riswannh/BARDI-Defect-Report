# ---------- Build stage ----------
# Mengompilasi aplikasi. Tool build (python3/make/g++) hanya ada di tahap ini,
# karena better-sqlite3 butuh kompilasi native saat `npm ci`.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Env dummy untuk proses build (tidak dipakai saat runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DB_FILE_NAME=/tmp/build.db
ENV BETTER_AUTH_SECRET=build-time-placeholder-secret-min-32-chars
ENV BETTER_AUTH_URL=http://localhost:3000

RUN npm run build && rm -rf .next/cache

# ---------- Production dependencies stage ----------
# Hanya dependensi produksi. better-sqlite3 tetap dikompilasi di sini, dan
# hasilnya (.node) disalin ke runner — jadi tool build tidak perlu ikut.
FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Runtime stage ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DB_FILE_NAME=/data/sqlite.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Dependensi produksi saja (tanpa devDependencies dan tanpa tool build).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json

# Hasil build + berkas yang dibutuhkan saat runtime:
#  - `.next`        : hasil kompilasi Next.js
#  - `public`       : aset statis (logo)
#  - `src`          : dibaca drizzle-kit push untuk menyinkronkan schema
#  - `next.config.ts`, `tsconfig.json`, `drizzle.config.ts` : konfigurasi
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Migrasi satu kali (sudah dijalankan di database produksi; disertakan agar
# tetap tersedia bila sewaktu-waktu perlu dijalankan ulang di server).
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /data

EXPOSE 3000

# Sinkronkan schema + seed (idempotent) lalu jalankan server produksi
CMD ["sh", "-c", "npx drizzle-kit push --force && npm run db:seed && npm start"]
