import type { TranslationKey } from "@/lib/i18n";

/** Kolom yang bisa kosong saat sync sheet → kunci labelnya. */
const LABELS: Record<string, TranslationKey> = {
  claimId: "warranty.missing.claimId",
  product: "warranty.missing.product",
  date: "warranty.missing.date",
  price: "warranty.missing.price",
};

/** "claimId,price" → "Claim ID, Harga RW bulan ini" sesuai bahasa aktif. */
export function incompleteFieldsLabel(
  t: (key: TranslationKey) => string,
  fields: string
): string {
  return fields
    .split(",")
    .map((field) => (LABELS[field] ? t(LABELS[field]) : field))
    .join(", ");
}
