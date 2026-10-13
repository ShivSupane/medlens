# MedLens — Design Document

> **Version:** 1.0 | **Date:** October 2026

---

## 1. Design Philosophy

The UI should feel like a well-designed patient-facing health tool — calm, trustworthy, and easy to scan at a glance. Not a flashy marketing page. Not an obviously AI-generated template.

Three guiding principles:
1. **Clarity over decoration** — every element earns its place; information density is high but not cluttered
2. **Accessible to all ages** — readable type sizes, sufficient contrast, logical tab order
3. **Mobile-first** — most Indian users will access this on a mid-range Android phone over mobile data

---

## 2. Design Tokens

### Colour Palette

**Light mode**
| Token | Value | Use |
|-------|-------|-----|
| `--bg-page` | `#F2F5F3` | Page background |
| `--bg-card` | `#FFFFFF` | Card surfaces |
| `--bg-raised` | `#FAFCFB` | Inset areas, inputs |
| `--bg-muted` | `#EBF1EE` | Tab bars, footer |
| `--txt-main` | `#111B18` | Primary text |
| `--txt-muted` | `#4D6860` | Secondary text |
| `--green-700` | `#157A58` | Primary CTA |
| `--green-500` | `#1A9E72` | Accents, borders on focus |
| `--amber` | `#D97706` | Warnings |
| `--red` | `#DC2626` | Errors, high-risk interactions |

The green palette references the PMBJP Jan Aushadhi programme's brand colour while keeping a clinical, trustworthy feel — not the garish "health app" greens seen in consumer wellness apps.

**Dark mode** swaps to a deep forest-black (`#0C1610`) background with bright mint greens for interactive elements.

### Typography

| Role | Font | Size / Weight |
|------|------|--------------|
| Headlines | Inter | 22–36px / 800 |
| Body | Inter | 14–15px / 400–500 |
| Labels | Inter | 11–13px / 600–700 |
| Medicine names | Inter | 17px / 800 |
| Prices, salts | JetBrains Mono | 12–30px / 600–800 |

Monospace font for prices and chemical salt names reinforces their technical/precise nature and improves scannability.

### Spacing & Radii

- Cards use `--r-xl` (22px) for a softened rectangle — friendly but not childish
- Inner components use `--r-md` (12px) and `--r-sm` (8px)
- Pills/tags always use `--r-pill` (9999px)
- Base spacing unit: 8px grid

---

## 3. Layout

### Desktop (≥ 900px)
Single centred column, max-width 1020px. Wide enough to show medicine cards comfortably, narrow enough to not feel like a spreadsheet.

### Tablet (700–900px)
Savings grid collapses from 4-columns to 2-columns.

### Mobile (< 700px)
- Medicine cards collapse from 2-column grid to stacked single column
- Timetable grid goes to 2-column, then 1-column on very small screens
- FAB hides its text label — shows icon only
- Copilot drawer is full-width (100vw)
- Hero band reduces padding

---

## 4. Key Components

### Scanner Card
Two-tab interface (Photo / Text). The dropzone is large with a clear affordance and supports drag, click, and camera capture (`capture="environment"` on mobile). Preview bar shows thumbnail + filename before analysis.

### Savings Card
Dark green gradient card with a radial glow — it's the most visually distinctive element on the page deliberately, because it's the core value proposition. Four stats in a 4-column grid: instant savings, cost comparison, monthly projection, running total.

### Medicine Cards
Split 2-column: left panel is the detailed information (brand, salt, dosage, why to take, meal guidance, precautions), right panel is the generic alternative box with price and action buttons. On mobile, stacks vertically.

### Copilot Drawer
Slides in from the right. Has its own header, emergency banner, quick-chip suggestion bar, scrollable message list, and fixed input form at bottom. The drawer uses CSS `transform: translateX(100%)` with a transition — no JavaScript animation frame hacking needed.

### FAB
Fixed bottom-right. Pill shape with icon + label. The pulsing green dot signals it's "live" / context-aware. On mobile, text label disappears.

---

## 5. Interaction States

| State | Visual Treatment |
|-------|-----------------|
| Button hover | translateY(-1px) + slightly lighter bg |
| Button active | scale(0.97) |
| Input focus | 3px glow ring in brand green |
| Dropzone hover/drag | border turns green, slight translateY(-1px) lift |
| Time slot card hover | border turns green, subtle lift |
| Medicine card hover | shadow deepens slightly |
| Drawer open | transform: translateX(0), backdrop fade-in |

---

## 6. Accessibility Notes

- All interactive elements have `aria-label` or visible text
- Status messages use `aria-live="polite"` and `role="status"`
- Chat messages use `role="log"` with `aria-live="polite"`
- Emergency banner uses `role="alert"` 
- Savings count uses `aria-live="polite"`
- Focus should be trapped inside the Copilot drawer when open (TODO for v1.1)
- Colour is never the sole indicator of meaning (icons/text accompany colour coding)

---

## 7. Dark Mode Implementation

Theme is toggled via `data-theme="dark"` on `<html>`. CSS custom properties cascade — all components reference tokens so dark mode is a single attribute flip. User preference is saved to `localStorage` and also respects `prefers-color-scheme` on first visit.
