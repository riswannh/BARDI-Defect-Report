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
  "report.ratioDesc": {
    id: "Qty Defect ÷ Qty Sales",
    en: "Defect Qty ÷ Sales Qty",
    zh: "缺陷数量 ÷ 销售数量",
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

  // Master
  "master.title": { id: "Data Master", en: "Master Data", zh: "主数据" },
  "master.description": {
    id: "Kelola daftar produk, problem, dan status.",
    en: "Manage product, problem, and status lists.",
    zh: "管理产品、问题和状态列表。",
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
  "master.newStatus": {
    id: "Nama status baru",
    en: "New status name",
    zh: "新状态名称",
  },

  // MasterList
  "masterList.newName": { id: "Nama baru", en: "New name", zh: "新名称" },
  "masterList.empty": {
    id: "Belum ada data.",
    en: "No data yet.",
    zh: "暂无数据。",
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
