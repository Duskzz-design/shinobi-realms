// Data layer: Supabase in production, an in-memory stand-in for offline testing (?offline).
export const SUPABASE_URL = 'https://azetseowvqyqhcnjzvnb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_wIQUai52KRMk3WTRCm4mzg_5itXxKF4';

const OFFLINE = new URLSearchParams(location.search).has('offline');
let sb = null;

export function isOffline() { return OFFLINE; }

export async function init() {
  if (OFFLINE) return;
  if (!window.supabase) throw new Error('Could not reach the game servers. Check your connection and refresh.');
  // tester mode keeps each tab's login separate, so two test ninjas can duel each other
  const tester = new URLSearchParams(location.search).has('tester');
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce', ...(tester ? { storage: window.sessionStorage, storageKey: 'sr-tester' } : {}) } });
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
// hidden tester entrance (?tester): a guest account with no password
export async function signInGuest() {
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
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
  if (OFFLINE) { const c = sessionStorage.getItem('mockChar'); if (!c) return null; const o = await import('./offline.js'); const x = JSON.parse(c); o.enrich(x); saveMock(x); return o.enrich(x); }
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

// ---------- rank exams ----------
export async function examInfo() {
  if (OFFLINE) { const o = await import('./offline.js'); return o.examInfo(mockChar()); }
  const { data, error } = await sb.rpc('exam_info'); if (error) throw rpcErr(error); return data;
}
let catalog = null, mockBattle = null;
const mockChar = () => JSON.parse(sessionStorage.getItem('mockChar'));
const saveMock = (c) => sessionStorage.setItem('mockChar', JSON.stringify(c));
const rpcErr = (error) => new Error((error.message || 'Something went wrong.').replace(/^.*?ERROR:\s*/, ''));
// all fights run on the battle server
async function battleCall(body) {
  const { data, error } = await sb.functions.invoke('battle', { body });
  if (error) {
    let msg = 'Could not reach the battle server. Try again.';
    try { const j = await error.context.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
export async function startExam() {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); mockBattle = o.mockStartExam(c); saveMock(c); return clone(mockBattle); }
  return battleCall({ op: 'exam' });
}
export async function examContinue(battleId) {
  if (OFFLINE) { const o = await import('./offline.js'); mockBattle = o.mockExamContinue(mockChar(), mockBattle); return clone(mockBattle); }
  return battleCall({ op: 'continue', battle: battleId });
}

// ---------- missions & combat ----------
const clone = (x) => JSON.parse(JSON.stringify({ ...x, m: undefined }));
export async function getCatalog() {
  if (catalog) return catalog;
  if (OFFLINE) { const o = await import('./offline.js'); return (catalog = { moves: o.MOVES, missions: o.MISSIONS }); }
  const [mv, ms] = await Promise.all([sb.from('moves').select('*').order('sort'), sb.from('missions').select('*').eq('kind', 'mission').order('sort')]);
  if (mv.error) throw mv.error; if (ms.error) throw ms.error;
  return (catalog = { moves: mv.data, missions: ms.data });
}
export async function startMission(id) {
  if (OFFLINE) { const o = await import('./offline.js'); mockBattle = o.mockStart(mockChar(), id); return clone(mockBattle); }
  return battleCall({ op: 'start', mission: id });
}
// action: {t:'move',to:[c,r]} | {t:'use',move,at:[c,r]} | {t:'end'} | {t:'flee'}
export async function battleAct(battleId, action) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); const r = o.mockAct(c, mockBattle, action); saveMock(c); return clone(r); }
  return battleCall({ op: 'act', battle: battleId, action });
}
export async function trainElement(element, times = 1) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); const r = o.trainElement(c, element, times); saveMock(c); return r; }
  const { data, error } = await sb.rpc('train_element', { p_element: element, p_times: times });
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

// ---------- live duels ----------
const duelCall = async (body) => { if (OFFLINE) { const o = await import('./offline.js'); return o.mockDuelOp(mockChar(), body); } return battleCall(body); };
export const duelChallenge = (target, kind = 'duel', war = null) => duelCall({ op: 'duel_challenge', target, kind, war });
export const duelAccept = (duel) => duelCall({ op: 'duel_accept', duel });
export const duelCancel = (duel) => duelCall({ op: 'duel_cancel', duel });
export const duelAct = (duel, action) => duelCall({ op: 'duel_act', duel, action });
export const duelTimeout = (duel, seq) => duelCall({ op: 'duel_timeout', duel, seq });
export const duelGet = (duel) => duelCall({ op: 'duel_get', duel });
// live updates of one duel row; returns an unsubscribe function
export function watchDuel(id, cb) {
  if (OFFLINE) { let off; import('./offline.js').then((o) => (off = o.mockWatch(id, cb))); return () => off && off(); }
  const ch = sb.channel('duel-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${id}` }, (m) => cb(m.new)).subscribe();
  return () => sb.removeChannel(ch);
}
// every duel I'm part of (new challenges to me, and answers to mine)
export async function watchMyDuels(myId, cb) {
  if (OFFLINE) { const o = await import('./offline.js'); return o.mockWatch('*', cb); }
  const { data } = await sb.auth.getSession(); if (data.session) sb.realtime.setAuth(data.session.access_token);
  const ch = sb.channel('my-duels-' + myId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `b=eq.${myId}` }, (m) => cb(m.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `a=eq.${myId}` }, (m) => cb(m.new)).subscribe();
  return () => sb.removeChannel(ch);
}
export async function myActiveDuel() {
  if (OFFLINE) return null;
  const { data } = await sb.from('duels').select('*').eq('status', 'active').gt('deadline', new Date(Date.now() - 5 * 60000).toISOString()).order('created_at', { ascending: false }).limit(1);
  return (data || [])[0] || null;
}

// ---------- arena leaderboards ----------
export async function arenaBoard(period, rank) {
  if (OFFLINE) { const o = await import('./offline.js'); return o.mockBoard(period, rank, mockChar()); }
  const { data, error } = await sb.rpc('arena_board', { p_period: period, p_rank: rank }); if (error) throw rpcErr(error); return data;
}
export async function arenaChampions() {
  if (OFFLINE) { const o = await import('./offline.js'); return o.mockChampions(); }
  const { data, error } = await sb.rpc('arena_champions'); if (error) throw rpcErr(error); return data || {};
}
// ---------- academy sparring lessons ----------
export async function getLessons() {
  if (OFFLINE) { const o = await import('./offline.js'); return o.LESSONS; }
  const { data, error } = await sb.from('missions').select('id,name,description,min_level,enemy_name,enemy_level,enemy_look,xp,ryo,sort').eq('kind', 'lesson').order('sort');
  if (error) throw rpcErr(error); return data;
}
export async function startLesson(id) {
  if (OFFLINE) { const o = await import('./offline.js'); const c = mockChar(); mockBattle = o.mockStartLesson(c, id); return clone(mockBattle); }
  return battleCall({ op: 'lesson', lesson: id });
}
export async function claimArenaReward() {
  if (OFFLINE) return new URLSearchParams(location.search).has('bonus') ? { place: 1, rank: 'Genin', ryo: 300, mult: 1.5 } : null;
  const { data, error } = await sb.rpc('claim_arena_reward'); if (error) return null; return data;
}
// ---------- world quests ----------
export async function getQuestData() {
  if (OFFLINE) { const o = await import('./offline.js'); return { lines: o.QUEST_LINES, steps: o.QUEST_STEPS }; }
  const [l, s] = await Promise.all([sb.from('quest_lines').select('*').order('sort'), sb.from('quest_steps').select('*').order('step')]);
  if (l.error) throw rpcErr(l.error); if (s.error) throw rpcErr(s.error);
  return { lines: l.data, steps: s.data };
}
export async function startQuest(line) {
  if (OFFLINE) { const o = await import('./offline.js'); mockBattle = o.mockStartQuest(mockChar(), line); return clone(mockBattle); }
  const { data, error } = await sb.rpc('start_quest', { p_line: line }); if (error) throw rpcErr(error);
  return battleCall({ op: 'get', battle: data.id });
}
// ---------- team boss fights ----------
const raidCall = async (body) => { if (OFFLINE) { const o = await import('./offline.js'); return o.mockRaidOp(mockChar(), body); } return battleCall(body); };
export const raidCreate = (line) => raidCall({ op: 'raid_create', line });
export const raidJoin = (raid) => raidCall({ op: 'raid_join', raid });
export const raidLeave = (raid) => raidCall({ op: 'raid_leave', raid });
export const raidStart = (raid) => raidCall({ op: 'raid_start', raid });
export const raidAct = (raid, action) => raidCall({ op: 'raid_act', raid, action });
export const raidTimeout = (raid, seq) => raidCall({ op: 'raid_timeout', raid, seq });
export async function raidLobbies(line) {
  if (OFFLINE) { const o = await import('./offline.js'); return o.mockLobbies(line); }
  const { data, error } = await sb.from('raids').select('*').eq('line', line).in('status', ['lobby', 'active']).gt('updated_at', new Date(Date.now() - 30 * 60000).toISOString()).order('created_at');
  if (error) throw rpcErr(error); return data || [];
}
export function watchRaid(id, cb) {
  if (OFFLINE) { let off; import('./offline.js').then((o) => (off = o.mockWatch(id, cb))); return () => off && off(); }
  const ch = sb.channel('raid-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'raids', filter: `id=eq.${id}` }, (m) => cb(m.new)).subscribe();
  return () => sb.removeChannel(ch);
}
export async function setTitle(title) {
  if (OFFLINE) return loadCharacter();
  const { data, error } = await sb.rpc('set_title', { p_title: title }); if (error) throw rpcErr(error); return data;
}

// ---------- village wars ----------
const vrpc = async (fn, args = {}) => {
  if (OFFLINE) { const o = await import('./offline.js'); return o.mockVillage(mockChar(), fn, args); }
  const { data, error } = await sb.rpc(fn, args); if (error) throw rpcErr(error); return data;
};
export const villageInfo = () => vrpc('village_info');
export const kageClaim = () => vrpc('kage_claim');
export const villageUpgrade = (building) => vrpc('village_upgrade', { p_building: building });
export const warDeclare = (territory) => vrpc('war_declare', { p_territory: territory });
export const warStatus = (war) => vrpc('war_status', { p_war: war });
export const warHold = (war) => vrpc('war_hold', { p_war: war });
export const warLeave = (war) => vrpc('war_leave', { p_war: war }).catch(() => {});

// ---------- sleep ----------
export async function setSleep(on) {
  if (OFFLINE) { const c = mockChar(); c.asleep_since = on ? new Date().toISOString() : null; saveMock(c); return loadCharacter(); }
  const { data, error } = await sb.rpc('set_sleep', { p_on: !!on }); if (error) throw rpcErr(error); return data;
}
