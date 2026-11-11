-- p16: Auction House. Fixed-price listings for boss gear and shop consumables. 48h listings, 10% sales tax removed from the game.
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller uuid not null references public.characters(user_id) on delete cascade,
  seller_name text not null,
  kind text not null check (kind in ('gear', 'item')),
  item_id text not null,
  qty int not null default 1 check (qty between 1 and 10),
  price int not null check (price between 1 and 10000000),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled', 'expired')),
  buyer uuid, buyer_name text, tax int,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  closed_at timestamptz
);
create index if not exists market_active_idx on public.market_listings (status, expires_at);
create index if not exists market_seller_idx on public.market_listings (seller, created_at desc);
alter table public.market_listings enable row level security;
drop policy if exists "read market" on public.market_listings;
create policy "read market" on public.market_listings for select to authenticated using (status = 'active' or seller = auth.uid() or buyer = auth.uid());

-- return expired listings to their sellers (called by every market action)
create or replace function public.market_expire() returns void language plpgsql security definer set search_path to '' as $$
declare l public.market_listings;
begin
  for l in select * from public.market_listings where status = 'active' and expires_at <= now() for update skip locked loop
    if l.kind = 'gear' then
      update public.characters set owned_gear = case when owned_gear ? l.item_id then owned_gear else owned_gear || to_jsonb(l.item_id) end where user_id = l.seller;
    else
      update public.characters set items = items || jsonb_build_object(l.item_id, coalesce((items->>l.item_id)::int, 0) + l.qty) where user_id = l.seller;
    end if;
    update public.market_listings set status = 'expired', closed_at = now() where id = l.id;
  end loop;
end $$;

create or replace function public.market_list(p_kind text, p_item text, p_qty int, p_price int) returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_have int; v_qty int := greatest(1, coalesce(p_qty, 1));
begin
  perform public.assert_awake(auth.uid());
  perform public.market_expire();
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'Create a ninja first.'; end if;
  if public.rank_index(c.rank) < 1 then raise exception 'The Auction House is for Genin and above.'; end if;
  if p_price is null or p_price < 1 or p_price > 10000000 then raise exception 'Set a price between 1 and 10,000,000 ryo.'; end if;
  if (select count(*) from public.market_listings where seller = c.user_id and status = 'active') >= 10 then raise exception 'You can have at most 10 listings at a time.'; end if;
  if p_kind = 'gear' then
    if not exists (select 1 from public.gear_catalog where id = p_item and tier = 'boss') then raise exception 'Only rare boss gear can be sold here.'; end if;
    if not (c.owned_gear ? p_item) then raise exception 'You do not own that.'; end if;
    if exists (select 1 from jsonb_each_text(coalesce(c.gear, '{}'::jsonb)) g where g.value = p_item) then raise exception 'Take it off first (Equipment).'; end if;
    v_qty := 1;
    update public.characters set owned_gear = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(owned_gear) x where x <> p_item) where user_id = c.user_id;
  elsif p_kind = 'item' then
    if public.item_price(p_item) is null then raise exception 'Unknown item.'; end if;
    v_have := coalesce((c.items->>p_item)::int, 0);
    if v_qty > 10 then raise exception 'List at most 10 at a time.'; end if;
    if v_have < v_qty then raise exception 'You only have % of those.', v_have; end if;
    update public.characters set items = items || jsonb_build_object(p_item, v_have - v_qty) where user_id = c.user_id;
  else raise exception 'Unknown listing type.'; end if;
  insert into public.market_listings (seller, seller_name, kind, item_id, qty, price) values (c.user_id, c.name, p_kind, p_item, v_qty, p_price);
  return public.get_me();
end $$;

create or replace function public.market_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path to '' as $$
declare l public.market_listings;
begin
  select * into l from public.market_listings where id = p_id for update;
  if not found or l.seller <> auth.uid() then raise exception 'Listing not found.'; end if;
  if l.status <> 'active' then raise exception 'That listing is already closed.'; end if;
  if l.kind = 'gear' then
    update public.characters set owned_gear = case when owned_gear ? l.item_id then owned_gear else owned_gear || to_jsonb(l.item_id) end where user_id = l.seller;
  else
    update public.characters set items = items || jsonb_build_object(l.item_id, coalesce((items->>l.item_id)::int, 0) + l.qty) where user_id = l.seller;
  end if;
  update public.market_listings set status = 'cancelled', closed_at = now() where id = l.id;
  return public.get_me();
end $$;

create or replace function public.market_buy(p_id uuid) returns jsonb language plpgsql security definer set search_path to '' as $$
declare l public.market_listings; c public.characters; v_have int; v_tax int;
begin
  perform public.assert_awake(auth.uid());
  perform public.market_expire();
  select * into l from public.market_listings where id = p_id for update;
  if not found or l.status <> 'active' then raise exception 'Sorry, that listing is gone.'; end if;
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'Create a ninja first.'; end if;
  if public.rank_index(c.rank) < 1 then raise exception 'The Auction House is for Genin and above.'; end if;
  if l.seller = c.user_id then raise exception 'That is your own listing. Cancel it instead.'; end if;
  if c.ryo < l.price then raise exception 'Not enough ryo.'; end if;
  if l.kind = 'gear' then
    if c.owned_gear ? l.item_id then raise exception 'You already own one of those.'; end if;
    update public.characters set ryo = ryo - l.price, owned_gear = owned_gear || to_jsonb(l.item_id) where user_id = c.user_id;
  else
    if public.rank_index(c.rank) < public.item_rank(l.item_id) then raise exception 'That item is for Chunin and above.'; end if;
    v_have := coalesce((c.items->>l.item_id)::int, 0);
    if v_have + l.qty > 10 then raise exception 'You can carry at most 10 of each item (you have %).', v_have; end if;
    update public.characters set ryo = ryo - l.price, items = items || jsonb_build_object(l.item_id, v_have + l.qty) where user_id = c.user_id;
  end if;
  v_tax := ceil(l.price * 0.10)::int;
  update public.characters set ryo = ryo + (l.price - v_tax) where user_id = l.seller;
  update public.market_listings set status = 'sold', buyer = c.user_id, buyer_name = c.name, tax = v_tax, closed_at = now() where id = l.id;
  return public.get_me() || jsonb_build_object('bought', jsonb_build_object('kind', l.kind, 'item', l.item_id, 'qty', l.qty, 'price', l.price));
end $$;

-- the market view: active listings, my listings and my recent sales/purchases
create or replace function public.market_browse() returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  perform public.market_expire();
  return jsonb_build_object(
    'listings', coalesce((select jsonb_agg(to_jsonb(l) - 'buyer' - 'buyer_name' - 'tax' order by l.created_at desc) from (select * from public.market_listings where status = 'active' and seller <> auth.uid() order by created_at desc limit 200) l), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select * from public.market_listings where seller = auth.uid() and (status = 'active' or closed_at > now() - interval '3 days') order by created_at desc limit 40) l), '[]'::jsonb),
    'bought', coalesce((select jsonb_agg(to_jsonb(l) order by l.closed_at desc) from (select * from public.market_listings where buyer = auth.uid() and closed_at > now() - interval '3 days' order by closed_at desc limit 20) l), '[]'::jsonb),
    'tax', 0.10);
end $$;

revoke all on function public.market_expire() from public, anon, authenticated;
revoke all on function public.market_list(text, text, int, int), public.market_cancel(uuid), public.market_buy(uuid), public.market_browse() from public, anon;
grant execute on function public.market_list(text, text, int, int), public.market_cancel(uuid), public.market_buy(uuid), public.market_browse() to authenticated;
