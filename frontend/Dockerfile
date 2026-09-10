# ---------- Build stage ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build tools (fallback jika prebuild better-sqlite3 tidak tersedia)
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

# ---------- Runtime stage ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DB_FILE_NAME=/data/sqlite.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app ./

RUN mkdir -p /data

EXPOSE 3000

# Sinkronkan schema + seed (idempotent) lalu jalankan server produksi
CMD ["sh", "-c", "npx drizzle-kit push --force && npm run db:seed && npm start"]
