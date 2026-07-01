export const STAT_KEYS = ["hp", "strength", "spirit", "defense", "speed"] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export type StatBlock = Record<StatKey, number>;

export type B2Mode = "direct" | "evolved_once" | "unknown";

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
  | "devoted"
  | "wall"
  | "speed";

export type ScorePreset = "physical_attacker" | "magic_attacker" | "wall";

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
  b2Mode: B2Mode;
  scorePreset: ScorePreset;
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
  ivA: StatBlock;
  ivB1: StatBlock;
  ivB2: StatBlock;
  calculated: StatBlock;
}

export interface SearchSummary {
  perStatCandidateCounts: StatBlock;
  combinationsVisited: number;
  truncated: boolean;
  formulaStatus: string;
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
}

export interface StatCalculationEngine {
  id: string;
  label: string;
  formulaStatus: string;
  formulaStatusKind: "verified" | "ported_from_togenyan_source" | "partially_verified" | "provisional";
  calculate(input: StatCalculationInput): number;
  ivAValuesForStat?(species: YokaiSpecies, stat: StatKey): Iterable<number>;
}
