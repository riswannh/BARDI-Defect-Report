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
   * Nilai defect (Rupiah) yang disimpan APA ADANYA ke database — tidak dihitung
   * ulang di server dan tidak lagi merujuk baris harga master. Form mengisinya
   * otomatis dari harga master periode ini sebagai isian awal, tapi angkanya boleh
   * diubah dan yang tersimpan adalah isi kotak ini.
   */
  value: string;
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
    value: "",
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
    // Produknya sama dan periodenya biasanya masih sama, jadi nilai tadi dibawa
    // sebagai isian awal entri berikutnya (masih bisa diubah).
    value: previous.value,
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
    form.value.trim() !== "" ||
    form.problemDetail.trim() !== "" ||
    form.photosLink.trim() !== "" ||
    form.videosLink.trim() !== ""
  );
}

export function rowToForm(d: DefectRow): DefectForm {
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
    value: String(d.value ?? 0),
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
