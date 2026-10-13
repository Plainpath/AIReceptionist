# PlainPath platform

The platform API. Milestone 1 scope: tenants and per-component config, read
by the AI secretary voice worker in `../receptionist`.

See [documentation/platform-tenant-config.md](../documentation/platform-tenant-config.md)
for the API, environment, and how to move a tenant from YAML.

```bash
npm ci
cp .env.example .env            # fill in DATABASE_URL and both tokens
npx prisma migrate deploy
npm start                       # listens on HOST:PORT (default 127.0.0.1:8787)
npm run typecheck && npm test   # tests need DATABASE_URL to a disposable database
```
