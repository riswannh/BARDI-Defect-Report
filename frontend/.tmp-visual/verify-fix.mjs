// Temporary: verify netDefectQty is now sent to the factory role (local).
const BASE = "http://localhost:3000";
const loginRes = await fetch(`${BASE}/api/auth/sign-in/username`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "yundu", password: process.env.FACTORY_PASS }),
});
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
console.log("login yundu:", loginRes.status);

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: { cookie } })).json();

const tahun = new Date().getFullYear();
const r = await get(`/api/report?period=yearly&month=Jan&year=${tahun}&day=${tahun}-04-07&weekEnd=${tahun}-04-07&from=${tahun}-01-01&to=${tahun}-04-30`);
console.log("\n--- totals untuk role PABRIK ---");
console.log(JSON.stringify(r.totals, null, 1));

const t = r.totals ?? {};
console.log("\n--- yang dipakai kartu Report ---");
console.log("  kartu Total Defect  → netDefectQty  :", t.netDefectQty, t.netDefectQty === undefined ? "❌ MASIH HILANG" : t.netDefectQty > 0 ? "✅ ADA & TERISI" : "⚠️ 0");
console.log("  kartu Total Sales   → salesQty      :", t.salesQty);
console.log("  kartu Replacement   → replacementQty:", t.replacementQty);
console.log("  keterangan kartu    → defectQty     :", t.defectQty);

console.log("\n--- pastikan angka uang TETAP disembunyikan ---");
for (const key of ["defectValue", "salesValue", "replacementValue", "replacementRwValue"]) {
  console.log(`  ${key.padEnd(20)} ${key in t ? "❌ BOCOR" : "✅ tidak dikirim"}`);
}
const satuDefect = (await get("/api/defects"))[0] ?? {};
console.log("  baris defect punya value/productPrice?", "value" in satuDefect || "productPrice" in satuDefect ? "❌ BOCOR" : "✅ bersih");
