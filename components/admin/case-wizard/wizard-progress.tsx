import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Input" },
  { n: 2, label: "Retrieval" },
  { n: 3, label: "Generation" },
  { n: 4, label: "Editor" },
];

export function WizardProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-3 text-xs">
      {STEPS.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <li key={s.n} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !active && !done && "text-muted-foreground",
                )}
              >
                {done ? "✓" : s.n}
              </span>
              <span
                className={cn(
                  "font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-8 bg-border" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
