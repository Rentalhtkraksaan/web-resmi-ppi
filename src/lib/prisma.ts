import { PrismaClient } from "@prisma/client";

/**
 * Satu database untuk SEMUA lingkungan (localhost & hosting).
 * DATABASE_URL harus mengarah ke PostgreSQL hosted (Neon / Supabase / dsb) yang sama
 * di `.env` lokal dan di Environment Variables hosting.
 *
 * Catatan: SQLite file lokal TIDAK bisa dipakai di hosting serverless (Vercel) karena
 * filesystem-nya read-only / sementara -> itulah penyebab data localhost dan hosting berbeda.
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

if (process.env.DATABASE_URL?.startsWith("file:")) {
  // Mode SQLite lokal saja (pengembangan offline).
  prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});
}
