// Compare the two retrieval providers on the demo sample inputs, so the
// "retrieval-augmented" framing can be defended with real numbers rather than
// asserted. Run: pnpm retrieval-ablation   (needs OPENAI_API_KEY + built corpus)
//
// For each sample input we generate a case under RETRIEVAL_PROVIDER=embedding
// (dense retrieval over the corpus) and under =prompt-pack (no retrieval, pack
// grounding only), and report must-cover-concept coverage and the grounding
// provenance for each. Writes demo/retrieval-ablation.json. No fabricated
// numbers: everything here comes from real generation runs.

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateCase, checkConceptCoverage } from "../lib/generation/generate-case";
import type { CaseInput } from "../lib/disciplines/types";

loadEnv({ path: ".env.local" });
loadEnv();

const IN_DIR = join(process.cwd(), "demo/sample-inputs");
const OUT_PATH = join(process.cwd(), "demo/retrieval-ablation.json");

async function runUnder(provider: "embedding" | "prompt-pack", input: CaseInput) {
  process.env.RETRIEVAL_PROVIDER = provider; // getRetrievalProvider() reads this per call
  // Structured generation occasionally fails schema validation; retry once
  // before giving up so a single transient failure does not abort the run.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output, provenance } = await generateCase(input);
      const coverage = checkConceptCoverage(output, input.mustCoverConcepts);
      return {
        provider,
        coveredCount: coverage.covered.length,
        missingCount: coverage.missing.length,
        missing: coverage.missing,
        totalConcepts: input.mustCoverConcepts.length,
        groundingPassages: provenance.filter((p) => p.startsWith("corpus:")).length,
        provenance,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    provider,
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    totalConcepts: input.mustCoverConcepts.length,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set (check .env.local). Aborting.");
    process.exit(1);
  }
  const files = readdirSync(IN_DIR).filter((f) => f.endsWith(".json"));
  const results = [];
  for (const file of files) {
    const input = JSON.parse(readFileSync(join(IN_DIR, file), "utf8")) as CaseInput;
    const embedding = await runUnder("embedding", input);
    const promptPack = await runUnder("prompt-pack", input);
    results.push({ file, discipline: input.discipline, embedding, promptPack });
    const fmt = (r: Awaited<ReturnType<typeof runUnder>>) =>
      "error" in r ? `error (${r.error})` : `${r.coveredCount}/${r.totalConcepts} covered`;
    console.log(
      `${input.discipline}: embedding ${fmt(embedding)} ` +
        `(${"groundingPassages" in embedding ? embedding.groundingPassages : 0} retrieved) | ` +
        `prompt-pack ${fmt(promptPack)} (0 retrieved)`,
    );
  }
  writeFileSync(
    OUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + "\n",
  );
  console.log(`\nwrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
