import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { ConfigStore } from "../src/configStore.js";

// Requires DATABASE_URL pointing at a disposable, migrated Postgres database.
const prisma = new PrismaClient();
const tokens = { admin: "a".repeat(40), worker: "w".repeat(40) };
const app = createApp({ store: new ConfigStore(prisma), tokens });
const ADMIN = `Bearer ${tokens.admin}`;
const WORKER = `Bearer ${tokens.worker}`;

const sampleConfig = {
  business: { name: "Acme Plumbing", type: "plumber", timezone: "Australia/Sydney" },
  greeting: "Thanks for calling Acme Plumbing.",
  email: { sender: { type: "resend", resend: { api_key: "${ACME_RESEND_API_KEY}" } } },
};

const cfgPath = "/v1/tenants/acme/components/ai_secretary";

async function seedTenant() {
  await request(app).put("/v1/tenants/acme").set("Authorization", ADMIN).send({ name: "Acme Plumbing" }).expect(200);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe("TRUNCATE tenants CASCADE");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("rejects missing and wrong tokens", async () => {
    await request(app).get(cfgPath).expect(401);
    await request(app).get(cfgPath).set("Authorization", "Bearer nope").expect(401);
    await request(app).get(cfgPath).set("Authorization", tokens.admin).expect(401);
  });

  it("keeps the worker token read-only and voice-only", async () => {
    await request(app).put("/v1/tenants/acme").set("Authorization", WORKER).send({ name: "x" }).expect(403);
    await request(app).put(cfgPath).set("Authorization", WORKER).send({ config: sampleConfig }).expect(403);
    await request(app).get("/v1/tenants").set("Authorization", WORKER).expect(403);
    await request(app).get("/v1/tenants/acme/components/quotes").set("Authorization", WORKER).expect(403);
  });

  it("serves health without auth", async () => {
    await request(app).get("/healthz").expect(200, { ok: true });
  });
});

describe("tenants", () => {
  it("upserts by slug", async () => {
    await seedTenant();
    const res = await request(app)
      .put("/v1/tenants/acme")
      .set("Authorization", ADMIN)
      .send({ name: "Acme Plumbing Pty Ltd", status: "live" })
      .expect(200);
    expect(res.body.tenant).toMatchObject({ slug: "acme", name: "Acme Plumbing Pty Ltd", status: "live" });
    const list = await request(app).get("/v1/tenants").set("Authorization", ADMIN).expect(200);
    expect(list.body.tenants).toHaveLength(1);
  });

  it("rejects slugs that could escape a path", async () => {
    await request(app).put("/v1/tenants/..%2Fetc").set("Authorization", ADMIN).send({ name: "x" }).expect(400);
    await request(app).put("/v1/tenants/a.b").set("Authorization", ADMIN).send({ name: "x" }).expect(400);
  });

  it("rejects unknown fields", async () => {
    await request(app).put("/v1/tenants/acme").set("Authorization", ADMIN).send({ name: "x", admin: true }).expect(400);
  });
});

describe("component config", () => {
  it("404s before anything is stored", async () => {
    await request(app).get(cfgPath).set("Authorization", WORKER).expect(404);
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: sampleConfig }).expect(404);
  });

  it("stores, serves and versions the config with placeholders intact", async () => {
    await seedTenant();
    const put = await request(app)
      .put(cfgPath)
      .set("Authorization", ADMIN)
      .set("X-Actor", "chris via import")
      .send({ config: sampleConfig, note: "import from YAML" })
      .expect(200);
    expect(put.body).toEqual({ version: 1, changed: true });

    const got = await request(app).get(cfgPath).set("Authorization", WORKER).expect(200);
    expect(got.body).toMatchObject({ tenant: "acme", component: "ai_secretary", version: 1, updatedBy: "admin:chris via import" });
    expect(got.body.config).toEqual(sampleConfig);
  });

  it("does not bump the version for an identical re-import", async () => {
    await seedTenant();
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: sampleConfig }).expect(200);
    const again = await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: sampleConfig }).expect(200);
    expect(again.body).toEqual({ version: 1, changed: false });
  });

  it("refuses a stale write with 409", async () => {
    await seedTenant();
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: sampleConfig }).expect(200);
    const edited = { ...sampleConfig, greeting: "G'day" };
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: edited, expectedVersion: 1 }).expect(200);
    const stale = await request(app)
      .put(cfgPath)
      .set("Authorization", ADMIN)
      .send({ config: { ...sampleConfig, greeting: "Hi" }, expectedVersion: 1 })
      .expect(409);
    expect(stale.body).toEqual({ error: "version_conflict", currentVersion: 2 });
  });

  it("serialises concurrent writers into distinct versions", async () => {
    await seedTenant();
    const writes = Array.from({ length: 5 }, (_, i) =>
      request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: { ...sampleConfig, greeting: `v${i}` } }),
    );
    const results = await Promise.all(writes);
    const versions = results.map((r) => r.body.version).sort();
    expect(versions).toEqual([1, 2, 3, 4, 5]);
  });

  it("lists revisions and rolls back to an earlier one", async () => {
    await seedTenant();
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: sampleConfig }).expect(200);
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: { ...sampleConfig, greeting: "bad" } }).expect(200);

    const back = await request(app).post(`${cfgPath}/rollback`).set("Authorization", ADMIN).send({ toVersion: 1 }).expect(200);
    expect(back.body).toEqual({ version: 3, changed: true });
    const got = await request(app).get(cfgPath).set("Authorization", WORKER).expect(200);
    expect(got.body.config.greeting).toBe(sampleConfig.greeting);

    const revs = await request(app).get(`${cfgPath}/revisions`).set("Authorization", ADMIN).expect(200);
    expect(revs.body.revisions.map((r: { version: number }) => r.version)).toEqual([3, 2, 1]);
    expect(revs.body.revisions[0].note).toBe("rollback to v1");
  });

  it("rejects non-object config and unknown components", async () => {
    await seedTenant();
    await request(app).put(cfgPath).set("Authorization", ADMIN).send({ config: [1, 2] }).expect(400);
    await request(app).put("/v1/tenants/acme/components/crm").set("Authorization", ADMIN).send({ config: {} }).expect(400);
  });

  it("rejects malformed JSON without leaking parser detail", async () => {
    const res = await request(app)
      .put(cfgPath)
      .set("Authorization", ADMIN)
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body).toEqual({ error: "invalid_json" });
  });
});
