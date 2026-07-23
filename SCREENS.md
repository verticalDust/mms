# MMS — Surface Briefs (all v0 screens)

*v1 · July 2026 · Companion to PLAN.md (build order), PRODUCT.md (truth), DESIGN.md (locked visual world). Shaped via `/impeccable shape`. Mode is **Operate** for every internal screen; the public report surfaces are Operate-at-zero-friction. No code here — briefs only.*

**How to read.** §1 defines the reusable conventions locked by the approved dashboard + DESIGN.md; every screen inherits them, so each brief below is only the *delta*. §2–§8 are the surfaces, grouped by family in build order. Fuller briefs for the two genuinely open surfaces (work-order detail §5.2, public report form §7.1) are marked ★.

---

## 1. Reusable conventions (inherited by every screen)

These are settled — from DESIGN.md and the approved dashboard brief. Do not re-decide them per screen.

- **Two shells.** Mobile = bottom tab bar (My Work · Machines · Parts · More) + primary action pinned full-width ≥56px in the thumb zone. Desktop = left sidebar (Dashboard, Work orders, Machines, Parts, Reports, PM schedules, Users, Settings) + `max-w-7xl` content column. Same routes/components, responsive.
- **StatusChip** (one component, everywhere): color + Lucide icon + word, never color alone. Down/overdue/Critical = red; low-stock/due-soon/caution = amber; Running/Done/OK = green; Open/Scheduled/pending = slate. Untriaged stays honestly slate (severity unknown until assessed).
- **EntityList pattern** (all list screens): a `SearchFilterBar` (debounced search + filter chips, state survives refresh via URL params) over dense ~40px rows on desktop / single-column cards on mobile. Every row = 3px status rail + StatusChip + mono code + Condensed name + right-aligned mono tabular figure + whole-row tap-through. Sub-1s search at documented scale.
- **Nameplate header** (all detail screens): mono code + Condensed name + hairline rule + a small metadata row (location/status). The equipment-plate motif.
- **Numbers**: IBM Plex Mono, `tabular-nums`, right-aligned in columns. Codes/SKUs also mono.
- **Green-flip** (locked from dashboard): any zero/all-clear state renders as a green "● Clear / All running / Stock OK" chip with a plain word — never a dead `0` or a blank panel. Empty states get an icon + one plain sentence + the action that fixes it.
- **Forms**: one Zod schema, client feedback + server enforcement; errors inline with `role="alert"`; async buttons disable + spinner; one safety-orange primary action per screen, everything else slate outline/ghost.
- **Permissions**: every mutation gated server-side by `can(user, action, resource)`; technician-forbidden controls are never rendered *and* 403 on direct call.
- **Motion**: 150–200ms color/opacity only; the single sanctioned "orchestrated moment" is the Down→Running fade. Respect `prefers-reduced-motion`.

---

## 2. Auth & system family

### 2.1 Login — `E0-S2`
- **Job:** get the team in; keep factory data private. First screen a returning user meets.
- **Structure:** centered card on the slate-50 field, nameplate-style wordmark ("MMS"), email + password, one orange "Sign in", a quiet "Forgot password?" link. No marketing, no illustration.
- **States:** wrong credentials → one neutral inline error (never reveal whether the email exists); after 5 failures → throttled message; already-authed → redirect to dashboard.
- **Mobile/interaction:** single column, 16px inputs (no iOS zoom), password field with show/hide; Enter submits; autofocus email.
- **Open:** none.

### 2.2 First-run setup wizard — `E0-S7`
- **Job:** turn an empty database into a usable system in five minutes, no developer.
- **Structure:** 2–3 short steps on one page — (1) create Admin (name, email, password), (2) factory name + timezone (searchable TZ select, defaulted from browser), (3) done → sign in. Condensed step labels, a hairline progress rule, one orange "Continue" per step.
- **States:** only reachable when `users` is empty (all routes redirect here until done); validation inline; timezone is required (it drives every bucket + cron).
- **Open:** whether to seed demo data at the end (offer a checkbox "add sample machines/parts to explore" — removable later).

### 2.3 Password reset — request + set-new — `E0-S8`
- **Job:** self-serve recovery without pulling the planner off the floor.
- **Structure:** two minimal screens — request (email → orange "Send reset link", neutral confirm that never reveals existence) and set-new (open from emailed link → new password + confirm, policy hint, orange "Set password").
- **States:** expired/used link → friendly "this link's expired, request a new one"; success → straight to login; **fallback** if email isn't wired, this route is hidden and admins reset via temp password (D6 decides which path ships — don't ship neither).
- **Open:** D6 (email self-serve vs admin temp password).

### 2.4 Users list + user form — `E0-S3`
- **Job (Admin only):** access matches jobs; leavers lose access.
- **Structure:** EntityList of users (name, email, role chip, active/inactive chip); row → edit drawer. Form = name, email, role (Admin/Technician), active toggle, "send temp password".
- **States:** deactivated user keeps their name on historical records; **self-lockout guard** — the only active Admin cannot deactivate/demote themselves (control disabled with reason + 403). Empty state never occurs (you're always at least one user).
- **Open:** none.

### 2.5 Settings — `E0-S7 tail`
- **Job (Admin):** the handful of factory-wide values. Factory name, timezone, (later) language, email config status.
- **Structure:** a plain labeled form, sections by hairline rule; timezone change warns it re-computes all buckets. Deliberately sparse — resist growing it.
- **Open:** whether email/relay config lives here or in env only (lean default: env, with a read-only "email: configured/not configured" indicator here).

---

## 3. List family (the workhorse — all inherit §1 EntityList)

Each is the shared list pattern with a specific row shape, filters, and empty state. Briefs are deltas only.

- **3.1 Machines list — `E1-S2`.** Filters: status (Running/Down/Retired-included), location. Row figure: current status + (if down) live downtime readout. Empty: "No machines yet." + Add machine (Admin). Scale: 200+, sub-1s.
- **3.2 Parts list — `E2-S2`.** Filters: low-stock toggle. Row: on-hand / min (mono), bin, StatusChip (Low/Out/OK green-flip). Scale: 1,000+, sub-1s. Row figure right-aligned on-hand.
- **3.3 Work-order queue — `E3-S2`** (pulled to week 3). Status tabs (Open / In progress / Done / Cancelled) with counts; filters: assignee, machine, priority. **Default sort overdue-first** (most-overdue top, red), then due date. Row: priority chip + machine nameplate + title + right-aligned mono due/overdue. Filter state survives refresh. This is where the dashboard's "fault-log" days-overdue column pattern reappears.
- **3.4 Low-stock list — `E2-S7`.** A pre-filtered parts list: on-hand, min, **shortfall (min−on-hand)**, bin. Nav badge shows count; leaving the list when restocked drops the badge. Green-flip when empty ("Nothing to reorder").
- **3.5 My Work — `E3-S4`.** Technician's own open+in-progress jobs, soonest-due-first (overdue flagged), one-tap Start/Done reachable without scrolling. Empty: "No jobs assigned." (plain, not a void). Mobile-primary surface.
- **3.6 PM schedule list / register — `E4-S5`.** All schedules: machine, interval, next due, state (Active/Paused). Sort by next due; paused marked; a "machines with no PM" discovery filter lives on the machines list. Overdue PM jobs flagged red.
- **3.7 Triage queue — `E5-S2`.** New reports awaiting a decision: machine, description snippet, reporter (if given), photo thumb, age. Row actions → "Create work order" (prefilled) or "Dismiss" (reason required). **Untriaged badge** in nav until zero. Green-flip when clear.

---

## 4. Detail family (inherit §1 nameplate header + history sections)

- **4.1 Machine detail — `E1-S3` (+ `E2-S8/S9`).** Nameplate header (code, name, location, StatusChip) + **QR-as-motif** block (code + QR, asset-tag styling). Sections: Down/Running toggle (opens/closes the single downtime period, with live timer when down); open work orders; upcoming/overdue PMs; completed jobs newest-first with parts each consumed; a **Parts** section (`E2-S8/S9`, new v0 scope — PLAN §6) — the spares this machine uses: each row = mono SKU + name + on-hand/min with a Low/OK chip + bin + optional qty/note, whole-row tap-through to the part; **Admin** gets *Add part* (dialog: parts-catalog search by SKU/name + optional qty/note → Attach; duplicate rejected) and *Remove* (confirm; unlinks only — part + stock history untouched); a retired machine keeps the list read-only. Every empty section states it plainly (E1-S3). Retire action (Admin) → leaves default lists, history stays, PMs pause, new WOs refused. **Print label** action → §8.
- **4.2 Part detail (movement ledger) — `E2-S6`.** Nameplate header (SKU, name, bin, photo, on-hand vs min StatusChip). The hero is the **movement ledger**: every receive/issue/adjust/reverse, newest-first, with type, mono qty, actor, timestamp, and a link to the work order where applicable — and the running figures **sum exactly to on-hand** (invariant made visible via the aligned mono column). Plus a **Fits machines** section (`E2-S10`, PLAN §6) — the machines that use this part, each tapping through to the machine page. Actions (Admin): Receive / Issue / Adjust → §6 dialogs.

---

## 5. Work orders

### 5.1 Work-order create/edit form — `E3-S1`
- Fields: title + machine (required), priority (Low/Med/High/Critical, default Med), assignee, due date, description, photos. Retired machine → creation refused with explanation. Appears as Open in queue, on machine page, in assignee's My Work. Standard §1 form conventions.

### 5.2 ★ Work-order detail — `E3-S3/S5/S6/S7/S8/S9` (the front-end's center of gravity)
- **Job & audience:** the technician's core working screen (mobile-primary, gloved), and where a planner reassigns/reschedules (desktop). Every E3 story converges here; build it as sections on one route, incrementally across week 4.
- **Mode:** Operate — the job gets done here, and stock stays honest as a side effect.
- **Structure (top-to-bottom):**
  1. **Nameplate header:** mono WO id + Condensed title + machine nameplate + StatusChip (Open/In progress/Done/Cancelled) + priority chip + PM-generated / overdue badges.
  2. **Lifecycle action** (pinned primary): Start → Done for the assignee. Each transition stored with actor+timestamp. Done is final for technicians (only Admin reopens, logged).
  3. **Checklist** (`E3-S5`): ordered steps, each tick saves immediately (survives refresh) with actor+time. Finishing with unticked steps → warn (name them) + confirm-or-go-back — **warn, never block** (floor reality wins).
  4. **Parts used** (`E3-S6`, the L-story, the honest-loop): search part by name/SKU → add qty → **on-hand decrements in the same transaction**, ledger gains an Issue linked to this job+machine. Insufficient stock → refuse, showing on-hand + bin ("recorded stock is 1 — bin B-3"). Remove a line (pre-Done) → **reversing entry restores on-hand, both entries stay visible** (nothing silently erased). When costs exist, show job parts cost.
  5. **Photos + time spent** (`E3-S7`): camera/gallery, client-compressed, ≤10MB each, ≤10/job, thumbnails → full-screen, each stamped with uploader+time. Optional minutes field feeds machine labor totals.
  6. **Breakdown → downtime close** (`E3-S8`): on Done for a breakdown job with an open downtime period, prompt "is the machine running again?" — confirm closes **that same period** and links the job; decline leaves it Down. The stopped-time figure always reads from the period only (invariant #2), so job view and machine view can never disagree.
  7. **Activity/history:** status changes, reassignments (old→new), all logged.
- **States & ranges:** Open / In progress / Done / Cancelled (cancel needs reason, leaves active views, stays in history); PM-generated; overdue (red, days-overdue). Parts lines 0–many; checklist 0–~12 steps; photos 0–10.
- **Reassign/reschedule** (`E3-S9`, planner-only): change assignee (moves between My Work lists, logged old→new) and due date (re-sorts queue/buckets, logged); **technician attempt → 403**, all history stays on the job.
- **Mobile:** the busiest screen — sections stack, primary lifecycle action pinned in thumb zone; parts-search and photo-capture are the two heaviest interactions and get full-width touch treatment. No horizontal scroll; parts/checklist rows reflow to cards.
- **Open decisions:** (a) sections as tabs vs one long scroll on mobile — lean single-scroll with sticky section headers (fewer taps, matches the queue's sticky pattern); (b) whether "parts used" is editable after Done by Admin (lean: yes, via reversing entries, logged); (c) confirm the parts-search control matches the queue's search affordance for consistency.

---

## 6. Stock movement dialogs — `E2-S3/S4/S5`

One shared dialog shell, three modes, launched from part detail / low-stock:
- **Receive:** qty (>0) + optional cost + note → on-hand up, Receive entry logged. Zero/negative refused.
- **Issue (no job):** qty + reason → on-hand down, Issue entry logged. Cannot go negative (refuse, show on-hand: "recorded stock is 1 — adjust the count if the shelf disagrees").
- **Adjust (Admin):** counted qty + **required reason** → sets on-hand, logs "8 → 6" with reason. No reason → refused.
- All: mono qty inputs, actor+timestamp automatic, optimistic close only after server confirm.

---

## 7. Public report surfaces (no login, bilingual EN/BG)

### 7.1 ★ Public report form — `E5-S1`
- **Job & audience:** Ivan, an operator with no account, on any random phone, at the machine, under time pressure — report a fault in ~15 seconds. This is the single highest-leverage adoption surface, and the only Cyrillic surface in v0.
- **Mode:** Operate at zero friction — the whole screen is one task; strip everything else.
- **Structure:** (1) **Machine identity header** from the scanned QR — mono code + Condensed name — so Ivan sees he scanned the right machine (trust). (2) **Language toggle** EN/BG, prominent, top-right (BG uses IBM Plex Sans regular per DESIGN.md). (3) Description (required, big textarea, placeholder is a real example). (4) Optional name. (5) Optional photo (camera-first). (6) One big full-width submit. Nothing else — no nav, no internal data, no login prompt.
- **States:** success → confirmation (§7.2); **abuse resistance is invisible to Ivan** — honeypot field + rate limit silently refuse floods/bots; dead/retired-machine or mangled URL → friendly page (§7.4). Never expose any internal data on any state.
- **Mobile:** this *is* mobile; ≥56px submit, 16px inputs, works one-handed. Bilingual strings externalized (`bg.json`, form scope only).
- **Open:** (a) default language — lean: remember last choice per device, default EN, one-tap BG; (b) whether photo is above or below description (lean: below, so the required field is first).

### 7.2 Report confirmation — `E5-S1`
- One calm screen: "Reported — the maintenance team can see it now" (EN/BG), the machine name, and a quiet "report another" link. No account nudge. This closes the loop that keeps operators reporting.

### 7.3 Report status view — `E5-S3`
- Re-scanning the same machine shows the operator's recent report's **coarse status only**: received / being worked / fixed. No names, no internal notes, no other data. Green-flip "fixed" state is the reward.

### 7.4 Dead-link / retired-machine page — `E5-S1`
- Friendly, no-blame: "This code isn't active — please tell a supervisor." No internal data, no stack trace. Same for mangled URLs.

---

## 8. QR label print sheet — `E1-S5`

- **Job (Admin):** print labels — singly or as an A4 batch — so any scan reaches the right place.
- **Structure:** a print-CSS layout (not a PDF pipeline). Select N machines → "Print labels" → A4 grid, each label = **QR + mono machine code + Condensed name**, asset-tag styling consistent with the machine-page QR motif. Screen preview mirrors print.
- **Behavior:** the QR encodes `/m/{code}` — one URL; auth decides staff-page vs public-report-form at scan time. Print margins/bleed tuned for cheap label stock.
- **Open:** label size/columns per A4 (lean default: a common Avery grid; confirm at build).

---

## Cross-reference & open decisions rollup

- **Build order** (from PLAN.md): §2 auth (wk1) → §3.1/4.1/8 machines (wk2) → §3.2/4.2/6 parts + §3.3 queue + machine-parts fitment (E2-S8/S9, §4.1 Parts section) (wk3) → §5 work orders incl. ★5.2 + machine-parts job tie-in (E2-S10, §4.2 Fits machines) (wk4) → §3.6 PM + §7 public + §3.7 triage (wk5) → dashboard + Today/week + digest (wk6).
- **Consolidated open decisions** for the build: D6 password path (§2.3); demo-seed on setup (§2.2); email config location (§2.5); WO-detail mobile tabs-vs-scroll + post-Done part edits (§5.2); public-form default language + photo order (§7.1); A4 label grid (§8). None block starting the walking skeleton.
- **Locked:** planner dashboard brief (approved) and all §1 conventions.
