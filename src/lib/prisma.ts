import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// Vercel Serverless File-System Adapter:
// On Vercel (AWS Lambda), /var/task is read-only.
// We copy the seeded SQLite database to /tmp so it is fully readable and writable.
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    const tmpDbPath = path.join("/tmp", "dev.db");
    const candidates = [
      path.join(process.cwd(), "prisma", "dev.db"),
      path.join(process.cwd(), "dev.db"),
    ];

    if (!fs.existsSync(tmpDbPath)) {
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          fs.copyFileSync(cand, tmpDbPath);
          break;
        }
      }
    }

    if (fs.existsSync(tmpDbPath)) {
      process.env.DATABASE_URL = `file:${tmpDbPath}`;
    }
  } catch (err) {
    console.warn("Failed to initialize /tmp database for Vercel:", err);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  walConfigured: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Safe SQLite Pragmas (never crash on read-only or serverless cold-starts)
if (!globalForPrisma.walConfigured) {
  globalForPrisma.walConfigured = true;
  prisma
    .$queryRawUnsafe("PRAGMA busy_timeout = 5000;")
    .catch(() => {});
}
