import { PrismaClient } from "@prisma/client";

/**
 * Database: TiDB Cloud (MySQL-compatible). SATU database untuk localhost & hosting.
 * DATABASE_URL harus sama di `.env` lokal dan di Environment Variables hosting.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
