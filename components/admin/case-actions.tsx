"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  status: string;
  // Whether a generated draft exists, so Edit jumps to the editor rather than
  // back into the authoring pipeline.
  hasContent: boolean;
}

export function CaseActions({ id, status, hasContent }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReleased = status === "released";
  // Editor lives at step 4; cases without a draft resume authoring at retrieval.
  const editHref = hasContent ? `/admin/cases/${id}?step=4` : `/admin/cases/${id}?step=2`;

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg =
          j.error === "cannot_delete_released"
            ? "Released cases can't be deleted."
            : (j.error ?? `HTTP ${res.status}`);
        throw new Error(msg);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Link href={`/admin/cases/${id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
        <Link href={editHref}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
        <a
          href={`/api/admin/cases/${id}/provenance`}
          title="Download a provenance / audit record (brief, approval, full event trail) for quality assurance"
        >
          <Button variant="ghost" size="sm">
            Provenance
          </Button>
        </a>
        {confirming ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={remove}
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirming(true)}
            disabled={isReleased}
            title={isReleased ? "Released cases can't be deleted" : "Delete this case"}
          >
            Delete
          </Button>
        )}
      </div>
      {error ? <span className="text-xs text-flag">{error}</span> : null}
    </div>
  );
}
