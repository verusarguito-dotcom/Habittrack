# Design System (DESIGN_SYSTEM.md)

Status: Active
Last updated: 2026-09-29
Source: Translated directly from `stitch_vibehabit_tracker_pwa/serene_focus_habit_architecture/DESIGN.md` (Google Stitch UI).

## 1. Visual Direction & Personality
- **Prinsip Utama:** *Mindful Intentionality, Quiet Competence, & Dignified Personal Discipline*.
- **Filosofi Antarmuka:** **Warm Digital Minimalism & Calm Utility**. Aplikasi ini dirancang bersih dari mekanisme pemburu dopamin, lencana kekanak-kanakan, avatar, atau gamifikasi bising. 
- **Pengalaman Pengguna (UX):** Memberikan ruang bernapas yang lapang, hierarki tipografi yang tegas, kurva sentuh organik (12px–16px), dan jangkar visual yang seimbang untuk menciptakan ketenangan mental dan fokus harian.
- **Standar Aksesibilitas:** Seluruh rasio kontras teks memenuhi standar **WCAG 2.1 AA** (minimal 4.5:1 untuk teks isi, 3:1 untuk elemen grafis interaktif).

## 2. Palet Warna & Token Desain (Light & Dark Mode)

### 2.1 Filosofi Warna Inti
1. **Primary: Calm Teal**
   - *Light Mode:* `#0D9488` (Teal 600) untuk aksi utama, tombol simpan, centang selesai, dan status sukses. Kontainer: `#F0FDFA` (Teal 50).
   - *Dark Mode:* `#14B8A6` (Teal 500) untuk kontras tinggi di atas kanvas gelap; kontainer: `#134E4A` (Teal 900).
2. **Secondary / Accent: Warm Amber (Streak & Momentum)**
   - Dikhususkan murni untuk indikator konsistensi (streak, api aktif, momentum harian).
   - *Light Mode:* `#D97706` (Amber 600) untuk angka streak dan ikon api aktif. Kontainer: `#FEF3C7` (Amber 100).
   - *Dark Mode:* `#F59E0B` (Amber 500) dengan kontainer `#78350F` (Amber 900).

### 2.2 Kategori Habit Semantik
Setiap kategori habit memiliki kode warna khusus (Ikon/Teks di atas kontainer lembut):
- 🌿 **Kesehatan (Health):** Emerald (`#059669` / Surface: `#ECFDF5`; Dark: `#34D399` / `#064E3B`)
- 💼 **Produktivitas / Karir:** Indigo-Slate (`#4F46E5` / Surface: `#EEF2FF`; Dark: `#818CF8` / `#1E1B4B`)
- 🧠 **Pikiran & Mental (Mindfulness):** Calm Sky (`#0284C7` / Surface: `#F0F9FF`; Dark: `#38BDF8` / `#0C4A6E`)
- 🏃 **Kebugaran (Fitness):** Terracotta-Rose (`#E11D48` / Surface: `#FFF1F2`; Dark: `#FB7185` / `#4C0519`)
- 💰 **Finansial (Finance):** Olive-Bronze (`#65A30D` / Surface: `#F7FEE7`; Dark: `#A3E635` / `#1A2E05`)
- 🏷️ **Umum / Tanpa Kategori:** Neutral Slate (`#64748B` / Surface: `#F1F5F9`; Dark: `#94A3B8` / `#1E293B`)

### 2.3 Token Status Sinkronisasi Local-First
- 🟢 **Tersinkron:** Teks/Ikon `#0D9488`, Kontainer `#F0FDFA` (Dark: Teks `#2DD4BF`, Kontainer `#115E59`)
- 🟡 **Menunggu sinkron (n):** Teks/Ikon `#D97706`, Kontainer `#FFFBEB` (Dark: Teks `#FBBF24`, Kontainer `#451A03`)
- ⚪ **Offline:** Teks/Ikon `#64748B`, Kontainer `#F1F5F9` (Dark: Teks `#94A3B8`, Kontainer `#1E293B`)
- 🔴 **Gagal sinkron / Server tidak terjangkau:** Teks/Ikon `#E11D48`, Kontainer `#FFF1F2` (Dark: Teks `#FB7185`, Kontainer `#4C0519`)

### 2.4 Arsitektur Permukaan Netral (Surface Tiering)
```css
:root {
  /* Light Theme */
  --bg-canvas: #F8FAFC;            /* Slate 50 */
  --surface-tier-1: #FFFFFF;       /* Card, Top Bar, Bottom Nav */
  --surface-tier-2: #F1F5F9;       /* Inset Inputs, Segmented Controls */
  --border-subtle: #E2E8F0;        /* Slate 200 */
  --border-strong: #CBD5E1;        /* Slate 300 */
  --text-main: #0F172A;            /* Slate 900 */
  --text-secondary: #475569;       /* Slate 600 */
  --text-muted: #64748B;           /* Slate 500 */
}

.dark {
  /* Dark Theme */
  --bg-canvas: #0F172A;            /* Slate 900 */
  --surface-tier-1: #1E293B;       /* Slate 800 */
  --surface-tier-2: #334155;       /* Slate 700 */
  --border-subtle: #334155;        /* Slate 700 */
  --border-strong: #475569;        /* Slate 600 */
  --text-main: #F8FAFC;            /* Slate 50 */
  --text-secondary: #94A3B8;       /* Slate 400 */
  --text-muted: #64748B;           /* Slate 500 */
}
```

## 3. Tipografi
Struktur tipografi menggunakan **Inter** untuk memaksimalkan keterbacaan pada ukuran kecil, stabilitas angka tabular, dan netralitas visual:

- **Headline XL:** `36px` / Line-height `44px` / Weight `600` / Letter-spacing `-0.025em` (Mobile: `28px` / `34px`)
- **Headline LG:** `24px` / Line-height `32px` / Weight `600` / Letter-spacing `-0.02em`
- **Headline MD:** `20px` / Line-height `28px` / Weight `600` / Letter-spacing `-0.015em`
- **Body LG:** `16px` / Line-height `24px` / Weight `400`
- **Body MD:** `14px` / Line-height `20px` / Weight `400`
- **Label MD:** `13px` / Line-height `18px` / Weight `500`
- **Label SM:** `11px` / Line-height `16px` / Weight `600` (Caps/Tracking: `0.04em`)
- **Stat / Streak:** `14px` / Line-height `16px` / Weight `700` (`tabular-nums`)

> **Nuansa Bahasa Indonesia:** Judul dan label Bahasa Indonesia lebih panjang dari Bahasa Inggris ("Menunggu sinkron", "Selesaikan target harian"). Rasio *line-height* dijaga pada 1.4x–1.5x untuk mencegah tabrakan baris teks. Angka penghitung dan streak wajib menggunakan class `tabular-nums` untuk mencegah jitter/getaran layout saat angka bertambah.

## 4. Tata Letak, Spacing & Breakpoints

### 4.1 Grid 8-Point
- Margin layar mobile: `1rem` (16px)
- Margin desktop: `2.5rem` (40px)
- Jarak antar kartu: `0.75rem` (12px)
- Padding internal kartu: `1rem` (16px)
- Target sentuh minimal (*touch target*): `48px x 48px`

### 4.2 Breakpoints & Navigasi Responsif
- **Mobile (< 768px):** Kolom tunggal, lebar 100%. Bilah navigasi bawah (*Bottom Navigation Bar*) setinggi 64px tetap melayang di bawah dengan *safe-area inset* (`pb-safe`).
- **Tablet (768px – 1023px):** Tata letak kartu adaptif terpusat, lebar maksimal 720px.
- **Desktop (>= 1024px):** Tata letak workspace 12-kolom dengan **Sidebar Navigasi Kiri Tetap (lebar 260px)** menggantikan bottom nav. Kanvas konten utama dibatasi lebar maksimal **1040px** agar kartu habit tidak melebar berlebihan dan nyaman dipindai mata.

## 5. Bentuk & Sudut (*Shapes & Radius*)
- **Kartu Habit & Permukaan Besar:** `1rem` (16px) — sudut lembut geometris.
- **Tombol, Form Input, & Segmented Control:** `0.75rem` (12px).
- **Pills, Badges, & Indikator Status Sync:** Penuh (`rounded-full` / `9999px`).
- **Checkboxes:** `0.5rem` (8px) — kurva modern yang nyaman ditekan.

## 6. Spesifikasi Komponen Utama

### 6.1 Top Bar & Pill Status Sinkronisasi
- Tinggi bar 56px.
- Status Pill: Kapsul tinggi 26px, padding `4px 10px`, berisi titik status 8px (berkedip halus saat sinkronisasi berlangsung) + label teks singkat.

### 6.2 Kartu Habit (Habit Cards)
- **Mode Checklist Standar:**
  - Kiri: Indikator centang kustom 28px (`rounded-md`, 8px). Saat selesai, terisi warna *Calm Teal* dengan animasi centang putih halus.
  - Tengah: Judul habit dalam `body-lg` (weight 500) yang dicoret (*strikethrough*) lembut saat selesai, chip kategori di bawahnya dalam `label-sm`.
  - Kanan: Badge streak api 🔥.
- **Mode Kuantitatif (Progress Bar):**
  - Tengah: Indikator pencapaian angka (misal: *750 / 1000 ml* atau *25 / 45 mnt*).
  - Track progres horizontal 6px (`bg-slate-200 dark:bg-slate-700`) dengan animasi pengisian halus (`300ms cubic-bezier(0.4, 0, 0.2, 1)`).
  - Tombol stepper cepat (`-` dan `+`) berukuran 36px untuk penambahan nilai tanpa membuka form edit.

### 6.3 Badge Streak
- Kapsul tinggi 24px, latar belakang Amber 50 (Dark: Amber 950/40), border Amber 200 (Dark: Amber 800/50).
- Ikon api vektor geometris dalam warna Warm Amber (`#D97706`).
- Angka streak `tabular-nums` tanpa teks dekoratif berlebih. Jika streak 0, badge berwarna slate netral.

### 6.4 Ring Progres Melingkar & Heatmap Kalender
- **Progress Ring (Halaman Hari Ini):** SVG circle, stroke width 8px, stroke rounded. Warna latar `slate-200` / `slate-700`, path isi *Calm Teal* dengan persentase di tengah.
- **Kalender Heatmap (Dashboard):** Grid CSS murni 7 kolom x N minggu, kotak bergradasi warna sesuai persentase kelulusan hari tersebut.

### 6.5 Navigasi Aplikasi
- **4 Tab Utama:**
  1. 📅 **Hari Ini:** Tampilan check-in harian, selector strip tanggal 5-hari, ring progres.
  2. 📊 **Analitik:** Grafik garis tren mingguan/bulanan (Recharts), rasio keberhasilan, heatmap kalender.
  3. ⚙️ **Kelola:** Daftar manajemen habit, tambah/edit habit, kategori, arsipkan, hapus.
  4. 💾 **Data:** Status sinkronisasi VPS, input token perangkat, fitur Export/Import JSON.

### 6.6 Feedback Interaksi & Mikro-animasi
- Elemen interaktif saat ditekan (*pressed state*) menyusut halus (`scale: 0.985`) dengan ring fokus primary halus.
- Transisi warna: `transition-colors duration-150 ease-out`.
- Hindari animasi berat, bouncing berlebihan, atau suara bising.
