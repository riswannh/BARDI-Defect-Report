import { eq, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import {
  buildChartBuckets,
  buildYearlyBuckets,
  summarizeByProduct,
  totalDefectQty,
  totalDefectValue,
  totalSalesQty,
  totalSalesValue,
} from "@/lib/analytics";
import { allowanceYearFor, findAllowance } from "@/lib/allowance";
import {
  matchesDefectPeriod,
  matchesSalePeriod,
  type PeriodFilter,
} from "@/lib/period";
import { db } from "@/lib/db";
import {
  defectAllowances,
  defects,
  factories,
  problems,
  productFactories,
  productPrices,
  products,
  purchaseOrders,
  repairs,
  sales,
  statuses,
  warrantyClaims,
} from "@/lib/db/schema";
import { countsForRepairValue } from "@/lib/repair-value";
import { countsForClaimSummary, summarizeClaims } from "@/lib/claim-summary";
import {
  requireUser,
  scopedFactoryId,
  type SessionUser,
} from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import type { PeriodType } from "@/lib/types";

/** Keterangan PO yang dihitung khusus di halaman Report. */
const REPORT_PO_KETERANGAN = "Replacement";

function numParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function stripValue<T extends { value?: number }>(
  row: T,
  user: SessionUser
): T | Omit<T, "value"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.value;
  return copy as Omit<T, "value">;
}

function stripRecapValues<T extends { defectValue?: number; salesValue?: number }>(
  row: T,
  user: SessionUser
): T | Omit<T, "defectValue" | "salesValue"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.defectValue;
  delete copy.salesValue;
  return copy as Omit<T, "defectValue" | "salesValue">;
}

/** Sama seperti PO: role Pabrik tidak menerima angka harga sama sekali. */
function stripPoMoney<
  T extends { value?: number; pricePerPcs?: number; currency?: string },
>(row: T, user: SessionUser): T | Omit<T, "value" | "pricePerPcs" | "currency"> {
  if (user.isAdmin) return row;
  const copy: Record<string, unknown> = { ...row };
  delete copy.value;
  delete copy.pricePerPcs;
  delete copy.currency;
  return copy as Omit<T, "value" | "pricePerPcs" | "currency">;
}

export async function reportGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const params = req.nextUrl.searchParams;
  const factory = scopedFactoryId(user, numParam(params.get("factoryId")));
  const f: PeriodFilter = {
    period: (params.get("period") ?? "monthly") as PeriodType,
    month: params.get("month") ?? "all",
    year: params.get("year") ?? "",
    day: params.get("day") ?? "",
    weekEnd: params.get("weekEnd") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };

  // Defect sengaja TIDAK difilter pabrik di SQL: kartu Allowance Defect harus
  // memakai nilai defect seluruh pabrik (permintaan user 18 Okt 2026), jadi
  // penyaringan pabrik dilakukan setelah periode dihitung.
  const saleWhere: SQL | undefined =
    factory !== null ? eq(sales.factoryId, factory) : undefined;

  const [defectRows, saleRows, productRows, problemRows, statusRows, factoryRows, poRows, allowanceRows, repairRows, claimRows, productFactoryRows] =
    await Promise.all([
      db.select().from(defects),
      db.select().from(sales).where(saleWhere),
      db.select().from(products),
      db.select().from(problems),
      db.select().from(statuses),
      db.select().from(factories),
      // Harga master ikut di-join supaya Value RW (quantity × harga) bisa
      // dihitung di sini tanpa query tambahan.
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          poDate: purchaseOrders.poDate,
          productId: purchaseOrders.productId,
          factoryId: purchaseOrders.factoryId,
          quantity: purchaseOrders.quantity,
          pricePerPcs: purchaseOrders.pricePerPcs,
          value: purchaseOrders.value,
          currency: purchaseOrders.currency,
          keterangan: purchaseOrders.keterangan,
          productPrice: productPrices.price,
        })
        .from(purchaseOrders)
        .leftJoin(
          productPrices,
          eq(purchaseOrders.productPriceId, productPrices.id)
        )
        .where(
          factory !== null
            ? eq(purchaseOrders.factoryId, factory)
            : undefined
        ),
      db
        .select({
          year: defectAllowances.year,
          limitValue: defectAllowances.limitValue,
        })
        .from(defectAllowances),
      // Kartu "Repair Value": butuh tanggal, status, Penyelesaian, dan Saving
      // Value dari Repair Data (permintaan user 12–13 Okt 2026).
      db
        .select({
          date: repairs.date,
          status: repairs.status,
          resolution: repairs.resolution,
          value: repairs.value,
          productId: repairs.productId,
        })
        .from(repairs),
      // Kartu "Claim Garansi BARDI": quantity + value baris claim garansi
      // (permintaan user 18 Okt 2026).
      db
        .select({
          date: warrantyClaims.date,
          status: warrantyClaims.status,
          quantity: warrantyClaims.quantity,
          value: warrantyClaims.value,
          productId: warrantyClaims.productId,
        })
        .from(warrantyClaims),
      // Pemetaan produk → pabrik. Baris Repair tidak menyimpan pabrik, jadi
      // filter pabrik di kartu "Repair by Hub" memakai daftar produk pabrik itu
      // (kaitan yang diisi lewat Data Master produk / Factory List).
      db
        .select({ productId: productFactories.productId })
        .from(productFactories)
        .where(
          factory !== null ? eq(productFactories.factoryId, factory) : undefined
        ),
    ]);

  const appDefects = defectRows.map((row) => ({
    id: row.id,
    codeGaransi: row.codeGaransi,
    timestamp: row.timeStamp,
    photosLink: row.photosLink,
    videosLink: row.videosLink,
    problemId: row.problemId,
    problemDetail: row.problemDetail,
    productId: row.productId,
    quantity: row.quantity,
    statusId: row.statusId,
    factoryId: row.factoryId,
    value: row.value,
  }));

  const appSales = saleRows.map((row) => ({
    id: row.id,
    productId: row.productId,
    factoryId: row.factoryId,
    month: row.month,
    quantity: row.quantity,
    value: row.value,
  }));

  // Semua defect pada periode filter (semua pabrik) — dasar kartu Allowance.
  const periodDefects = appDefects.filter((d) =>
    matchesDefectPeriod(d.timestamp, f)
  );
  // Filter pabrik hanya untuk kartu/tabel defect, bukan Allowance Defect.
  const filteredDefects =
    factory === null
      ? periodDefects
      : periodDefects.filter((d) => d.factoryId === factory);
  const filteredSales = appSales.filter((s) => matchesSalePeriod(s.month, f));

  /**
   * Baris Repair berstatus "Done Kirim" / "Done Repair" DAN Penyelesaian apa pun
   * kecuali "Replacement Produk Baru", pada periode filter — dasar kartu
   * "Repair Value" (Saving Value, Rupiah; admin saja).
   *
   * `repairs.date` berformat `YYYY-MM-DD`, sama seperti 10 huruf pertama
   * timestamp defect, jadi pencocokan periode memakai `matchesDefectPeriod`.
   */
  /**
   * Produk milik pabrik terpilih — `null` kalau tidak ada filter pabrik (admin
   * dengan "Semua Pabrik"). Baris Repair tidak punya kolom pabrik, jadi kartu
   * "Repair by Hub" ikut filter lewat kaitan produk → pabrik ini.
   */
  const factoryProductIds =
    factory !== null
      ? new Set(productFactoryRows.map((row) => row.productId))
      : null;

  const filteredRepairs = repairRows.filter(
    (row) =>
      countsForRepairValue(row.status, row.resolution) &&
      matchesDefectPeriod(row.date, f) &&
      (factoryProductIds === null ||
        (row.productId !== null && factoryProductIds.has(row.productId)))
  );

  /**
   * Kartu "Claim Garansi BARDI" — hanya baris yang statusnya bukan
   * "Belum Ada Data" dan bukan "CLOSED" (permintaan user 18 Okt 2026).
   * `warranty_claims.date` berformat `YYYY-MM-DD`, jadi memakai
   * `matchesDefectPeriod` seperti baris repair.
   */
  const claimSummary = summarizeClaims(
    claimRows.filter(
      (row) =>
        countsForClaimSummary(row.status) &&
        matchesDefectPeriod(row.date, f) &&
        (factoryProductIds === null ||
          (row.productId !== null && factoryProductIds.has(row.productId)))
    )
  );

  /**
   * PO dengan keterangan "Replacement", mengikuti filter periode halaman Report.
   *
   * `poDate` berformat sama dengan timestamp defect (`YYYY-MM-DDTHH:mm`), jadi
   * pencocokan periode bisa memakai `matchesDefectPeriod` tanpa duplikasi logika.
   */
  const appPurchaseOrders = poRows
    .filter((row) => row.keterangan === REPORT_PO_KETERANGAN)
    .map((row) => ({
      id: row.id,
      poNumber: row.poNumber,
      poDate: row.poDate,
      productId: row.productId,
      factoryId: row.factoryId,
      quantity: row.quantity,
      pricePerPcs: row.pricePerPcs,
      value: row.value,
      currency: row.currency,      /**
       * Harga master (Rupiah) untuk menghitung Value RW = quantity × harga.
       * Null bila produk itu belum punya harga di periode PO-nya — kontribusinya
       * dihitung 0, sama seperti kolom Value RW yang tampil "-" di halaman PO.
       */
      productPrice: row.productPrice,
    }));
  const filteredPurchaseOrders = appPurchaseOrders.filter((row) =>
    matchesDefectPeriod(row.poDate, f)
  );

  const productList = productRows.map((p) => ({ id: p.id, name: p.name }));
  const productNameById = new Map(productList.map((p) => [p.id, p.name]));
  const factoryNameById = new Map(factoryRows.map((f2) => [f2.id, f2.name]));
  let recap = summarizeByProduct(
    filteredDefects,
    filteredSales,
    productList,
    filteredPurchaseOrders.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
      rwValue: row.quantity * (row.productPrice ?? 0),
    }))
  );

  // Role Pabrik hanya melihat produk yang punya data (defect/sales) di pabriknya.
  if (!user.isAdmin) {
    recap = recap.filter((row) => row.defectQty > 0 || row.salesQty > 0);
  }
  // Admin yang memfilter satu pabrik: tabel rekap hanya memuat produk pabrik itu
  // (bukan semua produk dengan angka 0). "Semua Pabrik" tetap semua produk.
  if (user.isAdmin && factoryProductIds !== null) {
    recap = recap.filter((row) => factoryProductIds.has(row.productId));
  }

  const buckets = buildChartBuckets(filteredDefects, filteredSales, f);

  // Sales selalu ditampilkan tahunan (12 bulan) sesuai tahun terpilih
  const salesYearly = buildYearlyBuckets([], appSales, f.year);
  const salesYearlyRecap = summarizeByProduct([], appSales, productList).filter(
    (row) => row.salesQty > 0 || row.salesValue > 0
  );

  const defectQty = totalDefectQty(filteredDefects);
  const defectValue = totalDefectValue(filteredDefects);
  const replacementQty = filteredPurchaseOrders.reduce(
    (sum, row) => sum + row.quantity,
    0
  );
  /**
   * Value RW = Σ (quantity × harga master produk) — Rupiah, sebanding dengan
   * `defectValue`, dipakai kartu "Selisih Defect Value" di halaman Report.
   * Bukan `value` PO yang mata uangnya bisa USD/RMB.
   */
  const replacementRwValue = filteredPurchaseOrders.reduce(
    (sum, row) => sum + row.quantity * (row.productPrice ?? 0),
    0
  );
  /** Total PO Replacement (pricePerPcs × quantity). */
  const replacementValue = filteredPurchaseOrders.reduce(
    (sum, row) => sum + row.value,
    0
  );

  const totals = {
    // Angka mentah: dipakai kartu ringkasan, grafik, dan tabel rekap.
    defectQty,
    defectValue,
    // Nilai defect seluruh pabrik pada periode yang sama — dasar kartu
    // Allowance Defect, yang TIDAK ikut filter pabrik.
    allowanceDefectValue: totalDefectValue(periodDefects),
    salesQty: totalSalesQty(filteredSales),
    salesValue: totalSalesValue(filteredSales),
    replacementQty,
    replacementValue,
    replacementRwValue,
    // Kartu "Repair Value": Σ Saving Value Repair Data berstatus selesai pada
    // periode filter, plus jumlah barisnya untuk keterangan kartu.
    repairValue: filteredRepairs.reduce((sum, row) => sum + row.value, 0),
    repairQty: filteredRepairs.length,
    // Kartu "Claim Garansi BARDI" (tanpa status Belum Ada Data / CLOSED).
    claimQty: claimSummary.qty,
    claimValue: claimSummary.value,
    claimRows: claimSummary.rows,
  };

  // Limit allowance defect (Rupiah per tahun, master) diprorata ke periode
  // filter — lihat `src/lib/allowance.ts`. Dihitung untuk admin saja.
  const allowanceYear = allowanceYearFor(allowanceRows, f);
  const allowance = findAllowance(allowanceRows, f);

  const years = Array.from(
    new Set(
      defectRows
        .map((row) => Number(row.timeStamp.slice(0, 4)))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ).sort((a, b) => b - a);

  return jsonOk({
    period: f,
    defects: filteredDefects.map((row) => stripValue(row, user)),
    sales: filteredSales.map((row) => stripValue(row, user)),
    replacementPos: filteredPurchaseOrders.map((row) =>
      stripPoMoney(
        {
          ...row,
          productName: productNameById.get(row.productId) ?? "",
          factoryName: factoryNameById.get(row.factoryId) ?? "",
        },
        user
      )
    ),
    recap: recap.map((row) => stripRecapValues(row, user)),
    buckets: buckets.map((row) => stripRecapValues(row, user)),
    salesYearly: salesYearly.map((row) => stripRecapValues(row, user)),
    salesYearlyRecap: salesYearlyRecap.map((row) =>
      stripRecapValues(row, user)
    ),
    totals: user.isAdmin
      ? totals
      : {
          // Angka kuantitas tetap dikirim ke role Pabrik; angka Rupiah
          // (defectValue, salesValue, replacementValue, repairValue) tetap
          // disembunyikan.
          defectQty: totals.defectQty,
          salesQty: totals.salesQty,
          replacementQty: totals.replacementQty,
          // Kartu "Repair by Hub" ikut tampil untuk Pabrik, quantity saja.
          repairQty: totals.repairQty,
        },
    // Role Pabrik tidak boleh menerima angka Rupiah, jadi allowance = null.
    allowance: user.isAdmin ? allowance : null,
    // Tahun limit yang dituju filter — tetap dikirim walau barisnya belum ada
    // supaya UI bisa menyebut tahun yang perlu diisi admin.
    allowanceYear: user.isAdmin ? allowanceYear : "",
    years,
    products: productRows.map((row) => ({ id: row.id, name: row.name })),
    problems: problemRows.map((row) => ({ id: row.id, name: row.name })),
    statuses: statusRows.map((row) => ({ id: row.id, name: row.name })),
    factories: factoryRows.map((row) => ({ id: row.id, name: row.name })),
  });
}
