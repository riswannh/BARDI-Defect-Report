import type {
  Defect,
  Factory,
  Problem,
  Product,
  Sale,
  Status,
  User,
} from "@/lib/types";

export const factories: Factory[] = [
  { id: 1, name: "Pabrik Jakarta" },
  { id: 2, name: "Pabrik Surabaya" },
  { id: 3, name: "Pabrik Bandung" },
];

export const products: Product[] = [
  { id: 1, name: "Kulkas 2 Pintu" },
  { id: 2, name: "Mesin Cuci" },
  { id: 3, name: "AC 1 PK" },
  { id: 4, name: "Kompor Gas" },
  { id: 5, name: "Rice Cooker" },
];

export const problems: Problem[] = [
  { id: 1, name: "Cacat Cat" },
  { id: 2, name: "Penyok" },
  { id: 3, name: "Komponen Rusak" },
  { id: 4, name: "Sambungan Longgar" },
  { id: 5, name: "Goresan" },
];

export const statuses: Status[] = [
  { id: 1, name: "Open" },
  { id: 2, name: "In Progress" },
  { id: 3, name: "Resolved" },
  { id: 4, name: "Closed" },
];

export const productOptions = products.map((p) => ({
  value: String(p.id),
  label: p.name,
}));

export const factoryOptions = factories.map((f) => ({
  value: String(f.id),
  label: f.name,
}));

export const problemOptions = problems.map((p) => ({
  value: String(p.id),
  label: p.name,
}));

export const statusOptions = statuses.map((s) => ({
  value: String(s.id),
  label: s.name,
}));

export const users: User[] = [
  { id: 1, username: "admin", factoryId: null, isAdmin: true },
  { id: 2, username: "pabrik_jkt", factoryId: 1, isAdmin: false },
  { id: 3, username: "pabrik_sby", factoryId: 2, isAdmin: false },
  { id: 4, username: "pabrik_bdg", factoryId: 3, isAdmin: false },
];

export const defects: Defect[] = [
  {
    id: 1,
    codeGaransi: "WJKT-0001",
    timestamp: "2026-01-05T09:15",
    photosLink: "https://photos.example.com/defect-1.jpg",
    videosLink: "",
    problemId: 1,
    problemDetail: "Cat terkelupas di bagian depan",
    productId: 1,
    quantity: 3,
    statusId: 1,
    factoryId: 1,
    value: 4500000,
  },
  {
    id: 2,
    codeGaransi: "WJKT-0002",
    timestamp: "2026-01-12T13:40",
    photosLink: "https://photos.example.com/defect-2.jpg",
    videosLink: "https://videos.example.com/defect-2.mp4",
    problemId: 3,
    problemDetail: "Kompresor tidak menyala",
    productId: 3,
    quantity: 2,
    statusId: 2,
    factoryId: 1,
    value: 6200000,
  },
  {
    id: 3,
    codeGaransi: "WSBY-0001",
    timestamp: "2026-02-03T08:20",
    photosLink: "",
    videosLink: "",
    problemId: 2,
    problemDetail: "Panel samping penyok",
    productId: 2,
    quantity: 1,
    statusId: 3,
    factoryId: 2,
    value: 1800000,
  },
  {
    id: 4,
    codeGaransi: "WSBY-0002",
    timestamp: "2026-02-18T15:05",
    photosLink: "https://photos.example.com/defect-4.jpg",
    videosLink: "",
    problemId: 5,
    problemDetail: "Goresan pada pintu kaca",
    productId: 1,
    quantity: 5,
    statusId: 1,
    factoryId: 2,
    value: 3000000,
  },
  {
    id: 5,
    codeGaransi: "WBDG-0001",
    timestamp: "2026-03-09T10:30",
    photosLink: "https://photos.example.com/defect-5.jpg",
    videosLink: "",
    problemId: 4,
    problemDetail: "Sekrup tidak terpasang rapat",
    productId: 4,
    quantity: 4,
    statusId: 2,
    factoryId: 3,
    value: 2400000,
  },
  {
    id: 6,
    codeGaransi: "WBDG-0002",
    timestamp: "2026-03-22T14:45",
    photosLink: "",
    videosLink: "https://videos.example.com/defect-6.mp4",
    problemId: 3,
    problemDetail: "Elemen pemanas rusak",
    productId: 5,
    quantity: 6,
    statusId: 4,
    factoryId: 3,
    value: 3600000,
  },
  {
    id: 7,
    codeGaransi: "WJKT-0003",
    timestamp: "2026-04-07T11:10",
    photosLink: "https://photos.example.com/defect-7.jpg",
    videosLink: "",
    problemId: 1,
    problemDetail: "Cat belang di bagian samping",
    productId: 4,
    quantity: 2,
    statusId: 1,
    factoryId: 1,
    value: 1500000,
  },
];

export const sales: Sale[] = [
  { id: 1, productId: 1, factoryId: 1, month: "Jan", quantity: 120, value: 240000000 },
  { id: 2, productId: 2, factoryId: 1, month: "Jan", quantity: 90, value: 135000000 },
  { id: 3, productId: 3, factoryId: 1, month: "Jan", quantity: 60, value: 150000000 },
  { id: 4, productId: 1, factoryId: 2, month: "Jan", quantity: 100, value: 200000000 },
  { id: 5, productId: 4, factoryId: 2, month: "Jan", quantity: 140, value: 70000000 },
  { id: 6, productId: 5, factoryId: 3, month: "Jan", quantity: 200, value: 50000000 },
  { id: 7, productId: 1, factoryId: 1, month: "Feb", quantity: 110, value: 220000000 },
  { id: 8, productId: 2, factoryId: 1, month: "Feb", quantity: 85, value: 127500000 },
  { id: 9, productId: 3, factoryId: 2, month: "Feb", quantity: 55, value: 137500000 },
  { id: 10, productId: 4, factoryId: 3, month: "Feb", quantity: 130, value: 65000000 },
  { id: 11, productId: 5, factoryId: 1, month: "Feb", quantity: 180, value: 45000000 },
  { id: 12, productId: 1, factoryId: 2, month: "Mar", quantity: 130, value: 260000000 },
  { id: 13, productId: 2, factoryId: 3, month: "Mar", quantity: 75, value: 112500000 },
  { id: 14, productId: 3, factoryId: 1, month: "Mar", quantity: 70, value: 175000000 },
  { id: 15, productId: 4, factoryId: 1, month: "Mar", quantity: 150, value: 75000000 },
  { id: 16, productId: 5, factoryId: 2, month: "Mar", quantity: 210, value: 52500000 },
  { id: 17, productId: 1, factoryId: 1, month: "Apr", quantity: 115, value: 230000000 },
  { id: 18, productId: 2, factoryId: 2, month: "Apr", quantity: 95, value: 142500000 },
  { id: 19, productId: 3, factoryId: 3, month: "Apr", quantity: 65, value: 162500000 },
  { id: 20, productId: 4, factoryId: 2, month: "Apr", quantity: 125, value: 62500000 },
  { id: 21, productId: 5, factoryId: 1, month: "Apr", quantity: 190, value: 47500000 },
];
