import type { Factory, Product, PurchaseOrder } from "@/lib/types";

/**
 * Data contoh untuk mode demo halaman PO Product.
 *
 * Seluruh isinya — termasuk daftar produk dan pabriknya — sengaja BERDIRI SENDIRI
 * dan tidak menyentuh database sama sekali, supaya halaman bisa diperiksa
 * tampilannya tanpa membaca atau menulis data asli.
 *
 * Dinyalakan lewat `NEXT_PUBLIC_PO_DEMO=on` (lihat po-demo.ts). Berkas ini beserta
 * po-demo.ts boleh dihapus kapan saja setelah backend PO yang asli selesai.
 */

export const demoProducts: Product[] = [
  { id: -1, name: "LED Bulb 12W RGBWW", sku: "BLB-12-RGB" },
  { id: -2, name: "Smart Plug 16A WiFi", sku: "PLG-16-WF" },
  { id: -3, name: "Motion Sensor Zigbee", sku: "SNS-ZB-01" },
  { id: -4, name: "Door Sensor Zigbee", sku: "SNS-ZB-02" },
  { id: -5, name: "IP Camera Fixed Outdoor A50", sku: "CAM-A50" },
  { id: -6, name: "ZigBee Gateway 3.0", sku: "GTW-ZB-30" },
  { id: -7, name: "Smart Light Strip 5m", sku: "STR-5M-01" },
  { id: -8, name: "Air Purifier P2", sku: "PUR-P2" },
  // Produk tanpa SKU tetap diperlihatkan supaya terlihat bagaimana dropdown
  // berperilaku ketika SKU belum diisi (kondisi 118 produk asli saat ini).
  { id: -9, name: "Rice Cooker 1.8L (belum ada SKU)", sku: null },
];

export const demoFactories: Factory[] = [
  { id: -1, name: "NINGBO BRIGHTLITE ELECTRIC CO., LTD" },
  { id: -2, name: "SHENZHEN YUNDU TECHNOLOGY CO., LTD" },
  { id: -3, name: "FUZHOU HOME APPLIANCE GROUP" },
];

/**
 * Master keterangan contoh.
 *
 * Keterangan adalah master yang bisa di-CRUD (lihat SPEC-po-product.md keputusan 1.4),
 * jadi baris PO menyimpan `keteranganId`, bukan teks bebas.
 */
export const demoKeterangan = [
  { id: -1, name: "Pengiriman batch pertama" },
  { id: -2, name: "Tambah stok gudang A" },
  { id: -3, name: "Retur diganti unit baru" },
  { id: -4, name: "Pengiriman batch kedua" },
  { id: -5, name: "Prioritas produksi" },
  { id: -6, name: "Menunggu konfirmasi harga akhir" },
];

const rows: Array<{
  poNumber: string;
  productIndex: number;
  factoryIndex: number;
  quantity: number;
  pricePerPcs: number;
  currency: string;
  keteranganIndex: number | null;
  timestamp: string;
}> = [
  {
    poNumber: "PO-2026-001",
    productIndex: 0,
    factoryIndex: 0,
    quantity: 12000,
    pricePerPcs: 18500,
    currency: "Rp",
    keteranganIndex: 0,
    timestamp: "2026-01-08T09:15",
  },
  {
    poNumber: "PO-2026-001",
    productIndex: 1,
    factoryIndex: 0,
    quantity: 4800,
    pricePerPcs: 2400,
    currency: "USD",
    keteranganIndex: 0,
    timestamp: "2026-01-22T14:40",
  },
  {
    poNumber: "PO-2026-001",
    productIndex: 2,
    factoryIndex: 1,
    quantity: 3000,
    pricePerPcs: 950,
    currency: "RMB",
    keteranganIndex: 1,
    timestamp: "2026-01-30T11:05",
  },
  {
    poNumber: "PO-2026-002",
    productIndex: 3,
    factoryIndex: 1,
    quantity: 7500,
    pricePerPcs: 42000,
    currency: "Rp",
    keteranganIndex: 2,
    timestamp: "2026-02-03T08:20",
  },
  {
    // Baris tanpa keterangan, untuk melihat bagaimana tabel menanganinya.
    poNumber: "PO-2026-002",
    productIndex: 4,
    factoryIndex: 2,
    quantity: 2100,
    pricePerPcs: 7500,
    currency: "USD",
    keteranganIndex: null,
    timestamp: "2026-02-18T16:55",
  },
  {
    poNumber: "PO-2026-003",
    productIndex: 5,
    factoryIndex: 2,
    quantity: 900,
    pricePerPcs: 1200,
    currency: "RMB",
    keteranganIndex: 4,
    timestamp: "2026-03-05T10:10",
  },
  {
    poNumber: "PO-2026-003",
    productIndex: 6,
    factoryIndex: 0,
    quantity: 6400,
    pricePerPcs: 640000,
    currency: "Rp",
    keteranganIndex: 3,
    timestamp: "2026-03-21T13:30",
  },
  {
    // Harga pecahan (USD 38.75) untuk menunjukkan kolom real bekerja.
    poNumber: "PO-2026-004",
    productIndex: 7,
    factoryIndex: 2,
    quantity: 450,
    pricePerPcs: 38.75,
    currency: "USD",
    keteranganIndex: 4,
    timestamp: "2026-04-02T09:45",
  },
  {
    poNumber: "PO-2026-004",
    productIndex: 8,
    factoryIndex: 1,
    quantity: 1800,
    pricePerPcs: 275000,
    currency: "Rp",
    keteranganIndex: 5,
    timestamp: "2026-04-14T15:20",
  },
];

/** Baris PO contoh. `value` di sini hanya untuk tampilan demo. */
export const demoPurchaseOrders: PurchaseOrder[] = rows.map((row, index) => {
  const product = demoProducts[row.productIndex];
  const factory = demoFactories[row.factoryIndex];
  const keterangan =
    row.keteranganIndex === null ? null : demoKeterangan[row.keteranganIndex];
  return {
    id: index + 1,
    poNumber: row.poNumber,
    poDate: row.timestamp,
    productId: product.id,
    factoryId: factory.id,
    quantity: row.quantity,
    pricePerPcs: row.pricePerPcs,
    value: row.pricePerPcs * row.quantity,
    currency: row.currency,
    keteranganId: keterangan?.id ?? null,
    keteranganName: keterangan?.name ?? null,
    sku: product.sku ?? null,
    productName: product.name,
    factoryName: factory.name,
  };
});

/**
 * Versi data contoh untuk role Pabrik.
 *
 * Dua hal yang membedakannya dari versi admin, supaya mode demo pun jujur
 * menggambarkan apa yang nanti benar-benar diterima role Pabrik:
 *
 * 1. Hanya baris milik satu pabrik yang disertakan (di produksi,
 *    `scopedFactoryId()` memaksa filter pabrik milik user).
 * 2. Field harga DIHAPUS dari objeknya, bukan sekadar tidak ditampilkan.
 */
export function demoPurchaseOrdersForFactory(): PurchaseOrder[] {
  const ownFactoryId = demoFactories[1].id;
  return demoPurchaseOrders
    .filter((row) => row.factoryId === ownFactoryId)
    .map((row) => {
      const copy: PurchaseOrder = { ...row };
      delete copy.pricePerPcs;
      delete copy.value;
      delete copy.currency;
      return copy;
    });
}
