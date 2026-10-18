import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Uji dari HP di jaringan lokal: dev server memblokir aset lintas-origin
  // kecuali host-nya didaftarkan di sini (hanya berlaku saat `next dev`).
  allowedDevOrigins: ["192.168.100.16"],
};

export default nextConfig;
