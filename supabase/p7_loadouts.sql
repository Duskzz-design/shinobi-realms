alter table public.characters add column if not exists loadout jsonb not null default '{}'::jsonb,
  add column if not exists items jsonb not null default '{}'::jsonb, add column if not exists jutsu_slots int not null default 6;
alter table public.duels add column if not exists ready jsonb not null default '{}'::jsonb;
alter table public.raids add column if not exists ready jsonb not null default '{}'::jsonb;

create or replace function public.item_price(p_item text) returns int language sql immutable as $$
  select case p_item when 'pill_heal' then 120 when 'pill_chakra' then 100 when 'smoke' then 150 when 'antidote' then 80 else null end $$;

create or replace function public.set_loadout(p_jutsu text[], p_items text[]) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; mv public.moves; v_id text; v_j text[] := '{}'; v_i text[] := '{}';
begin
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'No ninja.'; end if;
  foreach v_id in array coalesce(p_jutsu, '{}') loop
    select * into mv from public.moves where id = v_id and style <> 'none';
    if found and public.knows_move(c, mv) and not (v_id = any(v_j)) then v_j := v_j || v_id; end if;
  end loop;
  if cardinality(v_j) > c.jutsu_slots then raise exception 'You can take % jutsu into a fight.', c.jutsu_slots; end if;
  foreach v_id in array coalesce(p_items, '{}') loop
    if public.item_price(v_id) is not null and not (v_id = any(v_i)) then v_i := v_i || v_id; end if;
  end loop;
  if cardinality(v_i) > 3 then raise exception 'You can pack 3 kinds of item.'; end if;
  update public.characters set loadout = jsonb_build_object('jutsu', to_jsonb(v_j), 'items', to_jsonb(v_i)) where user_id = c.user_id;
  return public.get_me();
end $$;

create or replace function public.buy_item(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_price int := public.item_price(p_item); v_have int; v_n int;
begin
  if v_price is null then raise exception 'Unknown item.'; end if;
  select * into c from public.characters where user_id = auth.uid() for update;
  v_have := coalesce((c.items->>p_item)::int, 0);
  v_n := least(greatest(coalesce(p_qty, 1), 1), 10 - v_have);
  if v_n < 1 then raise exception 'You can carry at most 10 of each item.'; end if;
  if c.ryo < v_price * v_n then raise exception 'Not enough ryo.'; end if;
  update public.characters set ryo = ryo - v_price * v_n, items = items || jsonb_build_object(p_item, v_have + v_n) where user_id = c.user_id;
  return public.get_me() || jsonb_build_object('bought', v_n);
end $$;

create or replace function public.consume_items(p_user uuid, p_used jsonb) returns void
language plpgsql security definer set search_path to '' as $$
declare k text; n int;
begin
  for k, n in select key, value::int from jsonb_each_text(coalesce(p_used, '{}'::jsonb)) loop
    update public.characters set items = items || jsonb_build_object(k, greatest(0, coalesce((items->>k)::int, 0) - n)) where user_id = p_user;
  end loop;
end $$;
revoke execute on function public.consume_items(uuid, jsonb) from public, anon, authenticated;
