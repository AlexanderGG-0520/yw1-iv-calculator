# Yo-kai Watch 1 IV Reverse Calculator MVP

Private MVP for reverse-searching Yo-kai Watch 1 IV candidates.

## Status

The exact Yo-kai Watch 1 stat formula is not verified in this repository. The current calculator uses a swappable provisional engine in `src/engine/calculationEngine.ts` with TODO comments, so the reverse-search architecture can be tested without pretending the game formula is complete.

## Features

- IV_A, IV_B_1, and IV_B_2 candidate dimensions
- IV_B_1 five-stat patterns constrained to sum to 10
- IV_B_2 search by the number of evolutions the individual has actually passed through:
  - `0`: one all-zero pattern
  - `n > 0`: cumulative per-stat range `n` through `3n`
  - `unknown`: 0 to 15 in each stat, exposed lazily
- Multi-stage evolution support without special-casing one, two, or three evolutions
- Per-stat candidate generation before combination
- Web Worker reverse search
- Sortable result table
- Practical score profiles for attackers, walls, healers, disruption, support, balanced, speed-focused, and custom weights

## Scoring

Score profiles are heuristics for sorting and comparing candidates that already
match the formula constraints. They are not proof that a candidate is correct.
Candidate correctness still depends on the observed stats, personality bonus,
IV constraints, and the current formula engine.

The app includes Japanese score profiles such as `物理アタッカー`, `妖術アタッカー`,
`壁・受け`, `ヒーラー`, `妨害・悪取り付き`, `必殺回し・補助`, `バランス`, and
`すばやさ重視`. Custom score weights are allowed for experimentation. If every
custom weight is zero, scoring falls back to `バランス`.

## Runtime Notes

The nginx image exposes `/healthz` for liveness/readiness checks. It returns
plain text `ok` with access logging disabled. Kubernetes probes should use
`/healthz` rather than `/`.

`/favicon.ico` intentionally returns HTTP 204 with access logging disabled so
browsers do not produce noisy 404s. The SPA fallback still serves `index.html`
for app routes while static assets under `/assets/...` are served as files.

## Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm test
npm run build
```

## Local Docker Preview

This Dockerfile and compose file are for local build/preview only.

```sh
docker compose --profile local up --build
```
