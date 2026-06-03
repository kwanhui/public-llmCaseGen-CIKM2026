import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/analytics/metric-card";
import {
  AuthoringTimeChart,
  RegenCountChart,
  StudentActivityChart,
  DisciplinePie,
  EngagementChart,
} from "@/components/analytics/charts";
import {
  topLineMetrics,
  casesByDiscipline,
  regenerationCountsBySection,
  studentActivityOverTime,
  engagementByDiscipline,
  qualityFeedback,
} from "@/lib/analytics/queries";

function formatDuration(seconds: number | null): string {
  if (seconds === null || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

function formatPct(value: number | null): string {
  if (value === null || isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatNumber(value: number | null, digits = 1): string {
  if (value === null || isNaN(value)) return "—";
  return value.toFixed(digits);
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const instructorId = (session.user as { id: string }).id;

  let metrics, byDiscipline, regenCounts, activity, engagement, quality;
  try {
    [metrics, byDiscipline, regenCounts, activity, engagement, quality] = await Promise.all([
      topLineMetrics(instructorId),
      casesByDiscipline(instructorId),
      regenerationCountsBySection(instructorId),
      studentActivityOverTime(instructorId, 7),
      engagementByDiscipline(instructorId),
      qualityFeedback(instructorId),
    ]);
  } catch {
    return (
      <section>
        <PageHeader
          title="Analytics"
          description="Authoring time, regeneration counts, phase progression, and student engagement."
        />
        <div className="mt-8">
          <EmptyState
            variant="muted"
            title="Analytics unavailable"
            description="The database isn't reachable. Check POSTGRES_URL and run pnpm db:migrate."
          />
        </div>
      </section>
    );
  }

  if (metrics.casesDrafted === 0) {
    return (
      <section>
        <PageHeader
          title="Analytics"
          description="Authoring time, regeneration counts, phase progression, and student engagement."
        />
        <div className="mt-8">
          <EmptyState
            variant="muted"
            title="No data yet"
            description="Author at least one case to populate the dashboard."
            action={
              <Link href="/admin/cases/new">
                <Button variant="primary">Author your first case</Button>
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Analytics"
        description="Authoring time, regeneration counts, phase progression, and student engagement."
        action={
          <Link href="/api/admin/analytics/export">
            <Button variant="outline" size="sm">
              Download CSV
            </Button>
          </Link>
        }
      />

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Cases drafted"
          value={String(metrics.casesDrafted)}
          hint={`${metrics.casesApproved} approved · ${metrics.casesReleased} released`}
        />
        <MetricCard
          label="Mean authoring time"
          value={formatDuration(metrics.meanAuthoringSeconds)}
          hint="Per approved case"
        />
        <MetricCard
          label="First-pass approvals"
          value={formatPct(metrics.firstPassApprovalPct)}
          hint="Approved with no section regenerations"
        />
        <MetricCard
          label="Mean regenerations per case"
          value={formatNumber(metrics.meanRegensPerCase, 1)}
          hint="Approved cases only"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Team cases spawned"
          value={String(metrics.totalVariants)}
          hint="One per student team, across all cases"
        />
        <MetricCard
          label="Total student views"
          value={String(metrics.totalViews)}
          hint={`${metrics.uniqueViewers} unique viewers (HMAC-pseudonymous)`}
        />
        <MetricCard
          label="Phase advances per released case"
          value={formatNumber(metrics.meanPhaseAdvancesPerReleased, 1)}
          hint="Cohort progression depth"
        />
        <MetricCard
          label="Student responses captured"
          value={String(metrics.totalResponsesSaved)}
          hint="Across clarifying-questions & notes"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Mean case rating"
          value={quality.meanRating === null ? "—" : `${formatNumber(quality.meanRating, 1)} / 5`}
          hint={`${quality.ratingCount} student rating${quality.ratingCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Feedback flagged as off"
          value={String(quality.disputeCount)}
          hint="Times a student disputed AI feedback"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <AuthoringTimeChart data={byDiscipline} />
        <DisciplinePie data={byDiscipline} />
        <RegenCountChart data={regenCounts} />
        <StudentActivityChart data={activity} />
        <div className="lg:col-span-2">
          <EngagementChart data={engagement} />
        </div>
      </div>
    </section>
  );
}
