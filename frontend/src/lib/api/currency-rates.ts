import { inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { currencyRates } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api/guard";
import { jsonError, jsonOk } from "@/lib/api/response";
import { currencyRatesSchema } from "@/lib/api/validation";
import type { CurrencyRates } from "@/lib/types";

/**
 * Kurs USD/RMB ke Rupiah untuk kartu "Total Value PO".
 *
 * Keduanya admin-only: nilai PO dalam Rupiah tidak boleh sampai ke role Pabrik
 * (aturan yang sama dengan `stripPoFinance`), dan hanya admin yang boleh
 * mengubah kurs.
 */
const DEFAULT_RATES: CurrencyRates = { usd: 0, rmb: 0 };

/** Baca kurs tersimpan; mata uang yang belum punya baris dianggap 0. */
export async function readCurrencyRates(): Promise<CurrencyRates> {
  const rows = await db
    .select({ currency: currencyRates.currency, rate: currencyRates.rate })
    .from(currencyRates)
    .where(inArray(currencyRates.currency, ["USD", "RMB"]));

  const rates: CurrencyRates = { ...DEFAULT_RATES };
  for (const row of rows) {
    if (row.currency === "USD") rates.usd = row.rate;
    if (row.currency === "RMB") rates.rmb = row.rate;
  }
  return rates;
}

export async function currencyRatesGET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return jsonOk(await readCurrencyRates());
}

export async function currencyRatesPATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = currencyRatesSchema.safeParse(
    await req.json().catch(() => ({}))
  );
  if (!parsed.success) return jsonError("Kurs tidak valid.", 422);

  await db.transaction((tx) => {
    for (const [currency, rate] of [
      ["USD", parsed.data.usd],
      ["RMB", parsed.data.rmb],
    ] as const) {
      tx.insert(currencyRates)
        .values({ currency, rate })
        .onConflictDoUpdate({
          target: currencyRates.currency,
          set: { rate, updatedAt: new Date() },
        })
        .run();
    }
  });

  return jsonOk(await readCurrencyRates());
}
