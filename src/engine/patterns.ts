import { STAT_KEYS, type EvolutionCount, type StatBlock } from "./types";

export type BPattern = StatBlock;

export interface LazyPatternSource<T> extends Iterable<T> {
  readonly kind: "lazy";
  readonly estimatedCount: number;
}

export type B2PatternSource = BPattern[] | LazyPatternSource<BPattern>;

const UNKNOWN_B2_MAX = 15;
const KNOWN_B2_EAGER_PATTERN_LIMIT = 100_000;

const zeroPattern = (): BPattern => ({
  hp: 0,
  strength: 0,
  spirit: 0,
  defense: 0,
  speed: 0,
});

function validateEvolutionCount(evolutionCount: number): void {
  if (!Number.isInteger(evolutionCount) || evolutionCount < 0) {
    throw new RangeError("evolutionCount must be a non-negative integer or unknown");
  }
}

function inclusiveRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function createLazyB2Patterns(values: number[], estimatedCount: number): LazyPatternSource<BPattern> {
  return {
    kind: "lazy",
    estimatedCount,
    *[Symbol.iterator]() {
      for (const hp of values) {
        for (const strength of values) {
          for (const spirit of values) {
            for (const defense of values) {
              for (const speed of values) {
                yield { hp, strength, spirit, defense, speed };
              }
            }
          }
        }
      }
    },
  };
}

export function generateB1Patterns(): BPattern[] {
  const patterns: BPattern[] = [];

  for (let hp = 0; hp <= 10; hp += 1) {
    for (let strength = 0; strength <= 10 - hp; strength += 1) {
      for (let spirit = 0; spirit <= 10 - hp - strength; spirit += 1) {
        for (let defense = 0; defense <= 10 - hp - strength - spirit; defense += 1) {
          const speed = 10 - hp - strength - spirit - defense;
          patterns.push({ hp, strength, spirit, defense, speed });
        }
      }
    }
  }

  return patterns;
}

export function generateB2Patterns(evolutionCount: EvolutionCount): B2PatternSource {
  if (evolutionCount === "unknown") {
    const values = inclusiveRange(0, UNKNOWN_B2_MAX);
    return createLazyB2Patterns(values, values.length ** STAT_KEYS.length);
  }

  validateEvolutionCount(evolutionCount);
  if (evolutionCount === 0) {
    return [zeroPattern()];
  }

  const values = inclusiveRange(evolutionCount, evolutionCount * 3);
  const estimatedCount = values.length ** STAT_KEYS.length;
  const lazyPatterns = createLazyB2Patterns(values, estimatedCount);

  if (estimatedCount > KNOWN_B2_EAGER_PATTERN_LIMIT) {
    return lazyPatterns;
  }

  return Array.from(lazyPatterns);
}

export function b2ValuesForStat(evolutionCount: EvolutionCount): number[] {
  if (evolutionCount === "unknown") {
    return inclusiveRange(0, UNKNOWN_B2_MAX);
  }

  validateEvolutionCount(evolutionCount);
  if (evolutionCount === 0) {
    return [0];
  }

  return inclusiveRange(evolutionCount, evolutionCount * 3);
}

export function isLazyPatternSource<T>(value: Iterable<T>): value is LazyPatternSource<T> {
  return !Array.isArray(value) && "kind" in value && value.kind === "lazy";
}
