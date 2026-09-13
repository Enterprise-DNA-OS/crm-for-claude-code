#!/usr/bin/env node
// Loads supabase/seed.sql: demo companies, contacts, deals, activities and tasks.
// Every row has a stable id and inserts with ON CONFLICT DO NOTHING, so re-running is harmless.

import { readFileSync } from 'node:fs';
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  const sql = readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(sql);
  const [c] = await db.query(`
    select (select count(*) from companies)  as companies,
           (select count(*) from contacts)   as contacts,
           (select count(*) from deals)      as deals,
           (select count(*) from activities) as activities,
           (select count(*) from tasks)      as tasks
  `);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    const counts = await seed(db);
    console.log(
      `seed: ${counts.companies} companies, ${counts.contacts} contacts, ${counts.deals} deals, ` +
        `${counts.activities} activities, ${counts.tasks} tasks`,
    );
  } finally {
    await db.close();
  }
}
