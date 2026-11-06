// Battle server: runs the shared hex combat engine with the server's dice.
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as G from './engine.js';
import { duelOp } from './duel.ts';
import { raidOp } from './raid.ts';

const URL = Deno.env.get('SUPABASE_URL')!, SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
// hide the dice seed from players
const pub = (s: any) => { const { seed: _x, ...rest } = s; return rest; };

async function initEngine(battleId: string, uid: string) {
  const { data: b } = await admin.from('battles').select('*').eq('id', battleId).eq('user_id', uid).single();
  if (!b) throw new Error('Battle not found.');
  if (b.state.engine) return b;
  const [{ data: c }, { data: jutsu }] = await Promise.all([
    admin.from('characters').select('*').eq('user_id', uid).single(),
    admin.from('character_jutsu').select('move_id,level').eq('user_id', uid)]);
  const jl: Record<string, number> = {}; for (const j of jutsu || []) jl[j.move_id] = j.level;
  const s = G.newBattle({ seed: seed(), a: G.playerSpec(c, jl, b.state), b: G.enemySpec(b.state), aStarts: true });
  b.state.engine = s; b.state.used = {};
  await admin.from('battles').update({ state: b.state, updated_at: new Date().toISOString() }).eq('id', b.id);
  return b;
}
const view = (b: any, events: any[] = [], result: any = null) => ({ id: b.id, status: b.status, state: { ...b.state, engine: pub(b.state.engine), used: undefined }, events, result });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = req.headers.get('Authorization') || '';
    const user = createClient(URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user: u } } = await user.auth.getUser(auth.replace('Bearer ', ''));
    if (!u) return out({ error: 'Please sign in again.' }, 401);
    const body = await req.json();
    const rpc = async (fn: string, args: any) => { const { data, error } = await user.rpc(fn, args); if (error) throw new Error(error.message); return data; };

    if (body.op === 'start' || body.op === 'exam' || body.op === 'continue' || body.op === 'lesson') {
      const r = body.op === 'start' ? await rpc('start_mission', { p_mission: body.mission }) : body.op === 'lesson' ? await rpc('start_lesson', { p_lesson: body.lesson }) : body.op === 'exam' ? await rpc('start_exam', {}) : await rpc('exam_continue', { p_battle: body.battle });
      const b = await initEngine(r.id, u.id);
      return out(view(b, []));
    }
    if (body.op === 'act') {
      let b = await initEngine(body.battle, u.id);
      if (b.status !== 'active') throw new Error('This fight is over.');
      const s = b.state.engine; s.seed = seed();
      const a = body.action || {};
      const action = a.t === 'move' ? { t: 'move', to: [a.to[0] | 0, a.to[1] | 0] } : a.t === 'use' ? { t: 'use', move: String(a.move), at: a.at ? [a.at[0] | 0, a.at[1] | 0] : null } : a.t === 'flee' ? { t: 'flee' } : { t: 'end' };
      // a fight that ended but was never settled (e.g. a dropped connection) is settled now
      const events: any[] = s.status === 'over' ? [] : G.act(s, 'a', action);
      if (action.t === 'use' && events.length) b.state.used[action.move] = (b.state.used[action.move] || 0) + 1;
      if (s.status === 'active' && s.side === 'b') events.push(...G.aiTurn(s, 'b', 14));
      if (s.status === 'active' && s.side === 'b') { events.push(...G.act(s, 'b', { t: 'end' })); }
      let result = null, status = 'active';
      if (s.status === 'over') {
        const win = s.winner === 'a', p = s.units.a;
        status = action.t === 'flee' && events.length && !win ? 'fled' : win ? 'won' : 'lost';
        Object.assign(b.state, { php: p.hp, pst: p.st, pch: p.ch });
        await admin.from('battles').update({ state: b.state }).eq('id', b.id);
        if (status !== 'fled') {
          const { data, error } = await admin.rpc('battle_finish', { p_battle: b.id, p_win: win, p_used: b.state.used });
          if (error) throw new Error(error.message); result = data;
        }
      }
      b.status = status;
      await admin.from('battles').update({ state: b.state, status, updated_at: new Date().toISOString() }).eq('id', b.id);
      return out(view(b, events, result));
    }
    if (String(body.op).startsWith('raid_')) return out(await raidOp(admin, u.id, body, seed));
    if (String(body.op).startsWith('duel_')) return out(await duelOp(admin, u.id, body, seed));
    if (body.op === 'get') { const b = await initEngine(body.battle, u.id); return out(view(b)); }
    return out({ error: 'Unknown request.' }, 400);
  } catch (e) {
    return out({ error: String((e as Error).message || e).replace(/^ERROR:\s*/, '') }, 400);
  }
});
