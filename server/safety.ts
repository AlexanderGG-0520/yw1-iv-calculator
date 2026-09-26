import { isIP } from "node:net";

export const MAX_RATE_LIMIT_KEYS = 4096;

export class BoundedRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxKeys = MAX_RATE_LIMIT_KEYS) {
    if (!Number.isInteger(maxKeys) || maxKeys < 1) {
      throw new RangeError("maxKeys must be a positive integer");
    }
  }

  get size(): number {
    return this.entries.size;
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  take(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const current = this.entries.get(key);
    if (current && current.resetAt > now) {
      current.count += 1;
      return current.count <= limit;
    }

    if (current) {
      this.entries.delete(key);
    }

    if (this.entries.size >= this.maxKeys) {
      this.prune(now);
    }
    while (this.entries.size >= this.maxKeys) {
      this.evictOldest();
    }

    this.entries.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestResetAt = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt < oldestResetAt) {
        oldestKey = key;
        oldestResetAt = entry.resetAt;
      }
    }

    if (oldestKey !== undefined) {
      this.entries.delete(oldestKey);
    }
  }
}

function validIpHeader(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim();
  return isIP(candidate) ? candidate : undefined;
}

export function clientIp(
  req: {
    headers: Record<string, unknown>;
    socket: { remoteAddress?: string | null };
  },
  trustCloudflareHeader = false,
): string {
  if (trustCloudflareHeader) {
    const cloudflareIp = validIpHeader(req.headers["cf-connecting-ip"]);
    if (cloudflareIp) {
      return cloudflareIp;
    }
  }

  const socketIp = validIpHeader(req.socket.remoteAddress);
  return socketIp ?? "unknown";
}
