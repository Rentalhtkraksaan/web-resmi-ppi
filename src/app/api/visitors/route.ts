import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_COUNT = 2410;
const KEY = "visitor_count";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

async function readCount(): Promise<number> {
  try {
    const row = await prisma.systemFlag.findUnique({ where: { key: KEY } });
    const n = row ? parseInt(row.value, 10) : NaN;
    return Number.isFinite(n) && n >= BASE_COUNT ? n : BASE_COUNT;
  } catch {
    return BASE_COUNT;
  }
}

export async function GET() {
  return NextResponse.json({ count: await readCount() }, { headers: HEADERS });
}

export async function POST() {
  try {
    // Pastikan baris ada, lalu naikkan 1 secara atomik di database (aman untuk banyak pengunjung)
    await prisma.systemFlag.upsert({
      where: { key: KEY },
      update: {},
      create: { key: KEY, value: String(BASE_COUNT) },
    });
    await prisma.$executeRaw`UPDATE SystemFlag SET value = CAST(CAST(value AS UNSIGNED) + 1 AS CHAR) WHERE \`key\` = ${KEY}`;
  } catch (err) {
    console.warn("Gagal menambah visitor count:", err);
  }
  return NextResponse.json({ success: true, count: await readCount() }, { headers: HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
