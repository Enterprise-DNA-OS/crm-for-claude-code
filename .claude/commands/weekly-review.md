---
description: Monday review: what moved, what is stuck, the five people to contact this week
---

Run all three, in order:

```
node scripts/crm.mjs pipeline --json
node scripts/crm.mjs followups --json
node scripts/crm.mjs stats --json
```

Then write the weekly review in this exact shape. Plain language, short sentences, no filler.

**Pipeline this week**
Open deals, total value, weighted value. Win rate and average days to close from `stats`. One sentence on whether the pipeline is bigger or smaller than it needs to be for the month.

**What moved**
Deals whose `stage_changed_at` is within the last 7 days, and anything won or lost in the last 7 days (from the timeline dates). If nothing moved, say "Nothing moved." That is a finding.

**What is stuck**
Open deals with 21+ days in their current stage, or past their expected close date, or quiet for 14+ days. One line each: deal, company, value, why it is stuck.

**Five people to contact this week**
Exactly five, ranked. Pull from `followups` first, then from open deals closing within 30 days. For each: name, company, deal and value if any, the reason, and the one-line message or ask. If there are fewer than five worth contacting, list fewer and say why.

**Overdue tasks**
List them. Suggest which to do, which to move, which to drop.

Save the review to `drafts/weekly-review-YYYY-MM-DD.md` (today's date) and show it in full. Do not send it anywhere. Do not change any records while writing the review; if the user then wants to act, use `/log`, `/task`, `/deal` and `/draft-followup`.
