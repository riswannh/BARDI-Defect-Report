import type { TranslationKey } from "@/lib/i18n";

/** Kolom yang bisa kosong saat impor sheet → kunci labelnya. */
const LABELS: Record<string, TranslationKey> = {
  claimId: "repair.missing.claimId",
  product: "repair.missing.product",
  date: "repair.missing.date",
};

/** "claimId,product" → "Claim ID, Produk" sesuai bahasa aktif. */
export function incompleteFieldsLabel(
  t: (key: TranslationKey) => string,
  fields: string
): string {
  return fields
    .split(",")
    .map((field) => (LABELS[field] ? t(LABELS[field]) : field))
    .join(", ");
}
