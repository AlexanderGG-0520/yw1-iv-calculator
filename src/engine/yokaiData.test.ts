import { describe, expect, it } from "vitest";
import { SOURCE_YOKAI_DATA_LENGTH, YOKAI, getYokaiSpecies } from "./yokaiData";

const importantYokai = [
  {
    id: "kusanagi",
    number: 18,
    name: "くさなぎ",
    base: { hp: 33, strength: 44, spirit: 25, defense: 27, speed: 42 },
    growPattern: { hp: 2, strength: 1, spirit: 0, defense: 3, speed: 2 },
    tribeClass: 1,
  },
  {
    id: "buchinyan",
    number: 214,
    name: "ブシニャン",
    base: { hp: 31, strength: 39, spirit: 27, defense: 23, speed: 50 },
    growPattern: { hp: 2, strength: 2, spirit: 0, defense: 0, speed: 1 },
    tribeClass: 1,
  },
  {
    id: "yamabukioni",
    number: 218,
    name: "山吹鬼",
    base: { hp: 45, strength: 50, spirit: 18, defense: 35, speed: 40 },
    growPattern: { hp: 1, strength: 1, spirit: 0, defense: 0, speed: 0 },
    tribeClass: 3,
  },
  {
    id: "shishikoma",
    number: 100,
    name: "ししコマ",
    base: { hp: 35, strength: 26, spirit: 39, defense: 23, speed: 36 },
    growPattern: { hp: 2, strength: 3, spirit: 2, defense: 0, speed: 2 },
    tribeClass: 4,
  },
  {
    id: "torajiro",
    number: 102,
    name: "とらじろう",
    base: { hp: 31, strength: 30, spirit: 34, defense: 24, speed: 33 },
    growPattern: { hp: 2, strength: 0, spirit: 0, defense: 0, speed: 2 },
    tribeClass: 4,
  },
  {
    id: "jibanyan",
    number: 93,
    name: "ジバニャン",
    base: { hp: 30, strength: 20, spirit: 19, defense: 24, speed: 35 },
    growPattern: { hp: 0, strength: 2, spirit: 3, defense: 0, speed: 2 },
    tribeClass: 4,
  },
  {
    id: "komasan",
    number: 99,
    name: "コマさん",
    base: { hp: 25, strength: 22, spirit: 30, defense: 23, speed: 27 },
    growPattern: { hp: 2, strength: 3, spirit: 2, defense: 0, speed: 2 },
    tribeClass: 4,
  },
  {
    id: "komajiro",
    number: 101,
    name: "コマじろう",
    base: { hp: 25, strength: 26, spirit: 27, defense: 24, speed: 25 },
    growPattern: { hp: 2, strength: 0, spirit: 0, defense: 0, speed: 2 },
    tribeClass: 4,
  },
];

describe("Yo-kai source data", () => {
  it("ports more than the MVP subset", () => {
    expect(YOKAI.length).toBeGreaterThan(8);
  });

  it("matches the source yokaiData row count", () => {
    expect(YOKAI).toHaveLength(SOURCE_YOKAI_DATA_LENGTH);
    expect(SOURCE_YOKAI_DATA_LENGTH).toBe(245);
  });

  it("keeps stable unique ASCII ids", () => {
    const ids = YOKAI.map((species) => species.id);

    expect(new Set(ids)).toHaveProperty("size", YOKAI.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("keeps the important Yo-kai present with source-derived values", () => {
    for (const expected of importantYokai) {
      const species = getYokaiSpecies(expected.id);

      expect(species.name).toBe(expected.name);
      expect(species.sourceName).toBe(expected.name);
      expect(species.number).toBe(expected.number);
      expect(species.base).toEqual(expected.base);
      expect(species.growPattern).toEqual(expected.growPattern);
      expect(species.tribeClass).toBe(expected.tribeClass);
    }
  });
});
