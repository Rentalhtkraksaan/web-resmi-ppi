import { NextResponse } from "next/server";

const PRIMARY_RTDB_URL = "https://cwu-gen-2-default-rtdb.firebaseio.com/system/visitorCount.json";
const BACKUP_RTDB_URL = "https://paskab-c3eb4-default-rtdb.firebaseio.com/visitor_stats/total_calls.json";
const BASE_COUNT = 2410;

// In-memory fallback if all external RTDBs are unreachable
let fallbackMemoryCount = BASE_COUNT;

async function getLiveVisitorCount(): Promise<number> {
  try {
    const res = await fetch(PRIMARY_RTDB_URL, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const val = await res.json();
      if (typeof val === "number" && val >= BASE_COUNT) {
        fallbackMemoryCount = Math.max(fallbackMemoryCount, val);
        return val;
      }
    }
  } catch {
    // fallback
  }

  return Math.max(fallbackMemoryCount, BASE_COUNT);
}

async function persistVisitorCount(count: number): Promise<void> {
  fallbackMemoryCount = Math.max(fallbackMemoryCount, count);

  // 1. Primary write to cwu-gen-2 RTDB (tested & open)
  try {
    await fetch(PRIMARY_RTDB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(count),
    });
  } catch (err) {
    console.warn("Failed to persist visitor count to primary RTDB:", err);
  }

  // 2. Best-effort mirror to paskab-c3eb4 RTDB
  try {
    fetch(BACKUP_RTDB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(count),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export async function GET() {
  const count = await getLiveVisitorCount();
  return NextResponse.json(
    { count },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST() {
  const current = await getLiveVisitorCount();
  const nextCount = Math.max(current, BASE_COUNT) + 1;
  await persistVisitorCount(nextCount);

  return NextResponse.json(
    { success: true, count: nextCount },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
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


export const dynamic = "force-dynamic";
export const revalidate = 0;

