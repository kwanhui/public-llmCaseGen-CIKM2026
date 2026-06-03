import { generateObject } from "ai";
import { z } from "zod";
import { getGenerationModel } from "@/lib/llm/client";
import type { CaseContent } from "./schema";

// A single graduated hint for a stuck student: one nudge short of the model
// answer. It points at the next move or the missing consideration without
// stating the answer, so a student who is stuck can progress without losing the
// learning that revealing the full model answer would short-circuit. Grounded
// in the case content; the model is told not to give away the answer.
export const HintSchema = z.object({
  hint: z
    .string()
    .describe("one or two sentences: a nudge toward the next step, not the answer itself"),
});

export type Hint = z.infer<typeof HintSchema>;

export async function generateHint(
  content: CaseContent,
  studentAnswer: string,
): Promise<Hint> {
  const prompt = [
    "You are helping a student who is stuck on a case-study question.",
    "Give ONE short hint: point at the next move to make or the consideration they have missed.",
    "Do NOT state the answer, give numbers from the model answer, or summarise the model answer.",
    "A good hint makes the student think; it does not do the thinking for them.",
    "If the student has not written anything, suggest how to start, in one sentence.",
    "",
    "## Discussion questions",
    content.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    "",
    "## Model answers (for your reference only — never reveal these)",
    content.modelAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    "",
    "## What the student has written so far",
    studentAnswer.trim() || "(nothing yet)",
    "",
    "Now give one hint.",
  ].join("\n");

  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: HintSchema,
    prompt,
    temperature: 0.4,
  });
  return object;
}
