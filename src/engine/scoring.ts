import {
  STAT_KEYS,
  type EvolutionCount,
  type ReverseResult,
  type ScorePreset,
  type ScoreProfile,
  type ScoreProfileId,
  type StatBlock,
} from "./types";

// Scores are only sorting heuristics for already-valid reverse-search candidates.
// Weights intentionally keep off-role damage stats nonzero on broad profiles so
// mixed Yo-kai are not hidden behind narrow attacker assumptions.
export const BUILT_IN_SCORE_PROFILES: ScoreProfile[] = [
  {
    id: "physical_attacker",
    name: "物理アタッカー",
    description: "物理攻撃が主なダメージ源の妖怪向け。ちからを最優先し、すばやさと耐久も見る。",
    weights: { hp: 1, strength: 4, spirit: 0.5, defense: 1.5, speed: 2 },
  },
  {
    id: "fast_physical",
    name: "高速物理",
    description: "先に動く価値が高い物理アタッカー向け。ちからとすばやさを強く重視する。",
    weights: { hp: 1, strength: 4, spirit: 0.25, defense: 1, speed: 4 },
  },
  {
    id: "bulky_physical",
    name: "耐久物理",
    description: "場持ちが必要な物理アタッカー向け。ちから、HP、まもりを重視する。",
    weights: { hp: 3, strength: 4, spirit: 0.25, defense: 3, speed: 1.25 },
  },
  {
    id: "magic_attacker",
    name: "妖術アタッカー",
    description: "妖術が主なダメージ源の妖怪向け。ようりょくを最優先し、すばやさと耐久も見る。",
    weights: { hp: 1, strength: 0.5, spirit: 4, defense: 1.5, speed: 2 },
  },
  {
    id: "fast_magic",
    name: "高速妖術",
    description: "先に妖術を撃ちたいアタッカー向け。ようりょくとすばやさを強く重視する。",
    weights: { hp: 1, strength: 0.25, spirit: 4, defense: 1, speed: 4 },
  },
  {
    id: "bulky_magic",
    name: "耐久妖術",
    description: "場持ちが必要な妖術アタッカー向け。ようりょく、HP、まもりを重視する。",
    weights: { hp: 3, strength: 0.25, spirit: 4, defense: 3, speed: 1.25 },
  },
  {
    id: "wall",
    name: "壁・受け",
    description: "受け役の妖怪向け。HPとまもりを最重視し、すばやさは補助的に見る。",
    weights: { hp: 3, strength: 0.5, spirit: 0.5, defense: 4, speed: 1 },
  },
  {
    id: "healer",
    name: "ヒーラー",
    description: "回復や継戦支援向け。生存、行動順、最低限のようりょくをまとめて見る。",
    weights: { hp: 3, strength: 0.25, spirit: 1.5, defense: 3, speed: 2.5 },
  },
  {
    id: "disruptor",
    name: "妨害・悪取り付き",
    description: "妨害、悪いとりつき、デバフ役向け。すばやさと最低限の耐久を重視する。",
    weights: { hp: 2.5, strength: 0.5, spirit: 0.5, defense: 2.5, speed: 4 },
  },
  {
    id: "support",
    name: "必殺回し・補助",
    description: "補助役向け。正確なゲージ計算ではなく、生存と行動順を実用的に見る。",
    weights: { hp: 2.5, strength: 1, spirit: 1, defense: 2.5, speed: 3.5 },
  },
  {
    id: "balanced",
    name: "バランス",
    description: "汎用評価。極端な配分を避け、混合型を強く不利にしすぎない。",
    weights: { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 },
  },
  {
    id: "speed_focus",
    name: "すばやさ重視",
    description: "速い個体を探したい場合向け。すばやさを最優先し、耐久も少し見る。",
    weights: { hp: 1.5, strength: 0.75, spirit: 0.75, defense: 1.5, speed: 5 },
  },
];

export const BALANCED_SCORE_PROFILE = BUILT_IN_SCORE_PROFILES.find((profile) => profile.id === "balanced")!;

export function hasAnyScoreWeight(weights: StatBlock): boolean {
  return STAT_KEYS.some((stat) => weights[stat] !== 0);
}

export function resolveScoreProfile(preset: ScorePreset, customWeights?: StatBlock): ScoreProfile {
  if (preset === "custom") {
    if (customWeights && hasAnyScoreWeight(customWeights)) {
      return {
        id: "custom",
        name: "Custom",
        description: "ユーザー指定の評価ウェイト。実験用で、候補の正しさを証明するものではありません。",
        weights: { ...customWeights },
      };
    }
    return BALANCED_SCORE_PROFILE;
  }

  return BUILT_IN_SCORE_PROFILES.find((profile) => profile.id === preset) ?? BALANCED_SCORE_PROFILE;
}

export function formatScoreWeights(weights: StatBlock): string {
  return `HP ${weights.hp} / ちから ${weights.strength} / ようりょく ${weights.spirit} / まもり ${weights.defense} / すばやさ ${weights.speed}`;
}

function resolveWeights(
  profileOrWeights: ScoreProfile | StatBlock | ScoreProfileId,
  customWeights?: StatBlock,
): StatBlock {
  return typeof profileOrWeights === "string"
    ? resolveScoreProfile(profileOrWeights, customWeights).weights
    : "weights" in profileOrWeights
      ? profileOrWeights.weights
      : profileOrWeights;
}

export function scoreResult(
  result: Omit<ReverseResult, "id" | "score" | "scoreProfile">,
  profileOrWeights: ScoreProfile | StatBlock | ScoreProfileId,
  customWeights?: StatBlock,
): number {
  const weights = resolveWeights(profileOrWeights, customWeights);

  return STAT_KEYS.reduce((total, stat) => {
    const raw = result.ivA[stat] + result.ivB1[stat] * 2 + result.ivB2[stat];
    return total + raw * weights[stat];
  }, 0);
}

export function idealScoreForContext(
  ivAMax: StatBlock,
  evolutionCount: EvolutionCount,
  profileOrWeights: ScoreProfile | StatBlock | ScoreProfileId,
  customWeights?: StatBlock,
): number | null {
  if (evolutionCount === "unknown") {
    return null;
  }

  const weights = resolveWeights(profileOrWeights, customWeights);
  const ivAScore = STAT_KEYS.reduce((total, stat) => {
    const value = weights[stat] >= 0 ? ivAMax[stat] : 0;
    return total + value * weights[stat];
  }, 0);

  // B_1 always totals 10, and contributes twice its raw value to the score.
  // Therefore the ideal allocation puts all 10 points on the highest-weight stat.
  const b1Score = 20 * Math.max(...STAT_KEYS.map((stat) => weights[stat]));

  // The current reverse-search model treats each evolution as an independent
  // +1..+3 B_2 gain per stat, so n evolutions give a cumulative n..3n range.
  const b2Score =
    evolutionCount === 0
      ? 0
      : STAT_KEYS.reduce((total, stat) => {
          const value = weights[stat] >= 0 ? evolutionCount * 3 : evolutionCount;
          return total + value * weights[stat];
        }, 0);

  return ivAScore + b1Score + b2Score;
}
