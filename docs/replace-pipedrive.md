# Replace Pipedrive

A walkthrough for moving a small business off Pipedrive and onto this repo. Budget about 30 minutes. Nothing here touches your Pipedrive account; you export files and import them.

## 1. Export from Pipedrive

Pipedrive exports one CSV per entity. You need three.

1. **Organizations.** Contacts > Organizations > the "..." menu > Export. Choose CSV, all columns.
2. **Persons.** Contacts > People > "..." > Export. CSV, all columns.
3. **Deals.** Deals > list view > "..." > Export. CSV, all columns, all pipelines, all statuses (open, won, lost).

Pipedrive emails you a download link for each. Save the three files in one folder.

If you are on a plan where export is admin-only, ask your account admin to run the three exports. Custom-field columns are fine to leave in; the importer ignores columns it does not know.

## 2. Run the import

From the repo folder, with your database ready (`npm run migrate`):

```
node scripts/crm.mjs import pipedrive \
  --orgs="path/to/organizations.csv" \
  --persons="path/to/persons.csv" \
  --deals="path/to/deals.csv"
```

Or open the repo in Claude Code and type `/import`, then point it at the folder. It checks the headers, previews the stage mapping, runs the command and shows you the result.

Re-running the import with the same files is safe. Every row carries its Pipedrive id (`pd-org-101`, `pd-person-201`, `pd-deal-301`) in `external_ref`, so a second run updates rather than duplicates.

Try it on the sample files first:

```
node scripts/crm.mjs import pipedrive --orgs=examples/pipedrive/organizations.csv --persons=examples/pipedrive/persons.csv --deals=examples/pipedrive/deals.csv
```

## 3. What maps where

### Organizations to `companies`

| Pipedrive column | Here                          |
| ---------------- | ----------------------------- |
| ID               | `external_ref` as `pd-org-<ID>` |
| Name             | `name`                        |
| Address          | `address`                     |
| Label            | `notes` ("Pipedrive label: ...") |

Everything else (Owner, People, Open deals, activity dates) is dropped. Those are counts and views, and the CRM recomputes them.

### Persons to `contacts`

| Pipedrive column                                       | Here                                  |
| ------------------------------------------------------ | ------------------------------------- |
| ID                                                     | `external_ref` as `pd-person-<ID>`    |
| First name / Last name (or Name, split)                | `first_name`, `last_name`             |
| Email (or Email - Work / Other / Home, first non-empty) | `email`                              |
| Phone (or Phone - Work / Mobile / Other)               | `phone`                               |
| Job title                                              | `title`                               |
| Organization ID, then Organization (name)              | `company_id`                          |

A person is matched on Pipedrive id first, then on email, so a person who already exists here (say, one you typed in by hand) is updated rather than duplicated. Names in "Last, First" form are flipped.

### Deals to `deals`

| Pipedrive column                    | Here                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| ID                                  | `external_ref` as `pd-deal-<ID>`                       |
| Title                               | `title`                                                |
| Value, Currency                     | `value_cents` (x100), `currency`                       |
| Organization ID / Organization      | `company_id`                                           |
| Contact person ID / Contact person  | `contact_id`                                           |
| Stage                               | `stage_id` (see mapping below)                         |
| Status (open, won, lost, deleted)   | `status`; deleted rows are skipped                     |
| Expected close date                 | `expected_close`                                       |
| Won time / Lost time                | `won_at` / `lost_at`                                   |
| Lost reason                         | `lost_reason`                                          |
| Deal created / Add time             | `created_at`                                           |

If a deal names an organization that is not in the organizations file, the importer creates the company from the name so the deal still lands somewhere.

### Stage mapping

Pipedrive lets every pipeline have its own stage names. The importer maps them to the six default stages here:

| If the Pipedrive stage name contains          | It becomes    |
| --------------------------------------------- | ------------- |
| negotiat, contract, verbal, legal, review     | Negotiation   |
| proposal, quote, pricing, presentation, sent  | Proposal      |
| qualif, demo, discovery, meeting, needs, scop | Qualified     |
| lead, contact, new, inbound, prospect, idea   | Lead          |
| (won status)                                  | Won           |
| (lost status)                                 | Lost          |

An exact match on an existing stage name always wins. A stage name that matches nothing is created as a new stage with 50% probability, slotted before Won. After the import, look at `node scripts/crm.mjs pipeline`; if you want to rename or re-weight a stage, it is one `update pipeline_stages ...` statement, and Claude Code will write it for you.

Multiple pipelines in Pipedrive collapse into one here. If you ran two pipelines for two genuinely different businesses, run this repo twice with two data directories (`CRM_DATA_DIR`) or two databases.

## 4. What does not carry over

Be honest with yourself about this list before you cancel the subscription.

- **Activities, notes and emails.** Pipedrive's notes and email sync do not come out in the three entity exports. You can export Activities and Notes as separate CSVs; there is no importer for them yet. The practical move: for each open deal, write one summary note with `/log` ("History from Pipedrive: ...") so the timeline starts with context. Claude Code can draft those from the Pipedrive activity export if you paste it in.
- **Files and attachments.** Download anything you need from Pipedrive before you close the account.
- **Custom fields.** Ignored. If one matters (say, "Source"), add a column to `companies` or `deals` with a new migration file and import it with a small script. Claude Code will write both.
- **Owners and teams.** Everything imports without an owner. This repo is built for a small team that shares one pipeline.
- **Products, quotes, invoices, web forms, chatbot, automations, reports.** Not part of this. The reports are what Claude Code now does on request.
- **Mobile app.** There is none. See `docs/why-no-front-end.md`.

## 5. Check the result

```
node scripts/crm.mjs stats
node scripts/crm.mjs pipeline
node scripts/crm.mjs followups
```

Compare the open deal count and total value with what Pipedrive shows. They should match to the dollar. If a deal is missing, look for it in the deals CSV: rows with status `deleted` are skipped by design.

Then open the repo in Claude Code, type `/weekly-review`, and you are running.
