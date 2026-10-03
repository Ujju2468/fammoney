-- FamMoney 003: tiny public function so the keep-alive job can touch the database without reading any data.
create or replace function ping() returns int language sql stable as $$ select 1 $$;
grant execute on function ping() to anon, authenticated;
