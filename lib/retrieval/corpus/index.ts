import type { DisciplineId } from "@/lib/disciplines/types";
import type { CorpusChunk } from "./types";
import { FINANCE_CORPUS } from "./finance";
import { MARKETING_CORPUS } from "./marketing";
import { SOCIAL_WORK_CORPUS } from "./social-work";

export type { CorpusChunk } from "./types";

export const CORPUS: CorpusChunk[] = [
  ...FINANCE_CORPUS,
  ...MARKETING_CORPUS,
  ...SOCIAL_WORK_CORPUS,
];

export function corpusForDiscipline(discipline: DisciplineId): CorpusChunk[] {
  return CORPUS.filter((c) => c.discipline === discipline);
}

export function corpusChunkById(id: string): CorpusChunk | undefined {
  return CORPUS.find((c) => c.id === id);
}
