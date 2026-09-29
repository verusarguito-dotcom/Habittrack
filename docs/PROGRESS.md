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

