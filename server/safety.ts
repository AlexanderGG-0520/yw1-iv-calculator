import { BlockList, isIP } from "node:net";

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

type IpFamily = "ipv4" | "ipv6";

function normalizeIp(value: unknown): { address: string; family: IpFamily } | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  let candidate = value.trim();
  if (!candidate) {
    return undefined;
  }

  if (candidate.startsWith("::ffff:")) {
    const mapped = candidate.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return { address: mapped, family: "ipv4" };
    }
  }

  const version = isIP(candidate);
  if (version === 4) {
    return { address: candidate, family: "ipv4" };
  }
  if (version === 6) {
    return { address: candidate, family: "ipv6" };
  }
  return undefined;
}

export class TrustedProxyCidrs {
  private readonly blockList = new BlockList();
  private readonly configured: boolean;

  constructor(raw: string | undefined) {
    const cidrs = (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    this.configured = cidrs.length > 0;

    for (const cidr of cidrs) {
      const separator = cidr.lastIndexOf("/");
      const network = separator >= 0 ? cidr.slice(0, separator) : cidr;
      const normalized = normalizeIp(network);
      if (!normalized) {
        throw new RangeError("Invalid trusted proxy CIDR address: " + cidr);
      }

      const defaultPrefix = normalized.family === "ipv4" ? 32 : 128;
      const prefixText = separator >= 0 ? cidr.slice(separator + 1) : String(defaultPrefix);
      const prefix = Number(prefixText);
      const maxPrefix = normalized.family === "ipv4" ? 32 : 128;

      if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
        throw new RangeError("Invalid trusted proxy CIDR prefix: " + cidr);
      }

      this.blockList.addSubnet(normalized.address, prefix, normalized.family);
    }
  }

  get enabled(): boolean {
    return this.configured;
  }

  matches(value: unknown): boolean {
    const normalized = normalizeIp(value);
    if (!normalized) {
      return false;
    }
    return this.blockList.check(normalized.address, normalized.family);
  }
}

function validClientIpHeader(value: unknown): string | undefined {
  return normalizeIp(value)?.address;
}

export function clientIp(
  req: {
    headers: Record<string, unknown>;
    socket: { remoteAddress?: string | null };
  },
  trustedProxies: TrustedProxyCidrs,
): string {
  const peer = normalizeIp(req.socket.remoteAddress);
  if (!peer) {
    return "unknown";
  }

  if (trustedProxies.matches(peer.address)) {
    const cloudflareIp = validClientIpHeader(req.headers["cf-connecting-ip"]);
    if (cloudflareIp) {
      return cloudflareIp;
    }
  }

  return peer.address;
}
