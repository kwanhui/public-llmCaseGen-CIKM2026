import { db } from "@/lib/db/client";
import { caseEvents } from "@/lib/db/schema";

export type CaseEventType =
  | "created"
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "section_regenerated"
  | "edit_saved"
  | "approved"
  | "released"
  | "phase_advanced"
  | "variant_spawned"
  | "variant_viewed"
  | "response_saved"
  | "attempt_assessed"
  | "feedback_requested"
  | "feedback_disputed"
  | "hint_requested"
  | "instructor_note"
  | "quality_rated";

export interface LogCaseEventInput {
  caseId: string;
  variantId?: string;
  eventType: CaseEventType;
  metadata?: Record<string, unknown>;
}

export async function logCaseEvent(input: LogCaseEventInput): Promise<void> {
  try {
    await db.insert(caseEvents).values({
      timestampIso: new Date().toISOString(),
      caseId: input.caseId,
      variantId: input.variantId ?? null,
      eventType: input.eventType,
      metadata: input.metadata ?? null,
    });
  } catch {
    // swallowed — telemetry must never break the request path
  }
}
