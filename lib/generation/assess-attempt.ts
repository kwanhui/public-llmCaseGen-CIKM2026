import { generateObject } from "ai";
import { z } from "zod";
import { getGenerationModel } from "@/lib/llm/client";
import type { CaseContent } from "./schema";

// Formative, rubric-grounded feedback on a student's answer. This assists the
// instructor; it does not assign a grade of record. Temperature is low and the
// model is told to ground every judgment in what the student actually wrote and
// not to invent facts.
export const AssessmentSchema = z.object({
  criteria: z
    .array(
      z.object({
        criterion: z.string().describe("the rubric criterion being judged"),
        judgment: z.string().describe("one or two sentences grounded in the student's answer"),
      }),
    )
    .min(1)
    .max(8),
  overall: z.string().describe("a short overall comment for the instructor"),
  band: z.enum(["needs work", "developing", "proficient", "strong"]),
});

export type Assessment = z.infer<typeof AssessmentSchema>;

export async function assessAttempt(
  content: CaseContent,
  studentAnswer: string,
): Promise<Assessment> {
  const prompt = [
    "You are assisting an instructor with formative feedback on a student's answer to a case study.",
    "Assess the student's answer only against the rubric and the model answers below.",
    "Ground every judgment in what the student actually wrote; do not invent facts the student did not state.",
    "If the answer is blank or off-topic, say so plainly and band it as 'needs work'.",
    "",
    "## Rubric",
    content.rubric,
    "",
    "## Discussion questions",
    content.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    "",
    "## Model answers (reference only)",
    content.modelAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    "",
    "## Student's answer",
    studentAnswer.trim() || "(blank)",
    "",
    "For each rubric criterion, give a one or two sentence judgment. Then a short overall comment and an overall band.",
  ].join("\n");

  const { object } = await generateObject({
    model: getGenerationModel(),
    schema: AssessmentSchema,
    prompt,
    temperature: 0.3,
  });
  return object;
}
