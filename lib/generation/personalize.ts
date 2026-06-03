import { generateObject } from "ai";
import { getGenerationModel } from "@/lib/llm/client";
import { getDisciplinePack } from "@/lib/disciplines";
import type { CaseInput } from "@/lib/disciplines/types";
import { GenerationOutputSchema, type CaseContent } from "./schema";
import { normalizeOutput } from "./generate-case";

export interface LearnerProfileOverride {
  displayName?: string;
  industry?: string;
  role?: string;
  priorKnowledge?: string;
}

export interface PersonalizeInput {
  base: CaseContent;
  caseInput: CaseInput;
  override: LearnerProfileOverride;
}

export async function personaliseCaseContent({
  base,
  caseInput,
  override,
}: PersonalizeInput): Promise<CaseContent> {
  const pack = getDisciplinePack(caseInput.discipline);
  const profile = caseInput.targetLearnerProfile;
  const newProfile = {
    industry: override.industry ?? profile.industry,
    role: override.role ?? profile.role,
    priorKnowledge: override.priorKnowledge ?? profile.priorKnowledge,
  };
  const displayName = override.displayName ?? "the team";

  const userPrompt = [
    `# Personalisation task`,
    ``,
    `You're producing a team-personalised variant of an approved case for a small`,
    `student team to work through together. The`,
    `**learning objective stays fixed**; only the surface details change to fit`,
    `${displayName}'s context.`,
    ``,
    `**Original learning objective:** ${caseInput.learningObjective}`,
    `**Original difficulty:** ${caseInput.difficulty}`,
    `**Must-cover concepts:** ${caseInput.mustCoverConcepts.join(", ") || "(none)"}`,
    ``,
    `**This team's profile**`,
    `- Industry / practice context: ${newProfile.industry}`,
    `- Role: ${newProfile.role}`,
    `- Prior knowledge: ${newProfile.priorKnowledge}`,
    ``,
    `## Adaptation rules`,
    `- Vary the company / client / setting names and the industry framing to match this learner's context.`,
    `- Adjust the protagonist's role and stakes accordingly.`,
    `- Preserve the analytical or relational structure of the case — same decision shape, same difficulty.`,
    `- Preserve every must-cover concept; ensure they remain unavoidable on the path to the recommendation.`,
    `- Keep the rubric structure but the language can match the new context.`,
    ``,
    `## Original case content (the structure to preserve)`,
    `### Scenario`,
    base.scenario,
    ``,
    `### Discussion questions`,
    base.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    ``,
    `### Model answers`,
    base.modelAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    ``,
    `### Rubric`,
    base.rubric,
    ``,
    `Output a fresh, personalised case in the same structured shape.`,
  ].join("\n");

  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: GenerationOutputSchema,
    system: pack.systemPrompt,
    prompt: userPrompt,
    temperature: 0.85,
  });

  return { schemaVersion: 1, ...normalizeOutput(object) };
}
