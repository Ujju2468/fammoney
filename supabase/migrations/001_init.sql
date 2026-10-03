-- FamMoney 001_init.sql  (blueprint v1.0: ENT-001..007,009,010,013 · SEC-001/002 · RUL-006/013/016/017/019)
-- Run once in Supabase > SQL Editor. Money = integer paise (RUL-001). Server clock owns created_at.
create extension if not exists pgcrypto with schema extensions;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null, currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  version int not null default 1);

create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users, display_name text not null, colour text default '#7bac7e',
  role text not null check (role in ('owner','member','dependent')),
  status text not null default 'active' check (status in ('active','former')),
  visibility_scope text not null default 'full' check (visibility_scope in ('full','own')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  version int not null default 1, unique (household_id, user_id));

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null, kind text not null check (kind in ('spend','bill','save','invest')),
  icon text, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1);

create table month_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
  unique (household_id, month_key));

create table allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  plan_id uuid not null references month_plans on delete cascade,
  member_id uuid not null references members, category_id uuid not null references categories,
  amount_paise bigint not null check (amount_paise >= 0), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
  unique (plan_id, member_id, category_id));

create table income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references members, source text not null default 'salary',
  amount_paise bigint not null check (amount_paise > 0), received_on date not null,
  month_key text not null, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references members,          -- whose money = the typist (RUL-004)
  for_member_id uuid references members,               -- spent-for tag
  category_id uuid not null references categories,
  allocation_id uuid references allocations,           -- null = Unplanned (RUL-009)
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000),
  occurred_at timestamptz not null default now(),
  local_date date, month_key text,                     -- derived by trigger (RUL-002/003)
  mode text not null default 'upi' check (mode in ('cash','upi','card','netbanking','autodebit','other')),
  payee text check (char_length(payee) <= 60), bill_no text check (char_length(bill_no) <= 30),
  note text check (char_length(note) <= 200),
  status text not null default 'active' check (status in ('active','void')),
  void_reason text, adjusts_txn_id uuid references transactions,
  client_op_id text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
  constraint void_needs_reason check (status = 'active' or char_length(coalesce(void_reason,'')) >= 3),
  unique (member_id, client_op_id));                   -- idempotency (RUL-013)
create index on transactions (household_id, month_key, member_id);
create index on transactions (household_id, local_date);
create index on transactions (household_id, updated_at, id);

create table audit_entries (
  id bigint generated always as identity primary key,
  household_id uuid not null, entity_type text not null, entity_id uuid, action text not null,
  before jsonb, after jsonb, actor_user_id uuid default auth.uid(), at timestamptz not null default now());
create table invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  token_hash text not null unique, role text not null check (role in ('owner','member','dependent')),
  expires_at timestamptz not null default now() + interval '48 hours', used_at timestamptz,
  created_by uuid default auth.uid());
create table app_config (id int primary key default 1 check (id = 1),
  latest_app_version text not null default '0.1.0', min_app_version text not null default '0.1.0',
  maintenance_mode boolean not null default false, message text);
insert into app_config default values;

-- ---------- helpers (security definer so RLS can call them without recursion) ----------
create function is_member(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where household_id = h and user_id = auth.uid() and status = 'active') $$;
create function is_owner(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where household_id = h and user_id = auth.uid() and status = 'active' and role = 'owner') $$;
create function is_adult(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where household_id = h and user_id = auth.uid() and status = 'active' and role in ('owner','member')) $$;
create function my_member_id(h uuid) returns uuid language sql stable security definer set search_path = public as
$$ select id from members where household_id = h and user_id = auth.uid() and status = 'active' $$;
create function sees_all(h uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where household_id = h and user_id = auth.uid() and status = 'active' and visibility_scope = 'full') $$;

-- ---------- row-level security: default deny (SEC-001) ----------
alter table households enable row level security;   alter table members enable row level security;
alter table categories enable row level security;   alter table month_plans enable row level security;
alter table allocations enable row level security;  alter table income_entries enable row level security;
alter table transactions enable row level security; alter table audit_entries enable row level security;
alter table invites enable row level security;      alter table app_config enable row level security;

create policy h_sel on households for select using (is_member(id));
create policy h_upd on households for update using (is_owner(id)) with check (is_owner(id));
create policy m_sel on members for select using (is_member(household_id));
create policy m_upd on members for update using (is_owner(household_id)) with check (is_owner(household_id));
create policy c_sel on categories for select using (is_member(household_id));
create policy c_all on categories for all using (is_owner(household_id)) with check (is_owner(household_id));
create policy p_sel on month_plans for select using (is_member(household_id));
create policy p_all on month_plans for all using (is_owner(household_id)) with check (is_owner(household_id));
create policy a_sel on allocations for select using (is_member(household_id));
create policy a_all on allocations for all using (is_owner(household_id)) with check (is_owner(household_id));
create policy i_sel on income_entries for select using (is_adult(household_id));          -- QST-002
create policy i_all on income_entries for all using (is_owner(household_id)) with check (is_owner(household_id));
create policy t_sel on transactions for select using (
  is_member(household_id) and (sees_all(household_id) or member_id = my_member_id(household_id)));
create policy t_ins on transactions for insert with check (member_id = my_member_id(household_id));
create policy t_upd on transactions for update using (member_id = my_member_id(household_id))
  with check (member_id = my_member_id(household_id));                                    -- no delete policy = no delete
create policy au_sel on audit_entries for select using (is_owner(household_id) or is_member(household_id));
create policy inv_sel on invites for select using (is_owner(household_id));
create policy cfg_sel on app_config for select to authenticated using (true);
revoke all on all tables in schema public from anon;
revoke insert, update, delete on audit_entries, invites, app_config from authenticated;

-- ---------- row triggers: version check, derived dates, closed-month lock ----------
create function touch_row() returns trigger language plpgsql as $$
begin
  if new.version is distinct from old.version then raise exception 'stale_version' using errcode = '40001'; end if;
  new.version := old.version + 1; new.updated_at := now(); return new;
end $$;
create function txn_derive() returns trigger language plpgsql security definer set search_path = public as $$
declare tz text; msd int; d date; st text;
begin
  select timezone, month_start_day into tz, msd from households where id = new.household_id;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  if new.occurred_at > now() + interval '1 day' then raise exception 'future_date'; end if;
  d := (new.occurred_at at time zone tz)::date; new.local_date := d;
  if extract(day from d) < msd then d := (date_trunc('month', d) - interval '1 month')::date; end if;
  new.month_key := to_char(d, 'YYYY-MM');
  select status into st from month_plans where household_id = new.household_id and month_key = new.month_key;
  if st = 'closed' and new.adjusts_txn_id is null then raise exception 'month_closed'; end if;   -- RUL-011
  return new;
end $$;
create trigger t_derive before insert or update on transactions for each row execute function txn_derive();
do $$ declare t text; begin
  foreach t in array array['households','members','categories','month_plans','allocations','income_entries','transactions'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_row()', 'touch_'||t, t);
  end loop; end $$;

-- ---------- audit (SEC-002): written by triggers only, immutable ----------
create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; act text;
begin
  r := coalesce(new, old);
  act := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete'
    else case when tg_table_name = 'transactions' and to_jsonb(new)->>'status' = 'void' and to_jsonb(old)->>'status' = 'active' then 'void' else 'update' end end;
  insert into audit_entries (household_id, entity_type, entity_id, action, before, after)
  values (coalesce((to_jsonb(r)->>'household_id')::uuid, r.id), tg_table_name, r.id, act,
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return r;
end $$;
do $$ declare t text; begin
  foreach t in array array['households','members','categories','month_plans','allocations','income_entries','transactions'] loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_row()', 'audit_'||t, t);
  end loop; end $$;
create function audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'audit_is_append_only'; end $$;
create trigger audit_no_change before update or delete on audit_entries for each row execute function audit_immutable();

-- ---------- member rules: cap 10, max 2 owners, last-owner protection (RUL-016/017/019) ----------
create function member_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from members where household_id = new.household_id and status = 'active') >= 10
    then raise exception 'household_full'; end if;
  if new.role = 'owner' and new.status = 'active'
    and (select count(*) from members where household_id = new.household_id and role = 'owner' and status = 'active' and id <> new.id) >= 2
    then raise exception 'max_two_owners'; end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and old.status = 'active' and (new.role <> 'owner' or new.status <> 'active')
    and (select count(*) from members where household_id = old.household_id and role = 'owner' and status = 'active' and id <> old.id) = 0
    then raise exception 'last_owner'; end if;
  return new;
end $$;
create trigger m_rules before insert or update on members for each row execute function member_rules();

-- ---------- RPCs: the only way to create households / join (clients cannot insert members directly) ----------
create function create_household(p_name text, p_display text) returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households (name) values (p_name) returning id into h;
  insert into members (household_id, user_id, display_name, role) values (h, auth.uid(), p_display, 'owner');
  insert into categories (household_id, name, kind) values
    (h,'Fuel','spend'),(h,'Food & Veggies','spend'),(h,'Pocket money','spend'),(h,'Electricity','bill'),
    (h,'Mobile recharge','bill'),(h,'Others','spend'),(h,'Savings','save'),(h,'SIP','invest');
  return h;
end $$;
create function create_invite(p_household uuid, p_role text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(18), 'hex');
begin
  if not is_owner(p_household) then raise exception 'not_owner'; end if;
  insert into invites (household_id, token_hash, role) values (p_household, encode(digest(tok, 'sha256'), 'hex'), p_role);
  return tok;                                    -- show once; only the hash is stored (ENT-010)
end $$;
create function accept_invite(p_token text, p_display text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare i invites;
begin
  select * into i from invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') and used_at is null and expires_at > now();
  if i.id is null then raise exception 'invite_invalid'; end if;
  insert into members (household_id, user_id, display_name, role) values (i.household_id, auth.uid(), p_display, i.role);
  update invites set used_at = now() where id = i.id;
  return i.household_id;
end $$;
grant execute on function create_household(text, text), create_invite(uuid, text), accept_invite(text, text) to authenticated;

-- ---------- realtime (FEA-013) ----------
alter publication supabase_realtime add table transactions, month_plans, allocations, income_entries, members;
