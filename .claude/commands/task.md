---
description: Add a task, tick one off, or list what is open
argument-hint: add "<title>" by <date> [for <contact|deal>] | done <task> | list
---

Three shapes.

Add:

```
node scripts/crm.mjs task add "<title>" --due=YYYY-MM-DD [--contact="<name>"] [--deal="<deal title>"] [--company="<name>"]
```

Done:

```
node scripts/crm.mjs task done "<task id or title>"
```

List (open tasks only; add `--all` to include done ones):

```
node scripts/crm.mjs task list
```

Rules:

- Turn relative dates into YYYY-MM-DD using today's date ("Thursday", "next week", "end of month"). Say the date you chose in the confirmation.
- Link the task to the person or deal the user named. If they named a deal, pass `--deal=`; the company comes along automatically.
- When listing, put overdue tasks first and say how many days overdue each one is.
- If several tasks match a "done" request, show them and ask.

Confirm in one line.
