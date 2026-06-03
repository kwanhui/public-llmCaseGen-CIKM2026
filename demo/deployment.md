# Deployment Notes — CaseForge

Operator guide for running CaseForge on Vercel. Reviewers reproducing the demo
locally should follow the [main README](../README.md) instead; this file is for
the deployed production instance at https://llmcasegen.vercel.app.

## Prerequisites

- Vercel account with CLI installed (`pnpm add -g vercel`)
- A linked Vercel project (`vercel link`)
- Either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Required environment variables

Set these on the Vercel project (`vercel env add <NAME> production`) or via the
dashboard. `vercel env pull .env.local` then mirrors them locally for
`pnpm db:migrate`.

| Variable | Required | Notes |
| --- | --- | --- |
| `LLM_PROVIDER` | yes | `openai` (default) or `anthropic` |
| `OPENAI_API_KEY` | conditional | required when `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | conditional | required when `LLM_PROVIDER=anthropic` |
| `AUTH_SECRET` | yes | random 32+ byte secret for Auth.js JWT signing |
| `PSEUDONYM_SALT` | yes | HMAC salt for student-fingerprint hashing |
| `ADMIN_EMAIL` | yes | the single instructor login |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash; rotate via `pnpm change-admin-password` |
| `POSTGRES_URL` | yes | Vercel Postgres or Neon connection string |

`POSTGRES_URL` is provisioned automatically when the Vercel project includes a
Postgres add-on. Provision a dedicated Postgres instance for this deployment
before any real cohort runs.

## First deploy

```bash
vercel link
vercel env add OPENAI_API_KEY production    # repeat for each var above
pnpm db:generate
pnpm db:migrate
vercel --prod
```

The first deploy creates the case, variant, response, and event tables. After
that, every `git push` to `main` auto-deploys.

## Rotating the admin password

```bash
pnpm change-admin-password
# prompts for new plaintext, bcrypts it, pushes ADMIN_PASSWORD_HASH to Vercel
vercel --prod   # redeploy so the new hash takes effect
```

## Logs and monitoring

- Vercel dashboard, Logs tab, filter by `path:/api/*` for backend traffic.
- Drizzle queries against `case_events` give a per-run audit trail.
- Generation cost per case is logged in `case_events` under `event_type =
  "generation_complete"` with token counts and provider model.

## Rollback

Each deploy in the Vercel dashboard has a Promote button. To roll back:

1. Vercel dashboard, Deployments tab, find the last good deployment.
2. Click "Promote to Production".
3. If schema drift caused the failure, also revert the migration with
   `pnpm db:migrate --to <previous_migration>` after pulling the matching
   commit locally.

## Backups

Vercel Postgres takes daily snapshots; restore via the dashboard. For an
out-of-band export, run `pg_dump $POSTGRES_URL > caseforge-$(date +%F).sql`
periodically.

## Known limits

- The single-instructor Credentials provider is intentional for the v1 demo;
  multi-instructor support requires a schema change to `users` (currently
  Auth.js default) and a UI for instructor invites.
- LLM cost per generated case is dominated by `streamObject` output length;
  expect ~$0.02-0.10 per case at default settings.
