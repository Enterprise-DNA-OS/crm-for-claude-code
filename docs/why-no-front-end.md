# Why there is no front end

A CRM is a database with five tables: companies, people, deals, what happened, what is next. That has been true since the first one shipped. Everything else a CRM vendor sells you is a way of talking to those five tables: the kanban board, the contact page, the activity feed, the dashboard, the mobile app, the report builder.

The front end was the product because the database was hard to talk to. Nobody on a sales team was going to write `select ... from deals join activities` to find out who had gone quiet. So the vendor wrote thousands of screens that each answer one fixed question, and charged per seat for the privilege.

That is no longer true. Claude Code reads and writes SQL, reads a timeline and tells you what it means, in the plain language you were going to type into a search box anyway. The five tables are now easy to talk to. The screens are the part you can drop.

## What you gain

**Better analysis than a dashboard.** A dashboard answers the questions its designer thought of. Claude Code answers the one you have right now: "which deals over $10k have had no contact since the proposal went out, and what did we promise each of them?" One sentence to you, one query to the database.

**Custom questions with no feature request.** Want a new stage, a new field, a new view? It is one migration file, written for you, applied in seconds. The schema is yours.

**Zero seat fees.** Pipedrive charges per user per month, forever. This repo is a folder on disk. Add a colleague by pointing them at the same Postgres. The Claude Code subscription you already have is the whole bill.

**Your data in your Postgres.** Embedded on your laptop by default, or in your own Supabase project for a team. No export wizard, no API rate limit. `select * from deals` is always available to you.

## What you give up

**The visual kanban.** Dragging a card from Proposal to Negotiation is satisfying and there is no version of that here. You type "move Acme to Negotiation". If you will miss the board, this is not for you yet.

**A mobile app.** There is nothing to open on your phone between meetings. Dictate a note to yourself and log it when you are back at a keyboard. That is a real loss for field sales.

**Screens for a large team.** This is built for one to five people who share a pipeline. Twenty reps with territories and quotas need the permission model a SaaS product provides.

**Email sync.** Pipedrive attaches inbox threads to deals on its own. Here you log what matters, by hand, in one sentence. Less noise, more discipline.

The trade is fewer screens for better answers. For a small business that was paying per seat to look at six deals, it is a good trade.
