import { STAT_KEYS, type ReverseResult, type ScorePreset, type StatBlock } from "./types";

const SCORE_WEIGHTS: Record<ScorePreset, StatBlock> = {
  physical_attacker: { hp: 1, strength: 4, spirit: 0.5, defense: 1.5, speed: 2 },
  magic_attacker: { hp: 1, strength: 0.5, spirit: 4, defense: 1.5, speed: 2 },
  wall: { hp: 3, strength: 0.5, spirit: 0.5, defense: 4, speed: 1 },
};

export function scoreResult(result: Omit<ReverseResult, "id" | "score">, preset: ScorePreset): number {
  const weights = SCORE_WEIGHTS[preset];

  return STAT_KEYS.reduce((total, stat) => {
    const raw = result.ivA[stat] + result.ivB1[stat] * 2 + result.ivB2[stat];
    return total + raw * weights[stat];
  }, 0);
}
