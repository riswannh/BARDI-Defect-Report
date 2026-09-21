// Temporary: see exactly what a factory user sees on the Report page.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync(".tmp-visual", { recursive: true });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "https://portalbardi.cloud";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "id-ID" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.waitForSelector("#username", { timeout: 30000 });
await page.waitForTimeout(2500);
await page.fill("#username", "yundu");
await page.fill("#password", process.env.FACTORY_PASS);
await page.click('button[type="submit"]');
await page.waitForTimeout(6000);
console.log("URL setelah login:", page.url());

// ambil semua kartu ringkasan
const cards = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("div").forEach((d) => {
    const t = d.textContent ?? "";
    if (d.querySelectorAll("div").length < 6 && /Total Defect|Total Sales|Nilai|Replacement|Rasio/.test(t) && t.length < 90) {
      out.push(t.replace(/\n+/g, " | ").trim());
    }
  });
  return [...new Set(out)];
});
console.log("\n--- kartu ringkasan yang terlihat ---");
for (const c of cards) console.log("  " + c);

// filter yang terlihat
const labels = await page.locator("main label").allInnerTexts().catch(() => []);
console.log("\nlabel filter:", JSON.stringify(labels.map((s) => s.trim())));
const triggers = page.locator("main [data-slot='select-trigger']");
const n = await triggers.count();
console.log("dropdown:", n);
for (let i = 0; i < n; i++) {
  console.log(`  #${i} = ${JSON.stringify((await triggers.nth(i).innerText()).trim())}`);
}

// menu sidebar untuk role pabrik
const nav = await page.locator("nav a, aside a").allInnerTexts().catch(() => []);
console.log("\nmenu sidebar:", JSON.stringify(nav.map((s) => s.trim()).filter(Boolean)));

await page.screenshot({ path: ".tmp-visual/pabrik-report.png", fullPage: true });
console.log("\nerrors:", errors.length ? errors.slice(0, 4) : "none");
await browser.close();
console.log("done");
