"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/input";
import { CaseMarkdown } from "./case-render";

interface Props {
  token: string;
  phaseId: string;
  initial: string;
  readOnly: boolean;
  // The case's discussion questions and model answers, revealed for self-check
  // only after the student has attempted their own answer.
  discussionQuestions: string[];
  modelAnswers: string[];
}

export function ActivityAnswerAttempt({
  token,
  phaseId,
  initial,
  readOnly,
  discussionQuestions,
  modelAnswers,
}: Props) {
  const [text, setText] = useState(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<{
    criteria: { criterion: string; judgment: string }[];
    overall: string;
    band: string;
  } | null>(null);
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | "error">("idle");
  const [disputed, setDisputed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintState, setHintState] = useState<"idle" | "loading" | "error">("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function getHint() {
    setHintState("loading");
    try {
      const res = await fetch(`/api/case/${token}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      setHint(data.hint);
      setHintState("idle");
    } catch {
      setHintState("error");
    }
  }

  async function getFeedback() {
    if (text.trim() === "") return;
    setFeedbackState("loading");
    try {
      const res = await fetch(`/api/case/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      setFeedback(data.assessment);
      setDisputed(false);
      setFeedbackState("idle");
    } catch {
      setFeedbackState("error");
    }
  }

  async function flagFeedback() {
    setDisputed(true);
    try {
      await fetch(`/api/case/${token}/feedback-flag`, { method: "POST" });
    } catch {
      // best-effort; the student already sees acknowledgement
    }
  }

  const persist = useCallback(
    async (next: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/case/${token}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phaseId,
            activityType: "answer_attempt",
            contentJson: { text: next },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState("saved");
        dirty.current = false;
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
      }
    },
    [token, phaseId],
  );

  function schedule(next: string) {
    dirty.current = true;
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 1000);
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const ModelAnswers = (
    <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
      {discussionQuestions.map((q, i) => (
        <li key={i}>
          <span className="font-medium">{q}</span>
          {modelAnswers[i] ? (
            <div className="mt-1 text-muted-foreground">
              <CaseMarkdown>{modelAnswers[i]}</CaseMarkdown>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );

  if (readOnly) {
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Your answer
        </h4>
        {text.trim() === "" ? (
          <p className="mt-2 text-xs italic text-muted-foreground">No answer submitted.</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium">Your answer</h4>
        <span
          className={
            saveState === "error"
              ? "text-xs text-flag"
              : saveState === "saved"
                ? "text-xs text-emerald-700 dark:text-emerald-400"
                : "text-xs text-muted-foreground"
          }
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed"
                : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Write your answer to the discussion questions, then check it against the model
        answer. Saved automatically as you type.
      </p>
      <label htmlFor={`answer-${phaseId}`} className="sr-only">
        Your answer to the discussion questions
      </label>
      <Textarea
        id={`answer-${phaseId}`}
        className="mt-3 min-h-[140px] resize-y"
        value={text}
        onChange={(e) => schedule(e.target.value)}
        placeholder="Your answer to the discussion questions…"
      />
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={getHint}
            disabled={hintState === "loading"}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          >
            {hintState === "loading" ? "Thinking…" : "Stuck? Get a hint"}
          </button>
          <button
            type="button"
            onClick={getFeedback}
            disabled={feedbackState === "loading" || text.trim() === ""}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          >
            {feedbackState === "loading" ? "Getting feedback…" : "Get feedback on my answer"}
          </button>
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={text.trim() === ""}
              title={text.trim() === "" ? "Write your answer first" : undefined}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reveal model answer to self-check
            </button>
          ) : null}
        </div>
        {hintState === "error" ? (
          <p className="text-xs text-flag">Could not get a hint. Please try again.</p>
        ) : null}
        {hint ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs"
          >
            <span className="font-medium text-primary">Hint:</span>{" "}
            <span className="text-foreground">{hint}</span>
          </div>
        ) : null}
        {feedbackState === "error" ? (
          <p className="text-xs text-flag">Could not generate feedback. Please try again.</p>
        ) : null}
        {feedback ? (
          <div role="status" aria-live="polite" className="rounded-md border bg-muted/20 p-3 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Formative feedback</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                {feedback.band}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {feedback.criteria.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.criterion}:</span>{" "}
                  <span className="text-muted-foreground">{c.judgment}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">{feedback.overall}</p>
            <p className="mt-1 text-[10px] italic text-muted-foreground">
              AI-generated formative feedback against the rubric, to guide revision. Not a grade.
            </p>
            <div className="mt-2">
              {disputed ? (
                <p className="text-[10px] text-muted-foreground">
                  Thanks — your instructor will see that this feedback was flagged.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={flagFeedback}
                  className="text-[10px] text-muted-foreground underline hover:text-foreground"
                >
                  This feedback seems off — flag for my instructor
                </button>
              )}
            </div>
          </div>
        ) : null}
        {revealed ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <h5 className="text-xs font-medium uppercase tracking-wider text-primary">
              Model answer (for self-check)
            </h5>
            {ModelAnswers}
          </div>
        ) : null}
      </div>
    </div>
  );
}
