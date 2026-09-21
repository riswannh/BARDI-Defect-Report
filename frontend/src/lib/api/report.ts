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
import {
  matchesDefectPeriod,
  matchesSalePeriod,
  type PeriodFilter,
} from "@/lib/period";
import { db } from "@/lib/db";
import {
  defects,
  factories,
  problems,
  productPrices,
  products,
  purchaseOrders,
  sales,
  statuses,
} from "@/lib/db/schema";
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

  const defectWhere: SQL | undefined =
    factory !== null ? eq(defects.factoryId, factory) : undefined;
  const saleWhere: SQL | undefined =
    factory !== null ? eq(sales.factoryId, factory) : undefined;

  const [defectRows, saleRows, productRows, problemRows, statusRows, factoryRows, poRows] =
    await Promise.all([
      db.select().from(defects).where(defectWhere),
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

  const filteredDefects = appDefects.filter((d) =>
    matchesDefectPeriod(d.timestamp, f)
  );
  const filteredSales = appSales.filter((s) => matchesSalePeriod(s.month, f));

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
  let recap = summarizeByProduct(filteredDefects, filteredSales, productList);

  // Role Pabrik hanya melihat produk yang punya data (defect/sales) di pabriknya.
  // Admin melihat semua produk.
  if (!user.isAdmin) {
    recap = recap.filter((row) => row.defectQty > 0 || row.salesQty > 0);
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
  /** Value RW = quantity × harga master (Rupiah); lihat catatan di bawah. */
  const replacementRwValue = filteredPurchaseOrders.reduce(
    (sum, row) => sum + row.quantity * (row.productPrice ?? 0),
    0
  );
  /** Total PO biasa (pricePerPcs × quantity) — tetap dikirim untuk kolom lain. */
  const replacementValue = filteredPurchaseOrders.reduce(
    (sum, row) => sum + row.value,
    0
  );

  const totals = {
    // Angka mentah: dipakai grafik dan tabel rekap, jangan diubah.
    defectQty,
    defectValue,
    salesQty: totalSalesQty(filteredSales),
    salesValue: totalSalesValue(filteredSales),
    replacementQty,
    replacementValue,
    replacementRwValue,
    /**
     * Angka BERSIH untuk kartu ringkasan: defect dikurangi Replacement.
     *
     * Pengurangnya sengaja Value RW (Quantity × harga master, Rupiah) supaya
     * sebanding dengan `defectValue` yang juga Rupiah — bukan `value` PO yang
     * mata uangnya bisa USD/RMB. Dibuat terpisah dari angka mentah di atas agar
     * grafik dan tabel rekap tetap menampilkan defect apa adanya.
     *
     * Dibatas bawah 0: Replacement yang melebihi defect tidak boleh menghasilkan
     * angka negatif di kartu.
     */
    netDefectQty: Math.max(0, defectQty - replacementQty),
    netDefectValue: Math.max(0, defectValue - replacementRwValue),
  };

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
          // Angka kuantitas tetap dikirim ke role Pabrik — nilainya sudah
          // diturunkan dari defectQty/replacementQty yang memang mereka terima,
          // jadi tidak ada tambahan yang bocor.
          //
          // `netDefectQty` WAJIB ada di sini: kartu "Total Defect" memakainya
          // sebagai angka utama. Sebelumnya field ini hanya dikirim ke admin,
          // sehingga di akun Pabrik kartunya jatuh ke `?? 0` dan selalu
          // menampilkan 0 walaupun keterangannya menyebut angka yang benar.
          defectQty: totals.defectQty,
          salesQty: totals.salesQty,
          replacementQty: totals.replacementQty,
          netDefectQty: totals.netDefectQty,
          // `defectValue`, `salesValue`, `replacementValue`, dan
          // `replacementRwValue` tetap disembunyikan: itu angka Rupiah.
        },
    years,
    products: productRows.map((row) => ({ id: row.id, name: row.name })),
    problems: problemRows.map((row) => ({ id: row.id, name: row.name })),
    statuses: statusRows.map((row) => ({ id: row.id, name: row.name })),
    factories: factoryRows.map((row) => ({ id: row.id, name: row.name })),
  });
}
