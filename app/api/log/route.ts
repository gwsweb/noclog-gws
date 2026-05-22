import { NextRequest, NextResponse } from "next/server";
import { redis, LOGS_KEY, RATE_KEY_PREFIX, MAX_LOGS } from "@/lib/redis";
import { isPPPoELog, parseLogEntry } from "@/lib/pppoe-filter";

const AUTH_TOKEN = process.env.AUTH_TOKEN!;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN ?? "120", 10);

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
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIP(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const rawBody = (await req.text()).trim();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  // Support JSON or plain text (single or newline-separated)
  let messages: string[] = [];

  if (rawBody.startsWith("{") || rawBody.startsWith("[")) {
    try {
      const body = JSON.parse(rawBody);
      if (typeof body.message === "string") {
        messages = [body.message];
      } else if (Array.isArray(body.messages)) {
        messages = body.messages.filter((m: unknown) => typeof m === "string");
      }
    } catch {
      // Fall through to plain text
      messages = rawBody.split("\n").map(l => l.trim()).filter(Boolean);
    }
  } else {
    // Plain text — split by newline for batch support
    messages = rawBody.split("\n").map(l => l.trim()).filter(Boolean);
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

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
