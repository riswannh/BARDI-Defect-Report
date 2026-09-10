import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env opsional
  }
}

async function main() {
  loadEnv();

  const { db } = await import("./index");
  const {
    defects,
    factories,
    problems,
    products,
    sales,
    statuses,
  } = await import("./schema");
  const { createUserAccount } = await import("../api/users");

  const existing = await db
    .select({ id: factories.id })
    .from(factories)
    .limit(1);
  if (existing.length > 0) {
    console.log("Database sudah berisi data. Seed dilewati.");
    return;
  }

  console.log("Seeding factories...");
  const factoryRows = await db
    .insert(factories)
    .values([
      { name: "Pabrik Jakarta" },
      { name: "Pabrik Surabaya" },
      { name: "Pabrik Bandung" },
    ])
    .returning();

  console.log("Seeding products, problems, statuses...");
  const productRows = await db
    .insert(products)
    .values([
      { name: "Kulkas 2 Pintu" },
      { name: "Mesin Cuci" },
      { name: "AC 1 PK" },
      { name: "Kompor Gas" },
      { name: "Rice Cooker" },
    ])
    .returning();

  const problemRows = await db
    .insert(problems)
    .values([
      { name: "Cacat Cat" },
      { name: "Penyok" },
      { name: "Komponen Rusak" },
      { name: "Sambungan Longgar" },
      { name: "Goresan" },
    ])
    .returning();

  const statusRows = await db
    .insert(statuses)
    .values([
      { name: "Open" },
      { name: "In Progress" },
      { name: "Resolved" },
      { name: "Closed" },
    ])
    .returning();

  const factoryId = (index: number) => factoryRows[index].id;
  const productId = (index: number) => productRows[index].id;
  const problemId = (index: number) => problemRows[index].id;
  const statusId = (index: number) => statusRows[index].id;

  console.log("Seeding defects...");
  await db.insert(defects).values([
    {
      codeGaransi: "WJKT-0001",
      timeStamp: "2026-01-05T09:15",
      photosLink: "https://photos.example.com/defect-1.jpg",
      videosLink: "",
      problemId: problemId(0),
      problemDetail: "Cat terkelupas di bagian depan",
      productId: productId(0),
      quantity: 3,
      statusId: statusId(0),
      factoryId: factoryId(0),
      value: 4500000,
    },
    {
      codeGaransi: "WJKT-0002",
      timeStamp: "2026-01-12T13:40",
      photosLink: "https://photos.example.com/defect-2.jpg",
      videosLink: "https://videos.example.com/defect-2.mp4",
      problemId: problemId(2),
      problemDetail: "Kompresor tidak menyala",
      productId: productId(2),
      quantity: 2,
      statusId: statusId(1),
      factoryId: factoryId(0),
      value: 6200000,
    },
    {
      codeGaransi: "WSBY-0001",
      timeStamp: "2026-02-03T08:20",
      photosLink: "",
      videosLink: "",
      problemId: problemId(1),
      problemDetail: "Panel samping penyok",
      productId: productId(1),
      quantity: 1,
      statusId: statusId(2),
      factoryId: factoryId(1),
      value: 1800000,
    },
    {
      codeGaransi: "WSBY-0002",
      timeStamp: "2026-02-18T15:05",
      photosLink: "https://photos.example.com/defect-4.jpg",
      videosLink: "",
      problemId: problemId(4),
      problemDetail: "Goresan pada pintu kaca",
      productId: productId(0),
      quantity: 5,
      statusId: statusId(0),
      factoryId: factoryId(1),
      value: 3000000,
    },
    {
      codeGaransi: "WBDG-0001",
      timeStamp: "2026-03-09T10:30",
      photosLink: "https://photos.example.com/defect-5.jpg",
      videosLink: "",
      problemId: problemId(3),
      problemDetail: "Sekrup tidak terpasang rapat",
      productId: productId(3),
      quantity: 4,
      statusId: statusId(1),
      factoryId: factoryId(2),
      value: 2400000,
    },
    {
      codeGaransi: "WBDG-0002",
      timeStamp: "2026-03-22T14:45",
      photosLink: "",
      videosLink: "https://videos.example.com/defect-6.mp4",
      problemId: problemId(2),
      problemDetail: "Elemen pemanas rusak",
      productId: productId(4),
      quantity: 6,
      statusId: statusId(3),
      factoryId: factoryId(2),
      value: 3600000,
    },
    {
      codeGaransi: "WJKT-0003",
      timeStamp: "2026-04-07T11:10",
      photosLink: "https://photos.example.com/defect-7.jpg",
      videosLink: "",
      problemId: problemId(0),
      problemDetail: "Cat belang di bagian samping",
      productId: productId(3),
      quantity: 2,
      statusId: statusId(0),
      factoryId: factoryId(0),
      value: 1500000,
    },
  ]);

  console.log("Seeding sales...");
  await db.insert(sales).values([
    { productId: productId(0), factoryId: factoryId(0), month: "Jan", quantity: 120, value: 240000000 },
    { productId: productId(1), factoryId: factoryId(0), month: "Jan", quantity: 90, value: 135000000 },
    { productId: productId(2), factoryId: factoryId(0), month: "Jan", quantity: 60, value: 150000000 },
    { productId: productId(0), factoryId: factoryId(1), month: "Jan", quantity: 100, value: 200000000 },
    { productId: productId(3), factoryId: factoryId(1), month: "Jan", quantity: 140, value: 70000000 },
    { productId: productId(4), factoryId: factoryId(2), month: "Jan", quantity: 200, value: 50000000 },
    { productId: productId(0), factoryId: factoryId(0), month: "Feb", quantity: 110, value: 220000000 },
    { productId: productId(1), factoryId: factoryId(0), month: "Feb", quantity: 85, value: 127500000 },
    { productId: productId(2), factoryId: factoryId(1), month: "Feb", quantity: 55, value: 137500000 },
    { productId: productId(3), factoryId: factoryId(2), month: "Feb", quantity: 130, value: 65000000 },
    { productId: productId(4), factoryId: factoryId(0), month: "Feb", quantity: 180, value: 45000000 },
    { productId: productId(0), factoryId: factoryId(1), month: "Mar", quantity: 130, value: 260000000 },
    { productId: productId(1), factoryId: factoryId(2), month: "Mar", quantity: 75, value: 112500000 },
    { productId: productId(2), factoryId: factoryId(0), month: "Mar", quantity: 70, value: 175000000 },
    { productId: productId(3), factoryId: factoryId(0), month: "Mar", quantity: 150, value: 75000000 },
    { productId: productId(4), factoryId: factoryId(1), month: "Mar", quantity: 210, value: 52500000 },
    { productId: productId(0), factoryId: factoryId(0), month: "Apr", quantity: 115, value: 230000000 },
    { productId: productId(1), factoryId: factoryId(1), month: "Apr", quantity: 95, value: 142500000 },
    { productId: productId(2), factoryId: factoryId(2), month: "Apr", quantity: 65, value: 162500000 },
    { productId: productId(3), factoryId: factoryId(1), month: "Apr", quantity: 125, value: 62500000 },
    { productId: productId(4), factoryId: factoryId(0), month: "Apr", quantity: 190, value: 47500000 },
  ]);

  console.log("Seeding users...");
  await createUserAccount({
    username: "admin",
    password: "admin123",
    isAdmin: true,
    factoryId: null,
  });
  await createUserAccount({
    username: "pabrik_jkt",
    password: "pabrik123",
    isAdmin: false,
    factoryId: factoryId(0),
  });
  await createUserAccount({
    username: "pabrik_sby",
    password: "pabrik123",
    isAdmin: false,
    factoryId: factoryId(1),
  });
  await createUserAccount({
    username: "pabrik_bdg",
    password: "pabrik123",
    isAdmin: false,
    factoryId: factoryId(2),
  });

  console.log("Seed selesai.");
  console.log("Login: admin/admin123, pabrik_jkt/pabrik123, pabrik_sby/pabrik123, pabrik_bdg/pabrik123");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
