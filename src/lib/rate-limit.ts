// Rate limiter distribuido para API routes.
// Usa Upstash Redis (escala en serverless) con fallback en memoria
// si no hay credenciales configuradas (dev local).

import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

let redis: Redis | null = null;
if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
}

// Fallback en memoria (solo dev / sin Upstash)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes (fallback only)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds (default: 60s) */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (usually IP + route)
 * Uses Upstash Redis when configured, otherwise in-memory fallback.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs = 60_000 } = config;
  const now = Date.now();

  if (redis) {
    const key = `rl:${identifier}`;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    const [count, ttl] = await Promise.all([
      redis.incr(key),
      redis.ttl(key).then((v) => v ?? -1),
    ]);

    // Primer request de la ventana: setear expiracion
    if (count === 1 || ttl === -1) {
      await redis.expire(key, ttlSeconds);
    }

    const resetAt = now + windowMs;
    if (count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: Math.max(0, maxRequests - count), resetAt };
  }

  // Fallback en memoria
  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt };
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Apply rate limit to a request and return error response if exceeded
 * Returns null if allowed
 */
export async function rateLimitResponse(
  request: Request,
  route: string,
  config: RateLimitConfig
): Promise<Response | null> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(`${ip}:${route}`, config);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ status: "error", error: "Too many requests. Try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  return null;
}