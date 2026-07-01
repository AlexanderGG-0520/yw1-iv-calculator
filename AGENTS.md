# AGENTS.md

Build a private Yo-kai Watch 1 IV reverse calculator MVP.

This repository is for personal use only.

## Hard restrictions

Do not:
- configure Cloudflare
- deploy to any server
- use SSH
- use kubectl
- use Docker socket
- read files outside this repository
- read .env files
- add telemetry
- add analytics
- add external backend services
- pretend the Yo-kai Watch 1 formula is complete if it is not verified
- copy third-party JavaScript without preserving attribution and license comments

Allowed:
- create a React + Vite + TypeScript app
- add Vitest tests
- add a Web Worker for reverse search
- add Dockerfile for local build only
- add compose.yml for local-only use
- inspect public pages needed to understand Yo-kai Watch 1 stat calculation
- commit changes locally

## Required MVP features

Implement:
- IV_A support
- IV_B_1 support
- IV_B_1 patterns must sum to 10 across HP, strength, spirit, defense, and speed
- IV_B_2 support
- B_2 modes:
  - direct: all zero
  - evolved_once: each stat 1 to 3
  - unknown: each stat 0 to 15, lazy/safe only
- reverse search architecture:
  - build candidates per stat first
  - combine candidates only when B_1 total is 10
  - run reverse search in a Web Worker
- simple UI:
  - yokai selector
  - level
  - observed HP / strength / spirit / defense / speed
  - personality bonus mode
  - B_2 mode
  - reverse button
  - sortable result table
- rough score presets:
  - physical attacker
  - magic attacker
  - wall

## Required tests

Add tests for:
- B_1 pattern count is 1001
- every B_1 pattern sums to 10
- direct B_2 mode returns exactly one all-zero pattern
- evolved_once B_2 mode returns 243 patterns
- unknown B_2 mode is lazy/safe and does not eagerly allocate a huge array

## Quality bar

Before finishing, run:
- npm test
- npm run build

If tests fail, fix them.
If build fails, fix it.
If the exact Yo-kai Watch 1 formula cannot be confidently ported, leave a clear TODO and make the calculator engine swappable.
Do not fake correctness.
