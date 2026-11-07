-- Piece 7: village points, Kage seat, upgrades, territories and wars.

-- ---------- tables ----------
create table public.villages (
  id text primary key, score bigint not null default 0, treasury bigint not null default 0,
  kage uuid references public.characters(user_id) on delete set null, kage_since timestamptz, last_challenge timestamptz,
  upgrades jsonb not null default '{}'::jsonb, last_income_day date);
insert into public.villages (id) values ('pine'), ('dune'), ('tide');
alter table public.villages enable row level security;
create policy villages_read on public.villages for select using (true);

create table public.village_log (id bigserial primary key, village text not null, user_id uuid, points int not null, reason text not null, at timestamptz not null default now());
create index village_log_v_at on public.village_log (village, at);
alter table public.village_log enable row level security;

alter table public.characters add column if not exists seen_at timestamptz;
alter table public.duels add column if not exists kind text not null default 'duel', add column if not exists war uuid;

create table public.territories (id text primary key, name text not null, holder text references public.villages(id), cooldown_until timestamptz);
insert into public.territories (id, name) values ('bandit_road', 'Bandit Road'), ('watchtower', 'Old Watchtower'), ('misty_marsh', 'Misty Marsh'),
  ('whispering_woods', 'Whispering Woods'), ('ashen_peak', 'Ashen Peak');
alter table public.territories enable row level security;
create policy territories_read on public.territories for select using (true);

create table public.wars (
  id uuid primary key default gen_random_uuid(), territory text not null references public.territories(id), attacker text not null references public.villages(id),
  defender text references public.villages(id), declared_by uuid, started_at timestamptz not null default now(), ends_at timestamptz not null default now() + interval '24 hours',
  att_score int not null default 0, def_score int not null default 0, last_hold timestamptz, status text not null default 'active', winner text);
alter table public.wars enable row level security;
create policy wars_read on public.wars for select using (true);
alter publication supabase_realtime add table public.wars;

create table public.war_presence (war uuid not null references public.wars(id) on delete cascade, user_id uuid not null, side text not null, seen_at timestamptz not null default now(), primary key (war, user_id));
alter table public.war_presence enable row level security;

-- ---------- helpers (server only) ----------
create or replace function public.village_add(p_user uuid, p_points int, p_reason text) returns void
language plpgsql security definer set search_path to '' as $$
declare v_village text;
begin
  if p_points is null or p_points <= 0 then return; end if;
  select village into v_village from public.characters where user_id = p_user;
  if v_village is null then return; end if;
  insert into public.village_log (village, user_id, points, reason) values (v_village, p_user, p_points, p_reason);
  update public.villages set score = score + p_points, treasury = treasury + p_points where id = v_village;
end $$;

create or replace function public.village_bonus(p_village text, p_building text) returns numeric
language sql stable security definer set search_path to '' as $$
  select coalesce((select (upgrades->>p_building)::int from public.villages where id = p_village), 0) * 0.05 $$;

create or replace function public.kage_take(p_user uuid, p_from uuid) returns void
language plpgsql security definer set search_path to '' as $$
begin
  update public.villages v set kage = p_user, kage_since = now()
   where v.id = (select village from public.characters where user_id = p_user) and v.kage is not distinct from p_from;
end $$;

-- ---------- earning village points ----------
create or replace function public.trg_battle_points() returns trigger
language plpgsql security definer set search_path to '' as $$
declare m public.missions; v_pts int := 0;
begin
  select * into m from public.missions where id = new.mission_id;
  if m.kind = 'quest' then v_pts := 3;
  elsif m.kind = 'mission' then v_pts := case m.grade when 'D' then 1 when 'C' then 2 when 'B' then 3 when 'A' then 5 when 'S' then 8 else 1 end;
  end if;
  perform public.village_add(new.user_id, v_pts, m.kind);
  return null;
end $$;
create trigger battle_points after update of status on public.battles for each row
  when (old.status = 'active' and new.status = 'won') execute function public.trg_battle_points();

create or replace function public.trg_char_points() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if public.rank_index(new.rank) > public.rank_index(old.rank) then perform public.village_add(new.user_id, 10, 'exam'); end if;
  if jsonb_array_length(coalesce(new.lessons_done, '[]'::jsonb)) > jsonb_array_length(coalesce(old.lessons_done, '[]'::jsonb)) then
    perform public.village_add(new.user_id, 1, 'lesson'); end if;
  return null;
end $$;
create trigger char_points after update of rank, lessons_done on public.characters for each row execute function public.trg_char_points();

create or replace function public.trg_seen() returns trigger language plpgsql as $$
begin new.seen_at := now(); return new; end $$;
create trigger char_seen before update of pos_x, pos_y on public.characters for each row execute function public.trg_seen();

create or replace function public.trg_duel_points() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v_wv text; v_lv text; v_loser uuid; v_capped boolean;
begin
  if old.status = 'pending' and new.status in ('declined', 'expired') and new.kind = 'kage' then
    perform public.kage_take(new.a, new.b); return null;
  end if;
  if not (old.status = 'active' and new.status = 'over' and new.winner is not null) then return null; end if;
  v_loser := case when new.winner = new.a then new.b else new.a end;
  select village into v_wv from public.characters where user_id = new.winner;
  select village into v_lv from public.characters where user_id = v_loser;
  v_capped := coalesce((new.points->>'capped')::boolean, false);
  if new.kind = 'war' then
    if not v_capped then
      perform public.village_add(new.winner, 25, 'war duel');
      update public.wars w set att_score = w.att_score + case when w.attacker = v_wv then 10 else 0 end,
        def_score = w.def_score + case when w.defender = v_wv then 10 else 0 end
       where w.id = new.war and w.status = 'active' and now() < w.ends_at;
    end if;
  elsif not v_capped then
    perform public.village_add(new.winner, case when v_wv <> v_lv then 10 else 5 end, 'duel');
  end if;
  if new.kind = 'kage' and new.winner = new.a then perform public.kage_take(new.a, new.b); end if;
  return null;
end $$;
create trigger duel_points after update of status on public.duels for each row execute function public.trg_duel_points();

create or replace function public.trg_raid_points() returns trigger
language plpgsql security definer set search_path to '' as $$
declare m jsonb;
begin
  for m in select * from jsonb_array_elements(new.members) loop
    if not coalesce((new.rewards->(m->>'id')->>'capped')::boolean, false) then perform public.village_add((m->>'id')::uuid, 10, 'boss'); end if;
  end loop;
  return null;
end $$;
create trigger raid_points after update of status on public.raids for each row
  when (old.status = 'active' and new.status = 'over' and new.winner = 'A') execute function public.trg_raid_points();

-- ---------- wars settle + daily territory income ----------
create or replace function public.village_tick() returns void
language plpgsql security definer set search_path to '' as $$
declare w public.wars; v public.villages; v_win text; v_day date := public.london_day(now()); v_n int;
begin
  for w in select * from public.wars where status = 'active' and ends_at <= now() for update skip locked loop
    v_win := case when w.att_score > w.def_score and (w.defender is not null or w.att_score >= 20) then w.attacker else w.defender end;
    update public.wars set status = 'over', winner = v_win where id = w.id;
    update public.territories set holder = case when v_win = w.attacker then w.attacker else holder end,
      cooldown_until = w.ends_at + interval '14 days' where id = w.territory;
  end loop;
  for v in select * from public.villages where last_income_day is null or last_income_day < v_day for update skip locked loop
    select count(*) into v_n from public.territories where holder = v.id;
    update public.villages set treasury = treasury + case when v.last_income_day is null then 0 else 50 * v_n * least(7, v_day - v.last_income_day) end,
      last_income_day = v_day where id = v.id;
  end loop;
end $$;

-- ---------- player-facing ----------
create or replace function public.village_info() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_month timestamptz := (date_trunc('month', now() at time zone 'Europe/London')) at time zone 'Europe/London'; v_out jsonb;
begin
  perform public.village_tick();
  select * into c from public.characters where user_id = auth.uid();
  if not found then raise exception 'No ninja.'; end if;
  select jsonb_build_object(
    'mine', c.village,
    'me', jsonb_build_object('id', c.user_id, 'rank', c.rank),
    'villages', (select jsonb_agg(jsonb_build_object('id', v.id, 'score', v.score, 'treasury', v.treasury, 'upgrades', v.upgrades,
        'month', coalesce((select sum(points) from public.village_log l where l.village = v.id and l.at >= v_month), 0),
        'ninjas', (select count(*) from public.characters x where x.village = v.id),
        'territories', coalesce((select jsonb_agg(t.id) from public.territories t where t.holder = v.id), '[]'::jsonb),
        'kage', case when k.user_id is null then null else jsonb_build_object('id', k.user_id, 'name', k.name, 'level', k.level, 'look', k.appearance,
            'since', v.kage_since, 'online', coalesce(k.seen_at > now() - interval '2 minutes', false), 'away', coalesce(k.seen_at < now() - interval '7 days', true)) end,
        'challenge_at', v.last_challenge + interval '24 hours') order by v.id)
      from public.villages v left join public.characters k on k.user_id = v.kage),
    'top', coalesce((select jsonb_agg(x) from (select ch.name, sum(l.points) points from public.village_log l join public.characters ch on ch.user_id = l.user_id
        where l.village = c.village and l.at >= v_month group by ch.name order by 2 desc limit 10) x), '[]'::jsonb),
    'my_month', coalesce((select sum(points) from public.village_log where user_id = c.user_id and at >= v_month), 0),
    'territories', (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'holder', t.holder, 'cooldown_until', t.cooldown_until,
        'war', (select to_jsonb(w) from public.wars w where w.territory = t.id and w.status = 'active' limit 1)) order by t.id) from public.territories t),
    'recent_wars', coalesce((select jsonb_agg(to_jsonb(w) order by w.ends_at desc) from (select * from public.wars where status = 'over' order by ends_at desc limit 5) w), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

create or replace function public.kage_claim() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v public.villages; k public.characters;
begin
  select * into c from public.characters where user_id = auth.uid();
  if c.rank <> 'Jonin' then raise exception 'Only a Jonin can become Kage.'; end if;
  select * into v from public.villages where id = c.village for update;
  if v.kage = c.user_id then return public.village_info(); end if;
  if v.kage is not null then
    select * into k from public.characters where user_id = v.kage;
    if k.seen_at is not null and k.seen_at > now() - interval '7 days' then raise exception 'Your village already has a Kage. Challenge them to a duel for the seat.'; end if;
  end if;
  update public.villages set kage = c.user_id, kage_since = now() where id = v.id;
  return public.village_info();
end $$;

create or replace function public.village_upgrade(p_building text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v public.villages; v_lv int; v_cost int;
begin
  if p_building not in ('training', 'missions', 'library', 'springs') then raise exception 'Unknown building.'; end if;
  select * into c from public.characters where user_id = auth.uid();
  select * into v from public.villages where id = c.village for update;
  if v.kage is distinct from c.user_id then raise exception 'Only the Kage can spend the village treasury.'; end if;
  v_lv := coalesce((v.upgrades->>p_building)::int, 0);
  if v_lv >= 5 then raise exception 'That building is fully upgraded.'; end if;
  v_cost := (array[300, 600, 1000, 1500, 2500])[v_lv + 1];
  if v.treasury < v_cost then raise exception 'Not enough in the treasury (needs %).', v_cost; end if;
  update public.villages set treasury = treasury - v_cost, upgrades = upgrades || jsonb_build_object(p_building, v_lv + 1) where id = v.id;
  return public.village_info();
end $$;

create or replace function public.war_declare(p_territory text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v public.villages; t public.territories;
begin
  perform public.village_tick();
  select * into c from public.characters where user_id = auth.uid();
  select * into v from public.villages where id = c.village for update;
  if v.kage is distinct from c.user_id then raise exception 'Only the Kage can declare war.'; end if;
  select * into t from public.territories where id = p_territory for update;
  if not found then raise exception 'Unknown territory.'; end if;
  if t.holder = v.id then raise exception 'Your village already holds %.', t.name; end if;
  if exists (select 1 from public.wars where territory = t.id and status = 'active') then raise exception 'There is already a war over %.', t.name; end if;
  if t.cooldown_until is not null and t.cooldown_until > now() then raise exception '% is recovering from the last war. Try again after %.', t.name, to_char(t.cooldown_until at time zone 'Europe/London', 'DD Mon HH24:MI'); end if;
  if exists (select 1 from public.wars where attacker = v.id and status = 'active') then raise exception 'Your village is already attacking somewhere. Finish that war first.'; end if;
  if v.treasury < 500 then raise exception 'Declaring war costs 500 from the treasury.'; end if;
  update public.villages set treasury = treasury - 500 where id = v.id;
  insert into public.wars (territory, attacker, defender, declared_by) values (t.id, v.id, t.holder, c.user_id);
  return public.village_info();
end $$;

create or replace function public.war_status(p_war uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare w public.wars; c public.characters; v_side text;
begin
  perform public.village_tick();
  select * into w from public.wars where id = p_war;
  if not found then raise exception 'War not found.'; end if;
  select * into c from public.characters where user_id = auth.uid();
  v_side := case when c.village = w.attacker then 'attacker' when c.village = w.defender then 'defender' else null end;
  return jsonb_build_object('war', to_jsonb(w), 'side', v_side, 'now', now(),
    'present', coalesce((select jsonb_agg(jsonb_build_object('id', ch.user_id, 'name', ch.name, 'level', ch.level, 'rank', ch.rank, 'village', ch.village, 'look', ch.appearance, 'side', p.side) order by p.side, ch.name)
      from public.war_presence p join public.characters ch on ch.user_id = p.user_id where p.war = w.id and p.seen_at > now() - interval '2 minutes'), '[]'::jsonb));
end $$;

create or replace function public.war_hold(p_war uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare w public.wars; c public.characters; v_side text;
begin
  select * into c from public.characters where user_id = auth.uid();
  if c.rank = 'Academy Student' then raise exception 'Academy students stay safe at home during wars.'; end if;
  select * into w from public.wars where id = p_war for update;
  if not found or w.status <> 'active' or w.ends_at <= now() then return public.war_status(p_war); end if;
  v_side := case when c.village = w.attacker then 'attacker' when c.village = w.defender then 'defender' else null end;
  if v_side is null then raise exception 'Your village is not part of this war.'; end if;
  insert into public.war_presence (war, user_id, side, seen_at) values (w.id, c.user_id, v_side, now())
    on conflict (war, user_id) do update set seen_at = now(), side = excluded.side;
  if v_side = 'attacker' and (w.last_hold is null or w.last_hold < now() - interval '10 minutes')
     and not exists (select 1 from public.war_presence p where p.war = w.id and p.side = 'defender' and p.seen_at > now() - interval '2 minutes') then
    update public.wars set att_score = att_score + 5, last_hold = now() where id = w.id;
  end if;
  return public.war_status(p_war);
end $$;

create or replace function public.war_leave(p_war uuid) returns void
language sql security definer set search_path to '' as $$
  delete from public.war_presence where war = p_war and user_id = auth.uid() $$;

-- ---------- upgrade effects ----------
create or replace function public.arena_mult(p_user uuid) returns numeric
language sql stable security definer set search_path to '' as $$
  select case when p is null then 1 when p = 1 then 1.5 when p <= 3 then 1.25 when p <= 10 then 1.1 else 1 end
  from (select public.arena_place(p_user, public.london_day(now()) - 1) p) x $$;

create or replace function public.energy_mult(p_user uuid) returns numeric
language sql stable security definer set search_path to '' as $$
  select public.arena_mult(p_user) * (1 + public.village_bonus((select village from public.characters where user_id = p_user), 'springs')) $$;

-- server-only helpers: not callable by players
revoke execute on function public.village_add(uuid, int, text), public.kage_take(uuid, uuid), public.village_tick() from public, anon, authenticated;
