import { eq, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import {
  buildChartBuckets,
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
import { defects, factories, problems, products, sales, statuses } from "@/lib/db/schema";
import {
  requireUser,
  scopedFactoryId,
  type SessionUser,
} from "@/lib/api/guard";
import { jsonOk } from "@/lib/api/response";
import type { PeriodType } from "@/lib/types";

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

export async function reportGET(req: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const params = req.nextUrl.searchParams;
  const factory = scopedFactoryId(user, numParam(params.get("factoryId")));
  const f: PeriodFilter = {
    period: (params.get("period") ?? "monthly") as PeriodType,
    month: params.get("month") ?? "all",
    day: params.get("day") ?? "",
    weekEnd: params.get("weekEnd") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };

  const defectWhere: SQL | undefined =
    factory !== null ? eq(defects.factoryId, factory) : undefined;
  const saleWhere: SQL | undefined =
    factory !== null ? eq(sales.factoryId, factory) : undefined;

  const [defectRows, saleRows, productRows, problemRows, statusRows, factoryRows] =
    await Promise.all([
      db.select().from(defects).where(defectWhere),
      db.select().from(sales).where(saleWhere),
      db.select().from(products),
      db.select().from(problems),
      db.select().from(statuses),
      db.select().from(factories),
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

  const productList = productRows.map((p) => ({ id: p.id, name: p.name }));
  let recap = summarizeByProduct(filteredDefects, filteredSales, productList);

  // Role Pabrik hanya melihat produk yang punya data (defect/sales) di pabriknya.
  // Admin melihat semua produk.
  if (!user.isAdmin) {
    recap = recap.filter((row) => row.defectQty > 0 || row.salesQty > 0);
  }

  const buckets = buildChartBuckets(filteredDefects, filteredSales, f);

  const totals = {
    defectQty: totalDefectQty(filteredDefects),
    defectValue: totalDefectValue(filteredDefects),
    salesQty: totalSalesQty(filteredSales),
    salesValue: totalSalesValue(filteredSales),
  };

  return jsonOk({
    period: f,
    defects: filteredDefects.map((row) => stripValue(row, user)),
    sales: filteredSales.map((row) => stripValue(row, user)),
    recap: recap.map((row) => stripRecapValues(row, user)),
    buckets: buckets.map((row) => stripRecapValues(row, user)),
    totals: user.isAdmin
      ? totals
      : { defectQty: totals.defectQty, salesQty: totals.salesQty },
    products: productRows.map((row) => ({ id: row.id, name: row.name })),
    problems: problemRows.map((row) => ({ id: row.id, name: row.name })),
    statuses: statusRows.map((row) => ({ id: row.id, name: row.name })),
    factories: factoryRows.map((row) => ({ id: row.id, name: row.name })),
  });
}
