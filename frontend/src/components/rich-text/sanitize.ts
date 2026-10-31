/**
 * Sanitasi HTML isi dokumentasi SEBELUM dirender. HTML disimpan apa adanya di
 * database, jadi titik render adalah satu-satunya tempat yang perlu dijaga:
 * hanya tag/atribut di allowlist yang lolos, semua tautan keluar dipaksa
 * `target="_blank"` + `rel="noopener noreferrer"`.
 *
 * DOMPurify hanya jalan di browser; pemakaian pertama selalu terjadi setelah
 * dialog dibuka (interaksi pengguna), jadi tidak ada HTML yang dirender dari
 * server dan tidak ada risiko hydration mismatch.
 */
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "style",
  "data-type",
  "data-id",
  "data-label",
  "data-mention-kind",
];

let hookInstalled = false;

function installLinkHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/** Membersihkan HTML isi dokumen; aman dipanggil berkali-kali. */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  installLinkHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // `style` dibatasi baris ini saja: editor hanya menulis font-family/size/color.
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}
