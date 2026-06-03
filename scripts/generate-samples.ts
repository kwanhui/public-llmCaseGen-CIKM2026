// Generate real example cases for the three demo sample inputs, with no
// database involved. Run: pnpm tsx scripts/generate-samples.ts
// Needs OPENAI_API_KEY (and a built corpus: pnpm embed-corpus).
//
// Writes demo/sample-outputs/<discipline>.json so the paper can quote a genuine,
// reproducible generated case rather than a fabricated one. Also prints the
// retrieval provenance (which corpus chunks were retrieved, with scores).

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateCase } from "../lib/generation/generate-case";
import type { CaseInput } from "../lib/disciplines/types";

loadEnv({ path: ".env.local" });
loadEnv();

const IN_DIR = join(process.cwd(), "demo/sample-inputs");
const OUT_DIR = join(process.cwd(), "demo/sample-outputs");

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set (check .env.local). Aborting.");
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(IN_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const input = JSON.parse(readFileSync(join(IN_DIR, file), "utf8")) as CaseInput;
    console.log(`\n=== ${file} (${input.discipline}) ===`);
    const t0 = Date.now();
    const { output, provenance } = await generateCase(input);
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`generated in ${seconds}s`);
    console.log("retrieval provenance:");
    for (const p of provenance) console.log(`  - ${p}`);

    const record = {
      generatedAt: new Date().toISOString(),
      model: process.env.LLM_GENERATION_MODEL ?? "gpt-4o-mini",
      embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      input,
      provenance,
      output,
    };
    const outPath = join(OUT_DIR, file);
    writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");
    console.log(`wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
