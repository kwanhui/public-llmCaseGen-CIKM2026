"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  caseId: string;
}

export function SpawnVariantsForm({ caseId }: Props) {
  const router = useRouter();
  const CSV_HINT =
    "Team Alpha, retail banking, junior analyst, intermediate, 4\nTeam Beta, fintech, product manager, novice, 5";

  const [count, setCount] = useState(3);
  const [teamSize, setTeamSize] = useState(4);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; withMissing: number; failed: number } | null>(null);

  const plannedCount = csv.trim() ? parseCsv(csv).length : count;

  function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const overrides: Array<{
      displayName?: string;
      industry?: string;
      role?: string;
      priorKnowledge?: string;
      teamSize?: number;
    }> = [];
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols.length === 0 || cols.every((c) => !c)) continue;
      const size = cols[4] ? parseInt(cols[4], 10) : undefined;
      overrides.push({
        displayName: cols[0] || undefined,
        industry: cols[1] || undefined,
        role: cols[2] || undefined,
        priorKnowledge: cols[3] || undefined,
        teamSize: Number.isFinite(size) ? size : undefined,
      });
    }
    return overrides;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const overrides = csv.trim() ? parseCsv(csv) : [];
      const body: { count?: number; overrides?: typeof overrides; teamSize: number } = {
        teamSize,
      };
      if (overrides.length > 0) body.overrides = overrides;
      else body.count = count;
      const res = await fetch(`/api/admin/cases/${caseId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        created: { id: string; token: string; conceptsMissing?: string[] }[];
        errors: { index: number; message: string }[];
      };
      if (data.errors.length > 0 && data.created.length === 0) {
        setErr(`All variant generations failed (${data.errors[0].message}).`);
        setBusy(false);
        return;
      }
      setResult({
        created: data.created.length,
        withMissing: data.created.filter((c) => (c.conceptsMissing?.length ?? 0) > 0).length,
        failed: data.errors.length,
      });
      setCsv("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Spawn failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex gap-4">
        <div>
          <label htmlFor="vcount" className="block text-sm font-medium">
            Number of teams
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            One customised case per team. Used when no CSV is provided.
          </p>
          <Input
            id="vcount"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="mt-2 w-24"
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="vteamsize" className="block text-sm font-medium">
            Students per team
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjustable; the team shares one link.
          </p>
          <Input
            id="vteamsize"
            type="number"
            min={1}
            max={12}
            value={teamSize}
            onChange={(e) => setTeamSize(Number(e.target.value) || 1)}
            className="mt-2 w-24"
            disabled={busy}
          />
        </div>
      </div>
      <div>
        <label htmlFor="vcsv" className="block text-sm font-medium">
          Per-team overrides (optional CSV)
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          One team per line. Columns: <span className="font-mono">teamName, industry, role, priorKnowledge, teamSize</span>. Leave blank to inherit the master case&apos;s profile and the team size above. Tab to fill an example.
        </p>
        <textarea
          id="vcsv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !csv.trim()) {
              e.preventDefault();
              setCsv(CSV_HINT);
            }
          }}
          rows={5}
          disabled={busy}
          className="mt-2 w-full rounded-md border bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          placeholder={CSV_HINT}
        />
      </div>
      {err ? (
        <div
          role="alert"
          className="rounded-md border border-flag/40 bg-flag/5 px-3 py-2 text-sm text-flag"
        >
          {err}
        </div>
      ) : null}
      {result ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Created {result.created} team case{result.created === 1 ? "" : "s"}
          {result.withMissing > 0 ? `, ${result.withMissing} missing a concept` : ", all concepts covered"}
          {result.failed > 0 ? `, ${result.failed} failed` : ""}.
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Spawning generates one customised case per team: {plannedCount} model{" "}
        call{plannedCount === 1 ? "" : "s"}, run in batches of four. This can take a moment.
      </p>
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>
        {busy ? `Spawning ${plannedCount}…` : "Spawn team cases"}
      </Button>
    </form>
  );
}
