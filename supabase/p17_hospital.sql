-- p17: missions after the daily 20 pay 10% ryo again; boss gear duplicates allowed (Auction House); Hospital injuries.
do $$ declare d text; begin
  d := pg_get_functiondef('public.battle_finish(uuid,boolean,jsonb)'::regprocedure);
  d := replace(d, 'ryo_gain := 0;', 'ryo_gain := round(ryo_gain * 0.1)::int;');
  d := replace(d, 'later ones pay 10% XP and no ryo', 'later ones pay 10%');
  if position('ryo_gain := round(ryo_gain * 0.1)::int;' in d) = 0 then raise exception 'battle_finish patch failed'; end if;
  execute d;
end $$;

-- ---------- Auction House: players may own several of the same boss item ----------
create or replace function public.gear_remove_one(arr jsonb, p_item text) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements_text(arr) with ordinality t(x, i)
  where i <> (select min(i2) from jsonb_array_elements_text(arr) with ordinality t2(x2, i2) where x2 = p_item) $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.market_list(text,text,integer,integer)'::regprocedure);
  d := replace(d, $x$    if exists (select 1 from jsonb_each_text(coalesce(c.gear, '{}'::jsonb)) g where g.value = p_item) then raise exception 'Take it off first (Equipment).'; end if;$x$,
$x$    if exists (select 1 from jsonb_each_text(coalesce(c.gear, '{}'::jsonb)) g where g.value = p_item)
       and (select count(*) from jsonb_array_elements_text(c.owned_gear) x where x = p_item) < 2 then raise exception 'Take it off first (Equipment).'; end if;$x$);
  d := replace(d, $x$update public.characters set owned_gear = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(owned_gear) x where x <> p_item) where user_id = c.user_id;$x$,
                  $x$update public.characters set owned_gear = public.gear_remove_one(owned_gear, p_item) where user_id = c.user_id;$x$);
  if position('gear_remove_one' in d) = 0 or position('< 2 then' in d) = 0 then raise exception 'market_list patch failed'; end if;
  execute d;
end $$;
do $$ declare d text; begin
  d := pg_get_functiondef('public.market_buy(uuid)'::regprocedure);
  d := replace(d, $x$    if c.owned_gear ? l.item_id then raise exception 'You already own one of those.'; end if;
$x$, '');
  if position('already own' in d) > 0 then raise exception 'market_buy patch failed'; end if;
  execute d;
end $$;
do $$ declare f text; d text; begin
  foreach f in array array['public.market_cancel(uuid)', 'public.market_expire()'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'owned_gear = case when owned_gear ? l.item_id then owned_gear else owned_gear || to_jsonb(l.item_id) end', 'owned_gear = owned_gear || to_jsonb(l.item_id)');
    if position('case when owned_gear ?' in d) > 0 then raise exception '% patch failed', f; end if;
    execute d;
  end loop;
end $$;

-- ---------- Hospital ----------
alter table public.characters add column if not exists injured_until timestamptz;
create or replace function public.heal_cost(c public.characters) returns int language sql stable as $$
  select case when c.injured_until is null or c.injured_until <= now() then 0
    else greatest(5, ceil((20 + c.level * 8) * extract(epoch from (c.injured_until - now())) / 900))::int end $$;
create or replace function public.injure(p_user uuid) returns void language sql security definer set search_path to '' as $$
  update public.characters set injured_until = now() + interval '15 minutes' where user_id = p_user $$;
revoke all on function public.injure(uuid) from public, anon, authenticated;

create or replace function public.injury_msg(p_user uuid) returns text language sql stable security definer set search_path to '' as $$
  select case when c.injured_until > now() then c.name || ' is injured (' || ceil(extract(epoch from (c.injured_until - now())) / 60)::int || ' min left). Rest, or heal at the Hospital first.' end
  from public.characters c where c.user_id = p_user $$;

-- losing (or running from) a mission or quest injures you; academy lessons and rank exams don't
create or replace function public.trg_battle_injury() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if old.status = 'active' and (new.status = 'lost' or (new.status = 'fled' and new.state->'engine'->>'status' = 'over'))
     and exists (select 1 from public.missions m where m.id = new.mission_id and m.kind in ('mission', 'quest')) then
    perform public.injure(new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists battle_injury on public.battles;
create trigger battle_injury after update of status on public.battles for each row execute function public.trg_battle_injury();

-- injured ninja can't start missions, quests or exams
create or replace function public.trg_battle_injured_check() returns trigger language plpgsql security definer set search_path to '' as $$
declare msg text;
begin
  if exists (select 1 from public.missions m where m.id = new.mission_id and m.kind in ('mission', 'quest', 'exam')) then
    select replace(public.injury_msg(new.user_id), (select name from public.characters where user_id = new.user_id) || ' is', 'You are') into msg;
    if msg is not null then raise exception '%', msg; end if;
  end if;
  return new;
end $$;
drop trigger if exists battle_injured_check on public.battles;
create trigger battle_injured_check before insert on public.battles for each row execute function public.trg_battle_injured_check();

-- duels: injured ninja can't challenge, be challenged, accept or be ambushed; the loser of a duel is injured
create or replace function public.trg_duel_injury() returns trigger language plpgsql security definer set search_path to '' as $$
declare msg text;
begin
  if tg_op = 'INSERT' or (old.status = 'pending' and new.status = 'prep') then
    msg := coalesce(public.injury_msg(new.a), public.injury_msg(new.b));
    if msg is not null then raise exception '%', msg; end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'over' and new.winner is not null then
    perform public.injure(case when new.winner = new.a then new.b else new.a end);
  end if;
  return new;
end $$;
drop trigger if exists duel_injury on public.duels;
create trigger duel_injury before insert or update on public.duels for each row execute function public.trg_duel_injury();

-- boss fights: injured ninja can't create, join or set off; a lost boss fight injures the whole team
create or replace function public.trg_raid_injury() returns trigger language plpgsql security definer set search_path to '' as $$
declare m jsonb; msg text;
begin
  if tg_op = 'INSERT' or (old.status = 'lobby' and new.status = 'prep') or (new.status = 'lobby' and jsonb_array_length(new.members) > jsonb_array_length(old.members)) then
    for m in select * from jsonb_array_elements(new.members) loop
      msg := public.injury_msg((m->>'id')::uuid);
      if msg is not null then raise exception '%', msg; end if;
    end loop;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and new.status = 'over' and new.winner = 'B' then
    for m in select * from jsonb_array_elements(new.members) loop perform public.injure((m->>'id')::uuid); end loop;
  end if;
  return new;
end $$;
drop trigger if exists raid_injury on public.raids;
create trigger raid_injury before insert or update on public.raids for each row execute function public.trg_raid_injury();

create or replace function public.hospital_heal() returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_cost int;
begin
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'Create a ninja first.'; end if;
  v_cost := public.heal_cost(c);
  if v_cost = 0 then raise exception 'You are not injured.'; end if;
  if c.ryo < v_cost then raise exception 'Not enough ryo (% needed). You can also rest until you heal.', v_cost; end if;
  update public.characters set ryo = ryo - v_cost, injured_until = null where user_id = c.user_id;
  return public.get_me() || jsonb_build_object('healed', v_cost);
end $$;
revoke all on function public.hospital_heal() from public, anon;
grant execute on function public.hospital_heal() to authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public.get_me()'::regprocedure);
  d := replace(d, $x$'mission_limit', 20,$x$, $x$'mission_limit', 20, 'heal_cost', public.heal_cost(c), 'injured_secs', greatest(0, ceil(extract(epoch from (coalesce(c.injured_until, now()) - now()))))::int,$x$);
  if position('heal_cost' in d) = 0 then raise exception 'get_me patch failed'; end if;
  execute d;
end $$;
