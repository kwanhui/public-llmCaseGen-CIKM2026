import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { cases } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CaseActions } from "@/components/admin/case-actions";

const DISCIPLINE_LABELS: Record<string, string> = {
  finance: "Finance",
  marketing: "Marketing",
  social_work: "Social Work",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-primary/10 text-primary",
  editing: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  released: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user) return null;
  const instructorId = (session.user as { id: string }).id;

  let myCases: Array<{
    id: string;
    discipline: string;
    learningObjective: string;
    status: string;
    createdAt: Date;
  }> = [];
  try {
    myCases = await db
      .select({
        id: cases.id,
        discipline: cases.discipline,
        learningObjective: cases.learningObjective,
        status: cases.status,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .where(eq(cases.instructorId, instructorId))
      .orderBy(desc(cases.createdAt));
  } catch {
    // DB unprovisioned — render empty state.
  }

  return (
    <section>
      <PageHeader
        title="Your cases"
        description="Each case is a master draft. Personalised variants for each student are spawned after approval."
        action={
          myCases.length > 0 ? (
            <Link href="/admin/cases/new">
              <Button variant="primary" size="md">
                + New case
              </Button>
            </Link>
          ) : null
        }
      />

      {myCases.length === 0 ? (
        <EmptyState
          variant="muted"
          className="mt-8"
          title="No cases yet"
          description="Author your first case via the four-stage pipeline. Pick a discipline, set a learning objective, and CaseForge drafts a scenario you can edit."
          action={
            <Link href="/admin/cases/new">
              <Button variant="primary" size="md">
                Author your first case
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {myCases.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/30"
            >
              <Link
                href={`/admin/cases/${c.id}`}
                className="min-w-0 flex-1 focus-visible:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {c.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DISCIPLINE_LABELS[c.discipline] ?? c.discipline}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {c.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">
                  {c.learningObjective}
                </p>
              </Link>
              <div className="shrink-0">
                <CaseActions
                  id={c.id}
                  status={c.status}
                  hasContent={c.status !== "draft" && c.status !== "generating"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
