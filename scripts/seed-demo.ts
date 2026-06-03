// Seed a small, clearly-marked demo dataset for trying the system, then
// remove it again with `--clean`. Uses the real generated content already in
// demo/sample-outputs (no fabricated case content). Rows use the "seed-" id
// prefix so cleanup is exact and never touches genuine data. Student activity
// (views, responses) is synthetic demo telemetry spread over the last 7 days so
// the analytics dashboard looks like real classroom use.
//
//   pnpm tsx scripts/seed-demo.ts          # insert
//   pnpm tsx scripts/seed-demo.ts --clean  # remove

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { users, cases, caseVariants, caseEvents, studentResponses } from "../lib/db/schema";
import { getDisciplinePack } from "../lib/disciplines";
import type { DisciplineId } from "../lib/disciplines/types";

loadEnv({ path: ".env.local" });
loadEnv();

const ADMIN_ID = "admin";
const DRAFT_CASE_ID = "seed-case-finance-draft";
const CASE_IDS = ["seed-case-finance", "seed-case-marketing", DRAFT_CASE_ID];
const read = (f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "demo/sample-outputs", f), "utf8"));
const readVariant = (f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "demo/sample-variants", f), "utf8"));

const now = Date.now();
const dayMs = 86400_000;
function isoDaysAgo(days: number, hour = 12): string {
  const dt = new Date(now - days * dayMs);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

interface Team {
  id: string;
  token: string;
  name: string;
  industry: string;
  role: string;
  prior: string;
  size: number;
  views: number; // viewCount + number of variant_viewed events generated
  responses: number; // number of response_saved events generated
  // Optional committed personalised content (from scripts/generate-demo-variants.ts).
  // When set, this team's case shows a genuinely re-contextualised scenario
  // instead of the shared master content, so the demo can contrast two teams.
  contentFile?: string;
}

interface CaseCfg {
  id: string;
  discipline: DisciplineId;
  sample: string;
  regenSections: string[];
  teams: Team[];
  glossary: { term: string; definition: string }[];
  note: string; // co-instructor handoff note
  ratings: number[]; // student case ratings (1-5)
  disputes: number; // count of disputed-feedback flags
}

const FINANCE: CaseCfg = {
  id: "seed-case-finance",
  discipline: "finance",
  sample: "finance.json",
  regenSections: ["discussionQuestions", "rubric"],
  teams: [
    { id: "seed-f1", token: "seedretailbank01", name: "Team Alpha", industry: "retail banking", role: "junior analyst", prior: "intermediate", size: 4, views: 9, responses: 4, contentFile: "finance-retail.json" },
    { id: "seed-f2", token: "seedteambeta0002", name: "Team Beta", industry: "corporate treasury", role: "treasury associate", prior: "intermediate", size: 5, views: 12, responses: 3, contentFile: "finance-treasury.json" },
    { id: "seed-f3", token: "seedteamgamma003", name: "Team Gamma", industry: "fintech lending", role: "credit analyst", prior: "novice", size: 3, views: 6, responses: 2 },
    { id: "seed-f4", token: "seedteamdelta004", name: "Team Delta", industry: "asset management", role: "research analyst", prior: "advanced", size: 4, views: 8, responses: 3 },
    { id: "seed-f5", token: "seedteamepsiln5", name: "Team Epsilon", industry: "insurance", role: "actuarial analyst", prior: "intermediate", size: 4, views: 4, responses: 1 },
  ],
  glossary: [
    { term: "Dividend discount model (DDM)", definition: "A way to value a share as the present value of the dividends it is expected to pay." },
    { term: "Cost of equity", definition: "The return shareholders require for holding the stock, used as the discount rate." },
    { term: "Terminal growth rate", definition: "The constant rate at which dividends are assumed to grow forever after the forecast horizon." },
    { term: "Sensitivity analysis", definition: "Re-running the valuation while changing one assumption to see how much the answer moves." },
  ],
  note: "Tuned the rubric for the part-time cohort — lighter on modelling depth, heavier on the recommendation memo. Hold release for the evening section until week 6.",
  ratings: [5, 4, 5, 4, 3, 5, 4, 5],
  disputes: 1,
};

const MARKETING: CaseCfg = {
  id: "seed-case-marketing",
  discipline: "marketing",
  sample: "marketing.json",
  regenSections: ["scenario"],
  teams: [
    { id: "seed-m1", token: "seedmktconsumer1", name: "Team Indigo", industry: "consumer health", role: "brand assistant", prior: "novice", size: 4, views: 7, responses: 3 },
    { id: "seed-m2", token: "seedmktretail02", name: "Team Jade", industry: "retail", role: "marketing associate", prior: "intermediate", size: 3, views: 5, responses: 2 },
    { id: "seed-m3", token: "seedmktd2c0003", name: "Team Onyx", industry: "direct-to-consumer", role: "growth analyst", prior: "intermediate", size: 5, views: 10, responses: 4 },
  ],
  glossary: [
    { term: "Positioning", definition: "The distinct place a brand aims to occupy in the customer's mind relative to competitors." },
    { term: "Segmentation", definition: "Dividing a market into groups of customers with similar needs so messaging can be tailored." },
    { term: "Customer acquisition cost (CAC)", definition: "The average spend needed to win one new customer." },
    { term: "Conversion rate", definition: "The share of people who take the desired action, such as buying or signing up." },
  ],
  note: "Swapped in the D2C exemplar for the Onyx team. Watch the persuasive framing — keep claims defensible.",
  ratings: [4, 5, 3, 4, 4],
  disputes: 0,
};

async function clean() {
  // FK cascades from cases remove variants, responses, and events.
  await db.delete(cases).where(inArray(cases.id, CASE_IDS));
  console.log("removed seed rows");
}

async function seedCase(cfg: CaseCfg) {
  const data = read(cfg.sample);
  const phases = getDisciplinePack(cfg.discipline).defaultPhases;
  const content = { schemaVersion: 1, ...data.output, glossary: cfg.glossary };

  await db.insert(cases).values({
    id: cfg.id,
    instructorId: ADMIN_ID,
    discipline: cfg.discipline,
    learningObjective: data.input.learningObjective,
    difficulty: data.input.difficulty,
    mustCoverConcepts: data.input.mustCoverConcepts,
    targetLearnerProfile: data.input.targetLearnerProfile,
    contentJson: content,
    phasesJson: phases,
    currentPhaseId: phases[1].id,
    status: "released",
    authoringApprovedAt: new Date(now - 6 * dayMs),
    authoringSecondsLogged: 9 * 60 + 40,
    regenerationCount: cfg.regenSections.length,
  });

  for (const t of cfg.teams) {
    const variantContent = t.contentFile
      ? { schemaVersion: 1, ...readVariant(t.contentFile) }
      : content;
    await db.insert(caseVariants).values({
      id: t.id,
      caseId: cfg.id,
      learnerProfileJson: {
        displayName: t.name,
        industry: t.industry,
        role: t.role,
        priorKnowledge: t.prior,
        teamSize: t.size,
      },
      contentJson: variantContent,
      inviteToken: t.token,
      viewCount: t.views,
      firstViewedAt: new Date(now - 6 * dayMs),
      lastViewedAt: new Date(now - 2 * 3600_000),
    });
  }

  // Authoring lifecycle events (6 days ago).
  const events: { t: string; type: string; vid?: string; meta?: unknown }[] = [
    { t: isoDaysAgo(6, 9), type: "created" },
    { t: isoDaysAgo(6, 9), type: "generation_started" },
    {
      t: isoDaysAgo(6, 9),
      type: "generation_completed",
      meta: {
        retrieval: data.provenance,
        conceptsCovered: data.input.mustCoverConcepts,
        conceptsMissing: [],
        groundingUsed: 5,
        groundingTotal: 5,
      },
    },
    ...cfg.regenSections.map((section) => ({ t: isoDaysAgo(6, 10), type: "section_regenerated", meta: { section } })),
    { t: isoDaysAgo(5, 9), type: "approved", meta: { authoringSeconds: 580 } },
    { t: isoDaysAgo(5, 9), type: "released" },
    ...cfg.teams.map((t) => ({ t: isoDaysAgo(5, 10), type: "variant_spawned", vid: t.id })),
    { t: isoDaysAgo(3, 9), type: "phase_advanced", meta: { toPhaseId: phases[1].id } },
    { t: isoDaysAgo(4, 11), type: "instructor_note", meta: { note: cfg.note, author: "Co-instructor" } },
  ];

  // Student-reported quality signals, spread across the recent window.
  cfg.ratings.forEach((rating, i) => {
    const team = cfg.teams[i % cfg.teams.length];
    events.push({
      t: isoDaysAgo(Math.max(0, 4 - (i % 4)), 15 + (i % 5)),
      type: "quality_rated",
      vid: team.id,
      meta: { rating },
    });
  });
  for (let d = 0; d < cfg.disputes; d++) {
    events.push({
      t: isoDaysAgo(1, 16 + d),
      type: "feedback_disputed",
      vid: cfg.teams[0].id,
    });
  }

  // Student activity spread across the last 5 days, ramping toward recent.
  for (const t of cfg.teams) {
    for (let v = 0; v < t.views; v++) {
      const day = 5 - Math.floor((v * 5) / Math.max(1, t.views)); // 5..1, more recent as v grows
      events.push({
        t: isoDaysAgo(Math.max(0, day), 8 + (v % 9)),
        type: "variant_viewed",
        vid: t.id,
        meta: { viewerHash: `${t.token}-s${(v % t.size) + 1}` },
      });
    }
    for (let r = 0; r < t.responses; r++) {
      const day = Math.max(0, 4 - r);
      const activity = r === 0 ? "clarifying_questions" : "notes";
      events.push({
        t: isoDaysAgo(day, 14 + (r % 6)),
        type: "response_saved",
        vid: t.id,
        meta: { phaseId: phases[Math.min(r, 1)].id, activityType: activity },
      });
    }
  }

  for (const e of events) {
    await db.insert(caseEvents).values({
      timestampIso: e.t,
      caseId: cfg.id,
      variantId: e.vid ?? null,
      eventType: e.type,
      metadata: (e.meta ?? null) as object | null,
    });
  }

  return { teams: cfg.teams.length, events: events.length };
}

async function seedStudentSubmissions(phasesFinance: ReturnType<typeof getDisciplinePack>["defaultPhases"]) {
  // Real, readable submissions on the first finance team, so the instructor
  // view shows actual answers and the rubric-assessment action, and the
  // student self-check is populated.
  const lastPhaseId = phasesFinance[phasesFinance.length - 1].id;
  await db.insert(studentResponses).values([
    {
      variantId: "seed-f1",
      phaseId: phasesFinance[0].id,
      activityType: "clarifying_questions",
      contentJson: {
        items: [
          "Should we treat the 5% dividend growth as perpetual or only over the explicit horizon?",
          "Is the 9% cost of equity a CAPM estimate, and what beta does it assume?",
        ],
      },
    },
    {
      variantId: "seed-f1",
      phaseId: lastPhaseId,
      activityType: "answer_attempt",
      contentJson: {
        text: "Using the DDM with next year's dividend of about CAD 1.26 (1.20 grown at 5%) and a 9% cost of equity, the single-stage Gordon model gives an intrinsic value near CAD 31.5 per share (1.26 / (0.09 - 0.05)). The value is very sensitive to the spread between cost of equity and growth: at 4% growth it falls to roughly CAD 25, and at a 10% cost of equity to about CAD 25.2. We would flag that a 5% perpetual growth rate is aggressive for a regional bank and recommend a base case nearer 3 to 4%, making the recommendation conditional on the cost-of-equity estimate.",
      },
    },
  ]);
}

// A non-approved DRAFT finance case, included so the
// editor scene shows live, enabled regenerate controls (the editor disables
// regeneration once a case is approved/released, which all the other seed
// cases are). Carries a co-instructor note so that feature is on screen too.
async function seedDraftCase() {
  const data = read(FINANCE.sample);
  const phases = getDisciplinePack("finance").defaultPhases;
  const content = { schemaVersion: 1, ...data.output, glossary: FINANCE.glossary };
  await db.insert(cases).values({
    id: DRAFT_CASE_ID,
    instructorId: ADMIN_ID,
    discipline: "finance",
    learningObjective: data.input.learningObjective,
    difficulty: data.input.difficulty,
    mustCoverConcepts: data.input.mustCoverConcepts,
    targetLearnerProfile: data.input.targetLearnerProfile,
    contentJson: content,
    phasesJson: phases,
    currentPhaseId: null,
    status: "editing",
    authoringSecondsLogged: null,
    regenerationCount: 1,
  });
  await db.insert(caseEvents).values([
    { timestampIso: isoDaysAgo(0, 9), caseId: DRAFT_CASE_ID, variantId: null, eventType: "created", metadata: null },
    { timestampIso: isoDaysAgo(0, 9), caseId: DRAFT_CASE_ID, variantId: null, eventType: "generation_completed", metadata: { groundingUsed: 5, groundingTotal: 5 } },
    {
      timestampIso: isoDaysAgo(0, 10),
      caseId: DRAFT_CASE_ID,
      variantId: null,
      eventType: "instructor_note",
      metadata: { note: "Draft for the section on bank valuation — checking the figures before I approve and release.", author: "Co-instructor" },
    },
  ]);
}

async function seed() {
  await clean();
  await db
    .insert(users)
    .values({ id: ADMIN_ID, email: "admin", role: "instructor" })
    .onConflictDoNothing({ target: users.id });

  let teams = 0;
  let events = 0;
  for (const cfg of [FINANCE, MARKETING]) {
    const r = await seedCase(cfg);
    teams += r.teams;
    events += r.events;
  }
  await seedStudentSubmissions(getDisciplinePack("finance").defaultPhases);
  await seedDraftCase();
  console.log(`seeded ${CASE_IDS.length} cases (incl. 1 draft), ${teams} teams, ${events} events`);
}

const mode = process.argv.includes("--clean") ? clean : seed;
mode()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
