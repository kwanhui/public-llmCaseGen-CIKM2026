import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseVariants } from "@/lib/db/schema";
import { hashFingerprint } from "@/lib/logging/hmac";
import { logCaseEvent } from "@/lib/case/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [row] = await db
    .select({ id: caseVariants.id, caseId: caseVariants.caseId })
    .from(caseVariants)
    .where(eq(caseVariants.inviteToken, token));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const ua = req.headers.get("user-agent") ?? "unknown";
  let viewerHash = "anon";
  try {
    viewerHash = hashFingerprint(`${ip}|${ua}`, process.env.PSEUDONYM_SALT ?? "");
  } catch {
    // PSEUDONYM_SALT unset — log without a hash.
  }

  const now = new Date();
  await db
    .update(caseVariants)
    .set({
      lastViewedAt: now,
      firstViewedAt: sql`COALESCE(${caseVariants.firstViewedAt}, ${now})`,
      viewCount: sql`${caseVariants.viewCount} + 1`,
    })
    .where(eq(caseVariants.id, row.id));

  await logCaseEvent({
    caseId: row.caseId,
    variantId: row.id,
    eventType: "variant_viewed",
    metadata: { viewerHash },
  });

  return NextResponse.json({ ok: true });
}
