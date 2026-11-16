import type { BoardSpec } from "../types/simulator";
import { fig01 } from "./boards/fig01";
import { fig02 } from "./boards/fig02";
import { fig03 } from "./boards/fig03";
import { fig04 } from "./boards/fig04";
import { fig05 } from "./boards/fig05";
import { fig06 } from "./boards/fig06";
import { fig07 } from "./boards/fig07";
import { fig08 } from "./boards/fig08";
import { fig09 } from "./boards/fig09";
import { fig10 } from "./boards/fig10";
import { fig11 } from "./boards/fig11";
import { fig12 } from "./boards/fig12";
import { fig13 } from "./boards/fig13";

export const PCB_T = 0.16;

export const COLORS: Record<string, string> = {
  Blue: "#1f6fb2",
  Red: "#b8322a",
  Green: "#2f7d46",
  Black: "#1d1d1d",
  White: "#e9e9e4",
};

export const BOARD_SPECS: BoardSpec[] = [
  fig01,
  fig02,
  fig03,
  fig04,
  fig05,
  fig06,
  fig07,
  fig08,
  fig09,
  fig10,
  fig11,
  fig12,
  fig13,
];

export const BOARDS: [string, string][] = BOARD_SPECS.map((b) => [
  b.name,
  b.subtitle,
]);

export {
  fig01,
  fig02,
  fig03,
  fig04,
  fig05,
  fig06,
  fig07,
  fig08,
  fig09,
  fig10,
  fig11,
  fig12,
  fig13,
};
