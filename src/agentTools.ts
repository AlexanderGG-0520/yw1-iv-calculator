import { togenyanPortedEngine } from "./engine/calculationEngine";
import { calculateStatBlock } from "./engine/forwardCalculation";
import { ivAMaxForSpeciesStat } from "./engine/ivA";
import { reverseSearch } from "./engine/reverseSearch";
import { BUILT_IN_SCORE_PROFILES } from "./engine/scoring";
import {
  STAT_KEYS,
  type EvolutionCount,
  type PersonalityMode,
  type ScorePreset,
  type SearchInput,
  type SearchResponse,
  type StatBlock,
} from "./engine/types";
import { YOKAI, getYokaiSpecies } from "./engine/yokaiData";

export type JsonSchema = Record<string, unknown>;

export interface AgentToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: {
    readOnlyHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
    destructiveHint: boolean;
  };
}

export interface CalculateStatsToolInput {
  speciesId: string;
  level: number;
  ivA: StatBlock;
  ivB1: StatBlock;
  ivB2: StatBlock;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
}

export interface CalculateStatsToolResult {
  species: { id: string; number?: number; name: string };
  input: CalculateStatsToolInput;
  stats: StatBlock;
  formulaStatus: string;
}

export interface ReverseIvToolResult {
  species: { id: string; number?: number; name: string };
  input: SearchInput;
  response: SearchResponse;
}

const personalityModes: PersonalityMode[] = [
  "none",
  "short_tempered",
  "physical_attacker",
  "magic_attacker",
  "calm",
  "careful",
  "kind",
  "compassionate",
  "nasty",
  "cooperative",
  "devoted",
  "wall",
  "speed",
];

const scorePresets: ScorePreset[] = [
  ...BUILT_IN_SCORE_PROFILES.map((profile) => profile.id),
  "custom",
];

const statBlockSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    STAT_KEYS.map((stat) => [stat, { type: "integer", minimum: 0 }]),
  ),
  required: [...STAT_KEYS],
};

const annotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: "search_yokai",
    title: "Search Yo-kai",
    description:
      "Search the Yo-kai Watch 1 species catalog by Japanese name, furigana, encyclopedia number, or internal species ID.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Search text. Empty string lists from the beginning." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    },
    annotations,
  },
  {
    name: "get_yokai",
    title: "Get Yo-kai data",
    description:
      "Get calculator source data for one Yo-kai, including base stats, growth pattern, tribe class, and IV_A eligibility.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        speciesId: { type: "string", description: "Internal species ID returned by search_yokai." },
      },
      required: ["speciesId"],
    },
    annotations,
  },
  {
    name: "calculate_stats",
    title: "Calculate stats",
    description:
      "Forward-calculate Yo-kai Watch 1 stats from species, level, IV_A, IV_B_1, IV_B_2, and personality. IV_B_1 must total exactly 10.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        speciesId: { type: "string" },
        level: { type: "integer", minimum: 1, maximum: 99 },
        ivA: statBlockSchema,
        ivB1: statBlockSchema,
        ivB2: statBlockSchema,
        personalityMode: { type: "string", enum: personalityModes },
        personalityBonus: statBlockSchema,
      },
      required: ["speciesId", "level", "ivA", "ivB1", "ivB2", "personalityMode"],
    },
    annotations,
  },
  {
    name: "reverse_iv",
    title: "Reverse-calculate IVs",
    description:
      "Reverse-calculate valid Yo-kai Watch 1 IV_A, IV_B_1, and IV_B_2 candidates from observed in-game stats.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        speciesId: { type: "string" },
        level: { type: "integer", minimum: 1, maximum: 99 },
        observed: {
          ...statBlockSchema,
          properties: Object.fromEntries(
            STAT_KEYS.map((stat) => [stat, { type: "integer", minimum: 1 }]),
          ),
        },
        personalityMode: { type: "string", enum: personalityModes },
        personalityBonus: statBlockSchema,
        evolutionCount: {
          oneOf: [
            { type: "integer", minimum: 0 },
            { type: "string", enum: ["unknown"] },
          ],
        },
        scorePreset: { type: "string", enum: scorePresets },
        customScoreWeights: statBlockSchema,
        maxResults: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: [
        "speciesId",
        "level",
        "observed",
        "personalityMode",
        "evolutionCount",
        "scorePreset",
      ],
    },
    annotations,
  },
];

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(name + " must be an object");
  }
  return value as Record<string, unknown>;
}

function stringValue(object: Record<string, unknown>, key: string, fallback?: string): string {
  const value = object[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string") throw new TypeError(key + " must be a string");
  return value;
}

function integerValue(
  object: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; fallback?: number } = {},
): number {
  const value = object[key];
  if (value === undefined && options.fallback !== undefined) return options.fallback;
  if (!Number.isInteger(value)) throw new TypeError(key + " must be an integer");
  const number = value as number;
  if (options.min !== undefined && number < options.min) {
    throw new RangeError(key + " must be >= " + options.min);
  }
  if (options.max !== undefined && number > options.max) {
    throw new RangeError(key + " must be <= " + options.max);
  }
  return number;
}

function statBlockValue(value: unknown, name: string, minimum = 0): StatBlock {
  const object = asRecord(value, name);
  return Object.fromEntries(
    STAT_KEYS.map((stat) => {
      const statValue = object[stat];
      if (!Number.isInteger(statValue) || (statValue as number) < minimum) {
        throw new TypeError(name + "." + stat + " must be an integer >= " + minimum);
      }
      return [stat, statValue as number];
    }),
  ) as StatBlock;
}

function optionalStatBlock(object: Record<string, unknown>, key: string): StatBlock | undefined {
  return object[key] === undefined ? undefined : statBlockValue(object[key], key);
}

function personalityModeValue(object: Record<string, unknown>): PersonalityMode {
  const value = stringValue(object, "personalityMode");
  if (!personalityModes.includes(value as PersonalityMode)) {
    throw new RangeError("Unknown personalityMode: " + value);
  }
  return value as PersonalityMode;
}

function scorePresetValue(object: Record<string, unknown>): ScorePreset {
  const value = stringValue(object, "scorePreset");
  if (!scorePresets.includes(value as ScorePreset)) {
    throw new RangeError("Unknown scorePreset: " + value);
  }
  return value as ScorePreset;
}

function evolutionCountValue(object: Record<string, unknown>): EvolutionCount {
  const value = object.evolutionCount;
  if (value === "unknown") return "unknown";
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new TypeError("evolutionCount must be a non-negative integer or 'unknown'");
  }
  return value as number;
}

function speciesSummary(speciesId: string) {
  const species = getYokaiSpecies(speciesId);
  return { id: species.id, number: species.number, name: species.name };
}

export function searchYokaiTool(args: unknown) {
  const input = asRecord(args ?? {}, "arguments");
  const query = stringValue(input, "query", "").trim().toLowerCase();
  const limit = integerValue(input, "limit", { min: 1, max: 100, fallback: 20 });
  const matches = YOKAI.filter((species) => {
    if (!query) return true;
    return [species.id, species.name, species.sourceName, species.sourceFurigana, species.number?.toString()]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  }).slice(0, limit);

  return {
    query,
    count: matches.length,
    results: matches.map((species) => ({
      id: species.id,
      number: species.number,
      name: species.name,
      furigana: species.sourceFurigana,
    })),
  };
}

export function getYokaiTool(args: unknown) {
  const input = asRecord(args, "arguments");
  const species = getYokaiSpecies(stringValue(input, "speciesId"));
  return {
    id: species.id,
    number: species.number,
    name: species.name,
    furigana: species.sourceFurigana,
    base: species.base,
    growPattern: species.growPattern,
    tribeClass: species.tribeClass,
    ivAAllowed: species.ivAAllowed,
  };
}

export function calculateStatsTool(args: unknown): CalculateStatsToolResult {
  const input = asRecord(args, "arguments");
  const speciesId = stringValue(input, "speciesId");
  const species = getYokaiSpecies(speciesId);
  const level = integerValue(input, "level", { min: 1, max: 99 });
  const ivA = statBlockValue(input.ivA, "ivA");
  const ivB1 = statBlockValue(input.ivB1, "ivB1");
  const ivB2 = statBlockValue(input.ivB2, "ivB2");
  const personalityMode = personalityModeValue(input);
  const personalityBonus = optionalStatBlock(input, "personalityBonus");

  for (const stat of STAT_KEYS) {
    const max = ivAMaxForSpeciesStat(species, stat);
    if (ivA[stat] > max) {
      throw new RangeError("ivA." + stat + " exceeds the allowed maximum " + max + " for " + species.name);
    }
    if (ivB1[stat] > 10) {
      throw new RangeError("ivB1." + stat + " must be <= 10");
    }
  }

  const b1Total = STAT_KEYS.reduce((sum, stat) => sum + ivB1[stat], 0);
  if (b1Total !== 10) {
    throw new RangeError("IV_B_1 must total exactly 10; received " + b1Total);
  }

  const normalized: CalculateStatsToolInput = {
    speciesId,
    level,
    ivA,
    ivB1,
    ivB2,
    personalityMode,
    ...(personalityBonus ? { personalityBonus } : {}),
  };

  return {
    species: speciesSummary(speciesId),
    input: normalized,
    stats: calculateStatBlock(normalized),
    formulaStatus: togenyanPortedEngine.formulaStatus,
  };
}

export function reverseIvTool(args: unknown): ReverseIvToolResult {
  const input = asRecord(args, "arguments");
  const speciesId = stringValue(input, "speciesId");
  getYokaiSpecies(speciesId);
  const level = integerValue(input, "level", { min: 1, max: 99 });
  const observed = statBlockValue(input.observed, "observed", 1);
  const personalityMode = personalityModeValue(input);
  const personalityBonus = optionalStatBlock(input, "personalityBonus");
  const evolutionCount = evolutionCountValue(input);
  const scorePreset = scorePresetValue(input);
  const customScoreWeights = optionalStatBlock(input, "customScoreWeights");
  const maxResults = integerValue(input, "maxResults", { min: 1, max: 100, fallback: 20 });

  if (scorePreset === "custom" && !customScoreWeights) {
    throw new TypeError("customScoreWeights is required when scorePreset is 'custom'");
  }

  const normalized: SearchInput = {
    speciesId,
    level,
    observed,
    personalityMode,
    evolutionCount,
    scorePreset,
    maxResults,
    ...(personalityBonus ? { personalityBonus } : {}),
    ...(customScoreWeights ? { customScoreWeights } : {}),
  };

  return {
    species: speciesSummary(speciesId),
    input: normalized,
    response: reverseSearch(normalized),
  };
}

export function executeAgentTool(name: string, args: unknown): unknown {
  switch (name) {
    case "search_yokai":
      return searchYokaiTool(args);
    case "get_yokai":
      return getYokaiTool(args);
    case "calculate_stats":
      return calculateStatsTool(args);
    case "reverse_iv":
      return reverseIvTool(args);
    default:
      throw new RangeError("Unknown tool: " + name);
  }
}
