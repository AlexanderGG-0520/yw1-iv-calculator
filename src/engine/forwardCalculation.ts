import { togenyanPortedEngine } from "./calculationEngine";
import { STAT_KEYS, type PersonalityMode, type StatBlock, type StatCalculationEngine } from "./types";
import { getYokaiSpecies } from "./yokaiData";

export interface CalculateStatBlockInput {
  speciesId: string;
  level: number;
  ivA: StatBlock;
  ivB1: StatBlock;
  ivB2: StatBlock;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
}

export function calculateStatBlock(
  input: CalculateStatBlockInput,
  engine: StatCalculationEngine = togenyanPortedEngine,
): StatBlock {
  const species = getYokaiSpecies(input.speciesId);

  return Object.fromEntries(
    STAT_KEYS.map((stat) => [
      stat,
      engine.calculate({
        species,
        stat,
        level: input.level,
        ivA: input.ivA[stat],
        ivB1: input.ivB1[stat],
        ivB2: input.ivB2[stat],
        personalityMode: input.personalityMode,
        personalityBonus: input.personalityBonus,
      }),
    ]),
  ) as StatBlock;
}
