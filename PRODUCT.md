# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two logged-in roles plus one anonymous role, drawn from the v0 backlog personas:

- **Maria — planner (Admin login).** Runs the maintenance plan from an office desktop and a phone on the floor. Triages breakdowns, owns stock levels and PM schedules, manages users. Starts her day wanting facts, not a walk-around.
- **Tomasz — technician (Technician login).** Fixes machines with a phone in hand, often gloved, in poor light. Hates typing. Needs to see his next job, work it, record parts used, and mark machines Down/Running with minimal taps.
- **Ivan — operator (no account).** Runs a machine; reports it when it breaks. Will not log in and cannot leave the line for long — reports a fault in seconds by scanning the machine's QR code.
- **The owner (Admin login).** Pays for it. Wants downtime and chaos to drop; wants setup and recovery to need no developer.

## Product Purpose

MMS replaces the paper logs and human memory a factory relies on today to keep its machines running. It holds three things in one place — a register of every machine, a live count of spare-parts stock, and a queue of maintenance jobs — and **wires them together** so work and parts stay honest with each other. Success means less unplanned downtime, no silent stockouts, routine maintenance that actually happens, and a planner who can run the day from one screen instead of tribal knowledge.

## Positioning

The differentiator is not any single feature but the **self-reconciling loop between the three registers**, delivered deliberately lean:

- Logging parts used on a repair decrements stock automatically; a part hitting its minimum lands on a reorder list before the shelf runs empty — no separate inventory paperwork.
- Recurring preventive-maintenance schedules raise their own work orders, so routine care never depends on someone remembering.
- Operators report breakdowns by QR scan with **no login**, lowering the reporting barrier to near zero.
- It runs on **one small server for a few euros a month** and works on a floor phone and an office desktop alike.

This is positioned against heavy, expensive enterprise CMMS platforms: MMS wins by being cheap, mobile-first, and immediately usable, not by feature breadth.

**Open decision (confirmed undecided with the user):** commercial trajectory. It is genuinely unresolved whether MMS stays an internal tool for one factory or grows into a sellable multi-tenant SaaS (the source research is framed as "SaaS" and E8 lists multi-tenant packaging). v0 is single-tenant either way; future work must not assume one trajectory over the other without a decision.

## Operating Context

- **On the floor:** a phone used one-handed, sometimes gloved, in bright or dim light, under time pressure. QR labels on machines are the entry point to both the staff machine page and the public report form.
- **In the office:** a desktop where the planner works the queue, triages reports, sets stock levels and PM schedules, and reads the dashboard.
- **Core workflows:** report-a-breakdown (QR, no login) → triage → work order; planned and preventive work orders Open → In progress → Done, consuming parts as they go; stock receive/issue/adjust as an append-only ledger; machine Down/Running as timed downtime periods; a daily digest email hedging the "does anyone open the app" adoption risk.
- **Rituals:** a daily standup around the Today/This-week view; a weekly reorder from the low-stock list; a morning glance at the dashboard or digest.

**Pilot:** a real pilot factory exists but its identity, industry, and exact scale are **TBD** (confirmed with the user). Terminology and operating specifics should be refined once the pilot is characterized; until then, work to the spec's generic profile (~200 machines, ~1,000 parts, a handful of users) and do not invent the pilot's details.

## Capabilities and Constraints

**Capabilities (v0 scope, by epic):** secure multi-user foundation with two enforced roles; machine register with status, history, QR labels, and retirement; spare-parts catalog with an append-only movement ledger and a low-stock reorder list; a unified work-order queue (breakdowns + planned) that consumes parts; self-generating preventive-maintenance schedules; a no-login public report form with a triage queue; a planner dashboard and daily views plus a daily digest email.

**Durable constraints:**
- Single small VPS; low running cost is a product requirement, not just an implementation detail.
- Permissions enforced server-side; every significant action carries actor + timestamp; state is server-persisted and survives refresh.
- Three data invariants are load-bearing product truths: stock is an append-only ledger (corrections via reversing entries, never deletes); downtime lives only in timed downtime periods (never a second copy); PM work-order generation is idempotent.
- English UI in v0, fully externalized strings; the **public report form also ships in Bulgarian** in v0 (the least English-fluent persona uses it); broader localization is later.
- Explicitly **out of v0:** offline mode/sync, native app, purchasing/PO loop, analytics (MTBF/MTTR), and multi-tenant SaaS packaging — deferred to later phases.

**Terminology:** machine, part (SKU), work order, PM schedule, downtime period, stock movement (receive/issue/adjust/reverse), report, triage.

**Open product decisions:** commercial trajectory (see Positioning); pilot factory characterization (see Operating Context); password-reset path (self-serve email vs admin temporary password); production domain name.

## Brand Commitments

- **Name:** MMS — Maintenance Management System (confirmed as the working product name).
- **Voice:** plain, direct, low-jargon, non-corporate. Copy respects a floor worker's time; sentence case; say what a control does. No marketing gloss inside the product.
- No logo, wordmark, or other brand assets exist yet; none are binding. Future work may propose them but must not assume them.

## Evidence on Hand

- The v0 backlog ("Backlog — Epics & User Stories (v0)") with 41 stories and Gherkin acceptance criteria, supplied by the user — the authoritative product spec for v0.
- The referenced full spec, "Machine Maintenance SaaS — Market & Feature Research, Part II" (source for E7/E8 and the SaaS framing) — not in-repo; treat as background, not a v0 contract.
- In-repo: [PLAN.md](PLAN.md) (architecture + build plan) and [DESIGN.md](DESIGN.md) (visual direction).
- **Absences future work must not fabricate:** no real customers, testimonials, case studies, pricing, benchmarks, or the pilot factory's identity currently exist. Do not invent them.

## Product Principles

1. **One honest source of truth.** Stock, downtime, and each PM cadence live in exactly one place; the system reconciles work and parts automatically rather than trusting anyone to keep two numbers in sync.
2. **The floor must not have to type.** No-login QR reporting, one-tap job and status actions, and a gloved-thumb mobile experience keep the barrier to correct data near zero.
3. **Routine care happens because the system remembers.** Preventive work generates itself; the daily digest hedges the habit; nothing critical waits on a person recalling it.
4. **Lean is the product, not a compromise.** Runs on one small server; every feature earns its keep; enterprise weight is deferred, not aspired to.
5. **Adoption is the real risk.** Closing the loop — the operator sees their report mattered, the planner is nudged when something is overdue — is treated as core, not polish.

## Accessibility & Inclusion

- Usable one-handed and gloved: large touch targets, primary action in thumb reach.
- Legible in bright and dim factory light: high contrast is a hard requirement.
- Status is never conveyed by color alone (protects color-blind users and defeats screen glare).
- The non-English-speaking operator is served by a bilingual (English + Bulgarian) public report form in v0.
