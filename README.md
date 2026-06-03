# CaseForge (`public-llmCaseGen-CIKM2026`)

> **Status:** deployed — https://llmcasegen.vercel.app

## Overview

CaseForge is a faculty-facing browser tool that drafts personalised professional case
studies via a four-stage RAG+LLM pipeline: **Input → Retrieval → Generation →
Faculty-in-the-loop editing**. The instructor sets the learning objective, must-cover
concepts, and target learner profile; CaseForge embeds that specification and retrieves
the most relevant passages from a curated discipline corpus, then produces a structured
draft (scenario, discussion questions, model answers, rubric) grounded in those passages,
plus an in-browser editor with section-level regeneration. After approval, the instructor
spawns one customised case per student team (team size adjustable), each with a unique
team URL, and walks the cohort through a discipline-tailored phase sequence (e.g. for
Finance: framing → data → modelling → sensitivity → recommendation).

Disciplines shipped in v1: **Finance**, **Marketing**, **Social Work**.

## Retrieval

Generation is grounded by dense retrieval over a curated per-discipline corpus of concise
domain notes (`lib/retrieval/corpus/`). At authoring time the case specification is
embedded with OpenAI `text-embedding-3-small` and the top-k passages are selected by
cosine similarity; the instructor sees the retrieved passages and scores in wizard step 2.
The vectors live in a committed, regenerable store (`pnpm embed-corpus`), so retrieval
works on a fresh checkout with no extra infrastructure. The `RetrievalProvider` interface
(`lib/retrieval/`) keeps this swappable — a `prompt-pack` provider is the no-retrieval
baseline, and pgvector is the production scale-path.

## Adding a discipline

A discipline is defined declaratively, not in application code. To add one (say,
nursing):

1. Add a `DisciplinePack` in `lib/disciplines/` (system prompt, style notes,
   vocabulary, difficulty hints, exemplars, and a default phase sequence). The
   `quantitative` flag turns on the editor's verify-the-figures reminder.
2. Add a small corpus of domain notes in `lib/retrieval/corpus/`.
3. Register both in `lib/disciplines/index.ts` and
   `lib/retrieval/corpus/index.ts`, and add the id to the `DisciplineId` union in
   `lib/disciplines/types.ts`.
4. Re-embed: `pnpm embed-corpus`.

No route, component, or pipeline code changes. The three shipped disciplines are
illustrative of the spread the design targets (quantitative, persuasive,
relational), not a hard limit.

## Companion paper

CaseForge is described in a companion demo paper, currently under review (venue
to be confirmed). Citation metadata is in [`CITATION.cff`](CITATION.cff); a
BibTeX entry:

```bibtex
@inproceedings{Lim2026CaseForge,
  title     = {CaseForge: A Retrieval-Augmented LLM Authoring Tool for Personalised Professional Case Studies},
  author    = {Lim, Kwan Hui and Lim, Lyndon and Ng, Vincent and Lee, Marcus and Ding, Ding},
  year      = {2026},
  booktitle = {To be confirmed (under review)},
  note      = {Submitted to the CIKM 2026 Demo Track; venue to be confirmed}
}
```

The full reference will be updated here once the paper is accepted.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkwanhui%2Fpublic-llmCaseGen-CIKM2026&env=LLM_PROVIDER,OPENAI_API_KEY,AUTH_SECRET,PSEUDONYM_SALT,ADMIN_EMAIL,ADMIN_PASSWORD_HASH&envDescription=See%20.env.example%20for%20all%20required%20vars.&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

## Stack

Next.js 16 App Router · TypeScript · Tailwind · Auth.js v5 · Vercel AI SDK · Vercel
Postgres + Drizzle ORM · Recharts. Hosted on Vercel (region `sin1`).

## Local development

```bash
pnpm install
cp .env.example .env.local        # fill in OPENAI_API_KEY (or ANTHROPIC_API_KEY),
                                   # AUTH_SECRET, PSEUDONYM_SALT, ADMIN_PASSWORD_HASH
vercel link                        # link to a Vercel project (creates Postgres)
vercel env pull .env.local         # populate POSTGRES_URL, etc.
pnpm db:generate
pnpm db:migrate
pnpm embed-corpus                  # build the retrieval vector store (needs OPENAI_API_KEY)
pnpm dev
```

Open http://localhost:3000 — three landing cards:

- **Instructor sign-in** — email `admin`; set the password with `pnpm change-admin-password` (the hosted-demo password is given in the companion paper)
- **Student access** — students enter via the unique URL their instructor shared
- **Analytics dashboard** — instructor-protected dashboard

## Three modes

1. **Instructor** (`/admin/*`, password-gated). Author cases via a four-step wizard
   (input → retrieval preview → generation → editor), regenerate sections, configure the
   discipline-specific phase sequence, spawn one customised case per student team.
2. **Student** (`/case/[token]`). No login. The page shows the personalised scenario plus
   the instructor's currently-active phase. Per-phase activity widgets auto-save:
   clarifying questions, free-text notes, and (where the instructor enables it) an
   answer attempt where the student can request rubric-grounded formative feedback or
   reveal the model answer to self-check. Past phases are read-only; future phases are
   hidden.
3. **Analytics** (`/admin/analytics`, same auth as instructor). Top-line metrics and charts
   (authoring time by discipline, regeneration counts, cases by discipline, student
   activity over time), CSV export of the full event trail.

## Setting the admin password

```bash
pnpm change-admin-password    # prompts for plaintext, bcrypts, pushes to Vercel
```

## Deploy to Vercel

```bash
vercel --prod
```

The first deploy provisions Vercel Postgres; pull env vars locally with
`vercel env pull` to keep `pnpm db:migrate` working from your laptop.

## Security note

The single-instructor sign-in (one account, a bcrypt-hashed password set via
`pnpm change-admin-password`) is deliberately minimal: it exists to gate the
authoring side for this system demonstration, not as production-grade
authentication. A real deployment should add proper user accounts, password and
session policies, rate limiting, and a spend cap on the model API.

## License

See [LICENSE](LICENSE).
