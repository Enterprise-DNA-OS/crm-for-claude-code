---
description: Show the sales pipeline: every stage, every open deal, what is stuck
---

Run:

```
node scripts/crm.mjs pipeline
```

Present the result like this:

1. One line of totals: how many open deals, total value, weighted value.
2. The stage table as returned.
3. The open deals, grouped by stage, biggest first. Keep the id, company, contact, value, close date, days in stage and last touch.
4. A short "watch" list: any deal with 14+ days since last touch, any deal past its expected close date, any deal that has sat in one stage for 21+ days. Say why each one is on the list in a few words.

If the user asked a specific question ("what is in Proposal", "how much closes this month"), answer that question first, then show the supporting rows only.

Do not invent deals or numbers. If the table is empty, say the pipeline is empty and suggest `/add`.
