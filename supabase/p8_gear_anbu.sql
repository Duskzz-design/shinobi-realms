-- Weapons, armour, thrown items, boss drops and ANBU squads.
alter table public.characters add column if not exists gear jsonb not null default '{}'::jsonb,
  add column if not exists owned_gear jsonb not null default '[]'::jsonb,
  add column if not exists anbu_squad uuid;

-- catalogue (mirrors GEAR in js/engine.js): price null = not sold (boss drop)
create table if not exists public.gear_catalog (id text primary key, slot text not null, tier text not null, price int, boss text);
insert into public.gear_catalog (id, slot, tier, price, boss) values
  ('tanto', 'weapon', 'basic', 400, null), ('katana', 'weapon', 'adv', 2500, null), ('anbu_blade', 'weapon', 'anbu', 8000, null),
  ('cleaver', 'weapon', 'boss', null, 'iron'), ('fangblade', 'weapon', 'boss', null, 'serpent'), ('thunderclap', 'weapon', 'boss', null, 'shrine'),
  ('genin_head', 'head', 'basic', 100, null), ('genin_chest', 'chest', 'basic', 200, null), ('genin_arms', 'arms', 'basic', 100, null), ('genin_legs', 'legs', 'basic', 100, null),
  ('flak_head', 'head', 'adv', 500, null), ('flak_chest', 'chest', 'adv', 1000, null), ('flak_arms', 'arms', 'adv', 500, null), ('flak_legs', 'legs', 'adv', 500, null),
  ('anbu_head', 'head', 'anbu', 2000, null), ('anbu_chest', 'chest', 'anbu', 4000, null), ('anbu_arms', 'arms', 'anbu', 2000, null), ('anbu_legs', 'legs', 'anbu', 2000, null),
  ('iron_helm', 'head', 'boss', null, 'iron'), ('scale_bracers', 'arms', 'boss', null, 'serpent'), ('hollow_plate', 'chest', 'boss', null, 'shrine')
on conflict (id) do nothing;
alter table public.gear_catalog enable row level security;
create policy gear_catalog_read on public.gear_catalog for select using (true);

-- thrown items join the shop; advanced ones need Chunin
create or replace function public.item_price(p_item text) returns int language sql immutable set search_path to '' as $$
  select case p_item when 'pill_heal' then 120 when 'pill_chakra' then 100 when 'smoke' then 150 when 'antidote' then 80
    when 'kunai' then 40 when 'shuriken' then 30 when 'kunai_x' then 160 when 'shuriken_w' then 110 else null end $$;
create or replace function public.item_rank(p_item text) returns int language sql immutable set search_path to '' as $$
  select case when p_item in ('kunai_x', 'shuriken_w') then 2 else 0 end $$;
do $$ declare d text; begin
  d := pg_get_functiondef('public.buy_item(text,integer)'::regprocedure);
  d := replace(d, '  select * into c from public.characters where user_id = auth.uid() for update;',
    '  select * into c from public.characters where user_id = auth.uid() for update;
  if public.rank_index(c.rank) < public.item_rank(p_item) then raise exception ''That item is for Chunin and above.''; end if;');
  if position('item_rank' in d) = 0 then raise exception 'buy_item patch failed'; end if;
  execute d;
end $$;

create or replace function public.can_wear(c public.characters, p_id text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce((select case g.tier when 'anbu' then c.anbu_squad is not null when 'adv' then public.rank_index(c.rank) >= 2 else true end
    from public.gear_catalog g where g.id = p_id), false) $$;

create or replace function public.buy_gear(p_id text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; g public.gear_catalog;
begin
  select * into c from public.characters where user_id = auth.uid() for update;
  select * into g from public.gear_catalog where id = p_id;
  if not found or g.price is null then raise exception 'That is not for sale.'; end if;
  if c.owned_gear ? p_id then raise exception 'You already own that.'; end if;
  if g.tier = 'adv' and public.rank_index(c.rank) < 2 then raise exception 'Advanced gear is for Chunin and above.'; end if;
  if g.tier = 'anbu' and c.anbu_squad is null then raise exception 'Only ANBU members can buy ANBU gear.'; end if;
  if c.ryo < g.price then raise exception 'Not enough ryo.'; end if;
  update public.characters set ryo = ryo - g.price, owned_gear = owned_gear || to_jsonb(p_id) where user_id = c.user_id;
  return public.get_me();
end $$;

create or replace function public.equip_gear(p_slot text, p_id text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; g public.gear_catalog;
begin
  if p_slot not in ('weapon', 'head', 'chest', 'arms', 'legs') then raise exception 'Unknown slot.'; end if;
  select * into c from public.characters where user_id = auth.uid() for update;
  if p_id is null or p_id = '' then
    update public.characters set gear = gear - p_slot where user_id = c.user_id; return public.get_me();
  end if;
  select * into g from public.gear_catalog where id = p_id;
  if not found or g.slot <> p_slot then raise exception 'That does not go there.'; end if;
  if not (c.owned_gear ? p_id) then raise exception 'You do not own that.'; end if;
  if not public.can_wear(c, p_id) then raise exception '%', case g.tier when 'anbu' then 'Only ANBU members can wear ANBU gear.' else 'You need to be a Chunin to wear that.' end; end if;
  update public.characters set gear = gear || jsonb_build_object(p_slot, p_id) where user_id = c.user_id;
  return public.get_me();
end $$;

-- boss drops: about a 10% chance per rewarded win of one piece from that boss's set you don't have yet
do $$ declare d text; begin
  d := pg_get_functiondef('public.raid_finish(uuid,boolean)'::regprocedure);
  d := replace(d, 'v_wins int;', 'v_wins int; v_gear text;');
  d := replace(d, '    v_lv := c.level; v_cap := public.level_cap(c.rank);',
'    v_gear := null;
    if random() < 0.10 then
      select g.id into v_gear from public.gear_catalog g where g.boss = r.line and not (c.owned_gear ? g.id) order by random() limit 1;
      if v_gear is not null then update public.characters set owned_gear = owned_gear || to_jsonb(v_gear) where user_id = uid; end if;
    end if;
    v_lv := c.level; v_cap := public.level_cap(c.rank);');
  d := replace(d, '''claims_left'', 2 - v_n,', '''claims_left'', 2 - v_n, ''gear'', v_gear,');
  if position('v_gear' in d) = 0 or position('''gear'', v_gear' in d) = 0 then raise exception 'raid_finish patch failed'; end if;
  execute d;
end $$;

-- ---------- ANBU squads ----------
create table if not exists public.anbu_squads (id uuid primary key default gen_random_uuid(), village text not null references public.villages(id), name text not null,
  leader uuid not null, created_at timestamptz not null default now());
create table if not exists public.anbu_applications (squad uuid not null references public.anbu_squads(id) on delete cascade, user_id uuid not null, at timestamptz not null default now(), primary key (squad, user_id));
alter table public.anbu_squads enable row level security; create policy anbu_squads_read on public.anbu_squads for select using (true);
alter table public.anbu_applications enable row level security;

-- leaving ANBU takes the ANBU gear off
create or replace function public.anbu_remove(p_user uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare k text;
begin
  update public.characters ch set anbu_squad = null,
    gear = (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(ch.gear) e
            where not exists (select 1 from public.gear_catalog g where g.id = e.value #>> '{}' and g.tier = 'anbu'))
   where ch.user_id = p_user;
end $$;
revoke execute on function public.anbu_remove(uuid) from public, anon, authenticated;

create or replace function public.anbu_info() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v public.villages;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into v from public.villages where id = c.village;
  return jsonb_build_object('me', c.user_id, 'my_squad', c.anbu_squad, 'is_kage', v.kage = c.user_id, 'rank', c.rank,
    'squads', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'leader', s.leader,
        'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', m.name, 'rank', m.rank, 'level', m.level, 'look', m.appearance) order by m.name), '[]'::jsonb) from public.characters m where m.anbu_squad = s.id),
        'applied', exists (select 1 from public.anbu_applications a where a.squad = s.id and a.user_id = c.user_id),
        'applications', case when s.leader = c.user_id or v.kage = c.user_id then (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', m.name, 'rank', m.rank, 'level', m.level)), '[]'::jsonb)
            from public.anbu_applications a join public.characters m on m.user_id = a.user_id where a.squad = s.id) else '[]'::jsonb end) order by s.created_at)
      from public.anbu_squads s where s.village = c.village), '[]'::jsonb),
    'candidates', case when v.kage = c.user_id then (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', m.name, 'rank', m.rank, 'level', m.level) order by m.level desc), '[]'::jsonb)
        from public.characters m where m.village = c.village and m.rank in ('Chunin', 'Jonin') and m.anbu_squad is null) else '[]'::jsonb end);
end $$;

create or replace function public.anbu_create(p_name text, p_leader uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v public.villages; l public.characters; v_id uuid;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into v from public.villages where id = c.village;
  if v.kage is distinct from c.user_id then raise exception 'Only the Kage can create ANBU squads.'; end if;
  if (select count(*) from public.anbu_squads where village = v.id) >= 3 then raise exception 'A village can have at most 3 ANBU squads.'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 or length(p_name) > 24 then raise exception 'Give the squad a name of 3 to 24 letters.'; end if;
  select * into l from public.characters where user_id = p_leader for update;
  if not found or l.village <> v.id or l.rank not in ('Chunin', 'Jonin') then raise exception 'The leader must be a Chunin or Jonin of your village.'; end if;
  if l.anbu_squad is not null then raise exception '% is already in an ANBU squad.', l.name; end if;
  insert into public.anbu_squads (village, name, leader) values (v.id, trim(p_name), p_leader) returning id into v_id;
  update public.characters set anbu_squad = v_id where user_id = p_leader;
  delete from public.anbu_applications where user_id = p_leader;
  return public.anbu_info();
end $$;

create or replace function public.anbu_apply(p_squad uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; s public.anbu_squads;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into s from public.anbu_squads where id = p_squad;
  if not found or s.village <> c.village then raise exception 'That squad is not in your village.'; end if;
  if c.rank not in ('Chunin', 'Jonin') then raise exception 'Only Chunin and Jonin can join the ANBU.'; end if;
  if c.anbu_squad is not null then raise exception 'You are already in an ANBU squad.'; end if;
  if (select count(*) from public.characters where anbu_squad = s.id) >= 6 then raise exception 'That squad is full.'; end if;
  insert into public.anbu_applications (squad, user_id) values (s.id, c.user_id) on conflict do nothing;
  return public.anbu_info();
end $$;

create or replace function public.anbu_decide(p_squad uuid, p_user uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; s public.anbu_squads; a public.characters;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into s from public.anbu_squads where id = p_squad;
  if not found or (s.leader <> c.user_id and not exists (select 1 from public.villages where id = s.village and kage = c.user_id)) then raise exception 'Only the squad leader can decide.'; end if;
  if not exists (select 1 from public.anbu_applications where squad = s.id and user_id = p_user) then raise exception 'No application from that ninja.'; end if;
  delete from public.anbu_applications where squad = s.id and user_id = p_user;
  if p_accept then
    select * into a from public.characters where user_id = p_user for update;
    if a.anbu_squad is not null then raise exception '% already joined another squad.', a.name; end if;
    if (select count(*) from public.characters where anbu_squad = s.id) >= 6 then raise exception 'The squad is full.'; end if;
    update public.characters set anbu_squad = s.id where user_id = p_user;
    delete from public.anbu_applications where user_id = p_user;
  end if;
  return public.anbu_info();
end $$;

create or replace function public.anbu_leave(p_user uuid default null) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; t public.characters; s public.anbu_squads; v_kage uuid;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into t from public.characters where user_id = coalesce(p_user, c.user_id);
  if t.anbu_squad is null then return public.anbu_info(); end if;
  select * into s from public.anbu_squads where id = t.anbu_squad;
  select kage into v_kage from public.villages where id = s.village;
  if t.user_id <> c.user_id and s.leader <> c.user_id and v_kage is distinct from c.user_id then raise exception 'Only the squad leader or the Kage can remove members.'; end if;
  if t.user_id = s.leader then raise exception 'The leader cannot leave. The Kage can disband the squad or the leader can stay.'; end if;
  perform public.anbu_remove(t.user_id);
  return public.anbu_info();
end $$;

create or replace function public.anbu_disband(p_squad uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; s public.anbu_squads; m uuid;
begin
  select * into c from public.characters where user_id = auth.uid();
  select * into s from public.anbu_squads where id = p_squad;
  if not found or not exists (select 1 from public.villages where id = s.village and kage = c.user_id) then raise exception 'Only the Kage can disband a squad.'; end if;
  for m in select user_id from public.characters where anbu_squad = s.id loop perform public.anbu_remove(m); end loop;
  delete from public.anbu_squads where id = s.id;
  return public.anbu_info();
end $$;
