---
description: Import a Pipedrive export (Organizations, Persons, Deals CSVs) into this CRM
argument-hint: [path to the folder holding the three CSV files]
---

Walk the user through the Pipedrive migration. Full detail lives in `docs/replace-pipedrive.md`; read it first.

1. Confirm the files. Ask for (or find in the folder they gave you) three CSV exports from Pipedrive:
   - Organizations
   - Persons (People)
   - Deals

   Check each file's header row with a quick read. The importer needs at least `ID` and `Name` for organizations and persons, and `ID`, `Title`, `Stage`, `Status` for deals. Tell the user if a column is missing.

2. Show what will happen before running it: how many rows are in each file, which Pipedrive stage names will map to which stages here (Lead, Qualified, Proposal, Negotiation, Won, Lost) and which will be created as new stages. The mapping rules are in `docs/replace-pipedrive.md`.

3. Run the import:

   ```
   node scripts/crm.mjs import pipedrive --orgs="<organizations.csv>" --persons="<persons.csv>" --deals="<deals.csv>"
   ```

   Re-running the same files is safe. Rows match on their Pipedrive ids and update in place.

4. Show the import report, then run `node scripts/crm.mjs pipeline` and `node scripts/crm.mjs stats` so the user sees their data live.

5. Point out what did not carry over (activities, notes, emails, files, custom fields, owners) and where those live now. Do not pretend they were imported.

To try it on sample data first: the three files in `examples/pipedrive/`.
