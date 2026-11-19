-- 19 Nov 2026 (CEO): Genin, Chunin and Jonin each take about half as long.
-- Training XP x2 (from Genin up), mission XP about x3.4, and the daily mission limit is 10 full-reward wins, then 20%.
-- Academy (levels 1-4) is unchanged. Raids, quests and lessons keep their old XP.

create or replace function public.training_xp(lv integer) returns integer
 language sql immutable set search_path to 'public', 'pg_catalog'
as $f$ select ceil(public.xp_need(lv)::numeric / (case when lv < 5 then 80 when lv < 15 then 225 when lv < 30 then 450 else 650 end))::int $f$;

create or replace function public.mission_xp_mult(lv integer) returns numeric
 language sql immutable set search_path to 'public', 'pg_catalog'
as $f$ select case when lv < 5 then 3 when lv < 15 then 13.66 when lv < 30 then 15.3 else 19.77 end::numeric $f$;

do $$
declare d text := pg_get_functiondef('public.battle_finish'::regproc); o text;
begin
  o := d;
  d := replace(d, 'xp_gain := round(m.xp * public.reward_mult(c.level))::int;',
                  'xp_gain := round(m.xp * case when m.kind = ''mission'' then public.mission_xp_mult(c.level) else public.reward_mult(c.level) end)::int;');
  d := replace(d, '-- daily limit: the first 20 mission wins each day pay in full, later ones pay 10%',
                  '-- daily limit: the first 10 mission wins each day pay in full, later ones pay 20%');
  d := replace(d, 'if c.mission_wins > 20 then xp_gain := round(xp_gain * 0.1)::int; ryo_gain := round(ryo_gain * 0.1)::int; end if;',
                  'if c.mission_wins > 10 then xp_gain := round(xp_gain * 0.2)::int; ryo_gain := round(ryo_gain * 0.2)::int; end if;');
  d := replace(d, '''daily_limit'', 20, ''reduced'', c.mission_wins > 20', '''daily_limit'', 10, ''reduced'', c.mission_wins > 10');
  if d = o or d like '%mission_wins > 20%' or d not like '%mission_xp_mult%' then raise exception 'battle_finish did not match: nothing changed'; end if;
  execute d;
end $$;

-- the mission board reads these from get_me
do $$
declare d text := pg_get_functiondef('public.get_me'::regproc); o text;
begin
  o := d;
  d := replace(d, '''mission_limit'', 20,', '''mission_limit'', 10,');
  d := replace(d, '''reward_mult'', public.reward_mult(c.level),', '''reward_mult'', public.reward_mult(c.level), ''mission_xp_mult'', public.mission_xp_mult(c.level),');
  if d = o or d like '%''mission_limit'', 20,%' or d not like '%mission_xp_mult%' then raise exception 'get_me did not match: nothing changed'; end if;
  execute d;
end $$;
