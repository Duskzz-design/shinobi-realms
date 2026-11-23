-- v0.15.0 (CEO, 23 Nov 2026): health lasts between fights.
-- Every fight (missions, quests, lessons, exams, duels, Arena, war fights, Kage challenges and boss raids) starts with
-- the health you have now and saves what is left at the end. Health refills on its own, fully in 15 minutes.
-- The Ramen Shop sells bowls that heal part of your health for ryo. Levelling up, a rank promotion or a paid
-- Hospital heal refill it. Losing still also means the 15-minute injury.
-- Health is stored as a share of your maximum (hp_frac, 0 to 1), so training, levels and gear keep it right.

alter table public.characters add column if not exists hp_frac real not null default 1;
alter table public.characters add column if not exists hp_at timestamptz not null default now();

-- health share right now, after refilling for the time since hp_at (full in 900 seconds)
create or replace function public.hp_frac_now(c public.characters) returns numeric
 language sql stable set search_path to 'public', 'pg_catalog'
as $f$ select least(1, greatest(0, coalesce(c.hp_frac, 1)) + extract(epoch from (now() - coalesce(c.hp_at, now()))) / 900.0)::numeric $f$;

-- starting health for a fight (base pool; gear bonus is added by the battle server on top, keeping the share)
create or replace function public.hp_start(c public.characters) returns int
 language sql stable set search_path to 'public', 'pg_catalog'
as $f$ select greatest(1, round(public.max_hp(c) * public.hp_frac_now(c)))::int $f$;

-- the battle server saves health at the end of a fight (not callable by players)
create or replace function public.set_hp(p_user uuid, p_frac numeric) returns void
 language sql security definer set search_path to ''
as $f$ update public.characters set hp_frac = greatest(0, least(1, coalesce(p_frac, 1))), hp_at = now() where user_id = p_user $f$;
revoke all on function public.set_hp(uuid, numeric) from public, anon, authenticated;
grant execute on function public.set_hp(uuid, numeric) to service_role;

-- level-ups and rank promotions refill health (like energy)
create or replace function public.trg_refill_hp() returns trigger
 language plpgsql set search_path to ''
as $f$ begin
  if new.level > old.level or new.rank is distinct from old.rank then new.hp_frac := 1; new.hp_at := now(); end if;
  return new;
end $f$;
drop trigger if exists refill_hp on public.characters;
create trigger refill_hp before update of level, rank on public.characters for each row execute function public.trg_refill_hp();

-- Ramen Shop: three bowls; prices grow with level (the Deluxe bowl costs the same as a fresh Hospital heal)
create or replace function public.ramen_menu(c public.characters) returns jsonb
 language sql stable set search_path to 'public', 'pg_catalog'
as $f$ select jsonb_build_array(
  jsonb_build_object('id', 'small', 'name', 'Small Ramen', 'heal', 25, 'price', greatest(5, round((20 + 8 * c.level) * 0.35))::int),
  jsonb_build_object('id', 'large', 'name', 'Large Ramen', 'heal', 50, 'price', greatest(8, round((20 + 8 * c.level) * 0.6))::int),
  jsonb_build_object('id', 'deluxe', 'name', 'Deluxe Ramen', 'heal', 100, 'price', greatest(12, (20 + 8 * c.level))::int)) $f$;

create or replace function public.buy_ramen(p_bowl text) returns jsonb
 language plpgsql security definer set search_path to ''
as $f$
declare c public.characters; b jsonb; f numeric;
begin
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'Create a ninja first.'; end if;
  select x into b from jsonb_array_elements(public.ramen_menu(c)) x where x->>'id' = p_bowl;
  if b is null then raise exception 'That is not on the menu.'; end if;
  f := public.hp_frac_now(c);
  if f >= 0.999 then raise exception 'You are already at full health.'; end if;
  if c.ryo < (b->>'price')::int then raise exception 'Not enough ryo (% needed). Health also refills on its own.', (b->>'price')::int; end if;
  update public.characters set ryo = ryo - (b->>'price')::int, hp_frac = least(1, f + (b->>'heal')::numeric / 100), hp_at = now() where user_id = c.user_id;
  return public.get_me() || jsonb_build_object('ate', b);
end $f$;
revoke all on function public.buy_ramen(text) from public, anon;
grant execute on function public.buy_ramen(text) to authenticated;

do $$
declare fn text; d text; o text;
begin
  -- every solo fight starts from current health
  foreach fn in array array['start_mission', 'start_lesson', 'start_quest', 'start_exam'] loop
    d := pg_get_functiondef(('public.' || fn)::regproc); o := d;
    d := replace(d, '''php'', public.max_hp(c),', '''php'', public.hp_start(c),');
    if d = o then raise exception '% did not match: nothing changed', fn; end if;
    execute d;
  end loop;
  -- a paid Hospital heal also restores full health
  d := pg_get_functiondef('public.hospital_heal'::regproc); o := d;
  d := replace(d, 'injured_until = null where', 'injured_until = null, hp_frac = 1, hp_at = now() where');
  if d = o then raise exception 'hospital_heal did not match: nothing changed'; end if;
  execute d;
  -- the game shows current health and the ramen menu
  d := pg_get_functiondef('public.get_me'::regproc); o := d;
  d := replace(d, '''mission_xp_mult'', public.mission_xp_mult(c.level),', '''mission_xp_mult'', public.mission_xp_mult(c.level), ''hp_frac'', round(public.hp_frac_now(c), 4), ''ramen'', public.ramen_menu(c),');
  if d = o then raise exception 'get_me did not match: nothing changed'; end if;
  execute d;
end $$;
