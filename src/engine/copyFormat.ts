import { STAT_KEYS, type PersonalityMode, type ReverseResult, type StatBlock, type YokaiSpecies } from "./types";

const statOrderLabel = ["HP", "ちから", "ようりょく", "まもり", "すばやさ"];

export function formatStatLine(block: StatBlock): string {
  return STAT_KEYS.map((stat) => block[stat]).join(" / ");
}

export function formatPersonalityLabel(mode: PersonalityMode, customBonus?: StatBlock): string {
  if (!customBonus) {
    return mode;
  }
  return `Custom (${statOrderLabel.map((label, index) => `${label}:${customBonus[STAT_KEYS[index]]}`).join(", ")})`;
}

export function formatCandidateText({
  species,
  level,
  personalityMode,
  personalityBonus,
  result,
}: {
  species: YokaiSpecies;
  level: number;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
  result: ReverseResult;
}): string {
  return [
    `妖怪: ${species.name}`,
    `Lv: ${level}`,
    `性格ボーナス: ${formatPersonalityLabel(personalityMode, personalityBonus)}`,
    `IV_A: ${formatStatLine(result.ivA)}`,
    `B_1: ${formatStatLine(result.ivB1)}`,
    `B_2: ${formatStatLine(result.ivB2)}`,
    `計算結果: ${formatStatLine(result.calculated)}`,
  ].join("\n");
}

export function formatCandidateJson({
  species,
  level,
  personalityMode,
  personalityBonus,
  result,
}: {
  species: YokaiSpecies;
  level: number;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
  result: ReverseResult;
}): string {
  return JSON.stringify(
    {
      yokai: species.name,
      speciesId: species.id,
      level,
      personalityMode,
      personalityBonus,
      score: result.score,
      ivA: result.ivA,
      b1: result.ivB1,
      b2: result.ivB2,
      calculated: result.calculated,
    },
    null,
    2,
  );
}
