#!/usr/bin/env node
// End-to-end smoke test on a throwaway embedded database.
// Runs migrate, seed, then every CLI command that matters, and asserts on the JSON.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'crm-smoke-'));
const env = { ...process.env, CRM_DATA_DIR: dataDir };
delete env.DATABASE_URL; // the smoke test always runs embedded

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\nFAIL assertion: ${msg}`);
    process.exit(1);
  }
}

console.log(`smoke: data dir ${dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  const pipeline = run('pipeline', ['crm.mjs', 'pipeline']);
  assert(pipeline.stages.length >= 6, 'six stages');
  assert(pipeline.deals.length >= 6, 'open deals listed');
  assert(pipeline.totals.open_cents > 0, 'open pipeline value');

  const followups = run('followups', ['crm.mjs', 'followups']);
  const reasons = new Set(followups.map((f) => f.reason));
  assert(reasons.has('deal_quiet') && reasons.has('task_overdue') && reasons.has('contact_quiet'), 'all three follow-up reasons present');

  const contact = run('contact by name', ['crm.mjs', 'contact', 'jane whitaker']);
  assert(contact.contact.full_name === 'Jane Whitaker', 'resolved Jane');
  assert(contact.timeline.length >= 4, 'Jane has a timeline');
  assert(contact.deals.length >= 1, 'Jane has deals');

  const byPrefix = run('contact by id prefix', ['crm.mjs', 'contact', contact.contact.id.slice(0, 8)]);
  assert(byPrefix.contact.id === contact.contact.id, 'id prefix resolves');

  const ambiguous = run('ambiguous contact exits 1', ['crm.mjs', 'contact', 'a'], { json: false, expectFail: true });
  assert(/matches \d+ contacts/.test(ambiguous.stderr), 'ambiguity lists candidates');

  const company = run('company', ['crm.mjs', 'company', 'harbourline']);
  assert(company.contacts.length === 2, 'Harbourline has two people');
  assert(company.deals.length === 2, 'Harbourline has two deals');

  const newCo = run('add company', ['crm.mjs', 'add', 'company', 'Smoke Test Co', '--industry=Testing', '--city=Nelson']);
  assert(newCo.id, 'company created');
  const newContact = run('add contact', ['crm.mjs', 'add', 'contact', 'Casey Tester', '--company=Smoke Test Co', '--email=casey@smoke.test']);
  assert(newContact.company_id === newCo.id, 'contact linked to company');
  const newDeal = run('add deal', ['crm.mjs', 'add', 'deal', 'Smoke automation', '--contact=Casey Tester', '--value=4,250', '--close=2026-12-01']);
  assert(newDeal.value_cents === 425000 && newDeal.company_id === newCo.id, 'deal value and company');

  const moved = run('move deal', ['crm.mjs', 'move', 'Smoke automation', 'Proposal']);
  assert(moved.status === 'open', 'still open after move');
  const logged = run('log call', ['crm.mjs', 'log', 'Casey Tester', 'Casey liked the demo. Wants a quote by Friday.', '--kind=call']);
  assert(logged.activity.kind === 'call' && logged.deal && logged.deal.id === newDeal.id, 'call logged and auto-attached to the only open deal');
  const loggedCo = run('log note on company', ['crm.mjs', 'log', 'Smoke Test Co', 'Board approved budget.', '--kind=note']);
  assert(loggedCo.company.id === newCo.id, 'note logged on company');

  const task = run('task add', ['crm.mjs', 'task', 'add', 'Send Casey the quote', '--due=2026-09-01', '--deal=Smoke automation']);
  assert(task.deal_id === newDeal.id, 'task linked to deal');
  const tasks = run('task list', ['crm.mjs', 'task', 'list']);
  assert(tasks.some((t) => t.id === task.id), 'task listed');
  const done = run('task done', ['crm.mjs', 'task', 'done', task.id.slice(0, 8)]);
  assert(done.done_at, 'task done');

  const won = run('won', ['crm.mjs', 'won', newDeal.id.slice(0, 8)]);
  assert(won.status === 'won' && won.won_at, 'deal won');
  const lostDeal = run('add deal to lose', ['crm.mjs', 'add', 'deal', 'Smoke lost deal', '--company=Smoke Test Co', '--value=100']);
  const lost = run('lost', ['crm.mjs', 'lost', lostDeal.id, '--reason=Went quiet']);
  assert(lost.status === 'lost' && lost.lost_reason === 'Went quiet', 'deal lost with reason');

  const stats = run('stats', ['crm.mjs', 'stats']);
  assert(stats.won_deals >= 2 && stats.win_rate > 0 && stats.open_value_cents > 0, 'stats populated');

  const ex = path.join(root, 'examples', 'pipedrive');
  const imp = run('import pipedrive', ['crm.mjs', 'import', 'pipedrive', `--orgs=${path.join(ex, 'organizations.csv')}`, `--persons=${path.join(ex, 'persons.csv')}`, `--deals=${path.join(ex, 'deals.csv')}`]);
  assert(imp.companies.created === 4 && imp.contacts.created === 5 && imp.deals.created === 4, `import counts (${JSON.stringify(imp)})`);
  const imp2 = run('import pipedrive again (idempotent)', ['crm.mjs', 'import', 'pipedrive', `--orgs=${path.join(ex, 'organizations.csv')}`, `--persons=${path.join(ex, 'persons.csv')}`, `--deals=${path.join(ex, 'deals.csv')}`]);
  assert(imp2.companies.created === 0 && imp2.contacts.created === 0 && imp2.deals.created === 0 && imp2.deals.updated === 4, 're-import creates nothing new');
  const acme = run('imported deal resolves', ['crm.mjs', 'deal', 'Acme job costing dashboard']);
  assert(acme.deal.stage_name === 'Proposal' && acme.deal.value_cents === 1250000, 'Pipedrive stage and value mapped');
  const pat = run('imported contact with comma name', ['crm.mjs', 'contact', "Patrick O'Brien"]);
  assert(pat.deals.length === 1 && pat.deals[0].status === 'lost', 'comma-form name linked to its lost deal');

  const dump = run('export', ['crm.mjs', 'export']);
  assert(dump.companies.length >= 11 && dump.deals.length >= 14, 'export has everything');

  run('pipeline (text)', ['crm.mjs', 'pipeline'], { json: false });
  run('followups (text)', ['crm.mjs', 'followups'], { json: false });

  console.log('\nPASS');
} finally {
  if (existsSync(dataDir)) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the handle briefly; a leftover temp dir is harmless.
    }
  }
}
