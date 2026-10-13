import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";

import { requireRole, type AuthTokens } from "./auth.js";
import { ConfigStore, NotFoundError, VersionConflictError } from "./configStore.js";
import {
  actorSchema,
  componentSchema,
  putConfigSchema,
  rollbackSchema,
  slugSchema,
  upsertTenantSchema,
} from "./schemas.js";

export interface AppDeps {
  store: ConfigStore;
  tokens: AuthTokens;
}

type Handler = (req: Request, res: Response) => Promise<void>;

const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

function actorFor(req: Request, res: Response): string {
  const role = res.locals.role as string;
  const header = req.header("x-actor");
  if (header === undefined) return role;
  return `${role}:${actorSchema.parse(header)}`;
}

export function createApp({ store, tokens }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  const admin = requireRole(tokens, ["admin"]);
  const reader = requireRole(tokens, ["admin", "worker"]);

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(
    "/v1/tenants",
    admin,
    wrap(async (_req, res) => {
      const tenants = await store.listTenants();
      res.json({ tenants });
    }),
  );

  app.get(
    "/v1/tenants/:slug",
    admin,
    wrap(async (req, res) => {
      const tenant = await store.getTenant(slugSchema.parse(req.params.slug));
      res.json({ tenant });
    }),
  );

  app.put(
    "/v1/tenants/:slug",
    admin,
    wrap(async (req, res) => {
      const slug = slugSchema.parse(req.params.slug);
      const body = upsertTenantSchema.parse(req.body);
      const tenant = await store.upsertTenant(slug, body);
      res.json({ tenant });
    }),
  );

  app.get(
    "/v1/tenants/:slug/components/:component",
    reader,
    wrap(async (req, res) => {
      const slug = slugSchema.parse(req.params.slug);
      const component = componentSchema.parse(req.params.component);
      // The worker credential only ever needs the voice config.
      if (res.locals.role === "worker" && component !== "ai_secretary") {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const stored = await store.getConfig(slug, component);
      res.json(stored);
    }),
  );

  app.put(
    "/v1/tenants/:slug/components/:component",
    admin,
    wrap(async (req, res) => {
      const slug = slugSchema.parse(req.params.slug);
      const component = componentSchema.parse(req.params.component);
      const body = putConfigSchema.parse(req.body);
      const result = await store.putConfig(slug, component, body.config, {
        actor: actorFor(req, res),
        expectedVersion: body.expectedVersion,
        note: body.note,
      });
      res.json(result);
    }),
  );

  app.get(
    "/v1/tenants/:slug/components/:component/revisions",
    admin,
    wrap(async (req, res) => {
      const slug = slugSchema.parse(req.params.slug);
      const component = componentSchema.parse(req.params.component);
      const revisions = await store.listRevisions(slug, component);
      res.json({ revisions });
    }),
  );

  app.post(
    "/v1/tenants/:slug/components/:component/rollback",
    admin,
    wrap(async (req, res) => {
      const slug = slugSchema.parse(req.params.slug);
      const component = componentSchema.parse(req.params.component);
      const body = rollbackSchema.parse(req.body);
      const result = await store.rollback(slug, component, body.toVersion, {
        actor: actorFor(req, res),
        note: body.note,
      });
      res.json(result);
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Errors are logged in full server-side; clients only get a stable code.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "invalid_request", issues: err.issues.map((i) => i.path.join(".")) });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: "not_found", what: err.message });
      return;
    }
    if (err instanceof VersionConflictError) {
      res.status(409).json({ error: "version_conflict", currentVersion: err.currentVersion });
      return;
    }
    if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
      res.status(400).json({ error: "invalid_json" });
      return;
    }
    if (typeof err === "object" && err !== null && "type" in err && (err as { type: string }).type === "entity.too.large") {
      res.status(413).json({ error: "too_large" });
      return;
    }
    console.error("platform: unhandled error", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
