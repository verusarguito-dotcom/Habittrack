# Product Requirements Document (PRD)

Status: Active
Last updated: 2026-09-29

## 1. Product Overview
- **Nama Produk:** VibeHabit (Personal Habit Tracker & Analytics)
- **Deskripsi Singkat:** Aplikasi pelacak kebiasaan pribadi berbasis Local-First PWA, dengan dashboard analitik dan sinkronisasi dua arah ke PostgreSQL di VPS milik sendiri.
- **Visi:** Memberi kejelasan progres harian dan wawasan konsistensi jangka panjang, tanpa bergantung pada koneksi internet dan tanpa menyerahkan data ke pihak lain.

## 2. Problem Statement
Konsistensi habit sulit dijaga tanpa visualisasi progres yang jelas. Aplikasi komersial yang ada dinilai (asumsi pribadi, belum diverifikasi) terlalu bergantung pada internet, terlalu kaku dalam target, atau membatasi kepemilikan data.

## 3. Goal v1
Aplikasi pribadi yang ringan dan cepat untuk:
1. Mengelola habit (tambah, ubah, arsipkan, hapus).
2. Mencatat progres harian.
3. Menghitung streak dengan aturan yang terdefinisi jelas.
4. Menampilkan analitik mingguan dan bulanan.
5. Menjaga data tetap aman lewat penyimpanan lokal, sinkronisasi ke VPS, dan backup JSON yang bisa dipulihkan.

## 4. Target User
Satu orang (pemilik aplikasi), memakai satu laptop dan satu smartphone. Tidak ada pengguna lain.

## 5. Asumsi dan Batasan
- **Platform:** PWA, berjalan di desktop dan mobile.
- **Offline:** Seluruh fitur inti harus berjalan tanpa internet setelah aplikasi terpasang. Kunjungan pertama membutuhkan internet untuk memuat App Shell.
- **Backend:** Sync service ringan yang terhubung ke PostgreSQL di VPS pribadi. Menggunakan infrastruktur yang sudah ada, tanpa biaya tambahan.
- **Skala data:** 5 sampai 20 habit aktif, histori sampai 5 tahun (perkiraan maksimal sekitar 35.000 log).
- **Zona waktu:** Mengikuti zona waktu perangkat. Tanggal log disimpan sebagai tanggal lokal (format YYYY-MM-DD), bukan timestamp UTC, supaya tidak bergeser saat zona waktu berubah.
- **Single-user, tetapi tidak tanpa keamanan:** Tidak ada registrasi, login, atau multi-user. Namun endpoint sync di internet wajib dilindungi (lihat bagian 8).

## 6. Fitur v1
| Fitur | Prioritas | Keterangan |
| :--- | :---: | :--- |
| **Habit CRUD** | **P0** | Tambah, ubah, arsipkan, dan hapus permanen habit. |
| **Kategori** | **P0** | Satu kategori per habit (misalnya Kesehatan, Belajar, Karir, Ibadah). Kategori bisa ditambah sendiri. |
| **Target fleksibel** | **P0** | Mode checklist (selesai atau belum) atau mode kuantitatif (angka target dan satuan, misalnya 30 menit). |
| **Frekuensi** | **P0** | Harian, hari tertentu dalam seminggu, atau X kali per minggu. |
| **Daily Check-in** | **P0** | Tampilan "Hari Ini" untuk mencatat progres dengan cepat. Bisa memilih tanggal lampau. |
| **Streak Counter** | **P0** | Dihitung otomatis dari log sesuai aturan bagian 7. |
| **Analytics Dashboard** | **P0** | Tren mingguan dan bulanan, rasio keberhasilan, distribusi per kategori. |
| **PWA dan Offline Engine** | **P0** | Service Worker dan IndexedDB. Meminta penyimpanan persisten lewat `navigator.storage.persist()`. |
| **Sinkronisasi ke VPS** | **P0** | Dua arah, otomatis di latar belakang saat online, sesuai aturan bagian 8. Dinaikkan ke P0 karena data lokal browser bisa terhapus. |
| **Export dan Import JSON** | **P0** | Ekspor seluruh data dan pulihkan (*restore*) dari file JSON. Backup tanpa restore dianggap tidak berguna. |
| **Tag (banyak per habit)** | **P2** | Ditunda. Bisa ditambah setelah v1 stabil. |

## 7. Aturan Bisnis (Definisi yang Harus Diuji)

### 7.1 Hari dan Waktu
- Pergantian hari mengikuti pengaturan "jam mulai hari" (default 00:00, bisa diubah misalnya 04:00 bagi yang sering begadang).
- Log memakai tanggal lokal sesuai aturan pergantian hari tersebut.

### 7.2 Status Keberhasilan Satu Hari
- **Mode checklist:** Berhasil jika dicentang.
- **Mode kuantitatif:** Berhasil jika nilai yang dicatat lebih besar atau sama dengan target. Nilai parsial (misalnya 15 dari 30 menit) tetap tersimpan dan ditampilkan sebagai progres, tetapi tidak dihitung berhasil.

### 7.3 Streak
- **Habit harian:** Jumlah hari terjadwal berturut-turut yang berhasil.
- **Habit hari tertentu:** Hari yang tidak dijadwalkan dilewati dan tidak memutus streak.
- **Habit X kali per minggu:** Streak dihitung dalam satuan minggu, yaitu jumlah minggu berturut-turut dengan jumlah keberhasilan minimal X. Minggu dimulai hari Senin.
- Hari ini yang belum dicentang tidak memutus streak sampai hari tersebut berakhir.
- Streak tidak disimpan sebagai angka tetap. Streak selalu dihitung ulang dari log, sehingga mengedit log lampau langsung memperbarui streak.
- Ditampilkan dua nilai: streak saat ini dan streak terpanjang.

### 7.4 Rasio Keberhasilan
- Rasio = jumlah hari terjadwal yang berhasil dibagi jumlah hari terjadwal, dihitung dari tanggal habit dibuat sampai hari ini.
- Hari ini hanya dihitung jika sudah berhasil atau hari sudah berakhir.
- Hari yang tidak dijadwalkan dikecualikan dari penyebut.

### 7.5 Perubahan Habit
- Perubahan frekuensi atau target berlaku mulai tanggal perubahan (`effective_from`). Histori sebelumnya dihitung dengan aturan lama.
- **Mengarsipkan habit:** Habit hilang dari tampilan harian, histori tetap ada, dan bisa disertakan atau disembunyikan di dashboard.
- **Menghapus permanen:** Habit dan seluruh lognya dihapus, disertai konfirmasi. Penghapusan tetap disinkronkan sebagai tombstone (lihat bagian 8).

### 7.6 Kategori pada Dashboard
- Distribusi kategori memakai satu kategori per habit. Habit tanpa kategori masuk ke "Tanpa Kategori".

## 8. Aturan Sinkronisasi dan Data

### 8.1 Model Data
Semua tabel memakai kolom standar berikut:
- `id`: UUID yang dibuat di sisi klien (bukan auto-increment).
- `updated_at`: Waktu perubahan terakhir.
- `deleted_at`: null jika aktif. Berisi waktu jika dihapus (soft delete atau tombstone).
- `device_id`: Perangkat yang terakhir mengubah.

Tabel utama:
- `categories`: `id`, `nama`.
- `habits`: `id`, `nama`, `category_id`, `mode` (checklist atau kuantitatif), `satuan`, `archived`, `created_date`.
- `habit_schedules`: `id`, `habit_id`, `tipe frekuensi`, `hari terjadwal` atau `jumlah per minggu`, `target`, `effective_from`.
- `logs`: `id`, `habit_id`, `tanggal` (YYYY-MM-DD), `nilai`, `selesai` (boolean). Satu log per habit per tanggal (unique).
- `settings`: `jam mulai hari`, dan pengaturan lain.

### 8.2 Aturan Sync
- **Model:** Antrean perubahan lokal (*outbox*) dikirim ke server saat online. Klien menarik perubahan baru dari server memakai kursor `server_seq` yang diberikan server.
- **Penyelesaian konflik:** Last-Write-Wins (LWW) per record berdasarkan `updated_at`. Jika `updated_at` sama, `device_id` dipakai sebagai penentu tetap (deterministik).
- **Sumber waktu:** Karena jam perangkat bisa salah, server mencatat `server_seq` sebagai urutan resmi, dan klien menolak atau memperingatkan jika selisih jam perangkat dengan server melebihi 5 menit.
- **Penghapusan:** Selalu memakai `deleted_at` (tombstone). Tombstone tidak dibersihkan sebelum 90 hari.
- **Idempoten:** Mengirim perubahan yang sama dua kali tidak boleh menghasilkan duplikat.
- **Kegagalan:** Sync yang gagal diulang otomatis dengan jeda bertahap. Aplikasi tidak boleh terblokir atau kehilangan data karena sync gagal.
- **Indikator status:** Tampilkan status sederhana: tersinkron, menunggu sinkron (dengan jumlah perubahan), atau gagal.

### 8.3 Keamanan Minimal
- Endpoint hanya dapat diakses lewat HTTPS.
- Setiap request wajib membawa API token. Satu token per perangkat, disimpan di pengaturan perangkat dan bisa dicabut dari server.
- Dibatasi akses server lewat VPN pribadi (Tailscale), sehingga endpoint tidak terbuka ke publik.
- Backup database PostgreSQL di VPS dijadwalkan (harian) dan dicantumkan sebagai tugas operasional, di luar aplikasi.

### 8.4 Perlindungan Penyimpanan Lokal
- Panggil `navigator.storage.persist()` saat aplikasi pertama dipasang.
- Tampilkan peringatan jika sync belum pernah berhasil dalam lebih dari 7 hari atau backup JSON terakhir lebih dari 30 hari.
- Catatan risiko: perilaku browser (terutama Safari iOS) dalam membersihkan data situs perlu diverifikasi ke dokumentasi terbaru sebelum implementasi.

## 9. User Flows
1. **Check-in Harian:**  
   Buka aplikasi dan masuk ke tampilan "Hari Ini" → Centang habit atau isi nilai kuantitatif → Streak dan progres diperbarui langsung → Data disimpan ke IndexedDB, lalu masuk antrean sync jika offline.
2. **Analisis Dashboard:**  
   Buka tab "Analytics" → Pilih rentang waktu (mingguan atau bulanan) → Lihat grafik tren, rasio keberhasilan, dan distribusi kategori.
3. **Kelola Habit:**  
   Buka menu "Kelola Habit" → Tambah habit baru (nama, kategori, mode target, frekuensi) atau ubah, arsipkan, hapus → Daftar diperbarui otomatis.
4. **Backup dan Restore:**  
   Buka menu "Data" → Pilih Export JSON untuk menyimpan, atau Import JSON untuk memulihkan → Import menampilkan ringkasan (jumlah habit dan log) sebelum menimpa atau menggabungkan data.

## 10. Out of Scope v1
- Login, registrasi, dan multi-user.
- Notifikasi push atau alarm native.
- Fitur sosial, leaderboard, dan berbagi.
- Tag banyak per habit (ditunda ke P2).

> **Risiko yang diakui:** Tanpa pengingat, konsistensi penggunaan bergantung pada kebiasaan membuka aplikasi. Jika dalam 30 hari pertama frekuensi penggunaan rendah, pertimbangkan pengingat sederhana sebagai fitur v1.1.

## 11. Kriteria Keberhasilan

### 11.1 Teknis (Diukur di perangkat milik sendiri, dengan 10 habit dan histori 2 tahun)
- **Warm start setelah aplikasi terpasang:** Tampilan "Hari Ini" muncul dalam waktu kurang dari 0,3 detik.
- **Cold start setelah aplikasi terpasang:** Kurang dari 1 detik.
- **Dashboard:** Tampil dalam waktu kurang dari 1 detik untuk rentang bulanan.
- **Skenario uji sync:** Laptop dan smartphone sama-sama offline, masing-masing membuat 50 perubahan (termasuk edit dan hapus pada record yang sama), lalu online. Hasil yang diharapkan: tidak ada record hilang atau duplikat, dan kedua perangkat menampilkan data identik.
- **Hasil Export lalu Import:** Pada instalasi kosong menghasilkan data identik dengan sumber.

### 11.2 Kebenaran Perhitungan
Streak, rasio keberhasilan, dan grafik lolos seluruh kasus uji otomatis yang mencakup: habit harian, hari tertentu, X kali per minggu, nilai parsial, edit log lampau, perubahan frekuensi, habit diarsipkan, dan pergantian hari di jam mulai kustom.

### 11.3 Tujuan Pribadi (Konsistensi)
Selama 30 hari pertama pemakaian: jumlah hari dengan minimal satu check-in adalah 5 dari 7 hari atau lebih per minggu, rata-rata.
