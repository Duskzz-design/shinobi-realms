-- p12: pacing for 8-hours-a-day players. Steeper XP curve, daily full-reward mission limit, bigger quest and boss XP.
-- XP to go from level L to L+1. Targets (8h/day): Chunin ~day 7, Jonin ~day 28, level 60 ~day 90.
create or replace function public.xp_need(lv int) returns int language sql immutable as $$
  select 100 * lv * (case when lv < 5 then 3 when lv < 15 then 22 when lv < 30 then 85 else 190 end) $$;

alter table public.characters add column if not exists mission_day date, add column if not exists mission_wins int not null default 0;

-- quests pay 10x, bosses 8x (ryo unchanged)
update public.missions set xp = xp * 10 where kind = 'quest';
update public.quest_lines set boss_xp = boss_xp * 8 where boss_xp is not null;

do $$ declare d text; begin
  d := pg_get_functiondef('public.battle_finish(uuid,boolean,jsonb)'::regprocedure);
  d := replace(d, 'c.level * 100', 'public.xp_need(c.level)');
  d := replace(d, $x$    xp_gain := m.xp; ryo_gain := round(m.ryo * (1 + public.village_bonus(c.village, 'missions')))::int;$x$,
$x$    xp_gain := m.xp; ryo_gain := round(m.ryo * (1 + public.village_bonus(c.village, 'missions')))::int;
    -- daily limit: the first 150 mission wins each day pay in full, later ones pay 25%
    if m.kind = 'mission' then
      if c.mission_day is distinct from public.london_day(now()) then c.mission_wins := 0; end if;
      c.mission_wins := c.mission_wins + 1;
      update public.characters set mission_day = public.london_day(now()), mission_wins = c.mission_wins where user_id = c.user_id;
      if c.mission_wins > 150 then xp_gain := round(xp_gain * 0.25)::int; ryo_gain := round(ryo_gain * 0.25)::int; end if;
    end if;$x$);
  d := replace(d, $x$    result := jsonb_build_object('xp', xp_gain, 'ryo', ryo_gain, 'level', c.level, 'leveled', c.level - lv_before, 'capped', c.level >= cap);$x$,
$x$    result := jsonb_build_object('xp', xp_gain, 'ryo', ryo_gain, 'level', c.level, 'leveled', c.level - lv_before, 'capped', c.level >= cap)
      || case when m.kind = 'mission' then jsonb_build_object('daily', c.mission_wins, 'daily_limit', 150, 'reduced', c.mission_wins > 150) else '{}'::jsonb end;$x$);
  if position('mission_wins > 150' in d) = 0 or position('daily_limit' in d) = 0 or position('level * 100' in d) > 0 then raise exception 'battle_finish patch failed'; end if;
  execute d;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.raid_finish(uuid,boolean)'::regprocedure);
  d := replace(d, 'c.level * 100', 'public.xp_need(c.level)');
  d := replace(d, 'v_xp := 900; v_ryo := 1200;', 'v_xp := 7200; v_ryo := 1200;');
  d := replace(d, 'v_xp := 500; v_ryo := 500;', 'v_xp := 4000; v_ryo := 500;');
  d := replace(d, 'else v_xp := 1200; v_ryo := 1000;', 'else v_xp := 9600; v_ryo := 1000;');
  if position('7200' in d) = 0 or position('4000' in d) = 0 or position('9600' in d) = 0 or position('level * 100' in d) > 0 then raise exception 'raid_finish patch failed'; end if;
  execute d;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.get_me()'::regprocedure);
  d := replace(d, $x$'energy', public.energy_now(c), 'energy_max', 100,$x$,
    $x$'xp_need', public.xp_need(c.level), 'missions_today', case when c.mission_day = public.london_day(now()) then c.mission_wins else 0 end, 'mission_limit', 150, 'energy', public.energy_now(c), 'energy_max', 100,$x$);
  if position('xp_need' in d) = 0 then raise exception 'get_me patch failed'; end if;
  execute d;
end $$;
