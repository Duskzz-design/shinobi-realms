import * as G from './engine.js';
// Offline test mode only (?offline): local copy of the server's rules and catalogue.
export const MOVES = Object.entries(G.MOVES).map(([id, m], i) => ({ id, name: m.name, style: m.style, tier: m.tier, power: m.power, stamina: m.stamina, chakra: m.chakra,
  acc: m.acc, crit: m.crit, element: m.element, bloodline: m.bloodline, range_min: m.range[0], range_max: m.range[1], aoe: m.aoe, ap: m.ap, target: m.target, description: m.desc, sort: i + 1 }));
const Q = (id, grade, name, description, min_level, min_rank, enemy_name, enemy_kind, enemy_level, enemy_hp, enemy_atk, enemy_def, enemy_look, xp, ryo, sort, enemy_kit = 'ninja', enemy_element = null) =>
  ({ id, grade, name, description, min_level, min_rank, enemy_name, enemy_kind, enemy_level, enemy_hp, enemy_atk, enemy_def, enemy_look, xp, ryo, sort, enemy_kit, enemy_element });
const foe = (m) => ({ hp: m.enemy_hp, atk: m.enemy_atk, def: m.enemy_def, kit: m.enemy_kit, element: m.enemy_element, level: m.enemy_level });
export const MISSIONS = [
  Q('d1', 'D', 'Lost Cat Rescue', 'A noble\'s cat climbed into the old watchtower. Something else is up there too.', 1, 0, 'Feral Tom', 'beast_cat', 1, 75, 20, 1, { tint: '#c8892f' }, 35, 30, 1, 'beast', null),
  Q('d2', 'D', 'Farm Field Pests', 'A giant boar is wrecking the rice fields outside the gate.', 1, 0, 'Field Boar', 'beast_boar', 2, 102, 20, 2, { tint: '#7a4a2a' }, 45, 40, 2, 'beast', null),
  Q('d3', 'D', 'Escort the Merchant', 'Bandits have been robbing carts on the forest road.', 2, 0, 'Road Bandit', 'ninja', 3, 130, 24, 3, { hairStyle: 1, hair: 1, skin: 2, outfit: 6, band: 1, bandSpot: 3 }, 60, 55, 3, 'ninja', 'earth'),
  Q('d4', 'D', 'Night Watch', 'Something has been howling near the village walls at night.', 3, 0, 'Shadow Wolf', 'beast_wolf', 4, 143, 30, 4, { tint: '#4a4a5a' }, 75, 60, 4, 'beast', null),
  Q('c1', 'C', 'Smugglers\' Cove', 'Smugglers are hiding stolen scrolls in a sea cave.', 5, 1, 'Smuggler Chief', 'ninja', 6, 172, 32, 6, { hairStyle: 0, hair: 4, skin: 3, outfit: 4, band: 2, bandSpot: 1 }, 120, 110, 10, 'ninja', 'water'),
  Q('c3', 'C', 'The Swamp Serpent', 'A huge snake is blocking the trade river.', 9, 1, 'Swamp Serpent', 'beast_snake', 10, 309, 51, 10, { tint: '#3a8a4a' }, 200, 170, 12, 'snake', null),
];
export const EXAMS = [
  Q('eg1', 'X', 'Genin Exam · Round 1', 'Prove your basics against the exam proctor.', 5, 0, 'Proctor Ume', 'ninja', 5, 157, 24, 5, { hairStyle: 3, hair: 7, skin: 1, outfit: 1, band: 0, bandSpot: 0 }, 0, 0, 100, 'ninja', 'wind'),
  Q('eg2', 'X', 'Genin Exam · Round 2', 'Survive Sensei Hiro\'s final test.', 5, 0, 'Sensei Hiro', 'ninja', 6, 174, 26, 7, { hairStyle: 1, hair: 6, skin: 2, outfit: 4, band: 0, bandSpot: 0 }, 0, 0, 101, 'ranged', 'earth'),
  Q('ec1', 'X', 'Chunin Exam · Forest of Thorns', 'Cross the forest. Something huge guards the scroll.', 15, 1, 'Thorn Serpent', 'beast_snake', 15, 360, 47, 15, { tint: '#5a3a6a' }, 0, 0, 110, 'snake', null),
  Q('ec2', 'X', 'Chunin Exam · Preliminaries', 'Duel a rival Genin from another village.', 15, 1, 'Rival Sayo', 'ninja', 16, 415, 51, 18, { hairStyle: 4, hair: 4, skin: 0, outfit: 7, band: 2, bandSpot: 2 }, 0, 0, 111, 'ninja', 'lightning'),
  Q('ec3', 'X', 'Chunin Exam · Finals', 'The whole village is watching the final bout.', 15, 1, 'Taro the Iron Fist', 'ninja', 17, 499, 55, 21, { hairStyle: 0, hair: 5, skin: 3, outfit: 5, band: 1, bandSpot: 1 }, 0, 0, 112, 'ranged', 'water'),
];
const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
let lastExamFail = 0;
export function examInfo(c) {
  const ri = Math.max(0, RANKS.indexOf(c.rank)), nxt = RANKS[ri + 1] || null;
  return { next_rank: nxt, level: c.level, needed_level: LCAP[ri], ready: !!nxt && c.level >= LCAP[ri], wait_seconds: Math.max(0, 300 - Math.floor((Date.now() - lastExamFail) / 1000)),
    rounds: EXAMS.filter((e) => e.min_rank === ri).map((e) => ({ id: e.id, name: e.name, description: e.description, enemy: e.enemy_name, enemy_level: e.enemy_level })) };
}
function examBattle(c, round, pools) {
  const x = enrich(c), ri = x.rank_index, list = EXAMS.filter((e) => e.min_rank === ri), m = list[round - 1];
  const st = { php: Math.min(x.hp_max, pools.php), pmax: x.hp_max, pst: Math.min(x.stamina_max, pools.pst), pstmax: x.stamina_max, pch: Math.min(x.chakra_max, pools.pch), pchmax: x.chakra_max,
    foe: foe(m), enemy: { name: m.enemy_name, kind: m.enemy_kind, level: m.enemy_level, look: m.enemy_look, element: m.enemy_element },
    mission: { id: m.id, name: m.name, grade: 'X', xp: 0, ryo: 0 }, exam: { to: RANKS[ri + 1], round, rounds: list.length } };
  return hexInit(c, { id: 'b' + Date.now(), status: 'active', state: st, m });
}
export function mockStartExam(c) {
  const i = examInfo(c); if (!i.next_rank) throw new Error('You are already a Jonin.');
  if (!i.ready) throw new Error(`You must reach level ${i.needed_level} before taking the ${i.next_rank} exam.`);
  if (i.wait_seconds > 0 && lastExamFail) throw new Error(`Rest before retrying: ${i.wait_seconds} more seconds.`);
  const x = enrich(c); return examBattle(c, 1, { php: x.hp_max, pst: x.stamina_max, pch: x.chakra_max });
}
export function mockExamContinue(c, b) {
  const st = b.state; if (b.status !== 'won' || !st.exam || st.continued) throw new Error('Cannot continue this exam.'); st.continued = true;
  return examBattle(c, st.exam.round + 1, { php: st.php + Math.round(0.3 * st.pmax), pst: st.pst + Math.round(0.3 * st.pstmax), pch: st.pch + Math.round(0.3 * st.pchmax) });
}
const LCAP = [5, 15, 30, 60], SCAP = [20, 50, 100, 200];
const R = Math.random;
const TM = [0.4, 1, 1.5, 2.5];
const tierOf = (id) => (MOVES.find((m) => m.id === id) || { tier: 0 }).tier;
const jnext = (lv, id) => Math.round((3 + lv * 2) * 10 * TM[tierOf(id)]);
export const pointCost = (v) => v < 10 ? 40 : v < 15 ? 120 : v < 20 ? 200 : v < 50 ? 200 + 5 * (v - 20) : v < 100 ? 350 + 2 * (v - 50) : 450 + (v - 100);

export function enrich(c) {
  enrichEl(c); c.element2_prog = c.element2_prog || 0;
  const ri = Math.max(0, RANKS.indexOf(c.rank));
  c.energy_at = c.energy_at || Date.now();
  const energy = Math.min(100, c.energy + Math.floor((Date.now() - c.energy_at) / 9000));
  c.jutsu = c.jutsu || {};
  for (const k in c.jutsu) c.jutsu[k].next = jnext(c.jutsu[k].level, k);
  const bonus = new URLSearchParams(location.search).has('bonus') ? { place: 1, mult: 1.5 } : null;
  return { ...c, energy, energy_max: 100, energy_regen_sec: bonus ? 6 : 9, arena_bonus: bonus, hp_max: 80 + c.level * 10 + c.strength * 4 + c.willpower,
    stamina_max: 40 + c.level * 3 + c.strength * 2 + c.agility * 2, chakra_max: 40 + c.level * 3 + c.intelligence * 2 + c.willpower * 2,
    stat_cap: SCAP[ri], level_cap: LCAP[ri], rank_index: ri, train_energy: 10, train_prog: c.train_prog || {},
    point_cost: { strength: pointCost(c.strength), agility: pointCost(c.agility), intelligence: pointCost(c.intelligence), willpower: pointCost(c.willpower) } };
}
function gain(c, id, n) {
  const j = c.jutsu[id] || (c.jutsu[id] = { level: 1, xp: 0 }); let up = 0;
  if (j.level >= 10) return { level: 10, up: 0 };
  j.xp += n; while (j.level < 10 && j.xp >= jnext(j.level, id)) { j.xp -= jnext(j.level, id); j.level++; up++; }
  return { level: j.level, up };
}
function takeEnergy(c, times) { const e = enrich(c).energy, n = Math.min(Math.max(1, times), Math.floor(e / 10)); if (n < 1) throw new Error('Not enough energy. It refills over time.'); c.energy = e - n * 10; c.energy_at = Date.now(); return n; }
export function trainStat(c, s, times = 1) {
  const x = enrich(c); if (c[s] >= x.stat_cap) throw new Error('That stat is at the cap for your rank. Rank up to train further.');
  const e = x.energy, n = Math.min(Math.max(1, times), Math.floor(e / 10)); if (n < 1) throw new Error('Not enough energy. It refills over time.');
  c.train_prog = c.train_prog || {}; let prog = c.train_prog[s] || 0, gained = 0, used = 0;
  for (let i = 0; i < n && c[s] < x.stat_cap; i++) { prog += 10; used++; if (prog >= pointCost(c[s])) { prog -= pointCost(c[s]); c[s]++; gained++; } }
  if (c[s] >= x.stat_cap) prog = 0;
  c.train_prog[s] = prog; c.energy = e - used * 10; c.energy_at = Date.now();
  return { ...enrich(c), gained };
}
export function trainElement(c, el, times = 1) {
  const x = enrich(c); if (x.rank_index < 2) throw new Error('You can learn a second element once you are a Chunin.');
  if (c.element2) throw new Error('You already command two elements.'); if (el === c.element) throw new Error('Choose a different element.');
  let prog = c.element2_target === el ? c.element2_prog || 0 : 0; const n = Math.min(Math.max(1, times), Math.floor(x.energy / 10), Math.ceil((1000 - prog) / 10));
  if (n < 1) throw new Error('Not enough energy. It refills over time.');
  prog += n * 10; c.energy = x.energy - n * 10; c.energy_at = Date.now(); c.element2_target = el;
  if (prog >= 1000) { c.element2 = el; c.element2_prog = 0; } else c.element2_prog = prog;
  return { ...enrich(c), element_learned: !!c.element2 };
}
export function trainJutsu(c, id, times = 1) { const x = enrich(c); if (!G.knownMoves({ rankIndex: x.rank_index, elements: [c.element, c.element2].filter(Boolean), bloodline: c.bloodline }).includes(id)) throw new Error('You cannot learn that jutsu yet.'); const n = takeEnergy(c, times); const g = gain(c, id, n * 4); return { ...enrich(c), trained: g }; }

function hexInit(c, b) {
  const jl = {}; for (const k in c.jutsu || {}) jl[k] = c.jutsu[k].level;
  b.state.engine = G.newBattle({ seed: (Math.random() * 2 ** 32) >>> 0, a: G.playerSpec(enrichEl(c), jl, b.state), b: G.enemySpec(b.state), aStarts: true });
  b.state.used = {};
  return b;
}
const enrichEl = (c) => { if (!c.element) c.element = G.ELEMENTS[Math.floor(Math.random() * 5)]; return c; };
export function mockStart(c, mid) {
  const m = MISSIONS.find((x) => x.id === mid), x = enrich(c);
  if (x.rank_index < m.min_rank) throw new Error('Your rank is too low for this mission.');
  if (c.level < m.min_level) throw new Error(`You need to be level ${m.min_level} for this mission.`);
  const st = { php: x.hp_max, pmax: x.hp_max, pst: x.stamina_max, pstmax: x.stamina_max, pch: x.chakra_max, pchmax: x.chakra_max, foe: foe(m),
    enemy: { name: m.enemy_name, kind: m.enemy_kind, level: m.enemy_level, look: m.enemy_look, element: m.enemy_element }, mission: { id: m.id, name: m.name, grade: m.grade, xp: m.xp, ryo: m.ryo } };
  return hexInit(c, { id: 'b' + Date.now(), status: 'active', state: st, m });
}
// same flow as the battle server
export function mockAct(c, b, action) {
  if (b.status !== 'active') throw new Error('This fight is over.');
  const s = b.state.engine, events = G.act(s, 'a', action);
  if (action.t === 'use') b.state.used[action.move] = (b.state.used[action.move] || 0) + 1;
  if (s.status === 'active' && s.side === 'b') events.push(...G.aiTurn(s, 'b', 14));
  if (s.status === 'active' && s.side === 'b') events.push(...G.act(s, 'b', { t: 'end' }));
  let result = null, status = 'active';
  if (s.status === 'over') {
    const win = s.winner === 'a', p = s.units.a;
    status = action.t === 'flee' ? 'fled' : win ? 'won' : 'lost';
    Object.assign(b.state, { php: p.hp, pst: p.st, pch: p.ch });
    if (status !== 'fled') result = finish(c, b, win);
    else if (b.state.exam) lastExamFail = Date.now();
  }
  b.status = status;
  return { id: b.id, status, state: b.state, events, result };
}
function finish(c, b, win) {
  const st = b.state, m = b.m, ups = {};
  for (const [k, n] of Object.entries(st.used)) if (G.MOVES[k] && G.MOVES[k].style !== 'none') { const g = gain(c, k, 3 * Math.min(n, 40)); if (g.up) ups[k] = g.level; }
  let r;
  if (m.kind === 'lesson') {
    c.lessons_done = c.lessons_done || []; const first = win && !c.lessons_done.includes(m.id), before = c.level, cap = LCAP[RANKS.indexOf(c.rank)];
    if (first) { c.lessons_done.push(m.id); c.xp += m.xp; c.ryo += m.ryo; while (c.level < cap && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; } }
    r = { lesson: true, first, xp: first ? m.xp : 0, ryo: first ? m.ryo : 0, level: c.level, leveled: c.level - before };
  } else if (win && st.exam) {
    if (st.exam.round < st.exam.rounds) r = { exam_round: st.exam.round, exam_rounds: st.exam.rounds, next: true };
    else {
      const ryo = { Genin: 200, Chunin: 600, Jonin: 1500 }[st.exam.to]; let bl = null;
      const force = new URLSearchParams(location.search).get('bloodline');
      if (st.exam.to === 'Genin' && !c.bloodline && (force || Math.random() < 0.01)) bl = force && G.BLOODLINES[force] ? force : Object.keys(G.BLOODLINES)[Math.floor(Math.random() * 5)];
      c.rank = st.exam.to; c.ryo += ryo; c.energy = 100; c.energy_at = Date.now(); if (bl) c.bloodline = bl;
      r = { promoted: st.exam.to, ryo, exam_round: st.exam.round, exam_rounds: st.exam.rounds, bloodline_test: st.exam.to === 'Genin', bloodline: bl };
    }
  } else if (win) {
    const before = c.level, cap = LCAP[RANKS.indexOf(c.rank)];
    c.xp += m.xp; c.ryo += m.ryo;
    while (c.level < cap && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; }
    if (c.level >= cap) c.xp = Math.min(c.xp, c.level * 100);
    if (c.level > before) { c.energy = 100; c.energy_at = Date.now(); }
    r = { xp: m.xp, ryo: m.ryo, level: c.level, leveled: c.level - before, capped: c.level >= cap };
    if (st.quest) r.quest = questAdvance(c, st.quest);
  } else if (st.exam) { lastExamFail = Date.now(); r = { ryo_lost: 0 }; }
  else { const lost = Math.min(c.ryo, Math.round(m.ryo * 0.2)); c.ryo -= lost; r = { ryo_lost: lost }; }
  return { ...r, jutsu_up: ups };
}

// ---------- offline duels against a bot ----------
const watchers = new Set();
let duel = null, botTimer = null;
const emit = () => { const d = JSON.parse(JSON.stringify(duel)); for (const w of watchers) if (w.id === '*' || w.id === d.id) w.cb(d); };
export function mockWatch(id, cb) { const w = { id, cb }; watchers.add(w); return () => watchers.delete(w); }
const botChar = (name, level) => ({ user_id: 'bot-' + name, name, rank: level >= 5 ? 'Genin' : 'Academy Student', level, element: G.ELEMENTS[name.length % 5], strength: 8 + level, agility: 8 + level, intelligence: 8 + level, willpower: 8 + level, appearance: { hairStyle: 2, hair: 3, skin: 2, outfit: 5, band: 1, bandSpot: 0 } });
function botPlays() {
  clearTimeout(botTimer);
  if (!duel || duel.status !== 'active') return;
  const s = duel.state.engine, bot = duel.a.startsWith('bot') ? 'a' : 'b';
  if (s.side !== bot) return;
  botTimer = setTimeout(() => {
    s.seed = (Math.random() * 2 ** 32) >>> 0;
    const ev = G.aiTurn(s, bot, 14); if (s.status === 'active' && s.side === bot) ev.push(...G.act(s, bot, { t: 'end' }));
    step(ev);
  }, new URLSearchParams(location.search).has('slowbot') ? 70000 : 1800);
}
function step(events, reason = null) {
  const s = duel.state.engine; delete s.seed;
  duel.state.events = events; duel.seq++;
  if (events.some((e) => e.t === 'turn')) duel.deadline = new Date(Date.now() + 60000).toISOString();
  if (s.status === 'over') { duel.status = 'over'; duel.winner = s.winner === 'a' ? duel.a : duel.b; duel.reason = reason || 'ko'; duel.points = { gain: 15, loss: 0 }; }
  emit(); botPlays();
}
export function mockDuelOp(c, body) {
  const me = c.user_id;
  if (body.op === 'duel_challenge') {
    const name = { bot0: 'Ren', bot1: 'Mika', bot2: 'Sora' }[body.target] || 'Rival';
    duel = { id: 'duel' + Date.now(), a: me, b: 'bot-' + name, a_name: c.name, b_name: name, status: 'pending', seq: 0, misses: { a: 0, b: 0 }, deadline: new Date(Date.now() + 60000).toISOString(), state: null };
    const b = botChar(name, 4);
    setTimeout(() => { if (duel.status !== 'pending') return;
      duel.state = { engine: G.newDuel(1 + ((Math.random() * 1e9) | 0), c, {}, b, {}), events: [] }; delete duel.state.engine.seed;
      duel.status = 'active'; duel.seq = 1; duel.deadline = new Date(Date.now() + 60000).toISOString(); emit(); botPlays(); }, 1500);
    return JSON.parse(JSON.stringify(duel));
  }
  if (body.op === 'duel_cancel') { duel.status = 'cancelled'; emit(); return duel; }
  if (body.op === 'duel_invite') { // test hook: a bot challenges me
    const b = botChar('Kaito', 3);
    duel = { id: 'duel' + Date.now(), a: b.user_id, b: me, a_name: 'Kaito', b_name: c.name, status: 'pending', seq: 0, misses: { a: 0, b: 0 }, deadline: new Date(Date.now() + 60000).toISOString(), state: null, _bot: b };
    emit(); return duel;
  }
  if (body.op === 'duel_accept') {
    duel.state = { engine: G.newDuel(7 + ((Math.random() * 1e9) | 0), duel._bot, {}, enrich(c), {}), events: [] }; delete duel.state.engine.seed;
    duel.status = 'active'; duel.seq = 1; duel.deadline = new Date(Date.now() + 60000).toISOString(); emit(); botPlays(); return JSON.parse(JSON.stringify(duel));
  }
  if (body.op === 'duel_act' || body.op === 'duel_timeout') {
    const s = duel.state.engine, my = duel.a === me ? 'a' : 'b';
    if (body.op === 'duel_timeout') { if (Date.now() < new Date(duel.deadline).getTime() + 1500) return duel; const late = s.side; duel.misses[late]++; const ev = [{ t: 'timeout', who: late, n: duel.misses[late] }];
      s.seed = 5; if (duel.misses[late] >= 3) ev.push(...G.act(s, late, { t: 'flee' })); else ev.push(...G.act(s, late, { t: 'end' })); step(ev, 'timeout'); return JSON.parse(JSON.stringify(duel)); }
    const a = body.action; if (a.t !== 'flee' && s.side !== my) throw new Error('Wait for your turn.');
    if (a.t === 'flee') s.side = my;
    s.seed = (Math.random() * 2 ** 32) >>> 0;
    const ev = G.act(s, my, a); duel.misses[my] = 0; step(ev, a.t === 'flee' ? 'forfeit' : null);
    return JSON.parse(JSON.stringify(duel));
  }
  return duel;
}

// ---------- offline arena boards ----------
const NAMES = ['Ren', 'Mika', 'Sora', 'Kaito', 'Yumi', 'Haru', 'Aki', 'Nori', 'Tama', 'Riku', 'Suzu', 'Ken'];
const fakeLook = (i) => ({ hairStyle: i % 5, hair: (i * 3) % 8, skin: i % 6, outfit: (i * 5) % 8, band: i % 3, bandSpot: i % 3 });
export function mockBoard(period, rank, c) {
  const n = period === 'month' ? 12 : rank === 'Jonin' ? 0 : 8, mult = period === 'month' ? 9 : 1;
  const rows = Array.from({ length: n }, (_, i) => ({ place: i + 1, points: (n - i) * 15 * mult, name: NAMES[i], village: ['pine', 'dune', 'tide'][i % 3], level: 6 + i, look: fakeLook(i), me: false }));
  if (c && c.rank === rank && n > 4) { rows[3] = { ...rows[3], name: c.name, village: c.village, look: c.appearance, me: true }; }
  const d = new Date(); d.setHours(24, 0, 0, 0);
  return { rows, me: rows.find((r) => r.me) || null, ends_at: d.toISOString(), period, rank };
}
export function mockChampions() {
  return { Genin: { name: 'Mika', village: 'tide', look: fakeLook(1), points: 345, level: 12 }, Chunin: { name: 'Kaito', village: 'dune', look: fakeLook(3), points: 1210, level: 27 } };
}

// ---------- offline sparring lessons (mirror of the server) ----------
const LL = (id, name, description, min_level, enemy_name, enemy_level, atk, look, xp, ryo, el, moves, ranged) => ({ id, name, description, min_level, enemy_name, enemy_level, atk, enemy_look: look, xp, ryo, el, moves, ranged });
export const LESSONS = [
  LL('l1', 'Lesson 1 · Footwork', 'Blue hexes show where you can move, 1 AP per step. Palm Strike needs you right next to your foe; Kunai reaches 3 hexes. Press End turn when you are done.', 1, 'Hana', 1, 5, { hairStyle: 4, hair: 2, skin: 1, outfit: 3, band: 0, bandSpot: 0 }, 30, 20, null, ['palm', 'kunai', 'guard', 'focus'], false),
  LL('l2', 'Lesson 2 · Chakra Natures', 'Kenji\'s element is weak to yours. Use your element jutsu for "Super effective" hits, and tap him to check his element.', 1, 'Kenji', 1, 5, { hairStyle: 0, hair: 5, skin: 2, outfit: 6, band: 1, bandSpot: 1 }, 30, 20, 'weak', ['palm', 'kunai', 'ELEM', 'focus'], false),
  LL('l3', 'Lesson 3 · Cover', 'Rin fights from range. Rocks block thrown and cast attacks: step behind one, then close the gap.', 2, 'Rin', 2, 6, { hairStyle: 2, hair: 7, skin: 0, outfit: 1, band: 2, bandSpot: 0 }, 40, 30, null, ['kunai', 'mist', 'focus', 'guard'], true),
  LL('l4', 'Lesson 4 · Buffs and Debuffs', 'Daichi confuses foes with Mist Veil and braces with Guard. Watch the status icons, use Focus when low, and strike when his armour is down.', 2, 'Daichi', 2, 5, { hairStyle: 1, hair: 1, skin: 4, outfit: 5, band: 0, bandSpot: 2 }, 50, 40, 'random', ['palm', 'kunai', 'mist', 'ELEM', 'focus', 'guard'], false),
  LL('l5', 'Lesson 5 · Graduation Spar', 'Aya\'s element beats yours, just like a tough Arena rival. Win with range, cover and smart use of AP.', 3, 'Aya', 3, 5, { hairStyle: 3, hair: 4, skin: 1, outfit: 0, band: 1, bandSpot: 0 }, 80, 80, 'strong', ['palm', 'kunai', 'mist', 'ELEM', 'focus', 'guard'], false),
];
export function mockStartLesson(c, id) {
  const L = LESSONS.find((x) => x.id === id), x = enrich(c), E5 = G.ELEMENTS, i = E5.indexOf(x.element);
  if (c.level < L.min_level) throw new Error(`You need to be level ${L.min_level} for this lesson.`);
  const el = L.el === 'weak' ? E5[(i + 1) % 5] : L.el === 'strong' ? E5[(i + 4) % 5] : L.el === 'random' ? E5[(Math.random() * 5) | 0] : null;
  const elemMove = el ? Object.keys(G.MOVES).find((k) => G.MOVES[k].element === el && G.MOVES[k].tier === 0) : null;
  const st = { php: x.hp_max, pmax: x.hp_max, pst: x.stamina_max, pstmax: x.stamina_max, pch: x.chakra_max, pchmax: x.chakra_max,
    foe: { kit: 'student', atk: L.atk, level: L.enemy_level, element: el, moves: L.moves.map((m) => (m === 'ELEM' ? elemMove : m)), ranged: L.ranged },
    enemy: { name: L.enemy_name, kind: 'ninja', level: L.enemy_level, look: L.enemy_look, element: el },
    mission: { id: L.id, name: L.name, grade: 'L', xp: L.xp, ryo: L.ryo, description: L.description }, lesson: true };
  return hexInit(c, { id: 'b' + Date.now(), status: 'active', state: st, m: { ...L, kind: 'lesson' } });
}

// ---------- offline quests (mirror of the server tables) ----------
export const QUEST_LINES = [
  { id: 'iron', name: 'The Iron Bandits', description: '', min_rank: 2, lair: 'stronghold', boss_name: 'Warlord Gorou', reward: 'riches', sort: 1 },
  { id: 'serpent', name: "The Serpent's Coil", description: '', min_rank: 2, lair: 'serpent_cave', boss_name: 'Venomfang the Cave Wyrm', reward: 'scroll', sort: 2 },
  { id: 'shrine', name: 'Shadow of the Fallen Shrine', description: '', min_rank: 3, lair: 'shadow_fortress', boss_name: 'The Hollow Shogun', reward: 'title', sort: 3 },
];
const QS = (line, step, kind, title, story, location, mission_id, need) => ({ line, step, kind, title, story, location, mission_id, need });
export const QUEST_STEPS = [
  QS('iron', 1, 'fight', 'Ambush on the Road', 'Merchants on the Bandit Road keep vanishing. Ride with the next caravan and catch the ambushers in the act.', 'bandit_road', 'qa1', 1),
  QS('iron', 2, 'hunt', 'Thin Their Ranks', 'The scout talked: a raider camp guards the road. Defeat 3 Bandit Raiders.', 'bandit_road', 'qa2', 3),
  QS('iron', 3, 'fight', 'The Watchtower Lieutenant', 'The raiders answer to a lieutenant hiding in the Old Watchtower.', 'watchtower', 'qa3', 1),
  QS('serpent', 1, 'hunt', 'Gather Moonherbs', 'Defeat 3 Marsh Vipers and gather the Moonherbs they guard.', 'misty_marsh', 'qb1', 3),
  QS('serpent', 2, 'fight', 'The Swamp Witch', 'A witch has been breeding the vipers. Find her deep in the marsh.', 'misty_marsh', 'qb2', 1),
  QS('serpent', 3, 'fight', 'The Coil Cultist', 'Defeat the cult leader in the Whispering Woods.', 'whispering_woods', 'qb3', 1),
  QS('shrine', 1, 'fight', 'Restless Spirits', 'Lights burn at the ruined shrine every night.', 'ruined_shrine', 'qc1', 1),
  QS('shrine', 2, 'hunt', 'Ash Wolves', 'Defeat 3 Ash Wolves blocking the pass.', 'ashen_peak', 'qc2', 3),
  QS('shrine', 3, 'fight', "The Shogun's Herald", 'The herald guards the Shadow Fortress gate.', 'ashen_peak', 'qc3', 1),
];
const QM = { qa1: ['Bandit Scout', 'ninja', 17, 673, 79, 14, 'ranged', null], qa2: ['Bandit Raider', 'ninja', 16, 331, 80, 14, 'ninja', 'earth'], qa3: ['Lieutenant Senzo', 'ninja', 21, 866, 86, 18, 'ninja', 'wind'],
  qb1: ['Marsh Viper', 'beast_snake', 16, 334, 75, 14, 'snake', null], qb2: ['Swamp Witch Mirei', 'ninja', 19, 732, 84, 16, 'ranged', 'water'], qb3: ['Cult Leader Jabami', 'ninja', 23, 955, 92, 20, 'ninja', 'fire'],
  qc1: ['Shrine Wraith', 'ninja', 31, 2152, 154, 28, 'ninja', 'lightning'], qc2: ['Ash Wolf', 'beast_wolf', 31, 1107, 170, 28, 'beast', null], qc3: ['Herald Kurogane', 'ninja', 35, 2995, 174, 32, 'ranged', 'wind'] };
export function mockStartQuest(c, line) {
  const x = enrich(c), L = QUEST_LINES.find((l) => l.id === line); if (x.rank_index < L.min_rank) throw new Error('Only Chunin or higher may take this quest.');
  const p = (c.quests || {})[line] || {}, cur = p.step || 1, qs = QUEST_STEPS.find((s) => s.line === line && s.step === cur), [n, kind, lv, hp, atk, def, kit, el] = QM[qs.mission_id];
  const look = kind === 'ninja' ? { hairStyle: lv % 5, hair: lv % 8, skin: lv % 6, outfit: 4, band: 2, bandSpot: 0 } : { tint: '#5a5050' };
  const m = { id: qs.mission_id, xp: 200, ryo: 150, kind: 'quest' };
  const st = { php: x.hp_max, pmax: x.hp_max, pst: x.stamina_max, pstmax: x.stamina_max, pch: x.chakra_max, pchmax: x.chakra_max,
    foe: { hp, atk, def, kit, element: el, level: lv }, enemy: { name: n, kind, level: lv, look, element: el },
    mission: { id: m.id, name: qs.title, grade: 'Q', xp: m.xp, ryo: m.ryo, description: qs.story }, quest: { line, step: cur, need: qs.need, count: p.count || 0, kind: qs.kind } };
  return hexInit(c, { id: 'b' + Date.now(), status: 'active', state: st, m });
}
function questAdvance(c, q) {
  c.quests = c.quests || {}; const p = c.quests[q.line] || { step: 1, count: 0 }; if ((p.step || 1) !== q.step) return null;
  const max = Math.max(...QUEST_STEPS.filter((s) => s.line === q.line).map((s) => s.step)); let cnt = (p.count || 0) + 1, cur = p.step || 1, done = false;
  if (cnt >= q.need) { cur++; cnt = 0; } if (cur > max) { done = true; cur = max; }
  c.quests[q.line] = { step: cur, count: cnt, done }; return { ...c.quests[q.line], line: q.line };
}

// ---------- offline boss fights: you plus two AI teammates ----------
let raid = null, raidTimer = null;
const remit = () => { const d = JSON.parse(JSON.stringify(raid)); for (const w of watchers) if (w.id === '*' || w.id === d.id) w.cb(d); };
export function mockLobbies() { return raid && ['lobby', 'active'].includes(raid.status) ? [JSON.parse(JSON.stringify(raid))] : []; }
function raidStep(events) {
  const s = raid.state.engine; delete s.seed; raid.state.events = events; raid.seq++;
  if (events.some((e) => e.t === 'turn')) raid.deadline = new Date(Date.now() + 60000).toISOString();
  if (s.status === 'over') { raid.status = 'over'; raid.winner = s.winner; raid.rewards = { [raid.leader]: s.winner === 'A' ? { win: true, xp: 900, ryo: 1200, claims_left: 2, scroll: raid.line === 'serpent' ? 'serpentfang' : null, title: raid.line === 'shrine' ? 'Shogun Slayer' : null } : { win: false } }; }
  remit(); raidAI();
}
function raidAI() {
  clearTimeout(raidTimer);
  if (!raid || raid.status !== 'active') return;
  const s = raid.state.engine, u = s.units[s.side];
  if (u.uid === raid.leader) return;
  raidTimer = setTimeout(() => { s.seed = (Math.random() * 2 ** 32) >>> 0; const ev = G.aiTurn(s, s.side, 16); if (s.status === 'active' && s.side === u.id) ev.push(...G.act(s, u.id, { t: 'end' })); raidStep(ev); }, 1500);
}
export function mockRaidOp(c, body) {
  const me = c.user_id, x = enrich(c);
  if (body.op === 'raid_create') { raid = { id: 'raid' + Date.now(), line: body.line, leader: me, status: 'lobby', seq: 0, misses: {}, members: [{ id: me, name: c.name, level: c.level, rank: c.rank, element: x.element }], state: null };
    setTimeout(() => { if (raid.status !== 'lobby') return; raid.members.push({ id: 'ally1', name: 'Ren', level: c.level, rank: c.rank, element: 'fire' }); raid.seq++; remit(); }, 1200);
    setTimeout(() => { if (raid.status !== 'lobby') return; raid.members.push({ id: 'ally2', name: 'Mika', level: c.level, rank: c.rank, element: 'water' }); raid.seq++; remit(); }, 2400);
    return JSON.parse(JSON.stringify(raid)); }
  if (body.op === 'raid_leave') { raid.status = 'closed'; remit(); return raid; }
  if (body.op === 'raid_start') {
    const specs = raid.members.map((m) => (m.id === me ? G.playerSpec(x, {}, G.poolsOf(x)) : { ...G.playerSpec({ ...botChar(m.name, c.level), rank: c.rank, element: m.element, strength: x.strength, agility: x.agility, intelligence: x.intelligence, willpower: x.willpower }, {}, G.poolsOf({ ...x })), uid: m.id, name: m.name }));
    specs[0].uid = me;
    raid.state = { engine: G.newRaid({ seed: (Math.random() * 2 ** 32) >>> 0, players: specs, boss: G.bossSpec(raid.line, specs.length) }), events: [] }; delete raid.state.engine.seed;
    raid.status = 'active'; raid.seq++; raid.deadline = new Date(Date.now() + 60000).toISOString(); remit(); raidAI(); return JSON.parse(JSON.stringify(raid));
  }
  if (body.op === 'raid_act') {
    const s = raid.state.engine, my = Object.values(s.units).find((u) => u.uid === me);
    if (body.action.t !== 'flee' && s.side !== my.id) throw new Error('Wait for your turn.');
    s.seed = (Math.random() * 2 ** 32) >>> 0; const ev = G.act(s, my.id, body.action);
    let g = 0; while (s.status === 'active' && s.units[s.side].npc && g++ < 3) { ev.push(...G.aiTurn(s, s.side, 16)); if (s.status === 'active' && s.units[s.side].npc) ev.push(...G.act(s, s.side, { t: 'end' })); }
    raidStep(ev); return JSON.parse(JSON.stringify(raid));
  }
  return raid;
}
