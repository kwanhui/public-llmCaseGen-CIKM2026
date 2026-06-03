"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface VariantRow {
  id: string;
  token: string;
  learnerProfile: {
    displayName?: string | null;
    industry: string;
    role: string;
    priorKnowledge: string;
    teamSize?: number;
  };
  conceptsMissing: string[];
  preview: { scenario: string; discussionQuestions: string[] } | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  responseSummary: { phaseId: string; activityType: string; chars: number; text: string }[];
}

const ACTIVITY_LABEL: Record<string, string> = {
  clarifying_questions: "Clarifying questions",
  notes: "Notes",
  answer_attempt: "Answer attempt",
};

interface Assessment {
  criteria: { criterion: string; judgment: string }[];
  overall: string;
  band: string;
}

interface Props {
  variants: VariantRow[];
  origin: string;
  caseId: string;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLinksCsv(variants: VariantRow[], origin: string) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "teamName,industry,role,priorKnowledge,teamSize,url";
  const rows = variants.map((v) => {
    const lp = v.learnerProfile;
    return [
      esc(lp.displayName ?? ""),
      esc(lp.industry),
      esc(lp.role),
      esc(lp.priorKnowledge),
      esc(lp.teamSize ? String(lp.teamSize) : ""),
      esc(`${origin}/case/${v.token}`),
    ].join(",");
  });
  downloadCsv([header, ...rows].join("\n"), "caseforge-team-links.csv");
}

// A grading-friendly export of the teams' submitted work: one row per saved
// response, keyed to a human-readable team name rather than an internal id.
// This hands the instructor the text to grade in their own system; CaseForge
// itself does not assign a grade of record.
function exportSubmissionsCsv(variants: VariantRow[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "teamName,industry,role,phaseId,activityType,response";
  const rows: string[] = [];
  for (const v of variants) {
    const lp = v.learnerProfile;
    const teamName = lp.displayName || `${lp.industry} / ${lp.role}`;
    for (const r of v.responseSummary) {
      if (!r.text.trim()) continue;
      rows.push(
        [
          esc(teamName),
          esc(lp.industry),
          esc(lp.role),
          esc(r.phaseId),
          esc(ACTIVITY_LABEL[r.activityType] ?? r.activityType),
          esc(r.text),
        ].join(","),
      );
    }
  }
  downloadCsv([header, ...rows].join("\n"), "caseforge-submissions.csv");
}

export function VariantList({ variants, origin, caseId }: Props) {
  if (variants.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
        No team cases yet. Use the form on the left.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {variants.length} team{variants.length === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportSubmissionsCsv(variants)}
            disabled={variants.every((v) => v.responseSummary.every((r) => !r.text.trim()))}
            title="Download each team's submitted work to grade in your own system"
          >
            Export submissions (CSV)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportLinksCsv(variants, origin)}
          >
            Export links (CSV)
          </Button>
        </div>
      </div>
      <ul className="divide-y rounded-lg border bg-background">
        {variants.map((v) => (
          <li key={v.id} className="px-4 py-3">
            <VariantRowView v={v} origin={origin} caseId={caseId} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariantRowView({ v, origin, caseId }: { v: VariantRow; origin: string; caseId: string }) {
  const [copied, setCopied] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessError, setAssessError] = useState<string | null>(null);
  const hasAttempt = v.responseSummary.some((r) => r.activityType === "answer_attempt");
  const url = `${origin}/case/${v.token}`;

  async function assess() {
    setAssessing(true);
    setAssessError(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: v.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      setAssessment(data.assessment as Assessment);
    } catch (e) {
      setAssessError(e instanceof Error ? e.message : "Assessment failed");
    } finally {
      setAssessing(false);
    }
  }
  const teamSize = v.learnerProfile.teamSize;
  const name = v.learnerProfile.displayName ?? `${v.learnerProfile.role} · ${v.learnerProfile.industry}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const totalChars = v.responseSummary.reduce((acc, r) => acc + r.chars, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {name}
            {teamSize ? (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                team of {teamSize}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {v.learnerProfile.industry} · {v.learnerProfile.role} · prior:{" "}
            {v.learnerProfile.priorKnowledge}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{v.viewCount} views</span>
          {v.lastViewedAt ? (
            <span>· last {new Date(v.lastViewedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted/30 px-2 py-1 text-xs font-mono">
          {url}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {v.conceptsMissing.length === 0 ? (
        <p className="text-xs text-emerald-600">✓ all must-cover concepts present</p>
      ) : (
        <p className="text-xs text-amber-600">
          missing concept(s): {v.conceptsMissing.join(", ")}
        </p>
      )}
      {v.preview ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Preview this team&apos;s case
          </summary>
          <div className="mt-2 rounded-md border bg-muted/20 p-2">
            <p className="whitespace-pre-wrap text-foreground">{v.preview.scenario}</p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-muted-foreground">
              {v.preview.discussionQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>
        </details>
      ) : null}
      {totalChars > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {v.responseSummary.length} response(s) · {totalChars} chars — read submissions
          </summary>
          <ul className="mt-2 space-y-2 pl-1">
            {v.responseSummary.map((r, i) => (
              <li key={i} className="rounded-md border bg-muted/20 p-2">
                <div className="text-[11px] font-medium text-muted-foreground">
                  {ACTIVITY_LABEL[r.activityType] ?? r.activityType}{" "}
                  <span className="font-mono">· {r.phaseId}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{r.text}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {hasAttempt ? (
        <div className="border-t pt-2">
          {assessment ? (
            <div className="rounded-md border bg-muted/20 p-2 text-xs">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Rubric assessment</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                  {assessment.band}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {assessment.criteria.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{c.criterion}:</span>{" "}
                    <span className="text-muted-foreground">{c.judgment}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">{assessment.overall}</p>
              <p className="mt-1 text-[10px] italic text-muted-foreground">
                Formative, LLM-generated against the rubric. Instructor reviews before use.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={assess}
              disabled={assessing}
              className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
            >
              {assessing ? "Assessing…" : "Assess answer against rubric"}
            </button>
          )}
          {assessError ? <p className="mt-1 text-xs text-flag">{assessError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
