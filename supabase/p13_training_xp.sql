-- p13: training is the main way to level. Each training click (10 energy, stats or jutsu) gives XP worth a fixed share of the
-- current level: 1/30 Academy, 1/250 Genin, 1/600 Chunin, 1/800 Jonin. Missions: 20 full-reward wins a day, then 10%.
create or replace function public.training_xp(lv int) returns int language sql immutable as $$
  select ceil(public.xp_need(lv)::numeric / (case when lv < 5 then 30 when lv < 15 then 250 when lv < 30 then 600 else 800 end))::int $$;

create or replace function public.grant_xp(p_user uuid, p_xp int) returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_cap int; v_lv0 int;
begin
  select * into c from public.characters where user_id = p_user for update;
  if not found or p_xp <= 0 then return jsonb_build_object('xp', 0, 'leveled', 0); end if;
  v_lv0 := c.level; v_cap := public.level_cap(c.rank);
  c.xp := c.xp + p_xp;
  while c.level < v_cap and c.xp >= public.xp_need(c.level) loop c.xp := c.xp - public.xp_need(c.level); c.level := c.level + 1; end loop;
  if c.level >= v_cap then c.xp := least(c.xp, public.xp_need(c.level)); end if;
  update public.characters set xp = c.xp, level = c.level,
    energy = case when c.level > v_lv0 then 100 else energy end, energy_at = case when c.level > v_lv0 then now() else energy_at end
    where user_id = p_user;
  return jsonb_build_object('xp', p_xp, 'leveled', c.level - v_lv0, 'level', c.level, 'capped', c.level >= v_cap);
end $$;
revoke all on function public.grant_xp(uuid, int) from public, anon, authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public.train_stat(text,integer)'::regprocedure);
  d := replace(d, 'gained int := 0; v_step int;', 'gained int := 0; v_step int; v_x jsonb;');
  d := replace(d, $x$  return public.get_me() || jsonb_build_object('gained', gained);$x$,
$x$  v_x := public.grant_xp(c.user_id, ((public.energy_now(c) - e) / 10) * public.training_xp(c.level));
  return public.get_me() || jsonb_build_object('gained', gained, 'xp_gain', v_x);$x$);
  if position('grant_xp' in d) = 0 then raise exception 'train_stat patch failed'; end if;
  execute d;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.train_jutsu(text,integer)'::regprocedure);
  d := replace(d, 'g jsonb; n int;', 'g jsonb; n int; v_x jsonb;');
  d := replace(d, $x$  return public.get_me() || jsonb_build_object('trained', g);$x$,
$x$  v_x := public.grant_xp(c.user_id, n * public.training_xp(c.level));
  return public.get_me() || jsonb_build_object('trained', g, 'xp_gain', v_x);$x$);
  if position('grant_xp' in d) = 0 then raise exception 'train_jutsu patch failed'; end if;
  execute d;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.battle_finish(uuid,boolean,jsonb)'::regprocedure);
  d := replace(d, 'the first 150 mission wins each day pay in full, later ones pay 25%', 'the first 20 mission wins each day pay in full, later ones pay 10%');
  d := replace(d, 'if c.mission_wins > 150 then xp_gain := round(xp_gain * 0.25)::int; ryo_gain := round(ryo_gain * 0.25)::int; end if;',
                  'if c.mission_wins > 20 then xp_gain := round(xp_gain * 0.1)::int; ryo_gain := round(ryo_gain * 0.1)::int; end if;');
  d := replace(d, $x$'daily_limit', 150, 'reduced', c.mission_wins > 150)$x$, $x$'daily_limit', 20, 'reduced', c.mission_wins > 20)$x$);
  if position('mission_wins > 20 then' in d) = 0 or position('daily_limit'', 20' in d) = 0 then raise exception 'battle_finish patch failed'; end if;
  execute d;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.get_me()'::regprocedure);
  d := replace(d, $x$'mission_limit', 150,$x$, $x$'mission_limit', 20, 'training_xp', public.training_xp(c.level),$x$);
  if position('training_xp' in d) = 0 then raise exception 'get_me patch failed'; end if;
  execute d;
end $$;
