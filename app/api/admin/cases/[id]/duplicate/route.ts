import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import { logCaseEvent } from "@/lib/case/events";

// Clone a case into a fresh editable draft, so an instructor can reuse or
// version a case rather than authoring each from scratch. The copy keeps the
// input, the generated content, and the (possibly customised) phase sequence,
// but resets status, telemetry, and any release/variant state.
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

  const now = new Date();
  const [created] = await db
    .insert(cases)
    .values({
      instructorId,
      discipline: row.discipline,
      learningObjective: `Copy of ${row.learningObjective}`,
      difficulty: row.difficulty,
      mustCoverConcepts: row.mustCoverConcepts,
      targetLearnerProfile: row.targetLearnerProfile,
      contentJson: row.contentJson,
      phasesJson: row.phasesJson,
      currentPhaseId: null,
      status: row.contentJson ? "editing" : "draft",
      authoringStartedAt: now,
      authoringApprovedAt: null,
      authoringSecondsLogged: null,
      regenerationCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: cases.id });

  await logCaseEvent({ caseId: created.id, eventType: "created", metadata: { duplicatedFrom: id } });

  return NextResponse.json({ id: created.id });
}
