// Compute grounding utilisation from the committed sample outputs, so the
// "retrieved passages reflected in the generated case" figure the paper cites
// is reproducible from the repository rather than asserted. Reads the existing
// demo/sample-outputs (does not regenerate), reusing the same groundingUtilisation
// logic the app logs at generation time. No API key or database needed.
//
//   pnpm grounding-report

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { groundingUtilisation } from "../lib/generation/generate-case";

const DIR = join(process.cwd(), "demo/sample-outputs");
const OUT = join(process.cwd(), "demo/grounding-utilisation.json");

function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const perCase = [];
  let used = 0;
  let total = 0;
  for (const f of files) {
    const r = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    const g = groundingUtilisation(r.output, r.provenance);
    perCase.push({ discipline: r.input.discipline, used: g.used, total: g.total });
    used += g.used;
    total += g.total;
    console.log(`${r.input.discipline}: ${g.used}/${g.total} retrieved passages reflected`);
  }
  const report = {
    method:
      "lexical: a retrieved passage counts as reflected if any of its corpus tags appears in the generated case text",
    perCase,
    totalUsed: used,
    totalRetrieved: total,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(`\noverall: ${used}/${total} -> wrote ${OUT}`);
}

main();
