import { NextRequest, NextResponse } from "next/server";
import { redis, LOGS_KEY, RATE_KEY_PREFIX, MAX_LOGS } from "@/lib/redis";
import { isPPPoELog, parseLogEntry } from "@/lib/pppoe-filter";

const AUTH_TOKEN = process.env.AUTH_TOKEN!;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN ?? "60", 10);

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `${RATE_KEY_PREFIX}${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Rate limit ---
  const ip = getClientIP(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // --- Parse body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Accept both single { message } and batch { messages: [] }
  const messages: string[] = [];

  const b = body as Record<string, unknown>;

  if (typeof b.message === "string" && b.message.trim()) {
    messages.push(b.message.trim());
  } else if (Array.isArray(b.messages)) {
    for (const m of b.messages) {
      if (typeof m === "string" && m.trim()) messages.push(m.trim());
    }
  } else {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // --- Filter + store ---
  let stored = 0;
  const pipeline = redis.pipeline();

  for (const msg of messages) {
    if (!isPPPoELog(msg)) continue;
    const entry = parseLogEntry(msg);
    pipeline.lpush(LOGS_KEY, JSON.stringify(entry));
    stored++;
  }

  if (stored > 0) {
    // Trim to MAX_LOGS
    pipeline.ltrim(LOGS_KEY, 0, MAX_LOGS - 1);
    // Set expiry (rolling reset on each write)
    pipeline.expire(LOGS_KEY, 7200);
    await pipeline.exec();
  }

  return NextResponse.json({ ok: true, stored }, { status: 200 });
}

// Health check
export async function GET() {
  return NextResponse.json({ status: "ok", service: "NOC Log Ingest" });
}
