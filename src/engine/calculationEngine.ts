import type { StatCalculationEngine, StatCalculationInput } from "./types";

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
    "TODO: Yo-kai Watch 1 stat formula is not verified. This swappable engine is for validating reverse-search architecture only.",
  calculate(input: StatCalculationInput): number {
    const { species, stat, level, ivA, ivB1, ivB2, personalityMode } = input;
    const base = species.base[stat];
    const growth = species.levelGrowth[stat] * Math.max(0, level - 1);
    const ivContribution = Math.floor(ivA / 4) + ivB1 + ivB2;
    const multiplier = personalityMultiplier[personalityMode]?.[stat] ?? 1;

    // TODO: Replace with the verified Yo-kai Watch 1 stat formula.
    return Math.floor((base + growth + ivContribution) * multiplier);
  },
};
