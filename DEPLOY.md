# MMS — Deploy & Restore Runbook

*Companion to PLAN.md §1.2. Target: one small VPS (Hetzner CX22), Docker + Caddy, a few €/month.*

## Prerequisites (one-time on the VPS)

- A domain (decision **D5**) with an A/AAAA record pointing at the VPS IP.
- Docker + Docker Compose plugin installed.
- `sqlite3` installed on the host (for backups): `apt-get install -y sqlite3`.

## First deploy (E0-S1)

```bash
git clone <repo> /opt/mms && cd /opt/mms
echo "DOMAIN=mms.example.com" > .env      # the real domain (D5)
docker compose up -d --build
```

Caddy fetches a TLS cert automatically; the app is live over HTTPS within a
minute. Migrations apply on container start (idempotent), so the database is
created on first boot. Open the URL → the first-run setup wizard (E0-S7).

Updates: `git pull && docker compose up -d --build`.

## Nightly backup (E0-S6)

```bash
install -m 755 scripts/backup.sh /usr/local/bin/mms-backup
crontab -e
# 02:30 daily — matches the "past 02:00" acceptance criterion
30 2 * * * DB=/opt/mms/data/mms.db DEST=/opt/mms/backups /usr/local/bin/mms-backup
```

Keeps 14 dated snapshots in `/opt/mms/backups`. (Optional hardening: `rclone`
the backups folder to off-box object storage.)

## Restore (verify once before pilot — the DoD requires it)

The database is a single file. To restore a snapshot:

```bash
cd /opt/mms
docker compose stop app
cp data/mms.db data/mms.db.broken            # keep the bad copy, just in case
cp backups/mms-YYYY-MM-DD.db data/mms.db     # the snapshot to restore
rm -f data/mms.db-wal data/mms.db-shm        # drop stale WAL side-files
docker compose start app
```

The app comes back with all data as of that snapshot. **Run this drill once on
a real snapshot before the pilot starts** and record that it worked.

## Notes

- Uploaded photos live in `./uploads` (mounted to `/app/public/uploads`) and are
  backed up by copying that folder alongside the DB.
- Mail (Brevo) is optional in early pilot; the app degrades gracefully without
  it. Fill the `SMTP_*` vars in `docker-compose.yml` when ready.
