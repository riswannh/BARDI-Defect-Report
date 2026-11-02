# Tutorial Rencana Kerja (Task Planner)

Panduan ini menjelaskan **semua fitur** di menu **Rencana Kerja**, termasuk langkah
awal yang **wajib** dilakukan setiap pengguna di tab **Pengaturan**.

Rencana Kerja dipakai untuk mencatat pekerjaan, membaginya ke anggota tim, memantau
tenggat, dan menyimpan catatan bersama.

---

## Daftar isi

1. [Wajib dulu: atur di tab Pengaturan](#1-wajib-dulu-atur-di-tab-pengaturan)
2. [Peta halaman Rencana Kerja](#2-peta-halaman-rencana-kerja)
3. [Tab Ringkasan](#3-tab-ringkasan)
4. [Tab Tugas: Daftar dan Papan](#4-tab-tugas-daftar-dan-papan)
5. [Membuat tugas baru](#5-membuat-tugas-baru)
6. [Mengubah, menyelesaikan, dan menghapus tugas](#6-mengubah-menyelesaikan-dan-menghapus-tugas)
7. [Menyebut orang dengan @](#7-menyebut-orang-dengan-)
8. [Pop up Rincian Tugas](#8-pop-up-rincian-tugas)
9. [Tab Kalender](#9-tab-kalender)
10. [Tab Dokumentasi](#10-tab-dokumentasi)
11. [Notifikasi lonceng](#11-notifikasi-lonceng)
12. [Hak akses dan group role](#12-hak-akses-dan-group-role)
13. [Alur kerja harian yang disarankan](#13-alur-kerja-harian-yang-disarankan)
14. [Pertanyaan yang sering muncul](#14-pertanyaan-yang-sering-muncul)

---

## 1. Wajib dulu: atur di tab Pengaturan

Tab **Pengaturan** terbuka untuk **semua akun** (bukan hanya admin). Lakukan dua hal
berikut **sebelum** membuat tugas pertama.

### 1.1 Pilih warna kartu kalender

1. Buka **Rencana Kerja**.
2. Klik tab **Pengaturan**.
3. Arahkan kursor ke kartu **Warna Kartu Kalender**. Kolom **Akun** menampilkan akun
   yang akan diatur, lalu pilih **Warna kalender**.
4. Klik **Simpan**.

Warna ini adalah penanda kartu/kotak tugas milik akun tersebut di tab **Kalender**,
sehingga nama tidak perlu dibaca satu per satu. **Admin** boleh memilih akun lain pada
dropdown **Akun** untuk mengatur warna anggota tim.

### 1.2 Buat daftar tipe pekerjaan

Ada **tidak ada tipe bawaan** — setiap akun mulai dengan daftar kosong.

1. Di tab **Pengaturan**, lihat kartu **Tipe Pekerjaan**.
2. Ketik nama tipe pada kolom **Nama tipe baru**, misalnya `Tugas`, `Bug`, `Fitur`,
   atau `Sub-task`.
3. Klik **Tambah tipe**.
4. Ulangi untuk semua tipe yang biasa dipakai.

Hal penting:

- Tipe disimpan **per akun**. Daftar tipe yang muncul di form tugas adalah daftar milik
  **pemilik tugas** yang sedang dipilih.
- Jika daftar kosong, form tugas menampilkan pesan
  **"Belum ada tipe — tambah di tab Pengaturan."**
- Tipe yang masih dipakai tidak bisa dihapus. Muncul pesan
  **"Tipe masih dipakai {jumlah} task, tidak bisa dihapus."**
- **Admin** dapat memilih akun lain pada dropdown **Akun** untuk merapikan tipe anggota
  timnya.

> **Kenapa wajib?** Tanpa tipe, tugas tetap bisa disimpan dengan kode tipe dasar
> `task`, tetapi filter **Tipe** di tab Tugas dan grafik **Jenis pekerjaan** di tab
> Ringkasan tidak berguna karena semua tugas masuk satu kelompok.

---

## 2. Peta halaman Rencana Kerja

Saat menu **Rencana Kerja** dibuka, tersedia lima tab:

| Tab | Kegunaan |
| --- | --- |
| **Ringkasan** | Angka ringkas, sebaran status/prioritas/tipe, beban tim, aktivitas terbaru |
| **Tugas** | Daftar dan papan (kanban) semua tugas + filter dan pencarian |
| **Kalender** | Tampilan Hari/Minggu/Bulan berisi batang tugas per tanggal |
| **Dokumentasi** | Catatan bersama dengan editor teks dan sebutan `@` |
| **Pengaturan** | Warna kalender dan daftar tipe pekerjaan (lihat bagian 1) |

Di bagian atas halaman ada dua tombol:

- **Ikon riwayat** — membuka daftar seluruh aktivitas tugas (siapa melakukan apa dan kapan).
- **Tambah Tugas** — membuat tugas baru. Tombol ini hanya muncul bila akun punya izin
  **menulis** di menu Rencana Kerja.

---

## 3. Tab Ringkasan

Tab **Ringkasan** adalah dasbor singkat. Isinya:

1. **Empat kartu angka** (masing-masing bisa diklik):
   - **Dibuat 7 hari** — tugas yang dibuat dalam 7 hari terakhir.
   - **Diperbarui 7 hari** — tugas yang diubah dalam 7 hari terakhir.
   - **Selesai** — semua tugas berstatus `Selesai`.
   - **Jatuh tempo** — tugas belum selesai yang tenggatnya dalam 7 hari ke depan.
   Klik salah satu kartu: halaman pindah ke tab **Tugas** dengan filter cepat yang sesuai.
   Untuk menghapus filter kartu, klik chip **Hapus filter kartu**.
2. **Ringkasan status** — jumlah tugas `Belum`, `Proses`, `Selesai` beserta legenda
   **Lewat tenggat**, **Selesai**, dan **Sedang berjalan**.
3. **Sebaran prioritas** — jumlah tugas per prioritas (Rendah/Sedang/Tinggi/Kritis).
   Klik salah satu baris untuk memfilter tab Tugas menurut prioritas itu.
4. **Jenis pekerjaan** — jumlah tugas per tipe. Tipe yang sama dari akun berbeda
   digabung menjadi satu baris.
5. **Beban tim** — jumlah tugas yang **belum selesai** per anggota. Tugas yang sudah
   selesai tidak dihitung.
6. **Aktivitas terbaru** — daftar aktivitas terakhir; klik satu baris untuk membuka
   **Rincian Tugas** terkait.

---

## 4. Tab Tugas: Daftar dan Papan

### 4.1 Siapa melihat tugas apa

- **Admin** melihat seluruh tugas semua akun.
- **Akun biasa** melihat tugas miliknya sendiri **dan** tugas yang menyebut dia
  dengan `@` (lihat bagian 7).

### 4.2 Tombol dan filter di toolbar

- **Kotak cari** — mencari judul dan keterangan tugas.
- **Filter Pemilik** — khusus admin.
- **Filter Status** — `Belum`, `Proses`, `Selesai`, dan `Arsip`.
- **Filter Tipe**, **Filter Prioritas**, **Filter Kesulitan** — bisa memilih lebih dari
  satu nilai.
- **Chip filter cepat** — sisa filter dari kartu Ringkasan; klik **Hapus filter kartu**
  untuk membersihkan.
- **Pilih tampilan** — mengganti antara **Daftar** dan **Papan**. Pilihan ini disimpan
  ke profil, jadi tetap sama saat halaman dibuka lagi.

### 4.3 Tampilan Daftar

Kolom yang ditampilkan: **Judul Tugas**, **Tipe**, **Pembuat** (admin), **Prioritas**,
**Tenggat**, **Kemajuan**, **Status**, dan **Aksi**.

- Klik **baris** untuk membuka Rincian Tugas.
- **Ikon centang** menandai tugas `Selesai` (klik lagi untuk **Buka lagi**).
- **Kemajuan** tampil sebagai bilah dan angka persen. Klik tombol kecil di sebelahnya
  untuk membuka dialog **Ubah kemajuan**.
- **Menu aksi** berisi **Ubah** dan **Hapus**.
- Tugas yang sudah selesai lebih dari 7 hari otomatis diberi badge **Arsip** dan
  disembunyikan dari daftar biasa (lihat bagian 4.5).
- Daftar memakai halaman; gunakan panah di bawah tabel untuk berpindah halaman.

### 4.4 Tampilan Papan

Tampilan papan membagi tugas ke tiga kolom: **Belum**, **Proses**, dan **Selesai**.

- Tombol panah **←** dan **→** pada kartu memindahkan tugas ke status sebelumnya atau
  berikutnya.
- Menu aksi pada kartu berisi **Ubah** dan **Hapus**.
- Klik kartu untuk membuka Rincian Tugas.

### 4.5 Tentang arsip

Tugas yang sudah `Selesai` lebih dari **7 hari** tidak lagi tampil di daftar biasa.
Tugas tersebut **tetap** muncul di **Kalender** dan **Ringkasan**.

Untuk melihatnya kembali: pilih **Arsip** pada **Filter Status**.

---

## 5. Membuat tugas baru

Klik **Tambah Tugas**. Isi form berikut:

| Isian | Keterangan |
| --- | --- |
| **Judul Tugas** | Wajib. Ringkas dan jelas. |
| **Keterangan** | Penjelasan pekerjaan. Bisa menyebut orang dengan `@` (bagian 7). |
| **Pemilik task** | Hanya admin. Menentukan siapa yang memegang tugas ini, dan tipe mana yang muncul di pilihan **Tipe**. |
| **Tipe** | Diambil dari daftar tipe milik pemilik tugas. Kosong berarti pemilik belum mengatur tipe. |
| **Prioritas** | Rendah / Sedang / Tinggi / Kritis. |
| **Tingkat Kesulitan** | Menandai bobot pekerjaan. |
| **Tanggal Mulai** | Terisi otomatis **hari ini** dan tidak bisa diubah saat membuat tugas. Hint: "Tanggal mulai otomatis hari ini." |
| **Tenggat** | Tanggal selesai yang diharapkan. Tidak boleh lebih awal dari tanggal mulai. |
| **Status** | Awalnya `Belum`. |
| **Kemajuan (%)** | Angka 0–100. |
| **Pengulangan** | Tidak berulang / Harian / Mingguan / Bulanan. Bila dipilih **Mingguan**, muncul pilihan **Hari Pengulangan**; bila **Bulanan**, muncul **Tanggal Pengulangan**. |
| **Catatan** | Catatan pendek yang ikut tersimpan. |

Klik **Simpan** untuk menyimpan, atau **Batal** untuk membatalkan.

Hal yang perlu diketahui tentang **Pengulangan**: saat tugas ditandai **Selesai**,
sistem otomatis membuat tugas berikutnya dengan tenggat lanjutan sesuai aturan.
Tugas baru itu tetap memakai orang yang sama dan menyimpan daftar sebutan `@`, tetapi
**tidak** mengirim notifikasi lagi.

---

## 6. Mengubah, menyelesaikan, dan menghapus tugas

### Mengubah

Ada dua cara:

1. Klik baris/kartu tugas → pop up **Rincian Tugas** → tombol **Ubah**.
2. Buka **menu aksi** pada baris/kartu → **Ubah**.

Yang boleh mengubah: **pembuat tugas**, **admin**, atau **orang yang disebut `@`**
pada tugas tersebut. Akun lain hanya dapat membaca.

### Menyelesaikan

- Klik **ikon centang** di baris daftar, atau
- ubah **Status** menjadi `Selesai` di form Ubah, atau
- tekan panah **→** di tampilan Papan sampai kolom `Selesai`.

Saat status berubah menjadi `Selesai`, tanggal selesai dicatat dan dipakai Kalender
untuk memotong panjang batang tugas (bagian 9). Bila tugas berulang, tugas berikutnya
langsung dibuat.

### Menghapus

Buka **menu aksi** → **Hapus**, lalu konfirmasi. Hapus bersifat permanen dan hanya
tersedia untuk **pembuat tugas** atau **admin**.

Setiap perubahan tercatat di **Log aktivitas** (bagian 8) dan di daftar aktivitas global
(ikon riwayat di header halaman).

---

## 7. Menyebut orang dengan @

Sebutan dipakai agar orang lain tahu dan tugas ikut muncul di daftar mereka.

### Di keterangan tugas

1. Ketik `@` di kolom **Keterangan**.
2. Daftar nama muncul tepat di bawah posisi kursor. Daftar ini **sama** dengan daftar
   pada **Filter Pemilik** dan panel **Kalender**, yaitu akun yang punya akses menulis
   di Rencana Kerja.
3. Lanjutkan mengetik untuk mempersempit (misalnya `@bi`), atau gunakan **panah atas/bawah**
   lalu **Enter**/**Tab** untuk memilih. **Esc** menutup daftar.
4. Setelah dipilih, nama yang disebut **disorot** (latar biru) sehingga terlihat jelas
   bahwa sebutan berhasil.

Hint di bawah kolom: "Ketik @ di deskripsi untuk menyebut orang. Mereka menerima
notifikasi dan task ini muncul di daftar mereka."

Yang terjadi setelah menyimpan:

- Orang yang disebut menerima **notifikasi lonceng**.
- Tugas muncul di daftar **Tugas** milik orang itu walaupun dia bukan pemiliknya.
- Orang itu **boleh mengubah** tugas tersebut (status, kemajuan, keterangan, dan isian
  lain), sesuai keputusan pemilik sistem.

### Di Dokumentasi

Sama caranya: ketik `@` di isi catatan. Daftar yang muncul hanya menampilkan **nama**
akun (tanpa `@username`). Menyebut tugas juga bisa dari editor ini untuk menautkan
catatan ke tugas terkait.

Notifikasi hanya dikirim untuk **sebutan baru**. Menyimpan ulang catatan tanpa
menambahkan sebutan baru tidak mengirim notifikasi lagi.

---

## 8. Pop up Rincian Tugas

Klik baris/kartu tugas untuk membukanya. Ada dua tab:

1. **Informasi** — judul, keterangan, tipe, pemilik, prioritas, kesulitan, tanggal
   mulai, tenggat, status, kemajuan, catatan, serta **Dibuat**, **Diperbarui**, dan
   **Selesai pada** (bila sudah selesai).
2. **Log aktivitas** — riwayat perubahan tugas tersebut: siapa, melakukan apa, kapan.

Di bagian bawah pop up tersedia tombol:

- **Ubah** — membuka form ubah (hanya bila berhak).
- **Hapus** — menghapus tugas (hanya pembuat/admin).
- **Tutup**.

---

## 9. Tab Kalender

Kalender menampilkan tugas sebagai batang sesuai rentang tanggalnya.

### Tampilan

Pilih **Hari**, **Minggu**, atau **Bulan** (tombol **Pilih tampilan**). Gunakan panah
**Sebelumnya** / **Berikutnya** untuk berpindah periode, dan **Hari ini** untuk kembali
ke tanggal sekarang.

### Panel Kalender (per akun)

Panel di sisi kalender berisi daftar akun dengan kotak centang:

- Centang akun untuk menampilkan tugasnya, hilangkan centang untuk menyembunyikan.
- Tombol **Tampilkan semua pengguna** mencentang semua akun; **Sembunyikan** menghapus
  semua centang.
- Warna tiap akun mengikuti pengaturan **Warna Kartu Kalender** (bagian 1.1).

### Membaca warna dan legenda

Legenda di bawah kalender:

- **Selesai** — tugas yang sudah selesai.
- **Sedang berjalan** — tugas berstatus `Proses`.
- **Lewat tenggat** — tugas belum selesai yang tenggatnya sudah lewat.

### Panjang batang tugas

- Batang dimulai pada **tanggal mulai** dan berakhir pada **tenggat**.
- Jika tugas ditandai **Selesai sebelum tenggat**, batangnya **berhenti di tanggal
  selesai**, bukan di tenggat. Jadi kalender menunjukkan pekerjaan yang benar-benar
  selesai lebih cepat.
- Arahkan kursor ke batang untuk melihat ringkasan; bila selesai lebih awal, tooltip
  menampilkan **"Selesai pada <tanggal>"**.

### Berinteraksi

- Klik batang tugas untuk membuka Rincian Tugas.
- Bila satu tanggal memuat lebih banyak tugas daripada yang muat, muncul tautan
  **+N** di bawah tanggal tersebut. Klik tautan itu untuk membuka **tampilan Hari**
  pada tanggal itu dan melihat seluruh tugasnya.

---

## 10. Tab Dokumentasi

Dokumentasi adalah tempat catatan bersama (SOP, hasil rapat, panduan singkat).

### Membaca catatan

- Setiap catatan tampil sebagai kartu: judul, potongan isi, dan keterangan
  "diperbarui oleh …".
- Catatan yang disematkan diberi tanda pin dan tampil paling atas.
- Gunakan **kotak pencarian** untuk mencari judul/isi, dan **Urutkan catatan** untuk
  memilih **Terbaru** atau **Judul**.
- Klik kartu untuk membaca di pop up. Di pop up ada tombol **Sematkan**/**Lepas sematan**,
  **Ubah**, dan **Hapus** (bila berhak).

### Menulis catatan

1. Klik **Tulis Catatan**.
2. Isi **Judul** (maksimal 160 karakter).
3. Bila perlu, klik **Sematkan di atas** agar catatan selalu di urutan teratas.
4. Tulis isi catatan di editor. Toolbar menyediakan: **jenis huruf**, **ukuran huruf**,
   **tebal**, **miring**, **garis bawah**, **coret**, **warna teks**, **perataan**,
   **daftar berbutir**, **daftar bernomor**, **indentasi**, **kutipan**, **tautan**,
   **hapus format**, serta sebutan `@` untuk orang atau tugas.
5. Klik **Simpan**.

Catatan yang menyebut orang dengan `@` akan mengirim notifikasi ke orang tersebut
(lihat bagian 11).

---

## 11. Notifikasi lonceng

Ikon **lonceng** ada di header aplikasi, di sebelah pemilih bahasa.

- Angka kecil di lonceng menunjukkan jumlah notifikasi yang belum dibaca (maksimal
  ditampilkan `9+`).
- Klik lonceng untuk membuka daftar notifikasi terbaru.
- Klik satu notifikasi: notifikasi ditandai terbaca dan aplikasi membuka halaman terkait.
- Tombol **Tandai semua dibaca** membersihkan semua tanda belum dibaca.
- Daftar dimuat ulang otomatis setiap **60 detik**.

Jenis notifikasi saat ini:

| Jenis | Kapan muncul |
| --- | --- |
| Sebutan di tugas | Saat Anda disebut `@` pada keterangan tugas |
| Sebutan di dokumentasi | Saat Anda disebut `@` pada catatan Dokumentasi |

Catatan: menyebut diri sendiri tidak menghasilkan notifikasi.

---

## 12. Hak akses dan group role

- **Admin** dapat melihat semua tugas, mengatur semua akun, dan mengubah/menghapus
  semua data di Rencana Kerja.
- **Akun biasa** melihat tugas miliknya dan tugas yang menyebutnya.
- Setiap **group role** memberi izin **baca** dan **tulis** per menu. Bila satu akun
  punya beberapa group role, izinnya **digabung** — yang paling longgar menang.
- Tanpa izin tulis di menu Rencana Kerja, tombol **Tambah Tugas**, **Tulis Catatan**,
  dan menu **Ubah/Hapus** tidak muncul; halaman tetap bisa dibaca.
- Sebutan `@` hanya menyarankan akun yang punya akses tulis di Rencana Kerja, supaya
  tugas yang muncul di daftar mereka memang bisa mereka kerjakan.

---

## 13. Alur kerja harian yang disarankan

**Sekali di awal (per akun):**

1. Tab **Pengaturan** → pilih **Warna Kartu Kalender** → **Simpan**.
2. Tab **Pengaturan** → tambahkan tipe pekerjaan yang biasa dipakai.

**Setiap pagi:**

1. Buka **Ringkasan**, lihat kartu **Jatuh tempo** (7 hari ke depan).
2. Buka **Kalender** untuk melihat beban minggu ini.

**Saat mengerjakan:**

1. Ubah status tugas menjadi `Proses`.
2. Perbarui **Kemajuan (%)** secara berkala.
3. Butuh bantuan orang lain? Tulis `@nama` di keterangan dan simpan.

**Saat selesai:**

1. Klik **ikon centang** (atau ubah status menjadi `Selesai`).
2. Tugas berulang otomatis membuat tugas berikutnya.
3. Tugas yang selesai lebih dari 7 hari masuk **Arsip**.

**Menyimpan pengetahuan:**

1. Buka **Dokumentasi** → **Tulis Catatan**.
2. Sematkan catatan penting agar selalu di atas.

---

## 14. Pertanyaan yang sering muncul

**Tipe tidak ada di form tugas.**
Daftar tipe mengikuti **pemilik tugas**. Buka tab **Pengaturan** dan tambahkan tipe
untuk akun tersebut (admin bisa memilih akun lain pada dropdown **Akun**).

**Tugas hilang dari daftar.**
Tugas yang selesai lebih dari 7 hari masuk **Arsip**. Pilih **Arsip** pada
**Filter Status**, atau lihat di **Kalender**/**Ringkasan**.

**Kalender kosong.**
Periksa panel **Kalender**: mungkin akun Anda belum dicentang, atau tugas tersebut bukan
milik akun yang ditampilkan. Akun biasa hanya melihat tugasnya sendiri dan tugas yang
menyebutnya.

**Tombol Ubah/Hapus tidak muncul.**
Anda bukan pembuat tugas, bukan admin, dan tidak disebut `@` pada tugas itu.

**Tidak bisa menghapus tipe pekerjaan.**
Tipe masih dipakai tugas. Pesan **"Tipe masih dipakai {jumlah} task, tidak bisa dihapus."**
Ubah dulu tipe tugas tersebut, baru hapus.

**Notifikasi tidak berbunyi.**
Notifikasi hanya dikirim untuk **sebutan baru**. Menyimpan ulang tanpa menambah sebutan
baru tidak mengirim notifikasi.

**Tugas berulang muncul sebagai tugas baru.**
Itu memang perilakunya: saat tugas berulang ditandai **Selesai**, tugas berikutnya
dibuat otomatis dengan tenggat lanjutan.

**Batang kalender tidak sampai tenggat padahal tugas belum selesai.**
Batang hanya dipotong bila tugas **berstatus Selesai**. Kalau belum selesai, periksa
tenggat dan tanggal mulai tugas tersebut.

---

Dokumen ini mengikuti perilaku aplikasi per **2 November 2026**. Bila tampilan berubah,
perbarui bagian yang terkait di file ini: `docs/TUTORIAL-task-planner.md`.
