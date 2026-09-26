// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  BoundedRateLimiter,
  clientIp,
  TrustedProxyCidrs,
} from "./safety";

describe("MCP server safety helpers", () => {
  it("uses CF-Connecting-IP only when the socket peer is inside a trusted proxy CIDR", () => {
    const trusted = new TrustedProxyCidrs("10.244.0.0/16");

    expect(
      clientIp(
        {
          headers: {
            "cf-connecting-ip": "203.0.113.10",
            "x-forwarded-for": "198.51.100.250",
          },
          socket: { remoteAddress: "10.244.2.17" },
        },
        trusted,
      ),
    ).toBe("203.0.113.10");

    expect(
      clientIp(
        {
          headers: {
            "cf-connecting-ip": "203.0.113.10",
            "x-forwarded-for": "198.51.100.250",
          },
          socket: { remoteAddress: "10.245.2.17" },
        },
        trusted,
      ),
    ).toBe("10.245.2.17");
  });

  it("normalizes IPv4-mapped socket peers before trusted-proxy matching", () => {
    const trusted = new TrustedProxyCidrs("10.244.0.0/16");
    expect(
      clientIp(
        {
          headers: { "cf-connecting-ip": "2001:db8::42" },
          socket: { remoteAddress: "::ffff:10.244.1.9" },
        },
        trusted,
      ),
    ).toBe("2001:db8::42");
  });

  it("ignores X-Forwarded-For even from a trusted proxy", () => {
    const trusted = new TrustedProxyCidrs("10.244.0.0/16");
    expect(
      clientIp(
        {
          headers: { "x-forwarded-for": "198.51.100.250" },
          socket: { remoteAddress: "10.244.1.9" },
        },
        trusted,
      ),
    ).toBe("10.244.1.9");
  });

  it("falls back to the trusted socket peer for malformed Cloudflare client IP", () => {
    const trusted = new TrustedProxyCidrs("10.244.0.0/16");
    expect(
      clientIp(
        {
          headers: { "cf-connecting-ip": "not-an-ip" },
          socket: { remoteAddress: "10.244.1.9" },
        },
        trusted,
      ),
    ).toBe("10.244.1.9");
  });

  it("rejects malformed trusted proxy CIDRs at startup", () => {
    expect(() => new TrustedProxyCidrs("10.244.0.0/99")).toThrow(/prefix/);
    expect(() => new TrustedProxyCidrs("not-a-cidr")).toThrow(/address/);
  });

  it("prunes expired rate-limit entries", () => {
    const limiter = new BoundedRateLimiter(10);
    expect(limiter.take("a", 1, 1000, 0)).toBe(true);
    expect(limiter.take("b", 1, 1000, 0)).toBe(true);
    expect(limiter.size).toBe(2);

    limiter.prune(1000);
    expect(limiter.size).toBe(0);
  });

  it("never grows beyond the configured key limit", () => {
    const limiter = new BoundedRateLimiter(3);
    expect(limiter.take("a", 1, 10_000, 0)).toBe(true);
    expect(limiter.take("b", 1, 20_000, 0)).toBe(true);
    expect(limiter.take("c", 1, 30_000, 0)).toBe(true);
    expect(limiter.size).toBe(3);

    expect(limiter.take("d", 1, 40_000, 0)).toBe(true);
    expect(limiter.size).toBe(3);

    expect(limiter.take("a", 1, 50_000, 1)).toBe(true);
    expect(limiter.size).toBe(3);
  });
});
