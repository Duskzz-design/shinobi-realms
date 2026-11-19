-- v0.14.0 (CEO, 19 Nov 2026): fair play.
-- 1) "Report player" from a ninja's profile (cheating, second accounts, harassment, name, other).
-- 2) Play-time tracking for the weekly report: minutes played and the hours of the day a player was active.
-- 3) A daily snapshot of each active player's level, XP and ryo, so the weekly report can spot impossible jumps.
-- Nothing here is readable by players: only the server and the weekly report see it.

create table if not exists public.player_reports (
  id bigserial primary key,
  reporter uuid not null references auth.users on delete cascade,
  target uuid not null references auth.users on delete cascade,
  reason text not null check (reason in ('cheating', 'alt', 'harassment', 'name', 'other')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists player_reports_target on public.player_reports (target, created_at);
alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;

create or replace function public.report_player(p_user uuid, p_reason text, p_note text default null) returns jsonb
 language plpgsql security definer set search_path to ''
as $f$
declare n int;
begin
  if auth.uid() is null or not exists (select 1 from public.characters where user_id = auth.uid()) then raise exception 'Create a ninja first.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot report yourself.'; end if;
  if not exists (select 1 from public.characters where user_id = p_user) then raise exception 'That ninja no longer exists.'; end if;
  if p_reason not in ('cheating', 'alt', 'harassment', 'name', 'other') then raise exception 'Choose a reason.'; end if;
  if exists (select 1 from public.player_reports where reporter = auth.uid() and target = p_user and created_at > now() - interval '24 hours') then
    raise exception 'You already reported this ninja today. Thanks, we will look into it.';
  end if;
  select count(*) into n from public.player_reports where reporter = auth.uid() and created_at > now() - interval '24 hours';
  if n >= 10 then raise exception 'You have sent a lot of reports today. Please try again tomorrow.'; end if;
  insert into public.player_reports (reporter, target, reason, note)
    values (auth.uid(), p_user, p_reason, nullif(left(btrim(coalesce(p_note, '')), 300), ''));
  return jsonb_build_object('ok', true);
end $f$;
revoke all on function public.report_player(uuid, text, text) from public, anon;
grant execute on function public.report_player(uuid, text, text) to authenticated;

create table if not exists public.play_activity (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  minutes int not null default 0,
  hours int not null default 0,          -- bit h set = active during London hour h (0-23)
  last_beat timestamptz,
  primary key (user_id, day)
);
alter table public.play_activity enable row level security;
revoke all on public.play_activity from anon, authenticated;

create table if not exists public.daily_snapshots (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  rank text, level int, xp int, ryo int,
  primary key (user_id, day)
);
alter table public.daily_snapshots enable row level security;
revoke all on public.daily_snapshots from anon, authenticated;

-- The game calls this once a minute while the player is in the village with the tab visible.
create or replace function public.heartbeat() returns void
 language plpgsql security definer set search_path to ''
as $f$
declare d date := public.london_day(now()); h int := extract(hour from (now() at time zone 'Europe/London'))::int;
begin
  if auth.uid() is null or not exists (select 1 from public.characters where user_id = auth.uid()) then return; end if;
  insert into public.play_activity as a (user_id, day, minutes, hours, last_beat)
    values (auth.uid(), d, 1, 1 << h, now())
  on conflict (user_id, day) do update set
    minutes = a.minutes + case when a.last_beat is null or a.last_beat < now() - interval '50 seconds' then 1 else 0 end,
    hours = a.hours | (1 << h),
    last_beat = case when a.last_beat is null or a.last_beat < now() - interval '50 seconds' then now() else a.last_beat end;
  insert into public.daily_snapshots (user_id, day, rank, level, xp, ryo)
    select user_id, d, rank, level, xp, ryo from public.characters where user_id = auth.uid()
  on conflict (user_id, day) do nothing;
end $f$;
revoke all on function public.heartbeat() from public, anon;
grant execute on function public.heartbeat() to authenticated;
