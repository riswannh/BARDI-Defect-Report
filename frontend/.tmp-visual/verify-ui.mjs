// Temporary: confirm the Total Defect card now shows a real number for a factory user.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

mkdirSync(".tmp-visual", { recursive: true });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "id-ID" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.waitForSelector("#username", { timeout: 30000 });
await page.waitForTimeout(2000);
await page.fill("#username", "yundu");
await page.fill("#password", process.env.FACTORY_PASS);
await page.click('button[type="submit"]');
await page.waitForTimeout(6000);
console.log("URL:", page.url());

const cards = await page.evaluate(() => {
  const grab = (label) => {
    const el = Array.from(document.querySelectorAll("div")).find((d) => {
      const t = d.textContent ?? "";
      return t.startsWith(label) && d.querySelectorAll("div").length < 5 && t.length < 80;
    });
    return el ? el.innerText.replace(/\n+/g, " | ") : "(tidak ada)";
  };
  return {
    totalDefect: grab("Total Defect"),
    totalSales: grab("Total Sales"),
    rasio: grab("Rasio Defect/Sales"),
    replacement: grab("Replacement"),
  };
});
console.log("\n--- kartu untuk role PABRIK ---");
for (const [k, v] of Object.entries(cards)) console.log(`  ${k.padEnd(13)} ${v}`);

await page.screenshot({ path: ".tmp-visual/pabrik-report-fixed.png", fullPage: true });
console.log("\nerrors:", errors.length ? errors.slice(0, 3) : "none");
await browser.close();
console.log("done");
