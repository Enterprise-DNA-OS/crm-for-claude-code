---
description: Pull up one company: people, deals, open tasks, recent activity
argument-hint: <company name or id>
---

Run:

```
node scripts/crm.mjs company "$ARGUMENTS"
```

If the CLI reports several matches, show the candidate list and ask which one. Do not guess.

Present the result like this:

1. Company name, industry, city, domain, notes.
2. People at the company with their last touch.
3. Deals: open ones first with stage and value, then won and lost with the lost reason.
4. Open tasks.
5. Recent activity, newest first, with the bodies.
6. Two or three sentences of your own read: total value in play, who the real decision maker looks like from the timeline, what is overdue.

To see one person in more depth, use `/contact`. To log something new here, use `/log`.
