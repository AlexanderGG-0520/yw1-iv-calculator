# Yo-kai Watch 1 IV Reverse Calculator MVP

Private MVP for reverse-searching Yo-kai Watch 1 IV candidates.

## Status

The exact Yo-kai Watch 1 stat formula is not verified in this repository. The current calculator uses a swappable provisional engine in `src/engine/calculationEngine.ts` with TODO comments, so the reverse-search architecture can be tested without pretending the game formula is complete.

## Features

- IV_A, IV_B_1, and IV_B_2 candidate dimensions
- IV_B_1 five-stat patterns constrained to sum to 10
- IV_B_2 modes:
  - `direct`: one all-zero pattern
  - `evolved_once`: 1 to 3 in each stat
  - `unknown`: 0 to 15 in each stat, exposed lazily
- Per-stat candidate generation before combination
- Web Worker reverse search
- Sortable result table
- Rough scoring presets for physical attacker, magic attacker, and wall

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
