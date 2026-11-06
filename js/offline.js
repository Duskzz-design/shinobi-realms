// Offline test mode only (?offline): local copy of the server's rules and catalogue.
const M = (id, style, tier, power, stamina, chakra, acc, crit, effect, chance, name, description, sort) => ({ id, style, tier, power, stamina, chakra, acc, crit, effect, effect_chance: chance, name, description, sort });
export const MOVES = [
  M('palm', 'taijutsu', 0, 13, 4, 0, .95, .05, null, 0, 'Palm Strike', 'A quick open-palm blow.', 10),
  M('whirl', 'taijutsu', 1, 20, 8, 0, .9, .08, null, 0, 'Whirlwind Kick', 'A spinning kick that hits hard.', 11),
  M('hundred', 'taijutsu', 2, 30, 14, 2, .9, .1, null, 0, 'Hundred Fists', 'A storm of punches.', 12),
  M('ironbody', 'taijutsu', 3, 44, 20, 6, .88, .12, null, 0, 'Iron Body Rush', 'Harden your body and charge.', 13),
  M('flame', 'ninjutsu', 0, 24, 2, 10, .9, .05, null, 0, 'Flame Burst', 'Breathe a ball of fire.', 20),
  M('lance', 'ninjutsu', 1, 30, 3, 14, .92, .05, null, 0, 'Water Lance', 'A spear of pressurised water.', 21),
  M('spear', 'ninjutsu', 2, 42, 4, 20, .9, .08, null, 0, 'Lightning Spear', 'Crackling chakra pierces armour.', 22),
  M('dragon', 'ninjutsu', 3, 58, 6, 28, .88, .08, null, 0, 'Earth Dragon', 'A dragon of stone erupts from the ground.', 23),
  M('mist', 'genjutsu', 0, 8, 1, 8, 1, 0, 'confuse', 1, 'Mist Veil', 'Clouds their senses: they will likely miss next turn.', 30),
  M('petal', 'genjutsu', 1, 16, 2, 12, .95, .03, 'stun', .5, 'Petal Illusion', 'Swirling petals may freeze them for a turn.', 31),
  M('nightmare', 'genjutsu', 2, 26, 3, 18, .95, .03, 'stun', .65, 'Nightmare Bind', 'Trap them in a waking nightmare.', 32),
  M('mirror', 'genjutsu', 3, 38, 4, 26, .95, .05, 'confuse', 1, 'Mirror World', 'They fight their own reflection.', 33),
  M('kunai', 'bukijutsu', 0, 15, 3, 0, .97, .15, null, 0, 'Kunai Throw', 'Reliable thrown blade, often critical.', 40),
  M('shuriken', 'bukijutsu', 1, 22, 6, 0, .95, .18, null, 0, 'Shuriken Storm', 'A spray of spinning stars.', 41),
  M('tag', 'bukijutsu', 2, 34, 6, 4, .9, .15, null, 0, 'Explosive Tag', 'A paper tag that goes boom.', 42),
  M('blade', 'bukijutsu', 3, 48, 12, 4, .92, .25, null, 0, 'Blade Dance', 'A flurry of twin-blade cuts.', 43),
  M('focus', 'none', 0, 0, 0, 0, 1, 0, 'focus', 1, 'Focus', 'Breathe. Restore stamina and chakra.', 90),
];
const Q = (id, grade, name, description, min_level, min_rank, enemy_name, enemy_kind, enemy_level, enemy_hp, enemy_atk, enemy_def, enemy_look, xp, ryo, sort) =>
  ({ id, grade, name, description, min_level, min_rank, enemy_name, enemy_kind, enemy_level, enemy_hp, enemy_atk, enemy_def, enemy_look, xp, ryo, sort });
export const MISSIONS = [
  Q('d1', 'D', 'Lost Cat Rescue', 'A noble\'s cat climbed into the old watchtower. Something else is up there too.', 1, 0, 'Feral Tom', 'beast_cat', 1, 65, 8, 1, { tint: '#c8892f' }, 35, 30, 1),
  Q('d2', 'D', 'Farm Field Pests', 'A giant boar is wrecking the rice fields outside the gate.', 1, 0, 'Field Boar', 'beast_boar', 2, 95, 10, 2, { tint: '#7a4a2a' }, 45, 40, 2),
  Q('d3', 'D', 'Escort the Merchant', 'Bandits have been robbing carts on the forest road.', 2, 0, 'Road Bandit', 'ninja', 3, 120, 12, 3, { hairStyle: 1, hair: 1, skin: 2, outfit: 6, band: 1, bandSpot: 3 }, 60, 55, 3),
  Q('d4', 'D', 'Night Watch', 'Something has been howling near the village walls at night.', 3, 0, 'Shadow Wolf', 'beast_wolf', 4, 145, 14, 4, { tint: '#4a4a5a' }, 75, 60, 4),
  Q('c1', 'C', 'Smugglers\' Cove', 'Smugglers are hiding stolen scrolls in a sea cave.', 5, 1, 'Smuggler Chief', 'ninja', 6, 210, 17, 6, { hairStyle: 0, hair: 4, skin: 3, outfit: 4, band: 2, bandSpot: 1 }, 120, 110, 10),
  Q('c3', 'C', 'The Swamp Serpent', 'A huge snake is blocking the trade river.', 9, 1, 'Swamp Serpent', 'beast_snake', 10, 320, 23, 10, { tint: '#3a8a4a' }, 200, 170, 12),
];
const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
const LCAP = [5, 15, 30, 60], SCAP = [20, 50, 100, 200];
const R = Math.random;
const jnext = (lv) => (3 + lv * 2) * 10;
const PER = [560, 280, 170, 85];

export function enrich(c) {
  const ri = Math.max(0, RANKS.indexOf(c.rank));
  c.energy_at = c.energy_at || Date.now();
  const energy = Math.min(100, c.energy + Math.floor((Date.now() - c.energy_at) / 9000));
  c.jutsu = c.jutsu || {};
  for (const k in c.jutsu) c.jutsu[k].next = jnext(c.jutsu[k].level);
  return { ...c, energy, energy_max: 100, energy_regen_sec: 9, hp_max: 80 + c.level * 10 + c.strength * 4 + c.willpower,
    stamina_max: 40 + c.level * 3 + c.strength * 2 + c.agility * 2, chakra_max: 40 + c.level * 3 + c.intelligence * 2 + c.willpower * 2,
    stat_cap: SCAP[ri], level_cap: LCAP[ri], rank_index: ri, stat_point_cost: PER[ri], train_energy: 10, train_prog: c.train_prog || {} };
}
function gain(c, id, n) {
  const j = c.jutsu[id] || (c.jutsu[id] = { level: 1, xp: 0 }); let up = 0;
  if (j.level >= 10) return { level: 10, up: 0 };
  j.xp += n; while (j.level < 10 && j.xp >= jnext(j.level)) { j.xp -= jnext(j.level); j.level++; up++; }
  return { level: j.level, up };
}
function takeEnergy(c, times) { const e = enrich(c).energy, n = Math.min(Math.max(1, times), Math.floor(e / 10)); if (n < 1) throw new Error('Not enough energy. It refills over time.'); c.energy = e - n * 10; c.energy_at = Date.now(); return n; }
export function trainStat(c, s, times = 1) {
  const x = enrich(c); if (c[s] >= x.stat_cap) throw new Error('That stat is at the cap for your rank. Rank up to train further.');
  const e = x.energy, n = Math.min(Math.max(1, times), Math.floor(e / 10)); if (n < 1) throw new Error('Not enough energy. It refills over time.');
  c.train_prog = c.train_prog || {}; let prog = c.train_prog[s] || 0, gained = 0, used = 0;
  for (let i = 0; i < n && c[s] < x.stat_cap; i++) { prog += 10; used++; if (prog >= x.stat_point_cost) { prog -= x.stat_point_cost; c[s]++; gained++; } }
  if (c[s] >= x.stat_cap) prog = 0;
  c.train_prog[s] = prog; c.energy = e - used * 10; c.energy_at = Date.now();
  return { ...enrich(c), gained };
}
export function trainJutsu(c, id, times = 1) { const mv = MOVES.find((m) => m.id === id); if (mv.tier > enrich(c).rank_index) throw new Error('Your rank is too low to learn that jutsu.'); const n = takeEnergy(c, times); const g = gain(c, id, n * 4); return { ...enrich(c), trained: g }; }

export function mockStart(c, mid) {
  const m = MISSIONS.find((x) => x.id === mid), x = enrich(c);
  if (x.rank_index < m.min_rank) throw new Error('Your rank is too low for this mission.');
  if (c.level < m.min_level) throw new Error(`You need to be level ${m.min_level} for this mission.`);
  const st = { php: x.hp_max, pmax: x.hp_max, pst: x.stamina_max, pstmax: x.stamina_max, pch: x.chakra_max, pchmax: x.chakra_max, ehp: m.enemy_hp, emax: m.enemy_hp, turn: 1, e_confuse: 0, e_stun: 0,
    enemy: { name: m.enemy_name, kind: m.enemy_kind, level: m.enemy_level, look: m.enemy_look }, mission: { id: m.id, name: m.name, grade: m.grade, xp: m.xp, ryo: m.ryo } };
  return { id: 'b' + Date.now(), status: 'active', state: st, m };
}

export function mockAct(c, b, moveId) {
  const st = b.state, m = b.m, ev = [];
  if (moveId === 'flee') { b.status = 'fled'; return { status: 'fled', state: st, events: [] }; }
  const mv = MOVES.find((x) => x.id === moveId);
  if (mv.tier > enrich(c).rank_index) throw new Error('Your rank is too low for that jutsu.');
  if (st.pst < mv.stamina) throw new Error('Not enough stamina.');
  if (st.pch < mv.chakra) throw new Error('Not enough chakra.');
  st.pst -= mv.stamina; st.pch -= mv.chakra;
  const MAP = { taijutsu: ['strength', 'agility'], bukijutsu: ['agility', 'strength'], ninjutsu: ['intelligence', 'willpower'], genjutsu: ['willpower', 'intelligence'] };
  let status = 'active';
  if (mv.effect === 'focus') { st.pst = Math.min(st.pstmax, st.pst + 10 + c.level); st.pch = Math.min(st.pchmax, st.pch + 10 + c.level); ev.push({ who: 'p', move: mv.id, name: mv.name, focus: 10 + c.level }); }
  else {
    const [a, s2] = MAP[mv.style], jlv = (c.jutsu[mv.id] || { level: 1 }).level;
    const hit = R() < mv.acc, crit = hit && R() < mv.crit + c.agility * 0.002; let dmg = 0, effect = null;
    if (hit) {
      dmg = Math.max(1, Math.round(mv.power * (1 + jlv * 0.08) * (1 + (c[a] + c[s2] * 0.5) / 40) * (1 + c.level * 0.02) * (0.9 + R() * 0.2) * (crit ? 1.6 : 1) - m.enemy_def * 0.5));
      st.ehp = Math.max(0, st.ehp - dmg);
      if (mv.effect === 'confuse') { st.e_confuse = mv.id === 'mirror' ? 2 : 1; effect = 'confuse'; }
      if (mv.effect === 'stun' && R() < Math.min(0.95, mv.effect_chance + c.willpower * 0.004)) { st.e_stun = 1; effect = 'stun'; }
    }
    const g = gain(c, mv.id, 3);
    ev.push({ who: 'p', move: mv.id, name: mv.name, style: mv.style, hit, crit, dmg, effect, jutsu_level: g.level, jutsu_up: g.up });
  }
  if (st.ehp <= 0) status = 'won';
  else {
    if (st.e_stun > 0) { st.e_stun = 0; ev.push({ who: 'e', stunned: true }); }
    else {
      const hit = R() >= (st.e_confuse > 0 ? 0.65 : 0.08), dodge = hit && R() < Math.min(0.25, c.agility * 0.004); if (st.e_confuse > 0) st.e_confuse--;
      const special = R() < 0.22, pdef = 3 + c.level * 1.5 + c.strength * 0.6; let dmg = 0;
      if (hit && !dodge) { dmg = Math.max(1, Math.round(m.enemy_atk * (0.85 + R() * 0.3) * (special ? 1.5 : 1) - pdef * 0.5)); st.php = Math.max(0, st.php - dmg); }
      ev.push({ who: 'e', hit: hit && !dodge, dodge, special, dmg });
    }
    if (st.php <= 0) status = 'lost';
  }
  st.pst = Math.min(st.pstmax, st.pst + 3); st.pch = Math.min(st.pchmax, st.pch + 2); st.turn++;
  let result = null;
  if (status === 'won') {
    const before = c.level, cap = LCAP[RANKS.indexOf(c.rank)];
    c.xp += m.xp; c.ryo += m.ryo;
    while (c.level < cap && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; }
    if (c.level >= cap) c.xp = Math.min(c.xp, c.level * 100);
    if (c.level > before) { c.energy = 100; c.energy_at = Date.now(); }
    result = { xp: m.xp, ryo: m.ryo, level: c.level, leveled: c.level - before, capped: c.level >= cap };
  } else if (status === 'lost') { const lost = Math.min(c.ryo, Math.round(m.ryo * 0.2)); c.ryo -= lost; result = { ryo_lost: lost }; }
  b.status = status;
  return { id: b.id, status, state: st, events: ev, result };
}
