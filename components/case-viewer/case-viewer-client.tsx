"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaseMarkdown } from "./case-render";
import { PhaseStepper } from "./phase-stepper";
import { ActivityClarifyingQuestions } from "./activity-clarifying-questions";
import { ActivityNotes } from "./activity-notes";
import { ActivityAnswerAttempt } from "./activity-answer-attempt";
import { ReadingControls, useReadingPrefs, SCALE_REM } from "./reading-controls";
import type { PhaseDefinition } from "@/lib/disciplines/types";

interface ResponseMap {
  [phaseId: string]: {
    clarifying_questions?: { items: string[] };
    notes?: { text: string };
    answer_attempt?: { text: string };
  };
}

interface Props {
  token: string;
  disciplineLabel: string;
  caseRef: string;
  learningObjective: string;
  learningOutcomes: string[];
  scenario: string;
  phases: PhaseDefinition[];
  initialCurrentPhaseId: string | null;
  status: "draft" | "generating" | "editing" | "approved" | "released" | string;
  initialResponses: ResponseMap;
  glossary: { term: string; definition: string }[];
  finalContent: { discussionQuestions: string[]; modelAnswers: string[]; rubric: string };
}

export function CaseViewerClient({
  token,
  disciplineLabel,
  caseRef,
  learningObjective,
  learningOutcomes,
  scenario,
  phases,
  initialCurrentPhaseId,
  status,
  initialResponses,
  glossary,
  finalContent,
}: Props) {
  const router = useRouter();
  const [currentPhaseId, setCurrentPhaseId] = useState<string | null>(initialCurrentPhaseId);
  const [toast, setToast] = useState<string | null>(null);
  const [reading, setReading] = useReadingPrefs();
  const [rated, setRated] = useState<number | null>(null);
  const reportedView = useRef(false);

  async function rateCase(rating: number) {
    setRated(rating);
    try {
      await fetch(`/api/case/${token}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // best-effort; the student already sees their choice acknowledged
    }
  }


  // Log a view event once per mount.
  useEffect(() => {
    if (reportedView.current) return;
    reportedView.current = true;
    fetch(`/api/case/${token}/view`, { method: "POST" }).catch(() => {});
  }, [token]);

  const [checking, setChecking] = useState(false);

  // Check once for phase advancement. Shared by the interval, the manual
  // refresh button, and the tab-became-visible handler.
  const checkState = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/case/${token}/state`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { currentPhaseId: string | null; status: string };
      if (data.currentPhaseId !== currentPhaseId) {
        setCurrentPhaseId(data.currentPhaseId);
        const advancedTo = phases.find((p) => p.id === data.currentPhaseId);
        if (advancedTo) {
          setToast(`Advanced to ${advancedTo.label}`);
          setTimeout(() => setToast(null), 4500);
        }
        router.refresh();
      }
    } catch {
      // ignore polling errors
    } finally {
      setChecking(false);
    }
  }, [token, currentPhaseId, phases, router]);

  // Poll only while the tab is visible, and stop entirely when it is hidden, so
  // a backgrounded tab on a metered or low-bandwidth connection uses no data.
  // The interval is a slower 15s; a manual "Check now" button covers urgency.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(checkState, 15000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        checkState();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkState]);

  function downloadMyWork() {
    const lines: string[] = [];
    lines.push(`# ${disciplineLabel} case — my work`);
    lines.push("");
    lines.push(`Exported ${new Date().toLocaleString()} from CaseForge.`);
    lines.push("");
    lines.push(`## Scenario`);
    lines.push(scenario);
    lines.push("");
    for (const phase of [...phases].sort((a, b) => a.order - b.order)) {
      const r = initialResponses[phase.id];
      if (!r) continue;
      const hasAny =
        (r.clarifying_questions?.items?.some((x) => x.trim()) ?? false) ||
        (r.notes?.text?.trim() ?? "") !== "" ||
        (r.answer_attempt?.text?.trim() ?? "") !== "";
      if (!hasAny) continue;
      lines.push(`## ${phase.studentTitle}`);
      if (r.clarifying_questions?.items?.length) {
        lines.push(`**Clarifying questions**`);
        for (const q of r.clarifying_questions.items.filter((x) => x.trim())) lines.push(`- ${q}`);
      }
      if (r.notes?.text?.trim()) {
        lines.push(`**Notes**`);
        lines.push(r.notes.text.trim());
      }
      if (r.answer_attempt?.text?.trim()) {
        lines.push(`**My answer**`);
        lines.push(r.answer_attempt.text.trim());
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caseforge-my-work-${disciplineLabel.toLowerCase().replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const currentIdx = sortedPhases.findIndex((p) => p.id === currentPhaseId);
  const visiblePhases =
    currentIdx >= 0 ? sortedPhases.slice(0, currentIdx + 1) : [];
  const isReleased = status === "released";
  const onLastPhase =
    currentIdx >= 0 && currentIdx === sortedPhases.length - 1;

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          role="status"
          className="animate-slide-down sticky top-2 z-10 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {toast}
        </div>
      ) : null}

      {!isReleased ? (
        <div className="rounded-lg border bg-muted/20 p-6 text-sm">
          <strong>Not yet released.</strong> Your instructor hasn&apos;t released this
          case yet. The page checks every so often while it is open and pauses when the
          tab is in the background to save data.
          <div className="mt-3">
            <button
              type="button"
              onClick={checkState}
              disabled={checking}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check now"}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{ fontSize: SCALE_REM[reading.scale] }}
          className={reading.comfort ? "leading-loose tracking-wide" : undefined}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={checkState}
              disabled={checking}
              className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
              title="Check whether the instructor has advanced the phase"
            >
              {checking ? "Checking…" : "Check now"}
            </button>
            <ReadingControls prefs={reading} onChange={setReading} />
          </div>
          <header className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              {disciplineLabel} case
            </p>
            <p className="text-xs text-muted-foreground">
              This link is shared by your team. Notes and answers are saved per phase
              and visible to everyone on the team, so coordinate who records what.
              Any suggested phase times are guidance only; your instructor controls when
              the class moves on, so taking longer never locks you out.
            </p>
            <PhaseStepper phases={sortedPhases} currentPhaseId={currentPhaseId} />
          </header>

          <section className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your progress
              </h2>
              {currentIdx >= 0 ? (
                <span className="text-xs text-muted-foreground">
                  Phase {currentIdx + 1} of {sortedPhases.length}
                </span>
              ) : null}
            </div>
            {currentIdx >= 0 ? (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={currentIdx + 1}
                aria-valuemin={0}
                aria-valuemax={sortedPhases.length}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((currentIdx + 1) / sortedPhases.length) * 100}%` }}
                />
              </div>
            ) : null}
            {learningOutcomes.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">{learningObjective}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  What this case develops
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {learningOutcomes.map((o, i) => (
                    <li
                      key={i}
                      className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border bg-background p-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Scenario
            </h2>
            <div className="mt-3">
              <CaseMarkdown>{scenario}</CaseMarkdown>
            </div>
          </section>

          {glossary.length > 0 ? (
            <details className="rounded-xl border bg-muted/10 p-4">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Key terms ({glossary.length})
              </summary>
              <dl className="mt-3 space-y-2 text-sm">
                {glossary.map((g, i) => (
                  <div key={i}>
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-muted-foreground">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}

          {visiblePhases.map((phase) => {
            const isCurrent = phase.id === currentPhaseId;
            const stored = initialResponses[phase.id] ?? {};
            return (
              <section
                key={phase.id}
                className={
                  isCurrent
                    ? "rounded-xl border-2 border-primary bg-primary/5 p-6"
                    : "rounded-xl border bg-muted/20 p-6"
                }
              >
                <header className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-medium">{phase.studentTitle}</h3>
                    {phase.suggestedMinutes ? (
                      <span className="text-xs text-muted-foreground" title="Suggested working time — guidance only, the page does not auto-advance">
                        ~{phase.suggestedMinutes} min
                      </span>
                    ) : null}
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      Active phase
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Completed · read-only
                    </span>
                  )}
                </header>
                <div className="mt-3">
                  <CaseMarkdown>{phase.studentPrompt}</CaseMarkdown>
                </div>
                {phase.disciplineHint ? (
                  <p className="mt-3 rounded-md border-l-2 border-primary/40 bg-background px-3 py-2 text-xs italic text-muted-foreground">
                    {phase.disciplineHint}
                  </p>
                ) : null}

                <div className="mt-5 space-y-3">
                  {phase.activities.includes("clarifying_questions") ? (
                    <ActivityClarifyingQuestions
                      token={token}
                      phaseId={phase.id}
                      initial={stored.clarifying_questions?.items ?? []}
                      readOnly={!isCurrent}
                    />
                  ) : null}
                  {phase.activities.includes("notes") ? (
                    <ActivityNotes
                      token={token}
                      phaseId={phase.id}
                      initial={stored.notes?.text ?? ""}
                      readOnly={!isCurrent}
                    />
                  ) : null}
                  {phase.activities.includes("answer_attempt") ? (
                    <ActivityAnswerAttempt
                      token={token}
                      phaseId={phase.id}
                      initial={stored.answer_attempt?.text ?? ""}
                      readOnly={!isCurrent}
                      discussionQuestions={finalContent.discussionQuestions}
                      modelAnswers={finalContent.modelAnswers}
                    />
                  ) : null}
                </div>
              </section>
            );
          })}

          {onLastPhase ? (
            <section className="rounded-xl border bg-background p-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Discussion questions
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                {finalContent.discussionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
              <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Rubric
              </h3>
              <div className="mt-3 whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">
                {finalContent.rubric}
              </div>
            </section>
          ) : null}

          <footer className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadMyWork}
                className="rounded-md border px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Download my work
              </button>
              {rated ? (
                <span className="text-muted-foreground">Thanks for rating this case.</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Rate this case:</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => rateCase(n)}
                      aria-label={`Rate ${n} out of 5`}
                      className="text-base leading-none text-muted-foreground hover:text-amber-500"
                    >
                      ★
                    </button>
                  ))}
                </span>
              )}
            </div>
            <p>
              No account or personal details are needed to use this case. Your work
              is saved against the team link, and any view fingerprint is one-way
              hashed before storage. You can download your notes and answers at any
              time to keep for a portfolio.
            </p>
            <details className="rounded-md border bg-muted/10 p-3">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                About this case &amp; how to cite it
              </summary>
              <p className="mt-2">
                This case was drafted by an AI language model, grounded in a curated
                discipline corpus, and reviewed and approved by your instructor before
                release. If you refer to it in your own work, you can cite it as:
              </p>
              <p className="mt-1 font-mono text-[11px] text-foreground">
                CaseForge {disciplineLabel} case {caseRef} (AI-generated, instructor-approved),
                accessed {new Date().toISOString().slice(0, 10)}.
              </p>
            </details>
            <p>CaseForge · CIKM 2026 Demo Track</p>
          </footer>
        </div>
      )}
    </div>
  );
}
