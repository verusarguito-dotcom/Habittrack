# System Architecture (ARCHITECTURE.md)

Status: Active (v2)
Last updated: 2026-09-29

## 1. System Overview
VibeHabit memakai arsitektur **Local-First** dalam satu monorepo.

- **Klien (PWA):** Berjalan di browser laptop dan HP. Klien adalah sumber kebenaran untuk interaksi pengguna. Semua baca dan tulis ke IndexedDB via Dexie, tanpa menunggu jaringan.
- **Sync Engine:** Perubahan lokal masuk ke tabel outbox. Saat server terjangkau, batch dikirim ke server dan perubahan dari perangkat lain ditarik dalam satu request.
- **Server VPS:** Satu container Fastify yang (a) menyajikan file PWA, (b) menyediakan API sync, dan (c) menulis ke PostgreSQL dalam satu transaksi.
- **Akses Jaringan:** Hanya lewat Tailscale (`tailscale serve`), tanpa domain publik, tanpa Caddy, tanpa port publik.

### Batasan yang Harus Diketahui:
- Kunjungan pertama dan setiap sync membutuhkan Tailscale aktif di perangkat. Setelah PWA terpasang, semua fitur inti berjalan offline.
- "Offline" dan "server tidak terjangkau" adalah dua kondisi berbeda. Jika Tailscale di HP mati, `navigator.onLine` tetap true tetapi sync gagal. UI harus menampilkan *"Server tidak terjangkau (Tailscale aktif?)"*, bukan error umum.
- Target 0,3 detik adalah target yang diukur (PRD 11.1), bukan jaminan bawaan dari Dexie.

## 2. Tech Stack (Final)
| Lapisan | Keputusan | Catatan |
| :--- | :--- | :--- |
| **Monorepo** | `npm workspaces` | Menggunakan npm standard workspace. Jangan campur dengan pnpm. |
| **Runtime** | Node.js 22 | Sama dengan deployment JobFlow di VPS. |
| **Frontend** | React 19 + Vite + TypeScript strict | Versi dikunci di `package.json`. |
| **Styling** | Tailwind CSS | Token warna dan layout dari `DESIGN_SYSTEM.md`. |
| **Penyimpanan Lokal** | Dexie (IndexedDB) | Menyimpan data habit, log, outbox, dan setting lokal. |
| **PWA** | `vite-plugin-pwa` (Workbox) | Update strategy: prompt pengguna, bukan auto reload. |
| **Grafik** | Recharts | Untuk tren mingguan/bulanan. Heatmap kalender dibuat sendiri dengan CSS grid murni. |
| **Backend** | Node.js + Fastify + `@fastify/static` | Static file untuk menyajikan PWA + API sync. |
| **Database** | PostgreSQL (container Podman) | Versi image dikunci (bukan `latest`). |
| **Query** | Kysely + `pg` | Type-safe query builder, hindari ORM berat. |
| **Validasi** | Zod | Dipakai bersama di `packages/shared`. |
| **Test** | Vitest | Unit test shared & web, integration test server. |

> **Catatan Dependensi:** Semua dependensi di atas tetap tunduk pada larangan `AGENTS.md`: tambahan di luar daftar ini wajib mendapat persetujuan.

## 3. Struktur Direktori
```text
vibehabit/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/     # UI atoms & molecules
│   │   │   ├── pages/          # Hari Ini, Analitik, Kelola Habit, Data
│   │   │   ├── db/             # Skema Dexie + migrasi versi IndexedDB
│   │   │   ├── sync/           # Outbox, push/pull, status, deteksi jangkauan server
│   │   │   ├── theme/          # Switch Terang / Gelap / Ikuti sistem
│   │   │   └── hooks/
│   │   ├── public/
│   │   └── vite.config.ts
│   └── server/
│       ├── src/
│       │   ├── routes/         # POST /api/v1/sync, GET /api/v1/health
│       │   ├── db/             # Koneksi Kysely ke PostgreSQL
│       │   ├── services/       # LWW, server_seq, validasi clock skew
│       │   ├── middleware/     # Verifikasi token perangkat
│       │   └── config.ts       # Validasi env dengan Zod, fail-fast
│       └── migrations/         # SQL bernomor: 001_init.sql, ...
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/          # Domain types & DTOs
│       │   ├── schemas/        # Skema Zod request dan response sync
│       │   └── logic/          # Streak, rasio, jam mulai hari, id log deterministik, pembanding LWW
│       └── tests/
├── deploy/
│   ├── Containerfile           # Multi-stage: build web + server
│   ├── podman-compose.yml      # App Fastify + PostgreSQL container
│   ├── backup.sh               # Skrip backup pg_dump otomatis
│   └── .env.example            # Template env tanpa nilai rahasia
├── docs/                       # PRD, AGENTS, DESIGN_SYSTEM, ARCHITECTURE, TASKS, PROGRESS
└── compose.test.yml            # PostgreSQL untuk integration test, hanya di mesin dev
```
> **Catatan:** `compose.test.yml` hanya dijalankan di laptop (mesin dev). VPS berjenis LXC dan tidak menjalankan Docker.

## 4. Topologi Deployment
```text
[ HP / Laptop dengan Tailscale aktif ]
             |
             | HTTPS (sertifikat Tailscale), https://<host>.<tailnet>.ts.net:8443
             v
[ tailscaled di VPS: tailscale serve ]
             |
             | diteruskan lokal
             v
[ 127.0.0.1:3001 di host VPS ]
             |
             | pemetaan port Podman
             v
[ Container vibehabit-app: Fastify ]
    - menyajikan file PWA (apps/web/dist)
    - API /api/v1/*
             |
             | jaringan internal compose (port tidak dipublikasikan ke host)
             v
[ Container vibehabit-db: PostgreSQL, named volume pgdata ]
```

### Aturan Keamanan Jaringan:
1. Port app dipetakan sebagai `127.0.0.1:3001:3001`. Jangan pernah membuka `0.0.0.0:3001` atau memetakan `3001:3001` tanpa bind localhost.
2. Port PostgreSQL tidak dipetakan ke host sama sekali (hanya bisa diakses via bridge network internal Podman oleh container app).
3. Data PostgreSQL memakai *named volume* (`pgdata`), bukan bind mount, untuk menghindari masalah izin user di image Postgres. Cadangan dilakukan dengan `pg_dump`, bukan menyalin folder volume mentah.
4. **Dilarang keras menjalankan `tailscale funnel`** (layanan hanya untuk jaringan internal Tailscale).

## 5. Model Data dan Identitas
- **Kolom Standar:** Semua tabel memiliki `id`, `updated_at`, `deleted_at` (`null` jika aktif), `device_id`. Di sisi server ditambahkan `server_seq` (`bigint`, berindeks).
- **Identitas:** `categories`, `habits`, `habit_schedules`, `settings` memakai UUID v4 dari klien.
- **Log Deterministik:** `logs.id = UUID v5(habit_id + ":" + tanggal)`. Dua perangkat yang mencatat habit dan tanggal yang sama menghasilkan ID yang sama, sehingga otomatis bertemu di satu record lewat mekanisme LWW. Constraint `UNIQUE(habit_id, date)` tetap dipasang sebagai proteksi integritas.
- **Jadwal Versi:** `habit_schedules` bersifat versi (`effective_from`). Jika dua perangkat membuat versi dengan `effective_from` sama, pemenangnya ditentukan LWW.
- **Penghapusan (Tombstone):** Selalu menggunakan `deleted_at`. Menghapus habit permanen berarti klien membuat tombstone untuk habit, seluruh log, dan seluruh jadwalnya dalam satu transaksi Dexie dan satu batch outbox.
- **Penyimpanan Tombstone:** Tombstone tidak dibersihkan di v1. Volume data kecil (perkiraan maksimal 35.000 log selama 5 tahun), dan pembersihan berisiko menghidupkan kembali data dari perangkat yang lama offline.
- **Kalkulasi Pure:** Streak dan rasio tidak disimpan di database. Selalu dihitung dinamis dari log oleh fungsi murni di `packages/shared`.
- **Indeks Dexie:** `logs` diindeks majemuk `[habit_id+date]` dan `date` agar query dashboard 35.000 log memenuhi target latensi <0,3 detik.

## 6. Protokol Sinkronisasi (Sync Protocol)
Satu endpoint terpadu: `POST /api/v1/sync`. Header wajib: `Authorization: Bearer <token_perangkat>`.

### 6.1 Skema Request
```json
{
  "protocol_version": 1,
  "device_id": "string-uuid",
  "client_time": "2026-09-29T12:00:00.000Z",
  "client_last_server_seq": 105,
  "mutations": [
    {
      "mutation_id": "string-uuid",
      "table": "habits",
      "record": { "id": "...", "updated_at": "...", "deleted_at": null, "device_id": "..." }
    }
  ]
}
```
*Catatan:* Maksimal 200 mutasi per batch request. Penghapusan adalah record dengan `deleted_at` terisi, bukan operasi DELETE terpisah.

### 6.2 Pemrosesan Server (Satu Transaksi Penuh)
1. **Verifikasi Token:** Verifikasi hash token perangkat via `crypto.timingSafeEqual`. Gagal: `401 Unauthorized`.
2. **Verifikasi Versi Protokol:** Jika tidak didukung: `426 Upgrade Required`, klien menampilkan notifikasi *"Perbarui aplikasi"*.
3. **Advisory Lock:** Ambil `pg_advisory_xact_lock(hashtext('vibehabit_sync'))` agar urutan commit sama dengan urutan `server_seq`.
4. **Validasi Clock Skew:** Bandingkan `client_time` dengan waktu server. Jika selisih > 5 menit: tolak seluruh mutasi dengan error `409 CLOCK_SKEW` dan kembalikan `server_time`. Operasi Pull perubahan server tetap boleh dilanjutkan.
5. **Validasi Mutasi:** Untuk tiap mutasi, tolak jika `updated_at` lebih dari 5 menit di depan waktu server (mencegah timestamp masa depan menang selamanya).
6. **Resolusi LWW:** Bandingkan pasangan `(updated_at, device_id)` mutasi masuk dengan record yang ada di database. Jika strictly greater, tulis pembaruan dan beri `server_seq` baru. Jika tidak (kalah), lewati penulisan. Mutasi yang kalah tetap dimasukkan ke daftar `applied` agar outbox klien terbersihkan, dan record pemenang akan tiba di klien lewat respons pull.
7. **Idempotensi:** Karena pembandingan memakai *strict greater*, pengiriman batch yang sama dua kali tidak akan membuat duplikat dan tidak akan menaikkan `server_seq`.
8. **Pengambilan Perubahan (Pull):** Ambil seluruh record yang memiliki `server_seq > client_last_server_seq`, urut naik berdasarkan `server_seq`, dengan batas 500 baris per respons.

### 6.3 Skema Response
```json
{
  "server_time": "2026-09-29T12:00:01.000Z",
  "applied": ["mutation-id-1", "mutation-id-2"],
  "rejected": [
    { "mutation_id": "mutation-id-3", "reason": "Future timestamp detected" }
  ],
  "changes": [
    { "table": "logs", "record": { "id": "...", "server_seq": 106, "..." } }
  ],
  "new_server_seq": 106,
  "has_more": false
}
```

### 6.4 Logika Sisi Klien
1. Klien mengulang request sync hingga `has_more == false` (menangani sinkronisasi awal perangkat baru yang memiliki banyak data).
2. Outbox lokal digabung (*coalesced*) per record: hanya perubahan terbaru per entitas yang dikirim ke server.
3. Perubahan dari server diterapkan ke Dexie hanya jika menang LWW terhadap data lokal. Jika data lokal lebih baru (masih di antrean outbox), data lokal tetap dipertahankan.
4. Item outbox dihapus hanya jika `mutation_id` tercatat di array `applied` atau `rejected` permanen. Item yang gagal karena kendala jaringan tetap berada di outbox.
5. Jika koneksi gagal, sistem mencoba ulang otomatis dengan *exponential backoff*. Aplikasi tidak pernah terblokir.
6. Status sync pada UI: *Tersinkron*, *Menunggu sinkron (n)*, *Server tidak terjangkau (Tailscale aktif?)*, *Jam perangkat tidak akurat*, *Perbarui aplikasi*, atau *Gagal*.

## 7. Keamanan dan Konfigurasi Lingkungan
### 7.1 Klien (PWA)
- Tidak ada data rahasia di environment klien (`VITE_*` tertanam di bundle publik).
- `VITE_API_BASE`: Default `/api/v1`. Karena PWA disajikan dari container server yang sama via reverse proxy Tailscale, pemanggilan bersifat relative path tanpa issue CORS.
- `device_id` (UUID v4) dibuat saat instalasi pertama dan disimpan di tabel settings Dexie.
- Token perangkat diinput manual sekali di layar Data, disimpan di IndexedDB lokal. Proteksi XSS: tidak ada script pihak ketiga, tidak menggunakan `dangerouslySetInnerHTML`.

### 7.2 Server (.env di VPS — Izin 600, Tidak Pernah Masuk Git)
| Variabel | Keterangan & Contoh Nilai |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` (di dalam container; keterpaparan dibatasi bind host `127.0.0.1`) |
| `PORT` | `3001` |
| `DATABASE_URL` | `postgresql://vibehabit_user:<password>@vibehabit-db:5432/vibehabit` |
| `POSTGRES_PASSWORD` | Password kuat untuk database container |
| `DEVICE_TOKENS` | Hash token perangkat: `laptop:sha256hex,hp:sha256hex` |
| `TRUST_PROXY` | `true` |

### Aturan Konfigurasi:
1. Format `.env` persis `NAMA=nilai`, tanpa spasi, tanpa petik, tanpa komentar.
2. Server memvalidasi environment menggunakan Zod saat proses *bootstrap* dan langsung keluar (*fail-fast*) jika `DATABASE_URL` atau `DEVICE_TOKENS` tidak valid.
3. Pembuatan token acak: `openssl rand -hex 32`. Hash SHA-256 dibuat dengan: `printf '%s' TOKEN | sha256sum`.
4. Server memverifikasi token klien dengan perbandingan aman waktu konstan (`crypto.timingSafeEqual`).

## 8. Langkah Deployment VPS (Debian 12 + Podman 4.3.1)
1. **Pemeriksaan Sumber Daya:** Cek `free -m`. VPS menjalankan JobFlow dan VibeHabit bersamaan.
2. **Kloning & Konfigurasi:** Kloning repo, salin `deploy/.env.example` ke `.env`, buat rahasia baru, set permission `chmod 600 .env`.
3. **Eksekusi Kontainer:** Jalankan `podman-compose -f deploy/podman-compose.yml up -d --build`.
4. **Migrasi Basis Data:** Jalankan migrasi SQL bernomor secara manual dan tercatat.
5. **Verifikasi Lokal:** Jalankan `curl http://127.0.0.1:3001/api/v1/health` dan pastikan port `3001` hanya terikat di `127.0.0.1`.
6. **Publikasi Tailscale Serve:** Jalankan `tailscale serve status`. Publikasikan di port HTTPS terpisah:
   ```bash
   tailscale serve --bg --https=8443 3001
   ```
   Pastikan sertifikat Tailscale aktif dan port 443 JobFlow tidak terganggu.
7. **Pemasangan PWA:** Buka `https://<host>.<tailnet>.ts.net:8443` dari browser laptop dan smartphone, pilih "Install App", lalu masukkan Device Token di menu Data.
8. **Pengujian Privasi:** Nonaktifkan Tailscale di smartphone, pastikan URL gagal diakses (tidak bocor ke internet publik).

## 9. Strategi Backup dan Pemulihan (4 Lapisan)
1. **Lapisan 1 (Klien):** IndexedDB di setiap perangkat memegang data lengkap mandiri.
2. **Lapisan 2 (Otomasi Server):** Skrip `deploy/backup.sh` menjalankan `pg_dump` harian via cron di VPS dengan rotasi backup 30 hari.
3. **Lapisan 3 (Off-site Backup):** Skrip pull berkala via `rsync` atau `scp` melalui Tailscale untuk menyalin berkas dump dari VPS ke laptop.
4. **Lapisan 4 (Aplikasi):** Fitur Export JSON manual di aplikasi (PRD P0).
5. **Uji Pemulihan:** File backup wajib diuji pemulihannya ke database uji kosong sebelum dianggap valid.
6. **Peringatan UI:** Notifikasi visual muncul di UI jika sync belum berhasil > 7 hari atau backup JSON terakhir > 30 hari.

## 10. Strategi Pengujian (Testing Strategy)
- **Unit Test (`packages/shared`):** Menguji seluruh aturan bisnis PRD 7.1–7.5:
  - Daily habit streak & X-per-week habit streak.
  - Perhitungan hari terjadwal vs hari libur yang dilewati.
  - Nilai parsial pada habit kuantitatif.
  - Pengeditan log lampau & kalkulasi ulang instan.
  - Jam mulai hari kustom (misal: 04:00).
  - Perubahan frekuensi habit (`effective_from`).
  - Habit yang diarsipkan vs aktif.
  - Rasio keberhasilan kumulatif.
  - Deterministik UUID v5 log ID (`habit_id:date`).
  - Pembanding LWW dengan tie-break `device_id`.
- **Integration Test (`apps/server` dev machine via `compose.test.yml`):**
  - Dua perangkat offline memodifikasi record yang sama lalu online bersamaan. Hasil: data identik, tanpa duplikasi.
  - Replay batch mutasi yang sama dua kali (uji idempotensi).
  - Penolakan clock skew > 5 menit dan penolakan timestamp masa depan.
  - Sinkronisasi kursor paginasi `has_more` pada dataset besar.
  - Konkurensi dua request push bersamaan tanpa kehilangan urutan `server_seq`.
  - Server fail-fast saat env tidak valid.
- **Client Test (`apps/web`):**
  - Coalescing antrean outbox per record.
  - Aturan *apply-if-won* pada LWW lokal.
  - Penghapusan habit menghasilkan tombstone berantai untuk anak habit (jadwal dan log).
- **Manual Verification:**
  - Verifikasi offline App Shell di browser perangkat asli.
  - Verifikasi pemanggilan `navigator.storage.persist()`.
  - Verifikasi banner "Server tidak terjangkau" saat Tailscale dimatikan.
  - Pengukuran Lighthouse audit target <0,3s warm start pada perangkat fisik.
