---
description: Pull up one person: profile, deals, open tasks, full timeline
argument-hint: <name, email, or id>
---

Run:

```
node scripts/crm.mjs contact "$ARGUMENTS"
```

If the CLI reports several matches, show the candidate list and ask which one. Do not guess.

Present the result like this:

1. Name, title, company, email, phone on one or two lines.
2. Open deals and open tasks as short lists.
3. The timeline, newest first, in full. Do not summarise away the detail. The bodies of calls and meetings are the useful part.
4. Finish with two or three sentences of your own read: where this relationship stands, what was promised last, what the obvious next step is.

If the user is about to write to this person, keep the timeline in view and hand over to `/draft-followup`.
