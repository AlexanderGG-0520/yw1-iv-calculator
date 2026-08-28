Implement the MVP described in AGENTS.md.

Prioritize correctness, tests, and architecture over UI appearance.

Create a React + Vite + TypeScript app if the repository is empty.

Do not configure Cloudflare, Kubernetes, SSH, Docker socket, or home server deployment.

Do not push to GitHub. Commit changes locally only.

Implement the Yo-kai Watch 1 IV reverse calculator structure:
- IV_A
- IV_B_1 sum 10
- IV_B_2 by actual evolution count: 0 => zero, n => cumulative n..3n per stat, unknown => 0..15 lazy/safe
- per-stat candidate generation
- Web Worker reverse search
- sortable result table
- Dockerfile
- compose.yml for local-only use
- README

If the exact Yo-kai Watch 1 stat formula cannot be confidently implemented, create a clearly swappable calculation engine with TODO comments and tests around the search architecture. Do not fake correctness.

Run npm test and npm run build.
Commit all changes locally.
