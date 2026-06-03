import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseVariants, cases } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { generateHint } from "@/lib/generation/hint";
import { logCaseEvent } from "@/lib/case/events";

// Student-facing graduated hint: one nudge short of the model answer, for a
// student who is stuck but does not want the full answer revealed. Token-scoped
// (no login), like the other student routes.
const RequestSchema = z.object({ answer: z.string().max(20000).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body ?? {});
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

  let hint;
  try {
    hint = await generateHint(content.data, parsed.data.answer ?? "");
  } catch (err) {
    return NextResponse.json(
      { error: "hint_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 },
    );
  }

  await logCaseEvent({
    caseId: row.caseId,
    variantId: row.variantId,
    eventType: "hint_requested",
  });

  return NextResponse.json({ hint: hint.hint });
}
