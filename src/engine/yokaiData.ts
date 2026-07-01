import type { YokaiSpecies } from "./types";

export const YOKAI: YokaiSpecies[] = [
  {
    id: "jibanyan",
    name: "Jibanyan",
    base: { hp: 42, strength: 25, spirit: 18, defense: 18, speed: 24 },
    levelGrowth: { hp: 3, strength: 2, spirit: 1, defense: 1, speed: 2 },
  },
  {
    id: "komasan",
    name: "Komasan",
    base: { hp: 38, strength: 16, spirit: 27, defense: 20, speed: 22 },
    levelGrowth: { hp: 3, strength: 1, spirit: 2, defense: 2, speed: 2 },
  },
  {
    id: "roughraff",
    name: "Roughraff",
    base: { hp: 45, strength: 28, spirit: 13, defense: 22, speed: 18 },
    levelGrowth: { hp: 3, strength: 2, spirit: 1, defense: 2, speed: 1 },
  },
];

export function getYokaiSpecies(speciesId: string): YokaiSpecies {
  const species = YOKAI.find((candidate) => candidate.id === speciesId);
  if (!species) {
    throw new Error(`Unknown Yo-kai species: ${speciesId}`);
  }
  return species;
}
