"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PhaseDefinition } from "@/lib/disciplines/types";

interface Props {
  caseId: string;
  status: string;
  phases: PhaseDefinition[];
  currentPhaseId: string | null;
}

export function AdvancePhaseBanner({ caseId, status, phases, currentPhaseId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (status !== "approved" && status !== "released") return null;

  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const currentIdx = sorted.findIndex((p) => p.id === currentPhaseId);
  const total = sorted.length;
  const atLast = currentIdx === total - 1;

  async function release() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/release`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Release failed.");
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/advance-phase`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Advance failed.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return (
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Approved · ready to release</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Releasing sets the case to phase 1 of {total} and unlocks the student URLs.
            </p>
          </div>
          <Button variant="primary" onClick={release} loading={busy} disabled={busy}>
            Release to students
          </Button>
        </div>
        {err ? <p className="mt-2 text-xs text-flag">{err}</p> : null}
      </div>
    );
  }

  // status === 'released'
  const current = sorted[currentIdx];
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            Live · Phase {currentIdx + 1} of {total}
            {current ? ` — ${current.label}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {atLast
              ? "Final phase active — students can see discussion questions and rubric."
              : "Advance the cohort to the next phase. Students' current-phase work locks to read-only when you advance."}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={advance}
          loading={busy}
          disabled={busy || atLast}
        >
          {atLast ? "Final phase" : "Advance to next phase →"}
        </Button>
      </div>
      {err ? <p className="mt-2 text-xs text-flag">{err}</p> : null}
    </div>
  );
}
