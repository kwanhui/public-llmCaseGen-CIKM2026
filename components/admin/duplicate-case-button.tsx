"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DuplicateCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/admin/cases/${data.id}`);
        return;
      }
    } catch {
      // fall through
    }
    setBusy(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={duplicate} disabled={busy}>
      {busy ? "Duplicating…" : "Duplicate"}
    </Button>
  );
}
