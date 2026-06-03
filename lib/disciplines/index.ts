import type { DisciplineId, DisciplinePack } from "./types";
import { FINANCE } from "./finance";
import { MARKETING } from "./marketing";
import { SOCIAL_WORK } from "./social-work";

export const DISCIPLINE_PACKS: Record<DisciplineId, DisciplinePack> = {
  finance: FINANCE,
  marketing: MARKETING,
  social_work: SOCIAL_WORK,
};

export const DISCIPLINE_IDS: DisciplineId[] = ["finance", "marketing", "social_work"];

export function getDisciplinePack(id: DisciplineId): DisciplinePack {
  return DISCIPLINE_PACKS[id];
}

export * from "./types";
