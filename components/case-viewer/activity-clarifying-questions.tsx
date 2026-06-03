"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  token: string;
  phaseId: string;
  initial: string[];
  readOnly: boolean;
}

export function ActivityClarifyingQuestions({ token, phaseId, initial, readOnly }: Props) {
  const [items, setItems] = useState<string[]>(
    initial.length > 0 ? initial : [""],
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: string[]) => {
      const cleaned = next.map((s) => s.trim()).filter(Boolean);
      setSaveState("saving");
      try {
        const res = await fetch(`/api/case/${token}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phaseId,
            activityType: "clarifying_questions",
            contentJson: { items: cleaned },
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

  function schedule(next: string[]) {
    dirty.current = true;
    setItems(next);
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

  if (readOnly) {
    const cleaned = items.map((s) => s.trim()).filter(Boolean);
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Clarifying questions
        </h4>
        {cleaned.length === 0 ? (
          <p className="mt-2 text-xs italic text-muted-foreground">
            No questions submitted.
          </p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {cleaned.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium">Clarifying questions</h4>
        <SaveDot state={saveState} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        What would you ask before proceeding? Press Enter for a new question. Saved
        automatically.
      </p>
      <ol className="mt-3 space-y-2">
        {items.map((q, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              value={q}
              onChange={(e) => {
                const next = items.slice();
                next[i] = e.target.value;
                schedule(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  schedule([...items.slice(0, i + 1), "", ...items.slice(i + 1)]);
                  // Focus next input on next tick.
                  requestAnimationFrame(() => {
                    const inputs = document.querySelectorAll<HTMLInputElement>(
                      ".cf-clarifying-input",
                    );
                    inputs[i + 1]?.focus();
                  });
                }
                if (e.key === "Backspace" && q === "" && items.length > 1) {
                  e.preventDefault();
                  schedule([...items.slice(0, i), ...items.slice(i + 1)]);
                }
              }}
              className="cf-clarifying-input"
              aria-label={`Clarifying question ${i + 1}`}
              placeholder={i === 0 ? "What additional information would you need?" : ""}
            />
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => schedule([...items, ""])}
      >
        + Add question
      </Button>
    </div>
  );
}

function SaveDot({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const map: Record<typeof state, string> = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
  };
  return (
    <span
      className={
        state === "error"
          ? "text-xs text-flag"
          : state === "saved"
            ? "text-xs text-emerald-700 dark:text-emerald-400"
            : "text-xs text-muted-foreground"
      }
    >
      {map[state]}
    </span>
  );
}
