// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GitOps staged runtime migration", () => {
  it("keeps the Kubernetes port compatible with both the current nginx image and new Node image", async () => {
    const manifest = await readFile("infra/kubernetes/app.yaml", "utf8");
    expect(manifest).toContain("containerPort: 80");
    expect(manifest).not.toContain("containerPort: 8080");
    // The currently pinned nginx image still starts as root, so new-image-only
    // pod security settings must not land before the image pin changes.
    expect(manifest).not.toContain("runAsNonRoot: true");
  });

  it("trusts forwarded client IP only with a CIDR gate and proxy-only NetworkPolicy", async () => {
    const manifest = await readFile("infra/kubernetes/app.yaml", "utf8");
    expect(manifest).not.toContain("TRUST_CF_CONNECTING_IP");
    expect(manifest).toContain("TRUSTED_PROXY_CIDRS");
    expect(manifest).toContain('value: "10.244.0.0/16"');
    expect(manifest).toContain("kind: NetworkPolicy");
    expect(manifest).toContain("kubernetes.io/metadata.name: cloudflared");
    expect(manifest).toContain("kubernetes.io/metadata.name: ingress-nginx");
    expect(manifest).toContain("kubernetes.io/metadata.name: envoy-gateway-system");
  });

  it("builds the replacement runtime with the same port-80 contract", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    expect(dockerfile).toContain("ENV PORT=80");
    expect(dockerfile).toContain("EXPOSE 80");
    expect(dockerfile).toContain("cap_net_bind_service=+ep");
  });
});
