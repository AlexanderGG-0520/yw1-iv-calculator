import { describe, expect, it } from "vitest";
import { sourceCharacteristicBonus, togenyanPortedEngine } from "./calculationEngine";
import { STAT_KEYS, type PersonalityMode, type StatBlock } from "./types";
import { getYokaiSpecies } from "./yokaiData";

function calculateBlock({
  speciesId,
  level,
  ivA,
  ivB1,
  ivB2,
  personalityMode,
  personalityBonus,
}: {
  speciesId: string;
  level: number;
  ivA: StatBlock;
  ivB1: StatBlock;
  ivB2: StatBlock;
  personalityMode: PersonalityMode;
  personalityBonus?: StatBlock;
}): StatBlock {
  const species = getYokaiSpecies(speciesId);
  return Object.fromEntries(
    STAT_KEYS.map((stat) => [
      stat,
      togenyanPortedEngine.calculate({
        species,
        stat,
        level,
        ivA: ivA[stat],
        ivB1: ivB1[stat],
        ivB2: ivB2[stat],
        personalityMode,
        personalityBonus,
      }),
    ]),
  ) as StatBlock;
}

describe("togenyan ported engine", () => {
  it("matches source-derived Jibanyan level 99 values with no IVs or personality bonus", () => {
    expect(
      calculateBlock({
        speciesId: "jibanyan",
        level: 99,
        ivA: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
        ivB1: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
        ivB2: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
        personalityMode: "none",
      }),
    ).toEqual({ hp: 327, strength: 101, spirit: 95, defense: 121, speed: 176 });
  });

  it("matches source-derived level 99 values with IV_A, IV_B_1, and personality bonus", () => {
    expect(
      calculateBlock({
        speciesId: "jibanyan",
        level: 99,
        ivA: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 31 },
        ivB1: { hp: 1, strength: 2, spirit: 3, defense: 1, speed: 3 },
        ivB2: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
        personalityMode: "physical_attacker",
      }),
    ).toEqual({ hp: 337, strength: 140, spirit: 110, defense: 126, speed: 345 });
  });

  it("keeps cooperative and devoted training bonuses distinct", () => {
    expect(sourceCharacteristicBonus.cooperative).toEqual({ hp: 10, strength: 0, spirit: 0, defense: 0, speed: 10 });
    expect(sourceCharacteristicBonus.devoted).toEqual({ hp: 0, strength: 10, spirit: 0, defense: 10, speed: 0 });
  });

  it("keeps preset personality behavior unchanged when no custom bonus is passed", () => {
    const fixture = {
      speciesId: "jibanyan",
      level: 50,
      ivA: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 31 },
      ivB1: { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 },
      ivB2: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
      personalityMode: "physical_attacker" as PersonalityMode,
    };

    expect(calculateBlock(fixture)).toEqual(calculateBlock({ ...fixture, personalityBonus: undefined }));
  });

  it("uses custom personality bonus values instead of preset values", () => {
    const withoutBonus = calculateBlock({
      speciesId: "jibanyan",
      level: 20,
      ivA: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
      ivB1: { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 },
      ivB2: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
      personalityMode: "none",
    });
    const withCustomBonus = calculateBlock({
      speciesId: "jibanyan",
      level: 20,
      ivA: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
      ivB1: { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 },
      ivB2: { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 },
      personalityMode: "none",
      personalityBonus: { hp: 20, strength: 0, spirit: 0, defense: 0, speed: 0 },
    });

    expect(withCustomBonus.hp).toBeGreaterThan(withoutBonus.hp);
    expect(withCustomBonus.strength).toBe(withoutBonus.strength);
    expect(withCustomBonus.spirit).toBe(withoutBonus.spirit);
    expect(withCustomBonus.defense).toBe(withoutBonus.defense);
    expect(withCustomBonus.speed).toBe(withoutBonus.speed);
  });

  it("matches a source-derived mixed level 50 fixture", () => {
    expect(
      calculateBlock({
        speciesId: "yamabukioni",
        level: 50,
        ivA: { hp: 0, strength: 0, spirit: 0, defense: 17, speed: 0 },
        ivB1: { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 },
        ivB2: { hp: 1, strength: 2, spirit: 3, defense: 1, speed: 2 },
        personalityMode: "wall",
      }),
    ).toEqual({ hp: 404, strength: 206, spirit: 59, defense: 166, speed: 114 });
  });

  it("uses the HP-specific formula branch", () => {
    const species = getYokaiSpecies("jibanyan");
    const hp = togenyanPortedEngine.calculate({
      species,
      stat: "hp",
      level: 10,
      ivA: 0,
      ivB1: 0,
      ivB2: 0,
      personalityMode: "none",
    });
    const defense = togenyanPortedEngine.calculate({
      species,
      stat: "defense",
      level: 10,
      ivA: 0,
      ivB1: 0,
      ivB2: 0,
      personalityMode: "none",
    });

    expect(hp).toBe(60);
    expect(defense).toBe(14);
  });

  it("limits IV_A candidates to the researched source class bounds", () => {
    const jibanyan = getYokaiSpecies("jibanyan");

    expect([...togenyanPortedEngine.ivAValuesForStat!(jibanyan, "hp")]).toEqual([0]);
    expect([...togenyanPortedEngine.ivAValuesForStat!(jibanyan, "speed")]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
