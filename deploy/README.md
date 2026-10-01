# Panduan Operasional & Deployment VPS VibeHabit

Dokumen ini adalah panduan resmi langkah-demi-langkah deployment, konfigurasi keamanan, dan pemulihan bencana (*Disaster Recovery*) untuk VibeHabit di VPS Debian 12 pribadi.

Referensi Authoritative: `docs/ARCHITECTURE.md` (Bagian 4, 7, 8, 9) & `docs/PRD.md` (Bagian 8, 10, 11).

---

## 1. Topologi & Arsitektur Jaringan

```text
[ HP / Laptop (Tailscale Aktif) ]
             |
             | HTTPS (Sertifikat otomatis Tailscale), Port :8443
             v
[ VPS tailscaled: tailscale serve ]
             |
             | Meneruskan traffic lokal
             v
[ 127.0.0.1:3001 di host VPS ]
             |
             | Loopback mapping Podman
             v
[ Container vibehabit-app: Fastify Server ]
    - Menyajikan PWA (apps/web/dist)
    - Endpoint API: /api/v1/sync, /api/v1/health
             |
             | Bridge network internal (vibehabit-net)
             v
[ Container vibehabit-db: PostgreSQL 16 Alpine ]
    - Named volume: pgdata
    - Port tidak pernah dipublikasikan ke host
```

### Aturan Keamanan Jaringan:
1. **Isolasi Port Host:** Container `vibehabit-app` strictly terikat pada `127.0.0.1:3001`. Jangan pernah membuka port ke `0.0.0.0:3001`.
2. **PostgreSQL Terisolasi:** Port PostgreSQL (`5432`) **sama sekali tidak diekspos ke host VPS**, hanya dapat diakses melalui internal bridge network `vibehabit-net`.
3. **Koeksistensi Bebas Konflik:** VPS menjalankan aplikasi JobFlow pada port standar `443`. VibeHabit **wajib menggunakan port HTTPS `:8443`** via Tailscale Serve agar port 443 JobFlow tidak terganggu sedikit pun.
4. **Dilarang Keras Menggunakan Funnel:** Layanan Tailscale Serve hanya untuk Tailnet privat. Dilarang menjalankan `tailscale funnel`.

---

## 2. Pemeriksaan Pra-Syarat VPS

Login ke VPS Debian 12 dan periksa kapasitas sumber daya:
```bash
# Periksa memori bebas (JobFlow & VibeHabit berjalan bersamaan)
free -m

# Periksa status Podman dan Compose
podman --version
podman-compose --version

# Periksa status Tailscale
tailscale status
```

---

## 3. Konfigurasi Lingkungan (`.env`)

1. Salin berkas template ke lokasi produksi:
   ```bash
   cp deploy/.env.example .env
   chmod 600 .env
   ```
   *Catatan:* Izin berkas `600` memastikan hanya pengguna pemilik VPS yang dapat membaca rahasia basis data dan token perangkat.

2. Aturan format `.env`:
   - Persis `NAMA=nilai` tanpa spasi di sekitar tanda `=`
   - Tanpa tanda petik (`"`) dan tanpa komentar sebaris
   - Contoh isi:
     ```env
     NODE_ENV=production
     HOST=127.0.0.1
     PORT=3001
     DATABASE_URL=postgresql://vibehabit_user:KATA_SANDI_DB_RAHASIA@vibehabit-db:5432/vibehabit
     POSTGRES_PASSWORD=KATA_SANDI_DB_RAHASIA
     DEVICE_TOKENS=laptop:HASH_SHA256_LAPTOP,hp:HASH_SHA256_HP
     TRUST_PROXY=true
     STATIC_DIST_PATH=/app/apps/web/dist
     ```

3. **Cara Membuat Token Perangkat & Hash SHA-256:**
   Untuk setiap perangkat klien (misal laptop dan HP):
   ```bash
   # Buat token acak 256-bit (simpan string ini untuk diinput ke PWA di menu Data)
   TOKEN=$(openssl rand -hex 32)
   echo "Device Token (masukkan di UI): $TOKEN"

   # Hitung hash SHA-256 (masukkan ke .env DEVICE_TOKENS)
   HASH=$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')
   echo "Hash Token (masukkan ke .env): $HASH"
   ```

---

## 4. Menjalankan Kontainer Aplikasi & Basis Data

Jalankan container menggunakan Podman Compose:
```bash
# Bangun image dan jalankan di latar belakang
podman-compose -f deploy/podman-compose.yml up -d --build

# Periksa status kesehatan kontainer
podman ps

# Periksa log aplikasi
podman logs -f vibehabit-app
```

Verifikasi bahwa port `3001` hanya terikat di loopback `127.0.0.1`:
```bash
# Uji health check lokal
curl -i http://127.0.0.1:3001/api/v1/health

# Verifikasi binding port di host
ss -tulpn | grep 3001
# Output yang benar: 127.0.0.1:3001 (BUKAN 0.0.0.0:3001)
```

---

## 5. Eksekusi Migrasi Basis Data

Jalankan skrip migrasi SQL resmi ke dalam kontainer database:
```bash
podman exec -i vibehabit-db psql -U vibehabit_user -d vibehabit < deploy/migrations/001_init.sql

# Verifikasi 5 tabel domain dan 1 sequence telah terbuat
podman exec -it vibehabit-db psql -U vibehabit_user -d vibehabit -c "\dt"
```

Daftar tabel yang harus muncul:
- `categories`
- `habits`
- `habit_schedules`
- `logs`
- `settings`
- Sequence: `vibehabit_server_seq`

---

## 6. Konfigurasi Tailscale Serve (Port :8443)

Publikasikan port `3001` ke Tailnet pada port HTTPS `:8443`:
```bash
tailscale serve --bg --https=8443 3001

# Periksa status publikasi
tailscale serve status
```

### Pemasangan PWA di Klien:
1. Buka peramban di laptop atau smartphone:
   `https://<nama-host-vps>.<tailnet>.ts.net:8443`
2. Klik tombol **"Install App"** / **"Tambahkan ke Layar Utama"**.
3. Buka tab **"Data"** di aplikasi, masukkan Device Token yang telah dibuat pada Langkah 3.
4. Uji sinkronisasi dengan menekan tombol **"Sinkronkan Sekarang"**.

---

## 7. Otomasi Cadangan Data (*Backup Automation* — Layer 2)

Skrip `deploy/backup.sh` melakukan dump database harian dengan kompresi gzip dan rotasi 7 hari.

1. Berikan izin eksekusi:
   ```bash
   chmod +x deploy/backup.sh
   ```

2. Jalankan uji cadangan manual:
   ```bash
   ./deploy/backup.sh
   ```
   Berkas cadangan akan disimpan di: `/var/backups/vibehabit/vibehabit_backup_YYYYMMDD_HHMMSS.sql.gz`.

3. Pasang cron harian (setiap pukul 03:00 pagi):
   ```bash
   crontab -e
   ```
   Tambahkan baris berikut:
   ```cron
   0 3 * * * /opt/vibehabit/deploy/backup.sh >> /var/log/vibehabit_backup.log 2>&1
   ```

---

## 8. Prosedur Pemulihan Bencana (*Disaster Recovery*)

### 8.1 Verifikasi Integritas Berkas Backup:
```bash
gzip -t /var/backups/vibehabit/vibehabit_backup_YYYYMMDD_HHMMSS.sql.gz
echo $? # Wajib menghasilkan 0
```

### 8.2 Uji Pemulihan ke Database Uji (Dry-Run):
```bash
# 1. Buat basis data uji kosong
podman exec -i vibehabit-db psql -U vibehabit_user -c "CREATE DATABASE vibehabit_restore_test;"

# 2. Pulihkan berkas dump ke database uji
gzip -dc /var/backups/vibehabit/vibehabit_backup_YYYYMMDD_HHMMSS.sql.gz | podman exec -i vibehabit-db psql -U vibehabit_user -d vibehabit_restore_test

# 3. Verifikasi jumlah baris
podman exec -i vibehabit-db psql -U vibehabit_user -d vibehabit_restore_test -c "SELECT count(*) FROM habits;"

# 4. Hapus basis data uji setelah verifikasi selesai
podman exec -i vibehabit-db psql -U vibehabit_user -c "DROP DATABASE vibehabit_restore_test;"
```

### 8.3 Pemulihan Penuh ke Database Produksi:
```bash
# Pulihkan langsung ke database utama vibehabit
gzip -dc /var/backups/vibehabit/vibehabit_backup_YYYYMMDD_HHMMSS.sql.gz | podman exec -i vibehabit-db psql -U vibehabit_user -d vibehabit
```

---

## 9. Empat Lapisan Pertahanan Data (4-Layer Defense)

1. **Lapisan 1 (Klien):** Setiap perangkat (Laptop & HP) memegang salinan lengkap data mandiri di IndexedDB (Dexie).
2. **Lapisan 2 (Server VPS):** `deploy/backup.sh` menjalankan `pg_dump` harian terkompresi dengan rotasi 7 hari.
3. **Lapisan 3 (Off-site Backup):** Salin berkas cadangan dari VPS ke laptop secara berkala via `rsync` melalui Tailscale:
   ```bash
   rsync -avz user@vps:/var/backups/vibehabit/ ~/Backups/vibehabit/
   ```
4. **Lapisan 4 (Aplikasi):** Fitur Export JSON mandiri di tab "Data" aplikasi PWA (dapat diimpor kapan pun dengan mode Merge LWW atau Clean Restore).
