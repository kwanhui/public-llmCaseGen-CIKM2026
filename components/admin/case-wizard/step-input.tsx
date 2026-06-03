"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DISCIPLINE_PACKS, DISCIPLINE_IDS } from "@/lib/disciplines";
import type { DisciplineId, Difficulty } from "@/lib/disciplines/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = ["novice", "intermediate", "advanced"];

const HINTS = {
  objective: "Apply the dividend discount model to value a regional bank under uncertainty.",
  concept: "DDM",
  industry: "retail banking",
  role: "junior analyst",
  prior: "intermediate",
} as const;

export function StepInput() {
  const router = useRouter();
  const [discipline, setDiscipline] = useState<DisciplineId>("finance");
  const [learningObjective, setLearningObjective] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [conceptInput, setConceptInput] = useState("");
  const [concepts, setConcepts] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [priorKnowledge, setPriorKnowledge] = useState("intermediate");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addConcept() {
    const v = conceptInput.trim();
    if (!v) return;
    if (concepts.includes(v)) {
      setConceptInput("");
      return;
    }
    setConcepts([...concepts, v]);
    setConceptInput("");
  }

  function removeConcept(c: string) {
    setConcepts(concepts.filter((x) => x !== c));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (learningObjective.trim().length < 10) {
      setError("Learning objective is too short.");
      return;
    }
    if (!industry.trim() || !role.trim()) {
      setError("Industry and role are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discipline,
          learningObjective: learningObjective.trim(),
          difficulty,
          mustCoverConcepts: concepts,
          targetLearnerProfile: {
            industry: industry.trim(),
            role: role.trim(),
            priorKnowledge: priorKnowledge.trim(),
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/admin/cases/${id}?step=2`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <details className="rounded-lg border bg-muted/20 p-3 text-sm">
        <summary className="cursor-pointer font-medium">New here? How CaseForge builds a case</summary>
        <p className="mt-2 text-muted-foreground">
          You write a short brief — what you want students to learn, the key concepts to
          cover, and who the learner is. CaseForge retrieves relevant notes from the
          discipline corpus and an AI model drafts a full case (scenario, questions, model
          answers, rubric) from them. You then review and edit every part, and nothing
          reaches a student until you approve it. You can regenerate any section or the
          whole draft if it is not right.
        </p>
      </details>
      <section>
        <label className="block text-sm font-medium">Discipline</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Each discipline ships its own system prompt, exemplars, and default phase
          sequence.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {DISCIPLINE_IDS.map((id) => {
            const pack = DISCIPLINE_PACKS[id];
            const active = discipline === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDiscipline(id)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  active
                    ? "border-2 border-primary bg-primary/5"
                    : "hover:border-foreground/20 hover:bg-muted/40",
                )}
                aria-pressed={active}
              >
                <div className="text-sm font-medium">{pack.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{pack.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label htmlFor="objective" className="block text-sm font-medium">
          Learning objective
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          The pedagogical anchor — what the learner should be able to do after working the
          case. Press Tab to fill an example.
        </p>
        <Textarea
          id="objective"
          value={learningObjective}
          onChange={(e) => setLearningObjective(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !learningObjective.trim()) {
              e.preventDefault();
              setLearningObjective(HINTS.objective);
            }
          }}
          placeholder={HINTS.objective}
          className="mt-2"
          rows={3}
        />
      </section>

      <section>
        <label className="block text-sm font-medium">Difficulty</label>
        <div className="mt-2 inline-flex rounded-md border p-0.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={cn(
                "rounded-[5px] px-3 py-1.5 text-sm capitalize transition-colors",
                difficulty === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label htmlFor="concept" className="block text-sm font-medium">
          Must-cover concepts
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Concepts the case must surface. Press Enter to add; Tab to fill an example.
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            id="concept"
            value={conceptInput}
            onChange={(e) => setConceptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addConcept();
              } else if (e.key === "Tab" && !conceptInput.trim()) {
                e.preventDefault();
                setConceptInput(HINTS.concept);
              }
            }}
            placeholder={HINTS.concept}
          />
          <Button type="button" onClick={addConcept} variant="secondary">
            Add
          </Button>
        </div>
        {concepts.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {concepts.map((c) => (
              <li
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeConcept(c)}
                  aria-label={`Remove ${c}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <label className="block text-sm font-medium">Target learner profile</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Personalisation drives the surface details (industry, role, framing) — the
          learning objective stays fixed. Tab to fill examples.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="industry" className="block text-xs text-muted-foreground">
              Industry / practice context
            </label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !industry.trim()) {
                  e.preventDefault();
                  setIndustry(HINTS.industry);
                }
              }}
              placeholder={HINTS.industry}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-xs text-muted-foreground">
              Role
            </label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !role.trim()) {
                  e.preventDefault();
                  setRole(HINTS.role);
                }
              }}
              placeholder={HINTS.role}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="prior" className="block text-xs text-muted-foreground">
              Prior knowledge
            </label>
            <Input
              id="prior"
              value={priorKnowledge}
              onChange={(e) => setPriorKnowledge(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !priorKnowledge.trim()) {
                  e.preventDefault();
                  setPriorKnowledge(HINTS.prior);
                }
              }}
              placeholder={HINTS.prior}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-flag/40 bg-flag/5 px-3 py-2 text-sm text-flag"
        >
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" loading={submitting}>
          {submitting ? "Creating draft..." : "Continue → Retrieval preview"}
        </Button>
      </div>
    </form>
  );
}
