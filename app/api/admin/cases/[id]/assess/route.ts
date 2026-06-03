import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseVariants, studentResponses } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { assessAttempt } from "@/lib/generation/assess-attempt";
import { logCaseEvent } from "@/lib/case/events";

const RequestSchema = z.object({ variantId: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const [row] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [variant] = await db
    .select({ id: caseVariants.id, contentJson: caseVariants.contentJson })
    .from(caseVariants)
    .where(and(eq(caseVariants.id, parsed.data.variantId), eq(caseVariants.caseId, id)));
  if (!variant) return NextResponse.json({ error: "variant_not_found" }, { status: 404 });

  const content = CaseContentSchema.safeParse(variant.contentJson);
  if (!content.success) return NextResponse.json({ error: "invalid_content" }, { status: 422 });

  // Collect the student's answer_attempt submissions for this variant.
  const attempts = await db
    .select({ contentJson: studentResponses.contentJson })
    .from(studentResponses)
    .where(
      and(
        eq(studentResponses.variantId, variant.id),
        eq(studentResponses.activityType, "answer_attempt"),
      ),
    );
  const studentAnswer = attempts
    .map((a) => (a.contentJson as { text?: string } | null)?.text ?? "")
    .filter((t) => t.trim() !== "")
    .join("\n\n");
  if (!studentAnswer) {
    return NextResponse.json({ error: "no_answer", message: "This student has not submitted an answer yet." }, { status: 409 });
  }

  let assessment;
  try {
    assessment = await assessAttempt(content.data, studentAnswer);
  } catch (err) {
    return NextResponse.json(
      { error: "assessment_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 },
    );
  }

  await logCaseEvent({
    caseId: id,
    variantId: variant.id,
    eventType: "attempt_assessed",
    metadata: { band: assessment.band },
  });

  return NextResponse.json({ assessment });
}
