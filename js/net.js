// Data layer: Supabase in production, an in-memory stand-in for offline testing (?offline).
export const SUPABASE_URL = 'https://azetseowvqyqhcnjzvnb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_wIQUai52KRMk3WTRCm4mzg_5itXxKF4';

const OFFLINE = new URLSearchParams(location.search).has('offline');
let sb = null;

export function isOffline() { return OFFLINE; }

export async function init() {
  if (OFFLINE) return;
  if (!window.supabase) throw new Error('Could not reach the game servers. Check your connection and refresh.');
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
}
export function client() { return sb; }

// ---------- auth ----------
const mock = { user: null, char: null };
export async function getUser() {
  if (OFFLINE) { const u = sessionStorage.getItem('mockUser'); return u ? JSON.parse(u) : null; }
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}
export function onAuth(cb) {
  if (OFFLINE) return;
  sb.auth.onAuthStateChange((_e, s) => cb(s ? s.user : null));
}
export async function signInGoogle() {
  if (OFFLINE) { sessionStorage.setItem('mockUser', JSON.stringify({ id: 'u' + Math.random().toString(36).slice(2, 8), email: 'tester@example.com' })); location.reload(); return; }
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function signOut() {
  if (OFFLINE) { sessionStorage.clear(); location.reload(); return; }
  await sb.auth.signOut(); location.reload();
}

// ---------- character ----------
export async function loadCharacter() {
  if (OFFLINE) { const c = sessionStorage.getItem('mockChar'); if (!c) return null; const o = await import('./offline.js'); return o.enrich(JSON.parse(c)); }
  const { data, error } = await sb.rpc('get_me');
  if (error) throw error;
  return data;
}
export async function nameAvailable(name) {
  if (OFFLINE) return name.toLowerCase() !== 'taken';
  const { data, error } = await sb.rpc('name_available', { p_name: name });
  if (error) throw error;
  return data;
}
export async function createCharacter({ name, village, appearance }) {
  if (OFFLINE) {
    const c = { user_id: JSON.parse(sessionStorage.getItem('mockUser')).id, name, village, appearance, level: 1, xp: 0, rank: 'Academy Student', strength: 5, agility: 5, intelligence: 5, willpower: 5, energy: 100, energy_at: Date.now(), jutsu: {}, ryo: 100 };
    sessionStorage.setItem('mockChar', JSON.stringify(c)); return (await import('./offline.js')).enrich(c);
  }
  const { error } = await sb.from('characters').insert({ name, village, appearance });
  if (error) {
    if (error.code === '23505') throw new Error('That name was just taken. Try another.');
    throw error;
  }
  return loadCharacter();
}
export async function savePosition(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (OFFLINE) { const c = JSON.parse(sessionStorage.getItem('mockChar')); Object.assign(c, { pos_x: x, pos_y: y }); sessionStorage.setItem('mockChar', JSON.stringify(c)); return; }
  const u = await getUser(); if (!u) return;
  await sb.from('characters').update({ pos_x: x, pos_y: y }).eq('user_id', u.id);
}

// ---------- realtime rooms ----------
// joinRoom(name, { me, onEvent(event, payload), onPresence(list) }) -> { send(event,payload), track(meta), leave() }
export async function joinRoom(name, { me, onEvent, onPresence, events = [] }) {
  if (OFFLINE) return mockRoom(name, { me, onEvent, onPresence });
  const { data } = await sb.auth.getSession();
  if (data.session) sb.realtime.setAuth(data.session.access_token);
  const ch = sb.channel(name, { config: { private: true, broadcast: { self: false }, presence: { key: me ? me.id : undefined } } });
  for (const ev of events) ch.on('broadcast', { event: ev }, (m) => onEvent && onEvent(ev, m.payload));
  if (onPresence) ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(); const list = [];
    for (const k in st) { const m = st[k][st[k].length - 1]; if (m) list.push(m); }
    onPresence(list);
  });
  let ready = false;
  await new Promise((res) => {
    const t = setTimeout(res, 6000);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { ready = true; clearTimeout(t); if (me) await ch.track(me); res(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('room', name, status);
    });
  });
  return {
    ready: () => ready,
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload }),
    track: (meta) => ch.track(meta),
    leave: () => sb.removeChannel(ch),
  };
}

// Offline: BroadcastChannel between tabs + optional wandering bots (?bots)
function mockRoom(name, { me, onEvent, onPresence }) {
  const bc = new BroadcastChannel('mock-' + name);
  const peers = new Map();
  const bots = new URLSearchParams(location.search).has('bots') && name.startsWith('village:') ? makeBots(onEvent) : [];
  const emitPresence = () => onPresence && onPresence([...(me ? [me] : []), ...peers.values(), ...bots.map((b) => b.meta)]);
  bc.onmessage = (e) => {
    const { t, ev, p, meta } = e.data;
    if (t === 'pres') { peers.set(meta.id, meta); emitPresence(); }
    if (t === 'bye') { peers.delete(meta.id); emitPresence(); }
    if (t === 'ev') onEvent && onEvent(ev, p);
  };
  let cur = me;
  const hb = setInterval(() => cur && bc.postMessage({ t: 'pres', meta: cur }), 1500);
  if (cur) bc.postMessage({ t: 'pres', meta: cur });
  setTimeout(emitPresence, 50);
  return {
    ready: () => true,
    send: (ev, p) => bc.postMessage({ t: 'ev', ev, p }),
    track: (meta) => { cur = meta; bc.postMessage({ t: 'pres', meta }); },
    leave: () => { clearInterval(hb); if (cur) bc.postMessage({ t: 'bye', meta: cur }); bc.close(); bots.forEach((b) => clearInterval(b.iv)); },
  };
}
function makeBots(onEvent) {
  const names = [['Ren', 2], ['Mika', 4], ['Sora', 0]];
  return names.map(([n, h], i) => {
    const meta = { id: 'bot' + i, name: n, village: 'pine', rank: 'Genin', level: 3 + i, look: { hairStyle: i + 1, hair: h, skin: i + 1, outfit: i + 3, band: i % 3, bandSpot: 0 }, x: 360 + i * 40, y: 400, dir: 0 };
    let tx = meta.x, ty = meta.y, k = 0;
    const iv = setInterval(() => {
      k++;
      if (k % 20 === 0) { tx = 300 + Math.random() * 180; ty = 340 + Math.random() * 120; }
      const dx = tx - meta.x, dy = ty - meta.y, d = Math.hypot(dx, dy);
      const moving = d > 2;
      if (moving) { meta.x += (dx / d) * 6; meta.y += (dy / d) * 6; meta.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); }
      onEvent && onEvent('mv', { id: meta.id, x: meta.x, y: meta.y, dir: meta.dir, m: moving ? 1 : 0 });
      if (k % 55 === 0 + i * 7) onEvent && onEvent('chat', { id: meta.id, name: n, village: 'pine', text: ['Anyone up for a mission?', 'Nice headband!', 'Training at the arena later.'][i], ch: 'village' });
    }, 100);
    return { meta, iv };
  });
}

// ---------- missions & combat ----------
let catalog = null, mockBattle = null;
const mockChar = () => JSON.parse(sessionStorage.getItem('mockChar'));
const saveMock = (c) => sessionStorage.setItem('mockChar', JSON.stringify(c));
export async function getCatalog() {
  if (catalog) return catalog;
  if (OFFLINE) { const o = await import('./offline.js'); return (catalog = { moves: o.MOVES, missions: o.MISSIONS }); }
  const [mv, ms] = await Promise.all([sb.from('moves').select('*').order('sort'), sb.from('missions').select('*').order('sort')]);
  if (mv.error) throw mv.error; if (ms.error) throw ms.error;
  return (catalog = { moves: mv.data, missions: ms.data });
}
const rpcErr = (error) => new Error((error.message || 'Something went wrong.').replace(/^.*?ERROR:\s*/, ''));
export async function startMission(id) {
  if (OFFLINE) { const o = await import('./offline.js'); mockBattle = o.mockStart(mockChar(), id); return mockBattle; }
  const { data, error } = await sb.rpc('start_mission', { p_mission: id });
  if (error) throw rpcErr(error);
  return data;
}
export async function battleAct(battleId, move) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); const r = o.mockAct(c, mockBattle, move); saveMock(c); return r; }
  const { data, error } = await sb.rpc('battle_act', { p_battle: battleId, p_move: move });
  if (error) throw rpcErr(error);
  return data;
}
export async function trainStat(stat, times = 1) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); const r = o.trainStat(c, stat, times); saveMock(c); return r; }
  const { data, error } = await sb.rpc('train_stat', { p_stat: stat, p_times: times });
  if (error) throw rpcErr(error);
  return data;
}
export async function trainJutsu(move, times = 1) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); const r = o.trainJutsu(c, move, times); saveMock(c); return r; }
  const { data, error } = await sb.rpc('train_jutsu', { p_move: move, p_times: times });
  if (error) throw rpcErr(error);
  return data;
}

export async function updateAppearance(appearance) {
  if (OFFLINE) { const c = JSON.parse(sessionStorage.getItem('mockChar')); c.appearance = appearance; sessionStorage.setItem('mockChar', JSON.stringify(c)); return loadCharacter(); }
  const { error } = await sb.from('characters').update({ appearance }).eq('user_id', (await getUser()).id);
  if (error) throw error;
  return loadCharacter();
}
