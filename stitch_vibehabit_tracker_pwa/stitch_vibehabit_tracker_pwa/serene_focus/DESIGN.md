---
name: Serene Focus
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#dbc1b2'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#a38c7e'
  outline-variant: '#554337'
  surface-tint: '#ffb783'
  primary: '#ffb887'
  on-primary: '#4f2500'
  primary-container: '#fb923c'
  on-primary-container: '#673200'
  inverse-primary: '#944a00'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#47e0a5'
  on-tertiary: '#003825'
  tertiary-container: '#16c48b'
  on-tertiary-container: '#004a32'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc5'
  primary-fixed-dim: '#ffb783'
  on-primary-fixed: '#301400'
  on-primary-fixed-variant: '#713700'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#68fcbf'
  tertiary-fixed-dim: '#45dfa4'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a tranquil, focused habit architecture engineered to reduce nocturnal cognitive load and eliminate digital fatigue. Designed for users building mindful daily rituals, evening reflections, and disciplined routines, the interface balances restorative calm with purposeful momentum.

The design language merges **Minimalism** with subtle **Tonal Layering** and soft, low-glare luminescence. The user experience prioritizes stillness over urgency: zero harsh high-contrast white flashes, no hyper-stimulating neon micro-animations, and minimal non-essential chrome. Every element feels deliberate, tactile, and grounded, evoking the quiet clarity of an uncluttered desk late at night.

## Colors

The palette adheres strictly to a 60-30-10 atmospheric hierarchy tuned for night-time legibility and strict WCAG AA contrast against deep slate bases.

### 60% — Foundation & Deep Canvas
- **Canvas Base:** `#0F172A` (Slate 900) absorbs eye strain in pitch-black environments.
- **Surface Elevation 1 (Cards, Modules):** `#1E293B` (Slate 800) separates interactives from the base without harsh borders.
- **Surface Elevation 2 (Modals, Popovers):** `#334155` (Slate 700) provides top-layer separation.
- **Structural Outlines / Dividers:** `#334155` (Slate 700) with a secondary subtler option at 50% opacity (`rgba(51, 65, 85, 0.5)`).
- **Text Primary:** `#F1F5F9` (Slate 100) — high-contrast text without the piercing glare of pure `#FFFFFF`.
- **Text Secondary:** `#94A3B8` (Slate 400) — contextual descriptions and active metadata.
- **Text Muted / Disabled:** `#64748B` (Slate 500) — inactive labels and decorative cues.

### 30% — Calm Structure & Progression
- **Calm Sky Blue:** `#38BDF8` (Focus / Active tabs, tracking segments, calendar badges) paired with `#0284C7` for hover/active fills.
- **Desaturated Sage Green:** `#34D399` (Success / Completed checks, health category trackers) backed by `#059669` for contained fills. Reserved strictly for accomplishment and wellness status.

### 10% — Kinetic Accents & Utility
- **Primary Kinetic Accent:** `#FB923C` (Orange 400) and deep pressed state `#EA580C` (Orange 600) strictly for affirmative action CTAs (`Tambah`, `Simpan`, `Mulai`).
- **Streak Flame / Continuity:** `#FBBF24` (Amber 400) celebrates persistent consistency without signaling panic.
- **Destructive Alert:** `#F87171` (Red 400) reserved exclusively for deletions, resets, and failed threshold warnings.

## Typography

The typographic hierarchy blends structured geometric architecture with humanistic body legibility and technical telemetry precision:

- **Display & Headings (Space Grotesk):** Gives habit architecture a modern, structured identity. Its geometric apertures provide personality while retaining clean optical bounds in dark environments.
- **Body & Controls (Plus Jakarta Sans):** Selected for its natural open counters and legible rendering at reduced screen brightness levels, ensuring zero eye fatigue during extended viewing.
- **Metrics, Timers, & Telemetry (JetBrains Mono):** Applied to streaks, numerical completion counters, timer readouts, and timestamps. Monospacing eliminates horizontal layout jitter when numbers advance dynamically.

## Layout & Spacing

The layout philosophy uses a **fluid column grid** with adaptive density limits:
- **Mobile (<640px):** Single-column stack with `margin: 1rem` and compact `gutter: 1rem`. Bottom navigation bars host core transitions to maintain one-handed reachability.
- **Tablet (641px - 1024px):** 6-column grid with `margin: 2rem` and `gutter: 1.25rem`. Habits and performance analytics sit side by side in split modules.
- **Desktop (>1024px):** 12-column grid pinned to a maximum content container of `1140px` to maintain focused visual scope. Spacing scales to `margin: 3rem` and `gutter: 1.5rem`.

The 4px/8px incremental spacing rhythm standardizes visual cadence:
- `space-xs` (4px): Icon-to-label inline offsets, micro-indicators.
- `space-sm` (8px): Compact element grouping, intra-chip padding, list item internals.
- `space-md` (16px): Standard component padding, habit list item separation.
- `space-lg` (24px): Inter-card margins, sheet header padding.
- `space-xl` (40px): Major architectural section splits.

## Elevation & Depth

This system avoids bright drop-shadows and skeuomorphic bevels, relying instead on **tonal surface stacking** combined with **subtle tinted ambient occlusion**:

1. **Ground Zero (`#0F172A`):** The primary view base. Non-interactive background.
2. **Elevated Layer 1 (`#1E293B`):** Standard habit cards, progress panels, and toolbars. Defined by a crisp low-contrast hairline stroke (`1px solid #334155`).
3. **Elevated Layer 2 (`#334155` / Modals & Sheets):** Floating context menus and bottom drawer sheets. Uses a dark ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.45)`.
4. **Active Focus Glow:** When a habit is active or an element receives focus, a soft, low-intensity outer diffusion is applied: `0 0 0 2px rgba(56, 189, 248, 0.25)`.

## Shapes

The shape hierarchy is unified under Level 2 (`roundedness: 2`), balancing organic calm with disciplined interface boundaries:
- **Default Elements (`0.5rem` / 8px):** Buttons, habit card item rows, form inputs, and status badges.
- **Large Panels (`1rem` / 16px):** Modular dashboard containers, calendar overviews, modal dialogues.
- **Full Radius / Pill:** Checkbox toggles, streak flame chips, and bottom navigational tab pills.

## Components

### Buttons
- **Primary Kinetic CTA (`Tambah`, `Simpan`, `Mulai`):** Solid `#FB923C` fill, `#0F172A` bold text, rounded to `0.5rem`. Active state shifts to `#EA580C`. Height: 44px (touch target).
- **Secondary Structure Button:** Surface `#1E293B`, border `1px solid #334155`, text `#F1F5F9`. Hover brightens border to `#38BDF8`.
- **Ghost/Tertiary:** No background, `#94A3B8` text, hover reveals subtle `#1E293B` background fill.

### Habit Cards & List Rows
- Habit cards sit on `#1E293B` with a `1px solid #334155` perimeter.
- Left-side category indicator bar: 4px wide vertical pill colored by category (e.g., `#34D399` for Health).
- Title styled with `headline-sm`, frequency and streak telemetry styled with `label-numeric` in `#94A3B8`.
- Completion toggle sits pinned to the right edge.

### Checkboxes & Completion Rings
- Unchecked: 24px round pill with a 2px border in `#334155` and a transparent core.
- Checked (Success): Instant low-glare morph to `#34D399` fill, displaying a crisp check icon rendered in `#0F172A`. A subtle ring pulse confirms completion without jarring the eyes.

### Chips & Filter Tabs
- Height: 32px with fully rounded pill edges.
- Inactive: `#1E293B` surface, `#64748B` label text.
- Active: Subtle tinted background `rgba(56, 189, 248, 0.12)`, border `1px solid #38BDF8`, text `#38BDF8`.

### Streak Flame Counter
- An inline telemetry chip composed of `#1E293B` fill, `#334155` border, a `#FBBF24` (Soft Amber) flame glyph, and a `label-numeric` streak count in `#F1F5F9`.

### Input Fields
- Filled container `#0F172A` inset into `#1E293B` cards.
- Border `1px solid #334155`. Text in `#F1F5F9` with placeholder text in `#64748B`.
- Focused state transitions border to `#38BDF8` with zero harsh white outline.