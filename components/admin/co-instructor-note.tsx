"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// A shared internal note for co-teaching instructors. Not shown to students.
interface Props {
  caseId: string;
  initialNote: string;
  author: string | null;
  updatedAt: string | null;
}

export function CoInstructorNote({ caseId, initialNote, author, updatedAt }: Props) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/10 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Co-instructor note <span className="normal-case">(internal, not shown to students)</span>
        </h3>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {initialNote ? "Edit" : "Add note"}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            className="min-h-[80px] resize-y"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context for whoever teaches this next: tuning decisions, hold-for-week, known issues…"
          />
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={saving}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setNote(initialNote); }} disabled={saving}>
              Cancel
            </Button>
            {error ? <span className="text-xs text-flag">{error}</span> : null}
          </div>
        </div>
      ) : initialNote ? (
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-sm">{initialNote}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            — {author ?? "instructor"}
            {updatedAt ? `, ${new Date(updatedAt).toLocaleString()}` : null}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">No note yet.</p>
      )}
    </div>
  );
}
