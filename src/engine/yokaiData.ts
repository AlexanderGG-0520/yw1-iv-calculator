import { STAT_KEYS, type StatBlock, type StatKey, type YokaiSpecies } from "./types";

/*
  Yo-kai base data below is ported from:

  Status Calculator for Yokai Watch
  Copyright 2015 IVC ◆HePDgfYKMA
  Released under the conditions of the MIT License
  http://opensource.org/licenses/mit-license.php

  Source inspected: https://togenyanweb.appspot.com/Yokai/yw1/js/calc.js
*/

const classIvAAllowed: Record<number, boolean[]> = {
  0: [false, false, false, false, false],
  1: [false, true, false, false, false],
  2: [false, false, true, false, false],
  3: [false, false, false, true, false],
  4: [false, false, false, false, true],
  5: [false, false, true, true, false],
  6: [true, false, false, false, true],
  7: [false, true, true, false, false],
  8: [true, false, false, false, false],
};

function statBlock(values: [number, number, number, number, number]): StatBlock {
  return {
    hp: values[0],
    strength: values[1],
    spirit: values[2],
    defense: values[3],
    speed: values[4],
  };
}

function ivAAllowedForClass(tribeClass: number): Record<StatKey, boolean> {
  const allowed = classIvAAllowed[tribeClass] ?? classIvAAllowed[0];
  return Object.fromEntries(STAT_KEYS.map((stat, index) => [stat, allowed[index]])) as Record<StatKey, boolean>;
}

function sourceSpecies(
  id: string,
  number: number,
  name: string,
  base: [number, number, number, number, number],
  growPattern: [number, number, number, number, number],
  tribeClass: number,
): YokaiSpecies {
  return {
    id,
    name,
    sourceName: name,
    number,
    base: statBlock(base),
    growPattern: statBlock(growPattern),
    tribeClass,
    ivAAllowed: ivAAllowedForClass(tribeClass),
  };
}

export const YOKAI: YokaiSpecies[] = [
  sourceSpecies("kusanagi", 18, "くさなぎ", [33, 44, 25, 27, 42], [2, 1, 0, 3, 2], 1),
  sourceSpecies("jibanyan", 93, "ジバニャン", [30, 20, 19, 24, 35], [0, 2, 3, 0, 2], 4),
  sourceSpecies("komasan", 99, "コマさん", [25, 22, 30, 23, 27], [2, 3, 2, 0, 2], 4),
  sourceSpecies("shishikoma", 100, "ししコマ", [35, 26, 39, 23, 36], [2, 3, 2, 0, 2], 4),
  sourceSpecies("komajiro", 101, "コマじろう", [25, 26, 27, 24, 25], [2, 0, 0, 0, 2], 4),
  sourceSpecies("torajiro", 102, "とらじろう", [31, 30, 34, 24, 33], [2, 0, 0, 0, 2], 4),
  sourceSpecies("buchinyan", 214, "ブシニャン", [31, 39, 27, 23, 50], [2, 2, 0, 0, 1], 1),
  sourceSpecies("yamabukioni", 218, "山吹鬼", [45, 50, 18, 35, 40], [1, 1, 0, 0, 0], 3),
];

export function getYokaiSpecies(speciesId: string): YokaiSpecies {
  const species = YOKAI.find((candidate) => candidate.id === speciesId);
  if (!species) {
    throw new Error(`Unknown Yo-kai species: ${speciesId}`);
  }
  return species;
}
