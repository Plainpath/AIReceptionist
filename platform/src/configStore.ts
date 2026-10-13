import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { ComponentName } from "./schemas.js";

export class NotFoundError extends Error {}
export class VersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super("version conflict");
  }
}

export interface StoredConfig {
  tenant: string;
  component: ComponentName;
  version: number;
  config: Record<string, unknown>;
  updatedAt: Date;
  updatedBy: string;
}

export interface PutResult {
  version: number;
  changed: boolean;
}

function toStored(slug: string, row: {
  component: ComponentName;
  version: number;
  config: Prisma.JsonValue;
  updatedAt: Date;
  updatedBy: string;
}): StoredConfig {
  return {
    tenant: slug,
    component: row.component,
    version: row.version,
    config: row.config as Record<string, unknown>,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

export class ConfigStore {
  constructor(private readonly db: PrismaClient) {}

  async upsertTenant(slug: string, data: { name: string; status?: string; plan?: string | null }) {
    const fields = {
      name: data.name,
      ...(data.status ? { status: data.status as Prisma.TenantCreateInput["status"] } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
    };
    return this.db.tenant.upsert({
      where: { slug },
      create: { slug, ...fields },
      update: fields,
    });
  }

  async getTenant(slug: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { slug },
      include: { componentConfigs: { select: { component: true, version: true, updatedAt: true } } },
    });
    if (!tenant) throw new NotFoundError("tenant");
    return tenant;
  }

  async listTenants() {
    return this.db.tenant.findMany({ orderBy: { slug: "asc" } });
  }

  async getConfig(slug: string, component: ComponentName): Promise<StoredConfig> {
    const row = await this.db.componentConfig.findFirst({
      where: { component, tenant: { slug } },
    });
    if (!row) throw new NotFoundError("config");
    return toStored(slug, row);
  }

  async putConfig(
    slug: string,
    component: ComponentName,
    config: Record<string, unknown>,
    opts: { actor: string; expectedVersion?: number; note?: string },
  ): Promise<PutResult> {
    return this.db.$transaction(async (tx) => {
      // Lock the tenant row so concurrent writers (including the first
      // write, when no config row exists to lock yet) are serialised and
      // cannot both claim version N+1.
      const tenants = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM tenants WHERE slug = ${slug} FOR UPDATE`;
      const tenant = tenants[0];
      if (!tenant) throw new NotFoundError("tenant");

      const locked = await tx.$queryRaw<{ id: string; version: number; config: Prisma.JsonValue }[]>`
        SELECT id, version, config FROM component_configs
        WHERE tenant_id = ${tenant.id}::uuid AND component = ${component}::"Component"`;
      const current = locked[0];
      const currentVersion = current?.version ?? 0;

      if (opts.expectedVersion !== undefined && opts.expectedVersion !== currentVersion) {
        throw new VersionConflictError(currentVersion);
      }
      // Re-importing an unchanged document is a no-op, so the import CLI is
      // safe to re-run and revisions only record real edits.
      if (current && isDeepStrictEqual(current.config, config)) {
        return { version: currentVersion, changed: false };
      }

      const version = currentVersion + 1;
      const json = config as Prisma.InputJsonObject;
      const row = current
        ? await tx.componentConfig.update({
            where: { id: current.id },
            data: { config: json, version, updatedBy: opts.actor },
          })
        : await tx.componentConfig.create({
            data: { tenantId: tenant.id, component, config: json, version, updatedBy: opts.actor },
          });
      await tx.componentConfigRevision.create({
        data: {
          componentConfigId: row.id,
          version,
          config: json,
          updatedBy: opts.actor,
          note: opts.note,
        },
      });
      return { version, changed: true };
    });
  }

  async listRevisions(slug: string, component: ComponentName) {
    const row = await this.db.componentConfig.findFirst({
      where: { component, tenant: { slug } },
      select: { id: true },
    });
    if (!row) throw new NotFoundError("config");
    return this.db.componentConfigRevision.findMany({
      where: { componentConfigId: row.id },
      orderBy: { version: "desc" },
      select: { version: true, updatedBy: true, note: true, createdAt: true },
    });
  }

  async rollback(
    slug: string,
    component: ComponentName,
    toVersion: number,
    opts: { actor: string; note?: string },
  ): Promise<PutResult> {
    const row = await this.db.componentConfig.findFirst({
      where: { component, tenant: { slug } },
      select: { id: true },
    });
    if (!row) throw new NotFoundError("config");
    const revision = await this.db.componentConfigRevision.findUnique({
      where: { componentConfigId_version: { componentConfigId: row.id, version: toVersion } },
    });
    if (!revision) throw new NotFoundError("revision");
    return this.putConfig(slug, component, revision.config as Record<string, unknown>, {
      actor: opts.actor,
      note: opts.note ?? `rollback to v${toVersion}`,
    });
  }
}
