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
  "common.edit": { id: "Ubah", en: "Edit", zh: "编辑" },
  "common.delete": { id: "Hapus", en: "Delete", zh: "删除" },
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
  "common.photoPackage": { id: "Foto Paket", en: "Package Photo", zh: "包裹照片" },
  "common.error": { id: "Terjadi kesalahan.", en: "Something went wrong.", zh: "发生错误。" },
  "common.note": { id: "Note", en: "Note", zh: "备注" },
  "common.video": { id: "Video", en: "Video", zh: "视频" },

  // Layout
  "nav.brand": {
    id: "Portal Produk BARDI",
    en: "Portal Produk BARDI",
    zh: "BARDI 产品门户",
  },
  "nav.report": { id: "Report", en: "Report", zh: "报告" },
  "nav.sales": { id: "Data Sales", en: "Sales Data", zh: "销售数据" },
  "nav.po": { id: "PO Product", en: "PO Product", zh: "采购订单" },
  "nav.tickets": { id: "Ticketing", en: "Ticketing", zh: "工单" },
  "nav.tasks": { id: "Task Planner", en: "Task Planner", zh: "任务计划" },
  "nav.defects": { id: "Data Defect", en: "Defect Data", zh: "缺陷数据" },
  "nav.repairs": { id: "Repair Data", en: "Repair Data", zh: "维修数据" },
  "nav.warrantyClaims": { id: "Claim Garansi", en: "Warranty Claim", zh: "保修申请" },
  "nav.master": { id: "Data Master", en: "Master Data", zh: "主数据" },
  "nav.users": {
    id: "User Management",
    en: "User Management",
    zh: "用户管理",
  },

  /* ---------------- Task planner ---------------- */
  "tasks.title": { id: "Task Planner", en: "Task Planner", zh: "任务计划" },
  "tasks.description": {
    id: "Rencana kerja tim: prioritas, progres, kalender, dan log aktivitas.",
    en: "Team work plan: priority, progress, calendar, and activity log.",
    zh: "团队工作计划：优先级、进度、日历和活动日志。",
  },
  "tasks.newTask": { id: "Tambah Task", en: "New Task", zh: "新建任务" },
  "tasks.editTask": { id: "Ubah Task", en: "Edit Task", zh: "编辑任务" },
  "tasks.total": { id: "Total Task", en: "Total Tasks", zh: "任务总数" },
  "tasks.totalHint": {
    id: "Semua task pada tampilan ini (tab yang sedang dibuka).",
    en: "All tasks in this view (current tab).",
    zh: "当前视图中的全部任务。",
  },
  "tasks.open": { id: "Belum Selesai", en: "Open", zh: "未完成" },
  "tasks.openHint": {
    id: "Task yang statusnya masih Belum.",
    en: "Tasks still marked as open.",
    zh: "状态仍为未完成的任务。",
  },
  "tasks.done": { id: "Selesai", en: "Done", zh: "已完成" },
  "tasks.doneHint": {
    id: "Task yang sudah ditandai Selesai.",
    en: "Tasks already marked done.",
    zh: "已标记为完成的任务。",
  },
  "tasks.overdue": { id: "Lewat Deadline", en: "Overdue", zh: "已逾期" },
  "tasks.overdueHint": {
    id: "Task Belum dengan deadline sebelum hari ini.",
    en: "Open tasks whose deadline has passed.",
    zh: "截止日期已过且未完成的任务。",
  },
  "tasks.tabMine": { id: "Tugas Saya", en: "My Tasks", zh: "我的任务" },
  "tasks.tabAll": { id: "Semua Task", en: "All Tasks", zh: "全部任务" },
  "tasks.tabCalendar": { id: "Kalender", en: "Calendar", zh: "日历" },
  "tasks.tabLog": { id: "Log Aktivitas", en: "Activity Log", zh: "活动日志" },
  "tasks.searchPlaceholder": {
    id: "Cari judul, keterangan, atau pembuat…",
    en: "Search title, description, or owner…",
    zh: "搜索标题、说明或创建人…",
  },
  "tasks.allStatus": { id: "Semua status", en: "All statuses", zh: "全部状态" },
  "tasks.allPriority": { id: "Semua prioritas", en: "All priorities", zh: "全部优先级" },
  "tasks.allDifficulty": { id: "Semua kesulitan", en: "All difficulties", zh: "全部难度" },
  "tasks.statusOpen": { id: "Belum", en: "Open", zh: "未完成" },
  "tasks.statusDone": { id: "Selesai", en: "Done", zh: "已完成" },
  "tasks.colTitle": { id: "Judul Task", en: "Task", zh: "任务" },
  "tasks.colOwner": { id: "Pembuat", en: "Owner", zh: "创建人" },
  "tasks.colPriority": { id: "Prioritas", en: "Priority", zh: "优先级" },
  "tasks.colDuration": { id: "Tanggal", en: "Dates", zh: "日期" },
  "tasks.colProgress": { id: "Progres", en: "Progress", zh: "进度" },
  "tasks.colStatus": { id: "Status", en: "Status", zh: "状态" },
  "tasks.colActions": { id: "Aksi", en: "Actions", zh: "操作" },
  "tasks.empty": {
    id: "Belum ada task. Tekan Tambah Task untuk membuat yang pertama.",
    en: "No tasks yet. Press New Task to create the first one.",
    zh: "还没有任务。点击“新建任务”创建第一条。",
  },
  "tasks.updateProgress": { id: "Update Progress", en: "Update Progress", zh: "更新进度" },
  "tasks.fieldTitle": { id: "Judul Task", en: "Task Title", zh: "任务标题" },
  "tasks.fieldDescription": { id: "Keterangan", en: "Description", zh: "说明" },
  "tasks.fieldProgress": { id: "Progres (%)", en: "Progress (%)", zh: "进度（%）" },
  "tasks.fieldPriority": { id: "Prioritas", en: "Priority", zh: "优先级" },
  "tasks.fieldDifficulty": { id: "Tingkat Kesulitan", en: "Difficulty", zh: "难度" },
  "tasks.fieldStatus": { id: "Status", en: "Status", zh: "状态" },
  "tasks.fieldStart": { id: "Tanggal Mulai", en: "Start Date", zh: "开始日期" },
  "tasks.fieldDue": { id: "Deadline", en: "Due Date", zh: "截止日期" },
  "tasks.fieldRepeat": { id: "Repeat", en: "Repeat", zh: "重复" },
  "tasks.fieldWeekday": { id: "Hari Repeat", en: "Repeat Day", zh: "重复日" },
  "tasks.fieldRepeatDay": { id: "Tanggal Repeat", en: "Repeat Date", zh: "重复日期" },
  "tasks.fieldNote": { id: "Catatan", en: "Note", zh: "备注" },
  "tasks.repeatNone": { id: "Tidak berulang", en: "Does not repeat", zh: "不重复" },
  "tasks.repeatDaily": { id: "Harian", en: "Daily", zh: "每天" },
  "tasks.repeatWeekly": { id: "Mingguan", en: "Weekly", zh: "每周" },
  "tasks.repeatMonthly": { id: "Bulanan", en: "Monthly", zh: "每月" },
  "tasks.repeatHint": {
    id: "Saat task ditandai Selesai, occurrence berikutnya dibuat otomatis dengan deadline lanjutan.",
    en: "When the task is marked done, the next occurrence is created automatically with the next deadline.",
    zh: "任务标记完成后，会自动创建下一个截止日期的任务。",
  },
  "tasks.repeatBadge": { id: "Berulang", en: "Repeating", zh: "重复" },
  "tasks.priorityUrgent": { id: "Urgent", en: "Urgent", zh: "紧急" },
  "tasks.prioritySegera": { id: "Segera", en: "Soon", zh: "尽快" },
  "tasks.priorityNormal": { id: "Normal", en: "Normal", zh: "普通" },
  "tasks.difficultyEasy": { id: "Mudah", en: "Easy", zh: "简单" },
  "tasks.difficultyMedium": { id: "Sedang", en: "Medium", zh: "中等" },
  "tasks.difficultyHard": { id: "Sulit", en: "Hard", zh: "困难" },
  "tasks.weekdayMon": { id: "Senin", en: "Monday", zh: "星期一" },
  "tasks.weekdayTue": { id: "Selasa", en: "Tuesday", zh: "星期二" },
  "tasks.weekdayWed": { id: "Rabu", en: "Wednesday", zh: "星期三" },
  "tasks.weekdayThu": { id: "Kamis", en: "Thursday", zh: "星期四" },
  "tasks.weekdayFri": { id: "Jumat", en: "Friday", zh: "星期五" },
  "tasks.weekdaySat": { id: "Sabtu", en: "Saturday", zh: "星期六" },
  "tasks.weekdaySun": { id: "Minggu", en: "Sunday", zh: "星期日" },
  "tasks.errorTitle": {
    id: "Judul task wajib diisi.",
    en: "Task title is required.",
    zh: "任务标题不能为空。",
  },
  "tasks.errorDates": {
    id: "Deadline tidak boleh sebelum tanggal mulai.",
    en: "Due date cannot be before the start date.",
    zh: "截止日期不能早于开始日期。",
  },
  "tasks.saved": { id: "Task disimpan.", en: "Task saved.", zh: "任务已保存。" },
  "tasks.saveFailed": {
    id: "Gagal menyimpan task.",
    en: "Failed to save the task.",
    zh: "保存任务失败。",
  },
  "tasks.deleted": { id: "Task dihapus.", en: "Task deleted.", zh: "任务已删除。" },
  "tasks.deleteFailed": {
    id: "Gagal menghapus task.",
    en: "Failed to delete the task.",
    zh: "删除任务失败。",
  },
  "tasks.deleteTitle": { id: "Hapus task ini?", en: "Delete this task?", zh: "删除此任务？" },
  "tasks.deleteDescription": {
    id: "Task dihapus permanen. Log aktivitasnya tetap tersimpan.",
    en: "The task is deleted permanently. Its activity log is kept.",
    zh: "任务将被永久删除，活动日志仍会保留。",
  },
  "tasks.markDone": { id: "Tandai selesai", en: "Mark done", zh: "标记完成" },
  "tasks.markOpen": { id: "Buka lagi", en: "Reopen", zh: "重新打开" },
  "tasks.markedDone": { id: "Task ditandai selesai.", en: "Task marked done.", zh: "任务已标记完成。" },
  "tasks.markedOpen": { id: "Task dibuka lagi.", en: "Task reopened.", zh: "任务已重新打开。" },
  "tasks.timelineTitle": {
    id: "Kalender Task",
    en: "Task Calendar",
    zh: "任务日历",
  },
  "tasks.timelineHint": {
    id: "Rentang tanggal mulai → deadline tiap task ditandai di kalender.",
    en: "Each task's start → due range is marked on the calendar.",
    zh: "每个任务的开始→截止日期范围会在日历上标出。",
  },
  "tasks.prevMonth": { id: "Bulan sebelumnya", en: "Previous month", zh: "上个月" },
  "tasks.nextMonth": { id: "Bulan berikutnya", en: "Next month", zh: "下个月" },
  "tasks.moreCount": { id: "+{count} lagi", en: "+{count} more", zh: "还有 {count} 条" },
  "tasks.viewDay": { id: "Hari", en: "Day", zh: "日" },
  "tasks.viewWeek": { id: "Minggu", en: "Week", zh: "周" },
  "tasks.viewMonth": { id: "Bulan", en: "Month", zh: "月" },
  "tasks.calendars": { id: "Kalender", en: "Calendars", zh: "日历" },
  "tasks.showAllUsers": { id: "Tampilkan semua user", en: "Show all users", zh: "显示所有用户" },
  "tasks.hideAllUsers": { id: "Sembunyikan semua user", en: "Hide all users", zh: "隐藏所有用户" },
  "tasks.today": { id: "Hari ini", en: "Today", zh: "今天" },
  "tasks.prevPeriod": { id: "Sebelumnya", en: "Previous", zh: "上一个" },
  "tasks.nextPeriod": { id: "Berikutnya", en: "Next", zh: "下一个" },
  "tasks.noTasks": { id: "Tidak ada task", en: "No tasks", zh: "没有任务" },
  "tasks.noUsersSelected": {
    id: "Pilih minimal satu user di daftar kalender.",
    en: "Pick at least one user from the calendar list.",
    zh: "请在日历列表中选择至少一位用户。",
  },
  "tasks.overdueShort": { id: "Lewat", en: "Overdue", zh: "逾期" },
  "tasks.logTitle": { id: "Log Aktivitas Task", en: "Task Activity Log", zh: "任务活动日志" },
  "tasks.logAllTitle": { id: "Log Semua Task", en: "All Task Activity", zh: "全部任务活动" },
  "tasks.logAllHint": {
    id: "Riwayat perubahan seluruh task, terbaru di atas.",
    en: "Change history for all tasks, newest first.",
    zh: "所有任务的变更记录，最新在上。",
  },
  "tasks.logEmpty": {
    id: "Belum ada aktivitas.",
    en: "No activity yet.",
    zh: "还没有活动记录。",
  },
  "tasks.actionCreate": { id: "dibuat", en: "created", zh: "已创建" },
  "tasks.actionUpdate": { id: "diubah", en: "updated", zh: "已更新" },
  "tasks.actionProgress": { id: "progres", en: "progress", zh: "进度" },
  "tasks.actionStatus": { id: "status", en: "status", zh: "状态" },
  "tasks.actionRepeat": { id: "repeat", en: "repeat", zh: "重复" },
  "tasks.actionDelete": { id: "dihapus", en: "deleted", zh: "已删除" },
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
    id: "Portal Produk BARDI",
    en: "Portal Produk BARDI",
    zh: "BARDI 产品门户",
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
  "login.showPassword": {
    id: "Tampilkan password",
    en: "Show password",
    zh: "显示密码",
  },
  "login.hidePassword": {
    id: "Sembunyikan password",
    en: "Hide password",
    zh: "隐藏密码",
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
    id: "Replacement Quantity by BARDI",
    en: "Replacement Quantity by BARDI",
    zh: "BARDI 换货数量",
  },
  "report.totalSales": {
    id: "Total Sales Quantity",
    en: "Total Sales Quantity",
    zh: "销售总数量",
  },
  "report.defectValue": {
    id: "Replacement Value by BARDI",
    en: "Replacement Value by BARDI",
    zh: "BARDI 换货价值",
  },
  "report.salesValue": {
    id: "Total Sales Value",
    en: "Total Sales Value",
    zh: "销售总金额",
  },
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
  /** Judul section yang membungkus dua kartu Replacement (BARDI). */
  "report.replacementSection": {
    id: "Replacement By BARDI",
    en: "Replacement By BARDI",
    zh: "BARDI 换货",
  },
  /** Judul section lain di grid kartu ringkasan Report. */
  "report.totalSalesSection": {
    id: "Total Sales",
    en: "Total Sales",
    zh: "销售",
  },
  "report.replacementFactorySection": {
    id: "Replacement By Factory",
    en: "Replacement By Factory",
    zh: "工厂换货",
  },
  "report.repairSection": {
    id: "Repair by Hub",
    en: "Repair by Hub",
    zh: "HUB 维修",
  },
  "report.claimSection": {
    id: "Claim Garansi BARDI",
    en: "BARDI Warranty Claim",
    zh: "BARDI 保修申请",
  },
  "report.claimQty": {
    id: "Total Claim ID Quantity",
    en: "Total Claim ID Quantity",
    zh: "保修申请总数量",
  },
  "report.claimQtyDesc": {
    id: "Jumlah unit claim garansi pada periode ini, tanpa status Belum Ada Data dan CLOSED ({rows} baris).",
    en: "Warranty claim units in this period, excluding Belum Ada Data and CLOSED statuses ({rows} rows).",
    zh: "本期保修申请数量，不含 Belum Ada Data 和 CLOSED 状态（{rows} 行）。",
  },
  "report.claimValue": {
    id: "Total Claim ID Value",
    en: "Total Claim ID Value",
    zh: "保修申请总价值",
  },
  "report.claimValueDesc": {
    id: "Nilai unit × harga Regional Warehouse, tanpa status Belum Ada Data dan CLOSED ({rows} baris).",
    en: "Units × Regional Warehouse price, excluding Belum Ada Data and CLOSED statuses ({rows} rows).",
    zh: "数量 × 区域仓库价格，不含 Belum Ada Data 和 CLOSED 状态（{rows} 行）。",
  },
  "report.claimRatio": {
    id: "Rasio Claim Quantity/Sales Quantity",
    en: "Claim Qty/Sales Qty Ratio",
    zh: "保修数量/销售数量比率",
  },
  "report.claimRatioDesc": {
    id: "Qty Claim ÷ Qty Sales",
    en: "Claim Qty ÷ Sales Qty",
    zh: "保修数量 ÷ 销售数量",
  },
  /** Label pendek baris KPI (satu topik = satu baris, angka sebaris). */
  "report.kpiQty": {
    id: "Qty",
    en: "Qty",
    zh: "数量",
  },
  "report.kpiValue": {
    id: "Value",
    en: "Value",
    zh: "金额",
  },
  "report.kpiRatioSales": {
    id: "Rasio thd Sales",
    en: "Ratio with Sales",
    zh: "占销售比率",
  },
  "report.kpiRatioClaim": {
    id: "Rasio thd Claim",
    en: "Ratio with Claims",
    zh: "占保修申请比率",
  },
  "report.repairClaimRatioDesc": {
    id: "Qty Repair ÷ Qty Claim Garansi BARDI",
    en: "Repair Qty ÷ BARDI Warranty Claim Qty",
    zh: "维修数量 ÷ BARDI 保修申请数量",
  },
  "report.repairSalesRatioDesc": {
    id: "Qty Repair ÷ Qty Sales",
    en: "Repair Qty ÷ Sales Qty",
    zh: "维修数量 ÷ 销售数量",
  },
  "report.kpiSelisihQty": {
    id: "Selisih Qty",
    en: "Selisih Qty",
    zh: "数量差额",
  },
  "report.kpiSelisihValue": {
    id: "Selisih Value",
    en: "Selisih Value",
    zh: "金额差额",
  },
  "report.kpiAllowanceLeft": {
    id: "Sisa Allowance",
    en: "Allowance Left",
    zh: "剩余额度",
  },
  "report.allowanceSection": {
    id: "Allowance Defect",
    en: "Allowance Defect",
    zh: "缺陷额度",
  },
  /** Judul kartu ringkasan (kolom tabel rekap tetap memakai report.replacement). */
  "report.replacementCard": {
    id: "Replacement Quantity by Factory",
    en: "Replacement Quantity by Factory",
    zh: "工厂换货数量",
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
    id: "Selisih Replacement Quantity Factory",
    en: "Selisih Replacement Quantity Factory",
    zh: "工厂换货数量差额",
  },
  /** Keterangan kecil di bawah kartu: angka itu hasil pengurangan apa. */
  "report.selisihQtyDesc": {
    id: "Hanya baris minus: Qty Factory − Qty BARDI",
    en: "Negative rows only: Factory Qty − BARDI Qty",
    zh: "仅负数行：工厂数量 − BARDI 数量",
  },
  "report.selisihValue": {
    id: "Selisih Replacement Value Factory",
    en: "Selisih Replacement Value Factory",
    zh: "工厂换货价值差额",
  },
  "report.selisihValueDesc": {
    id: "Hanya baris minus: Value Factory − Value BARDI",
    en: "Negative rows only: Factory Value − BARDI Value",
    zh: "仅负数行：工厂金额 − BARDI 金额",
  },
  "report.factoryValueRatio": {
    id: "Ratio Replacement Value Factory/Sales Value",
    en: "Replacement Value Factory/Sales Value Ratio",
    zh: "工厂换货金额/销售金额比率",
  },
  "report.factoryValueRatioDesc": {
    id: "Value Replacement Factory ÷ Value Sales",
    en: "Replacement Factory Value ÷ Sales Value",
    zh: "工厂换货金额 ÷ 销售金额",
  },
  "report.allowance": {
    id: "Sisa Allowance Defect",
    en: "Defect Allowance Left",
    zh: "缺陷额度余额",
  },
  "report.allowanceDesc": {
    id: "Limit {year} {limit} − Nilai Defect {value}",
    en: "Limit {year} {limit} − Defect Value {value}",
    zh: "{year} 年限额 {limit} − 缺陷金额 {value}",
  },
  "report.allowanceMissing": {
    id: "Limit tahun {year} belum diisi di Data Master.",
    en: "The {year} limit is not set in Master Data.",
    zh: "{year} 年限额尚未在主数据中设置。",
  },
  "report.repairQty": {
    id: "Repair Quantity by HUB",
    en: "Repair Quantity by HUB",
    zh: "HUB 维修数量",
  },
  "report.repairQtyDesc": {
    id: "Jumlah baris Repair Data berstatus Done Kirim / Done Repair pada periode ini.",
    en: "Repair Data rows with status Done Kirim / Done Repair in this period.",
    zh: "本期状态为 Done Kirim / Done Repair 的维修数据行数。",
  },
  "report.repairValue": {
    id: "Repair Value by HUB",
    en: "Repair Value by HUB",
    zh: "HUB 维修价值",
  },
  "report.repairValueDesc": {
    id: "Saving Value Repair Data berstatus Done Kirim / Done Repair pada periode ini, tanpa Penyelesaian Replacement Produk Baru ({rows} baris).",
    en: "Saving Value of Repair Data rows with status Done Kirim / Done Repair in this period, excluding resolution Replacement Produk Baru ({rows} rows).",
    zh: "本期状态为 Done Kirim / Done Repair 的维修数据 Saving Value，不含处理方式 Replacement Produk Baru（{rows} 行）。",
  },
  "report.replacementValue": {
    id: "Replacement Value by Factory",
    en: "Replacement Value by Factory",
    zh: "工厂换货价值",
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
  "po.valueCard": {
    id: "Total Value PO",
    en: "Total PO Value",
    zh: "采购总价值",
  },
  "po.totalValueDesc": {
    id: "Semua baris PO pada filter ini dalam Rupiah: baris Rp apa adanya, baris USD dan RMB dikonversi memakai kurs di menu Atur kurs.",
    en: "Every PO row in this filter, in Rupiah: Rp rows as-is, USD and RMB rows converted with the rates from Edit rates.",
    zh: "当前筛选下的全部采购行，换算为印尼盾：印尼盾原值，美元与人民币按“设置汇率”换算。",
  },
  "po.rate.action": {
    id: "Atur kurs",
    en: "Edit rates",
    zh: "设置汇率",
  },
  "po.rate.title": {
    id: "Kurs ke Rupiah",
    en: "Rates to Rupiah",
    zh: "汇率（换算为印尼盾）",
  },
  "po.rate.description": {
    id: "Isi berapa Rupiah untuk 1 USD dan 1 RMB. Angka ini dipakai kartu Total Value PO untuk mengubah nilai PO mata uang asing menjadi Rupiah.",
    en: "Enter how many Rupiah 1 USD and 1 RMB are worth. The Total PO Value card uses these to convert foreign-currency PO values into Rupiah.",
    zh: "填写 1 美元和 1 人民币分别折合多少印尼盾。采购总价值卡用它把外币采购金额换算为印尼盾。",
  },
  "po.rate.usd": {
    id: "1 USD (Rp)",
    en: "1 USD (Rp)",
    zh: "1 美元（印尼盾）",
  },
  "po.rate.rmb": {
    id: "1 RMB (Rp)",
    en: "1 RMB (Rp)",
    zh: "1 人民币（印尼盾）",
  },
  "po.rate.saved": {
    id: "Kurs tersimpan.",
    en: "Rates saved.",
    zh: "汇率已保存。",
  },
  "po.rate.invalid": {
    id: "Kurs harus angka 0 atau lebih.",
    en: "Rates must be 0 or more.",
    zh: "汇率必须为 0 或更大。",
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
    id: "Tidak ikut dikirim balik ke sheet ({fields})",
    en: "Not sent back to the sheet ({fields})",
    zh: "不会回写到工作表（{fields}）",
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
    id: "{count} baris tidak masuk",
    en: "{count} rows not imported",
    zh: "{count} 行未导入",
  },
  "gsheet.issueSkipped": {
    id: "Total {count} baris dilewati karena datanya belum lengkap atau kembar.",
    en: "Total {count} rows skipped because the data is incomplete or duplicated.",
    zh: "共 {count} 行因数据不完整或重复而被跳过。",
  },
  "gsheet.issueRow": {
    id: "Baris {row} —",
    en: "Row {row} —",
    zh: "第 {row} 行 —",
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

  // Repair Data (admin saja; sumber data tab "Data Reparasi" sheet Reparasi RFB)
  "repair.title": { id: "Repair Data", en: "Repair Data", zh: "维修数据" },
  "repair.description": {
    id: "Klaim reparasi dari sheet Reparasi RFB. Satu Claim ID boleh dipakai beberapa baris kalau tanggal atau produknya beda.",
    en: "Repair claims from the Reparasi RFB sheet. One Claim ID may cover several rows when the date or product differs.",
    zh: "来自 Reparasi RFB 工作表的维修索赔。同一 Claim ID 在日期或产品不同时可对应多行。",
  },
  "repair.addTitle": { id: "Tambah Repair", en: "Add Repair", zh: "添加维修" },
  "repair.editTitle": { id: "Ubah Repair", en: "Edit Repair", zh: "编辑维修" },
  "repair.detailTitle": { id: "Detail Repair", en: "Repair Detail", zh: "维修详情" },
  "repair.empty": {
    id: "Belum ada data repair.",
    en: "No repair data yet.",
    zh: "暂无维修数据。",
  },
  "repair.searchPlaceholder": {
    id: "Cari Claim ID, Resi, nama, produk, atau pabrik…",
    en: "Search Claim ID, receipt no., name, product, or factory…",
    zh: "搜索 Claim ID、运单号、姓名、产品或工厂…",
  },
  "repair.allProducts": { id: "Semua produk", en: "All products", zh: "所有产品" },
  "repair.allStatuses": { id: "Semua status", en: "All statuses", zh: "所有状态" },
  "repair.allOrigins": { id: "Semua asal", en: "All origins", zh: "所有来源" },
  "repair.allMonths": { id: "Semua bulan", en: "All months", zh: "所有月份" },
  "repair.allYears": { id: "Semua tahun", en: "All years", zh: "所有年份" },
  "repair.form.year": { id: "Tahun", en: "Year", zh: "年份" },
  "repair.importDone": {
    id: "Import selesai: {inserted} masuk, {skipped} dilewati, {failed} gagal.",
    en: "Import finished: {inserted} inserted, {skipped} skipped, {failed} failed.",
    zh: "导入完成：新增 {inserted} 条，跳过 {skipped} 条，失败 {failed} 条。",
  },
  "repair.totalQty": { id: "Total Quantity", en: "Total Quantity", zh: "总数量" },
  "repair.totalValue": { id: "Total Saving Value", en: "Total Saving Value", zh: "总节省金额" },
  "repair.table.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "repair.table.claim": { id: "Claim ID", en: "Claim ID", zh: "Claim ID" },
  "repair.table.customer": { id: "Nama", en: "Name", zh: "姓名" },
  "repair.table.resi": { id: "Resi", en: "Receipt No.", zh: "运单号" },
  "repair.table.pic": { id: "PIC", en: "PIC", zh: "负责人" },
  "repair.form.required": {
    id: "Claim ID, tanggal, dan produk wajib diisi.",
    en: "Claim ID, date, and product are required.",
    zh: "Claim ID、日期和产品为必填项。",
  },
  "repair.form.savingHint": {
    id: "Terisi otomatis: Quantity × harga produk jenis “Regional Warehouse” bulan itu. Angka boleh diubah manual.",
    en: "Filled automatically: quantity × that month's product price of type “Regional Warehouse”. You may change the number manually.",
    zh: "自动填写：数量 × 当月“Regional Warehouse”类型的产品价格。可手动修改。",
  },
  "repair.form.noPriceHint": {
    id: "Belum ada harga “Regional Warehouse” untuk produk ini di bulan tersebut — Saving Value dibiarkan 0. Isi harga master atau ketik angkanya manual.",
    en: "No “Regional Warehouse” price for this product in that month — Saving Value stays 0. Add the master price or type the number manually.",
    zh: "该产品当月没有“Regional Warehouse”价格 — 节省金额保持 0。请补充主数据价格或手动输入。",
  },
  "repair.form.claim": { id: "Claim ID", en: "Claim ID", zh: "Claim ID" },
  "repair.form.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "repair.form.month": { id: "Bulan", en: "Month", zh: "月份" },
  "repair.form.value": { id: "Saving Value", en: "Saving Value", zh: "节省金额" },
  "repair.form.priceType": { id: "Jenis Harga", en: "Price Type", zh: "价格类型" },
  "repair.form.origin": { id: "Asal", en: "Origin", zh: "来源" },
  "repair.form.customerName": { id: "Nama Customer", en: "Customer Name", zh: "客户姓名" },
  "repair.form.customerPhone": { id: "No Telp Customer", en: "Customer Phone", zh: "客户电话" },
  "repair.form.customerIssue": { id: "Kendala dari Customer", en: "Issue from Customer", zh: "客户反馈的问题" },
  "repair.form.photoCompleteness": { id: "Foto Kelengkapan", en: "Completeness Photo", zh: "完整度照片" },
  "repair.form.start": { id: "Start", en: "Start", zh: "开始" },
  "repair.form.finish": { id: "Finish", en: "Finish", zh: "完成" },
  "repair.form.pic": { id: "PIC", en: "PIC", zh: "负责人" },
  "repair.form.resolution": { id: "Penyelesaian", en: "Resolution", zh: "处理方式" },
  "repair.form.problem": { id: "Teknis Device", en: "Device Technical", zh: "设备技术" },
  "repair.form.sparePart": {
    id: "Sparepart {n}",
    en: "Spare part {n}",
    zh: "备件 {n}",
  },
  "repair.sparePartCustom": {
    id: "Belum ada di Data Master",
    en: "Not in Data Master yet",
    zh: "数据主表中暂无",
  },
  "repair.incomplete": { id: "Tidak lengkap", en: "Incomplete", zh: "不完整" },
  "repair.incompleteHint": {
    id: "Baris ini tetap diimpor tapi belum lengkap. Kolom kosong: {fields}.",
    en: "This row was imported but is incomplete. Empty fields: {fields}.",
    zh: "该行已导入但不完整。缺少字段：{fields}。",
  },
  "repair.incompleteShort": {
    id: "Tidak lengkap: {fields}",
    en: "Incomplete: {fields}",
    zh: "不完整：{fields}",
  },
  "repair.missing.claimId": { id: "Claim ID", en: "Claim ID", zh: "索赔编号" },
  "repair.missing.product": { id: "Produk", en: "Product", zh: "产品" },
  "repair.missing.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "repair.form.note": { id: "Note", en: "Note", zh: "备注" },
  "repair.form.noteClosing": { id: "Note Closing", en: "Closing Note", zh: "结案备注" },
  "repair.form.pickPlaceholder": { id: "Pilih…", en: "Select…", zh: "请选择…" },
  "repair.saved": { id: "Data repair tersimpan.", en: "Repair data saved.", zh: "维修数据已保存。" },
  "repair.deleted": { id: "Data repair dihapus.", en: "Repair data deleted.", zh: "维修数据已删除。" },
  "repair.deletedAll": {
    id: "{count} data repair dihapus.",
    en: "{count} repair rows deleted.",
    zh: "已删除 {count} 条维修数据。",
  },
  "repair.syncDone": {
    id: "Sinkron sheet selesai: {inserted} masuk, {updated} baris diperbarui, {skipped} baris tidak masuk.",
    en: "Sheet sync finished: {inserted} inserted, {updated} rows updated, {skipped} rows not imported.",
    zh: "工作表同步完成：新增 {inserted} 条，更新 {updated} 行，{skipped} 行未导入。",
  },
  "repair.syncIncomplete": {
    id: "{count} baris masuk sebagai tidak lengkap (ada kolom kosong / produk belum ada di Data Master).",
    en: "{count} rows were imported as incomplete (empty fields / product not in Data Master).",
    zh: "{count} 行以不完整状态导入（有空字段 / 产品不在数据主表中）。",
  },
  "repair.syncTitle": {
    id: "Sinkron Google Sheet Repair",
    en: "Sync Repair Google Sheet",
    zh: "同步维修 Google 工作表",
  },
  "repair.syncDescription": {
    id: "Tarik data dari tab Repair Data sheet Reparasi RFB. Search Google Sheet.",
    en: "Pull data from the Repair Data tab of the Reparasi RFB sheet. Searches the Google Sheet.",
    zh: "从 Reparasi RFB 工作表的 Repair Data 选项卡拉取数据。搜索 Google 工作表。",
  },
  "repair.syncedAt": { id: "Sinkron sheet", en: "Sheet sync", zh: "工作表同步" },
  "warranty.title": { id: "Claim Garansi BARDI", en: "BARDI Warranty Claim", zh: "BARDI 保修申请" },
  "warranty.description": {
    id: "Data claim garansi dari tab “Raw Combine CG”. Semua kolom datang dari sheet; nilainya dihitung aplikasi dari Price List (harga Regional Warehouse bulan claim).",
    en: "Warranty claim data from the “Raw Combine CG” tab. Every column comes from the sheet; the value is computed by the app from the Price List (Regional Warehouse price of the claim month).",
    zh: "来自“Raw Combine CG”工作表的保修申请数据。所有列均来自工作表；价值由应用根据价格表（申请月份的 Regional Warehouse 价格）计算。",
  },
  "warranty.empty": {
    id: "Belum ada data claim garansi. Klik “Sync Google Sheet” untuk menarik data dari sheet.",
    en: "No warranty claim data yet. Click “Sync Google Sheet” to pull the data.",
    zh: "暂无保修申请数据。点击“Sync Google Sheet”拉取数据。",
  },
  "warranty.searchPlaceholder": {
    id: "Cari Claim ID, nama, resi, produk, atau pabrik…",
    en: "Search Claim ID, name, receipt, product, or factory…",
    zh: "搜索索赔编号、姓名、运单号、产品或工厂…",
  },
  "warranty.allStatuses": { id: "Semua status", en: "All statuses", zh: "全部状态" },
  "warranty.allProducts": { id: "Semua produk", en: "All products", zh: "全部产品" },
  "warranty.allMonths": { id: "Semua bulan", en: "All months", zh: "全部月份" },
  "warranty.onlyIncomplete": { id: "Hanya tidak lengkap", en: "Incomplete only", zh: "仅不完整" },
  "warranty.sync": { id: "Sync Google Sheet", en: "Sync Google Sheet", zh: "同步 Google 工作表" },
  "warranty.syncing": { id: "Menyinkronkan…", en: "Syncing…", zh: "同步中…" },
  "warranty.syncDone": {
    id: "Sync selesai: {created} baris baru, {updated} diperbarui.",
    en: "Sync finished: {created} new rows, {updated} updated.",
    zh: "同步完成：新增 {created} 行，更新 {updated} 行。",
  },
  "warranty.syncFailed": {
    id: "Sync Google Sheet Claim Garansi gagal.",
    en: "Warranty claim sheet sync failed.",
    zh: "保修申请工作表同步失败。",
  },
  "warranty.syncTitle": { id: "Hasil Sync Claim Garansi", en: "Warranty Claim Sync Result", zh: "保修申请同步结果" },
  "warranty.syncDescription": {
    id: "Sheet adalah sumber semua kolom isian; nilai Rupiah dihitung aplikasi dari Price List.",
    en: "The sheet is the source of every filled column; the Rupiah value is computed by the app from the Price List.",
    zh: "工作表是所有填写列的来源；金额由应用根据价格表计算。",
  },
  "warranty.stat.qty": { id: "Total Unit", en: "Total Units", zh: "总数量" },
  "warranty.stat.qtyDesc": {
    id: "Jumlah unit yang di-claim pada baris-baris ini.",
    en: "Number of claimed units across these rows.",
    zh: "这些行申请的单位数量。",
  },
  "warranty.stat.value": { id: "Total Nilai (RW)", en: "Total Value (RW)", zh: "总价值（RW）" },
  "warranty.stat.valueDesc": {
    id: "Jumlah unit × harga Regional Warehouse bulan claim (dari Price List aplikasi).",
    en: "Units × Regional Warehouse price of the claim month (from the app Price List).",
    zh: "数量 × 申请月份的 Regional Warehouse 价格（来自应用价格表）。",
  },
  "warranty.table.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "warranty.table.claim": { id: "Claim ID", en: "Claim ID", zh: "索赔编号" },
  "warranty.table.customer": { id: "Nama", en: "Name", zh: "姓名" },
  "warranty.table.product": { id: "Produk", en: "Product", zh: "产品" },
  "warranty.table.qty": { id: "QTY", en: "QTY", zh: "数量" },
  "warranty.table.status": { id: "Status", en: "Status", zh: "状态" },
  "warranty.table.collectionPoint": { id: "Collection Point", en: "Collection Point", zh: "收货点" },
  "warranty.table.pic": { id: "PIC", en: "PIC", zh: "负责人" },
  "warranty.table.action": { id: "Aksi", en: "Action", zh: "操作" },
  "warranty.detail": { id: "Detail", en: "Detail", zh: "详情" },
  "warranty.detailTitle": { id: "Detail Claim Garansi", en: "Warranty Claim Detail", zh: "保修申请详情" },
  "warranty.field.timeStamp": { id: "Waktu Masuk", en: "Submitted At", zh: "提交时间" },
  "warranty.field.officialName": { id: "Official Name (produk)", en: "Official Name (product)", zh: "官方名称（产品）" },
  "warranty.field.productForm": {
    id: "Produk pilihan customer",
    en: "Product chosen by customer",
    zh: "客户选择的产品",
  },
  "warranty.field.phone": { id: "No. Telepon", en: "Phone", zh: "电话" },
  "warranty.field.email": { id: "Email", en: "Email", zh: "邮箱" },
  "warranty.field.courier": { id: "Kurir", en: "Courier", zh: "快递" },
  "warranty.field.resiUnit": {
    id: "Resi kirim unit ke BARDI",
    en: "Receipt of unit sent to BARDI",
    zh: "寄往 BARDI 的运单号",
  },
  "warranty.field.resi": { id: "Resi balik ke customer", en: "Receipt back to customer", zh: "寄回客户的运单号" },
  "warranty.field.city": { id: "Kota asal", en: "Origin city", zh: "始发城市" },
  "warranty.field.collectionPoint": { id: "Collection Point", en: "Collection Point", zh: "收货点" },
  "warranty.field.status": { id: "Status Kondisi Barang", en: "Item Condition Status", zh: "物品状态" },
  "warranty.field.sla": { id: "SLA", en: "SLA", zh: "SLA" },
  "warranty.field.pic": { id: "PIC", en: "PIC", zh: "负责人" },
  "warranty.field.note": { id: "Catatan", en: "Note", zh: "备注" },
  "warranty.field.quantity": { id: "Jumlah unit", en: "Units", zh: "数量" },
  "warranty.field.value": { id: "Nilai (RW)", en: "Value (RW)", zh: "价值（RW）" },
  "warranty.incomplete": { id: "Tidak lengkap", en: "Incomplete", zh: "不完整" },
  "warranty.incompleteHint": {
    id: "Baris ini tetap diimpor, tapi ada kolom yang kosong atau produknya belum ada di Data Master.",
    en: "This row is imported anyway, but a column is empty or the product is missing from the master data.",
    zh: "此行仍会导入，但有列为空或产品不在主数据中。",
  },
  "warranty.missing.claimId": { id: "Claim ID", en: "Claim ID", zh: "索赔编号" },
  "warranty.missing.product": { id: "Produk", en: "Product", zh: "产品" },
  "warranty.missing.date": { id: "Tanggal", en: "Date", zh: "日期" },
  "warranty.missing.price": {
    id: "Harga RW bulan ini",
    en: "RW price of this month",
    zh: "本月 RW 价格",
  },
  "warranty.sync.sheetRows": { id: "Baris sheet", en: "Sheet rows", zh: "工作表行数" },
  "warranty.sync.created": { id: "Baris baru", en: "New rows", zh: "新增行" },
  "warranty.sync.updated": { id: "Diperbarui", en: "Updated", zh: "已更新" },
  "warranty.sync.unchanged": { id: "Tidak berubah", en: "Unchanged", zh: "未变化" },
  "warranty.sync.incomplete": { id: "Ditandai tidak lengkap", en: "Flagged incomplete", zh: "标记为不完整" },
  "warranty.sync.onlyInApp": { id: "Hanya ada di app", en: "Only in the app", zh: "仅存在于应用" },
  "warranty.sync.empty": { id: "Baris kosong dilewati", en: "Empty rows skipped", zh: "跳过的空行" },
  "warranty.sync.noTimestamp": { id: "Tanpa Timestamp dilewati", en: "Rows without a Timestamp skipped", zh: "跳过无时间戳的行" },
  "warranty.sync.removedNoTimestamp": { id: "Baris lama tanpa Timestamp dibuang", en: "Old rows without a Timestamp removed", zh: "已删除无时间戳的旧行" },
  "warranty.sync.unknownProducts": {
    id: "Produk belum ada di Data Master",
    en: "Products missing from master data",
    zh: "主数据中缺少的产品",
  },
  "repair.origin.distri": { id: "Distri", en: "Distribution", zh: "分销" },
  "repair.origin.or": { id: "OR", en: "OR", zh: "OR" },
  "repair.origin.customer": { id: "Customer", en: "Customer", zh: "客户" },
  "repair.status.doneRepair": { id: "Done Repair", en: "Done Repair", zh: "维修完成" },
  "repair.status.proses": { id: "Proses", en: "In Progress", zh: "处理中" },
  "repair.status.belumDibuka": { id: "Belum Di Buka", en: "Not Opened Yet", zh: "尚未打开" },
  "repair.status.tidakAdaData": { id: "Tidak Ada Data", en: "No Data", zh: "无数据" },
  "repair.status.doneKirim": { id: "Done Kirim", en: "Shipped", zh: "已发货" },
  "repair.resolution.replacementBj": { id: "Replacement BJ", en: "Replacement BJ", zh: "更换 BJ" },
  "repair.resolution.gantiSparepart": { id: "Ganti Sparepart", en: "Replace Spare Part", zh: "更换备件" },
  "repair.resolution.maintenance": { id: "Maintenance", en: "Maintenance", zh: "保养" },
  "repair.resolution.gantiKomponen": { id: "Ganti Komponen", en: "Replace Component", zh: "更换部件" },
  "repair.resolution.replacementProdukBaru": { id: "Replacement Produk Baru", en: "Replacement with New Product", zh: "更换新产品" },
  "repair.actions": { id: "Aksi", en: "Actions", zh: "操作" },

  // Master
  // Allowance Defect (Data Master, admin saja)
  "allowance.tab": {
    id: "Allowance Defect",
    en: "Defect Allowance",
    zh: "缺陷额度",
  },
  "allowance.hint": {
    id: "Limit defect dalam Rupiah untuk SATU TAHUN. Halaman Report memprorata limit ini mengikuti filter: setahun penuh, sebulan ÷ 12, seminggu ÷ 12 ÷ 4,33, sehari ÷ 365, rentang tanggal × jumlah hari ÷ 365 — lalu dikurangi Nilai Defect periode itu.",
    en: "Defect limit in Rupiah for ONE YEAR. The Report page prorates it to the active filter: full year, one month ÷ 12, one week ÷ 12 ÷ 4.33, one day ÷ 365, a date range × days ÷ 365 — then subtracts that period's Defect Value.",
    zh: "缺陷额度为一年度的印尼盾限额。报表页会按当前筛选按比例折算：全年为全额，一个月 ÷ 12，一周 ÷ 12 ÷ 4.33，一天 ÷ 365，日期区间按天数 ÷ 365，再减去该期间的缺陷金额。",
  },
  "allowance.year": { id: "Tahun", en: "Year", zh: "年度" },
  "allowance.yearPlaceholder": { id: "2026", en: "2026", zh: "2026" },
  "allowance.limit": {
    id: "Limit (Rupiah)",
    en: "Limit (Rupiah)",
    zh: "限额（印尼盾）",
  },
  "allowance.limitPlaceholder": {
    id: "1500000000",
    en: "1500000000",
    zh: "1500000000",
  },
  "allowance.perMonth": {
    id: "Per bulan (÷ 12)",
    en: "Per month (÷ 12)",
    zh: "每月（÷ 12）",
  },
  "allowance.action": { id: "Aksi", en: "Action", zh: "操作" },
  "allowance.add": { id: "Tambah", en: "Add", zh: "添加" },
  "allowance.update": { id: "Simpan", en: "Save", zh: "保存" },
  "allowance.cancel": { id: "Batal", en: "Cancel", zh: "取消" },
  "allowance.edit": { id: "Ubah", en: "Edit", zh: "编辑" },
  "allowance.delete": { id: "Hapus", en: "Delete", zh: "删除" },
  "allowance.empty": {
    id: "Belum ada limit allowance. Tambahkan satu baris per tahun.",
    en: "No allowance limit yet. Add one row per year.",
    zh: "尚无额度限额。请每年添加一行。",
  },
  "allowance.saved": {
    id: "Limit allowance tersimpan.",
    en: "Allowance limit saved.",
    zh: "额度限额已保存。",
  },
  "allowance.deleted": {
    id: "Limit allowance {year} dihapus.",
    en: "Allowance limit {year} deleted.",
    zh: "{year} 年额度已删除。",
  },
  "allowance.saveFailed": {
    id: "Gagal menyimpan limit allowance.",
    en: "Failed to save the allowance limit.",
    zh: "保存额度限额失败。",
  },
  "allowance.yearInvalid": {
    id: "Tahun harus empat angka, mis. 2026.",
    en: "Year must be four digits, e.g. 2026.",
    zh: "年份必须是四位数字，例如 2026。",
  },
  "allowance.limitInvalid": {
    id: "Limit harus angka Rupiah (boleh 0).",
    en: "Limit must be a Rupiah amount (0 allowed).",
    zh: "限额必须是印尼盾金额（可为 0）。",
  },
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
  "users.tabRoles": {
    id: "Role & Akses",
    en: "Roles & Access",
    zh: "角色与权限",
  },
  "users.rolesHint": {
    id: "Role menentukan menu apa yang bisa dibuka tiap user.",
    en: "Roles decide which menus each user can open.",
    zh: "角色决定每个用户可以打开哪些菜单。",
  },
  "users.addRole": { id: "Tambah Role", en: "Add Role", zh: "添加角色" },
  "users.editRole": { id: "Ubah Role", en: "Edit Role", zh: "编辑角色" },
  "users.roleName": { id: "Nama Role", en: "Role Name", zh: "角色名称" },
  "users.roleNamePlaceholder": {
    id: "mis. Tim CS",
    en: "e.g. CS Team",
    zh: "例如：客服团队",
  },
  "users.roleDescription": {
    id: "Keterangan",
    en: "Description",
    zh: "说明",
  },
  "users.roleUsers": { id: "Jumlah User", en: "Users", zh: "用户数" },
  "users.systemRole": { id: "Sistem", en: "System", zh: "系统" },
  "users.systemRoleLocked": {
    id: "Role sistem: nama dan deskripsi dikunci, hanya hak akses yang bisa diubah.",
    en: "System role: name and description are locked; only permissions can be changed.",
    zh: "系统角色：名称和描述锁定，只能修改权限。",
  },
  "users.noRole": { id: "Tanpa role", en: "No role", zh: "无角色" },
  "users.roleHint": {
    id: "Menu yang bisa dibuka ditentukan role. Role Pabrik otomatis menyembunyikan nilai Rupiah.",
    en: "Available menus follow the role. The Factory role hides Rupiah values automatically.",
    zh: "可访问的菜单由角色决定。工厂角色会自动隐藏印尼盾金额。",
  },
  "users.permissionMatrix": {
    id: "Hak akses menu",
    en: "Menu access",
    zh: "菜单权限",
  },
  "users.permissionMatrixHint": {
    id: "Baca = hanya melihat, Tulis = bisa menambah/mengubah. Tulis otomatis termasuk Baca.",
    en: "Read = view only, Write = add/edit. Write automatically includes Read.",
    zh: "读取 = 只能查看，写入 = 可新增/修改。写入自动包含读取。",
  },
  "users.readOn": { id: "Baca ✓", en: "Read ✓", zh: "读取 ✓" },
  "users.readOff": { id: "Baca", en: "Read", zh: "读取" },
  "users.writeOn": { id: "Tulis ✓", en: "Write ✓", zh: "写入 ✓" },
  "users.writeOff": { id: "Tulis", en: "Write", zh: "写入" },
  "users.roleCreated": { id: "Role dibuat.", en: "Role created.", zh: "角色已创建。" },
  "users.roleUpdated": {
    id: "Role diperbarui.",
    en: "Role updated.",
    zh: "角色已更新。",
  },
  "users.roleDeleted": {
    id: "Role dihapus.",
    en: "Role deleted.",
    zh: "角色已删除。",
  },
  "users.roleSaveFailed": {
    id: "Gagal menyimpan role.",
    en: "Failed to save role.",
    zh: "保存角色失败。",
  },
  "users.roleDeleteConfirm": {
    id: "Hapus role {name}? User yang memakainya kehilangan akses.",
    en: "Delete role {name}? Users using it lose access.",
    zh: "删除角色 {name}？使用该角色的用户将失去访问权限。",
  },

  // Gerbang menu berbasis hak akses role
  "guard.noAccessTitle": {
    id: "Tidak punya akses",
    en: "No access",
    zh: "无权访问",
  },
  "guard.noAccessHint": {
    id: "Role akun ini tidak diberi akses ke menu tersebut. Hubungi admin bila memang dibutuhkan.",
    en: "This account's role has no access to that menu. Ask an admin if you need it.",
    zh: "该账户的角色没有此菜单的访问权限。如确需使用请联系管理员。",
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
    id: "Isi kartu ditampilkan dalam terjemahan contoh — Fase 2 memakai penerjemah server BARDI.",
    en: "Card contents are shown in sample translation — Phase 2 uses the BARDI server translator.",
    zh: "卡片内容以示例翻译显示 — 第二阶段使用 BARDI 服务器翻译。",
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
