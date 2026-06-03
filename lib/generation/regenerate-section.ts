import { generateObject } from "ai";
import { z } from "zod";
import { getGenerationModel } from "@/lib/llm/client";
import { getDisciplinePack } from "@/lib/disciplines";
import { getRetrievalProvider } from "@/lib/retrieval";
import { normalizeOutput } from "./generate-case";
import type { CaseInput } from "@/lib/disciplines/types";
import type { CaseContent, CaseSection } from "./schema";

const SectionOutputSchema = z.object({
  scenario: z.string().optional(),
  discussionQuestions: z.array(z.string()).optional(),
  modelAnswers: z.array(z.string()).optional(),
  rubric: z.string().optional(),
});

export interface RegenerateSectionInput {
  input: CaseInput;
  currentContent: CaseContent;
  section: CaseSection;
  editorNote?: string;
}

const SECTION_INSTRUCTIONS: Record<CaseSection, string> = {
  scenario:
    "Regenerate the scenario only. Keep the discussion questions, model answers, and rubric unchanged. Preserve the learning objective and must-cover concepts. Make the scenario tighter, fresher, or more specific to the learner profile — depending on the editor's note.",
  discussionQuestions:
    "Regenerate the discussion questions and the matching model answers only. Keep the scenario and rubric unchanged. Maintain a 1:1 correspondence between questions and answers. Apply the editor's note if given.",
  modelAnswers:
    "Regenerate the model answers only. Keep the scenario, discussion questions, and rubric unchanged. Maintain 1:1 correspondence with the existing discussion questions. Apply the editor's note if given.",
  rubric:
    "Regenerate the rubric only. Keep the scenario, discussion questions, and model answers unchanged. Use 4 weighted criteria with single-sentence 'what excellent looks like' descriptors. Apply the editor's note if given.",
};

export interface RegenerateSectionResult {
  patch: Partial<CaseContent>;
  provenance: string[];
}

export async function regenerateSection({
  input,
  currentContent,
  section,
  editorNote,
}: RegenerateSectionInput): Promise<RegenerateSectionResult> {
  const pack = getDisciplinePack(input.discipline);
  const retrieval = await getRetrievalProvider().retrieve(input);

  const sectionInstructions = SECTION_INSTRUCTIONS[section];
  const noteBlock = editorNote
    ? `\n## Editor's note for this regeneration\n${editorNote}\n`
    : "";

  const userPrompt = [
    `# Section regeneration task`,
    ``,
    `Regenerate **${section}** only.`,
    ``,
    `**Learning objective:** ${input.learningObjective}`,
    `**Difficulty:** ${input.difficulty}`,
    `**Must-cover concepts:** ${input.mustCoverConcepts.join(", ") || "(none)"}`,
    ``,
    `## Instruction`,
    sectionInstructions,
    noteBlock,
    `## Discipline grounding`,
    retrieval.groundingText,
    ``,
    `## Current case content (for context — do not modify other sections)`,
    `### Scenario`,
    currentContent.scenario,
    ``,
    `### Discussion questions`,
    currentContent.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    ``,
    `### Model answers`,
    currentContent.modelAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    ``,
    `### Rubric`,
    currentContent.rubric,
    ``,
    `Output only the field(s) for the regenerated section.`,
  ].join("\n");

  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: SectionOutputSchema,
    system: pack.systemPrompt,
    prompt: userPrompt,
    temperature: 0.8,
  });

  // Filter to only the requested section so we never accidentally overwrite
  // something the editor was hand-tuning.
  const result: Partial<CaseContent> = {};
  if (section === "scenario" && object.scenario) {
    result.scenario = object.scenario;
  } else if (section === "discussionQuestions") {
    if (object.discussionQuestions) result.discussionQuestions = object.discussionQuestions;
    if (object.modelAnswers) result.modelAnswers = object.modelAnswers;
  } else if (section === "modelAnswers" && object.modelAnswers) {
    result.modelAnswers = object.modelAnswers;
  } else if (section === "rubric" && object.rubric) {
    result.rubric = object.rubric;
  }
  return { patch: normalizeOutput(result), provenance: retrieval.provenance };
}
