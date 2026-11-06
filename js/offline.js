// Offline test mode only (?offline): local copy of the server's combat rules and catalogue.
const M = (id, style, req, power, cost, acc, crit, effect, chance, name, description, sort) => ({ id, style, req, power, cost, acc, crit, effect, effect_chance: chance, name, description, sort });
export const MOVES = [
  M('palm', 'taijutsu', 1, 13, 0, .95, .05, null, 0, 'Palm Strike', 'A quick open-palm blow. Free to use.', 10),
  M('whirl', 'taijutsu', 3, 20, 0, .9, .08, null, 0, 'Whirlwind Kick', 'A spinning kick that hits hard.', 11),
  M('hundred', 'taijutsu', 6, 30, 4, .9, .1, null, 0, 'Hundred Fists', 'A storm of punches.', 12),
  M('ironbody', 'taijutsu', 9, 44, 8, .88, .12, null, 0, 'Iron Body Rush', 'Harden your body and charge.', 13),
  M('flame', 'ninjutsu', 1, 24, 8, .9, .05, null, 0, 'Flame Burst', 'Breathe a ball of fire.', 20),
  M('lance', 'ninjutsu', 3, 30, 10, .92, .05, null, 0, 'Water Lance', 'A spear of pressurised water.', 21),
  M('spear', 'ninjutsu', 6, 42, 16, .9, .08, null, 0, 'Lightning Spear', 'Crackling chakra pierces armour.', 22),
  M('dragon', 'ninjutsu', 9, 58, 22, .88, .08, null, 0, 'Earth Dragon', 'A dragon of stone erupts from the ground.', 23),
  M('mist', 'genjutsu', 1, 8, 6, 1, 0, 'confuse', 1, 'Mist Veil', 'Clouds their senses: they will likely miss next turn.', 30),
  M('petal', 'genjutsu', 3, 16, 10, .95, .03, 'stun', .5, 'Petal Illusion', 'Swirling petals may freeze them for a turn.', 31),
  M('nightmare', 'genjutsu', 6, 26, 16, .95, .03, 'stun', .65, 'Nightmare Bind', 'Trap them in a waking nightmare.', 32),
  M('mirror', 'genjutsu', 9, 38, 22, .95, .05, 'confuse', 1, 'Mirror World', 'They fight their own reflection.', 33),
  M('kunai', 'bukijutsu', 1, 15, 0, .97, .15, null, 0, 'Kunai Throw', 'Reliable thrown blade. Free, often critical.', 40),
  M('shuriken', 'bukijutsu', 3, 22, 3, .95, .18, null, 0, 'Shuriken Storm', 'A spray of spinning stars.', 41),
  M('tag', 'bukijutsu', 6, 34, 6, .9, .15, null, 0, 'Explosive Tag', 'A paper tag that goes boom.', 42),
  M('blade', 'bukijutsu', 9, 48, 10, .92, .25, null, 0, 'Blade Dance', 'A flurry of twin-blade cuts.', 43),
  M('focus', 'none', 1, 0, 0, 1, 0, 'focus', 1, 'Focus Chakra', 'Breathe. Restore chakra.', 90),
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
  Q('s1', 'S', 'The Rogue Sannin', 'A legendary traitor returns. Only Jonin may face him.', 30, 3, 'Rogue Master Oboro', 'ninja', 33, 1300, 58, 32, { hairStyle: 2, hair: 6, skin: 1, outfit: 4, band: 2, bandSpot: 0 }, 1400, 1200, 40),
];
const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
const CAP = [5, 15, 30, 60];
export const maxHp = (c) => 80 + c.level * 12 + c.taijutsu * 5;
export const maxChakra = (c) => 30 + c.level * 4 + c.ninjutsu * 4 + c.genjutsu * 3;
const R = Math.random;

export function mockStart(c, mid) {
  const m = MISSIONS.find((x) => x.id === mid);
  if (RANKS.indexOf(c.rank) < m.min_rank) throw new Error('Your rank is too low for this mission.');
  if (c.level < m.min_level) throw new Error(`You need to be level ${m.min_level} for this mission.`);
  const st = { php: maxHp(c), pmax: maxHp(c), pch: maxChakra(c), pchmax: maxChakra(c), ehp: m.enemy_hp, emax: m.enemy_hp, turn: 1, e_confuse: 0, e_stun: 0,
    enemy: { name: m.enemy_name, kind: m.enemy_kind, level: m.enemy_level, look: m.enemy_look }, mission: { id: m.id, name: m.name, grade: m.grade, xp: m.xp, ryo: m.ryo } };
  return { id: 'b' + Date.now(), status: 'active', state: st, m };
}

export function mockAct(c, b, moveId) {
  const st = b.state, m = b.m, ev = [];
  if (moveId === 'flee') { b.status = 'fled'; return { status: 'fled', state: st, events: [] }; }
  const mv = MOVES.find((x) => x.id === moveId);
  const stat = mv.style === 'none' ? 99 : c[mv.style];
  if (stat < mv.req) throw new Error('You have not learned that technique yet.');
  if (st.pch < mv.cost) throw new Error('Not enough chakra.');
  st.pch -= mv.cost;
  let status = 'active';
  if (mv.effect === 'focus') { st.pch = Math.min(st.pchmax, st.pch + 12 + c.level); ev.push({ who: 'p', move: mv.id, name: mv.name, focus: 12 + c.level }); }
  else {
    const hit = R() < mv.acc, crit = hit && R() < mv.crit; let dmg = 0, effect = null;
    if (hit) {
      dmg = Math.max(1, Math.round(mv.power * (1 + stat * 0.15) * (1 + c.level * 0.05) * (0.9 + R() * 0.2) * (crit ? 1.6 : 1) - m.enemy_def * 0.5));
      st.ehp = Math.max(0, st.ehp - dmg);
      if (mv.effect === 'confuse') { st.e_confuse = mv.id === 'mirror' ? 2 : 1; effect = 'confuse'; }
      if (mv.effect === 'stun' && R() < mv.effect_chance) { st.e_stun = 1; effect = 'stun'; }
    }
    ev.push({ who: 'p', move: mv.id, name: mv.name, style: mv.style, hit, crit, dmg, effect });
  }
  if (st.ehp <= 0) status = 'won';
  else {
    if (st.e_stun > 0) { st.e_stun = 0; ev.push({ who: 'e', stunned: true }); }
    else {
      const hit = R() >= (st.e_confuse > 0 ? 0.65 : 0.08); if (st.e_confuse > 0) st.e_confuse--;
      const special = R() < 0.22, pdef = 3 + c.level * 1.5 + c.taijutsu * 1.2; let dmg = 0;
      if (hit) { dmg = Math.max(1, Math.round(m.enemy_atk * (0.85 + R() * 0.3) * (special ? 1.5 : 1) - pdef * 0.5)); st.php = Math.max(0, st.php - dmg); }
      ev.push({ who: 'e', hit, special, dmg });
    }
    if (st.php <= 0) status = 'lost';
  }
  st.pch = Math.min(st.pchmax, st.pch + 2); st.turn++;
  let result = null;
  if (status === 'won') {
    const before = c.level, cap = CAP[RANKS.indexOf(c.rank)];
    c.xp += m.xp; c.ryo += m.ryo;
    while (c.level < cap && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; c.stat_points += 3; }
    if (c.level >= cap) c.xp = Math.min(c.xp, c.level * 100);
    result = { xp: m.xp, ryo: m.ryo, level: c.level, leveled: c.level - before, points: c.stat_points, capped: c.level >= cap };
  } else if (status === 'lost') { const lost = Math.min(c.ryo, Math.round(m.ryo * 0.2)); c.ryo -= lost; result = { ryo_lost: lost }; }
  b.status = status;
  return { id: b.id, status, state: st, events: ev, result };
}
