---
description: Draft a short follow-up email for a deal or contact, saved to drafts/, never sent
argument-hint: <deal title, contact name, or id>
---

This command writes a draft. It never sends anything. There is no send path in this repo and you must not create one.

Steps:

1. Read the full history first. Run whichever fits what the user named:

   ```
   node scripts/crm.mjs deal "$ARGUMENTS"
   node scripts/crm.mjs contact "$ARGUMENTS"
   ```

   If the deal has a contact, also run `contact` for that person so you have every touch, not just the deal's.

2. Read the whole timeline before writing a word. Note: the last thing they said, the last thing we promised, any date mentioned (board meeting, decision deadline, holiday), the stage and value.

3. Read the "Who this works for" block in `CLAUDE.md` for the operator's name, business and voice notes. Write as that person, first person, to the contact by first name.

4. Draft the email:
   - Subject line: specific, under 8 words, no "Following up" or "Checking in".
   - 60 to 120 words. Three short paragraphs at most.
   - Open with something from the timeline, not a pleasantry.
   - One clear ask with a date or a choice of two times.
   - No buzzwords, no exclamation marks, no "hope this finds you well".
   - Sign off with the operator's first name only.

5. Save it to `drafts/followup-<contact-or-deal-slug>-YYYY-MM-DD.md` with this shape:

   ```
   To: <contact email>
   Subject: <subject>

   <body>

   ---
   Context used: <one line on which timeline items shaped the draft>
   ```

6. Show the draft in full and say where it was saved. Offer to log it with `/log` once the user has sent it from their own email client.

If the timeline is empty, say so and ask the user what they want to say. Do not invent history.
