/**
 * Ubah panduan Markdown menjadi PDF A4 lewat Chrome headless.
 *
 * Pemakaian (dari folder frontend):
 *   node scripts/guide-pdf.mjs [sumber.md] [keluaran.pdf]
 *
 * Default: ../docs/TUTORIAL-task-planner.md -> ../docs/TUTORIAL-task-planner.pdf
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const sourcePath = process.argv[2]
  ? path.resolve(cwd, process.argv[2])
  : path.join(repoRoot, "docs", "TUTORIAL-task-planner.md");
const outputPath = process.argv[3]
  ? path.resolve(cwd, process.argv[3])
  : path.join(repoRoot, "docs", "TUTORIAL-task-planner.pdf");
const baseDir = path.dirname(sourcePath);

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome tidak ditemukan. Pasang Chrome atau ubah CHROME_CANDIDATES.");
  return found;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  return out;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function isTableStart(line, next) {
  return line.trim().startsWith("|") && Boolean(next) && /^\s*\|[\s:|-]+\|\s*$/.test(next);
}

function isListStart(line) {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function isBlockStart(line) {
  return (
    line.trim() === "" ||
    /^#{1,4}\s/.test(line) ||
    line.trim().startsWith("```") ||
    line.trim().startsWith(">") ||
    line.trim() === "---" ||
    line.trim().startsWith("|") ||
    isListStart(line) ||
    /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim())
  );
}

function renderBlocks(lines) {
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      html.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const fence = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        fence.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
      continue;
    }

    if (trimmed === "---") {
      html.push("<hr />");
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${renderBlocks(quote)}</blockquote>`);
      continue;
    }

    if (isTableStart(lines[i], lines[i + 1])) {
      const header = lines[i]
        .trim()
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(
          lines[i]
            .trim()
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim())
        );
        i += 1;
      }
      const head = header.map((cell) => `<th>${inline(cell)}</th>`).join("");
      const body = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
        .join("");
      html.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    if (isListStart(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && isListStart(lines[i])) {
        const item = lines[i].trim().replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
        items.push(item);
        i += 1;
      }
      const listItems = items.map((item) => `<li>${inline(item)}</li>`).join("");
      html.push(ordered ? `<ol>${listItems}</ol>` : `<ul>${listItems}</ul>`);
      continue;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const alt = image[1];
      const src = image[2].startsWith("http") ? image[2] : pathToFileURL(path.resolve(baseDir, image[2])).href;
      html.push(
        `<figure><img alt="${escapeHtml(alt)}" src="${src}" /><figcaption>${inline(alt)}</figcaption></figure>`
      );
      i += 1;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length === 0) {
      // Baris aneh yang tidak tertangani: majukan satu langkah agar tidak loop.
      paragraph.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}

const markdown = fs.readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n");
const lines = markdown.split("\n");
const titleLine = lines.find((line) => /^#\s+/.test(line));
const title = titleLine ? titleLine.replace(/^#\s+/, "") : "Panduan";
const body = renderBlocks(lines).replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");

const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
const toc = headings
  .map((heading) => `<li><a href="#${slugify(heading)}">${inline(heading)}</a></li>`)
  .join("");

const today = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const document = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #0f172a; font: 10.5pt/1.6 "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  .cover { display: flex; flex-direction: column; justify-content: center; min-height: 245mm; page-break-after: always; }
  .cover .eyebrow { color: #0f766e; font-size: 11pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .cover h1 { margin: 10mm 0 4mm; font-size: 30pt; line-height: 1.15; color: #0b3b39; }
  .cover .lead { max-width: 130mm; font-size: 12pt; color: #334155; }
  .cover .meta { margin-top: 16mm; padding-top: 5mm; border-top: 2px solid #0f766e; color: #475569; font-size: 10pt; }
  h1 { font-size: 20pt; color: #0b3b39; }
  h2 { margin: 8mm 0 3.5mm; padding-bottom: 2mm; border-bottom: 2px solid #0f766e; font-size: 16pt; color: #0b3b39; page-break-after: avoid; }
  h2:first-of-type { margin-top: 0; }
  h3 { margin: 7mm 0 2mm; font-size: 12.5pt; color: #115e59; page-break-after: avoid; }
  h4 { margin: 5mm 0 2mm; font-size: 11pt; color: #115e59; page-break-after: avoid; }
  p { margin: 0 0 2.6mm; }
  ul, ol { margin: 0 0 3.5mm; padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  strong { color: #0b3b39; }
  code { padding: 0 1.2mm; border-radius: 1mm; background: #ecfdf5; color: #0f766e; font: 0.92em/1.4 Consolas, monospace; }
  pre { padding: 3mm; border-radius: 2mm; background: #f1f5f9; overflow: hidden; white-space: pre-wrap; }
  blockquote { margin: 4mm 0; padding: 3mm 4mm; border-left: 4px solid #0f766e; background: #ecfdf5; border-radius: 0 2mm 2mm 0; }
  blockquote p { margin: 0; }
  table { width: 100%; margin: 2mm 0 5mm; border-collapse: collapse; font-size: 9.5pt; page-break-inside: avoid; }
  thead { display: table-header-group; }
  th { padding: 2mm 2.5mm; border: 1px solid #cbd5e1; background: #f0fdfa; color: #0b3b39; text-align: left; }
  td { padding: 2mm 2.5mm; border: 1px solid #cbd5e1; vertical-align: top; }
  tr { page-break-inside: avoid; }
  hr { margin: 6mm 0; border: 0; border-top: 1px solid #cbd5e1; }
  figure { margin: 4mm 0 5mm; page-break-inside: avoid; }
  figure img { display: block; width: 100%; border: 1px solid #cbd5e1; border-radius: 2mm; }
  figcaption { margin-top: 1.5mm; color: #64748b; font-size: 9pt; text-align: center; }
  .toc { margin: 0 0 6mm; padding: 5mm 6mm; border: 1px solid #cbd5e1; border-radius: 2mm; background: #f8fafc; page-break-inside: avoid; }
  .toc h2 { margin: 0 0 3mm; padding: 0; border: 0; font-size: 12pt; page-break-before: auto; }
  .toc ul { margin: 0; padding-left: 0; list-style: none; }
  .toc a { color: #0f766e; text-decoration: none; }
</style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">Portal Produk BARDI</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">Panduan langkah demi langkah untuk semua fitur di menu Rencana Kerja: membuat tugas, menyelesaikan dengan catatan, mengatur pengulangan, kalender, dokumentasi, sampai notifikasi.</p>
    <div class="meta">
      <div>Edisi ${today}</div>
      <div>Sumber: docs/TUTORIAL-task-planner.md</div>
    </div>
  </section>

  <nav class="toc">
    <h2>Daftar isi</h2>
    <ul>${toc}</ul>
  </nav>

  ${body}
</body>
</html>`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bardi-guide-"));
const htmlPath = path.join(tmpDir, "guide.html");
fs.writeFileSync(htmlPath, document, "utf8");

const userDataDir = path.join(tmpDir, "chrome-profile");
const chrome = findChrome();
execFileSync(
  chrome,
  [
    "--headless=new",
    `--user-data-dir=${userDataDir}`,
    "--no-pdf-header-footer",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${outputPath}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: "inherit" }
);

fs.rmSync(tmpDir, { recursive: true, force: true });

const bytes = fs.statSync(outputPath).size;
const pdf = fs.readFileSync(outputPath, "latin1");
const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(JSON.stringify({ output: outputPath, bytes, pages }));
