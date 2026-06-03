import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  variant?: "default" | "muted";
}

export function EmptyState({ title, description, action, className, variant = "default" }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border px-6 py-10 text-center",
        variant === "muted" ? "bg-muted/30" : "bg-background",
        className,
      )}
    >
      <h3 className="text-base font-medium">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
