---
description: Log a call, email, meeting or note against a contact or company
argument-hint: <who> "<what happened>" [call|email|meeting|note]
---

The user will describe something that happened, in plain language. Examples:

- "log a call with Jane at Acme, she wants the proposal split into two phases"
- "note on Harbourline: board meets on the 24th"
- "met Priya today, she is happy with phase one pricing"

Turn it into one CLI call:

```
node scripts/crm.mjs log "<contact or company>" "<the note, in the user's words, first person>" --kind=<call|email|meeting|note> [--deal="<deal title>"] [--when=YYYY-MM-DD]
```

Rules:

- Pick the kind from the words used: called, rang, spoke = call; emailed, sent, replied = email; met, meeting, demo, visit = meeting; anything else = note.
- Use the contact's name when a person is named, otherwise the company name. The CLI links the company automatically when it knows the contact.
- If the user names a deal, pass `--deal=`. If not, the CLI attaches the note to the person's only open deal on its own. If they have several open deals and the user did not say which, run `node scripts/crm.mjs contact "<name>"` first, then ask.
- Keep the note faithful. Do not add facts the user did not give you. Fix obvious dictation typos only.
- If the user mentions a follow-up ("call her back Thursday"), also create the task with `/task` after logging.
- If the CLI says the person or company does not exist, ask whether to add them with `/add`, then log.

Confirm in one line what was logged and what it was attached to.
