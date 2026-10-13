import { z } from "zod";

// Same rule the voice worker applies to config names from job metadata.
export const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

export const slugSchema = z.string().min(1).max(64).regex(SLUG_RE);

export const componentSchema = z.enum(["ai_secretary", "website", "quotes", "web_chat", "reviews"]);
export type ComponentName = z.infer<typeof componentSchema>;

export const tenantStatusSchema = z.enum(["prospect", "onboarding", "live", "paused", "cancelled"]);

export const upsertTenantSchema = z
  .object({
    name: z.string().min(1).max(200),
    status: tenantStatusSchema.optional(),
    plan: z.string().max(64).nullable().optional(),
  })
  .strict();

const jsonObject = z.record(z.unknown());

export const putConfigSchema = z
  .object({
    config: jsonObject,
    // Optimistic concurrency: when set, the write is refused with 409 unless
    // the stored version still matches.
    expectedVersion: z.number().int().min(0).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const rollbackSchema = z
  .object({
    toVersion: z.number().int().min(1),
    note: z.string().max(500).optional(),
  })
  .strict();

// Free-text actor recorded on revisions, e.g. "chris via import CLI".
export const actorSchema = z.string().max(100).regex(/^[\w .@:-]+$/);
