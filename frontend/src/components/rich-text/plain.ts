/**
 * Jembatan antara dokumen teks polos lama (kolom `body`) dan isi kaya
 * (kolom `bodyHtml`). Dokumen lama tidak dimigrasi paksa: saat dibuka,
 * teksnya dibungkus paragraf supaya tampil rapi di pembaca maupun editor.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ESCAPES[char] ?? char);
}

/** Teks polos → paragraf HTML. Baris kosong memisahkan paragraf. */
export function plainToHtml(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** HTML → teks polos (untuk potongan kartu dan pencarian). */
export function htmlToPlain(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeEntities(stripped)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Potongan isi untuk kartu papan. Membuang elemen chip mention supaya kartu
 * tidak dipenuhi "@nama"; kalau chip itu satu-satunya isi, hasilnya judul task.
 */
export function htmlPreview(html: string, fallback = ""): string {
  if (!html) return fallback;
  const withoutMentions = html.replace(/<span[^>]*data-type="mention"[^>]*>.*?<\/span>/gi, " ");
  return htmlToPlain(withoutMentions) || fallback;
}
