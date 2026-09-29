---
name: Serene Habit Architecture
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
  on-surface-variant: '#3e4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7881'
  outline-variant: '#bec8d2'
  surface-tint: '#006591'
  primary: '#006591'
  on-primary: '#ffffff'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#89ceff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#9d4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#fa7417'
  on-tertiary-container: '#592300'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  base-bg: '#F8F9FA'
  base-card: '#FFFFFF'
  text-main: '#0F172A'
  text-secondary: '#64748B'
  border-subtle: '#E2E8F0'
  structure-blue: '#0EA5E9'
  structure-blue-dark: '#0369A1'
  structure-green: '#10B981'
  structure-green-dark: '#047857'
  accent-orange: '#F97316'
  accent-orange-dark: '#C2410C'
  accent-amber: '#F59E0B'
  status-error: '#EF4444'
  status-error-dark: '#DC2626'
  status-not-done: '#94A3B8'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  stat-counter:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.01em
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

This design system establishes a warm, serene, and intentional environment for daily habit tracking. Built around a purposeful 60-30-10 distribution model, the UI minimizes cognitive friction and avoids chaotic gamification tropes, screaming alerts, or synthetic dopamine loops.

The visual style unites **Warm Modern Minimalism** with **Calm Structured Utility**. By restricting high-vibrancy accents strictly to primary commitments and milestones, the interface gives users psychological grounding, visual quietness, and effortless scanability. Surfaces feel soft and tangible, type remains uncluttered and human, and interactions encourage steady, pressure-free personal growth.

## Colors

The color palette is calibrated around a disciplined **60-30-10 functional distribution** ensuring clear hierarchy, low cognitive load, and complete WCAG AA accessibility compliance across all text and interactive elements.

### 1. 60% Base (Calm & Low Cognitive Load)
Forming the vast majority of the viewport, the base canvas and card containers promote a quiet, restful backdrop:
- **Canvas Background:** `#F8F9FA`
- **Cards & Surface Containers:** `#FFFFFF`
- **Main Heading & Body Text:** `#0F172A` (exceeds 12:1 contrast against `#FFFFFF`)
- **Secondary & Meta Text:** `#64748B` (4.6:1 contrast ratio against white)
- **Dividers & Structural Borders:** `#E2E8F0`

### 2. 30% Structure (Architectural Clarity & Progression)
Structure tokens direct the eye, organize sections, map trends, and display ritual achievements:
- **Calm Blue (`#0EA5E9`, Dark Shade `#0369A1`):** Applied to active navigation items, structural headers, categorical card accents, data charts, partial progress states, and habit streak history graphs. When rendering interactive text, links, or filled active button backgrounds over light containers, `#0369A1` is mandatory to satisfy AA legibility.
- **Sage Green (`#10B981`, Dark Shade `#047857`):** Reserved strictly for complete fulfillment states: checked habit checkboxes, 100% completion rates, successful sync indicators, and health category items. Text and fine icon accents use `#047857`.

### 3. 10% Accent (Energy & Celebratory Feedback)
Used sparingly to preserve visual hierarchy and prevent habit fatigue:
- **Energetic Orange (`#F97316`, Dark Shade `#C2410C`):** Exclusively designated for core, forward-moving primary Calls to Action (e.g., "Mulai", "Tambah Habit", "Simpan", "Sinkronkan Sekarang"). Filled primary buttons use `#C2410C` or high-contrast white text on `#C2410C` for unequivocal visual prominence and accessibility.
- **Warm Amber (`#F59E0B`):** Reserved solely for active streak flames, milestone awards, and celebratory reward badges. Amber is strictly prohibited from being utilized as a broad card background.

### Semantic Status & Progress Tokens
- **Partial Progress:** Blue `#0EA5E9`
- **Completed:** Green `#10B981`
- **Not Done / Incomplete Track:** Neutral Gray `#94A3B8`
- **Errors / Destructive Actions:** Base `#EF4444` (Dark `#DC2626`)
- **Summary Surface Gradient:** A soft, desaturated linear gradient (`linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)`) applied exclusively to top summary highlight cards.

## Typography

Typography leverages **Plus Jakarta Sans** across all roles to project warmth, approachability, and structured clarity without falling into rigid corporate sterility. 

### Typographic Rhythm & Readability
- **Headlines:** Feature confident geometric terminals softened by rounded letterforms, setting an encouraging tone.
- **Numbers & Metrics:** Habit counts, dates, and streak metrics implement tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shifts during incremental count animations.
- **Copy Considerations (Bahasa Indonesia):** Indonesian text strings often run longer than English equivalents. Line heights are tuned generously (1.4x to 1.5x) to accommodate multi-line wrap gracefully without visual clutter.

## Layout & Spacing

A unified 8-point baseline grid provides rhythmic consistency, comfortable breathing room, and intuitive vertical sequencing.

### Responsive Breakpoints & Viewport Adaptations
- **Mobile (<768px):** Single-column layout. Margin: `1rem` (16px), Gutters: `1rem`. Fixed 64px bottom navigation bar with iOS/Android safe area padding (`env(safe-area-inset-bottom)`).
- **Tablet (768px – 1023px):** Constrained 2-column card layout centered at a maximum width of 720px. Outer margins adjust to `1.5rem`.
- **Desktop (>=1024px):** 12-column layout flanked by a fixed 240px persistent navigation rail. Canvas width is constrained to `1080px` to maintain optimal line scan lengths and prevent habit cards from becoming stretched horizontally.

## Elevation & Depth

Visual hierarchy is maintained through **Tonal Surface Tiering with Low-Contrast Whispering Outlines** rather than stark drop shadows.

- **Level 0 (Canvas):** Pure `#F8F9FA` background with zero elevation.
- **Level 1 (Cards, Modals, Bars):** `#FFFFFF` surfaces wrapped in a subtle 1px border (`#E2E8F0`) paired with an ultra-soft ambient shadow (`box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03), 0 2px 8px rgba(15, 23, 42, 0.02)`).
- **Summary Highlight Cards:** Finished with a light linear gradient from pale blue to pale sage (`rgba(14, 165, 233, 0.08)` to `rgba(16, 185, 129, 0.08)`) with a 1px border tinted in `#0EA5E9` at 20% opacity.
- **Active Tactile Press:** Buttons and interactive elements compress subtly (`transform: scale(0.985)`) on click or touch instead of elevating higher.

## Shapes

The design system adopts a **Level 2 (Rounded)** shape strategy to deliver an organic, friendly aesthetic while maintaining structural stability.

- **Cards, Panels, & Dialogs:** `1rem` (16px) corner radius to create inviting, friendly containers.
- **Buttons & Input Fields:** `0.75rem` (12px) for balanced ergonomics and touch precision.
- **Checkboxes:** `0.5rem` (8px) rounded corners, providing a modern, tactile alternative to standard square boxes.
- **Badges, Pills, & Chips:** Fully rounded pill radius (`9999px`) to clearly separate micro-metadata from content surfaces.

## Components

### 1. Habit Cards
- **Container:** `#FFFFFF` background, `1rem` border radius, 1px `#E2E8F0` border, `1rem` internal padding.
- **Incomplete / Not Done:** Checkbox border `#94A3B8` (1.5px) over transparent center. Title in `#0F172A`, category pill in muted neutral gray.
- **Completed:** Checkbox filled with Sage Green (`#10B981`) featuring a crisp white SVG check icon. Habit title subtly transitions to `#64748B` with an optional soft strike-through.
- **Quantitative Habit Progress:** Linear progress bar with a 6px track in `#E2E8F0`. If in-progress, fill uses Calm Blue (`#0EA5E9`). When complete, track fill shifts to Sage Green (`#10B981`). Stepper controls (`-` / `+`) are styled with 36px circular bounds and 1px `#E2E8F0` borders.

### 2. Primary & Secondary CTA Buttons
- **Primary CTA ("Mulai", "Tambah Habit", "Simpan", "Sinkronkan Sekarang"):** Solid Energetic Orange Dark (`#C2410C`), pure white text, font `label-lg`, radius `0.75rem`, 48px height. On hover/active: `#9A3412`.
- **Secondary Structure Button:** Calm Blue Dark (`#0369A1`) text with an 8% blue tinted background (`rgba(14, 165, 233, 0.08)`), radius `0.75rem`, 48px height.
- **Destructive Button:** Red Dark (`#DC2626`) outline or text-only link; never screaming red backgrounds for non-critical confirmations.

### 3. Streak & Reward Badges
- **Streak Pill:** 24px height, background `#FFFBEB`, border 1px solid `#FDE68A`, font `stat-counter`.
- **Flame Icon:** Geometric vector in Warm Amber (`#F59E0B`). Number text rendered in `#B45309`. If streak is 0, the container shifts to `#F1F5F9` with a `#94A3B8` icon.

### 4. Summary & Health Category Cards
- **Summary Metric Card:** Decorated with a delicate gradient (`linear-gradient(135deg, rgba(14, 165, 233, 0.06), rgba(16, 185, 129, 0.06))`), 1px border `#E2E8F0`, displaying overall completion rates in `#047857`.
- **Health Category Items:** Tagged with Sage Green (`#047857` on `#ECFDF5` container background).

### 5. Checkboxes & Radio Controls
- **Unchecked:** 24px box, 8px radius, border 1.5px `#94A3B8`, background `#FFFFFF`.
- **Checked:** 24px box, 8px radius, background `#10B981`, border `#10B981`, white checkmark glyph.
- **Focus State:** 3px outward focus halo in `#0EA5E9` at 30% opacity.

### 6. Inputs & Search Fields
- **Container:** 44px height, background `#FFFFFF`, border 1px solid `#E2E8F0`, radius `0.75rem`, text `#0F172A`, placeholder `#94A3B8`.
- **Active Focus:** Border transitions to Calm Blue Dark (`#0369A1`) with a 3px soft blue glow (`rgba(14, 165, 233, 0.15)`).

### 7. Bottom & Rail Navigation
- **Active Tab:** Icon and label in Calm Blue Dark (`#0369A1`) with a subtle 3px horizontal indicator pill.
- **Inactive Tab:** Icon and label in Secondary Text `#64748B`.