// Team boss fights: lobby at a lair, then up to 3 players take turns (60s each) before the boss acts.
import * as G from './engine.js';
const TURN_MS = 60000;
const iso = (d: Date) => d.toISOString();

export async function raidOp(admin: any, uid: string, body: any, seed: () => number) {
  const load = async (id: string) => {
    const { data: r } = await admin.from('raids').select('*').eq('id', id).single();
    if (!r) throw new Error('Team not found.');
    return r;
  };
  const isMember = (r: any) => (r.members || []).some((m: any) => m.id === uid);
  const save = async (r: any, patch: any) => {
    const { data, error } = await admin.from('raids').update({ ...patch, updated_at: iso(new Date()) }).eq('id', r.id).eq('seq', r.seq).eq('status', r.status).select('id');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('The team changed. Try again.');
    return { ...r, ...patch };
  };
  const eligible = async (line: string) => {
    const [{ data: c }, { data: ql }] = await Promise.all([admin.from('characters').select('*').eq('user_id', uid).single(), admin.from('quest_lines').select('*').eq('id', line).single()]);
    if (!c || !ql) throw new Error('Unknown lair.');
    if (c.asleep_since) throw new Error('You are asleep. Wake up first.');
    if (G.RANKS.indexOf(c.rank) < ql.min_rank) throw new Error(`Only ${G.RANKS[ql.min_rank]}s and above may enter.`);
    if (c.level < (ql.min_level || 0)) throw new Error(`Reach level ${ql.min_level} to enter.`);
    if (!(c.quests && c.quests[line] && c.quests[line].done)) throw new Error(`Finish the quest line "${ql.name}" first.`);
    return c;
  };
  // leave any other lobby; refuse if in a live fight
  const clearOthers = async (keep: string | null) => {
    const { data } = await admin.from('raids').select('*').in('status', ['lobby', 'prep', 'active']).contains('members', [{ id: uid }]);
    for (const r of data || []) {
      if (r.id === keep) continue;
      if (['active', 'prep'].includes(r.status) && Date.now() - new Date(r.deadline).getTime() < 5 * 60000) throw new Error('You are already in a boss fight.');
      if (r.status === 'active') { await admin.from('raids').update({ status: 'closed' }).eq('id', r.id); continue; }
      await leaveLobby(r);
    }
  };
  const leaveLobby = async (r: any) => {
    const members = r.members.filter((m: any) => m.id !== uid);
    if (!members.length) return save(r, { status: 'closed', members });
    return save(r, { members, leader: r.leader === uid ? members[0].id : r.leader, seq: r.seq + 1 });
  };
  const meOf = (c: any) => ({ id: uid, name: c.name, level: c.level, rank: c.rank, element: c.element, look: c.appearance });

  if (body.op === 'raid_create') {
    const c = await eligible(String(body.line));
    await clearOthers(null);
    const { data, error } = await admin.from('raids').insert({ line: body.line, leader: uid, members: [meOf(c)] }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  if (body.op === 'raid_join') {
    const r = await load(body.raid);
    if (r.status !== 'lobby') throw new Error('That team already set off.');
    if (isMember(r)) return r;
    if (r.members.length >= 3) throw new Error('That team is full.');
    const c = await eligible(r.line);
    await clearOthers(r.id);
    return save(r, { members: [...r.members, meOf(c)], seq: r.seq + 1 });
  }
  if (body.op === 'raid_leave') {
    const r = await load(body.raid);
    if (!isMember(r)) return r;
    if (r.status === 'lobby') return leaveLobby(r);
    if (r.status === 'active') return act(r, { t: 'flee' }, false);
    return r;
  }
  if (body.op === 'raid_start') {
    const r = await load(body.raid);
    if (r.leader !== uid) throw new Error('Only the team leader can start.');
    { const { data: zz } = await admin.from('characters').select('name').in('user_id', r.members.map((m: any) => m.id)).not('asleep_since', 'is', null);
      if ((zz || []).length) throw new Error(`${zz[0].name} is asleep.`); }
    if (r.status !== 'lobby') throw new Error('Already started.');
    return save(r, { status: 'prep', ready: {}, seq: r.seq + 1, deadline: iso(new Date(Date.now() + 60000)) });
  }
  // every member picks a loadout; the fight begins when all are ready or the minute is up
  if (body.op === 'raid_ready') {
    const r = await load(body.raid);
    if (!isMember(r)) throw new Error('You are not in this team.');
    if (r.status !== 'prep') return r;
    const ready = { ...(r.ready || {}), [uid]: true };
    if (!r.members.every((m: any) => ready[m.id]) && Date.now() < new Date(r.deadline).getTime()) return save(r, { ready, seq: r.seq + 1 });
    const ids = r.members.map((m: any) => m.id);
    const [{ data: cs }, { data: js }] = await Promise.all([admin.from('characters').select('*').in('user_id', ids), admin.from('character_jutsu').select('user_id,move_id,level').in('user_id', ids)]);
    const players = ids.map((id: string) => {
      const c = cs.find((x: any) => x.user_id === id), jl: Record<string, number> = {};
      for (const j of js || []) if (j.user_id === id) jl[j.move_id] = j.level;
      return G.playerSpec(c, jl, G.poolsOf(c));
    });
    const s = G.newRaid({ seed: seed(), players, boss: G.bossSpec(r.line, players.length) });
    delete (s as any).seed;
    const misses: Record<string, number> = {}; for (const id of s.order) misses[id] = 0;
    return save(r, { status: 'active', ready, state: { engine: s, events: [] }, seq: r.seq + 1, misses, deadline: iso(new Date(Date.now() + TURN_MS)) });
  }
  if (body.op === 'raid_act' || body.op === 'raid_timeout') {
    const r = await load(body.raid);
    if (!isMember(r)) throw new Error('You are not in this team.');
    if (r.status !== 'active') throw new Error('This fight is over.');
    if (body.op === 'raid_timeout') {
      if (r.state.engine.status !== 'over' && Date.now() < new Date(r.deadline).getTime() + 1500) return r;
      if (r.state.engine.status !== 'over' && body.seq && body.seq !== r.seq) return r;
      return act(r, null, true);
    }
    return act(r, body.action || {}, false);
  }
  throw new Error('Unknown request.');

  async function act(r: any, a: any, timeout: boolean) {
    const s = r.state.engine; s.seed = seed();
    if (s.status === 'over') {
      // Fight already decided but rewards were never handed out: settle it now.
      const { data, error } = await admin.rpc('raid_finish', { p_raid: r.id, p_win: s.winner === 'A' });
      if (error) throw new Error(error.message);
      return { ...r, status: 'over', winner: s.winner, rewards: data };
    }
    const misses = { ...r.misses };
    const myUnit = Object.values(s.units).find((u: any) => u.uid === uid) as any;
    let events: any[] = [];
    if (timeout) {
      const late = s.side;
      misses[late] = (misses[late] || 0) + 1;
      events.push({ t: 'timeout', who: late, n: misses[late] });
      events.push(...G.act(s, late, misses[late] >= 3 ? { t: 'flee' } : { t: 'end' }));
    } else {
      if (!myUnit) throw new Error('You are not in this fight.');
      const action = a.t === 'move' ? { t: 'move', to: [a.to[0] | 0, a.to[1] | 0] } : a.t === 'use' ? { t: 'use', move: String(a.move), at: a.at ? [a.at[0] | 0, a.at[1] | 0] : null } : a.t === 'item' ? { t: 'item', item: String(a.item), at: a.at ? [a.at[0] | 0, a.at[1] | 0] : null } : a.t === 'flee' ? { t: 'flee' } : { t: 'end' };
      if (action.t === 'flee') {
        if (myUnit.hp <= 0) return r;
        if (s.side !== myUnit.id) { myUnit.hp = 0; events.push({ t: 'flee', who: myUnit.id }, { t: 'down', who: myUnit.id }); if (!Object.values(s.units).some((u: any) => u.team === 'A' && u.hp > 0)) { s.status = 'over'; s.winner = 'B'; events.push({ t: 'end', winner: 'B' }); } }
        else events.push(...G.act(s, myUnit.id, action));
      } else {
        if (s.side !== myUnit.id) throw new Error('Wait for your turn.');
        events.push(...G.act(s, myUnit.id, action));
        misses[myUnit.id] = 0;
      }
    }
    // the boss acts as soon as its turn comes
    let guard = 0;
    while (s.status === 'active' && s.units[s.side].npc && guard++ < 3) {
      events.push(...G.aiTurn(s, s.side, 16));
      if (s.status === 'active' && s.units[s.side].npc) events.push(...G.act(s, s.side, { t: 'end' }));
    }
    delete s.seed;
    const patch: any = { state: { ...r.state, engine: s, events }, seq: r.seq + 1, misses };
    if (events.some((e) => e.t === 'turn')) patch.deadline = iso(new Date(Date.now() + TURN_MS));
    let out = await save(r, patch);
    if (s.status === 'over') {
      for (const u of Object.values(s.units)) if ((u as any).uid && Object.keys((u as any).usedItems || {}).length) await admin.rpc('consume_items', { p_user: (u as any).uid, p_used: (u as any).usedItems });
      const { data, error } = await admin.rpc('raid_finish', { p_raid: r.id, p_win: s.winner === 'A' });
      if (error) throw new Error(error.message);
      out = { ...out, status: 'over', winner: s.winner, rewards: data };
    }
    return out;
  }
}
