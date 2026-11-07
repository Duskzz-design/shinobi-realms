// Live player duels. Both players call this; the row in "duels" is the shared truth and is pushed to both by realtime.
import * as G from './engine.js';
const TURN_MS = G.DUEL_TURN_SEC * 1000, INVITE_MS = 60000;
const now = () => new Date();
const iso = (d: Date) => d.toISOString();

export async function duelOp(admin: any, uid: string, body: any, seed: () => number) {
  const load = async (id: string) => {
    const { data: d } = await admin.from('duels').select('*').eq('id', id).single();
    if (!d || (d.a !== uid && d.b !== uid)) throw new Error('Duel not found.');
    return d;
  };
  // only one change per version of the duel, so two clicks or two timeout claims can't both land
  const save = async (d: any, patch: any) => {
    const { data, error } = await admin.from('duels').update({ ...patch, updated_at: iso(now()) }).eq('id', d.id).eq('seq', d.seq).eq('status', d.status).select('id');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('The duel moved on. Try again.');
    return { ...d, ...patch };
  };
  // close duels nobody is playing any more
  const tidy = async (u: string) => {
    const old = iso(new Date(Date.now() - 5 * 60000)), inv = iso(new Date(Date.now() - INVITE_MS));
    await admin.from('duels').update({ status: 'expired' }).eq('status', 'pending').lt('created_at', inv).or(`a.eq.${u},b.eq.${u}`);
    await admin.from('duels').update({ status: 'expired' }).eq('status', 'active').lt('deadline', old).or(`a.eq.${u},b.eq.${u}`);
  };
  const busy = async (u: string) => {
    const { data } = await admin.from('duels').select('id').in('status', ['pending', 'active']).or(`a.eq.${u},b.eq.${u}`).limit(1);
    return (data || []).length > 0;
  };
  const sideOf = (d: any) => (d.a === uid ? 'a' : 'b');

  if (body.op === 'duel_challenge') {
    const target = String(body.target || '');
    if (target === uid) throw new Error('You cannot duel yourself.');
    const { data: cs } = await admin.from('characters').select('user_id,name,rank').in('user_id', [uid, target]);
    const me = (cs || []).find((c: any) => c.user_id === uid), them = (cs || []).find((c: any) => c.user_id === target);
    if (!me || !them) throw new Error('That ninja could not be found.');
    if (me.rank === 'Academy Student') throw new Error('Academy students cannot duel. Graduate to Genin first, and practise in the Academy sparring lessons.');
    if (them.rank === 'Academy Student') throw new Error(`${them.name} is still an Academy student and cannot duel yet.`);
    const kind = body.kind === 'kage' ? 'kage' : body.kind === 'war' ? 'war' : 'duel';
    let war = null;
    if (kind === 'kage') {
      const { data: full } = await admin.from('characters').select('user_id,village,rank,seen_at').in('user_id', [uid, target]);
      const m2 = full.find((c: any) => c.user_id === uid), t2 = full.find((c: any) => c.user_id === target);
      if (m2.rank !== 'Jonin') throw new Error('Only a Jonin can challenge the Kage.');
      if (m2.village !== t2.village) throw new Error('You can only challenge your own village\'s Kage.');
      const { data: v } = await admin.from('villages').select('*').eq('id', m2.village).single();
      if (v.kage !== target) throw new Error(`${them.name} is not your Kage.`);
      if (v.last_challenge && Date.now() < new Date(v.last_challenge).getTime() + 24 * 3600e3) throw new Error('The Kage was challenged recently. The seat can be challenged once every 24 hours.');
      if (!t2.seen_at || Date.now() - new Date(t2.seen_at).getTime() > 2 * 60e3) throw new Error('The Kage is not in the village right now. Challenges only work while they are online.');
      const { data: fights } = await admin.from('battles').select('id').eq('user_id', target).eq('status', 'active').gt('updated_at', iso(new Date(Date.now() - 10 * 60e3))).limit(1);
      if ((fights || []).length) throw new Error('The Kage is in the middle of a fight. Try again in a few minutes.');
    }
    if (kind === 'war') {
      const { data: w } = await admin.from('wars').select('*').eq('id', String(body.war || '')).single();
      if (!w || w.status !== 'active' || new Date(w.ends_at).getTime() <= Date.now()) throw new Error('This war is over.');
      const { data: full } = await admin.from('characters').select('user_id,village').in('user_id', [uid, target]);
      const mv = full.find((c: any) => c.user_id === uid)?.village, tv = full.find((c: any) => c.user_id === target)?.village;
      const sides = [w.attacker, w.defender];
      if (!sides.includes(mv) || !sides.includes(tv) || mv === tv) throw new Error('War duels are between the attacking and defending villages.');
      war = w.id;
    }
    await tidy(uid); await tidy(target);
    if (await busy(uid)) throw new Error('You are already in a duel.');
    if (await busy(target)) throw new Error(`${them.name} is busy in another duel.`);
    if (kind === 'kage') {
      const { data: me2 } = await admin.from('characters').select('village').eq('user_id', uid).single();
      await admin.from('villages').update({ last_challenge: iso(now()) }).eq('id', me2.village);
    }
    const { data: d, error } = await admin.from('duels').insert({ a: uid, b: target, a_name: me.name, b_name: them.name, kind, war, deadline: iso(new Date(Date.now() + INVITE_MS)) }).select().single();
    if (error) throw new Error(error.message);
    return d;
  }
  if (body.op === 'duel_cancel') {
    const d = await load(body.duel);
    if (d.status !== 'pending') return d;
    const late = Date.now() - new Date(d.created_at).getTime() > INVITE_MS - 2000;
    return save(d, { status: d.b === uid ? 'declined' : late ? 'expired' : 'cancelled' });
  }
  if (body.op === 'duel_accept') {
    const d = await load(body.duel);
    if (d.b !== uid) throw new Error('Only the challenged ninja can accept.');
    if (d.status !== 'pending') throw new Error('This challenge is no longer open.');
    if (Date.now() - new Date(d.created_at).getTime() > INVITE_MS) { await save(d, { status: 'expired' }); throw new Error('The challenge expired.'); }
    const [{ data: ca }, { data: cb }, { data: ja }, { data: jb }] = await Promise.all([
      admin.from('characters').select('*').eq('user_id', d.a).single(), admin.from('characters').select('*').eq('user_id', d.b).single(),
      admin.from('character_jutsu').select('move_id,level').eq('user_id', d.a), admin.from('character_jutsu').select('move_id,level').eq('user_id', d.b)]);
    if (ca.rank === 'Academy Student' || cb.rank === 'Academy Student') { await save(d, { status: 'cancelled' }); throw new Error('Academy students cannot duel.'); }
    const jl = (rows: any[]) => Object.fromEntries((rows || []).map((r) => [r.move_id, r.level]));
    const s = G.newDuel(seed(), ca, jl(ja), cb, jl(jb));
    delete (s as any).seed;
    return save(d, { status: 'active', state: { engine: s, events: [], arena: { a: ca.arena_points, b: cb.arena_points } }, seq: 1, deadline: iso(new Date(Date.now() + TURN_MS)) });
  }
  if (body.op === 'duel_act' || body.op === 'duel_timeout') {
    const d = await load(body.duel);
    if (d.status !== 'active') throw new Error('This duel is over.');
    const s = d.state.engine; s.seed = seed();
    const misses = { ...d.misses };
    let events: any[] = [], reason = null;
    if (body.op === 'duel_timeout') {
      if (Date.now() < new Date(d.deadline).getTime() + 1500) return d; // not yet
      if (body.seq && body.seq !== d.seq) return d; // someone already handled it
      const late = s.side;
      misses[late] = (misses[late] || 0) + 1;
      events.push({ t: 'timeout', who: late, n: misses[late] });
      if (misses[late] >= 3) { events.push(...G.act(s, late, { t: 'flee' })); reason = 'timeout'; }
      else events.push(...G.act(s, late, { t: 'end' }));
    } else {
      const me = sideOf(d), a = body.action || {};
      const action = a.t === 'move' ? { t: 'move', to: [a.to[0] | 0, a.to[1] | 0] } : a.t === 'use' ? { t: 'use', move: String(a.move), at: a.at ? [a.at[0] | 0, a.at[1] | 0] : null } : a.t === 'flee' ? { t: 'flee' } : { t: 'end' };
      if (action.t !== 'flee' && s.side !== me) throw new Error('Wait for your turn.');
      if (action.t === 'flee') { s.side = me; reason = 'forfeit'; }
      const before = s.side;
      events = G.act(s, me, action);
      misses[me] = 0;
      if (s.status === 'active' && s.side === before) { /* same turn continues */ }
    }
    delete s.seed;
    const sideChanged = events.some((e) => e.t === 'turn');
    const patch: any = { state: { ...d.state, engine: s, events }, seq: d.seq + 1, misses };
    if (sideChanged) patch.deadline = iso(new Date(Date.now() + TURN_MS));
    let out = await save(d, patch);
    if (s.status === 'over') {
      const winner = s.winner === 'a' ? d.a : d.b;
      const { data: pts, error } = await admin.rpc('duel_finish', { p_duel: d.id, p_winner: winner, p_reason: reason || 'ko' });
      if (error) throw new Error(error.message);
      out = { ...out, status: 'over', winner, reason: reason || 'ko', points: pts };
    }
    return out;
  }
  if (body.op === 'duel_get') return load(body.duel);
  throw new Error('Unknown request.');
}
