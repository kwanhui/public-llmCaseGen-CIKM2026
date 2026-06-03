# Demo Materials — CaseForge

Materials for the CIKM 2026 Demo Track submission and reviewer-facing walkthroughs.

## Hosted demo

- **URL**: https://llmcasegen.vercel.app (Vercel; region `sin1`)
- **Demo sign-in**: email `admin`; password set via `pnpm change-admin-password` (the hosted-demo password is in the companion paper)

## Contents

- `sample-inputs/` — try-on-arrival specs:
  - Finance — DDM valuation of a regional bank, intermediate, learner = junior analyst in retail banking
  - Marketing — segment repositioning for a sleep-aid brand, novice, learner = brand assistant
  - Social Work — eldercare placement under family conflict, advanced, learner = MSW-track student
- `deployment.md` — operator notes: env vars, password rotation, rollback procedure

## Reviewer reproducibility

```bash
git clone https://github.com/kwanhui/public-llmCaseGen-CIKM2026.git
cd public-llmCaseGen-CIKM2026
pnpm install
cp .env.example .env.local           # set OPENAI_API_KEY (or ANTHROPIC), AUTH_SECRET, PSEUDONYM_SALT
vercel link                           # provisions Vercel Postgres
vercel env pull .env.local
pnpm change-admin-password            # set your admin password
pnpm db:generate
pnpm db:migrate
pnpm embed-corpus                     # build the committed retrieval vector store (needs OPENAI_API_KEY)
pnpm dev
```

The repo ships with `lib/retrieval/corpus/embeddings.json` already populated, so
`pnpm embed-corpus` is only needed after editing the corpus. Until embeddings
exist, retrieval degrades to pack-only grounding.

End-to-end smoke test (12 steps):

1. Open http://localhost:3000 — see three landing cards.
2. **Instructor sign-in** (`admin`, your configured password) → `/admin/cases`.
3. **+ New case** → discipline `Finance`, objective `Apply DDM to value a regional bank under uncertainty`, difficulty `intermediate`, concepts `["DDM","cost of equity"]`, learner profile `{ industry: "retail banking", role: "junior analyst", priorKnowledge: "intermediate" }`. Continue.
4. Step 2 displays the retrieved finance corpus passages (ranked by cosine similarity, with scores and chunk ids) plus the 2 discipline exemplars.
5. Step 3 — click **Generate case**; in 10–40s the structured output appears.
6. Step 4 — edit the rubric inline; click **Regenerate** on the discussion-questions card.
7. Click **Approve & Release**. Authoring time logs.
8. **Manage variants** → spawn 3 variants (no overrides). Each appears with a unique URL.
9. Open one variant URL in incognito → see scenario + Phase 1 stepper. Submit two clarifying questions and a note.
10. Back in admin → **Release to students**, then **Advance to next phase**. Within ~8s the incognito tab locks Phase 1 and reveals Phase 2.
11. Walk through phases 2–5; final phase reveals discussion questions + rubric.
12. **Analytics** → metric cards populate; charts render (authoring time by discipline, regen counts, student activity over time, engagement). **Download CSV** delivers the full event trail.
