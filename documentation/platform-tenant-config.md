# Platform Tenant Config

The AI secretary can read a tenant's `BusinessConfig` from the PlainPath
platform database instead of `config/businesses/<slug>.yaml`. This is the
first step towards an onboarding tool that configures tenants without anyone
hand-editing files on the server.

YAML stays fully supported. Nothing changes for a tenant until it is opted in.

---

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Platform API | `platform/` (TypeScript, Express, Prisma, Postgres) | Stores tenants and one config document per component, with a revision history and rollback. |
| Worker loader | `receptionist/tenant_config/source.py` | On each call, loads the tenant's config from the platform, then its last-good cache, then YAML. |
| Operator CLI | `python -m receptionist.tenant_config` | `import` a YAML into the platform, `diff` the two, `check` where a call would load from. |

### What is stored

The stored document is the tenant YAML parsed into JSON, **with `${ENV_VAR}`
placeholders left in place**. Secrets stay in the worker's `.env` and are
expanded at call time, exactly as they are for YAML. Files referenced by path
(for example Google Calendar credentials under `secrets/`) also stay on the
worker host.

`import` refuses a YAML that has a secret-looking value written inline
(`password`, `token`, `api_key`, `secret`, `authorization`, or any webhook
header value) unless it is a `${ENV_VAR}` placeholder. Move the value into
`.env` first. `--allow-inline-secrets` overrides this; avoid it.

### Load order on a call

For a tenant listed in `RECEPTIONIST_PLATFORM_TENANTS`:

1. **Platform API** (`GET /v1/tenants/<slug>/components/ai_secretary`, timeout
   `RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS`, default 2s). A response that
   validates is written to `config/platform-cache/<slug>.json` and used.
2. **Last-good cache**, if the platform is unreachable, errors, or serves a
   config that does not validate.
3. **YAML**, `config/businesses/<slug>.yaml`.

Each fallback logs a `tenant_config:` WARNING naming the tenant and the
reason. Validation failures log the error type only, never config values.
For tenants not listed, the worker reads YAML and never contacts the platform.
If the platform settings themselves are invalid the worker logs an ERROR and
reads YAML for everyone.

---

## Worker environment

| Variable | Default | Purpose |
|---|---|---|
| `RECEPTIONIST_PLATFORM_URL` | unset | Platform base URL. Must be `https://`, or `http://` to localhost only. |
| `RECEPTIONIST_PLATFORM_TOKEN` | unset | Platform **worker** token (read-only, `ai_secretary` only). |
| `RECEPTIONIST_PLATFORM_TENANTS` | unset | Comma-separated slugs to load from the platform, or `*` for all. Unset means YAML for everyone. |
| `RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS` | `2` | Per-call fetch timeout (0–30). |
| `RECEPTIONIST_PLATFORM_CACHE_DIR` | `config/platform-cache` | Last-good cache directory. |
| `RECEPTIONIST_PLATFORM_ADMIN_TOKEN` | unset | Only for the `import` / `diff` CLI. |

## Platform environment

See `platform/.env.example`: `DATABASE_URL`, `PLATFORM_ADMIN_TOKEN`,
`PLATFORM_WORKER_TOKEN` (32+ characters each, and different), `HOST`
(default `127.0.0.1`), `PORT` (default `8787`).

```bash
cd platform
npm ci
npx prisma migrate deploy
npm start
```

## Running the platform on the worker host

Until the platform gets its own host, it can run beside the voice worker on
the same Linux server, listening on `127.0.0.1` only. Nothing is exposed to
the internet, and the worker reaches it over loopback (plain `http` is
allowed to localhost only). If the platform or Postgres stops, calls keep
working from the last-good cache or YAML.

Expect roughly 300 MB of extra memory for Postgres and the platform process.
Check headroom with `free -m` first.

The paths below assume the checkout is `/opt/AIReceptionist`, owned by the
`receptionist` service user. Adjust to match the existing worker unit.

```bash
# 1. Postgres, local only (Ubuntu's default listens on localhost).
sudo apt-get install -y postgresql
sudo -u postgres createuser --pwprompt platform
sudo -u postgres createdb -O platform platform

# 2. Node 22 LTS (NodeSource or your distro's package), then dependencies.
cd /opt/AIReceptionist/platform
sudo -u receptionist npm ci --omit=dev --include=optional
sudo -u receptionist cp .env.example .env
sudo chmod 600 .env
# Edit .env: DATABASE_URL with the password above, and two different
# 32+ character tokens, e.g. from: openssl rand -hex 32
sudo -u receptionist npx prisma migrate deploy
```

`npm ci --omit=dev` skips the `prisma` CLI. Run plain `npm ci` instead if
`npx prisma migrate deploy` is not found.

`/etc/systemd/system/plainpath-platform.service`:

```ini
[Unit]
Description=PlainPath platform API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=receptionist
Group=receptionist
WorkingDirectory=/opt/AIReceptionist/platform
EnvironmentFile=/opt/AIReceptionist/platform/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plainpath-platform
curl -s http://127.0.0.1:8787/healthz     # {"ok":true}
```

Worker `.env` (the switch stays off until a tenant is listed):

```bash
RECEPTIONIST_PLATFORM_URL=http://127.0.0.1:8787
RECEPTIONIST_PLATFORM_TOKEN=<PLATFORM_WORKER_TOKEN>
RECEPTIONIST_PLATFORM_ADMIN_TOKEN=<PLATFORM_ADMIN_TOKEN>   # for import/diff only
# RECEPTIONIST_PLATFORM_TENANTS=                            # set in "Moving a tenant"
```

Nightly backup (`crontab -e` as the `postgres` user); keep a copy off the
server too:

```cron
15 3 * * * pg_dump -Fc platform > /var/backups/platform-$(date +\%a).dump
```

This keeps seven rolling daily dumps. Restore with
`pg_restore -d platform --clean <file>`.

Upgrading: `git pull`, `npm ci`, `npx prisma migrate deploy`, then
`systemctl restart plainpath-platform`.

## API

All routes except `/healthz` need `Authorization: Bearer <token>`.

| Method | Path | Token | Notes |
|---|---|---|---|
| GET | `/healthz` | none | |
| GET | `/v1/tenants` | admin | |
| GET / PUT | `/v1/tenants/:slug` | admin | PUT upserts `{name, status?, plan?}`. |
| GET | `/v1/tenants/:slug/components/:component` | admin, or worker for `ai_secretary` | `{tenant, component, version, config, updatedAt, updatedBy}` |
| PUT | `/v1/tenants/:slug/components/:component` | admin | `{config, expectedVersion?, note?}`. Identical config is a no-op. A stale `expectedVersion` gets 409. |
| GET | `.../revisions` | admin | Newest first. |
| POST | `.../rollback` | admin | `{toVersion}`; writes the old document as a new version. |

`X-Actor` (optional) is recorded on the revision. Slugs follow
`^[a-zA-Z0-9_-]+$`. Components: `ai_secretary`, `website`, `quotes`,
`web_chat`, `reviews` (only `ai_secretary` is used so far).

---

## Moving a tenant to the platform

Run on the worker host, where the tenant YAML and its env vars live.

```bash
# 1. Validate without uploading. Proves the stored form behaves identically.
python -m receptionist.tenant_config import <slug> --dry-run

# 2. Upload.
python -m receptionist.tenant_config import <slug> --actor "<your name>"

# 3. Confirm the platform copy matches the YAML (exit code 0 = identical).
python -m receptionist.tenant_config diff <slug>

# 4. Opt the tenant in: add <slug> to RECEPTIONIST_PLATFORM_TENANTS in .env,
#    restart the worker, then confirm and make a test call.
python -m receptionist.tenant_config check <slug>
```

To back out, remove the slug from `RECEPTIONIST_PLATFORM_TENANTS` and restart.
The YAML file is untouched by all of the above, so the tenant is exactly where
it started.

While a tenant is opted in, edit its config in the platform, not the YAML;
`diff` shows any drift between the two.
