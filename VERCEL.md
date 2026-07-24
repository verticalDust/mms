# Deploying MMS to Vercel (demo)

MMS was built for a single VPS (SQLite file + local `./uploads`). Vercel is
serverless — the filesystem is read-only — so two things move to managed
services, both on free tiers:

| Concern | Local / VPS | Vercel demo |
| --- | --- | --- |
| Database | SQLite file (`file:./data/mms.db`) | **Turso** (hosted libSQL) |
| Photo uploads | `./uploads` on disk | **Vercel Blob** |

The code already supports both — it switches on env vars (`DATABASE_AUTH_TOKEN`
selects Turso; `BLOB_READ_WRITE_TOKEN` selects Blob). Nothing to change in code.

You need a **Turso** account and a **Vercel** account (both free). The repo is
already on GitHub, so Vercel deploys straight from it.

> **Using Vercel's Turso integration?** (Vercel → Storage → Create → Turso.)
> It provisions the DB and sets `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` on the
> project automatically — the app reads those, so you can **skip §1 and the
> env-var half of §4**. You still need to load the schema + data (§2, using
> those values) and add a Blob store (§3). Grab the URL/token from the store's
> **`.env.local`** tab, or run `vercel env pull .env.development.local`.

---

## 1. Create the Turso database

```bash
# install the CLI (macOS/Linux); on Windows use: irm get.tur.so/install.ps1 | iex
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup          # or: turso auth login

turso db create mms
turso db show mms --url        # -> DATABASE_URL   (libsql://mms-<org>.turso.io)
turso db tokens create mms     # -> DATABASE_AUTH_TOKEN
```

Keep the URL and token — you'll paste them into Vercel (step 4) and use them now
to load the schema + demo data.

## 2. Load the schema and demo data into Turso

From the project root, point at the Turso DB and run the migration + seed.

**If you used Vercel's Turso integration** (env vars already on the project):

```bash
vercel env pull .env.development.local   # pulls TURSO_DATABASE_URL / _AUTH_TOKEN
node --env-file=.env.development.local scripts/migrate-turso.mjs   # creates tables
node --env-file=.env.development.local scripts/seed-turso.mjs      # loads demo data
```

**If you created the DB with the Turso CLI** (set the values explicitly):

```bash
# PowerShell
$env:DATABASE_URL="libsql://mms-<org>.turso.io"
$env:DATABASE_AUTH_TOKEN="<token>"
node scripts/migrate-turso.mjs           # creates the 15 tables on Turso
node scripts/seed-turso.mjs              # copies the local demo data
```

The seed copies machines, parts, work orders, checklists and downtime from the
local dev DB, **skips** photos (their image blobs don't exist on Turso) and
transient session rows, and resets every login to one demo password. It prints
the logins when it finishes. Re-running it resets the demo to seed state.

> Prefer not to install the Turso CLI? Create the DB from the Vercel dashboard
> (Storage → Create → Turso) — it provisions the DB and sets the env vars for
> you — then run step 2 locally with those same values.

## 3. Create the Vercel Blob store (for photos)

In your Vercel project → **Storage → Create → Blob**. This adds
`BLOB_READ_WRITE_TOKEN` to the project automatically. Without it, photo uploads
return a 500 on Vercel (read-only FS); with it, they go to Blob.

## 4. Import the repo on Vercel + set env vars

1. vercel.com/new → import this GitHub repo (framework auto-detects as Next.js).
2. Project → **Settings → Environment Variables**, add (Production + Preview):
   - `DATABASE_URL` = `libsql://mms-<org>.turso.io` — **skip if you used the
     Turso integration**, which already set `TURSO_DATABASE_URL` (the app reads
     either name).
   - `DATABASE_AUTH_TOKEN` = `<token>` — likewise, the integration sets
     `TURSO_AUTH_TOKEN`.
   - `BLOB_READ_WRITE_TOKEN` — added by step 3; confirm it's present.
   - `APP_URL` = `https://<your-app>.vercel.app` *(optional — used for absolute
     QR links; the app otherwise derives it from request headers.)*
3. Deploy. Every push to the default branch redeploys.

No build-time DB step is needed — migrations were run once in step 2.

## 5. Demo logins

Seeded users (both share the demo password printed by the seed script,
default `demo-mms-2026`):

| Email | Role |
| --- | --- |
| `maria@northgate.example` | admin (planner) |
| `tomasz@northgate.example` | technician |

Anyone with the URL can log in — it's a public demo. Don't put real data in it.

---

## Notes & limits

- **Reset the demo:** re-run `node scripts/seed-turso.mjs` (clears + reloads).
- **Photos** now stream through the same auth-gated routes, backed by Blob.
  Pre-existing test photos aren't migrated — upload fresh ones in the demo.
- **Concurrency:** the local SQLite `BEGIN IMMEDIATE` busy-timeout is a no-op on
  Turso (the server serialises writes); the invariant-#1 transactions stay
  atomic.
- **Local dev is unchanged** — with no `DATABASE_AUTH_TOKEN` / `BLOB_*` token it
  still uses the SQLite file and `./uploads`.
