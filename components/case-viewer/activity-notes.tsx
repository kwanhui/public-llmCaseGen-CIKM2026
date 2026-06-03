"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/input";

interface Props {
  token: string;
  phaseId: string;
  initial: string;
  readOnly: boolean;
}

export function ActivityNotes({ token, phaseId, initial, readOnly }: Props) {
  const [text, setText] = useState(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/case/${token}/responses`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phaseId,
            activityType: "notes",
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

  if (readOnly) {
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Notes
        </h4>
        {text.trim() === "" ? (
          <p className="mt-2 text-xs italic text-muted-foreground">No notes submitted.</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-medium">Notes</h4>
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
        Free-text scratchpad for this phase. Saved automatically as you type.
      </p>
      <label htmlFor={`notes-${phaseId}`} className="sr-only">
        Working notes for this phase
      </label>
      <Textarea
        id={`notes-${phaseId}`}
        className="mt-3 min-h-[140px] resize-y"
        value={text}
        onChange={(e) => schedule(e.target.value)}
        placeholder="Your working notes for this phase…"
      />
    </div>
  );
}
