# F8 — Design System (Dashboard V18)

- **Date:** 2026-11-18
- **Reference:** `08-ui-ux-specification.md` §3.1–3.6 & Decision D20

---

## 1. Design Tokens

| Token | Value | Role |
| :--- | :--- | :--- |
| `--ink` | `#1C2B33` | Primary body & heading text |
| `--ink-soft` | `#4A5A63` | Metadata & secondary labels |
| `--paper` | `#F7F5F0` | Warm surface accent |
| `--surface` | `#FFFFFF` | Cards & tables |
| `--teal` | `#0F766E` | Primary action buttons & links |
| `--amber` | `#B45309` | Pending decisions & similarity review flags |
| `--green` | `#15803D` | Kompeten (K) & confirmed status |
| `--red` | `#B91C1C` | Belum Kompeten (BK) & critical errors |

## 2. Visual Direction (D20)

- **Single Accent Treatment:** Glassmorphism cards (`.glass-card` with `rounded-2xl`) paired with dark left sidebar (`bg-slate-950`) and light workspace (`bg-[#f8fafc]`).
- **Motion:** Hover lift (`whileHover={{ y: -5 }}`) strictly gated by `useReducedMotion()`.
- **Accessibility:** WCAG 2.1 AA contrast, semantic table headers, `aria-live` status banners, colour never sole indicator.
