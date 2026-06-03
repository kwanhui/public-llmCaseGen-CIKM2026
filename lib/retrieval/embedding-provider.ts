import { embed } from "ai";
import { getEmbeddingModel, EMBEDDING_MODEL_ID } from "@/lib/llm/client";
import { getDisciplinePack } from "@/lib/disciplines";
import type { CaseInput } from "@/lib/disciplines/types";
import { corpusForDiscipline, type CorpusChunk } from "./corpus";
import embeddingStore from "./corpus/embeddings.json";
import { buildPackGrounding } from "./prompt-pack-provider";
import type { RetrievalProvider, RetrievalResult } from "./provider";

type EmbeddingStore = {
  model: string;
  dimensions: number;
  generatedAt: string | null;
  vectors: Record<string, number[]>;
};

const STORE = embeddingStore as EmbeddingStore;

export interface RetrievedChunk {
  chunk: CorpusChunk;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// The text we embed to find relevant passages: the case specification, not the
// generated case (which does not exist yet at retrieval time).
export function buildQueryText(input: CaseInput): string {
  return [
    `Discipline: ${getDisciplinePack(input.discipline).label}`,
    `Learning objective: ${input.learningObjective}`,
    `Difficulty: ${input.difficulty}`,
    `Must-cover concepts: ${input.mustCoverConcepts.join(", ")}`,
    `Learner context: ${input.targetLearnerProfile.industry}, ${input.targetLearnerProfile.role}`,
  ].join("\n");
}

// Only passages at least this similar to the query are eligible, so a case
// spec that matches nothing well does not drag in irrelevant grounding.
const RETRIEVAL_MIN_SCORE = Number(process.env.RETRIEVAL_MIN_SCORE ?? 0.25);
// At most this many case-design (pedagogy) notes in the grounding; the rest of
// the budget goes to domain-concept passages, so retrieval stays domain-led
// rather than returning a near-uniform slice of the corpus.
const MAX_PEDAGOGY = 1;

function isCaseDesignNote(id: string): boolean {
  return id.includes("pedagogy");
}

export function topK(
  queryVector: number[],
  discipline: CaseInput["discipline"],
  k: number,
): RetrievedChunk[] {
  const ranked = corpusForDiscipline(discipline)
    .map((chunk) => {
      const vec = STORE.vectors[chunk.id];
      // Skip a chunk whose stored vector is missing or a different dimension
      // than the query (e.g. EMBEDDING_MODEL changed without re-embedding):
      // scoring across mismatched dimensions would produce meaningless ranks.
      if (!vec || vec.length !== queryVector.length) return null;
      return { chunk, score: cosineSimilarity(queryVector, vec) };
    })
    .filter((x): x is RetrievedChunk => x !== null && x.score >= RETRIEVAL_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  // Domain concepts first; allow at most MAX_PEDAGOGY case-design notes.
  const concepts = ranked.filter((r) => !isCaseDesignNote(r.chunk.id));
  const pedagogy = ranked.filter((r) => isCaseDesignNote(r.chunk.id)).slice(0, MAX_PEDAGOGY);
  return [...concepts, ...pedagogy]
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function isCorpusEmbedded(): boolean {
  return Object.keys(STORE.vectors).length > 0;
}

export interface RetrievalPreview {
  chunks: RetrievedChunk[];
  embedded: boolean;
}

// Structured retrieval for the authoring UI: returns the ranked chunks (with
// scores) so the instructor can see exactly what grounds the next generation.
// Degrades to an empty, embedded:false result when the corpus has not been
// embedded or the embedding call fails (e.g. missing key) rather than throwing.
export async function retrievePreview(
  input: CaseInput,
  k = Number(process.env.RETRIEVAL_TOP_K ?? 5),
): Promise<RetrievalPreview> {
  if (!isCorpusEmbedded()) return { chunks: [], embedded: false };
  try {
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: buildQueryText(input),
    });
    return { chunks: topK(embedding, input.discipline, k), embedded: true };
  } catch {
    return { chunks: [], embedded: false };
  }
}

// Dense-retrieval grounding: embeds the case spec, ranks the discipline corpus
// by cosine similarity, and conditions generation on the top-k passages. Falls
// back to pack-only grounding if the corpus has not been embedded.
export class EmbeddingRetrievalProvider implements RetrievalProvider {
  constructor(private readonly k = Number(process.env.RETRIEVAL_TOP_K ?? 5)) {}

  async retrieve(input: CaseInput): Promise<RetrievalResult> {
    const pack = getDisciplinePack(input.discipline);
    const packGrounding = buildPackGrounding(pack, input.difficulty);

    if (!isCorpusEmbedded()) {
      return {
        groundingText: packGrounding,
        exemplars: pack.fewShots,
        provenance: [`discipline-pack:${pack.id}`, "retrieval:corpus-not-embedded"],
      };
    }

    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: buildQueryText(input),
    });
    const hits = topK(embedding, input.discipline, this.k);

    const retrievedBlock = [
      ``,
      `## Retrieved discipline references (most relevant to this case)`,
      `Use these to keep the case technically accurate; do not quote them verbatim.`,
      ...hits.map((h) => `### ${h.chunk.title}\n${h.chunk.text}`),
    ].join("\n");

    return {
      groundingText: packGrounding + "\n" + retrievedBlock,
      exemplars: pack.fewShots,
      provenance: [
        `embedding:${EMBEDDING_MODEL_ID}`,
        ...hits.map((h) => `corpus:${h.chunk.id} (${h.score.toFixed(3)})`),
      ],
    };
  }
}

export const embeddingRetrieval = new EmbeddingRetrievalProvider();
