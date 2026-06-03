import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseVariants, cases } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { assessAttempt } from "@/lib/generation/assess-attempt";
import { logCaseEvent } from "@/lib/case/events";

// Student-facing formative feedback: the learner asks for rubric-grounded
// feedback on their own answer. Same assessment the instructor can run, exposed
// to the student so the feedback loop does not depend on the instructor. Token-
// scoped (no login), like the other student routes.
const RequestSchema = z.object({ answer: z.string().min(1).max(20000) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const [row] = await db
    .select({
      variantId: caseVariants.id,
      caseId: caseVariants.caseId,
      contentJson: caseVariants.contentJson,
      status: cases.status,
    })
    .from(caseVariants)
    .innerJoin(cases, eq(caseVariants.caseId, cases.id))
    .where(eq(caseVariants.inviteToken, token));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "released") {
    return NextResponse.json({ error: "not_released" }, { status: 409 });
  }

  const content = CaseContentSchema.safeParse(row.contentJson);
  if (!content.success) return NextResponse.json({ error: "invalid_content" }, { status: 422 });

  let assessment;
  try {
    assessment = await assessAttempt(content.data, parsed.data.answer);
  } catch (err) {
    return NextResponse.json(
      { error: "feedback_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 },
    );
  }

  await logCaseEvent({
    caseId: row.caseId,
    variantId: row.variantId,
    eventType: "feedback_requested",
    metadata: { band: assessment.band },
  });

  return NextResponse.json({ assessment });
}
