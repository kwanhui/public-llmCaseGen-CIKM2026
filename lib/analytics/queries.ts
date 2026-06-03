import { eq, sql, and, gte, lte, count, avg } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cases, caseVariants, caseEvents } from "@/lib/db/schema";
import { rollingWindow, dayBuckets } from "./windows";

export interface TopLineMetrics {
  casesDrafted: number;
  casesApproved: number;
  casesReleased: number;
  meanAuthoringSeconds: number | null;
  totalVariants: number;
  totalViews: number;
  uniqueViewers: number;
  firstPassApprovalPct: number | null;
  meanRegensPerCase: number | null;
  meanPhaseAdvancesPerReleased: number | null;
  totalResponsesSaved: number;
}

export async function topLineMetrics(instructorId: string): Promise<TopLineMetrics> {
  const [casesAgg] = await db
    .select({
      drafted: count(cases.id),
      approved: sql<number>`SUM(CASE WHEN ${cases.status} IN ('approved','released') THEN 1 ELSE 0 END)::int`,
      released: sql<number>`SUM(CASE WHEN ${cases.status} = 'released' THEN 1 ELSE 0 END)::int`,
      meanAuth: sql<
        number | null
      >`AVG(${cases.authoringSecondsLogged}) FILTER (WHERE ${cases.authoringSecondsLogged} IS NOT NULL)::float8`,
      meanRegens: sql<
        number | null
      >`AVG(${cases.regenerationCount}) FILTER (WHERE ${cases.status} IN ('approved','released'))::float8`,
      firstPass: sql<
        number | null
      >`(SUM(CASE WHEN ${cases.status} IN ('approved','released') AND ${cases.regenerationCount} = 0 THEN 1 ELSE 0 END)::float8 / NULLIF(SUM(CASE WHEN ${cases.status} IN ('approved','released') THEN 1 ELSE 0 END), 0)) * 100`,
    })
    .from(cases)
    .where(eq(cases.instructorId, instructorId));

  const [variantsAgg] = await db
    .select({
      total: count(caseVariants.id),
      views: sql<number>`COALESCE(SUM(${caseVariants.viewCount}), 0)::int`,
    })
    .from(caseVariants)
    .innerJoin(cases, eq(caseVariants.caseId, cases.id))
    .where(eq(cases.instructorId, instructorId));

  const [viewerAgg] = await db
    .select({
      uniqueViewers: sql<number>`COUNT(DISTINCT (${caseEvents.metadata}->>'viewerHash'))::int`,
      totalResponses: sql<number>`SUM(CASE WHEN ${caseEvents.eventType} = 'response_saved' THEN 1 ELSE 0 END)::int`,
      phaseAdvances: sql<number>`SUM(CASE WHEN ${caseEvents.eventType} = 'phase_advanced' THEN 1 ELSE 0 END)::int`,
    })
    .from(caseEvents)
    .innerJoin(cases, eq(caseEvents.caseId, cases.id))
    .where(eq(cases.instructorId, instructorId));

  const releasedCount = casesAgg.released ?? 0;
  return {
    casesDrafted: casesAgg.drafted,
    casesApproved: casesAgg.approved ?? 0,
    casesReleased: releasedCount,
    meanAuthoringSeconds: casesAgg.meanAuth,
    totalVariants: variantsAgg.total,
    totalViews: variantsAgg.views,
    uniqueViewers: viewerAgg.uniqueViewers ?? 0,
    firstPassApprovalPct: casesAgg.firstPass,
    meanRegensPerCase: casesAgg.meanRegens,
    meanPhaseAdvancesPerReleased:
      releasedCount === 0 ? null : (viewerAgg.phaseAdvances ?? 0) / releasedCount,
    totalResponsesSaved: viewerAgg.totalResponses ?? 0,
  };
}

export interface DisciplineCount {
  discipline: string;
  count: number;
  meanAuthoringMinutes: number | null;
}

export async function casesByDiscipline(instructorId: string): Promise<DisciplineCount[]> {
  const rows = await db
    .select({
      discipline: cases.discipline,
      cnt: count(cases.id),
      meanSec: avg(cases.authoringSecondsLogged),
    })
    .from(cases)
    .where(eq(cases.instructorId, instructorId))
    .groupBy(cases.discipline);
  return rows.map((r) => ({
    discipline: r.discipline,
    count: r.cnt,
    meanAuthoringMinutes:
      r.meanSec === null || r.meanSec === undefined ? null : Number(r.meanSec) / 60,
  }));
}

export interface SectionRegenCount {
  section: string;
  count: number;
}

export async function regenerationCountsBySection(
  instructorId: string,
): Promise<SectionRegenCount[]> {
  const rows = await db
    .select({
      section: sql<string>`${caseEvents.metadata}->>'section'`,
      cnt: count(caseEvents.id),
    })
    .from(caseEvents)
    .innerJoin(cases, eq(caseEvents.caseId, cases.id))
    .where(
      and(
        eq(cases.instructorId, instructorId),
        eq(caseEvents.eventType, "section_regenerated"),
      ),
    )
    .groupBy(sql`${caseEvents.metadata}->>'section'`);
  return rows
    .filter((r) => r.section)
    .map((r) => ({ section: r.section as string, count: r.cnt }));
}

export interface DailyViewPoint {
  day: string; // YYYY-MM-DD
  views: number;
  responsesSaved: number;
}

export async function studentActivityOverTime(
  instructorId: string,
  days = 7,
): Promise<DailyViewPoint[]> {
  const win = rollingWindow(days);
  const rows = await db
    .select({
      day: sql<string>`SUBSTRING(${caseEvents.timestampIso}, 1, 10)`,
      eventType: caseEvents.eventType,
      cnt: count(caseEvents.id),
    })
    .from(caseEvents)
    .innerJoin(cases, eq(caseEvents.caseId, cases.id))
    .where(
      and(
        eq(cases.instructorId, instructorId),
        gte(caseEvents.timestampIso, win.currentStart.toISOString()),
        lte(caseEvents.timestampIso, win.currentEnd.toISOString()),
        sql`${caseEvents.eventType} IN ('variant_viewed','response_saved')`,
      ),
    )
    .groupBy(sql`SUBSTRING(${caseEvents.timestampIso}, 1, 10)`, caseEvents.eventType);

  const buckets = dayBuckets(win.currentStart, win.currentEnd);
  const map = new Map<string, { views: number; responses: number }>();
  for (const b of buckets) {
    map.set(b.toISOString().slice(0, 10), { views: 0, responses: 0 });
  }
  for (const r of rows) {
    if (!map.has(r.day)) map.set(r.day, { views: 0, responses: 0 });
    const m = map.get(r.day)!;
    if (r.eventType === "variant_viewed") m.views = r.cnt;
    else if (r.eventType === "response_saved") m.responses = r.cnt;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, views: v.views, responsesSaved: v.responses }));
}

export interface QualityFeedback {
  ratingCount: number;
  meanRating: number | null;
  disputeCount: number;
}

// Aggregate student-reported quality signals across all of an instructor's
// cases: average of the 1-5 case ratings students submit, and the number of
// times automated formative feedback was flagged as off. Gives a programme lead
// a coarse quality read without opening every case.
export async function qualityFeedback(instructorId: string): Promise<QualityFeedback> {
  const [agg] = await db
    .select({
      ratingCount: sql<number>`SUM(CASE WHEN ${caseEvents.eventType} = 'quality_rated' THEN 1 ELSE 0 END)::int`,
      meanRating: sql<
        number | null
      >`AVG((${caseEvents.metadata}->>'rating')::float8) FILTER (WHERE ${caseEvents.eventType} = 'quality_rated')`,
      disputeCount: sql<number>`SUM(CASE WHEN ${caseEvents.eventType} = 'feedback_disputed' THEN 1 ELSE 0 END)::int`,
    })
    .from(caseEvents)
    .innerJoin(cases, eq(caseEvents.caseId, cases.id))
    .where(eq(cases.instructorId, instructorId));
  return {
    ratingCount: agg?.ratingCount ?? 0,
    meanRating: agg?.meanRating ?? null,
    disputeCount: agg?.disputeCount ?? 0,
  };
}

export interface ResponsesByDiscipline {
  discipline: string;
  responses: number;
  views: number;
}

export async function engagementByDiscipline(
  instructorId: string,
): Promise<ResponsesByDiscipline[]> {
  const rows = await db
    .select({
      discipline: cases.discipline,
      eventType: caseEvents.eventType,
      cnt: count(caseEvents.id),
    })
    .from(caseEvents)
    .innerJoin(cases, eq(caseEvents.caseId, cases.id))
    .where(
      and(
        eq(cases.instructorId, instructorId),
        sql`${caseEvents.eventType} IN ('variant_viewed','response_saved')`,
      ),
    )
    .groupBy(cases.discipline, caseEvents.eventType);

  const map = new Map<string, { responses: number; views: number }>();
  for (const r of rows) {
    if (!map.has(r.discipline)) map.set(r.discipline, { responses: 0, views: 0 });
    const m = map.get(r.discipline)!;
    if (r.eventType === "variant_viewed") m.views = r.cnt;
    else m.responses = r.cnt;
  }
  return Array.from(map.entries()).map(([discipline, v]) => ({
    discipline,
    ...v,
  }));
}
