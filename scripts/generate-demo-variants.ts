// Generate two genuinely personalised finance variants from the committed
// master case, so the demo (and seed) can show that per-team personalisation
// produces different companies/contexts while preserving the objective and the
// must-cover concepts. Run once; the outputs are committed and loaded by
// seed-demo so the demo needs no live personalisation.
//
//   pnpm tsx scripts/generate-demo-variants.ts
//
// Writes demo/sample-variants/finance-retail.json and finance-treasury.json.

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CaseContentSchema } from "../lib/generation/schema";
import { personaliseCaseContent } from "../lib/generation/personalize";
import type { CaseInput } from "../lib/disciplines/types";

loadEnv({ path: ".env.local" });
loadEnv();

const OUT_DIR = join(process.cwd(), "demo/sample-variants");

const TEAMS = [
  {
    file: "finance-retail.json",
    override: { displayName: "Team Alpha", industry: "retail banking", role: "junior analyst", priorKnowledge: "intermediate" },
  },
  {
    file: "finance-treasury.json",
    override: { displayName: "Team Beta", industry: "corporate treasury", role: "treasury associate", priorKnowledge: "intermediate" },
  },
];

async function main() {
  const data = JSON.parse(readFileSync(join(process.cwd(), "demo/sample-outputs/finance.json"), "utf8"));
  const base = CaseContentSchema.parse({ schemaVersion: 1, ...data.output });
  const caseInput = data.input as CaseInput;
  mkdirSync(OUT_DIR, { recursive: true });

  for (const t of TEAMS) {
    const content = await personaliseCaseContent({ base, caseInput, override: t.override });
    // Validate before committing so a malformed draft never lands in the seed.
    const parsed = CaseContentSchema.parse(content);
    writeFileSync(join(OUT_DIR, t.file), JSON.stringify(parsed, null, 2) + "\n");
    const company = parsed.scenario.slice(0, 90).replace(/\s+/g, " ");
    console.log(`wrote ${t.file} — ${t.override.industry}: "${company}..."`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
