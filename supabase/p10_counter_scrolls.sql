-- p10: counter scrolls sold at the Library (Genin and above). Prices must match MOVES[...].price in js/engine.js
create or replace function public.buy_scroll(p_scroll text) returns jsonb language plpgsql security definer set search_path to '' as $$
declare c public.characters; v_price int;
begin
  perform public.assert_awake(auth.uid());
  select * into c from public.characters where user_id = auth.uid() for update;
  if not found then raise exception 'Create a ninja first.'; end if;
  v_price := case p_scroll when 'substitution' then 800 when 'release' then 1500 when 'dispel' then 2000 else null end;
  if v_price is null then raise exception 'The Library has no such scroll.'; end if;
  if public.rank_index(c.rank) < 1 then raise exception 'Library scrolls are for Genin and above.'; end if;
  if coalesce(c.scrolls, '[]'::jsonb) ? p_scroll then raise exception 'You already know that scroll.'; end if;
  if c.ryo < v_price then raise exception 'Not enough ryo.'; end if;
  update public.characters set ryo = ryo - v_price, scrolls = coalesce(scrolls, '[]'::jsonb) || to_jsonb(p_scroll) where user_id = c.user_id;
  return public.get_me();
end $$;
revoke all on function public.buy_scroll(text) from public, anon;
grant execute on function public.buy_scroll(text) to authenticated;
