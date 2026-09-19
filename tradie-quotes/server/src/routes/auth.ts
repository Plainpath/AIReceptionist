import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/db";
import { signToken } from "../lib/auth";

export const authRouter = Router();

const signupSchema = z.object({
  businessName: z.string().min(1),
  abn: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { businessName, abn, email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const business = await prisma.business.create({
    data: { name: businessName, abn },
  });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { businessId: business.id, email, passwordHash, name },
  });

  const token = signToken({ userId: user.id, businessId: business.id });
  res.status(201).json({ token, business, user: { id: user.id, email: user.email, name: user.name } });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, businessId: user.businessId });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});
