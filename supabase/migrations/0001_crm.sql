-- crm-for-claude-code: core schema.
-- Runs unchanged on PGlite (embedded) and on Postgres / Supabase.

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- Stages -------------------------------------------------------------------

create table if not exists pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  position    integer not null,
  probability integer not null default 0 check (probability between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Companies ----------------------------------------------------------------

create table if not exists companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  domain       text,
  industry     text,
  address      text,
  city         text,
  country      text,
  notes        text,
  external_ref text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists companies_name_lower_idx on companies (lower(name));

-- Contacts -----------------------------------------------------------------

create table if not exists contacts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete set null,
  first_name   text not null,
  last_name    text,
  full_name    text generated always as (trim(first_name || ' ' || coalesce(last_name, ''))) stored,
  email        text,
  phone        text,
  title        text,
  notes        text,
  external_ref text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_company_idx on contacts (company_id);
create index if not exists contacts_email_lower_idx on contacts (lower(email));

-- Deals --------------------------------------------------------------------

create table if not exists deals (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  company_id       uuid references companies(id) on delete set null,
  contact_id       uuid references contacts(id) on delete set null,
  stage_id         uuid not null references pipeline_stages(id),
  value_cents      bigint not null default 0,
  currency         text not null default 'NZD',
  expected_close   date,
  status           text not null default 'open' check (status in ('open', 'won', 'lost')),
  lost_reason      text,
  won_at           timestamptz,
  lost_at          timestamptz,
  stage_changed_at timestamptz not null default now(),
  notes            text,
  external_ref     text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists deals_stage_idx on deals (stage_id);
create index if not exists deals_company_idx on deals (company_id);
create index if not exists deals_status_idx on deals (status);

-- Activities ---------------------------------------------------------------

create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('call', 'email', 'meeting', 'note')),
  subject     text not null,
  body        text,
  occurred_at timestamptz not null default now(),
  contact_id  uuid references contacts(id) on delete set null,
  company_id  uuid references companies(id) on delete set null,
  deal_id     uuid references deals(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists activities_contact_idx on activities (contact_id, occurred_at desc);
create index if not exists activities_company_idx on activities (company_id, occurred_at desc);
create index if not exists activities_deal_idx on activities (deal_id, occurred_at desc);

-- Tasks --------------------------------------------------------------------

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  due_on     date,
  done_at    timestamptz,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  deal_id    uuid references deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_open_idx on tasks (due_on) where done_at is null;

-- updated_at triggers -------------------------------------------------------

drop trigger if exists pipeline_stages_updated_at on pipeline_stages;
create trigger pipeline_stages_updated_at before update on pipeline_stages for each row execute function set_updated_at();
drop trigger if exists companies_updated_at on companies;
create trigger companies_updated_at before update on companies for each row execute function set_updated_at();
drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at before update on contacts for each row execute function set_updated_at();
drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at before update on deals for each row execute function set_updated_at();
drop trigger if exists activities_updated_at on activities;
create trigger activities_updated_at before update on activities for each row execute function set_updated_at();
drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks for each row execute function set_updated_at();

-- Default stages -----------------------------------------------------------
-- Positions leave gaps so imported stages can slot in between.

insert into pipeline_stages (id, name, position, probability) values
  ('00000001-0000-4000-8000-000000000001', 'Lead',        10,  10),
  ('00000002-0000-4000-8000-000000000002', 'Qualified',   20,  30),
  ('00000003-0000-4000-8000-000000000003', 'Proposal',    30,  50),
  ('00000004-0000-4000-8000-000000000004', 'Negotiation', 40,  75),
  ('00000005-0000-4000-8000-000000000005', 'Won',         90, 100),
  ('00000006-0000-4000-8000-000000000006', 'Lost',       100,   0)
on conflict (name) do nothing;

-- Views --------------------------------------------------------------------

-- Deals per stage with raw and probability-weighted value.
create or replace view v_pipeline as
select
  s.id                                                      as stage_id,
  s.name                                                    as stage,
  s.position,
  s.probability,
  count(d.id)                                               as deal_count,
  coalesce(sum(d.value_cents), 0)                           as value_cents,
  coalesce(sum(d.value_cents * s.probability / 100), 0)     as weighted_cents
from pipeline_stages s
left join deals d on d.stage_id = s.id
group by s.id, s.name, s.position, s.probability
order by s.position;

-- Everything that wants a nudge, in one list.
--   deal_quiet     open deal with no activity for 14+ days
--   task_overdue   task past its due date and not done
--   contact_quiet  contact with no activity for 30+ days
create or replace view v_followups_due as
select
  'deal_quiet'::text                                          as reason,
  'deal'::text                                                as ref_type,
  d.id                                                        as ref_id,
  d.title                                                     as label,
  c.name                                                      as company,
  p.full_name                                                 as contact,
  coalesce(max(a.occurred_at), d.created_at)                  as last_touch,
  (current_date - coalesce(max(a.occurred_at), d.created_at)::date)::integer as days,
  null::date                                                  as due_on
from deals d
left join companies c on c.id = d.company_id
left join contacts p on p.id = d.contact_id
left join activities a on a.deal_id = d.id
where d.status = 'open'
group by d.id, d.title, c.name, p.full_name, d.created_at
having coalesce(max(a.occurred_at), d.created_at) < now() - interval '14 days'

union all

select
  'task_overdue',
  'task',
  t.id,
  t.title,
  coalesce(c.name, pc.name, dc.name),
  p.full_name,
  null::timestamptz,
  (current_date - t.due_on)::integer,
  t.due_on
from tasks t
left join companies c  on c.id = t.company_id
left join contacts p   on p.id = t.contact_id
left join companies pc on pc.id = p.company_id
left join deals d      on d.id = t.deal_id
left join companies dc on dc.id = d.company_id
where t.done_at is null and t.due_on < current_date

union all

select
  'contact_quiet',
  'contact',
  p.id,
  p.full_name,
  c.name,
  p.full_name,
  coalesce(max(a.occurred_at), p.created_at),
  (current_date - coalesce(max(a.occurred_at), p.created_at)::date)::integer,
  null::date
from contacts p
left join companies c on c.id = p.company_id
left join activities a on a.contact_id = p.id
group by p.id, p.full_name, c.name, p.created_at
having coalesce(max(a.occurred_at), p.created_at) < now() - interval '30 days';

-- One row per activity on a contact, newest first, with the deal it touched.
create or replace view v_contact_timeline as
select
  a.contact_id,
  a.id          as activity_id,
  a.kind,
  a.subject,
  a.body,
  a.occurred_at,
  a.deal_id,
  d.title       as deal_title,
  a.company_id,
  c.name        as company
from activities a
left join deals d on d.id = a.deal_id
left join companies c on c.id = a.company_id
where a.contact_id is not null
order by a.occurred_at desc;
