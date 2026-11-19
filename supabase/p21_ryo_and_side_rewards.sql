-- 19 Nov 2026 (CEO): mission ryo rises by the same factor as mission XP did (Academy unchanged);
-- quest fights and raid bosses pay 50% more XP and ryo so they keep up with missions.

create or replace function public.mission_ryo_mult(lv integer) returns numeric
 language sql immutable set search_path to 'public', 'pg_catalog'
as $f$ select case when lv < 5 then 1 when lv < 15 then 3.45 when lv < 30 then 3.4 else 3.35 end::numeric $f$;

do $$
declare d text := pg_get_functiondef('public.battle_finish'::regproc); o text;
begin
  o := d;
  d := replace(d, 'else public.reward_mult(c.level) end)::int; ryo_gain := round(m.ryo * (1 + public.village_bonus(c.village, ''missions'')))::int;',
                  'else public.reward_mult(c.level) * 1.5 end)::int; ryo_gain := round(m.ryo * case when m.kind = ''mission'' then public.mission_ryo_mult(c.level) else 1.5 end * (1 + public.village_bonus(c.village, ''missions'')))::int;');
  if d = o or d not like '%mission_ryo_mult%' then raise exception 'battle_finish did not match: nothing changed'; end if;
  execute d;

  d := pg_get_functiondef('public.raid_finish'::regproc); o := d;
  d := replace(d, 'v_xp := round(v_xp * public.reward_mult(c.level))::int;', 'v_xp := round(v_xp * public.reward_mult(c.level) * 1.5)::int; v_ryo := round(v_ryo * 1.5)::int;');
  if d = o then raise exception 'raid_finish did not match: nothing changed'; end if;
  execute d;

  d := pg_get_functiondef('public.get_me'::regproc); o := d;
  d := replace(d, '''mission_xp_mult'', public.mission_xp_mult(c.level),', '''mission_xp_mult'', public.mission_xp_mult(c.level), ''mission_ryo_mult'', public.mission_ryo_mult(c.level),');
  if d = o then raise exception 'get_me did not match: nothing changed'; end if;
  execute d;
end $$;
