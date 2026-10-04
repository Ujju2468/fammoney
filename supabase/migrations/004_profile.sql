-- FamMoney 004: let each person change ONLY their own name and colour (cannot touch role/status). Safe to re-run.
create or replace function update_profile(p_household uuid, p_name text, p_colour text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'name_length'; end if;
  if p_colour !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_colour'; end if;
  update members set display_name = trim(p_name), colour = p_colour
   where household_id = p_household and user_id = auth.uid() and status = 'active';
end $$;
grant execute on function update_profile(uuid, text, text) to authenticated;
