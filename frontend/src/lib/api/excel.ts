import * as XLSX from "xlsx";
import { asc, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  defects,
  factories,
  problems,
  productPrices,
  products,
  purchaseOrders,
  sales,
  sparePartPrices,
  spareParts,
  statuses,
  user,
} from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  KETERANGAN_OPTIONS,
  DEFAULT_KETERANGAN,
  PRICE_TYPES,
  DEFAULT_PRICE_TYPE,
  normalizeSku,
  normalizeCurrency,
  normalizeKeterangan,
  normalizePpn,
  normalizePriceMonth,
  normalizePriceType,
  normalizePriceYear,
  normalizeTimestamp,
} from "@/lib/api/validation";
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

/**
 * Harga Rupiah: "18.500" dan "Rp 18.500" sama-sama 18.500. Null kalau bukan
 * angka — beda dari cellNumber yang mengembalikan 0 untuk sel kosong.
 */
function cellPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const raw = cellString(value);
  if (raw === "") return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
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
  spareparts: { table: spareParts, file: "sparepart", label: "Sparepart" },
  problems: { table: problems, file: "problem", label: "Problem" },
  statuses: { table: statuses, file: "status", label: "Status" },
  factories: { table: factories, file: "pabrik", label: "Pabrik" },
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

/** Kolom PO; PPN, Price/pcs, Currency, dan Total hanya ikut untuk admin. */
const PO_HEADERS = [
  "PO Number",
  "Timestamp",
  "Produk",
  "Pabrik",
  "Quantity",
  "PPN",
  "Price/pcs",
  "Currency",
  "Total",
  "Keterangan",
];

const PO_MODULE = "purchase-orders";

/**
 * Modul harga. Bukan master nama: barisnya menunjuk produk/sparepart lewat NAMA
 * yang harus sudah ada di Data Master — nama tak dikenal jadi error dan barisnya
 * dilewati (tidak membuat master baru).
 */
const PRICE_MODULE = "prices";
const SPARE_PART_PRICE_MODULE = "sparepart-prices";

const PRICE_HEADERS = ["Produk", "Jenis Harga", "Bulan", "Tahun", "Harga"];

const SPARE_PART_PRICE_HEADERS = ["Sparepart", "Bulan", "Tahun", "Harga"];

/* ------------------------------- export ------------------------------- */

export async function excelExport(moduleName: string, req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { user: currentUser } = guard;

  if (moduleName === PO_MODULE) {
    const rows = await listPurchaseOrderRows(currentUser, req.nextUrl.searchParams);
    // Role Pabrik tidak menerima kolom harga maupun status PPN — bukan disembunyikan.
    const headers = currentUser.isAdmin
      ? PO_HEADERS
      : PO_HEADERS.filter(
          (h) =>
            h !== "Price/pcs" &&
            h !== "Total" &&
            h !== "Currency" &&
            h !== "PPN"
        );
    const data = rows.map((row) => ({
      "PO Number": row.poNumber,
      Timestamp: displayDateTime(row.poDate),
      Produk: row.productName ?? "",
      Pabrik: row.factoryName ?? "",
      Quantity: row.quantity,
      ...(currentUser.isAdmin
        ? {
            PPN: row.ppn,
            "Price/pcs": row.pricePerPcs,
            Currency: row.currency,
            Total: row.value,
          }
        : {}),
      Keterangan: row.keterangan,
    }));
    return downloadResponse(sheetBuffer(data, headers), "po-product.xlsx");
  }

  if (moduleName === PRICE_MODULE || moduleName === SPARE_PART_PRICE_MODULE) {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    if (moduleName === PRICE_MODULE) {
      const rows = await db
        .select({
          name: products.name,
          priceType: productPrices.priceType,
          month: productPrices.month,
          year: productPrices.year,
          price: productPrices.price,
        })
        .from(productPrices)
        .leftJoin(products, eq(productPrices.productId, products.id))
        .orderBy(
          asc(products.name),
          asc(productPrices.priceType),
          desc(productPrices.year),
          desc(productPrices.month)
        );
      const data = rows.map((row) => ({
        Produk: row.name ?? "",
        "Jenis Harga": row.priceType,
        Bulan: row.month,
        Tahun: row.year,
        Harga: row.price,
      }));
      return downloadResponse(sheetBuffer(data, PRICE_HEADERS), "harga-produk.xlsx");
    }

    const rows = await db
      .select({
        name: spareParts.name,
        month: sparePartPrices.month,
        year: sparePartPrices.year,
        price: sparePartPrices.price,
      })
      .from(sparePartPrices)
      .leftJoin(spareParts, eq(sparePartPrices.sparePartId, spareParts.id))
      .orderBy(asc(spareParts.name), desc(sparePartPrices.year), desc(sparePartPrices.month));
    const data = rows.map((row) => ({
      Sparepart: row.name ?? "",
      Bulan: row.month,
      Tahun: row.year,
      Harga: row.price,
    }));
    return downloadResponse(sheetBuffer(data, SPARE_PART_PRICE_HEADERS), "harga-sparepart.xlsx");
  }

  if (isMasterModule(moduleName)) {
    const { table, file } = MASTER_MODULES[moduleName];
    // Modul yang punya SKU (produk, sparepart) mengekspor kolomnya juga,
    // sejajar dengan template dan impornya.
    if (table === products || table === spareParts) {
      const rows = await db.select().from(table).orderBy(table.id);
      const data = rows.map((row) => ({ Nama: row.name, SKU: row.sku ?? "" }));
      return downloadResponse(sheetBuffer(data, ["Nama", "SKU"]), `${file}.xlsx`);
    }
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
  if (moduleName === PRICE_MODULE) return importProductPrices(sheet);
  if (moduleName === SPARE_PART_PRICE_MODULE) return importSparePartPrices(sheet);
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
 * valid — PO Number atau tanggal kosong, produk/pabrik tidak ditemukan, keterangan
 * di luar tiga pilihan tetap, atau quantity/harga bukan angka.
 */
async function importPurchaseOrders(sheet: SheetRow[]) {
  const [productRows, factoryRows] = await Promise.all([
    db.select().from(products),
    db.select().from(factories),
  ]);
  const byName = <T extends { name: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.name.toLowerCase(), row]));

  const productMap = byName(productRows);
  const factoryMap = byName(factoryRows);

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

    // Keterangan opsional, tapi kalau diisi harus salah satu dari tiga pilihan
    // tetap — nilai asing ditolak supaya tidak diam-diam berubah jadi default.
    const keteranganRaw = cellString(row.Keterangan);
    const keterangan = normalizeKeterangan(keteranganRaw);
    if (keteranganRaw !== "" && keterangan === null) {
      result.errors.push({
        row: rowNumber,
        key: poNumber,
        reason: `Keterangan "${keteranganRaw}" tidak dikenal (pilihan: ${KETERANGAN_OPTIONS.join(", ")})`,
      });
      continue;
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
        // Status PPN hanya penanda; tidak menambah nilai total.
        ppn: normalizePpn(cellString(row.PPN)),
        keterangan: keterangan ?? DEFAULT_KETERANGAN,
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
  // Produk dan sparepart sama-sama punya kolom SKU; master lain hanya nama.
  const hasSkuColumn = table === products || table === spareParts;
  const existingRows = await db.select().from(table);
  const existing = new Set(existingRows.map((row) => row.name.toLowerCase()));
  const existingSkus = new Set(
    hasSkuColumn
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
    const sku = hasSkuColumn
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
      // Bercabang supaya TypeScript menyempitkan tipe: hanya produk dan
      // sparepart punya `sku`.
      if (table === products) {
        await db.insert(products).values({ name, sku });
      } else if (table === spareParts) {
        await db.insert(spareParts).values({ name, sku });
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

/**
 * Impor Harga Produk. Nama produk dicocokkan ke Data Master (tanpa membedakan
 * huruf besar/kecil); nama yang tidak ada TIDAK dibuat otomatis — barisnya jadi
 * error dan dilewati. Baris dengan produk + jenis + periode yang sudah ada
 * dilewati sebagai duplikat (keunikan sama dengan endpoint /api/product-prices).
 */
async function importProductPrices(sheet: SheetRow[]) {
  const [productRows, priceRows] = await Promise.all([
    db.select().from(products),
    db
      .select({
        productId: productPrices.productId,
        priceType: productPrices.priceType,
        month: productPrices.month,
        year: productPrices.year,
      })
      .from(productPrices),
  ]);
  const productMap = new Map(productRows.map((row) => [row.name.trim().toLowerCase(), row.id]));
  const existing = new Set(
    priceRows.map((row) => `${row.productId}|${row.priceType}|${row.year}|${row.month}`)
  );
  const result = newImportResult(PRICE_MODULE, sheet.length);

  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const name = cellString(row.Produk ?? row.Product);
    const productId = productMap.get(name.toLowerCase());
    if (!productId) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: name
          ? `Produk "${name}" tidak ada di Data Master`
          : "Nama produk kosong",
      });
      continue;
    }

    const typeRaw = cellString(row["Jenis Harga"] ?? row.PriceType);
    const priceType = typeRaw === "" ? DEFAULT_PRICE_TYPE : normalizePriceType(typeRaw);
    if (!priceType) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: `Jenis harga "${typeRaw}" tidak dikenal (pilihan: ${PRICE_TYPES.join(", ")})`,
      });
      continue;
    }

    const month = normalizePriceMonth(row.Bulan ?? row.Month);
    const year = normalizePriceYear(row.Tahun ?? row.Year);
    if (!month || !year) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: !month
          ? "Bulan harus 01-12 atau nama bulan"
          : "Tahun harus empat angka, mis. 2026",
      });
      continue;
    }

    const price = cellPrice(row.Harga ?? row.Price);
    if (price === null) {
      result.errors.push({ row: rowNumber, key: name, reason: "Harga bukan angka" });
      continue;
    }

    const key = `${productId}|${priceType}|${year}|${month}`;
    if (existing.has(key)) {
      result.skipped += 1;
      result.skippedDetails.push({
        row: rowNumber,
        key: name,
        reason: `Harga ${priceType} produk ini untuk ${month}/${year} sudah ada`,
      });
      continue;
    }

    try {
      await db.insert(productPrices).values({ productId, price, priceType, month, year });
      existing.add(key);
      result.inserted += 1;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: err instanceof Error ? err.message : "Gagal menyimpan.",
      });
    }
  }

  logImport(result);
  return jsonOk(result);
}

/**
 * Impor Harga Sparepart. Aturannya sama dengan Harga Produk: nama sparepart harus
 * ada di Data Master, harga global per periode (tanpa jenis harga).
 */
async function importSparePartPrices(sheet: SheetRow[]) {
  const [sparePartRows, priceRows] = await Promise.all([
    db.select().from(spareParts),
    db
      .select({
        sparePartId: sparePartPrices.sparePartId,
        month: sparePartPrices.month,
        year: sparePartPrices.year,
      })
      .from(sparePartPrices),
  ]);
  const sparePartMap = new Map(
    sparePartRows.map((row) => [row.name.trim().toLowerCase(), row.id])
  );
  const existing = new Set(
    priceRows.map((row) => `${row.sparePartId}|${row.year}|${row.month}`)
  );
  const result = newImportResult(SPARE_PART_PRICE_MODULE, sheet.length);

  for (let i = 0; i < sheet.length; i++) {
    const rowNumber = i + 2;
    const row = sheet[i];
    const name = cellString(row.Sparepart ?? row.Nama ?? row.Name);
    const sparePartId = sparePartMap.get(name.toLowerCase());
    if (!sparePartId) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: name
          ? `Sparepart "${name}" tidak ada di Data Master`
          : "Nama sparepart kosong",
      });
      continue;
    }

    const month = normalizePriceMonth(row.Bulan ?? row.Month);
    const year = normalizePriceYear(row.Tahun ?? row.Year);
    if (!month || !year) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: !month
          ? "Bulan harus 01-12 atau nama bulan"
          : "Tahun harus empat angka, mis. 2026",
      });
      continue;
    }

    const price = cellPrice(row.Harga ?? row.Price);
    if (price === null) {
      result.errors.push({ row: rowNumber, key: name, reason: "Harga bukan angka" });
      continue;
    }

    const key = `${sparePartId}|${year}|${month}`;
    if (existing.has(key)) {
      result.skipped += 1;
      result.skippedDetails.push({
        row: rowNumber,
        key: name,
        reason: `Harga sparepart ini untuk ${month}/${year} sudah ada`,
      });
      continue;
    }

    try {
      await db.insert(sparePartPrices).values({ sparePartId, price, month, year });
      existing.add(key);
      result.inserted += 1;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        key: name,
        reason: err instanceof Error ? err.message : "Gagal menyimpan.",
      });
    }
  }

  logImport(result);
  return jsonOk(result);
}

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
      PPN: "PPN",
      "Price/pcs": 18500,
      Currency: "Rp",
      Total: 2220000,
      Keterangan: DEFAULT_KETERANGAN,
    };
    return downloadResponse(
      sheetBuffer([example], PO_HEADERS, "Template"),
      "template-po-product.xlsx"
    );
  }

  if (moduleName === PRICE_MODULE) {
    const example: SheetRow = {
      Produk: "LED Bulb 12W RGBWW",
      "Jenis Harga": DEFAULT_PRICE_TYPE,
      Bulan: "01",
      Tahun: "2026",
      Harga: 18500,
    };
    return downloadResponse(
      sheetBuffer([example], PRICE_HEADERS, "Template"),
      "template-harga-produk.xlsx"
    );
  }
  if (moduleName === SPARE_PART_PRICE_MODULE) {
    const example: SheetRow = {
      Sparepart: "Adaptor 12V",
      Bulan: "01",
      Tahun: "2026",
      Harga: 35000,
    };
    return downloadResponse(
      sheetBuffer([example], SPARE_PART_PRICE_HEADERS, "Template"),
      "template-harga-sparepart.xlsx"
    );
  }

  if (isMasterModule(moduleName)) {
    const { table, file } = MASTER_MODULES[moduleName];
    // Template modul ber-SKU (produk, sparepart) ikut memuat kolom SKU supaya
    // pengisian massal cocok dengan kolom yang dibaca `importMaster`.
    const hasSku = table === products || table === spareParts;
    const headers = hasSku ? ["Nama", "SKU"] : ["Nama"];
    const example: SheetRow = hasSku ? { Nama: "", SKU: "" } : { Nama: "" };
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
