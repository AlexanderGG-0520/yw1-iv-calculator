export const STAT_KEYS = ["hp", "strength", "spirit", "defense", "speed"] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export type StatBlock = Record<StatKey, number>;

export type EvolutionCount = number | "unknown";

export type PersonalityMode =
  | "none"
  | "short_tempered"
  | "physical_attacker"
  | "magic_attacker"
  | "calm"
  | "careful"
  | "kind"
  | "compassionate"
  | "nasty"
  | "cooperative"
  | "devoted"
  | "wall"
  | "speed";

export type ScoreProfileId =
  | "physical_attacker"
  | "fast_physical"
  | "bulky_physical"
  | "magic_attacker"
  | "fast_magic"
  | "bulky_magic"
  | "wall"
  | "healer"
  | "disruptor"
  | "support"
  | "balanced"
  | "speed_focus"
  | "custom";

export type ScorePreset = ScoreProfileId;

export interface ScoreProfile {
  id: ScoreProfileId;
  name: string;
  description: string;
  weights: StatBlock;
}

export interface YokaiSpecies {
  id: string;
  name: string;
  sourceName?: string;
  sourceFurigana?: string;
  number?: number;
  base: StatBlock;
  growPattern: StatBlock;
  levelGrowth?: StatBlock;
  tribeClass?: number;
  ivAAllowed?: Record<StatKey, boolean>;
}

export interface SearchInput {
  speciesId: string;
  level: number;
  observed: StatBlock;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
  evolutionCount: EvolutionCount;
  scorePreset: ScorePreset;
  customScoreWeights?: StatBlock;
  maxResults: number;
}

export interface StatCandidate {
  stat: StatKey;
  ivA: number;
  ivB1: number;
  ivB2: number;
  calculated: number;
}

export interface ReverseResult {
  id: string;
  score: number;
  scoreProfile?: ScoreProfile;
  ivA: StatBlock;
  ivB1: StatBlock;
  ivB2: StatBlock;
  calculated: StatBlock;
}

export interface IdealAchievementSummary {
  idealScore: number;
  minPercent: number;
  medianPercent: number;
  maxPercent: number;
  complete: boolean;
}

export interface SearchSummary {
  perStatCandidateCounts: StatBlock;
  combinationsVisited: number;
  validCandidateCount: number;
  truncated: boolean;
  formulaStatus: string;
  idealAchievement?: IdealAchievementSummary;
}

export interface SearchResponse {
  results: ReverseResult[];
  summary: SearchSummary;
}

export interface StatCalculationInput {
  species: YokaiSpecies;
  stat: StatKey;
  level: number;
  ivA: number;
  ivB1: number;
  ivB2: number;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
}

export interface StatCalculationEngine {
  id: string;
  label: string;
  formulaStatus: string;
  formulaStatusKind: "verified" | "ported_from_togenyan_source" | "partially_verified" | "provisional";
  calculate(input: StatCalculationInput): number;
  ivAValuesForStat?(species: YokaiSpecies, stat: StatKey): Iterable<number>;
}
