import { currencyRatesGET, currencyRatesPATCH } from "@/lib/api/currency-rates";

/** Kurs USD/RMB ke Rupiah — dipakai kartu "Total Value PO" (admin saja). */
export const GET = currencyRatesGET;
export const PATCH = currencyRatesPATCH;
