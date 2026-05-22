import { NextRequest, NextResponse } from "next/server";
import { redis, LOGS_KEY, RATE_KEY_PREFIX, MAX_LOGS } from "@/lib/redis";
import { isPPPoELog, parseLogEntry } from "@/lib/pppoe-filter";

const AUTH_TOKEN = process.env.AUTH_TOKEN!;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN ?? "120", 10);
const DEDUP_KEY  = "noclog:dedup";
const DEDUP_SIZE = 500;

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key   = `${RATE_KEY_PREFIX}${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= RATE_LIMIT;
}

// Simple hash for dedup key
function msgHash(msg: string): string {
  let h = 0;
  for (let i = 0; i < msg.length; i++) {
    h = (Math.imul(31, h) + msg.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip      = getClientIP(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const rawBody = (await req.text()).trim();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

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
      messages = rawBody.split("\n").map(l => l.trim()).filter(Boolean);
    }
  } else {
    messages = rawBody.split("\n").map(l => l.trim()).filter(Boolean);
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  // Load dedup set from Redis
  const dedupRaw = await redis.lrange(DEDUP_KEY, 0, DEDUP_SIZE - 1) as string[];
  const dedupSet = new Set(dedupRaw);

  let stored = 0;
  const pipeline    = redis.pipeline();
  const newHashes: string[] = [];

  for (const msg of messages) {
    if (!isPPPoELog(msg)) continue;
    const hash = msgHash(msg);
    if (dedupSet.has(hash)) continue; // duplicate — skip
    dedupSet.add(hash);
    newHashes.push(hash);
    const entry = parseLogEntry(msg);
    pipeline.lpush(LOGS_KEY, JSON.stringify(entry));
    stored++;
  }

  if (stored > 0) {
    pipeline.ltrim(LOGS_KEY, 0, MAX_LOGS - 1);
    pipeline.expire(LOGS_KEY, 7200);
    for (const h of newHashes) {
      pipeline.lpush(DEDUP_KEY, h);
    }
    pipeline.ltrim(DEDUP_KEY, 0, DEDUP_SIZE - 1);
    pipeline.expire(DEDUP_KEY, 3600);
    await pipeline.exec();
  }

  return NextResponse.json({ ok: true, stored }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "NOC Log Ingest" });
}
