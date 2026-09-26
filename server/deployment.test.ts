// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GitOps staged runtime migration", () => {
  it("keeps the Kubernetes port compatible with both the current nginx image and new Node image", async () => {
    const manifest = await readFile("infra/kubernetes/app.yaml", "utf8");
    expect(manifest).toContain("containerPort: 80");
    expect(manifest).not.toContain("containerPort: 8080");
  });

  it("does not enable unverified Cloudflare client-IP header trust in the manifest", async () => {
    const manifest = await readFile("infra/kubernetes/app.yaml", "utf8");
    expect(manifest).not.toContain("TRUST_CF_CONNECTING_IP");
  });

  it("builds the replacement runtime with the same port-80 contract", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    expect(dockerfile).toContain("ENV PORT=80");
    expect(dockerfile).toContain("EXPOSE 80");
    expect(dockerfile).toContain("cap_net_bind_service=+ep");
  });
});
