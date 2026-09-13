---
description: Add a company, a contact, or a deal
argument-hint: company|contact|deal <details in plain language>
---

The user will describe a new record in plain language. Map it to one of these:

Company:

```
node scripts/crm.mjs add company "<name>" [--domain=] [--industry=] [--city=] [--country=] [--notes=]
```

Contact:

```
node scripts/crm.mjs add contact "<first> <last>" --company="<company name>" [--email=] [--phone=] [--title=] [--notes=]
```

Deal (value in whole currency units, not cents):

```
node scripts/crm.mjs add deal "<title>" --company="<company name>" [--contact="<name>"] [--value=12500] [--stage=Lead] [--close=YYYY-MM-DD] [--currency=NZD]
```

Rules:

- Do the pieces in order. A contact needs its company to exist; a deal needs its company. If "add Jane Whitaker at Acme, she wants a $20k dispatch project" arrives and Acme is new, run add company, then add contact, then add deal.
- Deal titles: company name plus what the work is ("Acme dispatch automation"). Short and specific.
- Default stage is Lead. Only set another stage if the user says so.
- If a company or contact already exists, the CLI says so. Do not create duplicates; use the existing one.
- Do not invent emails, phone numbers, values or dates. Leave a field empty rather than guess.

Confirm each record in one line with its short id.
