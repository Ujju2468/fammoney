-- FamMoney 005: bill photos, reminder->expense, leave/rejoin, wipe, Wealth Vault. Safe to re-run.
alter table transactions add column if not exists bill_path text;
alter table day_notes add column if not exists category_id uuid references categories, add column if not exists last_logged date;

-- private bucket for bill photos: path = <household_id>/<member_id>/<file>
insert into storage.buckets (id, name, public) values ('bills', 'bills', false) on conflict (id) do nothing;
drop policy if exists bills_ins on storage.objects; drop policy if exists bills_sel on storage.objects;
create policy bills_ins on storage.objects for insert to authenticated with check (bucket_id = 'bills'
  and is_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = my_member_id(((storage.foldername(name))[1])::uuid)::text);
create policy bills_sel on storage.objects for select to authenticated using (bucket_id = 'bills' and is_member(((storage.foldername(name))[1])::uuid));

-- caps also apply when a former member is re-activated
create or replace function member_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status = 'former' and new.status = 'active'))
    and (select count(*) from members where household_id = new.household_id and status = 'active' and id <> new.id) >= 10 then raise exception 'household_full'; end if;
  if new.role = 'owner' and new.status = 'active'
    and (select count(*) from members where household_id = new.household_id and role = 'owner' and status = 'active' and id <> new.id) >= 2 then raise exception 'max_two_owners'; end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and old.status = 'active' and (new.role <> 'owner' or new.status <> 'active')
    and (select count(*) from members where household_id = old.household_id and role = 'owner' and status = 'active' and id <> old.id) = 0 then raise exception 'last_owner'; end if;
  return new;
end $$;

-- rejoin: a former member accepting a new invite is re-activated
create or replace function accept_invite(p_token text, p_display text) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare i invites;
begin
  select * into i from invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') and used_at is null and expires_at > now();
  if i.id is null then raise exception 'invite_invalid'; end if;
  if exists (select 1 from members where household_id = i.household_id and user_id = auth.uid()) then
    update members set status = 'active', role = i.role, display_name = p_display where household_id = i.household_id and user_id = auth.uid();
  else insert into members (household_id, user_id, display_name, role) values (i.household_id, auth.uid(), p_display, i.role); end if;
  update invites set used_at = now() where id = i.id;
  return i.household_id;
end $$;

create or replace function leave_household(p_household uuid) returns void language plpgsql security definer set search_path = public as $$
begin update members set status = 'former' where household_id = p_household and user_id = auth.uid() and status = 'active'; end $$;

-- audit stays append-only, except inside the owner-confirmed wipe below
create or replace function audit_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('fammoney.wipe', true) = 'on' then return old; end if;
  raise exception 'audit_is_append_only';
end $$;
create or replace function wipe_household(p_household uuid, p_confirm text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_household) then raise exception 'not_owner'; end if;
  if p_confirm is distinct from (select name from households where id = p_household) then raise exception 'confirm_name_mismatch'; end if;
  perform set_config('fammoney.wipe', 'on', true);
  delete from households where id = p_household;
  delete from audit_entries where household_id = p_household;
end $$;

-- Wealth Vault: owners see all, adults see only their own, dependents none; no deletes (close instead)
create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references members,
  category text not null check (category in ('savings','fd','sip','equity','gold','ppf','other')),
  name text not null check (char_length(name) between 1 and 80), start_date date not null,
  invested_paise bigint not null check (invested_paise >= 0), current_paise bigint not null check (current_paise >= 0),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1);
alter table holdings enable row level security;
drop policy if exists v_sel on holdings; drop policy if exists v_ins on holdings; drop policy if exists v_upd on holdings;
create policy v_sel on holdings for select using (is_adult(household_id) and (member_id = my_member_id(household_id) or is_owner(household_id)));
create policy v_ins on holdings for insert with check (is_adult(household_id) and member_id = my_member_id(household_id));
create policy v_upd on holdings for update using (is_adult(household_id) and member_id = my_member_id(household_id)) with check (member_id = my_member_id(household_id));
revoke all on holdings from anon;
drop trigger if exists touch_holdings on holdings; drop trigger if exists audit_holdings on holdings;
create trigger touch_holdings before update on holdings for each row execute function touch_row();
create trigger audit_holdings after insert or update or delete on holdings for each row execute function audit_row();
do $$ begin alter publication supabase_realtime add table holdings; exception when duplicate_object then null; end $$;
grant execute on function leave_household(uuid), wipe_household(uuid, text) to authenticated;
