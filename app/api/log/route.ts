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

  // --- Parse body: accept both JSON and plain text ---
  let messages: string[] = [];

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    if (typeof b.message === "string" && b.message.trim()) {
      messages.push(b.message.trim());
    } else if (Array.isArray(b.messages)) {
      for (const m of b.messages) {
        if (typeof m === "string" && m.trim()) messages.push(m.trim());
      }
    }
  } else {
    // Accept plain text body as the message
    const text = (await req.text()).trim();
    if (text) messages.push(text);
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
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
    pipeline.ltrim(LOGS_KEY, 0, MAX_LOGS - 1);
    pipeline.expire(LOGS_KEY, 7200);
    await pipeline.exec();
  }

  return NextResponse.json({ ok: true, stored }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "NOC Log Ingest" });
}
