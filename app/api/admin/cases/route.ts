import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import { getDisciplinePack } from "@/lib/disciplines";
import { logCaseEvent } from "@/lib/case/events";

const CreateCaseSchema = z.object({
  discipline: z.enum(["finance", "marketing", "social_work"]),
  learningObjective: z.string().min(10).max(2000),
  difficulty: z.enum(["novice", "intermediate", "advanced"]),
  mustCoverConcepts: z.array(z.string().min(1).max(80)).max(20),
  targetLearnerProfile: z.object({
    industry: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    priorKnowledge: z.string().min(1).max(120),
  }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const instructorId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = CreateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pack = getDisciplinePack(parsed.data.discipline);
  // Deep-copy default phases so the instructor can edit them per case without
  // mutating the discipline pack.
  const phasesJson = JSON.parse(JSON.stringify(pack.defaultPhases));

  const [row] = await db
    .insert(cases)
    .values({
      instructorId,
      discipline: parsed.data.discipline,
      learningObjective: parsed.data.learningObjective,
      difficulty: parsed.data.difficulty,
      mustCoverConcepts: parsed.data.mustCoverConcepts,
      targetLearnerProfile: parsed.data.targetLearnerProfile,
      phasesJson,
      status: "draft",
    })
    .returning({ id: cases.id });

  await logCaseEvent({
    caseId: row.id,
    eventType: "created",
    metadata: { discipline: parsed.data.discipline, difficulty: parsed.data.difficulty },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
