import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing Upstash Redis environment variables");
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const LOGS_KEY = "noclog:pppoe:logs";
export const RATE_KEY_PREFIX = "noclog:rate:";
export const MAX_LOGS = 200;
export const LOG_TTL_SECONDS = 3600; // 1 hour rolling window
