import { generateObject } from "ai";
import { getGenerationModel } from "@/lib/llm/client";
import { getDisciplinePack } from "@/lib/disciplines";
import { getRetrievalProvider } from "@/lib/retrieval";
import { corpusChunkById } from "@/lib/retrieval/corpus";
import type { CaseInput, FewShotExemplar } from "@/lib/disciplines/types";
import { GenerationOutputSchema, type GenerationOutput, type CaseTextFields } from "./schema";

function formatExemplar(ex: FewShotExemplar, index: number): string {
  return [
    `### Exemplar ${index + 1}: ${ex.title}`,
    ``,
    `**Scenario:** ${ex.scenario}`,
    ``,
    `**Discussion questions:**`,
    ...ex.discussionQuestions.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `**Rubric:** ${ex.rubric}`,
  ].join("\n");
}

export function buildUserPrompt(
  input: CaseInput,
  groundingText: string,
  exemplars: FewShotExemplar[],
): string {
  const profile = input.targetLearnerProfile;
  return [
    `# Case authoring task`,
    ``,
    `**Learning objective:** ${input.learningObjective}`,
    `**Difficulty:** ${input.difficulty}`,
    `**Must-cover concepts:** ${input.mustCoverConcepts.join(", ") || "(none specified)"}`,
    ``,
    `**Target learner profile**`,
    `- Industry / practice context: ${profile.industry}`,
    `- Role: ${profile.role}`,
    `- Prior knowledge: ${profile.priorKnowledge}`,
    ``,
    `## Discipline grounding`,
    groundingText,
    ``,
    `## Reference exemplars (for style and depth, not content)`,
    exemplars.map(formatExemplar).join("\n\n"),
    ``,
    `Now author a fresh case following the structured output schema. Do not reuse content from the exemplars verbatim.`,
  ].join("\n");
}

export interface GenerateCaseResult {
  output: GenerationOutput;
  // Retrieval provenance (model id + retrieved corpus chunk ids with scores),
  // logged with the generation event for transparency and reproducibility.
  provenance: string[];
}

// Models sometimes prefix the scenario with a "Scenario:" label or number the
// discussion questions and answers, which then double up with the UI's own
// numbering. Normalise so each field holds clean content, matching the schema's
// intent and what the editor and student view render.
export function normalizeOutput<T extends Partial<GenerationOutput>>(o: T): T {
  const stripScenarioLabel = (s: string) =>
    s.replace(/^\s*\*{0,2}\s*scenario\s*:?\s*\*{0,2}\s*/i, "").trim();
  const stripEnumerator = (s: string) =>
    s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim();
  const out: Partial<GenerationOutput> = {};
  if (o.scenario !== undefined) out.scenario = stripScenarioLabel(o.scenario);
  if (o.discussionQuestions !== undefined)
    out.discussionQuestions = o.discussionQuestions.map(stripEnumerator);
  if (o.modelAnswers !== undefined) out.modelAnswers = o.modelAnswers.map(stripEnumerator);
  if (o.rubric !== undefined) out.rubric = o.rubric.trim();
  return { ...o, ...out };
}

export async function generateCase(input: CaseInput): Promise<GenerateCaseResult> {
  const pack = getDisciplinePack(input.discipline);
  const retrieval = await getRetrievalProvider().retrieve(input);
  const userPrompt = buildUserPrompt(input, retrieval.groundingText, retrieval.exemplars);

  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: GenerationOutputSchema,
    system: pack.systemPrompt,
    prompt: userPrompt,
    temperature: 0.8,
  });

  return { output: normalizeOutput(object), provenance: retrieval.provenance };
}

// How many of the retrieved passages are reflected in the generated case,
// judged by whether any of a passage's tags appears in the text. A lexical
// proxy (not semantic), logged with generation as a transparency signal that
// retrieval informed the draft rather than being decorative.
export function groundingUtilisation(
  output: CaseTextFields,
  provenance: string[],
): { used: number; total: number } {
  const haystack = [
    output.scenario,
    output.discussionQuestions.join(" "),
    output.modelAnswers.join(" "),
    output.rubric,
  ]
    .join(" ")
    .toLowerCase();
  const ids = provenance
    .filter((p) => p.startsWith("corpus:"))
    .map((p) => p.slice("corpus:".length).split(" ")[0]);
  let used = 0;
  for (const id of ids) {
    const chunk = corpusChunkById(id);
    if (!chunk) continue;
    if (chunk.tags.some((t) => haystack.includes(t.toLowerCase()))) used++;
  }
  return { used, total: ids.length };
}

// A lightweight, honest difficulty proxy for the editor. The requested
// difficulty is a prompt instruction, not a guarantee (see the paper's
// limitations), so the system computes an observable surface signal the
// instructor can sanity-check against the request: scenario length, the count
// of distinct numeric tokens (a rough stand-in for quantitative load), and the
// number of discussion questions. These map to a coarse band. This is a proxy,
// not a validated difficulty measure, and is labelled as such in the UI.
export type DifficultyBand = "lighter" | "as-requested" | "heavier";

export interface DifficultySignal {
  band: DifficultyBand;
  scenarioWords: number;
  numericTokens: number;
  questionCount: number;
  note: string;
}

export function difficultySignal(
  output: CaseTextFields,
  requested: "novice" | "intermediate" | "advanced",
): DifficultySignal {
  const scenarioWords = output.scenario.trim().split(/\s+/).filter(Boolean).length;
  const numericTokens = new Set(
    (output.scenario.match(/\d+(?:[.,]\d+)?%?/g) ?? []).map((t) => t.toLowerCase()),
  ).size;
  const questionCount = output.discussionQuestions.length;

  // A crude load score: longer scenarios with more numbers and more questions
  // read as harder. Thresholds are deliberately wide so the signal only fires
  // on clear mismatches.
  const load = scenarioWords / 100 + numericTokens + questionCount;
  const expected: Record<typeof requested, [number, number]> = {
    novice: [4, 9],
    intermediate: [7, 14],
    advanced: [11, 99],
  };
  const [lo, hi] = expected[requested];
  let band: DifficultyBand = "as-requested";
  if (load < lo) band = "lighter";
  else if (load > hi) band = "heavier";

  const note =
    band === "as-requested"
      ? `Surface load is consistent with ${requested}.`
      : `Surface load reads ${band} than ${requested} — a proxy from length, numbers, and question count, not a validated check. Review the scenario.`;
  return { band, scenarioWords, numericTokens, questionCount, note };
}

export interface ConceptCoverageReport {
  missing: string[];
  covered: string[];
}

// Post-generation lexical check (not semantic): a must-cover concept counts as
// covered if its full phrase appears, or if all of its significant words appear
// as whole words somewhere in the case. The whole-word, all-tokens rule makes
// the check tolerant of word order and intervening text (e.g. "cost of equity"
// matches "...the equity cost...") without the brittleness of a raw substring
// match. It surfaces a banner in the editor when a concept seems missing.
const COVERAGE_STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "for", "on", "with", "by", "at",
]);

function normaliseForCoverage(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkConceptCoverage(
  output: CaseTextFields,
  mustCover: string[],
): ConceptCoverageReport {
  const haystack = normaliseForCoverage(
    [
      output.scenario,
      output.discussionQuestions.join(" "),
      output.modelAnswers.join(" "),
      output.rubric,
    ].join(" "),
  );
  const padded = ` ${haystack} `;
  const hasWord = (w: string) => padded.includes(` ${w} `);

  const missing: string[] = [];
  const covered: string[] = [];
  for (const concept of mustCover) {
    const c = normaliseForCoverage(concept);
    if (!c) continue;
    const fullPhrase = padded.includes(` ${c} `);
    const tokens = c.split(" ").filter((t) => t.length > 0 && !COVERAGE_STOPWORDS.has(t));
    const allTokens = tokens.length > 0 && tokens.every(hasWord);
    if (fullPhrase || allTokens) covered.push(concept);
    else missing.push(concept);
  }
  return { missing, covered };
}
