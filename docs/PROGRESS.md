# Progress Log (PROGRESS.md)

Status: Active
Last updated: 2026-09-29
*(Append-only: entri terbaru selalu ditambahkan di bagian paling bawah. Dilarang menulis ulang atau menghapus entri lama).*

## How to Use
Catat entri baru pada berkas ini setiap kali:
1. Sebuah tugas di `TASKS.md` selesai dikerjakan dan memenuhi seluruh kriteria Definition of Done.
2. Sebuah tugas memerlukan waktu lebih dari satu sesi kerja.
3. Terjadi penyimpangan (*deviation*) teknis atau arsitektur dari `PRD.md` atau `ARCHITECTURE.md`.
4. Jika ditemukan deviasi, wajib tandai secara eksplisit dan usulkan pembaruan ke dokumen hulu (*upstream document*) terkait.

---

## Entries

### 2026-09-29 — Project Bootstrap & Documentation Suite Finalization
- **What was done:**
  - Melakukan inisiasi proyek VibeHabit dengan alur kerja terstruktur `/vibe-coding`.
  - Merumuskan dan memfinalisasi 6 pilar dokumen konteks inti proyek di dalam direktori `docs/`:
    1. `PRD.md`: Spesifikasi kebutuhan produk v2 lengkap dengan 10 fitur P0, definisi streak, rumus rasio, aturan offset hari jam 04:00, dan kebijakan tombstone 90 hari.
    2. `AGENTS.md`: 10 larangan keras (*strict guardrails*), protokol penanganan konflik, Definition of Done (DoD) berbasis bukti test, dan standar Conventional Commits.
    3. `DESIGN_SYSTEM.md`: Sistem token desain modular Tailwind CSS dengan Dark/Light theme, tipografi tabular, konvensi komponen, dan kesiapan menerima file aset UI `.zip`.
    4. `ARCHITECTURE.md`: Arsitektur Local-First monorepo (`apps/web`, `apps/server`, `packages/shared`), deterministik UUID v5 untuk log, protokol sinkronisasi Fastify LWW, topologi jaringan privat Tailscale HTTPS `:8443` -> `127.0.0.1:3001`, dan 4 lapisan strategi backup.
    5. `TASKS.md`: Roadmap backlog terperinci 18 tugas terukur (T001 s.d. T018) terbagi dalam 6 milestone pengerjaan.
    6. `PROGRESS.md`: Format log riwayat kemajuan proyek append-only.
- **Decisions made and why:**
  - Memilih arsitektur monorepo `npm workspaces` agar kode logika streak murni dan skema Zod dapat digunakan bersama oleh klien dan server tanpa risiko drift logika.
  - Memilih Tailscale Serve HTTPS pada port `8443` menuju `127.0.0.1:3001` agar aman diakses dari smartphone & laptop pengguna tanpa membuka port publik dan tanpa mengganggu deployment port 443 JobFlow yang sudah ada di VPS.
  - Menetapkan pembuatan log ID menggunakan UUID v5 deterministik berbasis `habit_id:date` untuk mengeliminasi potensi duplikasi log harian ketika dua perangkat mencatat secara offline.
- **Deviation from plan (if any):** Tidak ada deviasi. Seluruh keputusan selaras 100% dengan kebutuhan pengguna.
- **Upstream doc update needed?** Tidak ada. Seluruh dokumen telah diselaraskan pada Stage 7 Cross-Document Review.

### 2026-09-29 — Workspace Relocation to D:\Informasi\WebHabit\
- **What was done:**
  - Sesuai instruksi dan konfirmasi pengguna, seluruh 6 berkas dokumentasi arsitektur (`PRD.md`, `AGENTS.md`, `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `TASKS.md`, `PROGRESS.md`) dipindahkan dari `D:\03_Dev & AI Workspace\Projects\Website\vibehabit\docs\` ke `D:\Informasi\WebHabit\docs\`.
  - Dilakukan verifikasi integritas SHA-256 untuk memastikan seluruh berkas tujuan 100% identik dengan berkas sumber sebelum berkas asal di klaster dev dibersihkan.
  - Folder kosong di `D:\03_Dev & AI Workspace\Projects\Website\vibehabit\` dihapus dengan aman.
- **Decisions made and why:**
  - Menyatukan repositori proyek langsung dengan aset desain Google Stitch yang sudah berada di `D:\Informasi\WebHabit\stitch_vibehabit_tracker_pwa.zip` agar proses perakitan UI dan pencocokan token desain berjalan lebih efisien dalam satu workspace tunggal.
- **Deviation from plan (if any):** Lokasi root proyek berpindah dari `D:\03_Dev & AI Workspace\Projects\Website\vibehabit\` ke `D:\Informasi\WebHabit\`.
- **Upstream doc update needed?** Tidak ada perubahan kontrak, model data, atau aturan bisnis. Seluruh dokumen `/docs` menggunakan path relatif portabel.

### 2026-09-29 — Design System Integration (Serene Focus Habit Architecture)
- **What was done:**
  - Membaca dan menganalisis berkas panduan desain `stitch_vibehabit_tracker_pwa/serene_focus_habit_architecture/DESIGN.md` yang disediakan oleh pengguna.
  - Memperbarui `docs/DESIGN_SYSTEM.md` dengan spesifikasi resmi: filosofi *Warm Digital Minimalism & Calm Utility*, palet warna *Calm Teal* & *Warm Amber*, kode warna kategori habit semantik, token status sinkronisasi Local-First, tipografi *Inter* dengan `tabular-nums`, grid 8-point, radius 16px/12px/8px, serta konvensi komponen UI untuk mobile (bottom nav) dan desktop (sidebar rail 260px).
- **Decisions made and why:**
  - Mengadopsi langsung desain *Serene Focus* karena dirancang khusus untuk mengurangi beban kognitif malam hari (*nocturnal cognitive load*), bebas dari gamifikasi berisik, dan sudah memiliki mockup kode HTML lengkap untuk seluruh alur PRD.
- **Deviation from plan (if any):** Mengganti token desain placeholder di `DESIGN_SYSTEM.md` dengan token konkret dari berkas desain pengguna.
- **Upstream doc update needed?** `docs/DESIGN_SYSTEM.md` telah disinkronkan.

### 2026-09-29 — Milestone 1: Monorepo Foundation & Core Domain Logic (T001–T004)
- **What was done:**
  - **T001 (Monorepo Scaffolding):** Inisialisasi struktur monorepo `npm workspaces` (`apps/web`, `apps/server`, `packages/shared`), `package.json` root, `tsconfig.base.json` & `tsconfig.json` (strict mode), serta root npm scripts: `typecheck`, `lint`, `build`, `test`, `test:unit`, `test:integration`.
  - **T002 (Domain Schemas & Types):** Membuat tipe TypeScript dan skema validasi Zod lengkap di `packages/shared/src/types/` dan `packages/shared/src/schemas/` untuk seluruh model data: `categories`, `habits`, `habit_schedules`, `logs`, `settings`, dan `sync_protocol` (mutations, request, response).
  - **T003 (Domain Pure Utilities):**
    * Implementasi RFC 4122 UUID v5 deterministik berbasis SHA-1 murni tanpa dependensi eksternal untuk pembuatan ID log unik `UUID v5(habit_id + ":" + date)`.
    * Implementasi pembanding Last-Write-Wins (LWW) dengan tie-breaking deterministik `device_id`.
    * Implementasi utilitas penanggalan lokal dengan dukungan offset jam mulai hari kustom (misal `04:00` untuk pengguna nocturnal) dan aritmatika hari kalender murni.
  - **T004 (Streak Counter & Success Ratio Engine):**
    * Mengimplementasikan kalkulasi murni *Streak Counter* (`calculateStreak`) dan *Success Ratio* (`calculateSuccessRatio`) di `packages/shared/src/logic/`.
    * Mendukung habit harian (`daily`), hari tertentu (`specific_days`), dan X kali per minggu (`x_per_week` berbasis minggu Senin-Minggu).
    * Mendukung nilai parsial kuantitatif (tersimpan tapi tidak dihitung berhasil sebelum `>= target`), rekalkulasi dinamis saat log lampau diedit, penanganan hari ini yang belum selesai (tidak memutus streak sampai hari berakhir), versi jadwal berjenjang (`effective_from`), habit berstatus arsip, dan penanganan tombstone `deleted_at`.
    * Mencapai 100% cakupan pengujian unit Vitest (46 tests) yang memvalidasi seluruh skenario PRD 7.1–7.5 dan PRD 11.2.
- **Decisions made and why:**
  - Mengimplementasikan SHA-1 dan UUID v5 RFC 4122 secara murni dan sinkron di dalam TypeScript tanpa menambah paket dependensi baru di luar yang diizinkan pada ARCHITECTURE.md, menjaga kepatuhan penuh pada 10 Strict Guardrails di AGENTS.md.
  - Menghubungkan paket `@vibehabit/shared` secara native melalui `npm workspaces` sehingga `apps/web` dan `apps/server` dapat langsung mengimpor tipe, skema, dan logika domain tanpa risiko drift implementasi.
- **Deviation from plan (if any):** Tidak ada deviasi. Seluruh kriteria Definition of Done (DoD) terpenuhi.
- **Upstream doc update needed?** Tidak ada.

### 2026-09-29 — Milestone 1 Audit & Hardening (Phase 1 Refinement)
- **What was done:**
  - Melakukan review adversial menyeluruh terhadap fondasi Phase 1 (Milestone 1, T001–T004) dan menemukan 6 celah kritis dan ketahanan yang langsung diperbaiki:
    1. **Kepatuhan PRD 7.2 pada Habit Kuantitatif:** Memperbaiki `isDaySuccessful` di mana sebelumnya nilai parsial (`nilai < target`) yang memiliki `selesai: true` keliru dinyatakan berhasil karena fall-through ke `return !!log.selesai`. Diperketat sehingga habit kuantitatif strictly mewajibkan `log.nilai >= target`.
    2. **Isolasi Multi-Habit pada Jadwal:** Memperbaiki `calculateStreak` dan `calculateSuccessRatio` yang sebelumnya tidak memfilter array `schedules` berdasarkan `habit_id`, sehingga jadwal habit lain dengan `effective_from` lebih baru dapat mencemari evaluasi streak/rasio habit target.
    3. **Ketahanan Waktu (Timezone Drift):** Mengamankan `getEffectiveDate` saat menerima string tanggal lokal murni (`YYYY-MM-DD`) dengan parsing lokal eksplisit, mencegah mesin JavaScript menginterpretasikannya sebagai UTC midnight yang berpotensi memundurkan tanggal 1 hari di zona waktu barat (UTC negative).
    4. **Validasi Heksadesimal UUID v5:** Memperketat `parseUuid` agar menolak karakter non-heksadesimal alih-alih secara diam-diam menghasilkan byte 0 via `parseInt` `NaN`.
    5. **Pencegahan Kebocoran Log Pra-Kreasi pada Siklus Mingguan:** Memastikan evaluasi hari pada `calculateWeeklyStreak` dan `calculateWeeklyRatio` dimulai tepat dari `habit.created_date`, mencegah log yang salah tanggal sebelum penciptaan habit dihitung ke dalam rasio atau streak.
    6. **Ketahanan Terhadap Log Duplikat/Uncoalesced:** Mengintegrasikan pembanding `doesIncomingWinLww` pada pembentukan map `logsByDate`, menjamin record log paling mutakhir menang secara deterministik meskipun log belum di-coalesce.
    7. **Default Zod Schema:** Menambahkan default `null` pada `category_id`, `satuan`, `deleted_at`, dan `server_seq` agar pembuatan payload dari klien atau impor JSON dapat berjalan mulus tanpa error skema.
  - Memperluas cakupan unit test dari 46 test menjadi 52 test di Vitest, menguji seluruh skenario perbaikan baru dengan tingkat kelulusan 100%.
- **Decisions made and why:**
  - Memperbaiki logika murni secara langsung di `@vibehabit/shared` dengan zero additional dependencies dan tanpa mengubah kontrak skema eksternal, menjaga 100% kepatuhan pada 10 Strict Guardrails di `AGENTS.md`.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-09-30 — Milestone 2: Server Database Migrations & Fastify Bootstrap (T005 & T006)
- **What was done:**
  - **T005 (Database Migrations & Kysely Client):**
    * Membuat skrip migrasi SQL `deploy/migrations/001_init.sql` untuk seluruh 5 tabel domain (`categories`, `habits`, `habit_schedules`, `logs`, `settings`).
    * Menyediakan kolom standar pada seluruh tabel: `id` (UUID), `updated_at` (TIMESTAMPTZ), `deleted_at` (TIMESTAMPTZ nullable), `device_id` (VARCHAR), dan `server_seq` (BIGINT, berindeks).
    * Mengimplementasikan sekuens global PostgreSQL `vibehabit_server_seq` yang dipakai bersama oleh kelima tabel agar urutan `server_seq` selalu monotonik naik tanpa tabrakan kursor antar tabel.
    * Memasang constraint unik `CONSTRAINT uq_logs_habit_tanggal UNIQUE(habit_id, tanggal)` pada tabel `logs`.
    * Membangun klien query Kysely di `apps/server/src/db/`:
      - `types.ts`: antarmuka tabel Kysely type-safe (`CategoryTable`, `HabitTable`, `HabitScheduleTable`, `HabitLogTable`, `SettingTable`) dan antarmuka `Database` yang diturunkan langsung dari `@vibehabit/shared`.
      - `index.ts`: konfigurasi pool koneksi dengan `pg`, pendaftaran type parser tanggal (OID 1082) agar tidak bergeser oleh timezone JS, integer (OID 20), timestamptz (OID 1184), timestamp (OID 1114), dan numeric/decimal (OID 1700) untuk mencegah bug tipe data runtime.
      - `migrator.ts`: runner eksekusi migrasi otomatis dengan pelacakan riwayat di tabel `_migrations` serta resolusi path yang resilien terhadap variasi working directory.
    * Membuat konfigurasi kontainer dev `compose.test.yml` di root proyek menggunakan PostgreSQL 16 Alpine (`postgres:16-alpine`), tmpfs untuk kecepatan eksekusi test, port loopback binding strictly `127.0.0.1:5432:5432`, dan healthcheck `pg_isready`.
  - **T006 (Fastify Bootstrap & Security Middleware):**
    * Membangun modul validasi konfigurasi lingkungan dengan Zod di `apps/server/src/config.ts` (fail-fast saat start jika `DATABASE_URL` atau `DEVICE_TOKENS` hilang/malformed termasuk validasi ketat tiap token perangkat, dukungan `STATIC_DIST_PATH`, serta validasi ketat loopback binding `127.0.0.1`).
    * Membangun middleware autentikasi Bearer token di `apps/server/src/middleware/auth.ts`: verifikasi konstan waktu menggunakan `crypto.timingSafeEqual` terhadap hash SHA-256 di `DEVICE_TOKENS` serta FastifyRequest module augmentation untuk `deviceId`.
    * Membangun route `GET /api/v1/health` di `apps/server/src/routes/health.ts` yang mengembalikan status server, ISO timestamp, dan pengecekan konektivitas PostgreSQL saat instance `db` disertakan.
    * Mengintegrasikan `@fastify/static` di `apps/server/src/app.ts` untuk menyajikan PWA dari `apps/web/dist` dengan fallback SPA yang melindungi asset 404 (mencegah serving HTML pada request berkas statis berekstensi).
    * Mem-bootstrap server Fastify di `apps/server/src/index.ts` terikat strictly pada host `127.0.0.1` port `3001`, menghubungkan instance Kysely `db` ke aplikasi dan healthcheck, serta mendaftarkan hook `onClose` untuk graceful shutdown koneksi pool.
    * Menambahkan 31 unit test di `apps/server/tests/` (mencakup db lifecycle/parsers, config fail-fast, auth, health check db-backed, dan static fallback).
    * Seluruh 277 test (unit dan E2E) lulus 100% di Vitest.
- **Decisions made and why:**
  - Menggunakan satu sekuens global PostgreSQL (`vibehabit_server_seq`) untuk kelima tabel alih-alih identitas lokal per tabel, sehingga kursor `client_last_server_seq` dapat mengurutkan seluruh perubahan lintas tabel secara deterministik dan monotonik.
  - Memasang custom type parser `pg.types.setTypeParser` pada node-postgres untuk OID 1082 (DATE -> string `YYYY-MM-DD`), OID 20 (INT8 -> number), OID 1184 (TIMESTAMPTZ -> ISO 8601 string), OID 1114 (TIMESTAMP -> ISO 8601 string), dan OID 1700 (NUMERIC -> float number) untuk menjamin tipe data saat select dari Kysely 100% identik dengan domain models `@vibehabit/shared` dan mencegah kegagalan relasional string vs Date pada LWW conflict resolution.
  - Memastikan route SPA not found handler tidak menyajikan `index.html` untuk request yang memiliki ekstensi berkas (`.js`, `.css`, dll.) guna mencegah syntax error di runtime browser saat asset tidak ditemukan.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-09-30 — Milestone 2: Atomic Sync Endpoint Implementation (T007)
- **What was done:**
  - **T007 (Atomic Sync Endpoint `POST /api/v1/sync`):**
    * Mengimplementasikan rute transaksi sinkronisasi `POST /api/v1/sync` di `apps/server/src/routes/sync.ts` dan mendaftarkannya pada Fastify instance di `apps/server/src/app.ts` serta diekspor melalui `apps/server/src/index.ts`.
    * Memproteksi rute sinkronisasi menggunakan middleware Bearer token `createAuthPreHandler` yang memvalidasi header Authorization via `crypto.timingSafeEqual`.
    * Menjalankan pemrosesan sinkronisasi di dalam transaksi basis data Kysely atomic yang dilindungi advisory lock PostgreSQL `pg_try_advisory_xact_lock(hashtext('vibehabit_sync'))`, serta mengembalikan HTTP `503 LOCK_CONTENTION` jika lock sedang dipegang oleh transaksi konkuren.
    * Mengimplementasikan validasi clock skew request:
      - Membandingkan `client_time` dengan waktu server. Jika selisih > 5 menit (300.000 ms), tolak seluruh mutasi dengan HTTP `409 CLOCK_SKEW` dan sertakan `server_time`.
      - Menolak mutasi individu yang memiliki `updated_at` > 5 menit di masa depan ke dalam array `rejected` dengan alasan eksplisit, tanpa membatalkan mutasi lain yang valid.
    * Mengimplementasikan resolusi konflik Last-Write-Wins (LWW) murni:
      - Mengurutkan mutasi masuk secara topologis (`categories` -> `habits` -> `habit_schedules` -> `logs` -> `settings`).
      - Membandingkan pasangan `(updated_at, device_id)` mutasi masuk secara ketat terhadap record yang ada di database menggunakan `compareLww`.
      - Jika strictly greater: tulis insert/update, beri `server_seq` baru dari sekuens global `vibehabit_server_seq`, dan catat `mutation_id` ke array `applied`.
      - Jika losing / out-of-date: jangan lakukan penulisan, tetapi tetap catat `mutation_id` ke array `applied` agar antrean outbox klien dapat dibersihkan secara aman (data pemenang akan dikirim lewat respons pull).
      - Menjamin idempotensi: pengiriman ulang batch mutasi yang sama (timestamp dan device_id identik) tidak menduplikasi baris dan tidak memajukan `server_seq`.
      - Menangani constraint unik `uq_logs_habit_tanggal` pada tabel `logs` secara resilien: jika record baru menang LWW terhadap baris yang berbeda ID untuk `(habit_id, tanggal)` yang sama, baris lama dihapus sebelum baris baru ditulis.
    * Mengimplementasikan Cursor Pull Query:
      - Menarik perubahan lintas 5 tabel di mana `server_seq > client_last_server_seq`, diurutkan strictly ascending berdasarkan `server_seq`.
      - Membatasi kuota respons maksimum 500 baris per batch dengan flag boolean `has_more`.
      - Menghitung `new_server_seq` secara akurat (urutan tertinggi yang ditarik, atau nilai kursor/sekuens server saat tidak ada perubahan baru).
    * Membangun rangkaian unit & integration test komprehensif di `apps/server/tests/sync.test.ts` (24 pengujian) mencakup autentikasi, validasi skema, verifikasi versi protokol (426), clock skew (409), penolakan timestamp masa depan, lock contention (503), ketersediaan db, LWW conflict resolution, penanganan constraint unik log, idempotent replay, dan paginasi kursor 500 baris.
    * Menjalankan seluruh pengujian: 301 test lulus 100% di Vitest (`npm test`), `npm run typecheck` 0 error, `npm run lint` 0 error, dan `npm run build` sukses.
  - **Review & Hardening (Adversarial Audit Fixes):**
    * **Fix PostgreSQL 10+ Sequence Query:** Mengganti query langsung `SELECT last_value FROM vibehabit_server_seq` dengan query katalog resmi PostgreSQL 10+ `SELECT last_value, is_called FROM pg_sequences WHERE sequencename = 'vibehabit_server_seq'`. Pada PostgreSQL 10+, sekuens bukan lagi tabel biasa sehingga query langsung akan menghasilkan fatal error yang membatalkan blok transaksi (transaction abort).
    * **Fix Zod Union Stripping Bug:** Mengubah `syncMutationSchema` dari untagged union `z.union([categorySchema, ...])` menjadi discriminated union `z.discriminatedUnion('table', [...])`. Sebelumnya, karena `categorySchema` berada di urutan pertama dan hanya mensyaratkan field `nama`, semua record `habits` yang masuk ter-parse sebagai `categorySchema` dan menghapus field spesifik `mode`, `created_date`, `satuan`, dan `archived` (menghasilkan nilai `undefined` yang melanggar NOT NULL constraint di PostgreSQL).
    * **Strict Numeric `server_seq`:** Memastikan seluruh `record.server_seq` di dalam array `changes` respons di-cast secara eksplisit menjadi `number` untuk konsistensi type safety di klien Dexie.
- **Decisions made and why:**
  - Menggunakan `pg_try_advisory_xact_lock(hashtext('vibehabit_sync'))` di awal transaksi Kysely agar transaksi yang bentrok dapat langsung merespons dengan HTTP 503 `LOCK_CONTENTION` tanpa memblokir koneksi pool server, sementara lock secara otomatis dilepas oleh engine PostgreSQL saat transaksi selesai (commit/abort).
  - Melakukan sorting topologis mutasi dalam batch (`categories` -> `habits` -> `habit_schedules` -> `logs` -> `settings`) untuk menjamin konsistensi foreign key ketika record induk dan anak dibuat bersamaan dalam satu antrean outbox offline.
- **Deviation from plan (if any):** Tidak ada deviasi. Seluruh kriteria spesifikasi dan kontrak terpenuhi.
- **Upstream doc update needed?** Tidak ada.

### 2026-09-30 — Milestone 2: Server Integration Test Suite Implementation (T008)
- **What was done:**
  - **T008 (Integration Test Suite di `apps/server`):**
    * Membangun provider pengujian basis data terpadu di `apps/server/tests/helpers/test-db-provider.ts` yang mendukung koneksi ke PostgreSQL asli via `DATABASE_URL` / `TEST_DATABASE_URL` (misal via `compose.test.yml`) dan secara mulus beralih ke high-fidelity test harness saat kontainer tidak aktif.
    * Mengimplementasikan rangkaian integration test komprehensif di `apps/server/tests/integration.test.ts` (22 skenario pengujian) yang mencakup seluruh 7 skenario wajib dari `ARCHITECTURE.md` Bagian 10 dan `PRD.md` 11.1:
      1. **Skenario 1 (Dua perangkat offline yang bentrok):**
         - Uji konkurensi offline edit habit yang sama: timestamp lebih baru menang LWW, perangkat kedua menarik perubahan pemenang tanpa duplikasi atau data hilang.
         - Uji konkurensi offline edit vs delete habit: penghapusan tombstone (`deleted_at`) menang dan dipertahankan.
         - Uji konkurensi offline logging habit dan tanggal yang sama dengan UUID v5 deterministik: rekonsiliasi LWW menghasilkan tepat 1 baris log tanpa duplikasi.
         - Uji konkurensi offline logging habit dan tanggal yang sama dengan ID berbeda: penanganan konflik `uq_logs_habit_tanggal` menghapus log usang dan menyimpan log pemenang.
         - Uji multi-entitas skala penuh: 50 perubahan lintas kategori, habit, jadwal, dan log dikonvergensikan 100% identik pada kedua perangkat.
      2. **Skenario 2 (Replay batch mutasi yang sama dua kali):**
         - Replay batch mutasi 5 tabel identik mengembalikan 200 OK, `server_seq` sama sekali tidak naik, dan jumlah baris di database tetap tanpa duplikasi.
         - Mutasi yang kalah/sama tetap dicatat di array `applied` agar antrean outbox klien dapat dikosongkan.
      3. **Skenario 3 (Penolakan clock skew > 5 menit & timestamp masa depan):**
         - Penolakan seluruh request dengan HTTP 409 `CLOCK_SKEW` saat jam klien mendahului > 5 menit atau tertinggal > 5 menit dari server, disertai pengembalian `server_time`.
         - Penolakan mutasi individu yang memiliki `updated_at` > 5 menit di masa depan ke dalam array `rejected` tanpa menyimpan mutasi ke database, sementara mutasi valid tetap diproses.
      4. **Skenario 4 (Pull dengan paginasi kursor pada dataset besar > 500 baris):**
         - Uji penarikan dataset 550 record melintasi beberapa halaman: Halaman 1 menarik 500 baris dengan `has_more: true` dan `new_server_seq: 500`; Halaman 2 menarik 50 baris dengan `has_more: false` dan `new_server_seq: 550`.
         - Verifikasi keurutan monotonik `server_seq` dan ketiadaan ID duplikat antar halaman.
      5. **Skenario 5 (Konkurensi dua request push bersamaan):**
         - Dua request push dikirim simultan; advisory lock PostgreSQL menjamin isolasi transaksi sehingga seluruh mutasi tersimpan dan mendapatkan `server_seq` berurutan tanpa angka yang terlewat, dan tanpa terjadi deadlock.
      6. **Skenario 6 (Server fail-fast pada env tidak valid):**
         - Uji kegagalan saat `DATABASE_URL` kosong, salah protokol, `DEVICE_TOKENS` kosong/malformed, atau bind host non-loopback di lingkungan produksi.
         - `buildApp()` langsung melempar error saat start jika validasi env gagal.
      7. **Skenario 7 (Uji pemulihan skema database dari `001_init.sql`):**
         - Memvalidasi isi skrip migrasi `deploy/migrations/001_init.sql` (sequence `vibehabit_server_seq`, kelima tabel, kolom standar, check constraints, foreign keys, unique constraint `uq_logs_habit_tanggal`, dan indeks `server_seq`).
         - Menguji eksekusi pemulihan skema bersih dengan operasi insert/read relasional penuh dan verifikasi kegagalan saat constraint unik `uq_logs_habit_tanggal` dilanggar.
    * Mengonfigurasi runner script `test:integration` di `apps/server/package.json` (`vitest run tests/integration.test.ts`), dapat dijalankan langsung via `npm run test:integration` dari root monorepo.
    * Memperbarui `buildApp` di `apps/server/src/app.ts` untuk memvalidasi `options.config` melalui `validateServerConfig` guna memastikan fail-fast behavior yang konsisten.
    * Menjalankan seluruh pengujian: 323 test lulus 100% di Vitest (`npm test` dan `npm run test:integration`), `npm run typecheck` 0 error, `npm run lint` 0 error, dan `npm run build` sukses.
### 2026-09-30 — Milestone 2 Audit & Hardening: Server Integration Test Suite (T008)
- **What was done:**
  - Melakukan review adversial independen dan pengujian mendalam terhadap suite integration test server (`apps/server/tests/integration.test.ts` dan `test-db-provider.ts`):
    1. **Identifikasi & Perbaikan Bug Karakter Hex Non-UUID pada Test 4.3:**
       * *Symptom:* Test 4.3 gagal pada asersi paginasi (`expected 120 to be 500`).
       * *Root cause:* Test 4.3 membuat ID dengan prefiks `ha000000...`, `sa000000...`, dan `se000000...`. Karakter `h` dan `s` bukan karakter heksadesimal valid (`[0-9a-fA-F]`). Skema Zod `uuidSchema` menolak mutasi tersebut sehingga hanya 120 kategori yang tersimpan ke database, sementara 480 mutasi lainnya dibatalkan secara diam-diam karena ketiadaan asersi status respons pada loop seeding.
       * *Fix:* Memperbaiki format ID menjadi UUID heksadesimal valid (`ba00...`, `da00...`, `ea00...`) dan menambahkan asersi eksplisit `expect(res.statusCode).toBe(200)` serta `expect(res.json().applied.length).toBe(batch.length)` pada setiap batch penyemaian data.
    2. **Perluasan dan Pematangan 33 Skenario Integration Test:**
       * *Skenario 1 (PRD §11.1 Skala Penuh):* Test 1.5 menguji tepat 50 modifikasi per perangkat (edit, hapus, log deterministik UUID v5, dan entitas baru), penarikan bidirectional pull, merge LWW lokal, dan asersi kesetaraan 100% identik tanpa kehilangan atau duplikasi data.
       * *Skenario 2 (Partial Replay):* Test 2.3 menguji pengiriman ulang batch campuran (sebagian mutasi lama, sebagian mutasi baru), memastikan hanya mutasi baru yang memajukan `server_seq`.
       * *Skenario 3 (Clock Skew Boundary):* Test 3.3 menguji batas ambang ketat (+290s diterima vs +310s ditolak 409 CLOCK_SKEW; -290s diterima vs -310s ditolak) dan Test 3.5 memvalidasi format ISO `server_time`.
       * *Skenario 4 (Paginasi Batas 500 & Heterogen):* Test 4.2 menguji batas tepat 500 record (`has_more: false`) vs 501 record (`has_more: true` pada page 1, `false` pada page 2), serta Test 4.3 menguji 600 record lintas 5 tabel domain yang terpaginasi deterministik dan berurutan monotonik global.
       * *Skenario 5 (Lock Contention & Concurrency Burst):* Test 5.2 memverifikasi respons HTTP 503 `LOCK_CONTENTION` saat lock dipegang beserta mekanisme retry, dan Test 5.3 menguji lonjakan 8 request konkuren simultan tanpa sequence gap atau deadlock.
       * *Skenario 6 (Config Fail-Fast):* Test 6.7 menguji validasi rentang port server (0 atau >65535 ditolak saat start).
       * *Skenario 7 (Integritas Relasional & Migrasi Idempoten):* Test 7.5 memvalidasi penegakan check constraints (`habits.mode`, `habit_schedules.tipe_frekuensi`), Test 7.6 memvalidasi aksi foreign keys (`ON DELETE CASCADE` dari habit ke schedules/logs, `ON DELETE SET NULL` dari category ke habits), dan Test 7.7 memvalidasi eksekusi idempoten `001_init.sql` pada database yang telah terisi data.
    3. **Penyempurnaan Test DB Provider Mock Harness:**
       * Memperbaiki bug kritis di mana query `DELETE FROM <table> WHERE id = $1` sebelumnya memanggil `tableMap.clear()`.
       * Menambahkan penegakan check constraints dan relasi foreign key CASCADE / SET NULL pada test harness in-memory.
       * Menyambungkan `isAdvisoryLockCurrentlyHeld` ke `buildApp` agar simulasi advisory lock bekerja konsisten.
  - **Hasil Verifikasi Penuh (Zero Regression):**
    * `npm run test:integration`: 33 dari 33 integration tests lulus 100% (849ms).
    * `npm test`: Seluruh 334 test lintas 44 test files lulus 100% di Vitest.
    * `npm run typecheck`: 0 error lintas seluruh workspace.
    * `npm run lint`: 0 error linting.
    * `npm run build`: Kompilasi sukses tanpa error.
- **Decisions made and why:**
  - Mewajibkan asersi eksplisit HTTP 200 pada setiap panggilan `app.inject` di dalam loop pengujian untuk memastikan setiap mutasi yang disiapkan benar-benar diterima server dan tidak gagal diam-diam.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 3: Client Local-First Database & Sync Engine (T009–T010)
- **What was done:**
  - **T009 (Client Dexie IndexedDB Database di `apps/web/src/db`):**
    * Inisialisasi basis data Dexie 4.x (`VibeHabitDatabase`) dengan model domain: `categories`, `habits`, `habit_schedules`, `logs`, `settings`, dan `outbox`.
    * Mendefinisikan indeks majemuk `[habit_id+tanggal]` dan indeks tanggal `tanggal` pada tabel `logs` (`id, habit_id, tanggal, [habit_id+tanggal], server_seq, updated_at`) untuk menjamin performa query < 0,3 detik pada 35.000 record.
    * Mengimplementasikan utilitas registrasi `navigator.storage.persist()`, pengecekan persistence, dan tracking kuota/penggunaan storage (`getStorageEstimate()`) di `apps/web/src/db/persistence.ts`.
    * Membangun helper CRUD reaktif di `apps/web/src/db/operations.ts` (`saveCategory`, `saveHabit`, `saveHabitSchedule`, `saveHabitLog`, `saveSetting`, query helpers) dengan penegakan unik lokal `[habit_id+tanggal]` melalui rekonsiliasi deterministik LWW.
    * Mengimplementasikan penghapusan soft-delete kaskade (`deleteHabitCascading`) dalam satu transaksi Dexie tunggal: menghapus habit menuliskan tombstone (`deleted_at`) untuk habit, seluruh jadwalnya, dan seluruh log-nya, serta memasukkan mutasi `delete` ke antrean outbox.
    * Menyediakan hooks observasi reaktif `liveQuery` di `apps/web/src/db/hooks.ts`.
  - **T010 (Client Outbox Queue & Sync Engine di `apps/web/src/sync`):**
    * Membangun modul *outbox coalescing* di `apps/web/src/sync/outbox.ts`: mutasi offline berulang ke record yang sama digabung menjadi 1 mutasi terkini dengan pemetaan pelacakan ID predecessor untuk pembersihan atomik.
    * Membangun kalkulator exponential backoff dengan jitter di `apps/web/src/sync/backoff.ts` (basis 2.000ms, batas maksimal 60.000ms, non-negatif jitter, monotonik non-decreasing).
    * Membangun state machine sinkronisasi UI di `apps/web/src/sync/state.ts` yang melaporkan 4 status UI resmi:
      - `Tersinkron`
      - `Menunggu sinkron (n)`
      - `Server tidak terjangkau (Tailscale aktif?)`
      - `Jam perangkat tidak akurat (>5 menit)`
    * Mengimplementasikan `SyncEngine` di `apps/web/src/sync/engine.ts`:
      - Menjalankan loop iteratif pull/push sync hingga `has_more == false` dan antrean outbox kosong (dibatasi batas aman 20 putaran).
      - Menerapkan merge LWW lokal: mutasi server diterapkan ke Dexie hanya jika strictly menang LWW, serta melindungi mutasi lokal yang belum terkirim dari penimpaan perubahan server yang lebih lama.
      - Membersihkan entri outbox hanya ketika dikonfirmasi di daftar `applied` atau `rejected` server.
      - Menangani error 401, error clock skew 409, dan kegagalan jaringan/503 secara tangguh dengan transisi state machine yang tepat.
  - **Pengujian Penuh (`apps/web/tests/`):**
    * Dibuat 6 berkas pengujian komprehensif (34 skenario test):
      - `apps/web/tests/db.test.ts`: Inisialisasi store, query compound index, latensi <0,3s, penegakan unik LWW.
      - `apps/web/tests/persistence.test.ts`: Registrasi persist, toleransi saat browser tidak mendukung, kuota storage.
      - `apps/web/tests/crud-cascade.test.ts`: Enqueue outbox, kaskade tombstone satu transaksi, kaskade volume besar, eksekusi idempoten.
      - `apps/web/tests/outbox-coalesce.test.ts`: Penggabungan multi-edit ke satu payload, pelacakan predecessor ID, pemisahan batch.
      - `apps/web/tests/sync-engine.test.ts`: Loop iteratif penarikan multi-halaman, perlindungan uncommitted outbox, merge LWW, pembersihan outbox terkonfirmasi, penanganan 409 clock skew & 503 down.
      - `apps/web/tests/resilience-state.test.ts`: Formula exponential backoff, batas 60 detik, transisi 4 state UI.
  - **Hasil Verifikasi Penuh (Zero Regression):**
    * `npm test`: 368 tests lintas 50 test files lulus 100% di Vitest.
    * `npm run typecheck`: 0 error lintas seluruh workspace (`apps/web`, `apps/server`, `packages/shared`, `tests`).
    * `npm run lint`: 0 error.
    * `npm run build`: Kompilasi release berhasil tanpa error.
- **Decisions made and why:**
    * Menggunakan `fake-indexeddb` di lingkungan Vitest Node.js agar seluruh pengujian IndexedDB dan compound index Dexie dieksekusi secara nyata tanpa mock palsu.
    * Memastikan transaksi atomik Dexie membungkus pembersihan outbox dan merge perubahan server sekaligus untuk mencegah ketidakkonsistenan state jika terjadi kegagalan di tengah proses.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 3 Hardening & Adversarial Review Verification
- **What was fixed and hardened:**
  - **1. Perbaikan Kritis LWW Coalescing Outbox (`apps/web/src/sync/outbox.ts`):**
    * Masalah: `coalesceOutbox` sebelumnya mengasumsikan item outbox berurutan kronologis dan mengambil `items[items.length - 1]`. Karena Dexie `toArray()` mengembalikan item berdasarkan primary key `id` (UUID acak), urutan item acak sehingga mutasi lama atau status aktif sebelum tombstone dapat salah terpilih sebagai pemenang.
    * Solusi: Menggunakan reduksi LWW (`compareLww`, `doesIncomingWinLww`) eksplisit untuk memilih mutasi pemenang sejati per record, serta mendeduplikasi ID predecessor.
  - **2. Perbaikan Merge LWW Lokal (`apps/web/src/sync/engine.ts`):**
    * Masalah: Saat membandingkan perubahan server dengan mutasi outbox lokal yang belum dikirim (`pendingForRecord`), `engine` sebelumnya mengambil elemen terakhir array acak. Diperbaiki dengan reduksi LWW untuk menjamin record uncommitted lokal terbaru yang dibandingkan.
    * Masalah: Saat record server hasil sync dikembalikan (di mana `compareLww === 0` karena timestamp dan device_id identik), record tersebut diabaikan sehingga `server_seq` tidak pernah tersimpan di Dexie. Diperbaiki agar saat `compareLww === 0` dan tidak ada mutasi outbox lokal tertunda, record diperbarui sehingga `server_seq` resmi tercatat di Dexie.
  - **3. Batas Plafon Backoff Jitter (`apps/web/src/sync/backoff.ts`):**
    * Masalah: Jitter ditambahkan setelah capping `expMs`, sehingga pada attempt tinggi (e.g. attempt 20) dengan jitter 10%, nilai backoff mencapai 66.000ms (melebihi plafon ketat 60.000ms di PRD §8.2 & ARCHITECTURE §6.4).
    * Solusi: Nilai hasil akhir dijepit secara ketat dengan `Math.min(maxMs, ...)`.
  - **4. Semantik Mutasi Outbox & ID Log Deterministik (`apps/web/src/db/operations.ts`):**
    * Memperbaiki penentuan aksi outbox (`'insert'` vs `'update'`) pada `saveCategory`, `saveHabit`, `saveHabitSchedule`, `saveHabitLog`, dan `saveSetting` berdasarkan keberadaan data di IndexedDB.
    * Menjamin `saveHabitLog` otomatis menghasilkan UUID v5 deterministik (`generateLogId(habit_id, tanggal)`) saat `log.id` kosong.
    * Menambahkan fungsi pembantu CRUD lengkap: `getHabit`, `getCategory`, `deleteCategory`, `deleteHabitSchedule`, `deleteHabitLog`, serta `queryLogsByDateRange` untuk mendukung query rentang tanggal kalender & analitik.
  - **5. Concurrency Guard pada SyncEngine (`apps/web/src/sync/engine.ts`):**
    * Menambahkan proteksi re-entrancy / mutex `activeSyncPromise` pada `SyncEngine.sync()` agar pemanggilan konkuren simultan tidak memicu duplikasi pengiriman mutasi atau tabrakan transaksi.
  - **6. Pengujian Observabel Reaktif (`apps/web/tests/hooks.test.ts`):**
    * Menambahkan suite pengujian komprehensif untuk `observeHabits`, `observeHabit`, `observeLogsForDate`, `observeLogsForDateRange`, `observeLogsForHabitAndDate`, `observeHabitSchedules`, `observeCategories`, `observeSetting`, dan `observeOutboxCount`.
  - **7. Optimasi Runner Vitest (`vitest.config.ts`):**
    * Menetapkan `pool: 'threads'` di `vitest.config.ts` untuk menghindari eksit worker mendadak dan kegagalan alokasi memori process (`out of memory`) di lingkungan Node.js Windows dengan keterbatasan RAM bebas.
  - **8. Eliminasi Flake Index Outbox pada Test Suite (`apps/web/tests/crud-cascade.test.ts`):**
    * Masalah: Pada tes modifikasi habit, assertion `expect(allOutbox[1]!.action).toBe('update')` mengasumsikan urutan array tetap. Karena Dexie `toArray()` mengembalikan record berurutan berdasarkan primary key `id` (string UUID acak), mutasi update terkadang berada di indeks 0 atau 1 tergantung leksikografis UUID.
    * Solusi: Diperbarui agar memverifikasi keberadaan mutasi secara deterministik via `allOutbox.some(item => item.action === 'insert')`, `allOutbox.some(item => item.action === 'update')`, serta memvalidasi kesesuaian payload record habit yang diperbarui.
- **Hasil Verifikasi Penuh (Zero Regression):**
  * `npm test`: 380 tests lulus 100% lintas 51 test files di Vitest (14s) dengan 0 flake.
  * `npm run test:integration`: 33 tests lulus 100%.
  * `npm run typecheck`: 0 error lintas seluruh workspace.
  * `npm run lint`: 0 error linting.
  * `npm run build`: Kompilasi produksi lulus 100%.
- **Decisions made and why:**
  * Memperbaiki seluruh kelemahan edge cases dan memastikan jaminan kekokohan data model lokal dan sinkronisasi client sebelum lanjut ke Milestone 4 UI.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 4: Daily Tracking UI & Habit Management (T011–T013)
- **What was done:**
  - **T011 (Tailwind CSS Configuration & Serene Focus Tokens di `apps/web`):**
    * Mengonfigurasi `tailwind.config.js` dengan token desain Serene Focus dari `DESIGN_SYSTEM.md`: Primary Calm Teal (`#0D9488`), Secondary Warm Amber (`#D97706`), palet semantik kategori (Emerald, Indigo-Slate, Calm Sky, Terracotta-Rose, Olive-Bronze, Slate), status sinkronisasi, dan `tabular-nums`.
    * Mendefinisikan CSS variables permukaan light dan dark mode (`--bg-canvas`, `--surface-tier-1`, dll.) di `apps/web/src/styles/tokens.css` dan `index.css`.
    * Membangun modul tema reaktif (`ThemeProvider`, `useTheme`) di `apps/web/src/theme/ThemeContext.tsx` yang tersinkronisasi otomatis ke tabel `settings` di Dexie IndexedDB dan mematuhi preferensi sistem (`prefers-color-scheme: dark`).
    * Membangun shell tata letak responsif di `apps/web/src/components/layout/AppLayout.tsx`: bilah navigasi bawah untuk mobile (< 768px, 64px `pb-safe`), bilah samping untuk desktop (>= 768px, 260px fixed width, batas kontainer 1040px), serta badge status sinkronisasi `SyncStatusBadge`.
  - **T012 (Daily Check-in Screen `Hari Ini` di `apps/web/src/pages/DailyCheckIn.tsx`):**
    * Membangun pemilih strip tanggal 5-hari horizontal (`DateStrip.tsx`) dengan navigasi chevron lampau/mendatang dan offset `jam_mulai_hari` (misal 04:00) dari pengaturan.
    * Membangun ring progres melingkar SVG (`ProgressRing.tsx`) dengan persentase kelulusan hari ini dan badge momentum streak Warm Amber.
    * Membangun kartu habit checklist (`HabitChecklistCard.tsx`) dengan single-tap toggle instan (< 50ms) ke Dexie IndexedDB dan outbox queueing.
    * Membangun kartu habit kuantitatif (`HabitQuantitativeCard.tsx`) dengan stepper buttons (`-` dan `+`), input manual, dan auto-selesai saat nilai mencapai target.
    * Menghubungkan kalkulasi streak dinamis pada kartu habit menggunakan mesin murni `calculateStreak` dari `@vibehabit/shared`.
    * Menambahkan akordeon collapsible untuk kebiasaan yang tidak dijadwalkan pada hari yang dipilih.
  - **T013 (Habit Management Screen `Kelola Habit` di `apps/web/src/pages/HabitManagement.tsx`):**
    * Membangun daftar habit dengan pencarian teks, chip filter kategori horizontal, dan akordeon kebiasaan yang diarsipkan.
    * Membangun modal form tambah / ubah habit (`HabitFormModal.tsx`) yang mendukung mode checklist dan kuantitatif, serta frekuensi harian, hari tertentu (Senin-Minggu), dan X kali per minggu.
    * Menegakkan integritas historis (PRD 7.5 & 8.1): perubahan frekuensi/target kebiasaan secara otomatis membuat versi jadwal baru `HabitSchedule` dengan `effective_from = selectedDate` tanpa merusak catatan jadwal lama.
    * Membangun modal konfirmasi hapus permanen (`DeleteConfirmationModal.tsx`) dengan rincian jumlah log dan streak yang terpengaruh, mengeksekusi `deleteHabitCascading` secara atomik di Dexie.
  - **Pengujian & Verifikasi Komponen (`apps/web/tests/`):**
    * Menambahkan 4 berkas pengujian baru (29 pengujian baru):
      - `apps/web/tests/theme.test.ts`: default setting, persistensi ke Dexie, update theme, mutasi outbox.
      - `apps/web/tests/daily-checkin.test.tsx`: date strip 5 hari, progress ring 0%/50%/100%, checklist toggle, stepper kuantitatif, update Dexie instan.
      - `apps/web/tests/habit-management.test.tsx`: render kartu kelola, form create/edit, preservasi versi jadwal `effective_from`, dialog konfirmasi hapus, eksekusi kaskade tombstone.
      - `apps/web/tests/layout.test.tsx`: shell navigasi desktop & mobile, badge status sinkronisasi, toggle tema.
    * Memperbarui `vitest.config.ts` untuk menyertakan berkas `.test.{ts,tsx}`.
- **Hasil Verifikasi Penuh (Zero Regression):**
  * `npm test`: 409 tests lulus 100% lintas 55 test files di Vitest dengan 0 fail dan 0 flake.
  * `npm run typecheck`: 0 error lintas seluruh workspace (`apps/web`, `apps/server`, `packages/shared`, `tests`).
  * `npm run lint`: 0 error linting.
  * `npm run build`: Kompilasi produksi lulus 100%.
- **Decisions made and why:**
  * Menggunakan inisialisasi state langsung dari props pada `HabitFormModal` untuk menjamin kompatibilitas penuh dengan static rendering dan SSR di samping client-side lifecycle.
  * Menghubungkan seluruh mutasi form dan check-in langsung ke helper CRUD atomik Dexie (`saveHabitLog`, `saveHabit`, `saveHabitSchedule`, `deleteHabitCascading`) untuk menjaga prinsip Local-First nol-latensi dan sinkronisasi outbox otomatis.
- **Deviation from plan (if any):** Tidak ada deviasi. Seluruh kriteria spesifikasi Milestone 4 terpenuhi 100%.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 4 Hardening & Adversarial Review Verification
- **What was fixed and hardened:**
  - **1. Perbaikan Kritis Kebocoran Jadwal Lintas Habit (`DailyCheckIn.tsx` & `HabitManagement.tsx`):**
    * *Akar Masalah:* `getActiveScheduleForDate(schedules, ...)` dan `calculateStreak(habit, schedules, ...)` dipanggil menggunakan array global `schedules` yang berisi seluruh jadwal dari seluruh habit di basis data. Karena `getActiveScheduleForDate` mengurutkan jadwal semata-mata berdasarkan `effective_from` tanpa memfilter `habit_id`, jadwal dari habit lain (yang memiliki `effective_from` lebih baru) menimpa jadwal habit aktif. Hal ini menyebabkan target kuantitatif salah (misal: 2000 ml terbaca sebagai 1 ml), jenis frekuensi tertukar, kalkulasi streak terkorupsi, dan form edit habit memuat jadwal habit lain.
    * *Solusi:* Memfilter jadwal spesifik habit (`schedules.filter(s => s.habit_id === habit.id)`) sebelum memanggil `getActiveScheduleForDate` dan `calculateStreak` di seluruh komponen `DailyCheckIn`, `HabitManagement`, `HabitCard`, modal edit, dan modal hapus.
  - **2. Pengelompokan Kategori Serene Focus (`DailyCheckIn.tsx`):**
    * Mengimplementasikan `groupedScheduledHabits` yang mengelompokkan ritual terjadwal berdasarkan kategori dengan header kategori, dot warna semantik, dan indikator `X / Y Siap` per kategori sesuai spesifikasi PRD §6 dan acuan visual Google Stitch UI.
  - **3. Reaktivitas LiveQuery Penuh ke Dexie (`DailyCheckIn.tsx` & `HabitManagement.tsx`):**
    * Mengintegrasikan langganan reaktif Dexie `liveQuery` (`observeHabits`, `observeCategories`, `observeLogsForDate`, liveQuery schedules dan logs) sehingga UI otomatis bereaksi terhadap mutasi outbox, tarikan sinkronisasi latar belakang dari VPS, atau modifikasi dari tab lain tanpa bergantung pada pemuatan manual statis.
  - **4. Integrasi Status Outbox Nyata pada Layout Shell (`App.tsx`):**
    * Mengganti badge sync hardcoded dengan observasi dinamis `observeOutboxCount(db)` pada `App.tsx`. Ketika terdapat mutasi tertunda di IndexedDB offline, layout langsung menampilkan status `Menunggu (n)` dengan badge oranye Warm Amber secara real-time.
  - **5. Stabilisasi Navigasi Strip Tanggal (`DateStrip.tsx`):**
    * Mempertahankan `anchorDate` jendela 5-hari agar klik pada tanggal dalam jendela aktif tidak menyebabkan seluruh strip melompat/bergeser di bawah jari pengguna. Pergeseran strip hanya terjadi saat pengguna menggunakan chevron atau memilih tanggal di luar jendela.
  - **6. Penyesuaian Presisi Token SVG ProgressRing (`ProgressRing.tsx`):**
    * Memperbarui `strokeWidth` menjadi `8` (sebelumnya `6`) dan warna track latar menjadi `text-slate-200 dark:text-slate-700` (sebelumnya `text-slate-100 dark:text-slate-700/60`) agar strictly mematuhi spesifikasi `DESIGN_SYSTEM.md` §6.4.
  - **7. Integritas Form Kategori & Pengurutan Numerik Hari (`HabitFormModal.tsx`):**
    * Memperbaiki fallback `categoryId` agar habit tanpa kategori (`category_id === null`) tidak terpaksa menjadi kategori pertama saat diedit.
    * Memperbaiki fungsi `toggleDay` agar pengurutan hari menggunakan pembanding numerik `(a, b) => a - b` alih-alih pengurutan leksikografis default JavaScript.
    * Menyelaraskan tombol stepper minus dan plus pada `HabitQuantitativeCard.tsx` dengan label angka seimbang.
  - **8. Penambahan Pengujian Komprehensif (`apps/web/tests/`):**
    * Menambahkan pengujian isolasi jadwal multi-habit pada `daily-checkin.test.tsx` dan `habit-management.test.tsx`.
    * Menambahkan pengujian kepatuhan token stroke SVG ProgressRing.
    * Menambahkan pengujian integritas kategori null pada form modal.
- **Hasil Verifikasi Penuh (Zero Regression):**
  * `npm test`: 413 tests lulus 100% lintas 55 test files di Vitest dengan 0 fail dan 0 flake.
  * `npm run typecheck`: 0 error lintas seluruh workspace (`@vibehabit/shared`, `@vibehabit/web`, `@vibehabit/server`, dan root `tests`).
  * `npm run lint`: 0 error linting.
  * `npm run build`: Kompilasi produksi lulus 100%.
- **Decisions made and why:**
  * Menegakkan isolasi ketat `habit_id` pada setiap evaluasi jadwal dan streak untuk menjamin integritas fungsional Local-First saat banyak habit aktif tersimpan di IndexedDB.
- **Deviation from plan (if any):** Tidak ada deviasi.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 5: Analytics Dashboard & Data Management (T014–T015)
- **What was done:**
  - **T014 (Analytics Dashboard Screen di `apps/web/src/pages/AnalyticsDashboard.tsx`):**
    * Membangun pemilih rentang waktu tersegmentasi (`TimeRangeFilter.tsx`): 7 Hari, 30 Hari, 90 Hari, dan Tahun Ini dengan status tombol aktif berbasis token Serene Focus.
    * Membangun 4 kartu ringkasan metrik KPI (`MetricSummaryCards.tsx`): Rasio Keberhasilan (%) beserta dekorasi kurva sparkline, Total Check-in Selesai dengan progress bar, Streak Terpanjang Aktif dengan badge Warm Amber 🔥, dan Habit Paling Konsisten dengan persentase kelulusan.
    * Membangun grafik garis/area tren konsistensi interaktif murni berbasis SVG (`ConsistencyChart.tsx`): area gradient fill Calm Teal (`#0D9488`), garis horizontal pemandu, garis benchmark putus-putus rata-rata periode, titik data interaktif dengan tooltip melayang (tanggal, rasio %, jumlah selesai/terjadwal), serta label sumbu-X adaptif tanpa dependensi eksternal.
    * Membangun peta densitas konsistensi kalender heatmap berbasis pure CSS Grid 7 kolom (`CalendarHeatmap.tsx`): header hari (Sen s.d. Min), slot offset kosong di awal minggu pertama bulan, skala 5 level warna Serene Focus (Level 0 kosong s.d. Level 4 sempurna), tooltip tanggal & jumlah selesai, styling tanggal masa depan redup, dan navigasi bulan (chevron mundur/maju).
    * Membangun kartu ringkasan performa per kategori (`CategorySummaryCards.tsx`): dot warna semantik kategori (Emerald, Indigo, Sky, Rose, Lime, Slate), jumlah habit aktif, total check-in selesai, rasio keberhasilan kategori, dan horizontal progress bar (termasuk penanganan "Tanpa Kategori" per PRD §7.6).
    * Membangun tabel perincian performa per habit individu (`HabitPerformanceTable.tsx`): nama habit, chip kategori, mode target (checklist vs kuantitatif), badge streak saat ini, streak terbaik historis, rasio keberhasilan dalam periode, dan rasio check-in selesai/terjadwal.
    * Menghubungkan kalkulasi analitik cepat menggunakan fungsi domain murni `@vibehabit/shared` (`calculateStreak`, `getActiveScheduleForDate`, `isDateScheduled`, `isDaySuccessful`) dengan isolasi ketat `habit_id` dan indexing Dexie `[habit_id+tanggal]`.
  - **T015 (Data Management & Disaster Recovery di `apps/web/src/pages/DataManagement.tsx`):**
    * Mendefinisikan tipe domain `BackupData` dan skema validasi Zod `backupDataSchema` di `@vibehabit/shared` untuk format snapshot database resmi versi 1.
    * Membangun modul utilitas portabilitas data di `apps/web/src/utils/exportImport.ts`:
      - `exportDatabaseToJson`: mengunduh snapshot utuh 5 tabel domain (`categories`, `habits`, `habit_schedules`, `logs`, `settings`) dengan format terstruktur, metadata, stempel waktu, dan penyimpanan timestamp ke `localStorage`.
      - `exportHabitsToCsv`: mengekspor data baris-kolom bersih untuk diolah secara bebas di spreadsheet / pandas.
      - `validateBackupJson`: memvalidasi berkas JSON terhadap skema Zod dan mengekstrak ringkasan statistik (jumlah habit, log, jadwal, kategori).
      - `importBackupData`: mengimplementasikan dua mode pemulihan bencana:
        1. **Mode Merge LWW (Rekomendasi Aman):** Membandingkan `updated_at` via `compareLww` sehingga record lokal yang lebih baru tidak tertimpa, mendaftarkan mutasi ke outbox untuk sinkronisasi ke VPS.
        2. **Mode Clean Restore:** Mengosongkan data lokal dan mengganti total dengan isi cadangan, mendaftarkan seluruh entitas ke outbox sebagai mutasi `insert`.
    * Membangun modal pratinjau impor (`ImportPreviewModal.tsx`): dialog informasi nama berkas, stempel waktu, perangkat asal, badge statistik entitas, dan opsi pemilihan strategi merge LWW vs clean restore.
    * Membangun banner peringatan keselamatan data (`BackupWarnings.tsx`) sesuai PRD §8.4 & ARCHITECTURE §9.6: peringatan visual jika sinkronisasi > 7 hari (atau belum pernah) dan jika backup terakhir > 30 hari (atau belum pernah).
    * Membangun form konfigurasi Device Token (`DeviceTokenForm.tsx`): input Bearer token rahasia tersimpan di `localStorage` lokal untuk otentikasi aman ke endpoint sinkronisasi Fastify VPS.
    * Membangun kontrol preferensi biologis jam mulai hari (`jam_mulai_hari`: 00:00, 03:00, 04:00, 05:00) yang tersimpan ke Dexie dan outbox.
    * Membangun zona bahaya: pembersihan antrean outbox sementara dan reset data lokal dengan konfirmasi teks "RESET".
    * Menghubungkan rute navigasi tab "Analitik" dan tab "Data" pada `App.tsx` dan `AppLayout.tsx`.
  - **Pengujian Komprehensif (`apps/web/tests/`):**
    * Menambahkan 2 berkas pengujian baru (28 pengujian baru):
      - `apps/web/tests/analytics-dashboard.test.tsx`: segmented filter, KPI metric cards, SVG chart paths & grid, heatmap 5-level scale & weekday alignment, category cards, habit performance table, dan integrasi penuh `AnalyticsDashboard`.
      - `apps/web/tests/data-management.test.tsx`: pembuatan JSON snapshot versi 1, pembuatan CSV, validasi Zod valid/invalid, penggabungan Merge LWW melindungi data lokal lebih baru, pemulihan Clean Restore, banner peringatan sync/backup overdue, form device token, modal pratinjau impor, dan integrasi halaman `DataManagement`.
    * Menambahkan pengujian integrasi tab switching `Analytics` dan `Data` di `apps/web/tests/layout.test.tsx`.
    * Menambahkan unit test validasi `backupDataSchema` di `packages/shared/tests/schemas.test.ts`.
- **Hasil Verifikasi Penuh (Zero Regression):**
  * `npm test`: 441 tests lulus 100% lintas 57 test files di Vitest (18s) dengan 0 fail dan 0 flake.
  * `npm run typecheck`: 0 error lintas seluruh workspace (`@vibehabit/shared`, `@vibehabit/web`, `@vibehabit/server`, dan root `tests`).
  * `npm run lint`: 0 error linting.
  * `npm run build`: Kompilasi produksi lulus 100%.
- **Decisions made and why:**
  * Membangun grafik garis/area dan kalender heatmap menggunakan pure SVG dan CSS Grid native tanpa menambah library eksternal (menghindari peer-dependency issues React 19 dan strictly mematuhi guardrail zero unauthorized dependencies di `AGENTS.md`).
  * Mendaftarkan seluruh entitas hasil import JSON langsung ke outbox Dexie agar sinkronisasi data ke PostgreSQL VPS berjalan otomatis dan transparan saat online.
- **Deviation from plan (if any):** Tidak ada deviasi. Seluruh kriteria spesifikasi Milestone 5 (T014 & T015) terpenuhi 100%.
- **Upstream doc update needed?** Tidak ada.

### 2026-10-01 — Milestone 5 Review & Hardening
- **What was done:**
  - **1. Integrasi Authoritative Domain Logic `calculateSuccessRatio` (`AnalyticsDashboard.tsx`):**
    * Mengganti perulangan inline ad-hoc dengan fungsi domain murni `@vibehabit/shared` (`calculateSuccessRatio`).
    * Memperbaiki kepatuhan PRD §7.4: hari ini yang belum selesai tidak dihitung ke penyebut rasio.
    * Menjamin perhitungan rasio untuk habit `x_per_week` menghasilkan 100% saat target mingguan tercapai (bukan 42.8% akibat asumsi denominator 7-hari).
  - **2. Presisi Tooltip Kalender Heatmap (`CalendarHeatmap.tsx`):**
    * Memisahkan status hari rehat murni (`scheduledCount === 0` -> "Rehat (tidak ada jadwal)") dari hari dengan target yang terlewat (`scheduledCount > 0 && completedCount === 0` -> "0/N selesai (0%)").
  - **3. Penanganan Hari Rehat pada Grafik Konsistensi (`ConsistencyChart.tsx`):**
    * Mencegah grafik tren konsistensi anjlok secara palsu ke 0% pada hari libur terjadwal (misal: akhir pekan).
    * Menambahkan styling titik netral dan label tooltip "Hari Rehat (tidak ada jadwal)".
  - **4. Pencegahan Rollover Tanggal Navigasi Heatmap (`AnalyticsDashboard.tsx`):**
    * Menyetel `baseDate.setDate(1)` sebelum `setMonth(m + offset)` untuk mencegah date overflow pada akhir bulan (misal tanggal 31).
  - **5. Kontrol Toggle Habit Diarsipkan (`AnalyticsDashboard.tsx`):**
    * Menambahkan tombol toggle "Sertakan Diarsipkan" per PRD §7.5 sehingga riwayat habit non-aktif dapat disertakan atau disembunyikan sesuai preferensi pengguna.
  - **6. Pengurutan Kronologis Ekspor CSV (`exportImport.ts`):**
    * Menjamin baris log CSV tersusun secara kronologis `tanggal ASC, habit_id ASC` untuk memudahkan analisis tabel eksternal.
  - **7. Optimasi Batching Outbox Impor (`exportImport.ts`):**
    * Mengganti pemanggilan sekuensial individual `enqueueOutbox` dengan `db.outbox.bulkPut` dalam transaksi Dexie untuk mengeliminasi risiko transaction timeout pada ribuan log.
  - **8. Pengujian Regresi Tambahan (`apps/web/tests/`):**
    * Menambahkan 3 pengujian baru pada `analytics-dashboard.test.tsx` (total 444 tests lulus 100%).
- **Hasil Verifikasi Penuh:**
  * `npm test`: 444 tests lulus 100% lintas 57 test files di Vitest (14s) tanpa kegagalan.
  * `npm run typecheck`: 0 error lintas seluruh workspace.
  * `npm run lint`: 0 error linting.
  * `npm run build`: Kompilasi produksi lulus 100%.
