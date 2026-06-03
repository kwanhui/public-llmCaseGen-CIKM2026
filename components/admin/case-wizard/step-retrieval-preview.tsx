import Link from "next/link";
import { getDisciplinePack } from "@/lib/disciplines";
import type { DisciplineId, Difficulty } from "@/lib/disciplines/types";
import type { RetrievedChunk } from "@/lib/retrieval/embedding-provider";
import { Button } from "@/components/ui/button";
import { EditBriefForm } from "@/components/admin/edit-brief-form";

interface Props {
  caseId: string;
  discipline: DisciplineId;
  difficulty: Difficulty;
  retrieved: RetrievedChunk[];
  embedded: boolean;
  corpusSize: number;
  brief: {
    learningObjective: string;
    difficulty: Difficulty;
    mustCoverConcepts: string[];
    targetLearnerProfile: { industry: string; role: string; priorKnowledge: string };
  };
  briefLocked: boolean;
}

export function StepRetrievalPreview({
  caseId,
  discipline,
  difficulty,
  retrieved,
  embedded,
  corpusSize,
  brief,
  briefLocked,
}: Props) {
  const pack = getDisciplinePack(discipline);

  return (
    <div className="space-y-6">
      {!briefLocked ? <EditBriefForm caseId={caseId} initial={brief} /> : null}
      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="text-muted-foreground">
          This is the grounding the LLM will receive in the next step. CaseForge embeds
          this case&apos;s specification and retrieves the most relevant passages from a
          curated {pack.label.toLowerCase()} corpus ({corpusSize} passages) by cosine
          similarity over <code className="font-mono text-xs">text-embedding-3-small</code>{" "}
          vectors, then conditions generation on them alongside the discipline exemplars.
        </p>
      </div>

      <section>
        <h3 className="text-sm font-medium">
          Retrieved references{" "}
          <span className="font-normal text-muted-foreground">
            (top {retrieved.length} by similarity)
          </span>
        </h3>
        {embedded ? (
          <div className="mt-3 space-y-2">
            {retrieved.map((r) => (
              <div key={r.chunk.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{r.chunk.title}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {r.score.toFixed(3)} · {r.chunk.id}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {r.chunk.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
            Corpus not embedded yet. Run{" "}
            <code className="font-mono">pnpm embed-corpus</code> (needs{" "}
            <code className="font-mono">OPENAI_API_KEY</code>) to build the vector store;
            generation will fall back to pack-only grounding until then.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium">Discipline system prompt</h3>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {pack.systemPrompt}
        </pre>
      </section>

      <section>
        <h3 className="text-sm font-medium">Style notes</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {pack.styleNotes.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium">Discipline vocabulary</h3>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pack.vocabulary.map((v) => (
            <li
              key={v}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {v}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium">
          Difficulty calibration · <span className="font-normal text-muted-foreground">{difficulty}</span>
        </h3>
        <p className="mt-2 rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">
          {pack.difficultyHints[difficulty]}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-medium">Reference exemplars ({pack.fewShots.length})</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Used for style and depth, not content. The LLM is instructed not to reuse them
          verbatim.
        </p>
        <div className="mt-3 space-y-3">
          {pack.fewShots.map((ex, i) => (
            <details
              key={i}
              className="group rounded-lg border bg-background"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40">
                <span className="mr-2 text-muted-foreground">Exemplar {i + 1}:</span>
                {ex.title}
                <span className="float-right text-muted-foreground transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="space-y-3 border-t bg-muted/20 px-4 py-3 text-xs leading-relaxed">
                <div>
                  <strong className="text-foreground">Scenario.</strong> {ex.scenario}
                </div>
                <div>
                  <strong className="text-foreground">Discussion questions.</strong>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {ex.discussionQuestions.map((q, j) => (
                      <li key={j}>{q}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <strong className="text-foreground">Rubric.</strong> {ex.rubric}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <div className="flex justify-between border-t pt-4">
        <Link href="/admin/cases">
          <Button variant="ghost" size="md">
            Cancel
          </Button>
        </Link>
        <Link href={`/admin/cases/${caseId}?step=3`}>
          <Button variant="primary" size="md">
            Continue → Generation
          </Button>
        </Link>
      </div>
    </div>
  );
}
