import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseEvents } from "@/lib/db/schema";
import { CoInstructorNote } from "@/components/admin/co-instructor-note";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { WizardProgress } from "@/components/admin/case-wizard/wizard-progress";
import { StepRetrievalPreview } from "@/components/admin/case-wizard/step-retrieval-preview";
import { StepGeneration } from "@/components/admin/case-wizard/step-generation";
import { StepEditor } from "@/components/admin/case-wizard/step-editor";
import { PhaseEditor } from "@/components/admin/phase-editor";
import { AdvancePhaseBanner } from "@/components/admin/advance-phase-banner";
import { DuplicateCaseButton } from "@/components/admin/duplicate-case-button";
import {
  CaseContentSchema,
  type CaseContent,
} from "@/lib/generation/schema";
import { checkConceptCoverage, difficultySignal } from "@/lib/generation/generate-case";
import { retrievePreview } from "@/lib/retrieval/embedding-provider";
import { corpusForDiscipline } from "@/lib/retrieval/corpus";
import { DISCIPLINE_PACKS } from "@/lib/disciplines";
import type {
  CaseInput,
  DisciplineId,
  Difficulty,
  PhaseDefinition,
} from "@/lib/disciplines/types";

const VALID_STEPS = ["1", "2", "3", "4"] as const;
type Step = (typeof VALID_STEPS)[number];

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;
  const { step: stepParam } = await searchParams;

  const [row] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!row) notFound();

  // Latest co-instructor handoff note (most recent instructor_note event).
  const [latestNote] = await db
    .select({ metadata: caseEvents.metadata, timestampIso: caseEvents.timestampIso })
    .from(caseEvents)
    .where(and(eq(caseEvents.caseId, id), eq(caseEvents.eventType, "instructor_note")))
    .orderBy(desc(caseEvents.timestampIso))
    .limit(1);
  const noteMeta = (latestNote?.metadata as { note?: string; author?: string } | null) ?? null;

  const pack = DISCIPLINE_PACKS[row.discipline as DisciplineId];
  const hasContent = row.contentJson !== null;
  const contentParse = row.contentJson ? CaseContentSchema.safeParse(row.contentJson) : null;
  const validContent: CaseContent | null =
    contentParse && contentParse.success ? contentParse.data : null;

  // Default step: 4 (editor) when content exists; otherwise 2 (retrieval preview).
  const defaultStep: Step = validContent ? "4" : "2";
  const step: Step = (VALID_STEPS as readonly string[]).includes(stepParam ?? "")
    ? (stepParam as Step)
    : defaultStep;

  const phases = (row.phasesJson as PhaseDefinition[]) ?? [];
  const isReleased = row.status === "released";
  const isApproved = row.status === "approved" || isReleased;

  // Live retrieval preview for step 2 (one embedding call; degrades gracefully).
  const caseInput: CaseInput = {
    discipline: row.discipline as DisciplineId,
    learningObjective: row.learningObjective,
    difficulty: row.difficulty as Difficulty,
    mustCoverConcepts: (row.mustCoverConcepts as string[]) ?? [],
    targetLearnerProfile: row.targetLearnerProfile as CaseInput["targetLearnerProfile"],
  };
  const retrieval =
    step === "2"
      ? await retrievePreview(caseInput)
      : { chunks: [], embedded: false };

  return (
    <section>
      <PageHeader
        title={pack.label + " case"}
        description={row.learningObjective}
        back={{ href: "/admin/cases", label: "Back to cases" }}
        action={
          <div className="flex items-center gap-2">
            <DuplicateCaseButton caseId={id} />
            {isApproved ? (
              <Link href={`/admin/cases/${id}/variants`}>
                <Button variant="primary" size="sm">
                  Manage teams →
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 flex items-center justify-between">
        <WizardProgress current={Number(step) as 1 | 2 | 3 | 4} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Status: <span className="font-medium text-foreground">{row.status}</span>
          </span>
          {row.regenerationCount > 0 ? <span>Regens: {row.regenerationCount}</span> : null}
          {row.authoringSecondsLogged != null ? (
            <span>Authoring: {Math.round(row.authoringSecondsLogged / 60)} min</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <CoInstructorNote
          caseId={id}
          initialNote={noteMeta?.note ?? ""}
          author={noteMeta?.author ?? null}
          updatedAt={latestNote?.timestampIso ?? null}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <StepLink id={id} step="2" current={step} label="Retrieval" />
        <StepLink id={id} step="3" current={step} label="Generation" />
        {validContent ? (
          <StepLink id={id} step="4" current={step} label="Editor & Phases" />
        ) : null}
      </div>

      <div className="mt-8 space-y-6">
        {step === "2" && (
          <StepRetrievalPreview
            caseId={id}
            discipline={row.discipline as DisciplineId}
            difficulty={row.difficulty as Difficulty}
            retrieved={retrieval.chunks}
            embedded={retrieval.embedded}
            corpusSize={corpusForDiscipline(row.discipline as DisciplineId).length}
            brief={{
              learningObjective: caseInput.learningObjective,
              difficulty: caseInput.difficulty,
              mustCoverConcepts: caseInput.mustCoverConcepts,
              targetLearnerProfile: caseInput.targetLearnerProfile,
            }}
            briefLocked={isApproved}
          />
        )}
        {step === "3" && <StepGeneration caseId={id} hasExistingContent={hasContent} />}
        {step === "4" && validContent && (
          <>
            <AdvancePhaseBanner
              caseId={id}
              status={row.status}
              phases={phases}
              currentPhaseId={row.currentPhaseId}
            />
            <StepEditor
              caseId={id}
              initialContent={validContent}
              status={row.status}
              conceptCoverage={checkConceptCoverage(
                validContent,
                (row.mustCoverConcepts as string[]) ?? [],
              )}
              difficulty={difficultySignal(
                validContent,
                row.difficulty as "novice" | "intermediate" | "advanced",
              )}
              quantitative={pack.quantitative ?? false}
            />
            <PhaseEditor
              caseId={id}
              initialPhases={phases}
              defaultPhases={pack.defaultPhases}
              disabled={isReleased}
            />
          </>
        )}
        {step === "4" && !validContent && (
          <div className="rounded-lg border bg-muted/20 p-6 text-sm">
            No valid content yet. Go to{" "}
            <Link href={`/admin/cases/${id}?step=3`} className="underline">
              Generation
            </Link>{" "}
            to draft the case.
          </div>
        )}
      </div>
    </section>
  );
}

function StepLink({
  id,
  step,
  current,
  label,
}: {
  id: string;
  step: Step;
  current: Step;
  label: string;
}) {
  const active = step === current;
  return (
    <Link
      href={`/admin/cases/${id}?step=${step}`}
      className={
        active
          ? "rounded-md border-2 border-primary bg-primary/10 px-2.5 py-1 text-primary"
          : "rounded-md border px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
