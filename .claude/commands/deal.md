---
description: Move a deal to a new stage, mark it won, or mark it lost
argument-hint: <deal> <stage> | won <deal> | lost <deal> because <reason>
---

Work out which of three things the user wants, then run exactly one command.

Move to a stage:

```
node scripts/crm.mjs move "<deal title or id>" "<stage>"
```

Won:

```
node scripts/crm.mjs won "<deal title or id>"
```

Lost (a reason is required; ask for it if the user did not give one):

```
node scripts/crm.mjs lost "<deal title or id>" --reason="<reason in a few words>"
```

Rules:

- Stages are Lead, Qualified, Proposal, Negotiation, Won, Lost, plus anything imported. Match loosely on what the user said ("neg" means Negotiation). Run `node scripts/crm.mjs pipeline` if unsure what stages exist.
- If the CLI lists several matching deals, show the list and ask which one. Never pick for the user.
- To look at a deal before changing it: `node scripts/crm.mjs deal "<deal>"`.
- After a won or lost, suggest logging a short note with `/log` on why, while it is fresh.

Confirm the change in one line: deal, old stage, new stage.
