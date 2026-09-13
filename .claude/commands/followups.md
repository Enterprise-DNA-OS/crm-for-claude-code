---
description: Who has gone quiet and what is overdue, ranked
---

Run:

```
node scripts/crm.mjs followups
```

The CLI returns three groups: overdue tasks, open deals with no activity for 14+ days, and contacts with no activity for 30+ days.

Present it as one ranked list of actions, not three tables. For each item:

- who and which company
- why it is on the list (overdue task 5 days, deal quiet 18 days, no contact in 70 days)
- the one thing to do about it, in a few words

Rank by money first (deal value, biggest at the top), then by how long it has been quiet. A quiet Negotiation deal outranks a quiet contact with no deal.

For anything the user wants to act on:

- to write to them, use `/draft-followup`
- to log that you did it, use `/log`
- to push it out a week, use `/task` to add a dated task

If the list is empty, say so in one line.
