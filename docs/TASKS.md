# Tasks (TASKS.md)

Status: Active
Last updated: 2026-09-29
*(Append-only: tambahkan tugas baru atau perbarui status tugas yang ada, jangan menghapus riwayat perubahan)*

## How to Use
Sebelum memulai pekerjaan:
1. Temukan tugas berikutnya yang bertatus `todo`.
2. Ubah status menjadi `in_progress` saat mulai dikerjakan.
3. Kerjakan hanya **satu tugas** dalam satu waktu (sesuai Larangan Keras No. 10 di `AGENTS.md`).
4. Ubah status menjadi `done` **hanya jika** seluruh kriteria di `AGENTS.md > Definition of Done` telah terpenuhi.

---

## Backlog

### Milestone 1: Monorepo Foundation & Core Domain Logic (`packages/shared`)

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T001** | Inisialisasi arsitektur monorepo `npm workspaces` (`apps/web`, `apps/server`, `packages/shared`), root `package.json`, `tsconfig.json` dasar (strict mode), dan script build/lint/typecheck. | Monorepo Structure (ARCH 2 & 3) | P0 | done | Mengunci dependensi dan versi Node.js 22 LTS. |
| **T002** | Definisikan tipe TypeScript dan skema validasi Zod untuk seluruh model data domain (`categories`, `habits`, `habit_schedules`, `logs`, `settings`, `sync_protocol`) di `packages/shared`. | Model Data (PRD 8.1 & ARCH 5) | P0 | done | Skema dipakai bersama oleh klien PWA dan server Fastify. |
| **T003** | Implementasikan fungsi murni utilitas domain di `packages/shared/src/logic/`: pembuatan deterministic ID log (`UUID v5(habit_id + ":" + date)`), pembanding LWW dengan tie-break `device_id`, dan konversi tanggal dengan offset "jam mulai hari" (misal: 04:00). | Aturan Waktu & LWW (PRD 7.1, ARCH 5 & 6) | P0 | done | Wajib disertai unit test 100% lulus di Vitest. |
| **T004** | Bangun mesin kalkulasi murni *Streak Counter* dan *Rasio Keberhasilan* di `packages/shared/src/logic/` beserta rangkaian unit test komprehensif mencakup seluruh skenario PRD 7.1 s.d. 7.5 dan PRD 11.2 (harian, hari tertentu, X kali per minggu, nilai parsial, edit log lampau, perubahan frekuensi `effective_from`, dan habit diarsipkan). | Streak Counter & Rasio (PRD 6, 7.3, 7.4 & 11.2) | P0 | done | Tidak ada streak yang disimpan permanen; selalu dihitung dinamis. |

### Milestone 2: Server Sync Service & Database (`apps/server`)

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T005** | Siapkan struktur database PostgreSQL: buat file migrasi SQL bernomor (`deploy/migrations/001_init.sql`) untuk seluruh tabel dengan constraint `UNIQUE(habit_id, date)` dan indeks `server_seq`, serta konfigurasi Kysely query client di `apps/server`. | Model Data & Migrasi (PRD 8.1, ARCH 2 & 5) | P0 | done | Termasuk setup `compose.test.yml` untuk lingkungan test dev laptop. |
| **T006** | Bangun bootstrap Fastify di `apps/server`: validasi env saat start dengan Zod (fail-fast), middleware verifikasi Bearer token via `crypto.timingSafeEqual` terhadap hash SHA-256 di `DEVICE_TOKENS`, route `GET /api/v1/health`, dan integrasi `@fastify/static` untuk menyajikan PWA. | Keamanan & Config Server (ARCH 2, 7.2 & 8) | P0 | done | Host bind `127.0.0.1` di port 3001. |
| **T007** | Implementasikan endpoint transaksi sinkronisasi `POST /api/v1/sync` di `apps/server`: `pg_advisory_xact_lock`, validasi clock skew (> 5 menit), penolakan timestamp masa depan, resolusi mutasi LWW, pemberian `server_seq`, dan respons pull kursor dengan batas 500 baris. | Protokol Sync Server (PRD 8.2 & ARCH 6) | P0 | done | Idempoten: pengiriman batch mutasi yang sama tidak menduplikasi data. |
| **T008** | Buat rangkaian integration test di `apps/server` menggunakan PostgreSQL kontainer lokal (`compose.test.yml`): uji skenario 2 perangkat offline yang bentrok, replay batch identik, penolakan clock skew, konkurensi request push, dan paginasi `has_more`. | Strategi Pengujian (PRD 11.1 & ARCH 10) | P0 | done | Syarat wajib DoD sebelum modul sync dianggap selesai; 33 skenario integration test terverifikasi 100% lulus. |

### Milestone 3: Client Local-First Database & Sync Engine (`apps/web`)

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T009** | Inisialisasi basis data Dexie (IndexedDB) di `apps/web/src/db`: skema tabel, indeks majemuk `[habit_id+date]` dan `date`, integrasi `navigator.storage.persist()`, dan fungsi helper CRUD reaktif. | PWA & Offline Engine (PRD 6, 8.1, 8.4 & ARCH 5) | P0 | done | Menjamin query dashboard 35.000 log berjalan instan (< 0,3 detik). |
| **T010** | Bangun modul outbox dan sync engine di `apps/web/src/sync`: penggabungan mutasi per record (*coalescing*), mekanisme *apply-if-won* dari server, penanganan status offline vs server unreachable (Tailscale), dan penjadwalan ulang berkala dengan exponential backoff. | Sinkronisasi ke VPS (PRD 6, 8.2 & ARCH 6) | P0 | done | Mendukung status UI: Tersinkron, Menunggu (n), Tidak Terjangkau, Jam Skew. |

### Milestone 4: Daily Tracking UI & Habit Management (`apps/web`)

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T011** | Konfigurasi styling Tailwind CSS dan integrasi token CSS variables dari `DESIGN_SYSTEM.md` di `apps/web`, termasuk implementasi toggle tema (Light / Dark / System) dengan penyimpanan state di IndexedDB. | Design System (DESIGN_SYSTEM.md) | P0 | done | Fondasi modular siap menerima aset desain `.zip`. |
| **T012** | Bangun layout navigasi utama (Bottom bar untuk mobile, sidebar untuk desktop) dan halaman **"Hari Ini" (Daily Check-in)**: pemilih tanggal (termasuk tanggal lampau), daftar habit aktif, input centang checklist dan input kuantitatif (+/-), serta kalkulasi streak instan. | Daily Check-in & Flow 1 (PRD 6 & 9) | P0 | done | Interaksi instan nol-latensi langsung ke Dexie. |
| **T013** | Bangun halaman **"Kelola Habit"**: form tambah/edit habit, pemilihan kategori, konfigurasi frekuensi (harian, hari tertentu, X/minggu), opsi arsip, dan aksi hapus permanen dengan pembuatan tombstone berantai untuk anak entitas. | Habit CRUD & Kategori (PRD 6, 7.5, 8.1 & 9) | P0 | done | Konfirmasi dialog wajib sebelum menghapus habit permanen. |

### Milestone 5: Analytics Dashboard & Data Management (`apps/web`)

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T014** | Bangun halaman **"Analytics Dashboard"**: grafik garis tren mingguan/bulanan konsistensi (Recharts), metrik rasio keberhasilan (%), kartu ringkasan kategori, dan kalender kontribusi heatmap berbasis CSS Grid murni. | Analytics Dashboard (PRD 6, 7.4, 7.6 & ARCH 2) | P0 | done | Waktu render dashboard < 1 detik untuk rentang data bulanan. |
| **T015** | Bangun halaman **"Data & Pengaturan"**: fitur Export JSON lengkap, fitur Import/Restore JSON dengan modal ringkasan (jumlah habit & log) sebelum eksekusi, form pengaturan Device Token, dan indikator peringatan jika sync > 7 hari atau backup > 30 hari. | Export/Import JSON & Backup (PRD 6, 8.3, 8.4 & ARCH 9) | P0 | done | Fitur proteksi data lapisan 4 untuk pemulihan bencana. |

### Milestone 6: PWA Offline Shell, Hardening & Deployment

| ID | Task | Derived from (PRD feature) | Priority | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **T016** | Konfigurasi PWA penuh di `apps/web` menggunakan `vite-plugin-pwa` (Workbox): caching strategi App Shell untuk offline load 100%, web app manifest, icon set, dan dialog prompt pembaruan versi baru (*prompt user*). | PWA & Offline Engine (PRD 6 & ARCH 2) | P0 | todo | Pengujian offline manual di mode airplane / network throttling. |
| **T017** | Buat berkas-berkas deployment VPS: `deploy/Containerfile` (multi-stage build), `deploy/podman-compose.yml`, `deploy/backup.sh` (rotasi pg_dump harian), `deploy/.env.example`, dan panduan operasional Tailscale Serve port `:8443`. | Topologi & Deployment (ARCH 4, 7 & 8) | P0 | todo | Memastikan port 443 JobFlow di VPS aman tidak terganggu. |
| **T018** | Eksekusi audit performa akhir dan verifikasi lintas platform: audit Lighthouse di browser fisik (warm start < 0,3 detik, cold start < 1 detik), uji coba sinkronisasi dua perangkat, dan pencatatan hasil di `PROGRESS.md`. | Kriteria Keberhasilan (PRD 11.1 & AGENTS 5) | P0 | todo | Verifikasi akhir sebelum status proyek dinyatakan siap produksi. |
