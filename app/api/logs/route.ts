import { NextRequest, NextResponse } from "next/server";
import { redis, LOGS_KEY, MAX_LOGS } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), MAX_LOGS);
  const since = parseInt(searchParams.get("since") ?? "0", 10); // unix ms

  try {
    const raw = await redis.lrange(LOGS_KEY, 0, MAX_LOGS - 1);

    const entries = raw
      .map((item) => {
        try {
          return typeof item === "string" ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((e) => (since > 0 ? e.ts > since : true))
      .slice(0, limit);

    return NextResponse.json(
      { logs: entries, total: entries.length },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Redis read error:", err);
    return NextResponse.json({ error: "Redis error", logs: [] }, { status: 500 });
  }
}
