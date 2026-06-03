import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq, and, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases, caseVariants, studentResponses } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { SpawnVariantsForm } from "@/components/admin/spawn-variants-form";
import { VariantList } from "@/components/admin/variant-list";
import { CaseContentSchema } from "@/lib/generation/schema";
import { checkConceptCoverage } from "@/lib/generation/generate-case";
import { DISCIPLINE_PACKS } from "@/lib/disciplines";
import type { DisciplineId } from "@/lib/disciplines/types";

export default async function VariantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const instructorId = (session.user as { id: string }).id;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.instructorId, instructorId)));
  if (!row) notFound();

  const pack = DISCIPLINE_PACKS[row.discipline as DisciplineId];

  const variants = await db
    .select({
      id: caseVariants.id,
      token: caseVariants.inviteToken,
      learnerProfileJson: caseVariants.learnerProfileJson,
      contentJson: caseVariants.contentJson,
      viewCount: caseVariants.viewCount,
      firstViewedAt: caseVariants.firstViewedAt,
      lastViewedAt: caseVariants.lastViewedAt,
    })
    .from(caseVariants)
    .where(eq(caseVariants.caseId, id))
    .orderBy(desc(caseVariants.createdAt));

  const variantIds = variants.map((v) => v.id);
  const responses = variantIds.length === 0
    ? []
    : await db
        .select({
          variantId: studentResponses.variantId,
          phaseId: studentResponses.phaseId,
          activityType: studentResponses.activityType,
          contentJson: studentResponses.contentJson,
        })
        .from(studentResponses)
        .where(inArray(studentResponses.variantId, variantIds));

  const responsesByVariant = new Map<
    string,
    { phaseId: string; activityType: string; chars: number; text: string }[]
  >();
  for (const r of responses) {
    let chars = 0;
    let text = "";
    if (r.activityType === "clarifying_questions") {
      const c = r.contentJson as { items?: string[] } | null;
      const items = (c?.items ?? []).filter((x) => x.trim() !== "");
      chars = items.reduce((a, b) => a + b.length, 0);
      text = items.map((x, i) => `${i + 1}. ${x}`).join("\n");
    } else {
      const c = r.contentJson as { text?: string } | null;
      text = c?.text ?? "";
      chars = text.length;
    }
    if (chars === 0) continue;
    const arr = responsesByVariant.get(r.variantId) ?? [];
    arr.push({ phaseId: r.phaseId, activityType: r.activityType, chars, text });
    responsesByVariant.set(r.variantId, arr);
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const mustCover = (row.mustCoverConcepts as string[]) ?? [];
  const variantRows = variants.map((v) => {
    const lp = v.learnerProfileJson as {
      displayName?: string | null;
      industry: string;
      role: string;
      priorKnowledge: string;
      teamSize?: number;
    };
    // Verify the personalised variant still covers every must-cover concept;
    // personalisation is meant to preserve the objective and concepts.
    const parsed = CaseContentSchema.safeParse(v.contentJson);
    const conceptsMissing = parsed.success
      ? checkConceptCoverage(parsed.data, mustCover).missing
      : mustCover;
    // The personalised case text, so the instructor can review what this student
    // actually receives (variants are LLM-generated and not individually approved).
    const preview = parsed.success
      ? { scenario: parsed.data.scenario, discussionQuestions: parsed.data.discussionQuestions }
      : null;
    return {
      id: v.id,
      token: v.token,
      learnerProfile: lp,
      conceptsMissing,
      preview,
      viewCount: v.viewCount,
      firstViewedAt: v.firstViewedAt ? v.firstViewedAt.toISOString() : null,
      lastViewedAt: v.lastViewedAt ? v.lastViewedAt.toISOString() : null,
      responseSummary: responsesByVariant.get(v.id) ?? [],
    };
  });

  const canSpawn = row.status === "approved" || row.status === "released";

  return (
    <section>
      <PageHeader
        title={`${pack.label} · team cases`}
        description={row.learningObjective}
        back={{ href: `/admin/cases/${id}`, label: "Back to case" }}
      />
      {!canSpawn ? (
        <div className="mt-8 rounded-lg border bg-muted/20 p-6 text-sm">
          Approve the case before spawning team cases.
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <SpawnVariantsForm caseId={id} />
          <VariantList variants={variantRows} origin={origin} caseId={id} />
        </div>
      )}
    </section>
  );
}
