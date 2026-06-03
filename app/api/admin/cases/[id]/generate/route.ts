import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import {
  generateCase,
  checkConceptCoverage,
  groundingUtilisation,
} from "@/lib/generation/generate-case";
import { CaseContentSchema } from "@/lib/generation/schema";
import { logCaseEvent } from "@/lib/case/events";
import type { CaseInput } from "@/lib/disciplines/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status === "released" || row.status === "approved") {
    return NextResponse.json(
      { error: "case_finalised" },
      { status: 409 },
    );
  }

  await db
    .update(cases)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(cases.id, id));
  await logCaseEvent({ caseId: id, eventType: "generation_started" });

  const input: CaseInput = {
    discipline: row.discipline as CaseInput["discipline"],
    learningObjective: row.learningObjective,
    difficulty: row.difficulty as CaseInput["difficulty"],
    mustCoverConcepts: (row.mustCoverConcepts as string[]) ?? [],
    targetLearnerProfile: row.targetLearnerProfile as CaseInput["targetLearnerProfile"],
  };

  let output;
  let provenance: string[] = [];
  try {
    const result = await generateCase(input);
    output = result.output;
    provenance = result.provenance;
  } catch (err) {
    await db
      .update(cases)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(cases.id, id));
    return NextResponse.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  // Validate against the stricter editor/student schema before persisting. The
  // generation schema is permissive (no per-field minimums), so a thin draft can
  // pass generation yet fail to open in the editor. Rather than store content
  // that dead-ends at step 4 ("No valid content yet"), reject it here so the UI
  // surfaces a clear error and the instructor can regenerate.
  const validated = CaseContentSchema.safeParse({ schemaVersion: 1, ...output });
  if (!validated.success) {
    await db
      .update(cases)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(cases.id, id));
    await logCaseEvent({
      caseId: id,
      eventType: "generation_failed",
      metadata: {
        reason: "schema_validation",
        issues: validated.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      },
    });
    return NextResponse.json(
      {
        error: "generation_invalid",
        message:
          "The model returned a draft that was too thin to open in the editor (e.g. a section under the minimum length). Please regenerate.",
      },
      { status: 502 },
    );
  }

  const contentJson = validated.data;
  const coverage = checkConceptCoverage(output, input.mustCoverConcepts);
  const grounding = groundingUtilisation(output, provenance);
  await db
    .update(cases)
    .set({ contentJson, status: "editing", updatedAt: new Date() })
    .where(eq(cases.id, id));
  await logCaseEvent({
    caseId: id,
    eventType: "generation_completed",
    metadata: {
      scenarioLen: output.scenario.length,
      questionCount: output.discussionQuestions.length,
      retrieval: provenance,
      conceptsCovered: coverage.covered,
      conceptsMissing: coverage.missing,
      groundingUsed: grounding.used,
      groundingTotal: grounding.total,
    },
  });

  return NextResponse.json({ contentJson });
}
