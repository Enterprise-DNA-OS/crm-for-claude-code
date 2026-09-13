<div align="center">

# crm-for-claude-code

**The open-source CRM that is just a database and Claude Code.**

Created by [Enterprise DNA](https://www.enterprisedna.co)

[What is this](#what-is-this) · [Why no front end](#why-no-front-end) · [Quick start](#quick-start) · [Your own Postgres](#use-it-with-your-own-postgres-or-supabase) · [The commands](#the-commands) · [Replace Pipedrive](#replace-pipedrive) · [Architecture](#architecture) · [Installed for you](#want-it-installed-and-run-for-you)

[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-any-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![PGlite](https://img.shields.io/badge/PGlite-embedded-0f766e)](https://pglite.dev)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

## What is this

A CRM for a small business that replaces Pipedrive with two things: a Postgres database and Claude Code.

The database holds companies, contacts, deals, activities and tasks. A small Node CLI reads and writes it. Claude Code slash commands drive the CLI, so you run your CRM by talking to it:

```
/pipeline                              show me the pipeline
/log Jane at Acme "wants the proposal split into two phases"
/followups                             who has gone quiet
/draft-followup Acme dispatch          draft a follow-up, saved to drafts/, never sent
/weekly-review                         Monday review: what moved, what is stuck, five people to call
```

You get better analysis than a SaaS dashboard, for zero per-seat fees, with your data in your own Postgres. It runs on your laptop in 60 seconds with no database install (embedded Postgres via PGlite), or against your own Postgres or Supabase for a team.

## Why no front end

- The front end was the product because the database was hard to talk to. Claude Code makes the database easy to talk to, so the screens are the part you can drop.
- You gain custom questions ("which deals over $10k are quiet since the proposal went out?"), a schema you own, zero seat fees, and a timeline that gets read before every follow-up.
- You give up the visual kanban, a mobile app, and inbox sync. That is a real trade and it is spelled out honestly in [docs/why-no-front-end.md](docs/why-no-front-end.md).

## Quick start

60 seconds, no database install. Needs Node 20 or newer and [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/Enterprise-DNA-OS/crm-for-claude-code.git
cd crm-for-claude-code
npm install
npm run demo
```

`npm run demo` creates an embedded database under `.data/`, applies the schema, loads six demo companies with deals and history, then prints the pipeline and the follow-up list.

Then open the folder in Claude Code and type:

```
/pipeline
```

Try `/followups`, `/contact jane`, `/weekly-review`. When you are ready for real data, delete `.data/` and start adding with `/add`, or bring your Pipedrive export in with `/import`.

Fill in the "Who this works for" block in [CLAUDE.md](CLAUDE.md) so drafts come out in your voice.

## Use it with your own Postgres or Supabase

Set `DATABASE_URL` and every script switches from the embedded database to yours. Same SQL, same commands.

```bash
cp .env.example .env
# edit .env:
# DATABASE_URL=postgresql://postgres:password@db.xxxxxxxxxxxx.supabase.co:5432/postgres
npm run migrate
```

For Supabase: Project Settings > Database > Connection string (URI). Use the direct connection or the session pooler; both work. Skip `npm run seed` unless you want the demo data in your real database.

A team shares one database. Each person clones the repo, sets the same `DATABASE_URL`, and works in their own Claude Code. There is no per-seat anything.

## The commands

Slash commands live in `.claude/commands/`. Each one tells Claude exactly which CLI call to run and how to present the result.

| Command            | What it does                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `/pipeline`        | Every stage with count, value and weighted value, every open deal, and what looks stuck        |
| `/contact <name>`  | One person: profile, deals, open tasks, the full timeline, and a read on where things stand    |
| `/company <name>`  | One company: people, deals (won and lost too), tasks, recent activity                          |
| `/log`             | Log a call, email, meeting or note in plain language; attaches to the right deal               |
| `/deal`            | Move a deal between stages, mark it won, mark it lost with a reason                            |
| `/task`            | Add a dated task, tick one off, list what is open                                              |
| `/followups`       | Quiet deals (14+ days), overdue tasks, quiet contacts (30+ days), ranked into one action list  |
| `/weekly-review`   | Monday review: what moved, what is stuck, the five people to contact this week, saved to drafts |
| `/draft-followup`  | Reads the whole timeline, drafts a short email in your voice, saves to `drafts/`. Never sends  |
| `/add`             | Add a company, contact or deal from a plain-language description                               |
| `/import`          | Walks a Pipedrive export (Organizations, Persons, Deals) through the importer                  |

Under the hood it is one CLI. You can use it directly, and `--json` gives machine output for anything:

```
node scripts/crm.mjs help
node scripts/crm.mjs pipeline
node scripts/crm.mjs contact "priya"
node scripts/crm.mjs log "Priya Sharma" "Agreed phase one pricing. Sending contract Monday." --kind=call
node scripts/crm.mjs move "Kauri Legal intake" Negotiation
node scripts/crm.mjs won "Kauri Legal intake"
node scripts/crm.mjs task add "Send Priya the contract" --due=2026-09-15 --deal="Kauri Legal intake"
node scripts/crm.mjs stats --json
node scripts/crm.mjs export --out=backup.json
```

Ids can be shortened to their first 8 characters. Names match case-insensitively. When a name matches more than one record, the CLI lists the candidates and exits 1 instead of guessing.

## Replace Pipedrive

Export Organizations, Persons and Deals from Pipedrive as CSV, then:

```
node scripts/crm.mjs import pipedrive --orgs=organizations.csv --persons=persons.csv --deals=deals.csv
```

Stages map onto Lead, Qualified, Proposal, Negotiation, Won and Lost. Re-running is safe; rows match on their Pipedrive ids. Sample files are in `examples/pipedrive/`. The full walkthrough, including what does not carry over, is in [docs/replace-pipedrive.md](docs/replace-pipedrive.md).

## Architecture

```
.claude/commands/      slash commands: the operator's vocabulary
CLAUDE.md              who this works for, the routing table, house rules
scripts/
  crm.mjs              the one CLI (pipeline, contact, log, move, followups, stats, import, export ...)
  migrate.mjs          applies supabase/migrations/*.sql, tracked in schema_migrations
  seed.mjs             loads supabase/seed.sql (idempotent demo data)
  smoke.mjs            npm test: migrate, seed, exercise every command on a temp database
  lib/db.mjs           getDb(): PGlite embedded by default, pg Pool when DATABASE_URL is set
  lib/csv.mjs          tiny CSV parser for the Pipedrive import
  lib/format.mjs       aligned text tables, money, dates
supabase/
  migrations/0001_crm.sql   tables, triggers, default stages, views (v_pipeline, v_followups_due, v_contact_timeline)
  seed.sql                  six companies, ten contacts, eight deals, twenty-one activities, six tasks
examples/pipedrive/    three small CSVs in Pipedrive's export shape
docs/                  replace-pipedrive.md, why-no-front-end.md
drafts/                where drafts and reviews are written (gitignored)
```

Plain JavaScript, ESM, no build step, two dependencies (`pg`, `@electric-sql/pglite`).

## Built with Claude Code

This repo was written with Claude Code and is meant to be extended the same way. Want a `source` field on deals, a monthly revenue view, or an importer for HubSpot? Open the folder in Claude Code and ask. The schema is six tables and three views; a new migration file is the whole change.

`npm test` runs the smoke test on a throwaway database and must print `PASS` before anything merges.

## Contributing

Issues and pull requests are welcome. Keep to the shape of the thing:

- Plain JavaScript, no TypeScript, no build step.
- Every SQL change is a new file in `supabase/migrations/` and must run on both PGlite and Postgres.
- Every new CLI command gets a line in `help`, a slash command in `.claude/commands/`, and a step in `scripts/smoke.mjs`.
- Prose in plain language. No buzzwords, no hedging.

Run `npm test` before you open a PR.

## Want it installed and run for you?

Enterprise DNA installs this for your business, migrates your Pipedrive data, connects it to your email and calendar, and runs it for you as part of Omni, our managed Command Center. One setup fee, then a monthly retainer.

Book a call: https://calendly.com/sam-mckay/discovery-call

Read more: https://enterprisedna.co/omni/instead-of/pipedrive

## License

MIT. Copyright (c) 2026 Enterprise DNA. See [LICENSE](LICENSE).
