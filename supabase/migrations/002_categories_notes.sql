-- FamMoney 002: category groups, day notes/reminders. Safe to run more than once (idempotent).
alter table categories add column if not exists parent_id uuid references categories on delete set null;
alter table categories add column if not exists sort int not null default 0;

create or replace function seed_categories(h uuid) returns void language plpgsql security definer set search_path = public as $$
declare spec jsonb := '[
  {"n":"Food","k":"spend"},
  {"n":"Daily","k":"spend","c":["Veggies","Milk","Buttermilk","Curd","Fruits"]},
  {"n":"Bills","k":"bill","c":["Mobile recharge","TV subscription","Electricity bill"]},
  {"n":"Fuel & Travel","k":"spend","c":["Fuel","Uber","Rapido"]},
  {"n":"Saving & Investment","k":"save","c":["Savings","Investments (SIP)"]},
  {"n":"Others","k":"spend","c":["Pocket money","Miscellaneous"]}]';
  g jsonb; c text; pid uuid; i int := 0;
begin
  for g in select value from jsonb_array_elements(spec) loop
    i := i + 1;
    insert into categories (household_id, name, kind, sort) values (h, g->>'n', g->>'k', i * 100) returning id into pid;
    for c in select jsonb_array_elements_text(g->'c') loop
      i := i + 1;
      insert into categories (household_id, name, kind, parent_id, sort)
      values (h, c, case when c like 'Investments%' then 'invest' else g->>'k' end, pid, i * 100);
    end loop;
  end loop;
end $$;

create or replace function create_household(p_name text, p_display text) returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households (name) values (p_name) returning id into h;
  insert into members (household_id, user_id, display_name, role) values (h, auth.uid(), p_display, 'owner');
  perform seed_categories(h);
  return h;
end $$;

do $$ begin   -- only once: hide old test categories (kept for history), then add the new list
  if not exists (select 1 from categories where parent_id is not null) then
    update categories set archived = true where archived = false;
    perform seed_categories(id) from households;
  end if;
end $$;

create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references members,
  note_date date not null, title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'reminder' check (kind in ('note','reminder','bill','autopay')),
  amount_paise bigint check (amount_paise > 0), repeat text not null default 'none' check (repeat in ('none','monthly','yearly')),
  done boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1);
alter table day_notes enable row level security;
drop policy if exists n_sel on day_notes; drop policy if exists n_ins on day_notes; drop policy if exists n_upd on day_notes; drop policy if exists n_del on day_notes;
create policy n_sel on day_notes for select using (is_member(household_id));
create policy n_ins on day_notes for insert with check (member_id = my_member_id(household_id));
create policy n_upd on day_notes for update using (member_id = my_member_id(household_id)) with check (member_id = my_member_id(household_id));
create policy n_del on day_notes for delete using (member_id = my_member_id(household_id));
revoke all on day_notes from anon;
drop trigger if exists touch_day_notes on day_notes; drop trigger if exists audit_day_notes on day_notes;
create trigger touch_day_notes before update on day_notes for each row execute function touch_row();
create trigger audit_day_notes after insert or update or delete on day_notes for each row execute function audit_row();
do $$ begin alter publication supabase_realtime add table day_notes; exception when duplicate_object then null; end $$;
