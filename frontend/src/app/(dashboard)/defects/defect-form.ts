import type { Defect, Factory } from "@/lib/types";

export interface SelectOption {
  value: string;
  label: string;
}

export interface DefectRow extends Omit<Defect, "value"> {
  value?: number;
  productName?: string | null;
  factoryName?: string | null;
  problemName?: string | null;
  statusName?: string | null;
}

export interface DefectForm {
  codeGaransi: string;
  timestamp: string;
  photosLink: string;
  videosLink: string;
  problemId: string;
  problemDetail: string;
  productId: string;
  quantity: string;
  statusId: string;
  factoryId: string;
  /**
   * Harga RW = harga satuan (Rupiah per pcs), bukan nilai barisnya.
   *
   * Isian awal datang dari harga master produk (periode `timestamp`; kalau tidak
   * ada, harga terbaru produk itu — lihat `pickProductPrice`) dan masih bisa
   * ditimpa operator atau dipilih dari daftar harga produk. Yang disimpan ke
   * `defects.value` adalah totalnya (`defectTotalValue` = harga ini × Quantity),
   * dihitung di klien — server tetap menyimpan apa adanya.
   */
  priceRw: string;
}

/** Nilai baris defect = Harga RW × Quantity (Rupiah, dibulatkan). */
export function defectTotalValue(form: DefectForm): number {
  const price = Number(form.priceRw) || 0;
  const qty = Number(form.quantity) || 0;
  // Quantity 0 diperlakukan sebagai 1 supaya baris lama tanpa qty tidak kehilangan
  // nilainya saat disunting.
  return Math.round(price * (qty > 0 ? qty : 1));
}

/** Nilai `datetime-local` untuk waktu sekarang (waktu lokal mesin, bukan UTC). */
export function localDateTimeValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function emptyForm(): DefectForm {
  return {
    codeGaransi: "",
    timestamp: localDateTimeValue(),
    photosLink: "",
    videosLink: "",
    problemId: "",
    problemDetail: "",
    productId: "",
    quantity: "",
    statusId: "",
    factoryId: "",
    priceRw: "",
  };
}

/**
 * Form untuk entri berikutnya setelah "Simpan & tambah lagi".
 *
 * Produk, Pabrik, dan Status dibawa dari entri sebelumnya karena satu shift
 * biasanya mencatat beberapa defect pada produk/pabrik yang sama. Kode garansi,
 * timestamp, qty, dan detail dikosongkan supaya tidak ikut terduplikasi.
 */
export function carryOverForm(previous: DefectForm): DefectForm {
  return {
    ...emptyForm(),
    productId: previous.productId,
    factoryId: previous.factoryId,
    statusId: previous.statusId,
    // Produknya sama dan periodenya biasanya masih sama, jadi harga tadi dibawa
    // sebagai isian awal entri berikutnya (masih bisa diubah).
    priceRw: previous.priceRw,
  };
}

export function formHasContent(form: DefectForm): boolean {
  return (
    form.codeGaransi.trim() !== "" ||
    form.problemId !== "" ||
    form.productId !== "" ||
    form.statusId !== "" ||
    form.factoryId !== "" ||
    form.quantity.trim() !== "" ||
    form.priceRw.trim() !== "" ||
    form.problemDetail.trim() !== "" ||
    form.photosLink.trim() !== "" ||
    form.videosLink.trim() !== ""
  );
}

export function rowToForm(d: DefectRow): DefectForm {
  const qty = Number(d.quantity) || 0;
  const value = d.value ?? 0;
  return {
    codeGaransi: d.codeGaransi,
    timestamp: d.timestamp,
    photosLink: d.photosLink,
    videosLink: d.videosLink,
    problemId: String(d.problemId),
    problemDetail: d.problemDetail,
    productId: String(d.productId),
    quantity: String(d.quantity),
    statusId: String(d.statusId),
    factoryId: String(d.factoryId),
    // Harga per pcs direkonstruksi dari nilai baris ÷ quantity. ponytail: baris
    // hasil impor Excel yang nilainya bukan kelipatan qty bisa membulat beberapa
    // rupiah saat disunting; kalau itu mengganggu, simpan harga per pcs-nya di DB.
    priceRw: String(qty > 0 ? Math.round(value / qty) : value),
  };
}

/**
 * Prefiks kode garansi sebuah pabrik.
 *
 * Sumber utama adalah kode yang sudah ada di pabrik itu (mis. `WJKT-0001`,
 * `WSBY-0002`), sehingga saran selalu mengikuti konvensi nyata organisasi.
 * Nama pabrik dipakai hanya sebagai cadangan untuk pabrik baru yang belum punya
 * data — kalau diturunkan dari nama mentah, "Pabrik Jakarta" akan menghasilkan
 * `WPAB-` yang tidak cocok dengan riwayat `WJKT-`.
 *
 * Kode dicocokkan ke pabrik lewat `factoryId`; bila baris tidak membawa
 * `factoryId` (mis. hasil impor), nama pabrik pada baris dipakai sebagai ganti.
 */
export function codePrefixForFactory(
  factoryId: string,
  factoryName: string,
  defects: DefectRow[],
  factories: Factory[]
): string {
  if (factoryId) {
    const wanted = Number(factoryId);
    const counts = new Map<string, number>();
    for (const d of defects) {
      let belongs = d.factoryId === wanted;
      if (!belongs && d.factoryName && factories.length > 0) {
        belongs = d.factoryName === factoryName;
      }
      if (!belongs) continue;
      const prefix = d.codeGaransi?.match(/^[A-Za-z]+-/)?.[0];
      if (!prefix) continue;
      const key = prefix.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [prefix, count] of counts) {
      if (count > bestCount) {
        best = prefix;
        bestCount = count;
      }
    }
    if (best) return best;
  }
  return namePrefix(factoryName);
}

/** Cadangan untuk pabrik yang belum punya kode: `W` + 3 huruf/angka pertama. */
function namePrefix(factoryName: string): string {
  const letters = factoryName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (letters.length === 0) return "W-";
  return `W${letters.slice(0, 3)}-`;
}

/** Kode garansi berikutnya untuk pabrik terpilih, atau null bila belum jelas. */
export function suggestNextCode(
  defects: DefectRow[],
  factories: Factory[],
  factoryId: string
): string | null {
  if (!factoryId) return null;
  const factory = factories.find((f) => f.id === Number(factoryId));
  if (!factory) return null;
  const prefix = codePrefixForFactory(
    factoryId,
    factory.name,
    defects,
    factories
  );
  let highest = 0;
  for (const d of defects) {
    const code = d.codeGaransi?.toUpperCase() ?? "";
    if (!code.startsWith(prefix)) continue;
    const digits = code.slice(prefix.length).match(/^\d+/)?.[0];
    if (digits) highest = Math.max(highest, Number(digits));
  }
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
