import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import { CaseContentSchema } from "@/lib/generation/schema";
import { logCaseEvent } from "@/lib/case/events";

const PhaseDefinitionSchema = z.object({
  id: z.string().min(1).max(80),
  order: z.number().int().min(0),
  label: z.string().min(1).max(200),
  studentTitle: z.string().min(1).max(200),
  studentPrompt: z.string().min(1).max(4000),
  activities: z.array(z.enum(["clarifying_questions", "notes", "answer_attempt"])).min(0).max(3),
  disciplineHint: z.string().max(500).optional(),
  suggestedMinutes: z.number().int().min(1).max(240).optional(),
});

// The case brief (objective, difficulty, concepts, learner profile). Editable
// only before approval, so an instructor can iterate on the brief and
// regenerate the whole case rather than starting a new wizard.
const SpecSchema = z.object({
  learningObjective: z.string().min(10).max(2000),
  difficulty: z.enum(["novice", "intermediate", "advanced"]),
  mustCoverConcepts: z.array(z.string().min(1).max(120)).max(20),
  targetLearnerProfile: z.object({
    industry: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    priorKnowledge: z.string().min(1).max(200),
  }),
});

const UpdateCaseSchema = z
  .object({
    contentJson: CaseContentSchema.partial().optional(),
    phasesJson: z.array(PhaseDefinitionSchema).min(1).max(10).optional(),
    spec: SpecSchema.optional(),
  })
  .refine(
    (v) =>
      v.contentJson !== undefined ||
      v.phasesJson !== undefined ||
      v.spec !== undefined,
    { message: "Provide contentJson, phasesJson, or spec" },
  );

async function loadOwned(id: string, instructorId: string) {
  const [row] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await loadOwned(id, instructorId);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Partial<typeof cases.$inferInsert> = { updatedAt: new Date() };

  if (parsed.data.contentJson) {
    const merged = {
      schemaVersion: 1,
      ...(existing.contentJson as object | null),
      ...parsed.data.contentJson,
    };
    updates.contentJson = merged;
    if (existing.status === "draft" || existing.status === "generating") {
      updates.status = "editing";
    }
  }
  if (parsed.data.phasesJson) {
    updates.phasesJson = parsed.data.phasesJson;
  }
  if (parsed.data.spec) {
    if (existing.status === "approved" || existing.status === "released") {
      return NextResponse.json(
        { error: "spec_locked", message: "The brief cannot be edited after approval." },
        { status: 409 },
      );
    }
    updates.learningObjective = parsed.data.spec.learningObjective;
    updates.difficulty = parsed.data.spec.difficulty;
    updates.mustCoverConcepts = parsed.data.spec.mustCoverConcepts;
    updates.targetLearnerProfile = parsed.data.spec.targetLearnerProfile;
  }

  await db.update(cases).set(updates).where(eq(cases.id, id));
  await logCaseEvent({
    caseId: id,
    eventType: "edit_saved",
    metadata: {
      contentChanged: !!parsed.data.contentJson,
      phasesChanged: !!parsed.data.phasesJson,
      specChanged: !!parsed.data.spec,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await loadOwned(id, instructorId);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "released") {
    return NextResponse.json(
      { error: "cannot_delete_released" },
      { status: 409 },
    );
  }

  await db.delete(cases).where(eq(cases.id, id));
  return NextResponse.json({ ok: true });
}
