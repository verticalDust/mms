# MMS — Maintenance Management System · Architecture & Development Plan

*v1.1 · July 2026 · Companion to "Backlog — Epics & User Stories (v0)" · Amended 2026-07-22 after internal design review (see §5)*

**What we're building:** a lightweight, mobile-first factory maintenance app — machine register, spare-parts stock with an honest ledger, work-order queue, self-generating PM schedules, QR-based no-login breakdown reporting, and a planner dashboard. English UI, i18n-ready for Bulgarian. One small VPS, a few €/month. Solo developer, AI-assisted, ~6 weeks.

---

## 1. Architecture

### 1.1 Shape: one boring monolith

One deployable: a single web app + database + in-process background scheduler, in **one Docker container** behind a reverse proxy that terminates TLS. No microservices, no separate API+SPA split, no queue. The Definition of Done (server-persisted state, server-enforced permissions, i18n-ready) is easiest to honor when rules live in exactly one place.

### 1.2 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One language across stack; server components/actions make server-side enforcement and persistence the default path |
| UI | Tailwind CSS + shadcn/ui | Mobile-first, thumb-friendly components without design overhead |
| Database | **SQLite (WAL mode) + Drizzle ORM**, driver `@libsql/client` | Scale (200 machines / 1,000 parts / handful of users) is far below SQLite's ceiling; one file = trivial correct backups; no DB server to run. Driver swapped from better-sqlite3 → libsql: Node 25 is bleeding-edge and libsql ships N-API prebuilts (installs clean, no native compile), same SQLite file + WAL, same backup story |
| Auth | **Hand-rolled `sessions` table** + persistent cookie | "Survives closing the tab" = persistent cookie; ~50 lines beats a young dependency (Better Auth rejected) |
| Background jobs | node-cron registered in **`instrumentation.ts`** | PM generation + daily digest are two cron entries; restart-safety is guaranteed by the idempotency invariants (§1.4), so a missed or doubled tick costs nothing — guard against dev-mode double-registration |
| Images | `sharp` resize-on-upload via a **route handler** (not server actions — body-size limits); files on a disk volume | No object-storage bill; volume backed up with the DB |
| i18n | next-intl: `en.json` for the full app + **`bg.json` for the public report form only (ships in v0)** | Internal UI stays English (E0-S5); but the no-login form is used by the least English-speaking persona — ~20 strings on plumbing that exists anyway |
| Design direction | Flat/utilitarian, safety-orange + slate, Fira Sans/Fira Code — **see DESIGN.md** | Legible in bad factory light, gloved-thumb targets, status never color-alone |
| Email | Nodemailer → free relay tier (**Brevo**, fallback Resend) | Digest (E6-S3) and password reset (E0-S8) share one relay |
| QR | `qrcode` lib + print-CSS A4 label sheet | No PDF pipeline needed |
| Deploy | Docker (multi-stage) + **Caddy** on a small VPS (**Hetzner CX22**, ~€4/mo) | Caddy = automatic HTTPS in two config lines (E0-S1) |
| Backups | Nightly `sqlite3 .backup` + uploads copy via cron, 14-day retention; optional Litestream later | Restore = copy the file back (E0-S6) |

Rejected alternative, for the record: **Django** (would hand us E0 nearly free) — passed over because the app is interaction-heavy on mobile and one language keeps a solo TS build simpler.

### 1.3 Data model — core tables

`users`, `sessions`, `machines`, `downtime_periods`, `parts`, `stock_movements`, `work_orders`, `work_order_status_history`, `work_order_parts`, `checklist_items`, `photos` (polymorphic: machine/job/report), `pm_schedules`, `reports`, `settings` (factory name, timezone).

Every mutating table carries `created_by` + timestamps (DoD: actor + timestamp on significant actions).

### 1.4 The three load-bearing invariants (schema-enforced)

1. **Stock is a ledger, not a number.** Append-only `stock_movements` (receive / issue / adjust / reverse; qty, actor, timestamp, reason, optional `work_order_id`). `parts.on_hand` is a cached column updated in the same transaction as the movement insert; never negative. Removing a part line from a job inserts a **reversing movement** — never deletes. "Movements sum exactly to on-hand" (E2-S6) is an assertable property.
2. **Downtime lives in one table.** `downtime_periods` (machine_id, started_at, ended_at, opened_by, closed_by, optional `work_order_id`). Machine status "Down" ≡ "has an open period". Duration always computed from the period; nothing else stores a copy (E1-S4, E3-S8).
3. **PM generation is idempotent by schema.** Unique constraint on `(schedule_id, due_date)` in work orders. Daily job = "active schedules where next_due ≤ today + 7 and no WO exists for that due date" — no-duplicates and catch-up-after-downtime are the *same* code path (E4-S2). Next due = completion date + interval (floating, E4-S3).

### 1.5 Cross-cutting mechanics

- **QR = one URL, auth decides the view.** Labels encode `https://app/m/{code}`. Signed-in → machine page; anonymous → public report form. One route serves E1-S5 and E5-S1.
- **Permissions in one module.** `can(user, action, resource)` called at the top of every server action / route handler. Two roles (Admin, Technician) — a policy file, not a framework.
- **Anonymous form hardening (E5-S1, beyond the backlog's honeypot):** rate limit + honeypot + **photo size cap, EXIF strip on upload, per-machine daily submission quota** — the no-login photo upload is a disk-fill/abuse vector otherwise.
- **UTC everywhere.** All timestamps stored UTC; factory timezone applied only at the edges — display, the Today/This-week buckets (E6-S2), and cron scheduling (02:00 backup, morning digest). Naive TZ handling corrupts exactly those two places silently.
- **First-run setup (E0-S7):** empty `users` table → all routes redirect to `/setup` (create admin, factory name, timezone). Timezone drives the scheduler and Today/This-week buckets (E6-S2).
- **Testing where the money is:** no UI test coverage in v0. Integration tests for the three invariants + role enforcement via direct API (E0-S4) — ~15 tests protecting everything that can silently corrupt.

---

## 2. Development plan — 6 weeks, epic order E0 → E6

**Standing rule: every week ends with a pass on a real phone.** Mobile-first claims die on first contact with a gloved thumb — don't discover that in week 6.

### Week 1 — Walking skeleton (E0 core + slice of E1/E3)
- Scaffold repo (git init), Drizzle schema for core tables, auth + sessions, users page with roles.
- **Deploy on day 2–3**, not at the end: Dockerfile + Caddy + Hetzner VPS + domain + HTTPS (E0-S1).
- Skeleton flow: add a machine → create a work order → Open → In progress → Done.
- Backup cron installed this week (retention starts accumulating immediately).
- **Exit criteria:** real URL shows a machine with a completed job; nightly snapshot exists.

### Week 2 — Machines complete (E1)
- Search/filter (E1-S2), machine page with history sections (E1-S3), Down/Running via downtime periods (E1-S4), QR labels + A4 print sheet (E1-S5), retire (E1-S6).
- Stub the anonymous QR target now ("coming soon" page) so pilot labels never need reprinting.

### Week 3 — Stock (E2) + queue pulled forward
- Parts catalog + search (E2-S1/S2), receive / issue / adjust movements (E2-S3/S4/S5), part page with full ledger (E2-S6), low-stock list + nav badge (E2-S7).
- **Work-order queue with overdue-first + filters (E3-S2) — pulled forward from week 4** (same list-rendering muscle as the parts list; de-loads the plan's riskiest week).
- **CSV paste-import for machines and parts** (~half a day, promoted from E8): ~200 machines and ~1,000 parts must exist before the pilot means anything — manual-form entry is days of factory labor; import makes onboarding an afternoon.
- Ledger invariant tests land this week.

### Week 4 — Work orders complete (E3, rebalanced)
- **E3-S6 (parts used on a job) is the only L story — budget two full days.**
- My Work mobile view (E3-S4), checklists (E3-S5), photos + time spent (E3-S7), reassign/reschedule (E3-S9), breakdown-closes-downtime prompt (E3-S8).
- This is the week most likely to slip; if it does, cut Should-stories (S8) immediately rather than compressing weeks 5–6.

### Week 5 — PM + public reporting (E4 + E5)
- PM schedules (E4-S1), generation cron + idempotency tests (E4-S2), floating next-due (E4-S3), overdue flags (E4-S4), schedule register (E4-S5).
- Public report form (E5-S1) **in English and Bulgarian** (`bg.json`, form strings only), hardened per §1.5: rate limit, honeypot, photo cap, EXIF strip, per-machine quota. Triage queue + badge (E5-S2), operator status view (E5-S3).
- Smaller than it looks — reuses week-4 machinery.

### Week 6 — Dashboard, digest, pilot onboarding (E6 + pilot prep)
- Dashboard with five clickable counts (E6-S1), Today/This-week buckets in factory TZ (E6-S2), daily digest email — silent on clean days (E6-S3).
- **One-time restore drill from a real snapshot** (E0-S6 requires it before pilot).
- Password reset (E0-S8) *or* admin-temp-password fallback — pick one, don't ship with neither.
- **Pilot onboarding checklist (explicit workstream, not an afterthought):**
  1. Import real machine + parts data via CSV (week-3 tool).
  2. Print and mount QR labels on every machine.
  3. 30-minute walkthrough with Maria (dashboard, triage, low-stock) and Tomasz (My Work, parts-on-job, Down/Running) on their own phones.
  4. Confirm the digest email arrives on Maria's phone.
- Slow pass on a real phone through every flow.

**Should-stories** (E0-S8, E1-S6, E3-S8, E4-S5, E5-S3, E6-S3) absorb into their epic's week or defer without breaking anything.

### Watch item (from backlog, E4 risk note)
The daily-digest habit is the v0 hedge for "nobody looks at the app". If the planner's login habit doesn't form in pilot week 1, per-event notifications (assignment alerts, Telegram) jump to the top of v0.1 (E7).

---

## 3. Decision log

| # | Decision | Status |
|---|---|---|
| D1 | Stack: Next.js + TypeScript (over Django) | **Default — confirm** |
| D2 | DB: SQLite + Drizzle (over Postgres) | **Default — confirm** |
| D3 | Host: Hetzner CX22 (~€4/mo) | **Default — confirm** |
| D4 | Mail relay: Brevo free tier | **Default — confirm** |
| D5 | Domain name for the app | **Open — BLOCKS week-1 deploy; decide this week** |
| D6 | Password reset path: email self-serve vs admin temp password | Open — decide by week 6 |
| D7 | Switch SQLite → Postgres | Only if multi-tenant SaaS (E8) becomes real |
| D8 | Auth: hand-rolled sessions table (Better Auth rejected — dependency churn) | **Decided 2026-07-22 (design review)** |
| D9 | Public report form ships bilingual EN+BG in v0; internal UI stays English-only | **Decided 2026-07-22 (design review)** |
| D10 | CSV paste-import for machines/parts promoted from E8 into v0 week 3 | **Decided 2026-07-22 (design review)** |

---

## 4. Current status

- **2026-07-22 (planning):** Plan written; internal design review (§5) folded in as v1.1. PRODUCT.md + DESIGN.md + SCREENS.md written; dashboard brief approved.
- **2026-07-22 (Week-1 walking skeleton — BUILT + verified):** D1–D4 confirmed ("go"). Stack live: Next.js 16 · React 19 · Tailwind v4 · Drizzle + `@libsql/client`. Full schema (15 tables, all three invariants). Auth: hand-rolled sessions, RBAC, first-run setup, login/logout, proxy (middleware) gate. UI: app shell (sidebar + mobile tabs, IBM Plex, light-mode theme), dashboard (Instrument Panel with green-flip + overdue-first queue), machines (list/new/detail + Down↔Running downtime ledger), work orders (queue/new/detail + Open→In progress→Done, activity log), parts stub. `next build` passes; **end-to-end flow verified in-browser** (setup → machine → downtime open/close → WO created → Done, all actor+timestamped). Deploy artifacts written: Dockerfile, docker-compose, Caddyfile, backup.sh, DEPLOY.md. **Not yet done:** git commit (awaiting user), actual VPS deploy (blocked on **D5 domain**), restore drill on real snapshot.
- **Next:** Week 2 (E1 — machine search/filter, QR labels, retire) per build order; or commit + pick a domain to deploy the skeleton.

---

## 5. Design review log (2026-07-22)

Four-perspective review (domain, adversarial, delivery, pilot-user). Architecture unchallenged — monolith, SQLite, and the three invariants held. Five amendments folded into v1.1:

1. Public report form ships in Bulgarian too (D9) — the no-login form serves the least English-speaking persona; ~20 strings on existing i18n plumbing.
2. CSV paste-import + explicit pilot-onboarding checklist (D10) — pilot data entry was unbudgeted factory labor.
3. Week 4 rebalanced — E3-S2 (queue) pulled into week 3 so the L-story week carries less.
4. Anonymous form hardening beyond honeypot — photo cap, EXIF strip, per-machine quota.
5. Plumbing made explicit — hand-rolled sessions (D8), cron via `instrumentation.ts` (safe because idempotent), UTC-everywhere, uploads via route handler; D5 flagged as deploy-blocking.

**Open risk the review could not resolve:** the whole schedule assumes solo-with-AI velocity of ~7 stories/week. If week 1 comes in slow, cut Should-stories immediately rather than compressing week 6. Adoption (the daily-digest habit, per the backlog's E4 note) remains the pilot's real failure mode — watch it from pilot day 1.
