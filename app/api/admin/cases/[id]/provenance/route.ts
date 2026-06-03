import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseVariants, caseEvents } from "@/lib/db/schema";
import type { PhaseDefinition } from "@/lib/disciplines/types";

// Per-case provenance / audit record. Quality-assurance and accreditation
// reviewers need to show how a teaching artifact was produced: the brief it was
// generated from, that a human approved it before any student saw it, how long
// authoring took, and the full chronological trail of generations, edits, and
// releases. This bundles that into a single human-readable Markdown record,
// derived entirely from data already stored (the case row plus its append-only
// event log) — no new tables, no new telemetry.

const EVENT_LABELS: Record<string, string> = {
  created: "Case created",
  generation_started: "Generation started",
  generation_completed: "Draft generated",
  generation_failed: "Generation failed",
  section_regenerated: "Section regenerated",
  edit_saved: "Edit saved by instructor",
  approved: "Approved by instructor",
  released: "Released to cohort",
  phase_advanced: "Phase advanced",
  variant_spawned: "Personalised variant spawned",
  variant_viewed: "Variant opened by a team",
  response_saved: "Student response saved",
  attempt_assessed: "Answer assessed (formative)",
  feedback_requested: "Formative feedback requested",
  hint_requested: "Hint requested",
};

function fmtMeta(meta: unknown): string {
  if (meta === null || meta === undefined) return "";
  if (typeof meta === "object" && Object.keys(meta as object).length === 0) return "";
  try {
    return ` — ${JSON.stringify(meta)}`;
  } catch {
    return "";
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const [c] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const events = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, id))
    .orderBy(asc(caseEvents.timestampIso));

  const variants = await db
    .select({ id: caseVariants.id })
    .from(caseVariants)
    .where(eq(caseVariants.caseId, id));

  const profile = c.targetLearnerProfile as {
    industry?: string;
    role?: string;
    priorKnowledge?: string;
  };
  const concepts = Array.isArray(c.mustCoverConcepts)
    ? (c.mustCoverConcepts as string[])
    : [];
  const phases = (c.phasesJson as PhaseDefinition[]) ?? [];
  const authoringMinutes =
    c.authoringSecondsLogged != null
      ? (c.authoringSecondsLogged / 60).toFixed(1)
      : null;

  const L: string[] = [];
  L.push(`# CaseForge provenance record`);
  L.push("");
  L.push(`Generated: ${new Date().toISOString()}`);
  L.push("");
  L.push(`This record documents how a single case study was authored in CaseForge,`);
  L.push(`for quality-assurance and accreditation review. Every case is drafted by a`);
  L.push(`large language model from the brief below, grounded in a curated discipline`);
  L.push(`corpus, and reviewed and approved by the instructor before any student can`);
  L.push(`open it. The timeline at the end is the complete, time-ordered audit trail.`);
  L.push("");
  L.push(`## Case`);
  L.push(`- ID: ${c.id}`);
  L.push(`- Discipline: ${c.discipline}`);
  L.push(`- Difficulty: ${c.difficulty}`);
  L.push(`- Status: ${c.status}`);
  L.push(`- Learning objective: ${c.learningObjective}`);
  L.push(`- Must-cover concepts: ${concepts.length ? concepts.join("; ") : "(none)"}`);
  L.push(
    `- Target learner: ${[profile.role, profile.industry, profile.priorKnowledge]
      .filter(Boolean)
      .join(", ") || "(unspecified)"}`,
  );
  L.push(`- Personalised variants spawned: ${variants.length}`);
  L.push("");
  L.push(`## Authoring effort`);
  L.push(`- Created: ${c.createdAt.toISOString()}`);
  L.push(
    `- Approved: ${c.authoringApprovedAt ? c.authoringApprovedAt.toISOString() : "(not yet approved)"}`,
  );
  L.push(`- Logged authoring time: ${authoringMinutes != null ? `${authoringMinutes} min` : "(not recorded)"}`);
  L.push(`- Section regenerations: ${c.regenerationCount}`);
  L.push("");
  L.push(`## Phase plan`);
  for (const p of [...phases].sort((a, b) => a.order - b.order)) {
    L.push(`${p.order + 1}. ${p.label}`);
  }
  L.push("");
  L.push(`## Audit timeline`);
  if (events.length === 0) {
    L.push("(no events recorded)");
  } else {
    for (const e of events) {
      const label = EVENT_LABELS[e.eventType] ?? e.eventType;
      L.push(`- ${e.timestampIso} · ${label}${fmtMeta(e.metadata)}`);
    }
  }
  L.push("");

  const md = L.join("\n");
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="caseforge-provenance-${id.slice(0, 8)}.md"`,
    },
  });
}
