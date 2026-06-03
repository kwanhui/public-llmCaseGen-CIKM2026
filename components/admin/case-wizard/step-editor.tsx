"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { CaseContent, CaseSection } from "@/lib/generation/schema";
import type { DifficultySignal } from "@/lib/generation/generate-case";

interface Props {
  caseId: string;
  initialContent: CaseContent;
  status: string;
  conceptCoverage: { missing: string[]; covered: string[] };
  difficulty: DifficultySignal;
  quantitative: boolean;
}

const SECTION_META: Record<
  CaseSection,
  { heading: string; description: string }
> = {
  scenario: {
    heading: "Scenario",
    description: "350–600 words. Markdown supported.",
  },
  discussionQuestions: {
    heading: "Discussion questions",
    description: "4–6 open-ended questions, ordered from framing to evaluation.",
  },
  modelAnswers: {
    heading: "Model answers",
    description: "Matched 1:1 to discussion questions.",
  },
  rubric: {
    heading: "Rubric",
    description: "4 weighted criteria with single-sentence excellence descriptors.",
  },
};

export function StepEditor({
  caseId,
  initialContent,
  status,
  conceptCoverage,
  difficulty,
  quantitative,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState<CaseContent>(initialContent);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [regeneratingSection, setRegeneratingSection] = useState<CaseSection | null>(null);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: CaseContent) => {
      setSavingState("saving");
      try {
        const res = await fetch(`/api/admin/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentJson: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSavingState("saved");
        dirty.current = false;
        setTimeout(() => setSavingState("idle"), 1500);
      } catch {
        setSavingState("error");
      }
    },
    [caseId],
  );

  function scheduleSave(next: CaseContent) {
    dirty.current = true;
    setContent(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 1500);
  }

  // Flush on tab close/navigation to avoid losing the last edit.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function regenerate(section: CaseSection) {
    setRegeneratingSection(section);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/regenerate-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const { contentJson } = (await res.json()) as { contentJson: CaseContent };
      setContent(contentJson);
      dirty.current = false;
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 1500);
    } catch (err) {
      setSavingState("error");
      console.error(err);
    } finally {
      setRegeneratingSection(null);
    }
  }

  async function approve() {
    setApproveErr(null);
    setApproving(true);
    try {
      // Flush any pending edit first.
      if (dirty.current) await persist(content);
      const res = await fetch(`/api/admin/cases/${caseId}/approve`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
      router.push(`/admin/cases/${caseId}`);
    } catch (err) {
      setApproveErr(err instanceof Error ? err.message : "Approve failed.");
      setApproving(false);
    }
  }

  const isApproved = status === "approved" || status === "released";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SaveIndicator state={savingState} />
        {!isApproved ? (
          <Button
            variant="primary"
            size="md"
            onClick={approve}
            loading={approving}
            disabled={approving}
          >
            {approving ? "Approving..." : "Approve & Release"}
          </Button>
        ) : (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Approved · ready for variants
          </span>
        )}
      </div>

      {conceptCoverage.missing.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-flag/40 bg-flag/5 px-3 py-2 text-sm text-flag"
        >
          <strong>Concept(s) not detected:</strong> {conceptCoverage.missing.join(", ")}.
          Consider regenerating the scenario or editing manually to surface them.
        </div>
      ) : null}

      <div
        className={
          difficulty.band === "as-requested"
            ? "rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
            : "rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        }
        title="Surface proxy from scenario length, distinct numeric tokens, and question count. Not a validated difficulty measure."
      >
        <strong>Difficulty signal:</strong> {difficulty.note}{" "}
        <span className="text-muted-foreground">
          ({difficulty.scenarioWords} words, {difficulty.numericTokens} numbers,{" "}
          {difficulty.questionCount} questions)
        </span>
      </div>

      {quantitative && difficulty.numericTokens > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <strong>Check the figures.</strong> This draft contains{" "}
          {difficulty.numericTokens} numeric value
          {difficulty.numericTokens === 1 ? "" : "s"}. CaseForge does not verify
          arithmetic, so confirm the numbers reconcile before you approve.
        </div>
      ) : null}

      {approveErr ? (
        <div
          role="alert"
          className="rounded-md border border-flag/40 bg-flag/5 px-3 py-2 text-sm text-flag"
        >
          {approveErr}
        </div>
      ) : null}

      <SectionEditor
        section="scenario"
        value={content.scenario}
        onChange={(v) => scheduleSave({ ...content, scenario: v })}
        regenerate={() => regenerate("scenario")}
        regenerating={regeneratingSection === "scenario"}
        disabled={isApproved}
      />

      <SectionListEditor
        section="discussionQuestions"
        items={content.discussionQuestions}
        onChange={(items) => scheduleSave({ ...content, discussionQuestions: items })}
        regenerate={() => regenerate("discussionQuestions")}
        regenerating={regeneratingSection === "discussionQuestions"}
        disabled={isApproved}
      />

      <SectionListEditor
        section="modelAnswers"
        items={content.modelAnswers}
        onChange={(items) => scheduleSave({ ...content, modelAnswers: items })}
        regenerate={() => regenerate("modelAnswers")}
        regenerating={regeneratingSection === "modelAnswers"}
        disabled={isApproved}
      />

      <SectionEditor
        section="rubric"
        value={content.rubric}
        onChange={(v) => scheduleSave({ ...content, rubric: v })}
        regenerate={() => regenerate("rubric")}
        regenerating={regeneratingSection === "rubric"}
        disabled={isApproved}
      />
    </div>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const map: Record<typeof state, { label: string; color: string }> = {
    idle: { label: "All changes saved", color: "text-muted-foreground" },
    saving: { label: "Saving…", color: "text-muted-foreground" },
    saved: { label: "Saved", color: "text-emerald-700 dark:text-emerald-400" },
    error: { label: "Save failed — retry", color: "text-flag" },
  };
  const { label, color } = map[state];
  return <span className={`text-xs ${color}`}>{label}</span>;
}

function SectionEditor({
  section,
  value,
  onChange,
  regenerate,
  regenerating,
  disabled,
}: {
  section: CaseSection;
  value: string;
  onChange: (v: string) => void;
  regenerate: () => void;
  regenerating: boolean;
  disabled: boolean;
}) {
  const meta = SECTION_META[section];
  return (
    <section className="rounded-lg border bg-background">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-2">
        <div>
          <h3 className="text-sm font-medium">{meta.heading}</h3>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={regenerate}
          loading={regenerating}
          disabled={disabled || regenerating}
        >
          Regenerate
        </Button>
      </header>
      <Textarea
        className="min-h-[160px] resize-y rounded-none border-0 bg-transparent text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || regenerating}
      />
    </section>
  );
}

function SectionListEditor({
  section,
  items,
  onChange,
  regenerate,
  regenerating,
  disabled,
}: {
  section: CaseSection;
  items: string[];
  onChange: (items: string[]) => void;
  regenerate: () => void;
  regenerating: boolean;
  disabled: boolean;
}) {
  const meta = SECTION_META[section];
  return (
    <section className="rounded-lg border bg-background">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-2">
        <div>
          <h3 className="text-sm font-medium">{meta.heading}</h3>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={regenerate}
          loading={regenerating}
          disabled={disabled || regenerating}
        >
          Regenerate
        </Button>
      </header>
      <ol className="divide-y">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-2 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
            <Textarea
              className="min-h-[60px] resize-y border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={item}
              onChange={(e) => {
                const next = items.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
              disabled={disabled || regenerating}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

