import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseVariants, cases, studentResponses } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { CaseViewerClient } from "@/components/case-viewer/case-viewer-client";
import { DISCIPLINE_PACKS } from "@/lib/disciplines";
import type { DisciplineId, PhaseDefinition } from "@/lib/disciplines/types";

export const dynamic = "force-dynamic";

interface ResponseRow {
  phaseId: string;
  activityType: string;
  contentJson: unknown;
}

export default async function StudentCasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [row] = await db
    .select({
      variantId: caseVariants.id,
      variantContent: caseVariants.contentJson,
      caseId: cases.id,
      discipline: cases.discipline,
      learningObjective: cases.learningObjective,
      mustCoverConcepts: cases.mustCoverConcepts,
      phasesJson: cases.phasesJson,
      currentPhaseId: cases.currentPhaseId,
      status: cases.status,
    })
    .from(caseVariants)
    .innerJoin(cases, eq(caseVariants.caseId, cases.id))
    .where(eq(caseVariants.inviteToken, token));

  if (!row) notFound();

  const contentParse = CaseContentSchema.safeParse(row.variantContent);
  if (!contentParse.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12">
        <div className="rounded-lg border border-flag/40 bg-flag/5 px-4 py-3 text-sm text-flag">
          This case is unavailable. Please contact your instructor.
        </div>
      </main>
    );
  }

  const responseRows: ResponseRow[] = await db
    .select({
      phaseId: studentResponses.phaseId,
      activityType: studentResponses.activityType,
      contentJson: studentResponses.contentJson,
    })
    .from(studentResponses)
    .where(eq(studentResponses.variantId, row.variantId));

  const responseMap: Record<
    string,
    {
      clarifying_questions?: { items: string[] };
      notes?: { text: string };
      answer_attempt?: { text: string };
    }
  > = {};
  for (const r of responseRows) {
    if (!responseMap[r.phaseId]) responseMap[r.phaseId] = {};
    if (r.activityType === "clarifying_questions") {
      const c = r.contentJson as { items?: string[] } | null;
      responseMap[r.phaseId].clarifying_questions = { items: c?.items ?? [] };
    } else if (r.activityType === "notes") {
      const c = r.contentJson as { text?: string } | null;
      responseMap[r.phaseId].notes = { text: c?.text ?? "" };
    } else if (r.activityType === "answer_attempt") {
      const c = r.contentJson as { text?: string } | null;
      responseMap[r.phaseId].answer_attempt = { text: c?.text ?? "" };
    }
  }

  const pack = DISCIPLINE_PACKS[row.discipline as DisciplineId];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ← CaseForge home
      </Link>
      <div className="mt-6">
        <CaseViewerClient
          token={token}
          disciplineLabel={pack.label}
          caseRef={row.caseId.slice(0, 8)}
          learningObjective={row.learningObjective}
          learningOutcomes={(row.mustCoverConcepts as string[]) ?? []}
          scenario={contentParse.data.scenario}
          phases={(row.phasesJson as PhaseDefinition[]) ?? []}
          initialCurrentPhaseId={row.currentPhaseId}
          status={row.status}
          initialResponses={responseMap}
          glossary={contentParse.data.glossary ?? []}
          finalContent={{
            discussionQuestions: contentParse.data.discussionQuestions,
            modelAnswers: contentParse.data.modelAnswers,
            rubric: contentParse.data.rubric,
          }}
        />
      </div>
    </main>
  );
}
