---
name: Serene Focus Habit Architecture
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#4f5d71'
  on-tertiary: '#ffffff'
  tertiary-container: '#67758b'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#d5e3fc'
  tertiary-fixed-dim: '#b9c7df'
  on-tertiary-fixed: '#0d1c2e'
  on-tertiary-fixed-variant: '#3a485b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  stat-streak:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies mindful intentionality, quiet competence, and dignified personal discipline. Crafted specifically for personal ritual architecture and self-mastery, the experience is intentionally stripped of dopamine-chasing mechanics, childish badges, avatars, social pressure, and noisy gamification.

The aesthetic blends **Warm Digital Minimalism** with **Calm Utility**. It uses generous breathing room, crisp typographical hierarchies, tactile organic curves (12px–16px radii), and balanced visual anchors to engender psychological stability, clarity, and daily focus. Interactions must feel serene, permanent, and private—serving the individual's quiet progress rather than demanding endless screen time.

## Colors

The palette relies on restorative botanical teals, supportive earthen ambers, and clean architectural slates. All pairings conform strictly to WCAG 2.1 AA contrast requirements (minimum 4.5:1 for body text, 3:1 for large graphical anchors).

### Color Philosophy & Tokens

#### Primary: Calm Teal
- Light Mode: `#0D9488` (Teal 600) for active states, checkmarks, primary buttons, and successful commitments. Surfaces utilize `#F0FDFA` (Teal 50).
- Dark Mode: `#14B8A6` (Teal 500) for vibrant contrast against midnight slate; `#134E4A` (Teal 900) for contained fills.

#### Secondary / Accent: Warm Amber
Reserved purely for sustained momentum (streaks, active rhythm, current cadence).
- Light Mode: `#D97706` (Amber 600) for streak numbers, active flame icon fills, and subtle focus glows. Tinted container: `#FEF3C7` (Amber 100).
- Dark Mode: `#F59E0B` (Amber 500) on container `#78350F` (Amber 900).

#### Semantic Habit Categories
Each category possesses dedicated pairing tokens (Icon/Text on Tint Surface):
- **Kesehatan (Health):** Emerald (`#059669` / Surface: `#ECFDF5`; Dark: `#34D399` / `#064E3B`)
- **Produktivitas (Productivity):** Indigo-Slate (`#4F46E5` / Surface: `#EEF2FF`; Dark: `#818CF8` / `#1E1B4B`)
- **Pikiran & Mental (Mindfulness):** Calm Sky (`#0284C7` / Surface: `#F0F9FF`; Dark: `#38BDF8` / `#0C4A6E`)
- **Kebugaran (Fitness):** Terracotta-Rose (`#E11D48` / Surface: `#FFF1F2`; Dark: `#FB7185` / `#4C0519`)
- **Finansial (Finance):** Olive-Bronze (`#65A30D` / Surface: `#F7FEE7`; Dark: `#A3E635` / `#1A2E05`)

#### Local-First Sync & Connection Tokens
- **Tersinkron (Synced):** Icon/Text `#0D9488`, Surface `#F0FDFA` (Dark: Text `#2DD4BF`, Surface `#115E59`)
- **Menunggu sinkron (Pending):** Icon/Text `#D97706`, Surface `#FFFBEB` (Dark: Text `#FBBF24`, Surface `#451A03`)
- **Offline (Offline):** Icon/Text `#64748B`, Surface `#F1F5F9` (Dark: Text `#94A3B8`, Surface `#1E293B`)
- **Gagal sinkron (Error/Alert):** Icon/Text `#E11D48`, Surface `#FFF1F2` (Dark: Text `#FB7185`, Surface `#4C0519`)

#### Neutral Surface Architecture
- **Light:** Canvas `#F8FAFC`, Surface Tier 1 `#FFFFFF`, Surface Tier 2 `#F1F5F9`, Borders `#E2E8F0`, Text Main `#0F172A`, Text Muted `#64748B`.
- **Dark:** Canvas `#0F172A`, Surface Tier 1 `#1E293B`, Surface Tier 2 `#334155`, Borders `#334155`, Text Main `#F8FAFC`, Text Muted `#94A3B8`.

## Typography

The typographical structure is engineered exclusively using **Inter** to ensure maximum legibility at small sizes, optimal tabular figure alignment for tracking numbers, and clinical neutrality.

- **Headline Hierarchy:** Expresses grounded confidence. We avoid expressive display weights or serif flourishes to prevent sentimentality.
- **Numbers and Counters:** Habit tallies, streak markers, and timer readouts use tabular numbers (`tnum`) to eliminate layout jitter during active data updates.
- **Language Nuance (Bahasa Indonesia):** Indonesian titles and phrases are generally longer than English counterparts (e.g., "Menunggu sinkron", "Selesaikan target harian"). Line heights are balanced between 1.4x and 1.5x to prevent tight line collisions on multi-line Indonesian copy.

## Layout & Spacing

A strict 8-point baseline grid governs all spacing dimensions, guaranteeing cohesive rhythm between density and breathing room.

### Form Factors & Adaptation

- **Mobile Viewport (<768px):** Single-column layout. Max container width: 100%. Margin: `1rem` (16px), Component padding: `1rem`. Bottom navigation is fixed with safe-area insets (`env(safe-area-inset-bottom)`).
- **Tablet / Responsive Desk (<1024px):** Single or 2-column card layout. Max width: 720px centered.
- **Desktop (>=1024px):** 12-column layout with a fixed 260px persistent left navigation rail replacing the mobile bottom nav bar. Main canvas is constrained to a maximum width of 1040px to preserve comfortable scan lines and prevent habit cards from becoming excessively wide.

### Component Spacing Rhythm
- Section header to content list: `1rem` (16px)
- Card-to-card vertical gap: `0.75rem` (12px)
- Internal card padding: `1rem` (16px)
- Interactive target minimum: `48px` x `48px` on touch screens.

## Elevation & Depth

This design system avoids high-contrast dropshadows or floating skeuomorphism. It utilizes a **Tonal Surface Tiering with Whispering Borders** technique.

1. **Base Tier (Background):**
   - Light: `#F8FAFC`
   - Dark: `#0F172A`
2. **Elevated Tier 1 (Cards, Top Bar, Bottom Bar, Side Rail):**
   - Light: `#FFFFFF` with 1px border (`#E2E8F0`) and subtle ambient shadow: `0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)`.
   - Dark: `#1E293B` with 1px border (`rgba(255, 255, 255, 0.06)`).
3. **Elevated Tier 2 (Sheets, Modals, Popovers):**
   - Light: `#FFFFFF` with border `#CBD5E1` and ambient elevation: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
   - Dark: `#1E293B` with border `rgba(255, 255, 255, 0.1)` and backdrop wash: `rgba(15, 23, 42, 0.75)` with `backdrop-filter: blur(8px)`.
4. **Interactive Focus / Pressed State:**
   - Instead of raising the surface higher, active elements depress slightly (scale `0.985`) accompanied by an understated primary-tint ring (`box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.2)`).

## Shapes

The shape system operates at Level 2 (Rounded) with deliberate exceptions for compact controls:

- **Habit Cards & Large Surfaces:** `1rem` (16px) corner radius. This softens the container edges without compromising geometric discipline.
- **Buttons, Segmented Controls, & Input Fields:** `0.75rem` (12px) corner radius for balanced hand-feel.
- **Pills, Badges, & Sync Status Indicators:** Full pill (`9999px`) roundedness to visually differentiate metadata from actionable containers.
- **Checkboxes:** `0.5rem` (8px) rounded corners, moving away from harsh rectangles or completely round buttons to signal positive actuation.

## Components

### 1. Top Bar & Sync Status Indicators
- **Top Bar Structure:** Compact 56px height. Left: Clean screen title in `headline-md`. Right: Status pill indicator.
- **Sync Status Pills:** Full-pill enclosure, `label-sm` font, height 26px, padding 4px 10px, containing an 8px circular status indicator icon + text:
  - *Tersinkron:* Solid calm teal dot, quiet teal background.
  - *Menunggu sinkron:* Amber pulsing dot, subtle amber container.
  - *Offline:* Dim slate circle, outline treatment.
  - *Gagal sinkron:* Non-intrusive soft rose container with warning exclamation point; tapping opens a contextual retry banner without blocking the UI.

### 2. Habit Cards
Card container has 16px radius, Tier 1 elevation, and 16px internal padding.
- **Standard Checkbox Completion:**
  - Left: 28px custom check indicator (`rounded-md`, 8px). Unchecked: 1.5px border (`#94A3B8`). Checked: filled with Primary Teal and animated white checkmark.
  - Center: Habit Title in `body-lg` (weight 500), Category chip underneath in `label-sm`, frequency schedule tag.
  - Right: Streak Badge.
- **Quantitative Progress Habits (Duration or Numeric Count):**
  - Center progress layout features current vs target readout (e.g., *750 / 1000 ml* or *25 / 45 mnt*).
  - A horizontal 6px height track (`#E2E8F0` / Dark: `#334155`) with active fill using category accent or primary teal. Smooth CSS width transitions (`300ms cubic-bezier(0.4, 0, 0.2, 1)`).
  - Quick-stepper triggers (`-` and `+`) sized at 36px with tactile feedback.

### 3. Streak Badge
- Dedicated 24px height pill, background: Amber 50 (Dark: Amber 950/40), border: Amber 200 (Dark: Amber 800/50).
- Icon: Restrained geometric flame vector in Warm Amber (`#D97706`).
- Label: `stat-streak` tabular numbers with zero extra fluff. If streak is 0, the badge assumes a muted slate appearance.

### 4. Segmented Control ('Mingguan' / 'Bulanan')
- Container: Background `#F1F5F9` (Dark: `#0F172A`), padding: 4px, radius: 12px.
- Segment Tab: Transparent background, `label-md` weight 500, `#64748B`.
- Selected Tab: Background `#FFFFFF` (Dark: `#1E293B`), shadow `0 1px 2px rgba(0,0,0,0.05)`, font weight 600, color `#0F172A` (Dark: `#F8FAFC`), radius: 8px.

### 5. Progress Ring & Analytics Bar
- **Progress Ring:** SVG circle, stroke width 8px, rounded stroke ends. Background path `#E2E8F0` (Dark: `#334155`). Fill path: Primary Teal with percentage centered in `stat-streak`.
- **Bar Indicators:** Rounded end-caps, responsive height scaling, baseline-aligned with day initials below (`S, S, R, K, J, S, M`).

### 6. Navigation
- **Mobile Bottom Navigation:** Fixed 64px bar with 4 items:
  1. *Hari Ini* (Calendar tick icon)
  2. *Analitik* (Bar graph icon)
  3. *Kelola* (Sliders / list configuration icon)
  4. *Data* (Database / cloud sync state icon)
  - Active color: Primary Teal `#0D9488`. Inactive color: Slate `#64748B`.
- **Desktop Sidebar Navigation:** Replaces bottom nav at >=1024px. 260px fixed width, vertical stack with subtle brand header, section label dividers, and wide pill buttons with icons and labels aligned to the left.

### 7. Buttons, Inputs & Dialogs
- **Primary Button:** Height 48px, radius 12px, font `label-md` (weight 600). Solid Teal `#0D9488` with white text. Active scale `0.985`.
- **Bottom Sheet Modal (Mobile):** Rounded top corners 20px, drag affordance pill (36px x 4px, `#CBD5E1`), backdrop blur, smoothly sweeps from bottom.
- **Toast Notifications:** Floating snackbar 16px from bottom edge (above navigation), pill shape, neutral dark fill `#0F172A` with contrasting white text and single inline action in Teal `#2DD4BF`.
- **Confirmation Dialog:** Desktop and mobile dialog centered, 16px radius, max-width 400px. High visual clarity: destructive acts use clean rose text instead of loud screaming backgrounds.

### 8. Empty States
- Elegant single-line stroke illustrations (stroke: 1.5px, color: Slate `#94A3B8`).
- Direct, constructive Indonesian messaging (e.g., "Belum ada kebiasaan aktif. Mulai satu langkah kecil hari ini.").
- Single clear primary call-to-action button ("Buat Kebiasaan").