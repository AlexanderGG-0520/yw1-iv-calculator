import { STAT_KEYS, type StatKey, type YokaiSpecies } from "./types";

// Empirical Yo-kai Watch 1 research consistently places IV_A at a maximum of
// 8 for tribes/classes with one IV_A stat and 4 per stat for classes with two.
// The exact generation distribution/minimum is less certain, so 0 remains a
// valid candidate instead of inventing a stricter lower bound.
export function ivAMaxForSpeciesStat(species: YokaiSpecies, stat: StatKey): number {
  const allowed = species.ivAAllowed;
  if (!allowed || allowed[stat] !== true) {
    return 0;
  }

  const allowedCount = STAT_KEYS.filter((key) => allowed[key] === true).length;
  return allowedCount >= 2 ? 4 : 8;
}

export function ivAValuesForSpeciesStat(species: YokaiSpecies, stat: StatKey): number[] {
  const max = ivAMaxForSpeciesStat(species, stat);
  return Array.from({ length: max + 1 }, (_, index) => index);
}
