// Seed a few example PM schedules (and their due work orders) into the remote
// Turso demo, WITHOUT touching the rest of the data. Idempotent: skips a schedule
// that already exists (same machine + title), and skips generating a job when the
// schedule already has an open one — mirroring lib/pm.ts's invariant-#3 guard.
//
//   node --env-file=.env.turso.local scripts/seed-pm-turso.mjs

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
const authToken =
  process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
if (!url || url.startsWith("file:")) {
  console.error("Set TURSO_DATABASE_URL/DATABASE_URL (+ token) to the remote DB.");
  process.exit(1);
}
const c = createClient({ url, authToken });

// The demo's frozen "now" is 2026-07-24; keep new dates relative to it.
const ms = (y, m, d) => new Date(y, m, d).getTime();
const NOW = ms(2026, 6, 24);
const HORIZON = NOW + 7 * 24 * 3600 * 1000;

const SCHEDULES = [
  {
    code: "M-001",
    title: "Hydraulic system inspection",
    interval: 30,
    due: ms(2026, 6, 28), // due soon → generates a job
    assignee: "tomasz@northgate.example",
    steps: [
      "Check hydraulic fluid level",
      "Inspect hoses and seals for leaks",
      "Test the pressure-relief valve",
    ],
  },
  {
    code: "M-003",
    title: "Spindle lubrication",
    interval: 14,
    due: ms(2026, 6, 23), // overdue → generates an overdue job
    assignee: "tomasz@northgate.example",
    steps: [
      "Grease the spindle bearings",
      "Top up the way-oil reservoir",
      "Wipe down the slideways",
    ],
  },
  {
    code: "M-004",
    title: "Quarterly safety audit",
    interval: 90,
    due: ms(2026, 7, 20), // future → schedule only, no job yet
    assignee: "maria@northgate.example",
    steps: [
      "Test all e-stops",
      "Inspect the light curtains",
      "Verify guard interlocks",
      "Check emergency lighting",
    ],
  },
];

async function one(sql, args) {
  const r = await c.execute({ sql, args });
  return r.rows[0];
}

async function main() {
  const planner = await one("select id from users where role='admin' order by id limit 1", []);
  const createdBy = planner ? planner.id : null;

  let added = 0;
  let generated = 0;
  for (const s of SCHEDULES) {
    const m = await one("select id from machines where code=?", [s.code]);
    if (!m) {
      console.log(`skip: machine ${s.code} not found`);
      continue;
    }
    const u = await one("select id from users where email=?", [s.assignee]);
    const assigneeId = u ? u.id : null;

    let sched = await one(
      "select id from pm_schedules where machine_id=? and title=?",
      [m.id, s.title],
    );
    if (sched) {
      console.log(`schedule exists: ${s.code} — ${s.title}`);
    } else {
      sched = await one(
        "insert into pm_schedules (machine_id, title, interval_days, next_due_date, default_assignee_id, checklist_template, paused, created_by, created_at, updated_at) values (?,?,?,?,?,?,0,?,?,?) returning id",
        [m.id, s.title, s.interval, s.due, assigneeId, JSON.stringify(s.steps), createdBy, NOW, NOW],
      );
      added++;
      console.log(`added: ${s.code} — ${s.title} (next due ${new Date(s.due).toDateString()})`);
    }

    // Generate the PM job if due within the horizon and none is open yet.
    if (s.due <= HORIZON) {
      const openJob = await one(
        "select id from work_orders where pm_schedule_id=? and status in ('open','in_progress')",
        [sched.id],
      );
      if (!openJob) {
        const wo = await one(
          "insert into work_orders (title, machine_id, priority, status, assignee_id, due_date, source, pm_schedule_id, created_by, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?) returning id",
          [s.title, m.id, "medium", "open", assigneeId, s.due, "pm", sched.id, createdBy, NOW, NOW],
        );
        await c.execute({
          sql: "insert into wo_status_history (work_order_id, from_status, to_status, note, actor_id, created_at) values (?,?,?,?,?,?)",
          args: [wo.id, null, "open", "PM-generated", createdBy, NOW],
        });
        let pos = 1;
        for (const step of s.steps) {
          await c.execute({
            sql: "insert into checklist_items (work_order_id, position, text, checked, created_at) values (?,?,?,0,?)",
            args: [wo.id, pos++, step, NOW],
          });
        }
        generated++;
        console.log(`  generated PM job WO-${wo.id} (due ${new Date(s.due).toDateString()})`);
      }
    }
  }
  console.log(`\nDone. ${added} schedule(s) added, ${generated} PM job(s) generated.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
