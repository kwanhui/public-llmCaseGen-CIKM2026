"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CaseContent } from "@/lib/generation/schema";

interface Props {
  caseId: string;
  hasExistingContent: boolean;
}

export function StepGeneration({ caseId, hasExistingContent }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done">(
    hasExistingContent ? "done" : "idle",
  );
  const [content, setContent] = useState<CaseContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick an elapsed-seconds counter while generating so the wait reads as live
  // progress rather than a frozen screen. The counter is reset in generate();
  // the effect only owns the interval lifecycle.
  useEffect(() => {
    if (phase !== "running") return;
    const handle = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(handle);
  }, [phase]);

  async function generate() {
    setElapsed(0);
    setPhase("running");
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/generate`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      const { contentJson } = (await res.json()) as { contentJson: CaseContent };
      setContent(contentJson);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-6">
      {phase === "idle" && (
        <div className="rounded-lg border-2 border-dashed bg-muted/20 p-8 text-center">
          <h3 className="text-base font-medium">
            {hasExistingContent ? "Regenerate from scratch" : "Ready to generate"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            CaseForge will produce a structured draft (scenario, discussion questions,
            model answers, rubric) grounded in the discipline pack. Generation typically
            takes 10–40 seconds.
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="mt-5"
            onClick={generate}
          >
            {hasExistingContent ? "Regenerate full case" : "Generate case"}
          </Button>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border bg-muted/30 p-8 text-center animate-fade-in">
          <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden="true"
            />
            Generating draft… {elapsed}s elapsed (usually 10–40s)
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Retrieving grounding, then drafting scenario, questions, model answers,
            and rubric. The authoring-time clock is running; it stops when you click
            Approve.
          </p>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-flag/40 bg-flag/5 px-3 py-2 text-sm text-flag"
        >
          {error}
        </div>
      ) : null}

      {phase === "done" && content && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-lg border bg-emerald-500/5 px-4 py-3 text-sm">
            <strong>Draft ready.</strong> Review below, then continue to the editor to
            make changes.
          </div>

          <Section heading="Scenario" body={content.scenario} />
          <Section
            heading="Discussion questions"
            body={content.discussionQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")}
          />
          <Section
            heading="Model answers"
            body={content.modelAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n\n")}
          />
          <Section heading="Rubric" body={content.rubric} />

          <div className="flex justify-between border-t pt-4">
            <Button type="button" variant="ghost" onClick={generate}>
              Regenerate
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push(`/admin/cases/${caseId}?step=4`)}
            >
              Continue → Editor
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && !content && hasExistingContent ? (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          A draft already exists for this case. Continue to the editor, or regenerate to
          start fresh.
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="ghost" onClick={generate}>
              Regenerate
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push(`/admin/cases/${caseId}?step=4`)}
            >
              Continue → Editor
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="rounded-lg border bg-background">
      <h4 className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {heading}
      </h4>
      <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">{body}</div>
    </section>
  );
}
