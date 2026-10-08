"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Language = "id" | "en" | "zh";

export const LANGUAGES: { value: Language; label: string; short: string }[] = [
  { value: "id", label: "Indonesia", short: "ID" },
  { value: "en", label: "English", short: "EN" },
  { value: "zh", label: "中文", short: "中文" },
];

const translations = {
  // Common
  "common.save": { id: "Simpan", en: "Save", zh: "保存" },
  "common.cancel": { id: "Batal", en: "Cancel", zh: "取消" },
  "common.close": { id: "Tutup", en: "Close", zh: "关闭" },
  "common.update": { id: "Perbarui", en: "Update", zh: "更新" },
  "common.add": { id: "Tambah", en: "Add", zh: "添加" },
  "common.search": { id: "Cari", en: "Search", zh: "搜索" },
  "common.all": { id: "Semua", en: "All", zh: "全部" },
  "common.noData": { id: "Tidak ada data.", en: "No data.", zh: "暂无数据。" },
  "common.loading": { id: "Memuat…", en: "Loading…", zh: "加载中…" },
  "common.noResults": {
    id: "Tidak ditemukan",
    en: "No results",
    zh: "未找到",
  },
  "common.product": { id: "Produk", en: "Product", zh: "产品" },
  "common.factory": { id: "Pabrik", en: "Factory", zh: "工厂" },
  "common.month": { id: "Bulan", en: "Month", zh: "月份" },
  "common.quantity": { id: "Quantity", en: "Quantity", zh: "数量" },
  "common.sku": { id: "SKU", en: "SKU", zh: "SKU" },
  "common.value": { id: "Value", en: "Value", zh: "金额" },
  "common.valueIdr": { id: "Value (IDR)", en: "Value (IDR)", zh: "金额 (IDR)" },
  "common.status": { id: "Status", en: "Status", zh: "状态" },
  "common.problem": { id: "Problem", en: "Problem", zh: "问题" },
  "common.timestamp": { id: "Timestamp", en: "Timestamp", zh: "时间" },
  "common.codeGaransi": {
    id: "Code Garansi",
    en: "Warranty Code",
    zh: "保修编号",
  },
  "common.media": { id: "Media", en: "Media", zh: "媒体" },
  "common.qty": { id: "Qty", en: "Qty", zh: "数量" },
  "common.importExcel": {
    id: "Import Excel",
    en: "Import Excel",
    zh: "导入 Excel",
  },
  "common.exportExcel": {
    id: "Export Excel",
    en: "Export Excel",
    zh: "导出 Excel",
  },
  "common.template": { id: "Template", en: "Template", zh: "模板" },
  "common.username": { id: "Username", en: "Username", zh: "用户名" },
  "common.password": { id: "Password", en: "Password", zh: "密码" },
  "common.role": { id: "Peran", en: "Role", zh: "角色" },
  "common.admin": { id: "Admin", en: "Admin", zh: "管理员" },
  "common.photo": { id: "Foto", en: "Photo", zh: "照片" },
  "common.video": { id: "Video", en: "Video", zh: "视频" },

  // Layout
  "nav.brand": { id: "Defect & Sales", en: "Defect & Sales", zh: "缺陷与销售" },
  "nav.report": { id: "Report", en: "Report", zh: "报告" },
  "nav.sales": { id: "Data Sales", en: "Sales Data", zh: "销售数据" },
  "nav.po": { id: "PO Product", en: "PO Product", zh: "采购订单" },
  "nav.tickets": { id: "Ticketing", en: "Ticketing", zh: "工单" },
  "nav.defects": { id: "Data Defect", en: "Defect Data", zh: "缺陷数据" },
  "nav.master": { id: "Data Master", en: "Master Data", zh: "主数据" },
  "nav.users": {
    id: "User Management",
    en: "User Management",
    zh: "用户管理",
  },
  "nav.adminAccess": {
    id: "Admin — akses penuh",
    en: "Admin — full access",
    zh: "管理员 — 完全访问",
  },
  "nav.factoryAccess": {
    id: "Pabrik — akses terbatas",
    en: "Factory — limited access",
    zh: "工厂 — 受限访问",
  },
  "nav.openMenu": {
    id: "Buka menu navigasi",
    en: "Open navigation menu",
    zh: "打开导航菜单",
  },

  // Header
  "header.allFactories": {
    id: "Semua Pabrik",
    en: "All Factories",
    zh: "所有工厂",
  },
  "header.administrator": {
    id: "Administrator",
    en: "Administrator",
    zh: "管理员",
  },
  "header.factoryLabel": {
    id: "Pabrik · {name}",
    en: "Factory · {name}",
    zh: "工厂 · {name}",
  },
  "header.logout": { id: "Keluar", en: "Log out", zh: "退出" },
  "header.language": { id: "Bahasa", en: "Language", zh: "语言" },

  // Login
  "login.title": {
    id: "Defect & Sales Analysis",
    en: "Defect & Sales Analysis",
    zh: "缺陷与销售分析",
  },
  "login.subtitle": {
    id: "Masuk dengan username dan password Anda",
    en: "Sign in with your username and password",
    zh: "使用您的用户名和密码登录",
  },
  "login.submit": { id: "Masuk", en: "Sign in", zh: "登录" },
  "login.error": {
    id: "Username atau password salah.",
    en: "Invalid username or password.",
    zh: "用户名或密码错误。",
  },

  // Pagination
  "pagination.showing": {
    id: "Menampilkan {start}–{end} dari {total} data",
    en: "Showing {start}–{end} of {total} items",
    zh: "显示第 {start}–{end} 条，共 {total} 条",
  },
  "pagination.rowsPerPage": {
    id: "Baris per halaman",
    en: "Rows per page",
    zh: "每页行数",
  },
  "pagination.previous": { id: "Sebelumnya", en: "Previous", zh: "上一页" },
  "pagination.page": { id: "Halaman", en: "Page", zh: "页" },
  "pagination.next": { id: "Berikutnya", en: "Next", zh: "下一页" },

  // Report
  "report.title": { id: "Report", en: "Report", zh: "报告" },
  "report.description": {
    id: "Analisis perbandingan defect dan sales per produk.",
    en: "Comparison analysis of defects and sales per product.",
    zh: "按产品比较缺陷与销售的分析。",
  },
  "report.period": { id: "Periode", en: "Period", zh: "期间" },
  "report.daily": { id: "Harian", en: "Daily", zh: "每日" },
  "report.weekly": { id: "Mingguan", en: "Weekly", zh: "每周" },
  "report.monthly": { id: "Bulanan", en: "Monthly", zh: "每月" },
  "report.yearly": { id: "Tahunan", en: "Yearly", zh: "年度" },
  "report.year": { id: "Tahun", en: "Year", zh: "年份" },
  "report.custom": { id: "Rentang Tanggal", en: "Date Range", zh: "日期范围" },
  "report.allMonths": {
    id: "Semua Bulan",
    en: "All Months",
    zh: "所有月份",
  },
  "report.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "report.weekEnd": { id: "Akhir Minggu", en: "Week End", zh: "周末日期" },
  "report.from": { id: "Dari", en: "From", zh: "从" },
  "report.to": { id: "Sampai", en: "To", zh: "至" },
  "report.totalDefect": {
    id: "Total Defect",
    en: "Total Defect",
    zh: "缺陷总数",
  },
  "report.totalSales": { id: "Total Sales", en: "Total Sales", zh: "销售总数" },
  "report.defectValue": {
    id: "Nilai Defect",
    en: "Defect Value",
    zh: "缺陷金额",
  },
  "report.salesValue": { id: "Nilai Sales", en: "Sales Value", zh: "销售金额" },
  "report.chartQtyTitle": {
    id: "Total Defect — Quantity",
    en: "Total Defect — Quantity",
    zh: "缺陷总数 — 数量",
  },
  "report.chartValueTitle": {
    id: "Total Defect — Value (IDR)",
    en: "Total Defect — Value (IDR)",
    zh: "缺陷总数 — 金额 (IDR)",
  },
  "report.chartSalesQtyTitle": {
    id: "Total Sales — Quantity",
    en: "Total Sales — Quantity",
    zh: "销售总额 — 数量",
  },
  "report.chartSalesValueTitle": {
    id: "Total Sales — Value (IDR)",
    en: "Total Sales — Value (IDR)",
    zh: "销售总额 — 金额 (IDR)",
  },
  "report.trendTitle": {
    id: "Tren Defect per Periode",
    en: "Defect Trend by Period",
    zh: "按期间缺陷趋势",
  },
  "report.pieProductTitle": {
    id: "Proporsi Defect per Produk",
    en: "Defect Share by Product",
    zh: "按产品缺陷占比",
  },
  "report.pieSalesProductTitle": {
    id: "Proporsi Sales per Produk",
    en: "Sales Share by Product",
    zh: "按产品销售占比",
  },
  "report.pieProblemTitle": {
    id: "Proporsi Defect per Problem",
    en: "Defect Share by Problem",
    zh: "按问题缺陷占比",
  },
  "report.others": { id: "Lainnya", en: "Others", zh: "其他" },
  "report.recapTitle": {
    id: "Rekap Per Produk",
    en: "Recap by Product",
    zh: "按产品汇总",
  },
  "report.searchProduct": {
    id: "Cari produk…",
    en: "Search product…",
    zh: "搜索产品…",
  },
  "report.qtyDefect": { id: "Qty Defect", en: "Defect Qty", zh: "缺陷数量" },
  "report.valueDefect": {
    id: "Value Defect",
    en: "Defect Value",
    zh: "缺陷金额",
  },
  "report.qtySales": { id: "Qty Sales", en: "Sales Qty", zh: "销售数量" },
  "report.valueSales": { id: "Value Sales", en: "Sales Value", zh: "销售金额" },
  "report.ratio": {
    id: "Rasio Defect/Sales",
    en: "Defect/Sales Ratio",
    zh: "缺陷/销售比率",
  },
  "report.ratioDesc": {    id: "Qty Defect ÷ Qty Sales",
    en: "Defect Qty ÷ Sales Qty",
    zh: "缺陷数量 ÷ 销售数量",
  },
  "report.replacement": {
    id: "Replacement",
    en: "Replacement",
    zh: "更换",
  },
  "report.replacementDesc": {
    id: "Qty PO Replacement",
    en: "Replacement PO Qty",
    zh: "更换采购数量",
  },
  /** Selisih Replacement − Defect (kolom tabel rekap & kartu ringkasan). */
  "report.selisihDefect": {
    id: "Selisih Defect",
    en: "Defect Difference",
    zh: "缺陷差额",
  },
  "report.selisihQty": {
    id: "Selisih Defect Quantity",
    en: "Defect Quantity Difference",
    zh: "缺陷数量差额",
  },
  /** Keterangan kecil di bawah kartu: angka itu hasil pengurangan apa. */
  "report.selisihQtyDesc": {
    id: "Hanya baris minus: Replacement − Qty Defect",
    en: "Negative rows only: Replacement − Defect Qty",
    zh: "仅负数行：更换数量 − 缺陷数量",
  },
  "report.selisihValue": {
    id: "Selisih Defect Value",
    en: "Defect Value Difference",
    zh: "缺陷金额差额",
  },
  "report.selisihValueDesc": {
    id: "Hanya baris minus: Nilai Replacement − Nilai Defect",
    en: "Negative rows only: Replacement Value − Defect Value",
    zh: "仅负数行：更换金额 − 缺陷金额",
  },
  "report.replacementValue": {
    id: "Nilai Replacement",
    en: "Replacement Value",
    zh: "更换金额",
  },
  "report.replacementValueDesc": {
    id: "Value: qty × harga master",
    en: "Value: qty × master price",
    zh: "金额：数量 × 主价格",
  },
  "report.detailTitle": {
    id: "Detail Defect — {product}",
    en: "Defect Detail — {product}",
    zh: "缺陷详情 — {product}",
  },
  "report.detailDesc": {
    id: "{count} data defect pada periode & filter yang aktif.",
    en: "{count} defect records in the active period & filter.",
    zh: "当前期间和筛选条件下的 {count} 条缺陷记录。",
  },
  "report.totalQtyDefect": {
    id: "Total Qty Defect",
    en: "Total Defect Qty",
    zh: "缺陷总数量",
  },
  "report.totalValueDefect": {
    id: "Total Value Defect",
    en: "Total Defect Value",
    zh: "缺陷总金额",
  },
  "report.noDefectData": {
    id: "Tidak ada data defect.",
    en: "No defect data.",
    zh: "暂无缺陷数据。",
  },
  "report.defect": { id: "Defect", en: "Defect", zh: "缺陷" },
  "report.sales": { id: "Sales", en: "Sales", zh: "销售" },

  // PO Product
  "po.title": { id: "PO Product", en: "PO Product", zh: "采购订单" },
  "po.description": {
    id: "Catat purchase order per produk dan pabrik.",
    en: "Record purchase orders per product and factory.",
    zh: "按产品和工厂记录采购订单。",
  },
  "po.addTitle": {
    id: "Tambah PO Product",
    en: "Add PO Product",
    zh: "添加采购订单",
  },
  "po.editTitle": {
    id: "Ubah PO Product",
    en: "Edit PO Product",
    zh: "编辑采购订单",
  },
  "po.formHint": {
    id: "Total dihitung otomatis dari Price/pcs × Quantity.",
    en: "Total is calculated automatically from Price/pcs × Quantity.",
    zh: "总额由单价 × 数量自动计算。",
  },
  "po.poNumber": { id: "PO Number", en: "PO Number", zh: "采购单号" },
  "po.timestamp": {
    id: "Timestamp",
    en: "Timestamp",
    zh: "时间",
  },
  "po.month": { id: "Bulan", en: "Month", zh: "月份" },
  "po.year": { id: "Tahun", en: "Year", zh: "年份" },
  "po.allMonths": {
    id: "Semua Bulan",
    en: "All Months",
    zh: "所有月份",
  },
  "po.allYears": {
    id: "Semua Tahun",
    en: "All Years",
    zh: "所有年份",
  },
  "po.poNumberPlaceholder": {
    id: "Mis. PO-2026-001",
    en: "E.g. PO-2026-001",
    zh: "例如 PO-2026-001",
  },
  "po.skuProduct": {
    id: "SKU Product",
    en: "Product SKU",
    zh: "产品 SKU",
  },
  "po.product": { id: "Product", en: "Product", zh: "产品" },
  "po.selectProduct": {
    id: "Pilih produk",
    en: "Select product",
    zh: "选择产品",
  },
  "po.productName": {
    id: "Nama Produk",
    en: "Product Name",
    zh: "产品名称",
  },
  "po.productPlaceholder": {
    id: "Terisi dari SKU",
    en: "Filled from SKU",
    zh: "由 SKU 自动填充",
  },
  "po.pricePerPcs": {
    id: "Price/pcs",
    en: "Price/pcs",
    zh: "单价",
  },
  "po.currency": { id: "Currency", en: "Currency", zh: "币种" },
  "po.ppn": { id: "PPN", en: "VAT", zh: "增值税" },
  "po.priceRw": {
    id: "Harga",
    en: "Price",
    zh: "价格",
  },
  "po.priceType": {
    id: "Jenis Harga",
    en: "Price Type",
    zh: "价格类型",
  },
  "po.valueRw": {
    id: "Value",
    en: "Value",
    zh: "金额",
  },
  "po.selectPrice": {
    id: "Pilih harga (bulan/tahun)",
    en: "Select price (month/year)",
    zh: "选择价格（月/年）",
  },
  "po.priceMissing": {
    id: "Produk ini belum punya harga untuk jenis ini. Tambahkan dulu di Data Master → Harga Produk.",
    en: "This product has no price for this type yet. Add one in Data Master → Product Prices.",
    zh: "该产品目前没有此类型的价格，请先在数据主档 → 产品价格中添加。",
  },
  "po.valueRwHint": {
    id: "{qty} × {price}",
    en: "{qty} × {price}",
    zh: "{qty} × {price}",
  },
  "price.tab": { id: "Harga Produk", en: "Product Prices", zh: "产品价格" },
  "price.product": { id: "Nama Produk", en: "Product Name", zh: "产品名称" },
  "price.value": { id: "Harga", en: "Price", zh: "价格" },
  "price.type": { id: "Jenis Harga", en: "Price Type", zh: "价格类型" },
  "price.allTypes": {
    id: "Semua jenis harga",
    en: "All price types",
    zh: "所有价格类型",
  },
  "price.month": { id: "Bulan", en: "Month", zh: "月份" },
  "price.year": { id: "Tahun", en: "Year", zh: "年份" },
  "price.saved": {
    id: "Harga tersimpan.",
    en: "Price saved.",
    zh: "价格已保存。",
  },
  "price.deleted": {
    id: "Harga dihapus.",
    en: "Price deleted.",
    zh: "价格已删除。",
  },
  "price.empty": {
    id: "Belum ada harga produk. Tambahkan lewat formulir di atas.",
    en: "No product prices yet. Add one with the form above.",
    zh: "暂无产品价格，请使用上方表单添加。",
  },
  "price.searchPlaceholder": {
    id: "Cari nama produk atau SKU",
    en: "Search product name or SKU",
    zh: "搜索产品名称或 SKU",
  },
  "price.allMonths": { id: "Semua bulan", en: "All months", zh: "所有月份" },
  "price.allYears": { id: "Semua tahun", en: "All years", zh: "所有年份" },
  "price.emptyFiltered": {
    id: "Tidak ada harga yang cocok dengan filter.",
    en: "No prices match the filter.",
    zh: "没有符合筛选条件的价格。",
  },
  "price.carryHint": {
    id: "Menyalin semua harga dari periode sebelum {month} {year} ke periode itu.",
    en: "Copies every price from the period before {month} {year} into that period.",
    zh: "将 {month} {year} 之前的价格全部复制到该期间。",
  },
  "price.carryButton": {
    id: "Salin harga periode sebelumnya",
    en: "Copy previous period prices",
    zh: "复制上一期间价格",
  },
  // Sparepart = child dari produk; harganya global per sparepart per periode.
  "sparePart.tab": { id: "Sparepart", en: "Spare Parts", zh: "备件" },
  "sparePartPrice.tab": {
    id: "Harga Sparepart",
    en: "Spare Part Prices",
    zh: "备件价格",
  },
  "sparePartPrice.empty": {
    id: "Belum ada harga sparepart. Tambahkan lewat formulir di atas.",
    en: "No spare part prices yet. Add one with the form above.",
    zh: "暂无备件价格，请使用上方表单添加。",
  },
  "sparePartPrice.searchPlaceholder": {
    id: "Cari nama sparepart atau SKU",
    en: "Search spare part name or SKU",
    zh: "搜索备件名称或 SKU",
  },
  "sparePartPrice.deleted": {
    id: "Harga sparepart dihapus.",
    en: "Spare part price deleted.",
    zh: "备件价格已删除。",
  },
  "master.newSparePart": {
    id: "Nama sparepart baru",
    en: "New spare part name",
    zh: "新备件名称",
  },
  "master.linkSpareParts": {
    id: "Kaitkan sparepart",
    en: "Link spare parts",
    zh: "关联备件",
  },
  "master.linkSparePartProducts": {
    id: "Lihat produk pemakai",
    en: "See products using it",
    zh: "查看使用产品",
  },
  "productSpareParts.title": {
    id: "Sparepart Produk",
    en: "Product Spare Parts",
    zh: "产品备件",
  },
  "productSpareParts.hint": {
    id: "Sparepart yang dikaitkan di sini adalah child dari produk ini. Satu sparepart boleh dipakai beberapa produk sekaligus, jadi mengaitkan di sini tidak memindahkan sparepart dari produk lain.",
    en: "Spare parts linked here are children of this product. One spare part may serve several products, so linking here never moves it away from another product.",
    zh: "在此关联的备件属于该产品。一个备件可同时用于多个产品，因此在此关联不会将其从其他产品移走。",
  },
  "productSpareParts.search": {
    id: "Cari sparepart atau SKU…",
    en: "Search spare part or SKU…",
    zh: "搜索备件或 SKU…",
  },
  "productSpareParts.none": {
    id: "Belum ada sparepart di master.",
    en: "No spare parts in master yet.",
    zh: "主数据中暂无备件。",
  },
  "productSpareParts.selected": {
    id: "sparepart dipilih",
    en: "spare parts selected",
    zh: "个备件已选择",
  },
  "sparePartProducts.title": {
    id: "Dipakai di produk",
    en: "Used in products",
    zh: "用于产品",
  },
  "sparePartProducts.hint": {
    id: "Satu sparepart boleh dipakai beberapa produk sekaligus. Daftar ini produk yang sedang memakai sparepart ini.",
    en: "One spare part may serve several products at once. This lists the products currently using it.",
    zh: "一个备件可同时用于多个产品。此处列出正在使用该备件的产品。",
  },
  "sparePartProducts.none": {
    id: "Belum dikaitkan ke produk mana pun.",
    en: "Not linked to any product yet.",
    zh: "尚未关联任何产品。",
  },
  "productSpareParts.saved": {
    id: "Kaitan sparepart tersimpan.",
    en: "Spare part links saved.",
    zh: "备件关联已保存。",
  },
  "po.totalValue": {
    id: "Total Value",
    en: "Total Value",
    zh: "总金额",
  },
  "po.totalCurrency": {
    id: "Total Currency",
    en: "Total Currency",
    zh: "总金额（币种）",
  },
  "po.totalHint": {
    id: "{price} × {qty}",
    en: "{price} × {qty}",
    zh: "{price} × {qty}",
  },
  "po.keterangan": {
    id: "Keterangan",
    en: "Remarks",
    zh: "备注",
  },
  "po.allKeterangan": {
    id: "Semua Keterangan",
    en: "All Remarks",
    zh: "所有备注",
  },
  "po.searchPlaceholder": {
    id: "Cari PO, produk, keterangan…",
    en: "Search PO, product, remarks…",
    zh: "搜索单号、产品、备注…",
  },
  "po.totalQuantity": {
    id: "Total Quantity PO",
    en: "Total PO Quantity",
    zh: "采购总数量",
  },
  "po.saveAndAddAnother": {
    id: "Simpan & tambah lagi",
    en: "Save & add another",
    zh: "保存并继续添加",
  },
  "po.savedNext": {
    id: "Tersimpan. Lanjut produk berikutnya.",
    en: "Saved. Ready for the next product.",
    zh: "已保存，可继续录入下一个产品。",
  },
  "po.saveFailed": {
    id: "Gagal menyimpan PO.",
    en: "Failed to save the PO.",
    zh: "保存采购订单失败。",
  },
  "po.deleteFailed": {
    id: "Gagal menghapus PO.",
    en: "Failed to delete the PO.",
    zh: "删除采购订单失败。",
  },
  "po.incomplete": {
    id: "PO Number, produk, dan pabrik wajib diisi.",
    en: "PO Number, product, and factory are required.",
    zh: "采购单号、产品和工厂为必填项。",
  },
  "po.dateRequired": {
    id: "Timestamp PO wajib diisi.",
    en: "PO timestamp is required.",
    zh: "采购时间不能为空。",
  },
  "po.selected": {
    id: "{count} baris dipilih",
    en: "{count} rows selected",
    zh: "已选择 {count} 行",
  },
  "po.selectAll": {
    id: "Pilih semua baris di halaman ini",
    en: "Select all rows on this page",
    zh: "选择本页全部行",
  },
  "po.selectRow": {
    id: "Pilih PO {po}",
    en: "Select PO {po}",
    zh: "选择采购单 {po}",
  },
  "po.importDone": {
    id: "Import selesai: {inserted} masuk, {skipped} dilewati, {failed} gagal.",
    en: "Import finished: {inserted} added, {skipped} skipped, {failed} failed.",
    zh: "导入完成：新增 {inserted}，跳过 {skipped}，失败 {failed}。",
  },
  "po.importFailed": {
    id: "Gagal import PO.",
    en: "Failed to import POs.",
    zh: "导入采购订单失败。",
  },

  // Sales
  "sales.title": { id: "Data Sales", en: "Sales Data", zh: "销售数据" },
  "sales.description": {
    id: "Kelola data penjualan per produk, pabrik, dan bulan.",
    en: "Manage sales data by product, factory, and month.",
    zh: "按产品、工厂和月份管理销售数据。",
  },
  "sales.totalQty": {
    id: "Total Quantity Sales",
    en: "Total Sales Quantity",
    zh: "销售总数量",
  },
  "sales.totalValue": {
    id: "Total Value Sales",
    en: "Total Sales Value",
    zh: "销售总金额",
  },
  "sales.allProducts": {
    id: "Semua Produk",
    en: "All Products",
    zh: "所有产品",
  },
  "sales.searchPlaceholder": {
    id: "Cari produk, pabrik, bulan…",
    en: "Search product, factory, month…",
    zh: "搜索产品、工厂、月份…",
  },
  "sales.addTitle": { id: "Tambah Sales", en: "Add Sales", zh: "添加销售" },
  "sales.editTitle": { id: "Ubah Sales", en: "Edit Sales", zh: "编辑销售" },

  // Defects
  "defects.title": { id: "Data Defect", en: "Defect Data", zh: "缺陷数据" },
  "defects.description": {
    id: "Kelola data produk cacat per pabrik.",
    en: "Manage defective product data per factory.",
    zh: "按工厂管理缺陷产品数据。",
  },
  "defects.totalQty": {
    id: "Total Quantity Defect",
    en: "Total Defect Quantity",
    zh: "缺陷总数量",
  },
  "defects.totalValue": {
    id: "Total Value Defect",
    en: "Total Defect Value",
    zh: "缺陷总金额",
  },
  "defects.allProducts": {
    id: "Semua Produk",
    en: "All Products",
    zh: "所有产品",
  },
  "defects.allProblems": {
    id: "Semua Problem",
    en: "All Problems",
    zh: "所有问题",
  },
  "defects.allStatuses": {
    id: "Semua Status",
    en: "All Statuses",
    zh: "所有状态",
  },
  "defects.searchPlaceholder": {
    id: "Cari code, problem, produk…",
    en: "Search code, problem, product…",
    zh: "搜索编号、问题、产品…",
  },
  "defects.addTitle": {
    id: "Tambah Data Defect",
    en: "Add Defect Data",
    zh: "添加缺陷数据",
  },
  "defects.editTitle": {
    id: "Ubah Data Defect",
    en: "Edit Defect Data",
    zh: "编辑缺陷数据",
  },
  "defects.photoLink": { id: "Link Foto", en: "Photo Link", zh: "照片链接" },
  "defects.videoLink": { id: "Link Video", en: "Video Link", zh: "视频链接" },
  "defects.problemDetail": {
    id: "Problem Detail",
    en: "Problem Detail",
    zh: "问题详情",
  },
  "defects.problemDetailPlaceholder": {
    id: "Penjelasan detail problem",
    en: "Detailed problem description",
    zh: "问题详细说明",
  },
  "defects.detailTitle": {
    id: "Detail Defect",
    en: "Defect Detail",
    zh: "缺陷详情",
  },
  "defects.saveAndAddAnother": {
    id: "Simpan & tambah lagi",
    en: "Save & add another",
    zh: "保存并继续添加",
  },
  "defects.carryOverHint": {
    id: "Produk, Pabrik, dan Status dibawa dari entri sebelumnya.",
    en: "Product, Factory, and Status carry over from the previous entry.",
    zh: "产品、工厂和状态将沿用上一条记录。",
  },
  "defects.codeHint": {
    id: "Saran kode berikutnya untuk {factory} — tekan untuk memakai.",
    en: "Suggested next code for {factory} — press to use it.",
    zh: "{factory} 的下一个建议编号 — 点击即可使用。",
  },
  "defects.codeNoSuggestion": {
    id: "Isi kode garansi, contoh: {sample}",
    en: "Enter the warranty code, e.g. {sample}",
    zh: "请输入保修编号，例如：{sample}",
  },
  "defects.useSuggested": {
    id: "Pakai kode {code}",
    en: "Use code {code}",
    zh: "使用编号 {code}",
  },
  "defects.unsavedTitle": {
    id: "Isian belum tersimpan",
    en: "Unsaved entry",
    zh: "尚未保存",
  },
  "defects.unsavedBody": {
    id: "Ada isian yang belum disimpan. Menutup sekarang akan menghilangkannya.",
    en: "This entry has unsaved changes. Closing now will discard them.",
    zh: "有未保存的内容，关闭后将丢失。",
  },
  "defects.unsavedKeepEditing": {
    id: "Lanjut mengisi",
    en: "Keep editing",
    zh: "继续编辑",
  },
  "defects.unsavedDiscard": {
    id: "Buang & tutup",
    en: "Discard & close",
    zh: "放弃并关闭",
  },
  "defects.shortcutHint": {
    id: "Ctrl+Enter untuk menyimpan",
    en: "Ctrl+Enter to save",
    zh: "按 Ctrl+Enter 保存",
  },
  "gsheet.button": {
    id: "Sync Google Sheet",
    en: "Sync Google Sheet",
    zh: "同步 Google Sheet",
  },
  "gsheet.title": {
    id: "Sync dari Google Sheet",
    en: "Sync from Google Sheet",
    zh: "从 Google Sheet 同步",
  },
  "gsheet.description": {
    id: "Tab {tab} — satu arah: sheet → aplikasi. Sheet dibaca {sheetRows} baris, aplikasi {appRows} baris.",
    en: "Tab {tab} — one way: sheet → app. Sheet has {sheetRows} rows, app has {appRows} rows.",
    zh: "工作表 {tab} — 单向：表格 → 应用。表格 {sheetRows} 行，应用 {appRows} 行。",
  },
  "gsheet.statFromSheet": {
    id: "Masuk ke app",
    en: "Applied to app",
    zh: "已应用到应用",
  },
  "gsheet.statFromSheetHint": {
    id: "{rows} baris diperbarui dari sheet",
    en: "{rows} rows updated from sheet",
    zh: "{rows} 行已从表格更新",
  },
  "gsheet.statInserted": {
    id: "Baris baru",
    en: "New rows",
    zh: "新增行",
  },
  "gsheet.statInsertedHint": {
    id: "ada di sheet, belum ada di app",
    en: "in sheet but not in app",
    zh: "表格有、应用没有",
  },
  "gsheet.statConflicts": {
    id: "Konflik",
    en: "Conflicts",
    zh: "冲突",
  },
  "gsheet.statConflictsHint": {
    id: "{resolved} field sudah diputuskan",
    en: "{resolved} fields already decided",
    zh: "已决定 {resolved} 个字段",
  },
  "gsheet.statOnlyApp": {
    id: "Hanya di app",
    en: "App only",
    zh: "仅在应用",
  },
  "gsheet.statOnlyAppHint": {
    id: "{fields} field beda, tidak dikirim ke sheet",
    en: "{fields} fields differ, not sent to sheet",
    zh: "{fields} 个字段不同，不会写回表格",
  },
  "gsheet.readOnly": {
    id: "Sheet hanya dibaca (kolomnya formula)",
    en: "Sheet is read-only (its columns are formulas)",
    zh: "表格只读（列为公式）",
  },
  "gsheet.skippedBadge": {
    id: "{count} baris dilewati",
    en: "{count} rows skipped",
    zh: "{count} 行已跳过",
  },
  "gsheet.noConflict": {
    id: "Tidak ada konflik — semua perubahan dari sheet sudah masuk.",
    en: "No conflicts — every sheet change has been applied.",
    zh: "没有冲突 — 表格的更改都已应用。",
  },
  "gsheet.conflictTitle": {
    id: "{count} field bentrok",
    en: "{count} conflicting fields",
    zh: "{count} 个冲突字段",
  },
  "gsheet.conflictHint": {
    id: "Pilih data yang benar untuk tiap field.",
    en: "Pick the correct value for each field.",
    zh: "为每个字段选择正确的值。",
  },
  "gsheet.allSheet": {
    id: "Semua dari Sheet",
    en: "All from Sheet",
    zh: "全部用表格",
  },
  "gsheet.allApp": {
    id: "Semua dari App",
    en: "All from App",
    zh: "全部用应用",
  },
  "gsheet.truncated": {
    id: "Menampilkan {shown} dari {total} field yang bentrok. Sisanya bisa diputuskan sekaligus lewat tombol Semua dari Sheet / Semua dari App.",
    en: "Showing {shown} of {total} conflicting fields. Decide the rest with All from Sheet / All from App.",
    zh: "显示 {shown} / {total} 个冲突字段。其余可用“全部用表格/全部用应用”一次决定。",
  },
  "gsheet.sheetRow": {
    id: "baris sheet {row}",
    en: "sheet row {row}",
    zh: "表格第 {row} 行",
  },
  "gsheet.columnField": {
    id: "Field",
    en: "Field",
    zh: "字段",
  },
  "gsheet.columnSheet": {
    id: "Google Sheet",
    en: "Google Sheet",
    zh: "Google 表格",
  },
  "gsheet.columnApp": {
    id: "Aplikasi",
    en: "App",
    zh: "应用",
  },
  "gsheet.columnPick": {
    id: "Pakai",
    en: "Use",
    zh: "采用",
  },
  "gsheet.pickSheet": {
    id: "Sheet",
    en: "Sheet",
    zh: "表格",
  },
  "gsheet.pickApp": {
    id: "App",
    en: "App",
    zh: "应用",
  },
  "gsheet.issueTitle": {
    id: "{count} catatan",
    en: "{count} notes",
    zh: "{count} 条说明",
  },
  "gsheet.apply": {
    id: "Terapkan pilihan",
    en: "Apply choices",
    zh: "应用选择",
  },
  "gsheet.running": {
    id: "Menyinkronkan dengan Google Sheet…",
    en: "Syncing with Google Sheet…",
    zh: "正在与 Google Sheet 同步…",
  },
  "gsheet.done": {
    id: "Sync selesai: {fields} field dari sheet, {inserted} baris baru, {conflicts} konflik.",
    en: "Sync done: {fields} fields from sheet, {inserted} new rows, {conflicts} conflicts.",
    zh: "同步完成：来自表格 {fields} 个字段，新增 {inserted} 行，冲突 {conflicts} 个。",
  },
  "gsheet.failed": {
    id: "Sync Google Sheet gagal.",
    en: "Google Sheet sync failed.",
    zh: "Google Sheet 同步失败。",
  },
  "gsheet.zeroSkipped": {
    id: "{count} bulan bernilai 0 dilewati",
    en: "{count} zero months skipped",
    zh: "跳过 {count} 个为 0 的月份",
  },
  "gsheet.salesTitle": {
    id: "Sync dari Google Sheet (Data Penjualan)",
    en: "Sync from Google Sheet (Sales)",
    zh: "从 Google Sheet 同步（销售数据）",
  },
  "gsheet.salesDescription": {
    id: "Tab {tab} — satu arah: sheet → aplikasi. Acuan produk: kolom Official Name. Sheet {sheetRows} baris produk, aplikasi {appRows} baris sales.",
    en: "Tab {tab} — one way: sheet → app. Products matched by the Official Name column. Sheet has {sheetRows} product rows, app has {appRows} sales rows.",
    zh: "工作表 {tab} — 单向：表格 → 应用。产品以 Official Name 列为准。表格 {sheetRows} 个产品行，应用 {appRows} 行销售数据。",
  },
  "defects.savedNext": {
    id: "Tersimpan. Lanjut entri berikutnya.",
    en: "Saved. Ready for the next entry.",
    zh: "已保存，可继续录入下一条。",
  },

  // Master
  "master.title": { id: "Data Master", en: "Master Data", zh: "主数据" },
  "master.description": {
    id: "Kelola daftar produk, problem, harga produk, dan status.",
    en: "Manage product, problem, product price, and status lists.",
    zh: "管理产品、问题、产品价格和状态列表。",
  },
  "master.newProduct": {
    id: "Nama produk baru",
    en: "New product name",
    zh: "新产品名称",
  },
  "master.newProblem": {
    id: "Nama problem baru",
    en: "New problem name",
    zh: "新问题名称",
  },
  "master.newStatus": {    id: "Nama status baru",
    en: "New status name",
    zh: "新状态名称",
  },

  // MasterList
  "masterList.newName": { id: "Nama baru", en: "New name", zh: "新名称" },
  "masterList.skuPlaceholder": {
    id: "SKU (opsional)",
    en: "SKU (optional)",
    zh: "SKU（可选）",
  },
  "masterList.skuEmpty": {
    id: "Tanpa SKU",
    en: "No SKU",
    zh: "无 SKU",
  },
  "masterList.empty": {
    id: "Belum ada data.",
    en: "No data yet.",
    zh: "暂无数据。",
  },
  "masterList.searchName": { id: "Cari nama", en: "Search name", zh: "搜索名称" },
  "masterList.searchNameSku": {
    id: "Cari nama atau SKU",
    en: "Search name or SKU",
    zh: "搜索名称或 SKU",
  },
  "masterList.emptyFiltered": {
    id: "Tidak ada yang cocok dengan pencarian.",
    en: "Nothing matches your search.",
    zh: "没有匹配的搜索结果。",
  },

  // Users
  "users.title": {
    id: "User Management",
    en: "User Management",
    zh: "用户管理",
  },
  "users.description": {
    id: "Kelola akun user dan daftar pabrik.",
    en: "Manage user accounts and factory list.",
    zh: "管理用户账户和工厂列表。",
  },
  "users.tabAccounts": {
    id: "Akun User",
    en: "User Accounts",
    zh: "用户账户",
  },
  "users.tabFactories": {
    id: "Daftar Pabrik",
    en: "Factory List",
    zh: "工厂列表",
  },
  "users.addUser": { id: "Tambah User", en: "Add User", zh: "添加用户" },
  "users.editUser": { id: "Ubah User", en: "Edit User", zh: "编辑用户" },
  "users.passwordHint": {
    id: "Password (kosongkan jika tidak diubah)",
    en: "Password (leave blank to keep unchanged)",
    zh: "密码（留空则不修改）",
  },
  "users.newFactory": {
    id: "Nama pabrik baru",
    en: "New factory name",
    zh: "新工厂名称",
  },
  "users.linkProducts": {
    id: "Kaitkan produk",
    en: "Link products",
    zh: "关联产品",
  },

  // Kaitan produk per pabrik (auto-isi kolom Pabrik di form)
  "factoryProducts.title": {
    id: "Produk Pabrik",
    en: "Factory Products",
    zh: "工厂产品",
  },
  "factoryProducts.hint": {
    id: "Produk yang dikaitkan di sini otomatis mengisi kolom Pabrik saat produk itu dipilih di form Defect, PO, atau Sales.",
    en: "Products linked here automatically fill the Factory field when the product is picked in the Defect, PO, or Sales form.",
    zh: "在此关联的产品，在缺陷/采购/销售表单中被选中时会自动填入工厂。",
  },
  "factoryProducts.search": {
    id: "Cari produk atau SKU…",
    en: "Search product or SKU…",
    zh: "搜索产品或 SKU…",
  },
  "factoryProducts.selected": {
    id: "produk dipilih",
    en: "products selected",
    zh: "个产品已选择",
  },
  "factoryProducts.otherFactory": {
    id: "sudah di",
    en: "already in",
    zh: "已在",
  },
  "factoryProducts.none": {
    id: "Tidak ada produk yang cocok.",
    en: "No matching product.",
    zh: "没有匹配的产品。",
  },
  "factoryProducts.saved": {
    id: "Kaitan produk tersimpan.",
    en: "Product links saved.",
    zh: "产品关联已保存。",
  },

  // Import result
  "import.title": {
    id: "Hasil Import",
    en: "Import Result",
    zh: "导入结果",
  },
  "import.description": {
    id: "Total {total} baris dibaca dari file.",
    en: "{total} rows read from the file.",
    zh: "从文件读取了 {total} 行。",
  },
  "import.totalRows": { id: "Total Baris", en: "Total Rows", zh: "总行数" },
  "import.inserted": { id: "Masuk", en: "Inserted", zh: "已导入" },
  "import.skipped": { id: "Dilewati", en: "Skipped", zh: "已跳过" },
  "import.errors": { id: "Gagal", en: "Failed", zh: "失败" },
  "import.row": { id: "Baris", en: "Row", zh: "行" },
  "import.key": { id: "Data", en: "Data", zh: "数据" },
  "import.reason": { id: "Alasan", en: "Reason", zh: "原因" },
  "import.errorSection": {
    id: "Baris yang gagal masuk",
    en: "Failed rows",
    zh: "失败的行",
  },
  "import.noErrors": {
    id: "Tidak ada baris yang gagal.",
    en: "No failed rows.",
    zh: "没有失败的行。",
  },
  "import.skippedSection": {
    id: "Baris dilewati (duplikat)",
    en: "Skipped rows (duplicates)",
    zh: "跳过的行（重复）",
  },
  "import.downloadReport": {
    id: "Download laporan (CSV)",
    en: "Download report (CSV)",
    zh: "下载报告 (CSV)",
  },
  "import.serverLogHint": {
    id: "Detail lengkap juga tercatat di log server",
    en: "Full details are also written to the server log",
    zh: "完整详情也会记录在服务器日志中",
  },
  "import.lastResult": {
    id: "Hasil import terakhir",
    en: "Last import result",
    zh: "上次导入结果",
  },

  // Delete all
  "deleteAll.button": {
    id: "Hapus Semua",
    en: "Delete All",
    zh: "全部删除",
  },
  "deleteAll.title": {
    id: "Hapus Semua {label}?",
    en: "Delete all {label}?",
    zh: "删除所有{label}？",
  },
  "deleteAll.warning": {
    id: "Semua data {label} akan dihapus permanen dan tidak bisa dikembalikan.",
    en: "All {label} data will be permanently deleted and cannot be undone.",
    zh: "所有{label}数据将被永久删除，无法恢复。",
  },
  "deleteAll.backupNote": {
    id: "Backup database otomatis dibuat sebelum penghapusan.",
    en: "A database backup is created automatically before deletion.",
    zh: "删除前会自动创建数据库备份。",
  },
  "deleteAll.usersNote": {
    id: "Akun Anda sendiri tidak akan dihapus.",
    en: "Your own account will not be deleted.",
    zh: "您自己的账户不会被删除。",
  },
  "deleteAll.confirm": {
    id: "Ya, Hapus Semua",
    en: "Yes, Delete All",
    zh: "是，全部删除",
  },
  "deleteAll.cancel": { id: "Batal", en: "Cancel", zh: "取消" },
  "deleteAll.success": {
    id: "{count} data berhasil dihapus.",
    en: "{count} records deleted.",
    zh: "已删除 {count} 条数据。",
  },

  // Bulk select
  "bulk.selected": {
    id: "{count} dipilih",
    en: "{count} selected",
    zh: "已选 {count} 项",
  },
  "bulk.edit": { id: "Edit", en: "Edit", zh: "编辑" },
  "bulk.delete": { id: "Hapus", en: "Delete", zh: "删除" },
  "bulk.clear": {
    id: "Batalkan pilihan",
    en: "Clear selection",
    zh: "清除选择",
  },
  "bulk.deleteTitle": {
    id: "Hapus {count} data terpilih?",
    en: "Delete {count} selected items?",
    zh: "删除已选的 {count} 条数据？",
  },
  "bulk.deleteWarning": {
    id: "{count} data yang dipilih akan dihapus permanen dan tidak bisa dikembalikan.",
    en: "The {count} selected items will be permanently deleted and cannot be undone.",
    zh: "已选的 {count} 条数据将被永久删除，无法恢复。",
  },
  // Ticketing
  "ticket.title": { id: "Ticketing Kendala", en: "Issue Ticketing", zh: "问题工单" },
  "ticket.description": {
    id: "Tiket kendala produk: komunikasi CS, Tim Produk, dan Tim Pabrik.",
    en: "Product issue tickets: CS, Product Team, and Factory Team communication.",
    zh: "产品问题工单：客服、产品团队与工厂团队的沟通。",
  },
  "ticket.new": { id: "Tiket Baru", en: "New Ticket", zh: "新建工单" },
  "ticket.preview.banner": { id: "Mode pratinjau.", en: "Preview mode.", zh: "预览模式。" },
  "ticket.preview.note": {
    id: "Data contoh, belum tersimpan ke server. Nama Produk & Pabrik memakai data asli.",
    en: "Sample data, not saved to the server. Product & Factory names come from real data.",
    zh: "示例数据，尚未保存到服务器。产品与工厂名称取自真实数据。",
  },
  "ticket.preview.polling": {
    id: "Menyegarkan otomatis tiap 10 detik",
    en: "Refreshes automatically every 10 seconds",
    zh: "每 10 秒自动刷新",
  },
  "ticket.viewAs": { id: "Lihat sebagai", en: "View as", zh: "以此身份查看" },
  "ticket.team.cs": { id: "CS", en: "CS", zh: "客服" },
  "ticket.team.produk": { id: "Tim Produk", en: "Product Team", zh: "产品团队" },
  "ticket.team.pabrik": { id: "Tim Pabrik", en: "Factory Team", zh: "工厂团队" },
  "ticket.stage.produk": { id: "Ditangani Tim Produk", en: "Handled by Product Team", zh: "产品团队处理中" },
  "ticket.stage.pabrik": { id: "Diteruskan ke Tim Pabrik", en: "Forwarded to Factory Team", zh: "已转交工厂团队" },
  "ticket.stage.pabrikForCs": { id: "Ditangani Tim Produk", en: "Handled by Product Team", zh: "产品团队处理中" },
  "ticket.stage.selesai": { id: "Selesai", en: "Solved", zh: "已解决" },
  "ticket.storage.drive": { id: "Google Drive", en: "Google Drive", zh: "Google Drive" },
  "ticket.storage.server": { id: "Server 30 hari", en: "Server 30 days", zh: "服务器 30 天" },
  "ticket.storage.lokal": { id: "Perangkat ini", en: "This device", zh: "本机" },
  "ticket.summary.total": { id: "Total Tiket", en: "Total Tickets", zh: "工单总数" },
  "ticket.summary.produk": { id: "Ditangani Produk", en: "With Product Team", zh: "产品团队处理中" },
  "ticket.summary.pabrik": { id: "Diteruskan ke Pabrik", en: "Forwarded to Factory", zh: "已转交工厂" },
  "ticket.summary.pabrikForCs": { id: "Ditangani Produk", en: "With Product Team", zh: "产品团队处理中" },
  "ticket.summary.selesai": { id: "Selesai", en: "Solved", zh: "已解决" },
  "ticket.table.code": { id: "Kode", en: "Code", zh: "编号" },
  "ticket.table.title": { id: "Judul", en: "Title", zh: "标题" },
  "ticket.table.stage": { id: "Tahap", en: "Stage", zh: "阶段" },
  "ticket.table.updated": { id: "Diperbarui", en: "Updated", zh: "更新时间" },
  "ticket.table.actions": { id: "Aksi", en: "Actions", zh: "操作" },
  "ticket.searchPlaceholder": {
    id: "Cari kode, judul, virtual ID…",
    en: "Search code, title, virtual ID…",
    zh: "搜索编号、标题、虚拟 ID…",
  },
  "ticket.empty": { id: "Belum ada tiket.", en: "No tickets yet.", zh: "暂无工单。" },
  "ticket.delete": { id: "Hapus", en: "Delete", zh: "删除" },
  "ticket.deleteTitle": { id: "Hapus tiket ini?", en: "Delete this ticket?", zh: "删除此工单？" },
  "ticket.deleteNote": {
    id: "Tiket dan seluruh riwayat komunikasinya akan hilang dari pratinjau.",
    en: "The ticket and its whole conversation will be removed from the preview.",
    zh: "该工单及其全部沟通记录将从预览中移除。",
  },
  "ticket.deleted": { id: "Tiket dihapus.", en: "Ticket deleted.", zh: "工单已删除。" },
  "ticket.created": {
    id: "Tiket dibuat dan lampiran disimpan ke Google Drive.",
    en: "Ticket created and attachments saved to Google Drive.",
    zh: "工单已创建，附件已保存到 Google Drive。",
  },
  "ticket.role.pabrikReadOnly": {
    id: "Akses pabrik — hanya tiket yang diteruskan",
    en: "Factory access — forwarded tickets only",
    zh: "工厂权限 — 仅已转交的工单",
  },
  "ticket.form.title": { id: "Tiket Baru", en: "New Ticket", zh: "新建工单" },
  "ticket.form.subtitle": {
    id: "Tiket diterbitkan CS. Lampiran disimpan ke Google Drive saat tiket dibuat.",
    en: "Tickets are issued by CS. Attachments are saved to Google Drive when the ticket is created.",
    zh: "工单由客服发起。附件在创建工单时保存到 Google Drive。",
  },
  "ticket.form.defaultTitle": { id: "Kendala {name}", en: "Issue with {name}", zh: "{name} 的问题" },
  "ticket.form.factoryHint": {
    id: "Pabrik pembuat produk ini.",
    en: "The factory that produces this product.",
    zh: "生产该产品的工厂。",
  },
  "ticket.form.titleLabel": { id: "Judul", en: "Title", zh: "标题" },
  "ticket.form.titlePlaceholder": { id: "Kendala Unit X", en: "Issue with Unit X", zh: "X 设备的问题" },
  "ticket.form.problemDetail": { id: "Penjelasan Kendala", en: "Problem Description", zh: "问题说明" },
  "ticket.form.problemPlaceholder": {
    id: "Gejala yang dilaporkan customer…",
    en: "Symptoms reported by the customer…",
    zh: "客户反馈的现象…",
  },
  "ticket.form.chronology": { id: "Kronologi", en: "Chronology", zh: "问题经过" },
  "ticket.form.chronologyPlaceholder": {
    id: "Kapan mulai terjadi, urutan kejadian…",
    en: "When it started, sequence of events…",
    zh: "开始时间与经过顺序…",
  },
  "ticket.form.triedSolutions": { id: "Solusi yang Sudah Dicoba", en: "Solutions Already Tried", zh: "已尝试的解决方案" },
  "ticket.form.solutionsPlaceholder": {
    id: "Langkah yang sudah dicoba CS…",
    en: "Steps already tried by CS…",
    zh: "客服已尝试的步骤…",
  },
  "ticket.form.attachments": { id: "Foto / Video Kendala", en: "Issue Photos / Videos", zh: "问题照片/视频" },
  "ticket.form.attach": { id: "Tambah Berkas", en: "Add Files", zh: "添加文件" },
  "ticket.form.attachHint": {
    id: "Bisa banyak berkas. Pratinjau: belum diunggah ke Drive.",
    en: "Multiple files allowed. Preview: not uploaded to Drive yet.",
    zh: "可上传多个文件。预览：尚未上传到 Drive。",
  },
  "ticket.form.submit": { id: "Terbitkan Tiket", en: "Create Ticket", zh: "创建工单" },
  "ticket.form.required": {
    id: "Produk, Virtual ID, dan Penjelasan Kendala wajib diisi.",
    en: "Product, Virtual ID, and Problem Description are required.",
    zh: "产品、虚拟 ID 与问题说明为必填项。",
  },
  "ticket.attachments.empty": { id: "Belum ada lampiran.", en: "No attachments yet.", zh: "暂无附件。" },
  "ticket.attachments.preview": { id: "Pratinjau", en: "Preview", zh: "预览" },
  "ticket.attachments.noPreview": { id: "Contoh", en: "Sample", zh: "示例" },
  "ticket.attachments.localPreview": {
    id: "Pratinjau lokal dari berkas yang baru dipilih (belum diunggah).",
    en: "Local preview of the newly picked file (not uploaded).",
    zh: "新选择文件的本地预览（尚未上传）。",
  },
  "ticket.detail.back": { id: "Daftar Tiket", en: "Ticket List", zh: "工单列表" },
  "ticket.detail.notFound": {
    id: "Tiket tidak ditemukan pada pratinjau ini.",
    en: "Ticket not found in this preview.",
    zh: "在此预览中未找到该工单。",
  },
  "ticket.detail.createdAt": { id: "Dibuat", en: "Created", zh: "创建时间" },
  "ticket.detail.escalatedAt": { id: "Diteruskan", en: "Forwarded", zh: "转交时间" },
  "ticket.detail.solvedAt": { id: "Selesai", en: "Solved", zh: "解决时间" },
  "ticket.detail.problemDetail": { id: "Penjelasan Kendala", en: "Problem Description", zh: "问题说明" },
  "ticket.detail.chronology": { id: "Kronologi", en: "Chronology", zh: "问题经过" },
  "ticket.detail.triedSolutions": { id: "Solusi yang Sudah Dicoba", en: "Solutions Already Tried", zh: "已尝试的解决方案" },
  "ticket.detail.chat": { id: "Komunikasi Tim", en: "Team Conversation", zh: "团队沟通" },
  "ticket.room.cs": { id: "CS ↔ Tim Produk", en: "CS ↔ Product Team", zh: "客服 ↔ 产品团队" },
  "ticket.room.csHint": {
    id: "Ruang antara CS dan Tim Produk. Tim Pabrik tidak melihat ruang ini.",
    en: "Room between CS and the Product Team. The Factory Team cannot see this room.",
    zh: "客服与产品团队之间的对话。工厂团队看不到此对话。",
  },
  "ticket.room.pabrik": { id: "Tim Produk ↔ Tim Pabrik", en: "Product Team ↔ Factory Team", zh: "产品团队 ↔ 工厂团队" },
  "ticket.room.pabrikHint": {
    id: "Ruang antara Tim Produk dan Tim Pabrik. Kalau pabrik minta sesuatu, Tim Produk meneruskannya ke CS lewat ruang atas.",
    en: "Room between the Product Team and the Factory Team. If the factory asks for something, the Product Team relays it to CS in the room above.",
    zh: "产品团队与工厂团队之间的对话。若工厂有要求，产品团队会在上方对话中转达客服。",
  },
  "ticket.detail.attachments": { id: "Lampiran", en: "Attachments", zh: "附件" },
  "ticket.detail.attachmentRule": {
    id: "Tiket baru disimpan ke Google Drive. Saat diteruskan ke pabrik, berkas disalin ke server BARDI dan dihapus 30 hari setelah tiket selesai.",
    en: "A new ticket is stored on Google Drive. When it is forwarded to the factory, files are copied to the BARDI server and removed 30 days after the ticket is solved.",
    zh: "新工单保存在 Google Drive。转交工厂时文件会复制到 BARDI 服务器，并在工单解决 30 天后删除。",
  },
  "ticket.detail.relatedDefects": { id: "Data Defect Terkait", en: "Related Defect Data", zh: "关联缺陷数据" },
  "ticket.detail.noDefects": {
    id: "Belum ada data defect terkait.",
    en: "No related defect data yet.",
    zh: "暂无关联缺陷数据。",
  },
  "ticket.detail.csLocked": {
    id: "Percakapan dengan Tim Pabrik hanya terlihat oleh Tim Produk. Anda tetap bisa memantau status tiket ini.",
    en: "The conversation with the Factory Team is visible to the Product Team only. You can still monitor this ticket's status.",
    zh: "与工厂团队的对话仅产品团队可见。您仍可查看该工单状态。",
  },
  "ticket.detail.actions": { id: "Tindakan", en: "Actions", zh: "操作" },
  "ticket.detail.actionHint": {
    id: "Eskalasi ke Tim Pabrik hanya bisa dilakukan Tim Produk.",
    en: "Only the Product Team can escalate to the Factory Team.",
    zh: "仅产品团队可升级到工厂团队。",
  },
  "ticket.chat.placeholder": { id: "Tulis pesan untuk tim lain…", en: "Write a message to the other team…", zh: "给其他团队留言…" },
  "ticket.chat.send": { id: "Kirim", en: "Send", zh: "发送" },
  "ticket.chat.attach": { id: "Lampiran", en: "Attachment", zh: "附件" },
  "ticket.chat.attached": {
    id: "Lampiran ditambahkan ke percakapan.",
    en: "Attachment added to the conversation.",
    zh: "附件已添加到对话。",
  },
  "ticket.chat.reply": { id: "Balas", en: "Reply", zh: "回复" },
  "ticket.chat.edit": { id: "Ubah", en: "Edit", zh: "编辑" },
  "ticket.chat.edited": { id: "diedit", en: "edited", zh: "已编辑" },
  "ticket.chat.replying": { id: "Membalas pesan", en: "Replying to message", zh: "正在回复消息" },
  "ticket.chat.replyCancel": { id: "Batal balas", en: "Cancel reply", zh: "取消回复" },
  "ticket.chat.editedToast": { id: "Pesan diubah.", en: "Message edited.", zh: "消息已编辑。" },
  "ticket.chat.window": {
    id: "Menampilkan {shown} dari {total} pesan terakhir.",
    en: "Showing {shown} of {total} latest messages.",
    zh: "显示最近 {total} 条消息中的 {shown} 条。",
  },
  "ticket.chat.loadMore": { id: "Muat 10 pesan sebelumnya", en: "Load 10 earlier messages", zh: "加载更早的 10 条消息" },
  "ticket.chat.loadRest": { id: "Muat semua pesan", en: "Load all messages", zh: "加载全部消息" },
  "ticket.forward.action": { id: "Teruskan lampiran CS", en: "Forward CS attachments", zh: "转发客服附件" },
  "ticket.forward.title": { id: "Teruskan Lampiran ke Tim Pabrik", en: "Forward Attachments to Factory Team", zh: "转发附件给工厂团队" },
  "ticket.forward.description": {
    id: "Pilih lampiran dari ruang CS ↔ Tim Produk yang ingin diteruskan ke ruang Tim Produk ↔ Tim Pabrik.",
    en: "Pick attachments from the CS ↔ Product Team room to forward to the Product Team ↔ Factory Team room.",
    zh: "从客服 ↔ 产品团队对话中选择要转发到产品团队 ↔ 工厂团队对话的附件。",
  },
  "ticket.forward.empty": {
    id: "Tidak ada lampiran CS yang bisa diteruskan.",
    en: "No CS attachments available to forward.",
    zh: "没有可转发的客服附件。",
  },
  "ticket.forward.confirm": { id: "Teruskan", en: "Forward", zh: "转发" },
  "ticket.forward.badge": { id: "Diteruskan", en: "Forwarded", zh: "已转发" },
  "ticket.forward.done": { id: "{count} lampiran diteruskan ke ruang pabrik.", en: "{count} attachments forwarded to the factory room.", zh: "已转发 {count} 个附件到工厂对话。" },
  "ticket.forward.actionToCs": { id: "Teruskan lampiran pabrik ke CS", en: "Forward factory attachments to CS", zh: "转发工厂附件给客服" },
  "ticket.forward.titleToCs": { id: "Teruskan Lampiran ke CS", en: "Forward Attachments to CS", zh: "转发附件给客服" },
  "ticket.forward.descriptionToCs": {
    id: "Lampiran dari Tim Pabrik disalin ke ruang CS ↔ Tim Produk supaya CS bisa membacanya.",
    en: "Attachments from the Factory Team are copied into the CS ↔ Product Team room so CS can read them.",
    zh: "工厂团队的附件将复制到客服 ↔ 产品团队对话，方便客服查看。",
  },
  "ticket.forward.doneToCs": { id: "{count} lampiran diteruskan ke ruang CS.", en: "{count} attachments forwarded to the CS room.", zh: "已转发 {count} 个附件到客服对话。" },
  "ticket.list.unread": { id: "Ada pembaruan", en: "New updates", zh: "有新更新" },
  "ticket.action.escalate": { id: "Teruskan ke Tim Pabrik", en: "Forward to Factory Team", zh: "转交工厂团队" },
  "ticket.action.solve": { id: "Tandai Selesai", en: "Mark as Solved", zh: "标记为已解决" },
  "ticket.action.reopen": { id: "Buka Lagi", en: "Reopen", zh: "重新打开" },
  "ticket.escalate.title": { id: "Teruskan ke Tim Pabrik", en: "Forward to Factory Team", zh: "转交工厂团队" },
  "ticket.escalate.description": {
    id: "Lampiran tiket akan disalin ke server BARDI dan dikirim ke Tim Pabrik.",
    en: "Ticket attachments will be copied to the BARDI server and sent to the Factory Team.",
    zh: "工单附件将复制到 BARDI 服务器并发送给工厂团队。",
  },
  "ticket.escalate.factory": { id: "Pabrik Tujuan", en: "Target Factory", zh: "目标工厂" },
  "ticket.escalate.note": { id: "Catatan untuk Tim Pabrik", en: "Note for the Factory Team", zh: "给工厂团队的说明" },
  "ticket.escalate.notePlaceholder": {
    id: "Hasil pemeriksaan Tim Produk…",
    en: "Product Team findings…",
    zh: "产品团队的检查结果…",
  },
  "ticket.escalate.defects": { id: "Kaitkan Data Defect", en: "Link Defect Data", zh: "关联缺陷数据" },
  "ticket.escalate.attachments": { id: "Lampiran CS yang ikut diteruskan", en: "CS attachments to forward", zh: "一并转发的客服附件" },
  "ticket.escalate.attachmentsHint": {
    id: "Pilih lampiran dari ruang CS ↔ Tim Produk yang perlu dilihat Tim Pabrik (opsional).",
    en: "Pick attachments from the CS ↔ Product Team room that the Factory Team should see (optional).",
    zh: "选择需要工厂团队查看的客服 ↔ 产品团队附件（可选）。",
  },
  "ticket.escalate.attachmentsEmpty": {
    id: "Belum ada lampiran dari CS yang bisa diteruskan.",
    en: "No CS attachments available to forward yet.",
    zh: "暂无可转发的客服附件。",
  },
  "ticket.escalate.defectsHint": {
    id: "Pilih baris Data Defect sebagai informasi tambahan untuk pabrik.",
    en: "Pick Defect Data rows as extra information for the factory.",
    zh: "选择缺陷数据行作为给工厂的补充信息。",
  },
  "ticket.escalate.fileNotice": {
    id: "Berkas dari Google Drive disalin ke server BARDI saat diteruskan, lalu dihapus 30 hari setelah tiket selesai.",
    en: "Files from Google Drive are copied to the BARDI server on forwarding, then removed 30 days after the ticket is solved.",
    zh: "转交时文件会从 Google Drive 复制到 BARDI 服务器，并在工单解决 30 天后删除。",
  },
  "ticket.escalate.confirm": { id: "Teruskan", en: "Forward", zh: "转交" },
  "ticket.escalate.required": {
    id: "Isi catatan atau pilih minimal satu data defect.",
    en: "Write a note or pick at least one defect row.",
    zh: "请填写说明或至少选择一条缺陷数据。",
  },
  "ticket.escalated": {
    id: "Tiket diteruskan ke Tim Pabrik dan lampiran disalin ke server.",
    en: "Ticket forwarded to the Factory Team and attachments copied to the server.",
    zh: "工单已转交工厂团队，附件已复制到服务器。",
  },
  "ticket.solve.title": { id: "Tandai tiket selesai?", en: "Mark this ticket as solved?", zh: "将此工单标记为已解决？" },
  "ticket.solve.description": {
    id: "Tiket ditutup dan tidak bisa dikomentari lagi sampai dibuka kembali.",
    en: "The ticket closes and cannot be commented on until it is reopened.",
    zh: "工单将关闭，重新打开前无法继续评论。",
  },
  "ticket.solve.confirm": { id: "Tandai Selesai", en: "Mark as Solved", zh: "标记为已解决" },
  "ticket.solved": { id: "Tiket ditandai selesai.", en: "Ticket marked as solved.", zh: "工单已标记为已解决。" },
  "ticket.reopen.title": { id: "Buka lagi tiket ini?", en: "Reopen this ticket?", zh: "重新打开此工单？" },
  "ticket.reopen.description": {
    id: "Tiket kembali ke Tim Produk untuk ditindaklanjuti.",
    en: "The ticket goes back to the Product Team for follow-up.",
    zh: "工单将回到产品团队继续处理。",
  },
  "ticket.reopen.confirm": { id: "Buka Lagi", en: "Reopen", zh: "重新打开" },
  "ticket.reopened": { id: "Tiket dibuka kembali.", en: "Ticket reopened.", zh: "工单已重新打开。" },
  "ticket.picker.selected": { id: "Data defect terpilih", en: "Selected defect rows", zh: "已选缺陷数据" },
  "ticket.picker.needProduct": { id: "Pilih produk dulu.", en: "Pick a product first.", zh: "请先选择产品。" },
  "ticket.defect.search": { id: "Cari Defect", en: "Search Defect", zh: "搜索缺陷" },
  "ticket.defect.searchPlaceholder": {
    id: "Kode garansi, masalah, produk…",
    en: "Warranty code, problem, product…",
    zh: "保修编号、问题、产品…",
  },
  "ticket.defect.empty": {
    id: "Tidak ada defect untuk produk ini.",
    en: "No defects for this product.",
    zh: "该产品暂无缺陷数据。",
  },
  "ticket.translate.action": { id: "Terjemahkan", en: "Translate", zh: "翻译" },
  "ticket.translate.original": { id: "Lihat asli", en: "Show original", zh: "查看原文" },
  "ticket.translate.notice": {
    id: "Terjemahan contoh — Fase 2 memakai penerjemah server BARDI.",
    en: "Sample translation — Phase 2 uses the BARDI server translator.",
    zh: "示例翻译 — 第二阶段使用 BARDI 服务器翻译。",
  },
  "ticket.translate.cardNotice": {
    id: "Judul, penjelasan kendala, kronologi, dan solusi yang sudah dicoba ditampilkan dalam bahasa terjemahan contoh.",
    en: "Title, problem description, chronology, and tried solutions are shown in sample translation.",
    zh: "标题、问题说明、时间线和已尝试的解决方案均以示例翻译显示。",
  },
  "ticket.translate.sampleOnly": {
    id: "(contoh) teks terjemahan belum tersedia untuk pesan ini.",
    en: "(sample) translation text is not available for this message yet.",
    zh: "（示例）该消息暂无翻译文本。",
  },
} as const;

export type TranslationKey = keyof typeof translations;

const STORAGE_KEY = "defect-sales-language";

let currentLanguage: Language = "id";
const listeners = new Set<() => void>();

function readStorage(): Language {
  if (typeof window === "undefined") return "id";
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "en" || raw === "zh" || raw === "id" ? raw : "id";
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Language {
  return currentLanguage;
}

function getServerSnapshot(): Language {
  return "id";
}

if (typeof window !== "undefined") {
  currentLanguage = readStorage();
  document.documentElement.lang = currentLanguage;
}

export function setLanguage(language: Language) {
  currentLanguage = language;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }
  emit();
}

export function useLanguage() {
  const language = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const entry = translations[key];
      let text: string = entry ? entry[language] : key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(
            new RegExp(`\\{${name}\\}`, "g"),
            String(value)
          );
        }
      }
      return text;
    },
    [language]
  );

  return { language, setLanguage, t };
}
