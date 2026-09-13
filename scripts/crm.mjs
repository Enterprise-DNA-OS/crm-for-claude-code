#!/usr/bin/env node
// crm-for-claude-code: the one CLI. Claude Code slash commands call this; so can you.
//
//   node scripts/crm.mjs <command> [args] [--flags] [--json]
//
// Run with no arguments (or `help`) for the command list.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money, isoDate, dateTime, daysAgo, short, truncate, heading } from './lib/format.mjs';

// ---------------------------------------------------------------------------
// Argument parsing

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      flags.help = true;
      continue;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) flags[name] = true;
        else flags[name] = argv[++i];
      }
    } else {
      args.push(a);
    }
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const num = (v) => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Lookups: full id, first 8+ chars of an id, exact name, then a contains match.
// One hit wins. Several hits list the candidates and exit 1.

const RESOLVERS = {
  company: {
    from: 'companies c',
    cols: 'c.*',
    exact: 'lower(c.name) = lower($1) or lower(c.domain) = lower($1)',
    fuzzy: 'c.name ilike $1 or c.domain ilike $1',
    label: (r) => r.name,
    order: 'c.name',
  },
  contact: {
    from: 'contacts c left join companies co on co.id = c.company_id',
    cols: 'c.*, co.name as company_name',
    exact: 'lower(c.full_name) = lower($1) or lower(c.email) = lower($1)',
    fuzzy: 'c.full_name ilike $1 or c.email ilike $1',
    label: (r) => `${r.full_name}${r.company_name ? ` (${r.company_name})` : ''}`,
    order: 'c.full_name',
  },
  deal: {
    from: 'deals c left join companies co on co.id = c.company_id join pipeline_stages s on s.id = c.stage_id',
    cols: 'c.*, co.name as company_name, s.name as stage_name',
    exact: 'lower(c.title) = lower($1)',
    fuzzy: 'c.title ilike $1 or co.name ilike $1',
    label: (r) => `${r.title} [${r.stage_name}, ${r.status}]${r.company_name ? ` at ${r.company_name}` : ''}`,
    order: 'c.status, c.title',
  },
  stage: {
    from: 'pipeline_stages c',
    cols: 'c.*',
    exact: 'lower(c.name) = lower($1)',
    fuzzy: 'c.name ilike $1',
    label: (r) => r.name,
    order: 'c.position',
  },
  task: {
    from: 'tasks c',
    cols: 'c.*',
    exact: 'lower(c.title) = lower($1)',
    fuzzy: 'c.title ilike $1',
    label: (r) => `${r.title}${r.done_at ? ' (done)' : ''}`,
    order: 'c.done_at nulls first, c.due_on',
  },
};

const ID_RE = /^[0-9a-f]{4,8}(-[0-9a-f-]*)?$/i;

async function resolve(db, kind, q, { optional = false } = {}) {
  const spec = RESOLVERS[kind];
  q = String(q ?? '').trim();
  if (!q) {
    if (optional) return null;
    throw new CliError(`Give me a ${kind} name or id.`);
  }
  const select = `select ${spec.cols} from ${spec.from}`;
  let rows = [];
  if (ID_RE.test(q)) {
    rows = await db.query(`${select} where c.id::text like $1 order by ${spec.order}`, [q.toLowerCase() + '%']);
    if (rows.length === 1) return rows[0];
  }
  if (!rows.length) rows = await db.query(`${select} where ${spec.exact} order by ${spec.order}`, [q]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) rows = await db.query(`${select} where ${spec.fuzzy} order by ${spec.order}`, [`%${q}%`]);
  if (rows.length === 1) return rows[0];
  if (kind === 'deal' && rows.length > 1) {
    const open = rows.filter((r) => r.status === 'open');
    if (open.length === 1) return open[0];
  }
  if (!rows.length) {
    if (optional) return null;
    throw new CliError(`No ${kind} matches "${q}". Try \`${kind === 'contact' ? 'contacts' : kind === 'company' ? 'companies' : 'pipeline'}\` to list what exists.`);
  }
  throw new CliError(
    `"${q}" matches ${rows.length} ${kind}s. Use an id or a longer name:\n` +
      rows.map((r) => `  ${short(r.id)}  ${spec.label(r)}`).join('\n'),
  );
}

function parseMoney(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(n)) throw new CliError(`"${v}" is not an amount.`);
  return Math.round(n * 100);
}

function parseDate(v, what = 'date') {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD.`);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Read commands

async function cmdPipeline(db) {
  const stages = await db.query('select * from v_pipeline');
  const deals = await db.query(`
    select d.id, d.title, d.value_cents, d.currency, d.expected_close::text as expected_close,
           d.stage_changed_at, s.name as stage, s.position, c.name as company, p.full_name as contact,
           (select max(a.occurred_at) from activities a where a.deal_id = d.id) as last_activity
    from deals d
    join pipeline_stages s on s.id = d.stage_id
    left join companies c on c.id = d.company_id
    left join contacts p on p.id = d.contact_id
    where d.status = 'open'
    order by s.position, d.value_cents desc
  `);
  const openStages = stages.filter((s) => !['Won', 'Lost'].includes(s.stage));
  const totals = {
    open_deals: deals.length,
    open_cents: openStages.reduce((a, s) => a + num(s.value_cents), 0),
    weighted_cents: openStages.reduce((a, s) => a + num(s.weighted_cents), 0),
  };
  const text = [
    heading('Pipeline'),
    table(stages, [
      { key: 'stage', label: 'Stage' },
      { key: 'probability', label: 'Prob', align: 'right', format: (v) => `${v}%` },
      { key: 'deal_count', label: 'Deals', align: 'right' },
      { key: 'value_cents', label: 'Value', align: 'right', format: (v) => money(v) },
      { key: 'weighted_cents', label: 'Weighted', align: 'right', format: (v) => money(v) },
    ]),
    `\n  Open: ${totals.open_deals} deals, ${money(totals.open_cents)} (weighted ${money(totals.weighted_cents)})`,
    heading('Open deals'),
    table(deals, [
      { key: 'id', label: 'Id', format: short },
      { key: 'stage', label: 'Stage' },
      { key: 'title', label: 'Deal', width: 40 },
      { key: 'company', label: 'Company', width: 28 },
      { key: 'contact', label: 'Contact', width: 20 },
      { key: 'value_cents', label: 'Value', align: 'right', format: (v, r) => money(v, r.currency) },
      { key: 'expected_close', label: 'Close' },
      { key: 'stage_changed_at', label: 'In stage', align: 'right', format: (v) => `${Math.floor((Date.now() - new Date(v)) / 86400000)}d` },
      { key: 'last_activity', label: 'Last touch', format: (v) => (v ? daysAgo(v) : 'never') },
    ]),
  ].join('\n');
  return { json: { stages, totals, deals }, text };
}

async function cmdCompanies(db, [q = '']) {
  const rows = await db.query(
    `
    select c.id, c.name, c.industry, c.city, c.country, c.domain,
           (select count(*) from contacts p where p.company_id = c.id) as contacts,
           (select count(*) from deals d where d.company_id = c.id and d.status = 'open') as open_deals,
           (select coalesce(sum(d.value_cents), 0) from deals d where d.company_id = c.id and d.status = 'open') as open_cents,
           (select max(a.occurred_at) from activities a where a.company_id = c.id) as last_activity
    from companies c
    where $1::text = '' or c.name ilike '%' || $1::text || '%' or c.industry ilike '%' || $1::text || '%'
       or c.city ilike '%' || $1::text || '%' or c.domain ilike '%' || $1::text || '%'
    order by c.name
  `,
    [q],
  );
  const text = [
    heading(q ? `Companies matching "${q}"` : 'Companies'),
    table(rows, [
      { key: 'id', label: 'Id', format: short },
      { key: 'name', label: 'Company', width: 32 },
      { key: 'industry', label: 'Industry' },
      { key: 'city', label: 'City' },
      { key: 'contacts', label: 'People', align: 'right' },
      { key: 'open_deals', label: 'Open', align: 'right' },
      { key: 'open_cents', label: 'Open value', align: 'right', format: (v) => money(v) },
      { key: 'last_activity', label: 'Last touch', format: (v) => (v ? daysAgo(v) : 'never') },
    ]),
  ].join('\n');
  return { json: rows, text };
}

async function cmdContacts(db, [q = '']) {
  const rows = await db.query(
    `
    select p.id, p.full_name, p.title, p.email, p.phone, c.name as company,
           (select max(a.occurred_at) from activities a where a.contact_id = p.id) as last_activity,
           (select count(*) from deals d where d.contact_id = p.id and d.status = 'open') as open_deals
    from contacts p
    left join companies c on c.id = p.company_id
    where $1::text = '' or p.full_name ilike '%' || $1::text || '%' or p.email ilike '%' || $1::text || '%'
       or c.name ilike '%' || $1::text || '%' or p.title ilike '%' || $1::text || '%'
    order by c.name nulls last, p.full_name
  `,
    [q],
  );
  const text = [
    heading(q ? `Contacts matching "${q}"` : 'Contacts'),
    table(rows, [
      { key: 'id', label: 'Id', format: short },
      { key: 'full_name', label: 'Name', width: 24 },
      { key: 'company', label: 'Company', width: 28 },
      { key: 'title', label: 'Title', width: 22 },
      { key: 'email', label: 'Email', width: 30 },
      { key: 'open_deals', label: 'Open', align: 'right' },
      { key: 'last_activity', label: 'Last touch', format: (v) => (v ? daysAgo(v) : 'never') },
    ]),
  ].join('\n');
  return { json: rows, text };
}

function renderTimeline(rows) {
  if (!rows.length) return '  (no activity yet)';
  return rows
    .map((a) => {
      const head = `  ${dateTime(a.occurred_at)}  ${a.kind.padEnd(7)}  ${a.subject}${a.deal_title ? `  [${a.deal_title}]` : ''}${a.contact_name ? `  (${a.contact_name})` : ''}`;
      return a.body ? `${head}\n           ${a.body.replace(/\n/g, '\n           ')}` : head;
    })
    .join('\n');
}

const dealColumns = [
  { key: 'id', label: 'Id', format: short },
  { key: 'title', label: 'Deal', width: 40 },
  { key: 'stage', label: 'Stage' },
  { key: 'status', label: 'Status' },
  { key: 'value_cents', label: 'Value', align: 'right', format: (v, r) => money(v, r.currency) },
  { key: 'expected_close', label: 'Close' },
];

const taskColumns = [
  { key: 'id', label: 'Id', format: short },
  { key: 'due_on', label: 'Due', format: (v, r) => (v ? v + (!r.done_at && v < today() ? ' (overdue)' : '') : '') },
  { key: 'title', label: 'Task', width: 50 },
  { key: 'deal_title', label: 'Deal', width: 32 },
];

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function cmdContact(db, [q]) {
  const c = await resolve(db, 'contact', q);
  const deals = await db.query(
    `select d.id, d.title, d.status, d.value_cents, d.currency, d.expected_close::text as expected_close, s.name as stage
     from deals d join pipeline_stages s on s.id = d.stage_id where d.contact_id = $1 order by d.status, s.position`,
    [c.id],
  );
  const tasks = await db.query(
    `select t.id, t.title, t.due_on::text as due_on, t.done_at, d.title as deal_title
     from tasks t left join deals d on d.id = t.deal_id where t.contact_id = $1 and t.done_at is null order by t.due_on nulls last`,
    [c.id],
  );
  const timeline = await db.query('select * from v_contact_timeline where contact_id = $1 order by occurred_at desc', [c.id]);
  const text = [
    heading(c.full_name),
    `  ${[c.title, c.company_name].filter(Boolean).join(', ') || 'no title or company on file'}`,
    `  ${[c.email, c.phone].filter(Boolean).join('   ') || 'no email or phone on file'}`,
    `  id ${c.id}   added ${isoDate(c.created_at)}${c.notes ? `\n  notes: ${c.notes}` : ''}`,
    '\nDeals',
    table(deals, dealColumns),
    '\nOpen tasks',
    table(tasks, taskColumns),
    `\nTimeline (${timeline.length})`,
    renderTimeline(timeline),
  ].join('\n');
  return { json: { contact: c, deals, tasks, timeline }, text };
}

async function cmdCompany(db, [q]) {
  const co = await resolve(db, 'company', q);
  const contacts = await db.query(
    `select p.id, p.full_name, p.title, p.email, p.phone,
            (select max(a.occurred_at) from activities a where a.contact_id = p.id) as last_activity
     from contacts p where p.company_id = $1 order by p.full_name`,
    [co.id],
  );
  const deals = await db.query(
    `select d.id, d.title, d.status, d.value_cents, d.currency, d.expected_close::text as expected_close, s.name as stage, d.lost_reason
     from deals d join pipeline_stages s on s.id = d.stage_id where d.company_id = $1 order by d.status, s.position`,
    [co.id],
  );
  const tasks = await db.query(
    `select t.id, t.title, t.due_on::text as due_on, t.done_at, d.title as deal_title
     from tasks t left join deals d on d.id = t.deal_id
     where t.done_at is null and (t.company_id = $1 or d.company_id = $1 or t.contact_id in (select id from contacts where company_id = $1))
     order by t.due_on nulls last`,
    [co.id],
  );
  const timeline = await db.query(
    `select a.*, d.title as deal_title, p.full_name as contact_name
     from activities a left join deals d on d.id = a.deal_id left join contacts p on p.id = a.contact_id
     where a.company_id = $1 or d.company_id = $1 or p.company_id = $1
     order by a.occurred_at desc limit 25`,
    [co.id],
  );
  const text = [
    heading(co.name),
    `  ${[co.industry, co.city, co.country].filter(Boolean).join(', ') || 'no details on file'}${co.domain ? `   ${co.domain}` : ''}`,
    `  id ${co.id}   added ${isoDate(co.created_at)}${co.notes ? `\n  notes: ${co.notes}` : ''}`,
    '\nPeople',
    table(contacts, [
      { key: 'id', label: 'Id', format: short },
      { key: 'full_name', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'email', label: 'Email' },
      { key: 'last_activity', label: 'Last touch', format: (v) => (v ? daysAgo(v) : 'never') },
    ]),
    '\nDeals',
    table(deals, [...dealColumns, { key: 'lost_reason', label: 'Lost reason' }]),
    '\nOpen tasks',
    table(tasks, taskColumns),
    `\nRecent activity (${timeline.length})`,
    renderTimeline(timeline),
  ].join('\n');
  return { json: { company: co, contacts, deals, tasks, timeline }, text };
}

async function cmdDeal(db, [q]) {
  const d = await resolve(db, 'deal', q);
  const contact = d.contact_id ? (await db.query('select * from contacts where id = $1', [d.contact_id]))[0] : null;
  const timeline = await db.query(
    `select a.*, p.full_name as contact_name from activities a left join contacts p on p.id = a.contact_id
     where a.deal_id = $1 order by a.occurred_at desc`,
    [d.id],
  );
  const tasks = await db.query(
    `select t.id, t.title, t.due_on::text as due_on, t.done_at from tasks t where t.deal_id = $1 and t.done_at is null order by t.due_on nulls last`,
    [d.id],
  );
  const text = [
    heading(d.title),
    `  ${d.stage_name}, ${d.status}${d.status === 'lost' && d.lost_reason ? ` (${d.lost_reason})` : ''}   ${money(d.value_cents, d.currency)}   close ${isoDate(d.expected_close) || 'not set'}`,
    `  ${d.company_name || 'no company'}${contact ? `   ${contact.full_name}${contact.email ? ` <${contact.email}>` : ''}` : ''}`,
    `  id ${d.id}   created ${isoDate(d.created_at)}   in stage since ${isoDate(d.stage_changed_at)}${d.notes ? `\n  notes: ${d.notes}` : ''}`,
    '\nOpen tasks',
    table(tasks, taskColumns.slice(0, 3)),
    `\nTimeline (${timeline.length})`,
    renderTimeline(timeline),
  ].join('\n');
  return { json: { deal: d, contact, tasks, timeline }, text };
}

async function cmdFollowups(db) {
  const rows = await db.query(`
    select reason, ref_type, ref_id, label, company, contact, last_touch, days, due_on::text as due_on
    from v_followups_due
    order by case reason when 'task_overdue' then 0 when 'deal_quiet' then 1 else 2 end, days desc
  `);
  const groups = [
    ['task_overdue', 'Overdue tasks'],
    ['deal_quiet', 'Quiet deals (open, no activity for 14+ days)'],
    ['contact_quiet', 'Quiet contacts (no activity for 30+ days)'],
  ];
  const parts = [heading('Follow-ups')];
  for (const [reason, title] of groups) {
    const items = rows.filter((r) => r.reason === reason);
    parts.push(`\n${title}: ${items.length}`);
    parts.push(
      table(items, [
        { key: 'days', label: 'Days', align: 'right' },
        { key: 'label', label: reason === 'task_overdue' ? 'Task' : reason === 'deal_quiet' ? 'Deal' : 'Contact', width: 44 },
        ...(reason === 'contact_quiet' ? [] : [{ key: 'contact', label: 'Contact', width: 20 }]),
        { key: 'company', label: 'Company', width: 28 },
        { key: 'ref_id', label: 'Id', format: short },
      ]),
    );
  }
  if (!rows.length) parts.push('\n  Nothing is waiting on you.');
  return { json: rows, text: parts.join('\n') };
}

async function cmdStats(db) {
  const [d] = await db.query(`
    select
      count(*) filter (where status = 'open')  as open_count,
      count(*) filter (where status = 'won')   as won_count,
      count(*) filter (where status = 'lost')  as lost_count,
      coalesce(sum(value_cents) filter (where status = 'open'), 0) as open_cents,
      coalesce(sum(value_cents) filter (where status = 'won'), 0)  as won_cents,
      coalesce(avg(value_cents) filter (where status = 'won'), 0)  as avg_won_cents,
      coalesce(avg(value_cents) filter (where status = 'open'), 0) as avg_open_cents,
      coalesce(avg(extract(epoch from (won_at - created_at)) / 86400) filter (where status = 'won'), 0) as avg_days_to_close,
      count(*) filter (where status = 'won' and won_at >= now() - interval '90 days')  as won_90d,
      count(*) filter (where status = 'lost' and lost_at >= now() - interval '90 days') as lost_90d,
      coalesce(sum(value_cents) filter (where status = 'won' and won_at >= date_trunc('month', now())), 0) as won_this_month_cents
    from deals
  `);
  const [w] = await db.query(`
    select coalesce(sum(d.value_cents * s.probability / 100), 0) as weighted_cents
    from deals d join pipeline_stages s on s.id = d.stage_id where d.status = 'open'
  `);
  const [a] = await db.query(`
    select count(*) filter (where occurred_at >= now() - interval '7 days')  as last_7d,
           count(*) filter (where occurred_at >= now() - interval '30 days') as last_30d
    from activities
  `);
  const [t] = await db.query(`
    select count(*) filter (where done_at is null) as open_tasks,
           count(*) filter (where done_at is null and due_on < current_date) as overdue_tasks
    from tasks
  `);
  const won = num(d.won_count);
  const lost = num(d.lost_count);
  const stats = {
    open_deals: num(d.open_count),
    open_value_cents: num(d.open_cents),
    weighted_value_cents: num(w.weighted_cents),
    avg_open_deal_cents: Math.round(num(d.avg_open_cents)),
    won_deals: won,
    lost_deals: lost,
    win_rate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    won_value_cents: num(d.won_cents),
    avg_won_deal_cents: Math.round(num(d.avg_won_cents)),
    avg_days_to_close: Math.round(num(d.avg_days_to_close)),
    won_last_90d: num(d.won_90d),
    lost_last_90d: num(d.lost_90d),
    won_this_month_cents: num(d.won_this_month_cents),
    activities_last_7d: num(a.last_7d),
    activities_last_30d: num(a.last_30d),
    open_tasks: num(t.open_tasks),
    overdue_tasks: num(t.overdue_tasks),
  };
  const line = (k, v) => `  ${k.padEnd(28)} ${v}`;
  const text = [
    heading('Stats'),
    line('Open pipeline', `${stats.open_deals} deals, ${money(stats.open_value_cents)} (weighted ${money(stats.weighted_value_cents)})`),
    line('Average open deal', money(stats.avg_open_deal_cents)),
    line('Win rate (all time)', stats.win_rate === null ? 'no closed deals yet' : `${stats.win_rate}% (${won} won, ${lost} lost)`),
    line('Average won deal', money(stats.avg_won_deal_cents)),
    line('Average days to close', String(stats.avg_days_to_close)),
    line('Won, last 90 days', `${stats.won_last_90d} won, ${stats.lost_last_90d} lost`),
    line('Won this month', money(stats.won_this_month_cents)),
    line('Activity', `${stats.activities_last_7d} in the last 7 days, ${stats.activities_last_30d} in the last 30`),
    line('Tasks', `${stats.open_tasks} open, ${stats.overdue_tasks} overdue`),
  ].join('\n');
  return { json: stats, text };
}

// ---------------------------------------------------------------------------
// Write commands

async function cmdAdd(db, args, flags) {
  const [what, ...rest] = args;
  const positional = rest.join(' ').trim();

  if (what === 'company') {
    const name = flags.name || positional;
    if (!name) throw new CliError('Usage: add company "<name>" [--domain= --industry= --city= --country= --notes=]');
    const existing = await db.query('select * from companies where lower(name) = lower($1)', [name]);
    if (existing.length) throw new CliError(`"${existing[0].name}" already exists (${short(existing[0].id)}).`);
    const [row] = await db.query(
      `insert into companies (name, domain, industry, city, country, notes) values ($1, $2, $3, $4, $5, $6) returning *`,
      [name, flags.domain || null, flags.industry || null, flags.city || null, flags.country || null, flags.notes || null],
    );
    return { json: row, text: `Added company ${row.name} (${short(row.id)})` };
  }

  if (what === 'contact') {
    let first = flags.first;
    let last = flags.last;
    const full = flags.name || positional;
    if (!first && full) {
      const parts = full.split(/\s+/);
      first = parts.shift();
      last = parts.join(' ') || null;
    }
    if (!first) throw new CliError('Usage: add contact "<first> <last>" --company=<name> [--email= --phone= --title= --notes=]');
    const company = await resolve(db, 'company', flags.company, { optional: true });
    const [row] = await db.query(
      `insert into contacts (first_name, last_name, company_id, email, phone, title, notes) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [first, last || null, company?.id || null, flags.email || null, flags.phone || null, flags.title || null, flags.notes || null],
    );
    return {
      json: row,
      text: `Added contact ${row.full_name}${company ? ` at ${company.name}` : ''} (${short(row.id)})`,
    };
  }

  if (what === 'deal') {
    const title = flags.title || positional;
    if (!title) throw new CliError('Usage: add deal "<title>" --company=<name> [--contact= --value=12500 --stage=Lead --close=YYYY-MM-DD --currency=NZD]');
    const contact = await resolve(db, 'contact', flags.contact, { optional: true });
    let company = await resolve(db, 'company', flags.company, { optional: true });
    if (!company && contact?.company_id) company = (await db.query('select * from companies where id = $1', [contact.company_id]))[0];
    if (!company) throw new CliError('A deal needs a company. Pass --company=<name> (or --contact= for someone whose company we know).');
    const stage = await resolve(db, 'stage', flags.stage || 'Lead');
    const [row] = await db.query(
      `insert into deals (title, company_id, contact_id, stage_id, value_cents, currency, expected_close, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [title, company.id, contact?.id || null, stage.id, parseMoney(flags.value), flags.currency || 'NZD', parseDate(flags.close, 'close date'), flags.notes || null],
    );
    return {
      json: row,
      text: `Added deal ${row.title} at ${company.name}, ${stage.name}, ${money(row.value_cents, row.currency)} (${short(row.id)})`,
    };
  }

  throw new CliError('Usage: add company|contact|deal ...');
}

async function setStage(db, deal, stage, { reason } = {}) {
  const status = stage.name === 'Won' ? 'won' : stage.name === 'Lost' ? 'lost' : 'open';
  const [row] = await db.query(
    `update deals set stage_id = $2, stage_changed_at = now(), status = $3,
       won_at  = case when $3 = 'won'  then now() else null end,
       lost_at = case when $3 = 'lost' then now() else null end,
       lost_reason = case when $3 = 'lost' then coalesce($4, lost_reason) else null end
     where id = $1 returning *`,
    [deal.id, stage.id, status, reason || null],
  );
  return row;
}

async function cmdMove(db, args) {
  const [q, ...stageWords] = args;
  const stageName = stageWords.join(' ');
  if (!q || !stageName) throw new CliError('Usage: move <deal> <stage>');
  const deal = await resolve(db, 'deal', q);
  const stage = await resolve(db, 'stage', stageName);
  if (deal.stage_id === stage.id) return { json: deal, text: `${deal.title} is already in ${stage.name}.` };
  const row = await setStage(db, deal, stage);
  return { json: row, text: `Moved ${deal.title}: ${deal.stage_name} -> ${stage.name}${row.status !== 'open' ? ` (${row.status})` : ''}` };
}

async function cmdWon(db, [q]) {
  const deal = await resolve(db, 'deal', q);
  const stage = await resolve(db, 'stage', 'Won');
  const row = await setStage(db, deal, stage);
  return { json: row, text: `Won: ${deal.title} at ${deal.company_name}, ${money(row.value_cents, row.currency)}` };
}

async function cmdLost(db, [q], flags) {
  const deal = await resolve(db, 'deal', q);
  const stage = await resolve(db, 'stage', 'Lost');
  const row = await setStage(db, deal, stage, { reason: flags.reason });
  return { json: row, text: `Lost: ${deal.title} at ${deal.company_name}${row.lost_reason ? ` (${row.lost_reason})` : ' (no reason given, add one with --reason=)'}` };
}

async function cmdLog(db, args, flags) {
  const [who, ...noteWords] = args;
  const note = noteWords.join(' ').trim();
  if (!who || !note) throw new CliError('Usage: log <contact-or-company> "<note>" [--kind=call|email|meeting|note] [--deal=] [--subject=] [--when=YYYY-MM-DD]');
  const kind = String(flags.kind || 'note').toLowerCase();
  if (!['call', 'email', 'meeting', 'note'].includes(kind)) throw new CliError('--kind must be call, email, meeting or note.');

  let contact = null;
  let company = null;
  try {
    contact = await resolve(db, 'contact', who);
  } catch (e) {
    if (!(e instanceof CliError) || !e.message.startsWith('No contact')) throw e;
    company = await resolve(db, 'company', who);
  }
  if (contact?.company_id) company = (await db.query('select * from companies where id = $1', [contact.company_id]))[0];

  let deal = await resolve(db, 'deal', flags.deal, { optional: true });
  let autoAttached = false;
  if (!deal) {
    const open = await db.query(
      `select d.* from deals d where d.status = 'open' and (($1::uuid is not null and d.contact_id = $1::uuid) or ($2::uuid is not null and d.company_id = $2::uuid))
       order by d.updated_at desc`,
      [contact?.id || null, company?.id || null],
    );
    if (open.length === 1) {
      deal = open[0];
      autoAttached = true;
    }
  }
  const subject = flags.subject || truncate(note.split(/(?<=[.!?])\s/)[0], 80);
  const when = flags.when ? new Date(flags.when) : null;
  if (when && Number.isNaN(when.getTime())) throw new CliError(`"${flags.when}" is not a date.`);
  const [row] = await db.query(
    `insert into activities (kind, subject, body, occurred_at, contact_id, company_id, deal_id)
     values ($1, $2, $3, coalesce($4::timestamptz, now()), $5, $6, $7) returning *`,
    [kind, subject, note, when ? when.toISOString() : null, contact?.id || null, company?.id || null, deal?.id || null],
  );
  const target = contact ? `${contact.full_name}${company ? ` (${company.name})` : ''}` : company.name;
  return {
    json: { activity: row, contact, company, deal, auto_attached: autoAttached },
    text: `Logged ${kind} with ${target}: "${subject}"${deal ? `\n  attached to deal: ${deal.title}${autoAttached ? ' (their only open deal)' : ''}` : ''}`,
  };
}

async function cmdTask(db, args, flags) {
  const [action, ...rest] = args;

  if (action === 'add') {
    const title = rest.join(' ').trim();
    if (!title) throw new CliError('Usage: task add "<title>" --due=YYYY-MM-DD [--contact=|--company=|--deal=]');
    const contact = await resolve(db, 'contact', flags.contact, { optional: true });
    const deal = await resolve(db, 'deal', flags.deal, { optional: true });
    let company = await resolve(db, 'company', flags.company, { optional: true });
    if (!company && (deal?.company_id || contact?.company_id)) {
      company = (await db.query('select * from companies where id = $1', [deal?.company_id || contact.company_id]))[0];
    }
    const [row] = await db.query(
      `insert into tasks (title, due_on, contact_id, company_id, deal_id) values ($1, $2, $3, $4, $5) returning *, due_on::text as due_on`,
      [title, parseDate(flags.due, 'due date'), contact?.id || null, company?.id || null, deal?.id || null],
    );
    const links = [contact && contact.full_name, deal && deal.title, !contact && !deal && company && company.name].filter(Boolean);
    return { json: row, text: `Added task "${row.title}"${row.due_on ? ` due ${row.due_on}` : ''}${links.length ? ` for ${links.join(' / ')}` : ''} (${short(row.id)})` };
  }

  if (action === 'done') {
    const t = await resolve(db, 'task', rest.join(' '));
    if (t.done_at) return { json: t, text: `"${t.title}" was already done.` };
    const [row] = await db.query('update tasks set done_at = now() where id = $1 returning *, due_on::text as due_on', [t.id]);
    return { json: row, text: `Done: ${row.title}` };
  }

  if (action === 'list' || action === undefined) {
    const rows = await db.query(
      `select t.id, t.title, t.due_on::text as due_on, t.done_at, p.full_name as contact, c.name as company, d.title as deal_title
       from tasks t
       left join contacts p on p.id = t.contact_id
       left join companies c on c.id = coalesce(t.company_id, p.company_id)
       left join deals d on d.id = t.deal_id
       where $1::boolean or t.done_at is null
       order by t.done_at nulls first, t.due_on nulls last, t.created_at`,
      [Boolean(flags.all)],
    );
    const text = [
      heading(flags.all ? 'All tasks' : 'Open tasks'),
      table(rows, [
        ...taskColumns.slice(0, 3),
        { key: 'contact', label: 'Contact', width: 20 },
        { key: 'company', label: 'Company', width: 26 },
        { key: 'deal_title', label: 'Deal', width: 32 },
        ...(flags.all ? [{ key: 'done_at', label: 'Done', format: (v) => (v ? isoDate(v) : '') }] : []),
      ]),
    ].join('\n');
    return { json: rows, text };
  }

  throw new CliError('Usage: task add|done|list');
}

// ---------------------------------------------------------------------------
// Import from Pipedrive CSV exports

const STAGE_HINTS = [
  [/negotiat|contract|verbal|legal|review/i, 'Negotiation'],
  [/proposal|quote|pricing|presentation|sent/i, 'Proposal'],
  [/qualif|demo|discovery|meeting|needs|scop/i, 'Qualified'],
  [/lead|contact|new|inbound|prospect|idea/i, 'Lead'],
];

async function cmdImport(db, args, flags) {
  const [source] = args;
  if (source !== 'pipedrive') throw new CliError('Usage: import pipedrive --orgs=<csv> --persons=<csv> --deals=<csv>');
  const read = (p) => (p ? parseCsv(readFileSync(path.resolve(p), 'utf8')) : []);
  const orgs = read(flags.orgs);
  const persons = read(flags.persons);
  const deals = read(flags.deals);
  if (!orgs.length && !persons.length && !deals.length) throw new CliError('Nothing to import. Pass at least one of --orgs, --persons, --deals.');

  const report = { companies: { created: 0, updated: 0 }, contacts: { created: 0, updated: 0 }, deals: { created: 0, updated: 0, skipped: 0 }, stages_created: [], warnings: [] };
  const orgByRef = new Map();
  const orgByName = new Map();

  async function findCompany(ref, name) {
    if (ref && orgByRef.has(ref)) return orgByRef.get(ref);
    if (name && orgByName.has(name.toLowerCase())) return orgByName.get(name.toLowerCase());
    let row = ref ? (await db.query('select id, name from companies where external_ref = $1', [ref]))[0] : null;
    if (!row && name) row = (await db.query('select id, name from companies where lower(name) = lower($1)', [name]))[0];
    if (row) {
      if (ref) orgByRef.set(ref, row.id);
      orgByName.set(row.name.toLowerCase(), row.id);
      return row.id;
    }
    return null;
  }

  for (const r of orgs) {
    const name = pick(r, 'Name', 'Organization');
    if (!name) continue;
    const pdId = pick(r, 'ID', 'Id');
    const ref = pdId ? `pd-org-${pdId}` : null;
    const address = pick(r, 'Address') || null;
    const notes = pick(r, 'Label') ? `Pipedrive label: ${pick(r, 'Label')}` : null;
    const existing = await findCompany(ref, name);
    if (existing) {
      await db.query(
        `update companies set external_ref = coalesce(external_ref, $2), address = coalesce($3, address), notes = coalesce(notes, $4) where id = $1`,
        [existing, ref, address, notes],
      );
      report.companies.updated++;
    } else {
      const [row] = await db.query(`insert into companies (name, address, notes, external_ref) values ($1, $2, $3, $4) returning id`, [name, address, notes, ref]);
      if (ref) orgByRef.set(ref, row.id);
      orgByName.set(name.toLowerCase(), row.id);
      report.companies.created++;
    }
  }

  const personByRef = new Map();
  const personByName = new Map();
  for (const r of persons) {
    let first = pick(r, 'First name');
    let last = pick(r, 'Last name');
    const full = pick(r, 'Name');
    if (!first && full) {
      if (full.includes(',')) {
        const [l, f] = full.split(',').map((s) => s.trim());
        first = f;
        last = l;
      } else {
        const parts = full.split(/\s+/);
        first = parts.shift();
        last = parts.join(' ');
      }
    }
    if (!first) continue;
    const pdId = pick(r, 'ID', 'Id');
    const ref = pdId ? `pd-person-${pdId}` : null;
    const email = pick(r, 'Email', 'Email - Work', 'Email - Other', 'Email - Home') || null;
    const phone = pick(r, 'Phone', 'Phone - Work', 'Phone - Mobile', 'Phone - Other') || null;
    const title = pick(r, 'Job title', 'Title', 'Position') || null;
    const orgRefId = pick(r, 'Organization ID', 'Org ID');
    const orgName = pick(r, 'Organization', 'Org name', 'Organisation');
    let companyId = await findCompany(orgRefId ? `pd-org-${orgRefId}` : null, orgName);
    if (!companyId && orgName) {
      const [row] = await db.query(`insert into companies (name, external_ref) values ($1, $2) returning id`, [orgName, orgRefId ? `pd-org-${orgRefId}` : null]);
      companyId = row.id;
      orgByName.set(orgName.toLowerCase(), row.id);
      if (orgRefId) orgByRef.set(`pd-org-${orgRefId}`, row.id);
      report.companies.created++;
    }
    let existing = ref ? (await db.query('select id from contacts where external_ref = $1', [ref]))[0] : null;
    if (!existing && email) existing = (await db.query('select id from contacts where lower(email) = lower($1)', [email]))[0];
    const displayName = `${first} ${last || ''}`.trim();
    if (existing) {
      await db.query(
        `update contacts set external_ref = coalesce(external_ref, $2), phone = coalesce(phone, $3), title = coalesce(title, $4), company_id = coalesce(company_id, $5) where id = $1`,
        [existing.id, ref, phone, title, companyId],
      );
      report.contacts.updated++;
      if (ref) personByRef.set(ref, existing.id);
      personByName.set(displayName.toLowerCase(), existing.id);
    } else {
      const [row] = await db.query(
        `insert into contacts (first_name, last_name, email, phone, title, company_id, external_ref) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [first, last || null, email, phone, title, companyId, ref],
      );
      report.contacts.created++;
      if (ref) personByRef.set(ref, row.id);
      personByName.set(displayName.toLowerCase(), row.id);
    }
  }

  const stages = await db.query('select * from pipeline_stages order by position');
  async function stageFor(name, status) {
    if (status === 'won') return stages.find((s) => s.name === 'Won');
    if (status === 'lost') return stages.find((s) => s.name === 'Lost');
    const clean = String(name || '').trim();
    let s = stages.find((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (s) return s;
    for (const [re, target] of STAGE_HINTS) {
      if (re.test(clean)) {
        s = stages.find((x) => x.name === target);
        if (s) return s;
      }
    }
    if (!clean) return stages.find((x) => x.name === 'Lead');
    const openPositions = stages.filter((x) => x.position < 90).map((x) => x.position);
    const position = (openPositions.length ? Math.max(...openPositions) : 0) + 10;
    const [row] = await db.query(`insert into pipeline_stages (name, position, probability) values ($1, $2, 50) returning *`, [clean, position]);
    stages.push(row);
    report.stages_created.push(clean);
    return row;
  }

  const ts = (v) => {
    if (!v) return null;
    const d = new Date(String(v).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  for (const r of deals) {
    const title = pick(r, 'Title', 'Deal title', 'Name');
    if (!title) continue;
    const status = (pick(r, 'Status') || 'open').toLowerCase();
    if (status === 'deleted') {
      report.deals.skipped++;
      continue;
    }
    const pdId = pick(r, 'ID', 'Id');
    const ref = pdId ? `pd-deal-${pdId}` : null;
    const orgRefId = pick(r, 'Organization ID', 'Org ID');
    const orgName = pick(r, 'Organization', 'Organisation', 'Org name');
    let companyId = await findCompany(orgRefId ? `pd-org-${orgRefId}` : null, orgName);
    if (!companyId && orgName) {
      const [row] = await db.query(`insert into companies (name, external_ref) values ($1, $2) returning id`, [orgName, orgRefId ? `pd-org-${orgRefId}` : null]);
      companyId = row.id;
      orgByName.set(orgName.toLowerCase(), row.id);
      report.companies.created++;
    }
    const personRefId = pick(r, 'Contact person ID', 'Person ID');
    const personName = pick(r, 'Contact person', 'Person', 'Contact');
    let contactId = personRefId ? personByRef.get(`pd-person-${personRefId}`) : null;
    if (!contactId && personRefId) contactId = (await db.query('select id from contacts where external_ref = $1', [`pd-person-${personRefId}`]))[0]?.id;
    if (!contactId && personName) {
      const norm = personName.includes(',') ? personName.split(',').map((s) => s.trim()).reverse().join(' ') : personName;
      contactId = personByName.get(norm.toLowerCase()) || (await db.query('select id from contacts where lower(full_name) = lower($1)', [norm]))[0]?.id || null;
    }
    const stage = await stageFor(pick(r, 'Stage'), status);
    const valueCents = parseMoney(pick(r, 'Value'));
    const currency = pick(r, 'Currency') || 'NZD';
    const expected = ts(pick(r, 'Expected close date', 'Close date'))?.slice(0, 10) || null;
    const wonAt = status === 'won' ? ts(pick(r, 'Won time', 'Close date')) : null;
    const lostAt = status === 'lost' ? ts(pick(r, 'Lost time', 'Close date')) : null;
    const lostReason = status === 'lost' ? pick(r, 'Lost reason') || null : null;
    const createdAt = ts(pick(r, 'Deal created', 'Add time', 'Created'));
    const existing = ref ? (await db.query('select id from deals where external_ref = $1', [ref]))[0] : null;
    if (existing) {
      await db.query(
        `update deals set title = $2, company_id = coalesce($3, company_id), contact_id = coalesce($4, contact_id), stage_id = $5,
           value_cents = $6, currency = $7, expected_close = $8, status = $9, won_at = $10, lost_at = $11, lost_reason = $12 where id = $1`,
        [existing.id, title, companyId, contactId, stage.id, valueCents, currency, expected, status, wonAt, lostAt, lostReason],
      );
      report.deals.updated++;
    } else {
      await db.query(
        `insert into deals (title, company_id, contact_id, stage_id, value_cents, currency, expected_close, status, won_at, lost_at, lost_reason, external_ref, created_at, stage_changed_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13::timestamptz, now()), coalesce($14::timestamptz, $13::timestamptz, now()))`,
        [title, companyId, contactId, stage.id, valueCents, currency, expected, status, wonAt, lostAt, lostReason, ref, createdAt, wonAt || lostAt],
      );
      report.deals.created++;
    }
    if (!companyId) report.warnings.push(`deal "${title}" has no organisation`);
  }

  const text = [
    heading('Pipedrive import'),
    `  Companies  ${report.companies.created} created, ${report.companies.updated} updated`,
    `  Contacts   ${report.contacts.created} created, ${report.contacts.updated} updated`,
    `  Deals      ${report.deals.created} created, ${report.deals.updated} updated, ${report.deals.skipped} skipped (deleted)`,
    report.stages_created.length ? `  New stages ${report.stages_created.join(', ')} (probability 50%, adjust in pipeline_stages)` : '  Stages     all mapped to existing stages',
    ...report.warnings.map((w) => `  warning: ${w}`),
    '\n  Re-running the same files is safe: rows are matched on their Pipedrive ids.',
  ].join('\n');
  return { json: report, text };
}

async function cmdExport(db, args, flags) {
  const out = { exported_at: new Date().toISOString() };
  for (const t of ['pipeline_stages', 'companies', 'contacts', 'deals', 'activities', 'tasks']) {
    out[t] = await db.query(`select * from ${t} order by created_at`);
  }
  const json = JSON.stringify(out, null, 2);
  if (flags.out) {
    writeFileSync(path.resolve(flags.out), json);
    return { json: { written: path.resolve(flags.out), counts: Object.fromEntries(Object.entries(out).filter(([k]) => k !== 'exported_at').map(([k, v]) => [k, v.length])) }, text: `Wrote ${path.resolve(flags.out)}` };
  }
  return { json: out, text: json };
}

// ---------------------------------------------------------------------------

const HELP = `crm-for-claude-code

  pipeline                          stages with counts, value, weighted value, and every open deal
  companies [q]                     list companies (filter by name, industry, city)
  contacts [q]                      list contacts (filter by name, email, company, title)
  company <name|id>                 one company: people, deals, tasks, recent activity
  contact <name|id>                 one contact: profile, deals, tasks, full timeline
  deal <title|id>                   one deal: details, tasks, timeline
  followups                         quiet deals, overdue tasks, quiet contacts
  stats                             win rate, average deal, days to close, pipeline value

  add company "<name>" [--domain= --industry= --city= --country= --notes=]
  add contact "<first> <last>" --company=<name> [--email= --phone= --title=]
  add deal "<title>" --company=<name> [--contact= --value=12500 --stage=Lead --close=YYYY-MM-DD]
  move <deal> <stage>               change stage (Won / Lost also set the status)
  won <deal>                        mark won
  lost <deal> --reason="..."        mark lost
  log <contact|company> "<note>" [--kind=call|email|meeting|note] [--deal=] [--when=YYYY-MM-DD]
  task add "<title>" --due=YYYY-MM-DD [--contact=|--company=|--deal=]
  task done <id|title>
  task list [--all]

  import pipedrive --orgs=<csv> --persons=<csv> --deals=<csv>
  export [--out=file.json]

Any command takes --json for machine-readable output.
Ids can be shortened to their first 8 characters. Names match case-insensitively.
`;

const COMMANDS = {
  pipeline: cmdPipeline,
  companies: cmdCompanies,
  contacts: cmdContacts,
  company: cmdCompany,
  contact: cmdContact,
  deal: cmdDeal,
  followups: cmdFollowups,
  stats: cmdStats,
  add: cmdAdd,
  move: cmdMove,
  won: cmdWon,
  lost: cmdLost,
  log: cmdLog,
  task: cmdTask,
  import: cmdImport,
  export: cmdExport,
};

async function main() {
  const { args, flags } = parseArgv(process.argv.slice(2));
  const [command, ...rest] = args;
  if (!command || command === 'help' || flags.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const fn = COMMANDS[command];
  if (!fn) {
    process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
    return 1;
  }
  const db = await getDb();
  try {
    const result = await fn(db, rest, flags);
    if (flags.json) process.stdout.write(JSON.stringify(result.json, null, 2) + '\n');
    else process.stdout.write(result.text.replace(/^\n/, '') + '\n');
    return 0;
  } catch (e) {
    if (e instanceof CliError) {
      process.stderr.write(`${e.message}\n`);
      return e.code;
    }
    if (/relation .* does not exist/.test(e.message)) {
      process.stderr.write(`The database has no tables yet. Run: npm run migrate\n`);
      return 1;
    }
    throw e;
  } finally {
    await db.close();
  }
}

process.exitCode = await main();
