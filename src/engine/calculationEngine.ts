import { ivAValuesForSpeciesStat } from "./ivA";
import type { PersonalityMode, StatBlock, StatCalculationEngine, StatCalculationInput, StatKey, YokaiSpecies } from "./types";

/*
  Formula ported from:

  Status Calculator for Yokai Watch
  Copyright 2015 IVC ◆HePDgfYKMA
  Released under the conditions of the MIT License
  http://opensource.org/licenses/mit-license.php

  Source inspected: https://togenyanweb.appspot.com/Yokai/yw1/js/calc.js
*/

export const sourceCharacteristicBonus: Record<PersonalityMode, StatBlock> = {
  none: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
  short_tempered: { hp: 10, strength: 10, spirit: 0, defense: 0, speed: 0 },
  physical_attacker: { hp: 0, strength: 20, spirit: 0, defense: 0, speed: 0 },
  calm: { hp: 0, strength: 0, spirit: 10, defense: 0, speed: 10 },
  magic_attacker: { hp: 0, strength: 0, spirit: 20, defense: 0, speed: 0 },
  careful: { hp: 0, strength: 0, spirit: 10, defense: 10, speed: 0 },
  wall: { hp: 0, strength: 0, spirit: 0, defense: 20, speed: 0 },
  kind: { hp: 10, strength: 0, spirit: 10, defense: 0, speed: 0 },
  compassionate: { hp: 20, strength: 0, spirit: 0, defense: 0, speed: 0 },
  nasty: { hp: 0, strength: 10, spirit: 0, defense: 0, speed: 10 },
  speed: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 20 },
  cooperative: { hp: 10, strength: 0, spirit: 0, defense: 0, speed: 10 },
  devoted: { hp: 0, strength: 10, spirit: 0, defense: 10, speed: 0 },
};

function sourceFloatTable(): Float32Array {
  const floats = new Float32Array(24);
  floats[0] = 1.0;
  floats[1] = 9604.0;
  floats[2] = 0.449999988079071044921875;
  floats[3] = 0.25;
  floats[4] = 0.010204081423580646514892578125;
  floats[5] = 98.0;
  floats[6] = 0.100000001490116119384765625;
  floats[7] = 99.0;
  floats[8] = 0.5;
  floats[9] = 0.0050505050458014011383056640625;
  floats[10] = 0.0500000007450580596923828125;
  return floats;
}

function calculateTogenyanStatus({
  growPattern,
  baseStat,
  ivA,
  ivB1,
  ivB2,
  characteristicBonus,
  level,
  isHp,
}: {
  growPattern: number;
  baseStat: number;
  ivA: number;
  ivB1: number;
  ivB2: number;
  characteristicBonus: number;
  level: number;
  isHp: boolean;
}): number {
  const floats = sourceFloatTable();
  const bs = baseStat;
  const cb = characteristicBonus;

  floats[11] = level;
  floats[11] = floats[11] * floats[9];
  floats[11] = floats[11] + floats[0];
  floats[11] = floats[11] * cb;
  floats[23] = floats[11];
  floats[11] = bs + ivA + ivB1;
  if (isHp) {
    floats[23] = floats[23] + floats[11];
  } else {
    floats[23] = floats[23] + bs * floats[6];
  }
  floats[11] = floats[11] + ivB2;
  if (isHp) {
    floats[11] = floats[11] * floats[6];
  } else {
    floats[11] = floats[11] * floats[10];
  }
  if (growPattern === 0) {
    floats[11] = floats[11] * level;
    floats[23] = floats[23] + floats[11];
  } else if (growPattern === 1) {
    floats[12] = level - floats[0];
    floats[12] = floats[5] - floats[12];
    floats[13] =
      floats[7] -
      (floats[12] * floats[12] * floats[12] * floats[8]) / floats[1] -
      floats[12] * floats[12] * floats[3] * floats[4] -
      floats[12] * floats[3];
    floats[11] = floats[11] * floats[13];
    floats[23] = floats[23] + floats[11];
  } else if (growPattern === 2) {
    floats[12] = level - floats[0];
    floats[12] = floats[5] - floats[12];
    floats[13] =
      floats[7] -
      (floats[12] * floats[12] * floats[12] * floats[6]) / floats[1] -
      floats[12] * floats[12] * floats[2] * floats[4] -
      floats[12] * floats[2];
    floats[11] = floats[11] * floats[13];
    floats[23] = floats[23] + floats[11];
  } else if (growPattern === 3) {
    floats[12] = level - floats[0];
    floats[13] =
      floats[0] +
      (floats[12] * floats[12] * floats[12] * floats[6]) / floats[1] +
      floats[12] * floats[12] * floats[2] * floats[4] +
      floats[12] * floats[2];
    floats[11] = floats[11] * floats[13];
    floats[23] = floats[23] + floats[11];
  } else if (growPattern === 4) {
    floats[12] = level - floats[0];
    floats[13] =
      floats[0] +
      (floats[12] * floats[12] * floats[12] * floats[8]) / floats[1] +
      floats[12] * floats[12] * floats[3] * floats[4] +
      floats[12] * floats[3];
    floats[11] = floats[11] * floats[13];
    floats[23] = floats[23] + floats[11];
  } else if (growPattern === 5) {
    floats[23] = bs;
  } else {
    return 0;
  }
  return Math.floor(floats[23]);
}

export const togenyanPortedEngine: StatCalculationEngine = {
  id: "togenyan-ported",
  label: "とげにゃんWeb port",
  formulaStatus: "ported from togenyan source: formula and full species data are MIT-attributed; no independent in-game fixture verification yet",
  formulaStatusKind: "ported_from_togenyan_source",
  calculate(input: StatCalculationInput): number {
    const { species, stat, level, ivA, ivB1, ivB2, personalityMode } = input;
    const growPattern = species.growPattern[stat];
    const baseStat = species.base[stat];
    const characteristicBonus = (input.personalityBonus ?? sourceCharacteristicBonus[personalityMode])[stat];

    return calculateTogenyanStatus({
      growPattern,
      baseStat,
      ivA,
      ivB1,
      ivB2,
      characteristicBonus,
      level,
      isHp: stat === "hp",
    });
  },
  ivAValuesForStat(species: YokaiSpecies, stat: StatKey): Iterable<number> {
    return ivAValuesForSpeciesStat(species, stat);
  },
};

const personalityMultiplier: Record<string, Partial<Record<string, number>>> = {
  none: {},
  physical_attacker: { strength: 1.05 },
  magic_attacker: { spirit: 1.05 },
  wall: { hp: 1.03, defense: 1.05 },
  speed: { speed: 1.05 },
};

export const provisionalLinearEngine: StatCalculationEngine = {
  id: "provisional-linear",
  label: "Provisional linear engine",
  formulaStatus:
    "provisional: Yo-kai Watch 1 stat formula is not verified; this engine is for validating reverse-search architecture only",
  formulaStatusKind: "provisional",
  calculate(input: StatCalculationInput): number {
    const { species, stat, level, ivA, ivB1, ivB2, personalityMode } = input;
    const base = species.base[stat];
    const growth = (species.levelGrowth?.[stat] ?? 1) * Math.max(0, level - 1);
    const ivContribution = Math.floor(ivA / 4) + ivB1 + ivB2;
    const multiplier = input.personalityBonus ? 1 + input.personalityBonus[stat] / 400 : (personalityMultiplier[personalityMode]?.[stat] ?? 1);

    return Math.floor((base + growth + ivContribution) * multiplier);
  },
};
