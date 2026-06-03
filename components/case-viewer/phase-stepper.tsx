import { cn } from "@/lib/utils";
import type { PhaseDefinition } from "@/lib/disciplines/types";

export function PhaseStepper({
  phases,
  currentPhaseId,
}: {
  phases: PhaseDefinition[];
  currentPhaseId: string | null;
}) {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const currentIdx = sorted.findIndex((p) => p.id === currentPhaseId);
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
      {sorted.map((p, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const active = currentIdx >= 0 && i === currentIdx;
        return (
          <li key={p.id} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !active && !done && "text-muted-foreground",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "max-w-[140px] truncate font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {p.label}
            </span>
            {i < sorted.length - 1 ? (
              <span className="h-px w-6 shrink-0 bg-border" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
