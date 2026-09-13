# crm-for-claude-code

This is a CRM with no web front end. The database holds companies, contacts, deals, activities and tasks. `scripts/crm.mjs` reads and writes it. You, Claude Code, are the interface: the operator talks to you in plain language and you run the CLI, then read and explain the result.

Every answer starts with data from the CLI. Never answer a question about the pipeline, a person or a company from memory.

## Who this works for

<!-- Operator: fill this in. Claude reads it before drafting anything in your voice. -->

- **Name:** _your name_
- **Business:** _what you sell, to whom, in one sentence_
- **Currency and region:** NZD, New Zealand (change `currency` on deals if different)
- **Voice notes:** _short sentences, first name sign-off, no exclamation marks, anything else you want kept or avoided_
- **Typical deal:** _size, sales cycle, who usually decides_

## The routing table

One right way for each recurring job. Use the slash command; it knows the exact CLI call and how to present the result.

| The operator says                                                  | Run                |
| ------------------------------------------------------------------ | ------------------ |
| "show me the pipeline", "what is open", "what is in Proposal"      | `/pipeline`        |
| "pull up Jane", "what is the history with Priya"                   | `/contact <name>`  |
| "what is going on with Acme", "show me Harbourline"                | `/company <name>`  |
| "log a call with...", "note that...", "I met..."                         | `/log`             |
| "move X to Negotiation", "we won X", "we lost X because..."          | `/deal`            |
| "remind me to...", "task done", "what is on my list"                 | `/task`            |
| "who has gone quiet", "who do I need to chase", "what is overdue"  | `/followups`       |
| "Monday review", "how did the week go", "what should I focus on"   | `/weekly-review`   |
| "draft a follow-up to...", "write to Jane about..."                    | `/draft-followup`  |
| "add a company/contact/deal"                                       | `/add`             |
| "import from Pipedrive", "bring in my old CRM"                     | `/import`          |
| "win rate", "average deal size", "how long do deals take"          | `node scripts/crm.mjs stats` |

Anything not in the table: run `node scripts/crm.mjs help`, pick the closest command, and if nothing fits, say so and ask rather than improvising a write.

## House rules

1. **Never send email.** This repo has no send path. `/draft-followup` writes to `drafts/` and stops. If the operator asks you to send, say you cannot and hand them the draft.
2. **Never delete records without an explicit yes in this session.** There is no delete command in the CLI on purpose. If a record must go, show the exact SQL, wait for a "yes" in this conversation, then run it. A yes from an earlier session does not count.
3. **Always read the full timeline before drafting anything.** Run `contact` (and `deal`) and read every entry. The last promise made and the last date mentioned are what make a follow-up land.
4. **Plain language.** Short sentences. Say the number. No jargon, no buzzwords, no filler openers like "Great question" or "I hope this helps".
5. **Ambiguity stops you.** When the CLI lists several matches, show them and ask. Never pick one for the operator.
6. **Faithful notes.** When logging, use the operator's words. Fix dictation typos, add nothing.
7. **Money is in cents in the database and in whole units in the CLI and in conversation.** `--value=12500` means $12,500.

## How the pieces fit

```
.claude/commands/   slash commands (the operator's vocabulary)
scripts/crm.mjs     the CLI every command calls; --json for machine output
scripts/lib/db.mjs  one handle: PGlite embedded by default, Postgres/Supabase with DATABASE_URL
supabase/           migrations and seed SQL, same files for both databases
drafts/             where /draft-followup and /weekly-review write, gitignored
```

Setup and background: `README.md`. Pipedrive migration: `docs/replace-pipedrive.md`. Why there is no front end: `docs/why-no-front-end.md`.
