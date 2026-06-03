"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { PhaseDefinition, ActivityType } from "@/lib/disciplines/types";

interface Props {
  caseId: string;
  initialPhases: PhaseDefinition[];
  defaultPhases: PhaseDefinition[];
  disabled: boolean;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  clarifying_questions: "Clarifying questions",
  notes: "Notes",
  answer_attempt: "Answer attempt (self-check)",
};

export function PhaseEditor({ caseId, initialPhases, defaultPhases, disabled }: Props) {
  const router = useRouter();
  const [phases, setPhases] = useState<PhaseDefinition[]>(
    [...initialPhases].sort((a, b) => a.order - b.order),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: PhaseDefinition[]) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/admin/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phasesJson: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState("saved");
        dirty.current = false;
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
      }
    },
    [caseId],
  );

  function schedule(next: PhaseDefinition[]) {
    dirty.current = true;
    setPhases(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 1500);
  }

  function updatePhase(id: string, patch: Partial<PhaseDefinition>) {
    schedule(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= phases.length) return;
    const swapped = phases.slice();
    [swapped[idx], swapped[target]] = [swapped[target], swapped[idx]];
    const renumbered = swapped.map((p, i) => ({ ...p, order: i }));
    schedule(renumbered);
  }

  function remove(id: string) {
    if (phases.length <= 1) return;
    const filtered = phases.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }));
    schedule(filtered);
  }

  function addPhase() {
    const next: PhaseDefinition = {
      id: crypto.randomUUID(),
      order: phases.length,
      label: "New phase",
      studentTitle: `${phases.length + 1}. New phase`,
      studentPrompt: "Write the prompt students will see for this phase.",
      activities: ["notes"],
    };
    schedule([...phases, next]);
  }

  function resetToDefault() {
    if (!confirm("Reset all phases to the discipline default? Edits will be lost.")) return;
    const cloned = JSON.parse(JSON.stringify(defaultPhases)) as PhaseDefinition[];
    schedule(cloned);
    router.refresh();
  }

  function toggleActivity(id: string, a: ActivityType) {
    const phase = phases.find((p) => p.id === id);
    if (!phase) return;
    const has = phase.activities.includes(a);
    const next = has
      ? phase.activities.filter((x) => x !== a)
      : [...phase.activities, a];
    updatePhase(id, { activities: next });
  }

  return (
    <section className="rounded-lg border bg-background">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">Discipline phases</h3>
          <p className="text-xs text-muted-foreground">
            Each phase is what the cohort works on between instructor-paced advances.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            disabled={disabled}
          >
            Reset to default
          </Button>
        </div>
      </header>
      <ol className="divide-y">
        {phases.map((p, i) => (
          <li key={p.id} className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
              <Input
                value={p.label}
                onChange={(e) => updatePhase(p.id, { label: e.target.value })}
                disabled={disabled}
                className="text-sm font-medium"
              />
              <div className="ml-auto flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === phases.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(p.id)}
                  disabled={disabled || phases.length === 1}
                  aria-label="Delete phase"
                >
                  ×
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Student-facing title
              </label>
              <Input
                value={p.studentTitle}
                onChange={(e) => updatePhase(p.id, { studentTitle: e.target.value })}
                disabled={disabled}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Student prompt (Markdown)
              </label>
              <Textarea
                value={p.studentPrompt}
                onChange={(e) => updatePhase(p.id, { studentPrompt: e.target.value })}
                disabled={disabled}
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Discipline hint (optional)
              </label>
              <Input
                value={p.disciplineHint ?? ""}
                onChange={(e) =>
                  updatePhase(p.id, {
                    disciplineHint: e.target.value || undefined,
                  })
                }
                disabled={disabled}
                className="mt-1"
                placeholder="A short tip shown alongside the prompt"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Suggested time (minutes, optional)
              </label>
              <Input
                type="number"
                min={1}
                max={240}
                value={p.suggestedMinutes ?? ""}
                onChange={(e) =>
                  updatePhase(p.id, {
                    suggestedMinutes: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                disabled={disabled}
                className="mt-1 w-32"
                placeholder="e.g. 15"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Activities</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["clarifying_questions", "notes", "answer_attempt"] as ActivityType[]).map((a) => {
                  const on = p.activities.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleActivity(p.id, a)}
                      disabled={disabled}
                      className={
                        on
                          ? "rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
                          : "rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/40"
                      }
                    >
                      {ACTIVITY_LABELS[a]}
                    </button>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPhase}
          disabled={disabled || phases.length >= 10}
        >
          + Add phase
        </Button>
      </div>
    </section>
  );
}
