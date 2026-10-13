import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Milestone 1 uses two static bearer tokens. Staff and client user logins
// replace the admin token in a later step; the worker token stays as the
// voice worker's service credential.
export type Role = "admin" | "worker";

export interface AuthTokens {
  admin: string;
  worker: string;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function resolveRole(header: string | undefined, tokens: AuthTokens): Role | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  if (tokens.admin && safeEqual(token, tokens.admin)) return "admin";
  if (tokens.worker && safeEqual(token, tokens.worker)) return "worker";
  return null;
}

export function requireRole(tokens: AuthTokens, allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = resolveRole(req.header("authorization"), tokens);
    if (role === null) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    res.locals.role = role;
    next();
  };
}
