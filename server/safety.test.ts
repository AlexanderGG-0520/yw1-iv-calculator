// @vitest-environment node

import { describe, expect, it } from "vitest";
import { BoundedRateLimiter, clientIp } from "./safety";

describe("MCP server safety helpers", () => {
  it("uses Cloudflare's connecting IP and ignores X-Forwarded-For", () => {
    expect(
      clientIp({
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.250",
        },
        socket: { remoteAddress: "10.0.0.4" },
      }, true),
    ).toBe("203.0.113.10");

    expect(
      clientIp({
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.250",
        },
        socket: { remoteAddress: "10.0.0.4" },
      }),
    ).toBe("10.0.0.4");

    expect(
      clientIp({
        headers: { "x-forwarded-for": "198.51.100.250" },
        socket: { remoteAddress: "10.0.0.4" },
      }),
    ).toBe("10.0.0.4");
  });

  it("falls back to the socket for malformed Cloudflare IP headers", () => {
    expect(
      clientIp({
        headers: { "cf-connecting-ip": "not-an-ip" },
        socket: { remoteAddress: "2001:db8::10" },
      }, true),
    ).toBe("2001:db8::10");
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

    // "a" had the earliest reset and is evicted first.
    expect(limiter.take("a", 1, 50_000, 1)).toBe(true);
    expect(limiter.size).toBe(3);
  });
});
