import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  defects,
  factories,
  keterangan,
  problems,
  products,
  purchaseOrders,
  sales,
  statuses,
  user,
} from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { normalizeSku, normalizeCurrency, normalizeTimestamp } from "@/lib/api/validation";
import { createUserAccount } from "@/lib/api/users";
import {
  listDefectRows,
  listPurchaseOrderRows,
  listSaleRows,
} from "@/lib/api/records";
import { MONTHS } from "@/lib/format";
import type { ImportResult } from "@/lib/types";

type SheetRow = Record<string, unknown>;

const MAX_LOGGED_ISSUES = 200;

function newImportResult(module: string, totalRows: number): ImportResult {
  return {
    module,
    totalRows,
    inserted: 0,
    skipped: 0,
    errors: [],
    skippedDetails: [],
  };
}

function logImport(result: ImportResult) {
  console.log(
    `[import:${result.module}] total=${result.totalRows} inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors.length}`
  );
  for (const issue of result.errors.slice(0, MAX_LOGGED_ISSUES)) {
    console.log(
      `[import:${result.module}] ERROR baris ${issue.row}${
        issue.key ? ` (${issue.key})` : ""
      }: ${issue.reason}`
    );
  }
  if (result.errors.length > MAX_LOGGED_ISSUES) {
    console.log(
      `[import:${result.module}] ... ${result.errors.length - MAX_LOGGED_ISSUES} error lain tidak ditampilkan`
    );
  }
  for (const issue of result.skippedDetails.slice(0, MAX_LOGGED_ISSUES)) {
    console.log(
      `[import:${result.module}] SKIP baris ${issue.row}${
        issue.key ? ` (${issue.key})` : ""
      }: ${issue.reason}`
    );
  }
  if (result.skippedDetails.length > MAX_LOGGED_ISSUES) {
    console.log(
      `[import:${result.module}] ... ${
        result.skippedDetails.length - MAX_LOGGED_ISSUES
      } skip lain tidak ditampilkan`
    );
  }
}

/* ------------------------------ helpers ------------------------------ */

function sheetBuffer(
  rows: SheetRow[],
  headers: string[],
  sheetName = "Data"
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function downloadResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function cellString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate()
    )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  return String(value).trim();
}

function cellNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(cellString(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cellBool(value: unknown): boolean {
  const s = cellString(value).toLowerCase();
  return s === "true" || s === "ya" || s === "yes" || s === "1" || s === "admin";
}

function displayDateTime(value: string): string {
  return value.replace("T", " ");
}

async function readSheet(req: NextRequest): Promise<SheetRow[] | Response> {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("File Excel tidak ditemukan.", 422);
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return jsonError("Sheet kosong.", 422);
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
}

/* --------------------------- module registry --------------------------- */

const MASTER_MODULES = {
  products: { table: products, file: "produk", label: "Produk" },
  problems: { table: problems, file: "problem", label: "Problem" },
  statuses: { table: statuses, file: "status", label: "Status" },
  factories: { table: factories, file: "pabrik", label: "Pabrik" },
  keterangan: { table: keterangan, file: "keterangan", label: "Keterangan" },
} as const;

type MasterModule = keyof typeof MASTER_MODULES;

function isMasterModule(name: string): name is MasterModule {
  return name in MASTER_MODULES;
}

const DEFECT_HEADERS = [
  "Code Garansi",
  "Timestamp",
  "Link Foto",
  "Link Video",
  "Problem",
  "Problem Detail",
  "Produk",
  "Quantity",
  "Status",
  "Pabrik",
  "Value",
];

const SALES_HEADERS = ["Produk", "Pabrik", "Bulan", "Quantity", "Value"];

const USER_HEADERS = ["Username", "Password", "Pabrik", "Admin"];

/** Kolom PO; Price/pcs dan Total hanya ikut untuk admin. */
const PO_HEADERS = [
  "PO Number",
  "Timestamp",
  "Produk",
  "Pabrik",
  "Quantity",
  "Price/pcs",
  "Currency",
  "Total",
  "Keterangan",
];

const PO_MODULE = "purchase-orders";

/* ------------------------------- export ------------------------------- */

export async function excelExport(moduleName: string, req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { user: currentUser } = guard;

  if (moduleName === PO_MODULE) {
    const rows = await listPurchaseOrderRows(currentUser, req.nextUrl.searchParams);
    // Role Pabrik tidak menerima kolom harga sama sekali — bukan disembunyikan.
    const headers = currentUser.isAdmin
      ? PO_HEADERS
      : PO_HEADERS.filter(
          (h) => h !== "Price/pcs" && h !== "Total" && h !== "Currency"
        );
    const data = rows.map((row) => ({
      "PO Number": row.poNumber,
      Timestamp: displayDateTime(row.poDate),
      Produk: row.productName ?? "",
      Pabrik: row.factoryName ?? "",
      Quantity: row.quantity,
      ...(currentUser.isAdmin
        ? {
            "Price/pcs": row.pricePerPcs,
            Currency: row.currency,
            Total: row.value,
          }
        : {}),
      Keterangan: row.keteranganName ?? "",
    }));
    return downloadResponse(sheetBuffer(data, headers), "po-product.xlsx");
  }

  if (isMasterModule(moduleName)) {
    const { file } = MASTER_MODULES[moduleName];
    if (moduleName === "products") {
      // Produk mengekspor SKU juga, sejajar dengan template dan impornya.
      const rows = await db.select().from(products).orderBy(products.id);
      const data = rows.map((row) => ({ Nama: row.name, SKU: row.sku ?? "" }));
      return downloadResponse(sheetBuffer(data, ["Nama", "SKU"]), `${file}.xlsx`);
    }
    const { table } = MASTER_MODULES[moduleName];
    const rows = await db.select().from(table).orderBy(table.id);
    const data = rows.map((row) => ({ Nama: row.name }));
    return downloadResponse(sheetBuffer(data, ["Nama"]), `${file}.xlsx`);
  }

  if (moduleName === "defects") {
    const rows = await listDefectRows(currentUser, req.nextUrl.searchParams);
    const headers = currentUser.isAdmin
      ? DEFECT_HEADERS
      : DEFECT_HEADERS.filter((h) => h !== "Value");
    const data = rows.map((row) => ({
      "Code Garansi": row.codeGaransi,
      Timestamp: displayDateTime(row.timestamp),
      "Link Foto": row.photosLink,
      "Link Video": row.videosLink,
      Problem: row.problemName ?? "",
      "Problem Detail": row.problemDetail,
      Produk: row.productName ?? "",
      Quantity: row.quantity,
      Status: row.statusName ?? "",
      Pabrik: row.factoryName ?? "",
      ...(currentUser.isAdmin ? { Value: row.value } : {}),
    }));
    return downloadResponse(sheetBuffer(data, headers), "defect.xlsx");
  }

  if (moduleName === "sales") {
    const rows = await listSaleRows(currentUser, req.nextUrl.searchParams);
    const headers = currentUser.isAdmin
      ? SALES_HEADERS
      : SALES_HEADERS.filter((h) => h !== "Value");
    const data = rows.map((row) => ({
      Produk: row.productName ?? "",
      Pabrik: row.factoryName ?? "",
      Bulan: row.month,
      Quantity: row.quantity,
      ...(currentUser.isAdmin ? { Value: row.value } : {}),
    }));
    return downloadResponse(sheetBuffer(data, headers), "sales.xlsx");
  }

  if (moduleName === "users") {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const rows = await db
      .select({
        username: user.username,
        factoryName: factories.name,
        isAdmin: user.isAdmin,
      })
      .from(user)
      .leftJoin(factories, eq(user.factoryId, factories.id))
      .orderBy(user.createdAt);
    const data = rows.map((row) => ({
      Username: row.username ?? "",
      Pabrik: row.factoryName ?? "",
      Admin: row.isAdmin ? "true" : "false",
    }));
    return downloadResponse(
      sheetBuffer(data, ["Username", "Pabrik", "Admin"]),
      "users.xlsx"
    );
  }

  return jsonError("Modul tidak dikenal.", 404);
}

/* ------------------------------- import ------------------------------- */

export async function excelImport(moduleName: string, req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const sheet = await readSheet(req);
  if (sheet instanceof Response) return sheet;
  if (sheet.length === 0) return jsonError("Tidak ada data di file.", 422);

  if (isMasterModule(moduleName)) {
    return importMaster(moduleName, sheet);
  }
  if (moduleName === PO_MODULE) return importPurchaseOrders(sheet);
  if (moduleName === "defects") return importDefects(sheet);
  if (moduleName === "sales") return importSales(sheet);
  if (moduleName === "users") return importUsers(sheet);
  return jsonError("Modul tidak dikenal.", 404);
}

/**
 * Impor PO Product.
 *
 * Tidak ada deteksi duplikat: satu PO Number boleh diinput berkali-kali, termasuk
 * untuk produk yang sama (keputusan user). Baris hanya ditolak kalau datanya tidak
 * valid — PO Number atau tanggal kosong, produk/pabrik/keterangan tidak ditemukan,
 * atau quantity/harga bukan angka. Nama dipetakan ke id; keterangan opsional.
 */
async function importPurchaseOrders(sheet: SheetRow[]) {
  const [productRows, factoryRows, keteranganRows] = await Promise.all([
    db.select().from(products),
    db.select().from(factories),
    db.select().from(keterangan),
  ]);
  const byName = <T extends { name: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.name.toLowerCase(), row]));

  const productMap = byName(productRows);
  const factoryMap = byName(factoryRows);
  const keteranganMap = byName(keteranganRows);

  const result = newImportResult(PO_MODULE, sheet.length);
  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const poNumber = cellString(row["PO Number"]);
    const poDateRaw = cellString(row.Timestamp ?? row.Tanggal);
    const productName = cellString(row.Produk ?? row.Product);
    const factoryName = cellString(row.Pabrik ?? row.Factory);

    if (!poNumber) {
      result.errors.push({ row: rowNumber, key: "", reason: "PO Number kosong" });
      continue;
    }
    if (!productName) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: "Produk kosong",
      });
      continue;
    }
    const product = productMap.get(productName.toLowerCase());
    if (!product) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: `Produk "${productName}" tidak ditemukan`,
      });
      continue;
    }
    const factory = factoryMap.get(factoryName.toLowerCase());
    if (!factory) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: `Pabrik "${factoryName}" tidak ditemukan`,
      });
      continue;
    }

    // Keterangan opsional; kalau diisi tapi tidak ada di master, barisnya ditolak
    // supaya tidak diam-diam kehilangan keterangannya.
    const keteranganName = cellString(row.Keterangan);
    let keteranganId: number | null = null;
    if (keteranganName) {
      const found = keteranganMap.get(keteranganName.toLowerCase());
      if (!found) {
        result.errors.push({
          row: rowNumber,
          key: poNumber,
          reason: `Keterangan "${keteranganName}" tidak ada di master`,
        });
        continue;
      }
      keteranganId = found.id;
    }

    const quantity = cellNumber(row.Quantity);
    // Harga boleh pecahan (USD/RMB), jadi tidak dibulatkan seperti cellNumber.
    const priceRaw = cellString(row["Price/pcs"]);
    const pricePerPcs = priceRaw === "" ? 0 : Number(priceRaw.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(pricePerPcs)) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: "Price/pcs bukan angka",
      });
      continue;
    }

    try {
      await db.insert(purchaseOrders).values({
        poNumber,
        poDate: normalizeTimestamp(poDateRaw || "1970-01-01T00:00"),
        productId: product.id,
        factoryId: factory.id,
        quantity,
        pricePerPcs,
        currency: normalizeCurrency(cellString(row.Currency)),
        keteranganId,
        // Total selalu dihitung server, tidak pernah dari berkas.
        value: quantity * pricePerPcs,
      });
      result.inserted++;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: err instanceof Error ? err.message : "Gagal menyimpan",
      });
    }
  }
  logImport(result);
  return jsonOk(result);
}

async function importMaster(moduleName: MasterModule, sheet: SheetRow[]) {
  const { table } = MASTER_MODULES[moduleName];
  // Hanya produk yang punya SKU; master lain tetap nama saja.
  const isProducts = table === products;
  const existingRows = await db.select().from(table);
  const existing = new Set(existingRows.map((row) => row.name.toLowerCase()));
  const existingSkus = new Set(
    isProducts
      ? existingRows
          .map((row) => (row as { sku?: string | null }).sku?.toLowerCase())
          .filter((sku): sku is string => Boolean(sku))
      : []
  );

  const result = newImportResult(moduleName, sheet.length);
  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const name = cellString(sheet[i].Nama ?? sheet[i].Name);
    if (!name) {
      result.errors.push({ row: rowNumber, key: "", reason: "Nama kosong" });
      continue;
    }
    if (existing.has(name.toLowerCase())) {
      result.skipped++;
      result.skippedDetails.push({
        row: rowNumber,
        key: name,
        reason: "Nama sudah ada di database",
      });
      continue;
    }

    // SKU opsional, tapi kalau diisi tidak boleh bentrok — termasuk dengan baris
    // lain di berkas yang sama, karena UNIQUE di database baru gagal saat insert
    // dan pesannya tidak menyebut baris mana yang bertabrakan.
    const sku = isProducts
      ? normalizeSku(sheet[i].SKU ?? sheet[i].Sku ?? sheet[i].sku)
      : null;
    if (sku && existingSkus.has(sku.toLowerCase())) {
      result.skipped++;
      result.skippedDetails.push({
        row: rowNumber,
        key: sku,
        reason: "SKU sudah dipakai",
      });
      continue;
    }

    try {
      // Bercabang supaya TypeScript menyempitkan tipe: hanya produk punya `sku`.
      if (table === products) {
        await db.insert(products).values({ name, sku });
      } else {
        await db.insert(table).values({ name });
      }
      existing.add(name.toLowerCase());
      if (sku) existingSkus.add(sku.toLowerCase());
      result.inserted++;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: err instanceof Error ? err.message : "Gagal menyimpan",
      });
    }
  }
  logImport(result);
  return jsonOk(result);
}

async function importDefects(sheet: SheetRow[]) {
  const [productRows, problemRows, statusRows, factoryRows, defectRows] =
    await Promise.all([
      db.select().from(products),
      db.select().from(problems),
      db.select().from(statuses),
      db.select().from(factories),
      db.select({ codeGaransi: defects.codeGaransi }).from(defects),
    ]);

  const productMap = new Map(
    productRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const problemMap = new Map(
    problemRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const statusMap = new Map(
    statusRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const factoryMap = new Map(
    factoryRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const existing = new Set(defectRows.map((row) => row.codeGaransi));

  const result = newImportResult("defects", sheet.length);
  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const code = cellString(row["Code Garansi"]);
    if (!code) {
      result.errors.push({
        row: rowNumber,
        key: "",
        reason: "Code Garansi kosong",
      });
      continue;
    }
    if (existing.has(code)) {
      result.skipped++;
      result.skippedDetails.push({
        row: rowNumber,
        key: code,
        reason: "Code Garansi sudah ada di database",
      });
      continue;
    }

    const productName = cellString(row.Produk);
    const rawProblemName = cellString(row.Problem);
    const statusName = cellString(row.Status);
    const factoryName = cellString(row.Pabrik);

    const productId = productMap.get(productName.toLowerCase());

    // Problem kosong tetap bisa diimport → dipetakan ke problem "Kosong"
    let problemId: number | undefined;
    if (rawProblemName) {
      problemId = problemMap.get(rawProblemName.toLowerCase());
    } else {
      problemId = problemMap.get("kosong");
      if (!problemId) {
        const [created] = await db
          .insert(problems)
          .values({ name: "Kosong" })
          .returning();
        problemId = created.id;
        problemMap.set("kosong", created.id);
      }
    }

    const statusId = statusMap.get(statusName.toLowerCase());
    const factoryId = factoryMap.get(factoryName.toLowerCase());

    const missing: string[] = [];
    if (!productId) missing.push(`Produk "${productName || "(kosong)"}"`);
    if (!problemId) missing.push(`Problem "${rawProblemName}"`);
    if (!statusId) missing.push(`Status "${statusName || "(kosong)"}"`);
    if (!factoryId) missing.push(`Pabrik "${factoryName || "(kosong)"}"`);
    if (missing.length > 0) {
      result.errors.push({
        row: rowNumber,
        key: code,
        reason: `${missing.join(", ")} tidak ada di Data Master`,
      });
      continue;
    }

    const rawTimestamp = cellString(row.Timestamp);
    if (!rawTimestamp) {
      result.errors.push({
        row: rowNumber,
        key: code,
        reason: "Timestamp kosong",
      });
      continue;
    }

    try {
      await db.insert(defects).values({
        codeGaransi: code,
        timeStamp: normalizeTimestamp(rawTimestamp),
        photosLink: cellString(row["Link Foto"]),
        videosLink: cellString(row["Link Video"]),
        problemId: problemId as number,
        problemDetail: cellString(row["Problem Detail"]),
        productId: productId as number,
        quantity: cellNumber(row.Quantity),
        statusId: statusId as number,
        factoryId: factoryId as number,
        value: cellNumber(row.Value),
      });
      existing.add(code);
      result.inserted++;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: code,
        reason: err instanceof Error ? err.message : "Gagal menyimpan",
      });
    }
  }
  logImport(result);
  return jsonOk(result);
}

async function importSales(sheet: SheetRow[]) {
  const [productRows, factoryRows, saleRows] = await Promise.all([
    db.select().from(products),
    db.select().from(factories),
    db.select().from(sales),
  ]);

  const productMap = new Map(
    productRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const factoryMap = new Map(
    factoryRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const existing = new Set(
    saleRows.map((row) => `${row.productId}|${row.factoryId}|${row.month}`)
  );

  const result = newImportResult("sales", sheet.length);
  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const productName = cellString(row.Produk);
    const factoryName = cellString(row.Pabrik);
    const month = cellString(row.Bulan);

    const productId = productMap.get(productName.toLowerCase());
    const factoryId = factoryMap.get(factoryName.toLowerCase());

    const missing: string[] = [];
    if (!productId) missing.push(`Produk "${productName || "(kosong)"}"`);
    if (!factoryId) missing.push(`Pabrik "${factoryName || "(kosong)"}"`);
    if (missing.length > 0) {
      result.errors.push({
        row: rowNumber,
        key: `${productName} / ${factoryName} / ${month}`,
        reason: `${missing.join(", ")} tidak ada di Data Master`,
      });
      continue;
    }
    if (!month) {
      result.errors.push({
        row: rowNumber,
        key: `${productName} / ${factoryName}`,
        reason: "Bulan kosong",
      });
      continue;
    }
    if (!(MONTHS as readonly string[]).includes(month)) {
      result.errors.push({
        row: rowNumber,
        key: `${productName} / ${factoryName} / ${month}`,
        reason: `Bulan tidak dikenal: "${month}" (harus salah satu dari ${MONTHS.join(", ")})`,
      });
      continue;
    }

    const key = `${productId}|${factoryId}|${month}`;
    if (existing.has(key)) {
      result.skipped++;
      result.skippedDetails.push({
        row: rowNumber,
        key: `${productName} / ${factoryName} / ${month}`,
        reason: "Kombinasi Produk + Pabrik + Bulan sudah ada di database",
      });
      continue;
    }

    try {
      await db.insert(sales).values({
        productId: productId as number,
        factoryId: factoryId as number,
        month,
        quantity: cellNumber(row.Quantity),
        value: cellNumber(row.Value),
      });
      existing.add(key);
      result.inserted++;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: `${productName} / ${factoryName} / ${month}`,
        reason: err instanceof Error ? err.message : "Gagal menyimpan",
      });
    }
  }
  logImport(result);
  return jsonOk(result);
}

async function importUsers(sheet: SheetRow[]) {
  const factoryRows = await db.select().from(factories);
  const factoryMap = new Map(
    factoryRows.map((row) => [row.name.toLowerCase(), row.id])
  );
  const userRows = await db
    .select({ username: user.username })
    .from(user);
  const existing = new Set(
    userRows.map((row) => (row.username ?? "").toLowerCase())
  );

  const result = newImportResult("users", sheet.length);
  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const username = cellString(row.Username);
    const password = cellString(row.Password);
    const isAdmin = cellBool(row.Admin);
    if (!username) {
      result.errors.push({
        row: rowNumber,
        key: "",
        reason: "Username kosong",
      });
      continue;
    }
    if (password.length < 6) {
      result.errors.push({
        row: rowNumber,
        key: username,
        reason: "Password kurang dari 6 karakter",
      });
      continue;
    }
    if (existing.has(username.toLowerCase())) {
      result.skipped++;
      result.skippedDetails.push({
        row: rowNumber,
        key: username,
        reason: "Username sudah ada di database",
      });
      continue;
    }

    let factoryId: number | null = null;
    if (!isAdmin) {
      const factoryName = cellString(row.Pabrik);
      if (!factoryName) {
        result.errors.push({
          row: rowNumber,
          key: username,
          reason: "Pabrik kosong untuk user non-admin",
        });
        continue;
      }
      const known = factoryMap.get(factoryName.toLowerCase());
      if (known) {
        factoryId = known;
      } else {
        const [created] = await db
          .insert(factories)
          .values({ name: factoryName })
          .returning();
        factoryId = created.id;
        factoryMap.set(factoryName.toLowerCase(), created.id);
      }
    }

    try {
      await createUserAccount({ username, password, isAdmin, factoryId });
      existing.add(username.toLowerCase());
      result.inserted++;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: username,
        reason: err instanceof Error ? err.message : "Gagal membuat user",
      });
    }
  }
  logImport(result);
  return jsonOk(result);
}

/* ------------------------------ template ------------------------------ */

export async function excelTemplate(moduleName: string) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  // Dicek SEBELUM isMasterModule: "purchase-orders" bukan master, dan urutan
  // yang terbalik membuat modul ini jatuh ke "Modul tidak dikenal".
  if (moduleName === PO_MODULE) {
    const example: SheetRow = {
      "PO Number": "PO-2026-001",
      Timestamp: "2026-05-10 09:30",
      Produk: "LED Bulb 12W RGBWW",
      Pabrik: "PABRIK CONTOH",
      Quantity: 120,
      "Price/pcs": 18500,
      Currency: "Rp",
      Total: 2220000,
      Keterangan: "Pengiriman batch pertama",
    };
    return downloadResponse(
      sheetBuffer([example], PO_HEADERS, "Template"),
      "template-po-product.xlsx"
    );
  }

  if (isMasterModule(moduleName)) {
    const { file } = MASTER_MODULES[moduleName];
    // Template produk ikut memuat kolom SKU supaya pengisian massal cocok
    // dengan kolom yang dibaca `importMaster`.
    const headers = moduleName === "products" ? ["Nama", "SKU"] : ["Nama"];
    const example: SheetRow =
      moduleName === "products"
        ? { Nama: "", SKU: "" }
        : { Nama: "" };
    return downloadResponse(
      sheetBuffer([example], headers),
      `template-${file}.xlsx`
    );
  }
  if (moduleName === "defects") {
    const example: SheetRow = {
      "Code Garansi": "WJKT-0001",
      Timestamp: "2026-04-07 11:10",
      "Link Foto": "https://…",
      "Link Video": "https://…",
      Problem: "Cacat Cat",
      "Problem Detail": "Cat terkelupas di bagian depan",
      Produk: "Kulkas 2 Pintu",
      Quantity: 3,
      Status: "Open",
      Pabrik: "Pabrik Jakarta",
      Value: 4500000,
    };
    return downloadResponse(
      sheetBuffer([example], DEFECT_HEADERS, "Template"),
      "template-defect.xlsx"
    );
  }
  if (moduleName === "sales") {
    const example: SheetRow = {
      Produk: "Kulkas 2 Pintu",
      Pabrik: "Pabrik Jakarta",
      Bulan: "Jan",
      Quantity: 120,
      Value: 240000000,
    };
    return downloadResponse(
      sheetBuffer([example], SALES_HEADERS, "Template"),
      "template-sales.xlsx"
    );
  }
  if (moduleName === "users") {
    const example: SheetRow = {
      Username: "pabrik_jkt",
      Password: "rahasia123",
      Pabrik: "Pabrik Jakarta",
      Admin: "false",
    };
    return downloadResponse(
      sheetBuffer([example], USER_HEADERS, "Template"),
      "template-users.xlsx"
    );
  }
  return jsonError("Modul tidak dikenal.", 404);
}
