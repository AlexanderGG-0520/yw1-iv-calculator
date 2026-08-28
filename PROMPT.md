Maintain the Yo-kai Watch 1 IV reverse calculator described in AGENTS.md.

Prioritize correctness, tests, architecture, and clear user-facing usage guidance over UI appearance.

Do not configure Cloudflare, Kubernetes, SSH, Docker socket, or home server deployment.

Preserve the root MIT license, third-party attribution in `THIRD_PARTY_NOTICES.md`, and the unofficial-project disclaimer.
Do not add ROMs or extracted official game assets.

Maintain the Yo-kai Watch 1 IV reverse calculator structure:
- IV_A
- IV_B_1 sum 10
- IV_B_2 by actual evolution count: 0 => zero, n => cumulative n..3n per stat, unknown => 0..15 lazy/safe
- per-stat candidate generation
- Web Worker reverse search
- sortable result table
- Dockerfile
- compose.yml for local-only use
- README focused on why the tool exists and how to use it

If the exact Yo-kai Watch 1 stat formula cannot be confidently verified, document the limitation, keep the calculation engine swappable, and prefer reproducible in-game fixtures over assumptions.

Run npm test and npm run build before finishing code changes.
