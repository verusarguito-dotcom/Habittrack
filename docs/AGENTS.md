# Agent Instructions (AGENTS.md)

Status: Active
Last updated: 2026-09-29

## 1. Project Context
VibeHabit adalah aplikasi personal habit tracker berbasis **Local-First PWA** (React 19, TypeScript strict mode, Dexie/IndexedDB, Tailwind CSS) dengan analitik data mendalam dan sinkronisasi dua arah ke PostgreSQL di VPS pribadi via Fastify sync service. Monorepo dikelola menggunakan `npm workspaces` dengan tiga paket utama: `apps/web` (frontend PWA), `apps/server` (Fastify sync service & static server), dan `packages/shared` (tipe data, skema Zod, dan fungsi murni streak & rasio).

## 2. Before You Start
- Wajib membaca `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, dan `TASKS.md` sebelum mulai bekerja.
- Selalu periksa status tugas aktif di `TASKS.md` sebelum memulai pekerjaan baru.
- Periksa modul dan tipe yang sudah ada di `packages/shared` sebelum membuat tipe, skema, atau fungsi baru untuk mencegah duplikasi.
- Gunakan dokumen-dokumen di `/docs` sebagai *single source of truth*.

## 3. 10 Larangan Keras (Strict Guardrails — Zero Tolerance)
1. **Dilarang menambah, menghapus, atau mengubah versi dependensi** tanpa konfirmasi eksplisit dari pengguna.
2. **Dilarang mengubah skema PostgreSQL atau IndexedDB** tanpa file migrasi tertulis dan persetujuan pengguna.
3. **Dilarang mengubah algoritma streak, rasio keberhasilan, atau logika sync** (LWW, tombstone, outbox) tanpa unit test yang mencakup perubahan tersebut dan lolos 100%.
4. **Dilarang menjalankan perintah destruktif:** `rm -rf`, penghapusan berkas data, `DROP`/`TRUNCATE`, `git reset --hard`, `git push --force`, `git clean`.
5. **Dilarang menyentuh data produksi:** Dilarang menjalankan migrasi atau query tulis langsung ke database PostgreSQL di VPS, atau melakukan deploy tanpa izin eksplisit. *(AI yang punya akses terminal ke VPS bisa merusak satu-satunya salinan data).*
6. **Dilarang membaca, mencetak, atau meng-commit file `.env`**, API token, dan kredensial sensitif lainnya.
7. **Dilarang mengubah aturan bisnis di PRD** (bagian 7 dan 8) secara diam-diam. Jika aturan ambigu atau bertentangan, wajib tanyakan dulu ke pengguna.
8. **Dilarang melewati pemeriksaan kualitas agar lulus:** `@ts-ignore`, `any`, `eslint-disable`, `.skip` pada test runner, atau melonggarkan aturan linter dan `tsconfig.json`.
9. **Dilarang mengubah kontrak API sync** tanpa memperbarui dokumentasi di `ARCHITECTURE.md` dan rangkaian integration test-nya.
10. **Dilarang mengerjakan lebih dari satu tugas `TASKS.md` dalam satu perubahan/commit.**

## 4. Conflict Resolution Rule
Jika terjadi kontradiksi antara `PRD.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, atau `TASKS.md`, atau terdapat keputusan teknis/bisnis yang belum tercantum di dokumen mana pun, **AGEN WAJIB BERHENTI DAN BERTANYA KEPADA PENGGUNA**. Jangan pernah menebak atau mengasumsikan prioritas dokumen secara sepihak.

## 5. Definition of Done (DoD)
Sebuah tugas di `TASKS.md` hanya boleh ditandai sebagai `done` jika seluruh kriteria berikut terpenuhi tanpa kompromi:
1. `npm run typecheck` (`tsc --noEmit`) lulus 100% tanpa error di seluruh paket workspace (`apps/web`, `apps/server`, `packages/shared`).
2. `npm run lint` lulus tanpa error dan tanpa peringatan baru.
3. `npm run build` berhasil menghasilkan bundle produksi yang valid.
4. Seluruh unit test lulus 100%, dan logika baru wajib memiliki test cakupan tersendiri.
5. Untuk perubahan streak, rasio, atau sync: test mencakup seluruh kasus uji dari PRD 11.2 yang relevan.
6. Untuk perubahan sync: wajib ada integration test dengan PostgreSQL asli (menggunakan Docker di dev machine) untuk skenario dua perangkat offline (PRD 11.1 poin 4), termasuk uji edit dan hapus pada record yang sama.
7. Untuk perubahan UI atau PWA: diverifikasi manual di browser (termasuk verifikasi mode offline), dan bukti/hasil verifikasi dicatat di entri tugas terkait.
8. Tidak ada dependensi baru yang ditambahkan di luar persetujuan.
9. `TASKS.md` diperbarui statusnya, dan commit git mengikuti standar Conventional Commits.

## 6. Git Convention
- **Format Commit:** `tipe(scope): deskripsi singkat dalam bahasa Inggris, huruf kecil, kalimat perintah.`
- **Tipe:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`.
- **Scope:** `web`, `server`, `shared`, `db`, `sync`, `streak`, `pwa`.
- **Contoh:** `feat(streak): compute weekly streak for x-per-week habits`
- **Aturan Batasan:** Satu commit untuk satu perubahan logis. Perubahan skema basis data wajib di-commit terpisah dari kode fitur. Perubahan yang merusak (*breaking*) wajib diberi tanda seru `!` atau footer `BREAKING CHANGE:`.

## 7. Commands Standar
```bash
# Instalasi & Setup
npm install

# Typecheck & Linting
npm run typecheck
npm run lint

# Pengujian (Unit & Integration)
npm run test                  # Menjalankan Vitest di semua package
npm run test:unit             # Unit test packages/shared
npm run test:integration      # Integration test apps/server (butuh Docker aktif di dev)

# Build & Development
npm run dev                   # Menjalankan dev server web & sync server bersamaan
npm run build                 # Build web dan server untuk release produksi
```

## 8. Boundaries (Batas Wewenang Agen)
- Agen tidak berhak mengubah struktur monorepo tanpa izin.
- Agen tidak berhak mempublikasikan port PostgreSQL server ke publik.
- Agen tidak berhak mengubah konfigurasi Tailscale atau menjalankan `tailscale funnel`.
- Agen tidak berhak menghapus data historis tombstone di bawah 90 hari.
