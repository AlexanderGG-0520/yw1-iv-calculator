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
- B_2 evolution-count handling:
  - 0 evolutions: all zero
  - n evolutions: each stat can be any cumulative value from n to 3n
  - unknown evolution count: each stat 0 to 15, lazy/safe only
- reverse search architecture:
  - build candidates per stat first
  - combine candidates only when B_1 total is 10
  - run reverse search in a Web Worker
- simple UI:
  - yokai selector
  - level
  - observed HP / strength / spirit / defense / speed
  - personality bonus mode
  - evolution count with an unknown option
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
- zero evolutions returns exactly one all-zero B_2 pattern
- one evolution returns 243 B_2 patterns
- two evolutions produce per-stat B_2 values 2 through 6
- unknown evolution count is lazy/safe and does not eagerly allocate a huge array

## Quality bar

Before finishing, run:
- npm test
- npm run build

If tests fail, fix them.
If build fails, fix it.
If the exact Yo-kai Watch 1 formula cannot be confidently ported, leave a clear TODO and make the calculator engine swappable.
Do not fake correctness.
