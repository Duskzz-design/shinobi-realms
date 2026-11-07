-- Piece 7b: village upgrades take effect in training, jutsu, missions and energy.

create or replace function public.train_stat(p_stat text, p_times integer default 1) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare c public.characters; e int; cur int; cap int; prog int; n int; gained int := 0; v_step int;
begin
  if p_stat not in ('strength','agility','intelligence','willpower') then raise exception 'Unknown stat.'; end if;
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'No ninja.'; end if;
  execute format('select ($1).%I', p_stat) into cur using c;
  cap := public.stat_cap(c.rank);
  if cur >= cap then raise exception 'That stat is at the cap for your rank. Rank up to train further.'; end if;
  e := public.energy_now(c);
  n := least(greatest(p_times, 1), e / 10);
  if n < 1 then raise exception 'Not enough energy. It refills over time.'; end if;
  v_step := round(10 * (1 + public.village_bonus(c.village, 'training')))::int;
  prog := coalesce((c.train_prog->>p_stat)::int, 0);
  for i in 1..n loop
    exit when cur >= cap;
    prog := prog + v_step; e := e - 10;
    while cur < cap and prog >= public.stat_point_cost(cur) loop prog := prog - public.stat_point_cost(cur); cur := cur + 1; gained := gained + 1; end loop;
  end loop;
  if cur >= cap then prog := 0; end if;
  execute format('update public.characters set %I = $1, energy = $2, energy_at = now(), train_prog = train_prog || jsonb_build_object($3::text, $4) where user_id = $5', p_stat)
    using cur, e, p_stat, prog, c.user_id;
  return public.get_me() || jsonb_build_object('gained', gained);
end $function$;

create or replace function public.jutsu_gain(p_user uuid, p_move text, p_xp integer) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare j public.character_jutsu; up int := 0; t int; v_xp int;
begin
  select tier into t from public.moves where id = p_move;
  v_xp := round(p_xp * (1 + public.village_bonus((select village from public.characters where user_id = p_user), 'library')))::int;
  insert into public.character_jutsu (user_id, move_id) values (p_user, p_move) on conflict do nothing;
  select * into j from public.character_jutsu where user_id = p_user and move_id = p_move for update;
  if j.level >= 10 then return jsonb_build_object('level', 10, 'xp', 0, 'up', 0); end if;
  j.xp := j.xp + v_xp;
  while j.level < 10 and j.xp >= public.jutsu_next(j.level, t) loop j.xp := j.xp - public.jutsu_next(j.level, t); j.level := j.level + 1; up := up + 1; end loop;
  if j.level >= 10 then j.xp := 0; end if;
  update public.character_jutsu set level = j.level, xp = j.xp where user_id = p_user and move_id = p_move;
  return jsonb_build_object('level', j.level, 'xp', j.xp, 'next', public.jutsu_next(j.level, t), 'up', up);
end $function$;

create or replace function public.get_me() returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare c public.characters; mult numeric; amult numeric; pl int; vu jsonb;
begin
  select * into c from public.characters where user_id = auth.uid();
  if not found then return null; end if;
  mult := public.energy_mult(c.user_id); amult := public.arena_mult(c.user_id); pl := public.arena_place(c.user_id, public.london_day(now()) - 1);
  select upgrades into vu from public.villages where id = c.village;
  return to_jsonb(c) || jsonb_build_object(
    'energy', public.energy_now(c), 'energy_max', 100, 'energy_regen_sec', round(9 / mult, 2), 'train_energy', 10,
    'arena_bonus', case when amult > 1 then jsonb_build_object('place', pl, 'mult', amult) else null end,
    'village_upgrades', coalesce(vu, '{}'::jsonb),
    'hp_max', public.max_hp(c), 'stamina_max', public.max_stamina(c), 'chakra_max', public.max_chakra(c),
    'stat_cap', public.stat_cap(c.rank), 'level_cap', public.level_cap(c.rank), 'rank_index', public.rank_index(c.rank),
    'point_cost', jsonb_build_object('strength', public.stat_point_cost(c.strength), 'agility', public.stat_point_cost(c.agility),
                                     'intelligence', public.stat_point_cost(c.intelligence), 'willpower', public.stat_point_cost(c.willpower)),
    'jutsu', coalesce((select jsonb_object_agg(cj.move_id, jsonb_build_object('level', cj.level, 'xp', cj.xp, 'next', public.jutsu_next(cj.level, m.tier)))
                       from public.character_jutsu cj join public.moves m on m.id = cj.move_id where cj.user_id = c.user_id), '{}'::jsonb));
end $function$;

-- Mission Hall: more ryo from missions and quest fights (one-line patch to battle_finish)
do $$ declare d text; begin
  d := pg_get_functiondef('public.battle_finish(uuid,boolean,jsonb)'::regprocedure);
  d := replace(d, 'xp_gain := m.xp; ryo_gain := m.ryo;', 'xp_gain := m.xp; ryo_gain := round(m.ryo * (1 + public.village_bonus(c.village, ''missions'')))::int;');
  if position('village_bonus' in d) = 0 then raise exception 'battle_finish patch failed'; end if;
  execute d;
end $$;
