import assert from "node:assert/strict";
import {
  allowanceTargetYear,
  findAllowance,
  proratedLimit,
  prorationFactor,
} from "../src/lib/allowance";
import type { PeriodFilter } from "../src/lib/period";

// Self-check aturan prorata limit Allowance Defect. Jalankan:
//   npx tsx scripts/allowance-check.ts

const LIMIT = 1_200_000_000;

const base: PeriodFilter = {
  period: "yearly",
  month: "all",
  year: "2026",
  day: "2026-04-07",
  weekEnd: "2026-04-07",
  from: "2026-01-01",
  to: "2026-04-30",
};

const f = (patch: Partial<PeriodFilter>): PeriodFilter => ({ ...base, ...patch });

/** Prorata hasil bagi (mis. ÷ 4,33) tidak bulat, jadi dibandingkan dengan toleransi. */
function close(actual: number, expected: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) < 1,
    `${label}: ${actual} != ${expected}`
  );
}

// 1. Setahun penuh = limit apa adanya.
assert.equal(proratedLimit(LIMIT, f({ period: "yearly" })), LIMIT);

// 2. Sebulan dibagi 12; bulan "all" berarti setahun penuh.
assert.equal(proratedLimit(LIMIT, f({ period: "monthly", month: "Feb" })), LIMIT / 12);
assert.equal(proratedLimit(LIMIT, f({ period: "monthly", month: "all" })), LIMIT);

// 3. Seminggu = bagian bulan dibagi 4,33 (≈ limit / 52), BUKAN limit / 4,33.
close(proratedLimit(LIMIT, f({ period: "weekly" })), LIMIT / (12 * 4.33), "weekly");
assert.ok(
  prorationFactor(f({ period: "weekly" })) < 1 / 50,
  "satu minggu tidak boleh memakai >2% limit tahunan"
);

// 4. Sehari dibagi 365.
close(proratedLimit(LIMIT, f({ period: "daily" })), LIMIT / 365, "daily");

// 5. Rentang tanggal mengikuti jumlah hari (inklusif kedua ujung).
close(
  proratedLimit(LIMIT, f({ period: "custom", from: "2026-01-01", to: "2026-01-31" })),
  (LIMIT * 31) / 365,
  "custom 31 hari"
);
close(
  proratedLimit(LIMIT, f({ period: "custom", from: "2026-01-01", to: "2026-12-31" })),
  LIMIT,
  "custom setahun"
);
// Tanpa batas sama sekali = seluruh tahun.
assert.equal(
  proratedLimit(LIMIT, f({ period: "custom", from: "", to: "" })),
  LIMIT
);

// 6. Tahun yang dipakai = tahun TERBARU di dalam filter.
assert.equal(allowanceTargetYear(f({ period: "yearly", year: "2025" })), "2025");
assert.equal(
  allowanceTargetYear(
    f({ period: "custom", from: "2025-12-01", to: "2026-01-31" })
  ),
  "2026"
);
// Minggu yang melewati pergantian tahun memakai tahun ujungnya.
assert.equal(
  allowanceTargetYear(f({ period: "weekly", weekEnd: "2027-01-02" })),
  "2027"
);

// 7. Pemilihan baris limit.
const rows = [
  { year: "2025", limitValue: 500_000_000 },
  { year: "2026", limitValue: LIMIT },
];
assert.deepEqual(findAllowance(rows, f({ period: "yearly" })), {
  year: "2026",
  prorated: LIMIT,
});
// Tahun filter yang belum diisi → null (UI menampilkan "-", tidak menebak tahun lain).
assert.equal(findAllowance(rows, f({ period: "yearly", year: "2027" })), null);
// Filter tanpa tahun (mis. tahun kosong) → tahun terbaru yang punya baris.
assert.equal(findAllowance(rows, f({ period: "yearly", year: "" }))?.year, "2026");
// Tidak ada baris sama sekali → null.
assert.equal(findAllowance([], f({ period: "yearly" })), null);
// Dua tahun: limit diambil dari tahun terbaru, harinya dihitung penuh.
close(
  findAllowance(
    rows,
    f({ period: "custom", from: "2025-12-01", to: "2026-01-31" })
  )?.prorated ?? 0,
  (LIMIT * 62) / 365,
  "custom lintas tahun"
);

console.log("allowance-check: semua pemeriksaan lulus");
