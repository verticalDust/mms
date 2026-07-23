# MMS — Design Direction

*v1 · July 2026 · Companion to PLAN.md §1 · Applies to every screen; deviations require a note here.*

## Personality in one line

**Safety equipment, not software.** Utilitarian, high-contrast flat design — the app should feel like a well-made instrument: a Fluke meter, a Knipex tool, an equipment nameplate. Legible in bad light, operable with a gloved thumb, nothing decorative. The one memorable thing is not a flourish — it's that every detail is considered, so the whole thing reads as *instrument-grade*. No gradients, no glassmorphism, no drop shadows; hierarchy comes from spacing, weight, and color.

**The success metric is not "unforgettable" — it's "invisible until needed, then instantly legible."** Distinctiveness comes from the quality of the utilitarian execution, not from expressive decoration.

## Palette (light mode only in v0)

### Neutrals — the chrome (Tailwind slate)
| Role | Value |
|---|---|
| App background | `#F8FAFC` (slate-50) |
| Surface / cards | `#FFFFFF` |
| Borders / dividers | `#E2E8F0` (slate-200) |
| Primary text | `#0F172A` (slate-900) |
| Muted text (minimum) | `#475569` (slate-600) — never lighter for body text |

### Action color — safety orange
- **Primary actions:** `#EA580C` (orange-600) fill, white text; hover `#F97316` (orange-500). Orange-600 (not 500) for fills — better contrast with white text.
- **One primary action per screen.** Everything else is outline/ghost slate.

### Status semantics — reserved, never decorative
| Meaning | Color | Used for |
|---|---|---|
| Bad / stopped | `#DC2626` (red-600) | Machine Down, overdue jobs, Critical priority |
| Caution | `#F59E0B` (amber-500) | Low stock, due soon, unticked-checklist warning |
| Good / running | `#16A34A` (green-600) | Machine Running, job Done |
| Neutral / pending | `#64748B` (slate-500) | Open, Scheduled, Cancelled |

**Two hard rules:**
1. **Status is never color alone.** Always a chip: color + icon + word ("● Down", "▲ Low stock"). Color-blind technicians and direct sunlight on a phone screen both break color-only signals.
2. **Orange is action-only, amber is status-only.** They're near neighbors; keeping them in separate jobs is what keeps "tap this" visually distinct from "worry about this."

## Typography — the IBM Plex superfamily

One family, three roles, full Cyrillic (Bulgarian-ready). Plex was designed as IBM's machine-age corporate voice — engineered, technical, exactly this app's register — and it is *not* one of the overused grotesques (Inter, Roboto, Space Grotesk) every dashboard converges on. Chosen over "Fira everywhere" (the earlier, safer pick) because the Condensed cut gives real industrial character and the mono cut gives true tabular figures.

- **IBM Plex Sans** — body, data, form fields, running text. Neutral, highly legible at small sizes and bad angles. This is the only cut used for **Bulgarian text on the public report form** (Cyrillic verified).
- **IBM Plex Sans Condensed** — labels, table headers, nav, status chips, section headings. The condensed cut reads like an equipment nameplate / wayfinding sign and packs more label into narrow phone columns. This is where the "instrument" character lives. (Internal UI = English only in v0, so its Cyrillic coverage doesn't gate anything.)
- **IBM Plex Mono** — identifiers and figures only: machine codes (`M-014`), SKUs (`BRG-6204`), and every quantity in ledgers/tables. Marks "this is an ID or a number you scan"; fixed advance aligns columns.

Rules:
- **Tabular, lining numerals everywhere numbers matter** (`font-variant-numeric: tabular-nums`). Stock counts, quantities, days-overdue, durations — right-aligned, column-aligned. This single detail is most of what separates instrument-grade from admin-template.
- Section/label text: Condensed, small, slate-600, slight letter-spacing — **never ALL CAPS** (caps hurt legibility and accessibility; the condensed cut + tracking carries the technical-label feel instead).
- Scale: 16px minimum body on mobile · list rows 16px · page/section titles Condensed 18–24px medium · no weight below 400 for running text · line-height 1.5 body.
- Self-host all three cuts (no third-party font request from the factory floor; degrades gracefully offline).

## Layout & interaction principles

- **Touch:** 44×44px minimum targets; the screen's primary action is a full-width ≥56px button pinned in the bottom action zone (thumb reach). ≥8px gaps between adjacent targets. `touch-action: manipulation` globally; `overscroll-behavior: contain` on scrollable lists (no accidental pull-to-refresh mid-checklist).
- **Mobile:** single-column cards; bottom tab bar (My Work · Machines · Parts · More); detail screens end in the pinned action button.
- **Desktop (planner):** sidebar nav + **dense tables** — Maria wants rows per screen, not cards; ~40px rows, `max-w-7xl` container everywhere.
- **Feedback:** async buttons disable + spinner while pending; errors inline next to the field with `role="alert"`; skeletons (not spinners) for list loads; reserve space for async content — no layout jumping.
- **Motion:** 150–200ms color/opacity transitions only; no scale/position animation; respect `prefers-reduced-motion`.
- **Icons:** Lucide only (ships with shadcn/ui), 24px grid. Never emojis.
- **Empty states:** icon + one plain sentence + the action that fixes it ("No jobs assigned. Enjoy it while it lasts." + nothing, per E3-S4; "No machines yet." + Add machine button).
- **Dark mode: not in v0.** The contrast budget is spent on bright-factory-light legibility instead.

## Signature details — what makes it instrument-grade (not decoration)

These are the on-theme details that give the app character *without* costing legibility. Every one earns its place by doing a job:

- **Equipment-nameplate headers.** Machine and part pages lead with a nameplate block: mono code + condensed name + a hairline rule + a small metadata row (location, status). Mirrors the physical plate riveted to the machine — familiar, scannable, distinctive.
- **The QR is a motif, not an afterthought.** It's the front door to the whole system (E1-S5/E5-S1), so it's treated as a first-class visual element on machine pages and labels, paired with the mono code like a real asset tag.
- **Status rail.** Cards/rows carry a 3px left border in the status color (see dashboard tiles in the mockup) — an HMI/SCADA indicator-light convention, readable peripherally.
- **Hairline technical grid.** 0.5px slate-200 dividers, consistent rhythm. Reads as engineered, not styled.
- **Numbers behave like instrument readouts.** Tabular mono, aligned, in ledgers and counts — a column of quantities lines up to the digit.
- **One orchestrated motion moment:** the Down→Running toggle gets a single crisp, confirmed transition (≤200ms). Everything else is a plain color fade. No scattered micro-interactions.

## Considered and rejected (from the frontend-design playbook)

Deliberately *not* doing these — each fights the actual use environment (bright/dim factory light, gloves, speed, trust). Listed so the rejection is on record, not an oversight:

- **Atmospheric backgrounds, gradient meshes, noise/grain overlays** — all reduce contrast; legibility is the whole job.
- **Diagonal / asymmetric / grid-breaking layouts** — technicians scan for a value under time pressure; predictable alignment wins.
- **Custom cursors, decorative borders, expressive display type** — read as "toy," undermine the trust a maintenance system-of-record needs.
- **Dark mode in v0** — a strong *future* look (industrial HMI panels are dark), but it doubles the contrast-testing burden; the v0 budget goes to bright-light legibility. Natural v0.1 evolution — revisit if night shifts in dim areas need it.

## Implementation: one theme file

Map everything to shadcn/ui CSS variables in `globals.css` — `--primary: orange-600`, `--destructive: red-600`, `--muted-foreground: slate-600`, radius `0.375rem` (slightly squared: tool-like, not bubbly). Status chip variants live in one `StatusBadge` component. Result: the entire identity is swappable in one file, same trick as `en.json`.

## Pre-delivery checklist (every screen, every Friday phone pass)

- [ ] Text contrast ≥ 4.5:1 · [ ] no color-only status · [ ] targets ≥ 44px, primary ≥ 56px
- [ ] no horizontal scroll at 375px · [ ] focus rings visible · [ ] `cursor-pointer` on clickables
- [ ] async actions disable their button · [ ] empty states have words and an action
