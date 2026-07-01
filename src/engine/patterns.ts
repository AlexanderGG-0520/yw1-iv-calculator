import { STAT_KEYS, type B2Mode, type StatBlock } from "./types";

export type BPattern = StatBlock;

export interface LazyPatternSource<T> extends Iterable<T> {
  readonly kind: "lazy";
  readonly estimatedCount: number;
}

export type B2PatternSource = BPattern[] | LazyPatternSource<BPattern>;

const zeroPattern = (): BPattern => ({
  hp: 0,
  strength: 0,
  spirit: 0,
  defense: 0,
  speed: 0,
});

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

export function generateB2Patterns(mode: B2Mode): B2PatternSource {
  if (mode === "direct") {
    return [zeroPattern()];
  }

  if (mode === "evolved_once") {
    const patterns: BPattern[] = [];
    for (let hp = 1; hp <= 3; hp += 1) {
      for (let strength = 1; strength <= 3; strength += 1) {
        for (let spirit = 1; spirit <= 3; spirit += 1) {
          for (let defense = 1; defense <= 3; defense += 1) {
            for (let speed = 1; speed <= 3; speed += 1) {
              patterns.push({ hp, strength, spirit, defense, speed });
            }
          }
        }
      }
    }
    return patterns;
  }

  return {
    kind: "lazy",
    estimatedCount: 16 ** STAT_KEYS.length,
    *[Symbol.iterator]() {
      for (let hp = 0; hp <= 15; hp += 1) {
        for (let strength = 0; strength <= 15; strength += 1) {
          for (let spirit = 0; spirit <= 15; spirit += 1) {
            for (let defense = 0; defense <= 15; defense += 1) {
              for (let speed = 0; speed <= 15; speed += 1) {
                yield { hp, strength, spirit, defense, speed };
              }
            }
          }
        }
      }
    },
  };
}

export function b2ValuesForStat(mode: B2Mode): number[] {
  if (mode === "direct") {
    return [0];
  }

  if (mode === "evolved_once") {
    return [1, 2, 3];
  }

  return Array.from({ length: 16 }, (_, index) => index);
}

export function isLazyPatternSource<T>(value: Iterable<T>): value is LazyPatternSource<T> {
  return !Array.isArray(value) && "kind" in value && value.kind === "lazy";
}
