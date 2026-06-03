import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import { regenerateSection } from "@/lib/generation/regenerate-section";
import { CaseContentSchema, CASE_SECTIONS } from "@/lib/generation/schema";
import { logCaseEvent } from "@/lib/case/events";
import type { CaseInput } from "@/lib/disciplines/types";

const RequestSchema = z.object({
  section: z.enum(CASE_SECTIONS as [string, ...string[]]),
  editorNote: z.string().max(2000).optional(),
});

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
  if (!row.contentJson) {
    return NextResponse.json(
      { error: "no_content_yet", message: "Generate the case first." },
      { status: 409 },
    );
  }

  const currentParsed = CaseContentSchema.safeParse(row.contentJson);
  if (!currentParsed.success) {
    return NextResponse.json({ error: "invalid_existing_content" }, { status: 500 });
  }

  const input: CaseInput = {
    discipline: row.discipline as CaseInput["discipline"],
    learningObjective: row.learningObjective,
    difficulty: row.difficulty as CaseInput["difficulty"],
    mustCoverConcepts: (row.mustCoverConcepts as string[]) ?? [],
    targetLearnerProfile: row.targetLearnerProfile as CaseInput["targetLearnerProfile"],
  };

  let patch;
  let provenance: string[] = [];
  try {
    const result = await regenerateSection({
      input,
      currentContent: currentParsed.data,
      section: parsed.data.section as Parameters<typeof regenerateSection>[0]["section"],
      editorNote: parsed.data.editorNote,
    });
    patch = result.patch;
    provenance = result.provenance;
  } catch (err) {
    return NextResponse.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  const merged = { ...currentParsed.data, ...patch };
  await db
    .update(cases)
    .set({
      contentJson: merged,
      status: row.status === "draft" ? "editing" : row.status,
      regenerationCount: sql`${cases.regenerationCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(cases.id, id));

  await logCaseEvent({
    caseId: id,
    eventType: "section_regenerated",
    metadata: {
      section: parsed.data.section,
      editorNote: parsed.data.editorNote ?? null,
      retrieval: provenance,
    },
  });

  return NextResponse.json({ contentJson: merged });
}
