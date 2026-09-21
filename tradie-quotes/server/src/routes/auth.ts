import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth, requireOwner, signToken } from "../lib/auth";

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
    data: { businessId: business.id, email, passwordHash, name, role: "Owner" },
  });

  const token = signToken({ userId: user.id, businessId: business.id, role: "Owner" });
  res.status(201).json({ token, business, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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

  const token = signToken({ userId: user.id, businessId: user.businessId, role: user.role as "Owner" | "Employee" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.businessId });
});

authRouter.get("/employees", requireAuth, requireOwner, async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const users = await prisma.user.findMany({
    where: { businessId: req.auth!.businessId },
    orderBy: { createdAt: "asc" },
  });
  res.json({
    seatsUsed: users.filter((u) => u.role === "Employee").length,
    seatLimit: business.employeeSeats,
    users: users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })),
  });
});

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post("/employees", requireAuth, requireOwner, async (req: AuthedRequest, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const employeeCount = await prisma.user.count({ where: { businessId: business.id, role: "Employee" } });
  if (employeeCount >= business.employeeSeats) {
    return res.status(409).json({ error: `Employee seat limit reached (${business.employeeSeats}). Increase it in Business settings.` });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: { businessId: business.id, email: parsed.data.email, passwordHash, name: parsed.data.name, role: "Employee" },
  });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
});

authRouter.delete("/employees/:id", requireAuth, requireOwner, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId, role: "Employee" } });
  if (!user) return res.status(404).json({ error: "Not found" });
  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).end();
});
