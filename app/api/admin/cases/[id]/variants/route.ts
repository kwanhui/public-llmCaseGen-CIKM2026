import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseVariants } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { checkConceptCoverage } from "@/lib/generation/generate-case";
import { personaliseCaseContent } from "@/lib/generation/personalize";
import { newInviteToken } from "@/lib/case/invite";
import { logCaseEvent } from "@/lib/case/events";
import type { CaseInput } from "@/lib/disciplines/types";

const OverrideSchema = z.object({
  displayName: z.string().min(1).max(120).optional(), // team name
  industry: z.string().min(1).max(120).optional(),
  role: z.string().min(1).max(120).optional(),
  priorKnowledge: z.string().min(1).max(120).optional(),
  teamSize: z.number().int().min(1).max(12).optional(),
});

const RequestSchema = z.object({
  // One customised case is generated per student team. count = number of teams.
  count: z.number().int().min(1).max(20).optional(),
  overrides: z.array(OverrideSchema).max(20).optional(),
  // Default students per team, adjustable; per-team overrides win.
  teamSize: z.number().int().min(1).max(12).optional(),
});

const MAX_PARALLEL = 4;

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
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "approved" && row.status !== "released") {
    return NextResponse.json(
      { error: "approve_first" },
      { status: 409 },
    );
  }

  const contentParse = row.contentJson ? CaseContentSchema.safeParse(row.contentJson) : null;
  if (!contentParse?.success) {
    return NextResponse.json({ error: "invalid_content" }, { status: 422 });
  }
  const baseContent = contentParse.data;

  const overrides = parsed.data.overrides ?? [];
  const count = parsed.data.count ?? Math.max(1, overrides.length);
  const defaultTeamSize = parsed.data.teamSize ?? 4;
  // Prefer explicit overrides; pad with empty overrides up to count.
  const items: z.infer<typeof OverrideSchema>[] = [];
  for (let i = 0; i < count; i++) {
    items.push(overrides[i] ?? {});
  }

  const caseInput: CaseInput = {
    discipline: row.discipline as CaseInput["discipline"],
    learningObjective: row.learningObjective,
    difficulty: row.difficulty as CaseInput["difficulty"],
    mustCoverConcepts: (row.mustCoverConcepts as string[]) ?? [],
    targetLearnerProfile: row.targetLearnerProfile as CaseInput["targetLearnerProfile"],
  };

  // Generate in small parallel batches to stay under the function timeout.
  const created: { id: string; token: string; conceptsMissing: string[] }[] = [];
  const errors: { index: number; message: string }[] = [];

  for (let i = 0; i < items.length; i += MAX_PARALLEL) {
    const batch = items.slice(i, i + MAX_PARALLEL);
    const results = await Promise.allSettled(
      batch.map(async (override) => {
        const personalised = await personaliseCaseContent({
          base: baseContent,
          caseInput,
          override,
        });
        const token = newInviteToken();
        const [v] = await db
          .insert(caseVariants)
          .values({
            caseId: id,
            learnerProfileJson: {
              displayName: override.displayName ?? null,
              industry: override.industry ?? caseInput.targetLearnerProfile.industry,
              role: override.role ?? caseInput.targetLearnerProfile.role,
              priorKnowledge:
                override.priorKnowledge ?? caseInput.targetLearnerProfile.priorKnowledge,
              teamSize: override.teamSize ?? defaultTeamSize,
            },
            contentJson: personalised,
            inviteToken: token,
          })
          .returning({ id: caseVariants.id });
        // Verify the personalised variant still covers every must-cover
        // concept; the objective and concepts are meant to be preserved.
        const coverage = checkConceptCoverage(personalised, caseInput.mustCoverConcepts);
        return { id: v.id, token, conceptsMissing: coverage.missing };
      }),
    );
    results.forEach((r, k) => {
      const idx = i + k;
      if (r.status === "fulfilled") {
        created.push(r.value);
      } else {
        errors.push({
          index: idx,
          message: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
  }

  for (const v of created) {
    await logCaseEvent({
      caseId: id,
      variantId: v.id,
      eventType: "variant_spawned",
      metadata: { conceptsMissing: v.conceptsMissing },
    });
  }

  return NextResponse.json({
    created: created.map((c) => ({
      id: c.id,
      token: c.token,
      conceptsMissing: c.conceptsMissing,
    })),
    errors,
  });
}
