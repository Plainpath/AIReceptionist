import { PrismaClient } from "@prisma/client";

import { createApp } from "./app.js";
import { ConfigStore } from "./configStore.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`platform: ${name} is not set`);
    process.exit(1);
  }
  return value;
}

const tokens = {
  admin: requireEnv("PLATFORM_ADMIN_TOKEN"),
  worker: requireEnv("PLATFORM_WORKER_TOKEN"),
};
if (tokens.admin.length < 32 || tokens.worker.length < 32 || tokens.admin === tokens.worker) {
  console.error("platform: tokens must be at least 32 characters and different from each other");
  process.exit(1);
}
requireEnv("DATABASE_URL");

const prisma = new PrismaClient();
const app = createApp({ store: new ConfigStore(prisma), tokens });
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`platform: listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    });
  });
}
