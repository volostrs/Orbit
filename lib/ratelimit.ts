import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limits for the routes that call Gemini, backed by Upstash Redis so they hold across serverless instances.
// Each AI request must pass three windows: per visitor per minute, per visitor per day, and one global daily
// ceiling for the whole deployment (a hard cap on total Gemini spend).
//
// Without Upstash configured: local development is not limited; production FAILS CLOSED (503), so a
// misconfigured deploy can never become an open Gemini proxy.

export type AiBucket = "chat" | "assess";

const PER_VISITOR = {
  chat: { perMinute: 15, perDay: 150 },
  assess: { perMinute: 6, perDay: 60 },
} as const;
const GLOBAL_PER_DAY = 2000;

const url = () => process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

type Limiters = { minute: Ratelimit; day: Ratelimit; global: Ratelimit };
const cache = new Map<AiBucket, Limiters>();

function limitersFor(bucket: AiBucket): Limiters | null {
  const u = url();
  const t = token();
  if (!u || !t) return null;
  let l = cache.get(bucket);
  if (!l) {
    const redis = new Redis({ url: u, token: t });
    const make = (n: number, window: `${number} ${"m" | "d"}`, name: string) =>
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, window), prefix: `orbit:rl:${name}` });
    l = {
      minute: make(PER_VISITOR[bucket].perMinute, "1 m", `${bucket}:min`),
      day: make(PER_VISITOR[bucket].perDay, "1 d", `${bucket}:day`),
      global: make(GLOBAL_PER_DAY, "1 d", "global:day"),
    };
    cache.set(bucket, l);
  }
  return l;
}

// On Vercel x-forwarded-for is set by the platform; the first entry is the client.
function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}

const tooMany = (retryAfterSec: number, message: string) =>
  new Response(JSON.stringify({ error: message, code: "rate_limited" }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfterSec)) },
  });

/** Returns a Response to send back when the request must be refused, or null when it may proceed. */
export async function limitAiRequest(req: Request, bucket: AiBucket): Promise<Response | null> {
  const isProd = process.env.NODE_ENV === "production";
  const limiters = limitersFor(bucket);
  if (!limiters) {
    if (!isProd) return null;
    console.error("Rate limiting is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Refusing AI request.");
    return new Response(JSON.stringify({ error: "The AI service is temporarily unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const key = clientKey(req);
    const [minute, day] = await Promise.all([limiters.minute.limit(key), limiters.day.limit(key)]);
    const hit = [minute, day].find((r) => !r.success);
    if (hit) {
      const wait = Math.ceil((hit.reset - Date.now()) / 1000);
      return tooMany(wait, hit === minute ? "You're sending requests too quickly. Please wait a moment and try again." : "You've reached today's AI limit for this demo. Please try again tomorrow.");
    }
    const global = await limiters.global.limit("all");
    if (!global.success) {
      return tooMany(Math.ceil((global.reset - Date.now()) / 1000), "The demo's daily AI budget has been used up. Please try again tomorrow.");
    }
    return null;
  } catch (err) {
    console.error("Rate limit check failed:", err instanceof Error ? err.message : err);
    if (!isProd) return null;
    return new Response(JSON.stringify({ error: "The AI service is temporarily unavailable." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
