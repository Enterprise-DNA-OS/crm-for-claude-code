-- Demo data for crm-for-claude-code.
-- Six companies, ten contacts, eight deals, twenty-one activities, six tasks.
-- Dates are relative to now() so `followups` always has something to say.
-- Every id is fixed and every insert is ON CONFLICT DO NOTHING, so re-running is safe.

-- Companies ----------------------------------------------------------------

insert into companies (id, name, domain, industry, city, country, notes, created_at) values
  ('a0000001-0000-4000-8000-000000000001', 'Harbourline Logistics',      'harbourline.co.nz',  'Logistics',   'Auckland',     'New Zealand', 'Three depots, 40 drivers. Dispatch still runs on spreadsheets.', now() - interval '60 days'),
  ('a0000002-0000-4000-8000-000000000002', 'Kauri Legal',                'kaurilegal.co.nz',   'Legal',       'Wellington',   'New Zealand', 'Boutique firm, 12 lawyers. Intake is email plus a shared inbox.', now() - interval '70 days'),
  ('a0000003-0000-4000-8000-000000000003', 'Southern Alps Adventures',   'southernalps.nz',    'Tourism',     'Queenstown',   'New Zealand', 'Seasonal peaks. Owner-run, answers bookings at night.', now() - interval '45 days'),
  ('a0000004-0000-4000-8000-000000000004', 'Brightwater Dental',         'brightwater.dental', 'Healthcare',  'Christchurch', 'New Zealand', 'Two clinics. Recall reminders were manual until we automated them.', now() - interval '55 days'),
  ('a0000005-0000-4000-8000-000000000005', 'Fernleaf Accounting',        'fernleaf.co.nz',     'Accounting',  'Hamilton',     'New Zealand', 'Went with an in-house build. Keep warm for next year.', now() - interval '65 days'),
  ('a0000006-0000-4000-8000-000000000006', 'Tidewater Marine Supplies',  'tidewater.co.nz',    'Retail',      'Tauranga',     'New Zealand', 'Chandlery with a busy trade counter. Stockouts cost them sales.', now() - interval '30 days')
on conflict (id) do nothing;

-- Contacts -----------------------------------------------------------------

insert into contacts (id, company_id, first_name, last_name, email, phone, title, created_at) values
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'Jane',   'Whitaker', 'jane@harbourline.co.nz',    '+64 21 555 0101', 'Operations Manager', now() - interval '60 days'),
  ('b0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'Tom',    'Ngata',    'tom@harbourline.co.nz',     '+64 21 555 0102', 'CFO',                now() - interval '10 days'),
  ('b0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'Priya',  'Sharma',   'priya@kaurilegal.co.nz',    '+64 21 555 0103', 'Managing Partner',   now() - interval '70 days'),
  ('b0000004-0000-4000-8000-000000000004', 'a0000002-0000-4000-8000-000000000002', 'Marcus', 'Reid',     'marcus@kaurilegal.co.nz',   '+64 21 555 0104', 'Practice Manager',   now() - interval '70 days'),
  ('b0000005-0000-4000-8000-000000000005', 'a0000003-0000-4000-8000-000000000003', 'Ella',   'Moana',    'ella@southernalps.nz',      '+64 21 555 0105', 'Owner',              now() - interval '45 days'),
  ('b0000006-0000-4000-8000-000000000006', 'a0000004-0000-4000-8000-000000000004', 'Sam',    'Okafor',   'sam@brightwater.dental',    '+64 21 555 0106', 'Principal Dentist',  now() - interval '55 days'),
  ('b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'Hannah', 'Lee',      'hannah@brightwater.dental', '+64 21 555 0107', 'Practice Manager',   now() - interval '55 days'),
  ('b0000008-0000-4000-8000-000000000008', 'a0000005-0000-4000-8000-000000000005', 'Rob',    'Patel',    'rob@fernleaf.co.nz',        '+64 21 555 0108', 'Director',           now() - interval '65 days'),
  ('b0000009-0000-4000-8000-000000000009', 'a0000006-0000-4000-8000-000000000006', 'Sophie', 'Bennett',  'sophie@tidewater.co.nz',    '+64 21 555 0109', 'General Manager',    now() - interval '30 days'),
  ('b0000010-0000-4000-8000-000000000010', 'a0000006-0000-4000-8000-000000000006', 'Liam',   'O''Connor','liam@tidewater.co.nz',      '+64 21 555 0110', 'Purchasing Lead',    now() - interval '40 days')
on conflict (id) do nothing;

-- Deals --------------------------------------------------------------------
-- Stage ids: 01 Lead, 02 Qualified, 03 Proposal, 04 Negotiation, 05 Won, 06 Lost

insert into deals (id, title, company_id, contact_id, stage_id, value_cents, currency, expected_close, status, lost_reason, won_at, lost_at, stage_changed_at, created_at) values
  ('c0000001-0000-4000-8000-000000000001', 'Harbourline dispatch automation',   'a0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', '00000003-0000-4000-8000-000000000003', 1850000, 'NZD', current_date + 21, 'open', null, null, null, now() - interval '9 days',  now() - interval '40 days'),
  ('c0000002-0000-4000-8000-000000000002', 'Harbourline finance reporting',     'a0000001-0000-4000-8000-000000000001', 'b0000002-0000-4000-8000-000000000002', '00000001-0000-4000-8000-000000000001',  600000, 'NZD', current_date + 45, 'open', null, null, null, now() - interval '5 days',  now() - interval '5 days'),
  ('c0000003-0000-4000-8000-000000000003', 'Kauri Legal intake system',         'a0000002-0000-4000-8000-000000000002', 'b0000003-0000-4000-8000-000000000003', '00000004-0000-4000-8000-000000000004', 2400000, 'NZD', current_date + 10, 'open', null, null, null, now() - interval '20 days', now() - interval '60 days'),
  ('c0000004-0000-4000-8000-000000000004', 'Southern Alps booking assistant',   'a0000003-0000-4000-8000-000000000003', 'b0000005-0000-4000-8000-000000000005', '00000002-0000-4000-8000-000000000002',  950000, 'NZD', current_date + 30, 'open', null, null, null, now() - interval '16 days', now() - interval '30 days'),
  ('c0000005-0000-4000-8000-000000000005', 'Brightwater recall reminders',      'a0000004-0000-4000-8000-000000000004', 'b0000007-0000-4000-8000-000000000007', '00000005-0000-4000-8000-000000000005',  720000, 'NZD', current_date - 12, 'won',  null, now() - interval '12 days', null, now() - interval '12 days', now() - interval '50 days'),
  ('c0000006-0000-4000-8000-000000000006', 'Fernleaf client onboarding',        'a0000005-0000-4000-8000-000000000005', 'b0000008-0000-4000-8000-000000000008', '00000006-0000-4000-8000-000000000006', 1100000, 'NZD', current_date - 20, 'lost', 'Chose an in-house build', null, now() - interval '25 days', now() - interval '25 days', now() - interval '65 days'),
  ('c0000007-0000-4000-8000-000000000007', 'Tidewater inventory alerts',        'a0000006-0000-4000-8000-000000000006', 'b0000009-0000-4000-8000-000000000009', '00000003-0000-4000-8000-000000000003', 1400000, 'NZD', current_date + 14, 'open', null, null, null, now() - interval '3 days',  now() - interval '20 days'),
  ('c0000008-0000-4000-8000-000000000008', 'Brightwater patient portal',        'a0000004-0000-4000-8000-000000000004', 'b0000006-0000-4000-8000-000000000006', '00000001-0000-4000-8000-000000000001', 1500000, 'NZD', current_date + 60, 'open', null, null, null, now() - interval '4 days',  now() - interval '4 days')
on conflict (id) do nothing;

-- Activities ---------------------------------------------------------------

insert into activities (id, kind, subject, body, occurred_at, contact_id, company_id, deal_id) values
  -- Harbourline dispatch automation (active, proposal out)
  ('d0000001-0000-4000-8000-000000000001', 'call',    'Discovery call with Jane',              'Dispatch runs on a shared spreadsheet. Two hours a day lost to phone confirmations. Wants it gone before summer.', now() - interval '35 days', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  ('d0000002-0000-4000-8000-000000000002', 'meeting', 'Walkthrough of the dispatch flow',      'Sat with the dispatch team for the morning run. Mapped the 11 steps. Steps 3 to 7 are pure copy and paste.', now() - interval '22 days', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  ('d0000003-0000-4000-8000-000000000003', 'email',   'Sent proposal v1',                      'Fixed price, four weeks, includes the driver SMS confirmations. Asked for a decision by the 24th.', now() - interval '9 days', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  ('d0000004-0000-4000-8000-000000000004', 'note',    'Board meets on the 24th',               'Jane said the board meets on the 24th and she will present the proposal then. Tom (CFO) will have questions on payback.', now() - interval '8 days', 'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  -- Harbourline finance reporting (new lead)
  ('d0000005-0000-4000-8000-000000000005', 'email',   'Intro from Jane to Tom',                'Jane introduced Tom. He wants the monthly pack out of Xero without the manual reconciliation.', now() - interval '5 days', 'b0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'c0000002-0000-4000-8000-000000000002'),
  -- Kauri Legal intake system (stuck in negotiation, quiet)
  ('d0000006-0000-4000-8000-000000000006', 'meeting', 'Scoping session with Priya and Marcus', 'Intake comes in by email, phone and web form. Nothing is logged consistently. Conflict checks are manual.', now() - interval '45 days', 'b0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'c0000003-0000-4000-8000-000000000003'),
  ('d0000007-0000-4000-8000-000000000007', 'email',   'Sent revised scope',                    'Dropped the document automation piece to bring the number down. Conflict check stays in.', now() - interval '30 days', 'b0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'c0000003-0000-4000-8000-000000000003'),
  ('d0000008-0000-4000-8000-000000000008', 'call',    'Priya wants pricing broken into phases','Partners are nervous about one large number. Asked for phase one (intake only) priced separately.', now() - interval '18 days', 'b0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'c0000003-0000-4000-8000-000000000003'),
  -- Southern Alps booking assistant (qualified, quiet)
  ('d0000009-0000-4000-8000-000000000009', 'call',    'Ella on peak-season booking pain',      'Answers booking emails at 11pm in season. Wants replies drafted and availability checked automatically.', now() - interval '30 days', 'b0000005-0000-4000-8000-000000000005', 'a0000003-0000-4000-8000-000000000003', 'c0000004-0000-4000-8000-000000000004'),
  ('d0000010-0000-4000-8000-000000000010', 'email',   'Sent summary and next steps',           'Recapped the call and proposed a two-week pilot on the email inbox only.', now() - interval '16 days', 'b0000005-0000-4000-8000-000000000005', 'a0000003-0000-4000-8000-000000000003', 'c0000004-0000-4000-8000-000000000004'),
  -- Brightwater recall reminders (won)
  ('d0000011-0000-4000-8000-000000000011', 'meeting', 'Clinic visit with Hannah',              'Recalls were a printed list and a phone. About 30 percent of six-month recalls never got called.', now() - interval '40 days', 'b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'c0000005-0000-4000-8000-000000000005'),
  ('d0000012-0000-4000-8000-000000000012', 'email',   'Sent proposal',                         'Automated SMS and email recalls from the practice system, with a daily exceptions list.', now() - interval '20 days', 'b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'c0000005-0000-4000-8000-000000000005'),
  ('d0000013-0000-4000-8000-000000000013', 'call',    'Hannah confirmed go-ahead',             'Signed. Wants it live before the school holidays.', now() - interval '12 days', 'b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'c0000005-0000-4000-8000-000000000005'),
  ('d0000014-0000-4000-8000-000000000014', 'note',    'Kickoff booked',                        'Kickoff set for next Tuesday at the Riccarton clinic.', now() - interval '10 days', 'b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'c0000005-0000-4000-8000-000000000005'),
  -- Fernleaf client onboarding (lost)
  ('d0000015-0000-4000-8000-000000000015', 'meeting', 'Onboarding process review',             'New clients take three weeks to onboard. Most of it is chasing documents.', now() - interval '50 days', 'b0000008-0000-4000-8000-000000000008', 'a0000005-0000-4000-8000-000000000005', 'c0000006-0000-4000-8000-000000000006'),
  ('d0000016-0000-4000-8000-000000000016', 'email',   'Sent proposal',                         'Document collection portal plus reminders. Six weeks.', now() - interval '35 days', 'b0000008-0000-4000-8000-000000000008', 'a0000005-0000-4000-8000-000000000005', 'c0000006-0000-4000-8000-000000000006'),
  ('d0000017-0000-4000-8000-000000000017', 'call',    'Rob: going in-house',                   'Their new hire wants to build it. Rob was apologetic. Asked us to check in next financial year.', now() - interval '25 days', 'b0000008-0000-4000-8000-000000000008', 'a0000005-0000-4000-8000-000000000005', 'c0000006-0000-4000-8000-000000000006'),
  -- Tidewater inventory alerts (active)
  ('d0000018-0000-4000-8000-000000000018', 'call',    'Sophie on stockouts',                   'Loses trade counter sales when fast movers run out. Wants low-stock alerts and a reorder suggestion list.', now() - interval '15 days', 'b0000009-0000-4000-8000-000000000009', 'a0000006-0000-4000-8000-000000000006', 'c0000007-0000-4000-8000-000000000007'),
  ('d0000019-0000-4000-8000-000000000019', 'meeting', 'Demo of the alert prototype',           'Showed a working prototype on a week of their sales data. Sophie brought Liam in for the second half.', now() - interval '6 days', 'b0000009-0000-4000-8000-000000000009', 'a0000006-0000-4000-8000-000000000006', 'c0000007-0000-4000-8000-000000000007'),
  ('d0000020-0000-4000-8000-000000000020', 'email',   'Sent proposal',                         'Three weeks, alerts plus the reorder list. Asked to meet Thursday to walk through it.', now() - interval '3 days', 'b0000009-0000-4000-8000-000000000009', 'a0000006-0000-4000-8000-000000000006', 'c0000007-0000-4000-8000-000000000007'),
  -- Brightwater patient portal (new lead from a happy customer)
  ('d0000021-0000-4000-8000-000000000021', 'call',    'Sam asked about a patient portal',      'After the recall project landed, Sam wants patients to see and change appointments online.', now() - interval '2 days', 'b0000006-0000-4000-8000-000000000006', 'a0000004-0000-4000-8000-000000000004', 'c0000008-0000-4000-8000-000000000008')
on conflict (id) do nothing;

-- Tasks --------------------------------------------------------------------

insert into tasks (id, title, due_on, done_at, contact_id, company_id, deal_id) values
  ('e0000001-0000-4000-8000-000000000001', 'Call Priya about phased pricing',        current_date - 5,  null,                       'b0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'c0000003-0000-4000-8000-000000000003'),
  ('e0000002-0000-4000-8000-000000000002', 'Send Ella the Brightwater case study',   current_date - 2,  null,                       'b0000005-0000-4000-8000-000000000005', 'a0000003-0000-4000-8000-000000000003', 'c0000004-0000-4000-8000-000000000004'),
  ('e0000003-0000-4000-8000-000000000003', 'Follow up on the Harbourline proposal',  current_date + 2,  null,                       'b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001'),
  ('e0000004-0000-4000-8000-000000000004', 'Proposal walkthrough with Sophie',       current_date + 5,  null,                       'b0000009-0000-4000-8000-000000000009', 'a0000006-0000-4000-8000-000000000006', 'c0000007-0000-4000-8000-000000000007'),
  ('e0000005-0000-4000-8000-000000000005', 'Send kickoff agenda to Hannah',          current_date - 10, now() - interval '9 days',  'b0000007-0000-4000-8000-000000000007', 'a0000004-0000-4000-8000-000000000004', 'c0000005-0000-4000-8000-000000000005'),
  ('e0000006-0000-4000-8000-000000000006', 'Ask Liam about the restock cycle',       current_date - 1,  null,                       'b0000010-0000-4000-8000-000000000010', 'a0000006-0000-4000-8000-000000000006', null)
on conflict (id) do nothing;
