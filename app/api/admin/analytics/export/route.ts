import { NextResponse } from "next/server";
import { eq, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseVariants, caseEvents, studentResponses } from "@/lib/db/schema";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCsv(cols: unknown[]): string {
  return cols.map(csvEscape).join(",");
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;

  const myCases = await db
    .select()
    .from(cases)
    .where(eq(cases.instructorId, instructorId))
    .orderBy(desc(cases.createdAt));
  const caseIds = myCases.map((c) => c.id);

  const myVariants = caseIds.length === 0
    ? []
    : await db.select().from(caseVariants).where(inArray(caseVariants.caseId, caseIds));

  const myEvents = caseIds.length === 0
    ? []
    : await db
        .select()
        .from(caseEvents)
        .where(inArray(caseEvents.caseId, caseIds))
        .orderBy(desc(caseEvents.timestampIso));

  const variantIds = myVariants.map((v) => v.id);
  const myResponses = variantIds.length === 0
    ? []
    : await db
        .select()
        .from(studentResponses)
        .where(inArray(studentResponses.variantId, variantIds));

  const lines: string[] = [];
  lines.push("# CaseForge analytics export");
  lines.push(`# generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## CASES");
  lines.push(
    rowToCsv([
      "id",
      "discipline",
      "difficulty",
      "status",
      "learning_objective",
      "must_cover_concepts",
      "regeneration_count",
      "authoring_seconds_logged",
      "current_phase_id",
      "created_at",
      "approved_at",
    ]),
  );
  for (const c of myCases) {
    lines.push(
      rowToCsv([
        c.id,
        c.discipline,
        c.difficulty,
        c.status,
        c.learningObjective,
        Array.isArray(c.mustCoverConcepts) ? c.mustCoverConcepts.join("; ") : "",
        c.regenerationCount,
        c.authoringSecondsLogged ?? "",
        c.currentPhaseId ?? "",
        c.createdAt.toISOString(),
        c.authoringApprovedAt ? c.authoringApprovedAt.toISOString() : "",
      ]),
    );
  }

  lines.push("");
  lines.push("## VARIANTS");
  lines.push(
    rowToCsv([
      "id",
      "case_id",
      "invite_token",
      "view_count",
      "first_viewed_at",
      "last_viewed_at",
      "learner_profile",
    ]),
  );
  for (const v of myVariants) {
    lines.push(
      rowToCsv([
        v.id,
        v.caseId,
        v.inviteToken,
        v.viewCount,
        v.firstViewedAt ? v.firstViewedAt.toISOString() : "",
        v.lastViewedAt ? v.lastViewedAt.toISOString() : "",
        v.learnerProfileJson,
      ]),
    );
  }

  lines.push("");
  lines.push("## EVENTS");
  lines.push(rowToCsv(["timestamp", "case_id", "variant_id", "event_type", "metadata"]));
  for (const e of myEvents) {
    lines.push(
      rowToCsv([e.timestampIso, e.caseId, e.variantId ?? "", e.eventType, e.metadata]),
    );
  }

  lines.push("");
  lines.push("## STUDENT_RESPONSES");
  lines.push(
    rowToCsv(["variant_id", "phase_id", "activity_type", "content", "updated_at"]),
  );
  for (const r of myResponses) {
    lines.push(
      rowToCsv([
        r.variantId,
        r.phaseId,
        r.activityType,
        r.contentJson,
        r.updatedAt.toISOString(),
      ]),
    );
  }

  const csv = lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="caseforge-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
