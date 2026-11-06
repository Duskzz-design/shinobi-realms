// Shinobi Realms tactical combat engine. Pure functions, shared by the browser and the server.
// Hex grid (odd-r offset), action points, ranges, areas, elements, buffs/debuffs, simple AI.
export const GW = 9, GH = 7;
export const ELEMENTS = ['fire', 'wind', 'lightning', 'earth', 'water'];
export const ELEMENT_INFO = {
  fire: { label: 'Fire', icon: '🔥', color: '#e8542c' }, wind: { label: 'Wind', icon: '🌪️', color: '#4cbf8c' },
  lightning: { label: 'Lightning', icon: '⚡', color: '#e8c22c' }, earth: { label: 'Earth', icon: '🪨', color: '#9a6a3a' },
  water: { label: 'Water', icon: '💧', color: '#3a8fd0' },
};
// each element beats the next one; water beats fire
export function elementMult(att, def) {
  if (!att || !def) return 1;
  const i = ELEMENTS.indexOf(att), j = ELEMENTS.indexOf(def);
  if ((i + 1) % 5 === j) return 1.5;
  if ((j + 1) % 5 === i) return 0.7;
  return 1;
}
export const STATUS = {
  atk_up: { label: 'Power up', icon: '⬆️', good: true }, def_up: { label: 'Armour', icon: '🛡️', good: true }, speed_up: { label: 'Haste', icon: '💨', good: true },
  focus_up: { label: 'Keen eye', icon: '🎯', good: true }, regen: { label: 'Regenerate', icon: '💚', good: true },
  burn: { label: 'Burning', icon: '🔥' }, poison: { label: 'Poisoned', icon: '☠️' }, slow: { label: 'Slowed', icon: '🐌' }, root: { label: 'Rooted', icon: '🌿' },
  stun: { label: 'Stunned', icon: '💫' }, confuse: { label: 'Confused', icon: '🌀' }, weaken: { label: 'Weakened', icon: '⬇️' }, armor_break: { label: 'Armour broken', icon: '💔' },
};
const E = (k, turns, chance = 1, on = 'target') => ({ k, turns, chance, on });
const J = (o) => ({ ap: 3, stamina: 0, chakra: 0, range: [1, 1], aoe: 0, power: 0, acc: 0.92, crit: 0.05, target: 'enemy', effects: [], heal: 0, element: null, bloodline: null, ...o });
// style: taijutsu | bukijutsu | ninjutsu | genjutsu | bloodline | none ; tier 0..3 = Academy..Jonin
export const MOVES = {
  // Taijutsu (STR main, AGI secondary)
  palm: J({ name: 'Palm Strike', style: 'taijutsu', tier: 0, ap: 2, stamina: 4, power: 14, acc: 0.95, desc: 'A quick close-range blow.' }),
  whirl: J({ name: 'Whirlwind Kick', style: 'taijutsu', tier: 1, ap: 3, stamina: 8, power: 18, aoe: 1, range: [0, 0], target: 'hex', desc: 'Spin and hit every enemy next to you.' }),
  gate: J({ name: 'Inner Gate', style: 'taijutsu', tier: 2, ap: 2, stamina: 14, target: 'self', effects: [E('atk_up', 2), E('speed_up', 2)], desc: 'Unlock hidden strength: more damage and +2 AP for 2 turns.' }),
  ironbody: J({ name: 'Iron Body Rush', style: 'taijutsu', tier: 3, ap: 4, stamina: 20, chakra: 4, power: 48, crit: 0.12, effects: [E('stun', 1, 0.35)], desc: 'A crushing charge that may stun.' }),
  // Bukijutsu (AGI main, STR secondary)
  kunai: J({ name: 'Kunai Throw', style: 'bukijutsu', tier: 0, ap: 2, stamina: 3, range: [1, 3], power: 13, acc: 0.97, crit: 0.15, desc: 'Reliable thrown blade. Often critical.' }),
  shuriken: J({ name: 'Shuriken Storm', style: 'bukijutsu', tier: 1, ap: 3, stamina: 6, range: [2, 4], power: 20, crit: 0.18, effects: [E('armor_break', 2, 0.3)], desc: 'Long-range spray of stars that can break armour.' }),
  tag: J({ name: 'Explosive Tag', style: 'bukijutsu', tier: 2, ap: 3, stamina: 6, chakra: 4, range: [2, 3], aoe: 1, target: 'hex', power: 30, acc: 0.9, effects: [E('burn', 2, 0.4)], desc: 'Throw a tag that explodes in an area.' }),
  venomblade: J({ name: 'Venom Blade Dance', style: 'bukijutsu', tier: 3, ap: 4, stamina: 12, chakra: 4, power: 44, crit: 0.25, effects: [E('poison', 3, 0.8)], desc: 'Poisoned twin blades at close range.' }),
  // Genjutsu (WIL main, INT secondary)
  mist: J({ name: 'Mist Veil', style: 'genjutsu', tier: 0, ap: 2, chakra: 8, range: [1, 4], power: 6, acc: 1, effects: [E('confuse', 2)], desc: 'Confuses the target: their attacks often miss.' }),
  petal: J({ name: 'Petal Illusion', style: 'genjutsu', tier: 1, ap: 3, chakra: 12, range: [1, 3], power: 16, acc: 0.95, effects: [E('stun', 1, 0.5)], desc: 'Swirling petals may freeze them for a turn.' }),
  fear: J({ name: 'Fear Mirage', style: 'genjutsu', tier: 2, ap: 3, chakra: 16, range: [1, 4], power: 14, acc: 0.95, effects: [E('weaken', 2), E('slow', 2)], desc: 'Terror weakens their attacks and slows them.' }),
  mirror: J({ name: 'Mirror World', style: 'genjutsu', tier: 3, ap: 4, chakra: 24, range: [1, 5], power: 36, acc: 0.95, effects: [E('confuse', 2), E('stun', 1, 0.5)], desc: 'They fight their own reflection.' }),
  // Ninjutsu by element (INT main, WIL secondary)
  ember: J({ name: 'Ember Shot', style: 'ninjutsu', element: 'fire', tier: 0, ap: 3, chakra: 9, range: [1, 4], power: 22, effects: [E('burn', 2, 0.25)], desc: 'A fireball that may set them alight.' }),
  firewall: J({ name: 'Flame Wall', style: 'ninjutsu', element: 'fire', tier: 1, ap: 3, chakra: 14, range: [2, 4], aoe: 1, target: 'hex', power: 24, effects: [E('burn', 2, 0.6)], desc: 'A wall of fire burns an area.' }),
  blaze: J({ name: 'Blazing Spirit', style: 'ninjutsu', element: 'fire', tier: 2, ap: 2, chakra: 16, target: 'self', effects: [E('atk_up', 3)], desc: 'Your chakra burns hotter: more damage for 3 turns.' }),
  inferno: J({ name: 'Inferno Dragon', style: 'ninjutsu', element: 'fire', tier: 3, ap: 4, chakra: 28, range: [2, 5], aoe: 1, target: 'hex', power: 56, effects: [E('burn', 3, 0.7)], desc: 'A dragon of flame engulfs an area.' }),
  gale: J({ name: 'Gale Blade', style: 'ninjutsu', element: 'wind', tier: 0, ap: 2, chakra: 8, range: [1, 3], power: 18, crit: 0.2, desc: 'A razor of wind. Cheap and often critical.' }),
  tailwind: J({ name: 'Tailwind', style: 'ninjutsu', element: 'wind', tier: 1, ap: 1, chakra: 12, target: 'self', effects: [E('speed_up', 2)], desc: '+2 AP for 2 turns.' }),
  vacuum: J({ name: 'Vacuum Shot', style: 'ninjutsu', element: 'wind', tier: 2, ap: 3, chakra: 16, range: [2, 6], power: 34, effects: [E('armor_break', 2, 0.7)], desc: 'Long-range shot that breaks armour.' }),
  tempest: J({ name: 'Tempest', style: 'ninjutsu', element: 'wind', tier: 3, ap: 4, chakra: 26, range: [1, 4], aoe: 1, target: 'hex', power: 50, effects: [E('slow', 2, 0.8)], desc: 'A storm that cuts and slows an area.' }),
  spark: J({ name: 'Spark Needle', style: 'ninjutsu', element: 'lightning', tier: 0, ap: 3, chakra: 10, range: [1, 4], power: 20, effects: [E('stun', 1, 0.2)], desc: 'A jolt that may stun.' }),
  cloak: J({ name: 'Thunder Cloak', style: 'ninjutsu', element: 'lightning', tier: 1, ap: 2, chakra: 14, target: 'self', effects: [E('focus_up', 3), E('speed_up', 1)], desc: 'Sharper senses (+accuracy, +crits) and +2 AP.' }),
  chain: J({ name: 'Chain Bolt', style: 'ninjutsu', element: 'lightning', tier: 2, ap: 3, chakra: 18, range: [1, 5], power: 38, effects: [E('stun', 1, 0.35)], desc: 'Lightning arcs to the target. May stun.' }),
  heavenspear: J({ name: "Heaven's Spear", style: 'ninjutsu', element: 'lightning', tier: 3, ap: 4, chakra: 28, range: [2, 6], power: 64, crit: 0.12, desc: 'A spear of lightning from the sky.' }),
  stonefist: J({ name: 'Stone Fist', style: 'ninjutsu', element: 'earth', tier: 0, ap: 2, chakra: 8, range: [1, 2], power: 18, effects: [E('slow', 1, 0.4)], desc: 'A rock-clad punch that may slow.' }),
  rockarmor: J({ name: 'Rock Armour', style: 'ninjutsu', element: 'earth', tier: 1, ap: 2, chakra: 12, target: 'self', effects: [E('def_up', 3)], desc: 'Take much less damage for 3 turns.' }),
  swamp: J({ name: 'Mud Swamp', style: 'ninjutsu', element: 'earth', tier: 2, ap: 3, chakra: 16, range: [1, 4], aoe: 1, target: 'hex', power: 18, effects: [E('root', 2), E('slow', 2)], desc: 'Ground turns to mud: rooted and slowed.' }),
  mountain: J({ name: 'Mountain Crush', style: 'ninjutsu', element: 'earth', tier: 3, ap: 4, chakra: 28, range: [1, 4], aoe: 1, target: 'hex', power: 54, effects: [E('stun', 1, 0.4)], desc: 'A boulder rain that may stun.' }),
  bullet: J({ name: 'Water Bullet', style: 'ninjutsu', element: 'water', tier: 0, ap: 3, chakra: 9, range: [1, 4], power: 20, effects: [E('weaken', 1, 0.3)], desc: 'A pressurised shot that may weaken.' }),
  tide: J({ name: 'Healing Tide', style: 'ninjutsu', element: 'water', tier: 1, ap: 3, chakra: 16, target: 'self', heal: 0.22, effects: [E('regen', 2)], desc: 'Heal 22% now, then a little each turn.' }),
  prison: J({ name: 'Water Prison', style: 'ninjutsu', element: 'water', tier: 2, ap: 3, chakra: 18, range: [1, 3], power: 22, effects: [E('root', 2), E('stun', 1, 0.5)], desc: 'Trap them in a sphere of water.' }),
  wave: J({ name: 'Great Wave', style: 'ninjutsu', element: 'water', tier: 3, ap: 4, chakra: 26, range: [1, 4], aoe: 1, target: 'hex', power: 50, effects: [E('weaken', 2, 0.7)], desc: 'A crashing wave that weakens all it hits.' }),
  // Bloodlines (main/secondary set per bloodline below)
  thornbind: J({ name: 'Thorn Bind', style: 'bloodline', bloodline: 'verdant', tier: 0, ap: 3, chakra: 12, range: [1, 4], power: 22, effects: [E('root', 2), E('poison', 2, 0.5)], desc: 'Living roots seize and poison.' }),
  barkskin: J({ name: 'Bark Skin', style: 'bloodline', bloodline: 'verdant', tier: 0, ap: 2, chakra: 14, target: 'self', heal: 0.12, effects: [E('def_up', 2), E('regen', 3)], desc: 'Wooden armour that slowly heals you.' }),
  forest: J({ name: 'Thorn Forest', style: 'bloodline', bloodline: 'verdant', tier: 2, ap: 4, chakra: 26, range: [1, 4], aoe: 1, target: 'hex', power: 48, effects: [E('root', 2, 0.8)], desc: 'A forest bursts from the ground.' }),
  icelance: J({ name: 'Ice Lances', style: 'bloodline', bloodline: 'frost', tier: 0, ap: 3, chakra: 12, range: [1, 5], power: 26, effects: [E('slow', 2, 0.6)], desc: 'Shards of ice that chill and slow.' }),
  icemirror: J({ name: 'Ice Mirror', style: 'bloodline', bloodline: 'frost', tier: 0, ap: 2, chakra: 14, target: 'self', effects: [E('def_up', 2), E('focus_up', 2)], desc: 'Mirrors of ice: armour and keen aim.' }),
  blizzard: J({ name: 'Blizzard', style: 'bloodline', bloodline: 'frost', tier: 2, ap: 4, chakra: 26, range: [1, 4], aoe: 1, target: 'hex', power: 46, effects: [E('stun', 1, 0.45)], desc: 'A freezing storm that may freeze foes solid.' }),
  lavaspit: J({ name: 'Lava Spit', style: 'bloodline', bloodline: 'magma', tier: 0, ap: 3, chakra: 12, range: [1, 4], power: 26, effects: [E('burn', 3, 0.7), E('armor_break', 2, 0.4)], desc: 'Molten rock melts through armour.' }),
  moltenarmor: J({ name: 'Molten Armour', style: 'bloodline', bloodline: 'magma', tier: 0, ap: 2, chakra: 14, target: 'self', effects: [E('def_up', 2), E('atk_up', 2)], desc: 'Armour of magma: tougher and stronger.' }),
  eruption: J({ name: 'Eruption', style: 'bloodline', bloodline: 'magma', tier: 2, ap: 4, chakra: 28, range: [1, 4], aoe: 1, target: 'hex', power: 54, effects: [E('burn', 3, 0.8)], desc: 'The ground erupts in lava.' }),
  truesight: J({ name: 'True Sight', style: 'bloodline', bloodline: 'stormeye', tier: 0, ap: 1, chakra: 10, target: 'self', effects: [E('focus_up', 3), E('speed_up', 2)], desc: 'Your eyes see every move: +accuracy, crits and +2 AP.' }),
  gaze: J({ name: 'Paralysing Gaze', style: 'bloodline', bloodline: 'stormeye', tier: 0, ap: 3, chakra: 14, range: [1, 4], power: 16, acc: 1, effects: [E('stun', 1, 0.6), E('confuse', 2)], desc: 'One look can freeze a foe.' }),
  eyestorm: J({ name: 'Storm Eye', style: 'bloodline', bloodline: 'stormeye', tier: 2, ap: 4, chakra: 24, range: [1, 6], power: 52, crit: 0.3, desc: 'Lightning answers your gaze.' }),
  steelskin: J({ name: 'Steel Skin', style: 'bloodline', bloodline: 'steel', tier: 0, ap: 1, stamina: 10, target: 'self', effects: [E('def_up', 3)], desc: 'Your skin hardens to steel.' }),
  bladearms: J({ name: 'Blade Arms', style: 'bloodline', bloodline: 'steel', tier: 0, ap: 3, stamina: 12, power: 32, crit: 0.2, effects: [E('armor_break', 2, 0.6)], desc: 'Arms become blades. Breaks armour.' }),
  spikeburst: J({ name: 'Spike Burst', style: 'bloodline', bloodline: 'steel', tier: 2, ap: 4, stamina: 20, range: [0, 0], aoe: 2, target: 'hex', power: 44, effects: [E('poison', 2, 0.5)], desc: 'Steel spikes burst out in all directions.' }),
  // Always available
  focus: J({ name: 'Focus', style: 'none', tier: 0, ap: 2, target: 'self', desc: 'Restore stamina and chakra.' }),
  guard: J({ name: 'Guard', style: 'none', tier: 0, ap: 1, target: 'self', effects: [E('def_up', 1)], desc: 'Brace: take less damage until your next turn.' }),
};
export const BLOODLINES = {
  verdant: { label: 'Verdant Blood', icon: '🌳', main: 'willpower', sec: 'strength', desc: 'Living wood answers your call.' },
  frost: { label: 'Frost Blood', icon: '❄️', main: 'intelligence', sec: 'agility', desc: 'Your chakra freezes the air.' },
  magma: { label: 'Magma Blood', icon: '🌋', main: 'intelligence', sec: 'strength', desc: 'Molten rock flows in your veins.' },
  stormeye: { label: 'Storm Eye', icon: '👁️', main: 'agility', sec: 'willpower', desc: 'Eyes that read every move.' },
  steel: { label: 'Steel Blood', icon: '⚔️', main: 'strength', sec: 'agility', desc: 'A body forged like a blade.' },
};
export const STYLE_STATS = { taijutsu: ['strength', 'agility'], bukijutsu: ['agility', 'strength'], ninjutsu: ['intelligence', 'willpower'], genjutsu: ['willpower', 'intelligence'] };
// Enemy techniques: f = multiplier of the enemy's attack stat
const EM = (o) => ({ ap: 2, range: [1, 1], aoe: 0, f: 1, acc: 0.92, target: 'enemy', effects: [], ...o });
export const ENEMY_MOVES = {
  claw: EM({ name: 'Claw', ap: 2, f: 1 }), bite: EM({ name: 'Savage Bite', ap: 3, f: 1.35, effects: [E('poison', 2, 0.3)] }),
  strike: EM({ name: 'Strike', ap: 2, f: 1 }), heavy: EM({ name: 'Heavy Blow', ap: 3, f: 1.45 }),
  throw: EM({ name: 'Throwing Knives', ap: 2, range: [1, 3], f: 0.85 }), venom: EM({ name: 'Venom Spit', ap: 3, range: [1, 2], f: 0.9, effects: [E('poison', 3, 0.7)] }),
  elem: EM({ name: 'Element Jutsu', ap: 3, range: [1, 4], f: 1.25 }), roar: EM({ name: 'War Cry', ap: 2, target: 'self', effects: [E('atk_up', 2)] }),
  guard: EM({ name: 'Guard', ap: 1, target: 'self', effects: [E('def_up', 1)] }),
};
const ELEM_RIDER = { fire: E('burn', 2, 0.3), wind: E('armor_break', 2, 0.3), lightning: E('stun', 1, 0.15), earth: E('slow', 1, 0.4), water: E('weaken', 1, 0.3) };

// ---------- hex maths ----------
export const key = (c, r) => c + ',' + r;
export function toCube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; }
export function dist(a, b) { const [x1, y1, z1] = toCube(a[0], a[1]), [x2, y2, z2] = toCube(b[0], b[1]); return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2)); }
export function neighbors(c, r) {
  const d = r & 1 ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => [c + dc, r + dr]).filter(([x, y]) => x >= 0 && y >= 0 && x < GW && y < GH);
}
export function blockedHex(s, c, r, ignore = null) {
  if (s.rocks.includes(key(c, r))) return true;
  for (const u of Object.values(s.units)) if (u !== ignore && u.hp > 0 && u.c === c && u.r === r) return true;
  return false;
}
// all reachable hexes with step cost, from unit u within budget
export function reachable(s, u, budget) {
  const out = new Map([[key(u.c, u.r), { c: u.c, r: u.r, cost: 0, prev: null }]]), q = [[u.c, u.r]];
  if (hasStatus(u, 'root')) return out;
  while (q.length) {
    const [c, r] = q.shift(), cur = out.get(key(c, r));
    if (cur.cost >= budget) continue;
    for (const [nc, nr] of neighbors(c, r)) {
      const k = key(nc, nr); if (out.has(k) || blockedHex(s, nc, nr, u)) continue;
      out.set(k, { c: nc, r: nr, cost: cur.cost + 1, prev: key(c, r) }); q.push([nc, nr]);
    }
  }
  return out;
}
export function pathTo(map, c, r) { const p = []; let k = key(c, r); while (k && map.get(k).prev) { const n = map.get(k); p.unshift([n.c, n.r]); k = n.prev; } return p; }

// ---------- rng ----------
function rand(s) { let t = (s.seed += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

// ---------- setup ----------
// unit spec: {name, look, kind, level, stats{strength,agility,intelligence,willpower}, elements[], bloodline, moves[], jl{}, hpmax, stmax, chmax, hp?, st?, ch?}
// enemy spec: {name, look, kind, level, hpmax, atk, def, element, moves[], ai:'melee'|'ranged', npc:true}
export function apMax(u) { return u.npc ? 5 : 5 + Math.min(4, Math.floor((u.stats.agility || 0) / 50)); }
export function newBattle({ seed, a, b, aStarts = null }) {
  const s = { v: 1, seed: seed >>> 0, turn: 1, side: 'a', status: 'active', winner: null, rocks: [], units: {}, log: [] };
  const R = () => rand(s);
  // terrain: 5-7 rocks in the middle columns, never fully blocking a row
  const n = 5 + Math.floor(R() * 3);
  while (s.rocks.length < n) { const c = 2 + Math.floor(R() * 5), r = Math.floor(R() * GH), k = key(c, r); if (!s.rocks.includes(k) && !(r === 3 && (c === 1 || c === 7))) s.rocks.push(k); }
  s.units.a = mkUnit('a', a, 1, 3); s.units.b = mkUnit('b', b, 7, 3);
  const first = aStarts !== null ? (aStarts ? 'a' : 'b') : ((a.stats?.agility || 0) >= (b.npc ? 0 : b.stats?.agility || 0) ? 'a' : 'b');
  s.side = first;
  startTurn(s, first, []);
  return s;
}
function mkUnit(id, spec, c, r) {
  const u = { id, c, r, name: spec.name, look: spec.look || {}, kind: spec.kind || 'ninja', level: spec.level || 1, npc: !!spec.npc,
    stats: spec.stats || {}, elements: spec.elements || (spec.element ? [spec.element] : []), bloodline: spec.bloodline || null,
    moves: spec.moves || [], jl: spec.jl || {}, atk: spec.atk || 0, def: spec.def || 0, ai: spec.ai || 'melee',
    hpmax: spec.hpmax, stmax: spec.stmax || 0, chmax: spec.chmax || 0, effects: [], ap: 0 };
  u.hp = Math.min(u.hpmax, spec.hp ?? u.hpmax); u.st = Math.min(u.stmax, spec.st ?? u.stmax); u.ch = Math.min(u.chmax, spec.ch ?? u.chmax);
  return u;
}
export const other = (side) => (side === 'a' ? 'b' : 'a');
export function hasStatus(u, k) { return u.effects.some((e) => e.k === k && e.turns > 0); }
function addStatus(u, k, turns) { const e = u.effects.find((x) => x.k === k); if (e) e.turns = Math.max(e.turns, turns); else u.effects.push({ k, turns }); }

function startTurn(s, side, ev) {
  const u = s.units[side];
  u.ap = apMax(u) + (hasStatus(u, 'speed_up') ? 2 : 0) - (hasStatus(u, 'slow') ? 2 : 0);
  if (!u.npc) { u.st = Math.min(u.stmax, u.st + 3); u.ch = Math.min(u.chmax, u.ch + 2); }
  for (const k of ['burn', 'poison']) if (hasStatus(u, k)) {
    const d = Math.max(1, Math.round(u.hpmax * (k === 'burn' ? 0.06 : 0.05))); u.hp = Math.max(0, u.hp - d);
    ev.push({ t: 'dot', who: side, k, dmg: d });
  }
  if (hasStatus(u, 'regen')) { const h = Math.round(u.hpmax * 0.06); u.hp = Math.min(u.hpmax, u.hp + h); ev.push({ t: 'heal', who: side, amount: h }); }
  if (u.hp <= 0) return finish(s, other(side), ev);
  if (hasStatus(u, 'stun')) { u.ap = 0; ev.push({ t: 'stunned', who: side }); }
  ev.push({ t: 'turn', who: side, ap: u.ap });
}
function endTurn(s, ev) {
  const u = s.units[s.side];
  for (const e of u.effects) e.turns--;
  u.effects = u.effects.filter((e) => e.turns > 0);
  s.side = other(s.side); if (s.side === 'a') s.turn++;
  startTurn(s, s.side, ev);
  if (s.status === 'active' && s.units[s.side].ap <= 0 && hasStatus(s.units[s.side], 'stun')) { ev.push({ t: 'skip', who: s.side }); endTurn(s, ev); }
}
function finish(s, winner, ev) { s.status = 'over'; s.winner = winner; ev.push({ t: 'end', winner }); return ev; }

// ---------- move helpers ----------
export function moveDef(u, id) { return u.npc ? ENEMY_MOVES[id] : MOVES[id]; }
export function canUse(s, u, id) {
  const m = moveDef(u, id); if (!m) return 'Unknown technique.';
  if (!u.moves.includes(id)) return 'You have not learned that.';
  if (u.ap < m.ap) return 'Not enough AP.';
  if (!u.npc && u.st < (m.stamina || 0)) return 'Not enough stamina.';
  if (!u.npc && u.ch < (m.chakra || 0)) return 'Not enough chakra.';
  return null;
}
export function inRange(m, from, to) { const d = dist(from, to); return d >= m.range[0] && d <= m.range[1]; }
// rocks block line of sight for anything thrown or cast further than one hex
function cubeRound(x, y, z) { let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z); const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry; return [rx, ry, rz]; }
export function lineHexes(a, b) {
  const A = toCube(a[0], a[1]), B = toCube(b[0], b[1]), n = dist(a, b), out = [];
  for (let i = 1; i < n; i++) { const t = i / n + 1e-6; const [x, , z] = cubeRound(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); out.push([x + (z - (z & 1)) / 2, z]); }
  return out;
}
export function hasLOS(s, a, b) { return lineHexes(a, b).every(([c, r]) => !s.rocks.includes(key(c, r))); }
export function canHitFrom(s, m, from, to) { return inRange(m, from, to) && (dist(from, to) <= 1 || hasLOS(s, from, to)); }
export function areaHexes(center, radius) {
  const out = []; for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) if (dist(center, [c, r]) <= radius) out.push([c, r]); return out;
}
function statsFor(u, m) {
  if (m.style === 'bloodline') { const b = BLOODLINES[m.bloodline]; return [u.stats[b.main] || 0, u.stats[b.sec] || 0]; }
  const p = STYLE_STATS[m.style]; return p ? [u.stats[p[0]] || 0, u.stats[p[1]] || 0] : [0, 0];
}
export function defenceOf(u) { return u.npc ? u.def : 3 + u.level * 1.5 + (u.stats.strength || 0) * 0.6; }
export function dodgeOf(u) { return u.npc ? 0.05 : Math.min(0.25, (u.stats.agility || 0) * 0.004); }
// expected / rolled damage of move m from u to t
export function damage(s, u, t, m, roll = true) {
  let base;
  if (u.npc) base = u.atk * (m.f || 1) * (roll ? 0.85 + rand(s) * 0.3 : 1);
  else {
    const [a, b] = statsFor(u, m), jl = u.jl[m.id || m.key] || 1;
    base = m.power * (1 + jl * 0.08) * (1 + (a + b * 0.5) / 40) * (1 + u.level * 0.02) * (roll ? 0.9 + rand(s) * 0.2 : 1);
  }
  const el = m.element || (u.npc && m === ENEMY_MOVES.elem ? u.elements[0] : null);
  let mult = elementMult(el, t.elements[0]);
  if (hasStatus(u, 'atk_up')) mult *= 1.3;
  if (hasStatus(u, 'weaken')) mult *= 0.75;
  if (hasStatus(t, 'armor_break')) mult *= 1.25;
  if (hasStatus(t, 'def_up')) mult *= 0.65;
  return { dmg: Math.max(1, Math.round(base * mult - defenceOf(t) * 0.5)), mult: elementMult(el, t.elements[0]) };
}

// ---------- actions ----------
// action: {t:'move', to:[c,r]} | {t:'use', move, at:[c,r]} | {t:'end'} | {t:'flee'}
export function act(s, side, a) {
  const ev = [];
  if (s.status !== 'active') throw new Error('This fight is over.');
  if (s.side !== side) throw new Error('It is not your turn.');
  const u = s.units[side], foe = s.units[other(side)];
  if (a.t === 'flee') { ev.push({ t: 'flee', who: side }); return finish(s, other(side), ev); }
  if (a.t === 'end') { ev.push({ t: 'endturn', who: side }); endTurn(s, ev); return ev; }
  if (a.t === 'move') {
    if (hasStatus(u, 'root')) throw new Error('You are rooted and cannot move.');
    const map = reachable(s, u, u.ap), k = key(a.to[0], a.to[1]);
    if (!map.has(k)) throw new Error('You cannot reach that hex.');
    const path = pathTo(map, a.to[0], a.to[1]), cost = map.get(k).cost;
    u.c = a.to[0]; u.r = a.to[1]; u.ap -= cost;
    ev.push({ t: 'move', who: side, path });
    return ev;
  }
  if (a.t === 'use') {
    const err = canUse(s, u, a.move); if (err) throw new Error(err);
    const m = { ...moveDef(u, a.move), id: a.move };
    let target = a.at;
    if (m.target === 'self') target = [u.c, u.r];
    if (m.target === 'hex' && m.range[1] === 0) target = [u.c, u.r];
    if (!target) throw new Error('Choose a target.');
    if (m.target !== 'self' && !(m.range[1] === 0) && !inRange(m, [u.c, u.r], target)) throw new Error('Out of range.');
    if (m.target !== 'self' && !(m.range[1] === 0) && !canHitFrom(s, m, [u.c, u.r], target)) throw new Error('A rock is in the way.');
    if (m.target === 'enemy' && !(foe.c === target[0] && foe.r === target[1])) throw new Error('No enemy there.');
    u.ap -= m.ap; if (!u.npc) { u.st -= m.stamina || 0; u.ch -= m.chakra || 0; }
    const e = { t: 'use', who: side, move: a.move, name: u.npc ? enemyMoveName(u, a.move) : m.name, style: m.style, element: m.element || (u.npc && a.move === 'elem' ? u.elements[0] : null), at: target, aoe: m.aoe, hits: [] };
    ev.push(e);
    if (a.move === 'focus') { const g = 12 + u.level; u.st = Math.min(u.stmax, u.st + g); u.ch = Math.min(u.chmax, u.ch + g); e.focus = g; }
    if (m.heal) { const h = Math.round(u.hpmax * m.heal); u.hp = Math.min(u.hpmax, u.hp + h); e.heal = h; }
    if (m.target === 'self') { for (const x of m.effects) addStatus(u, x.k, x.turns + 1); e.self = m.effects.map((x) => x.k); }
    else {
      const hitFoe = m.aoe ? dist(target, [foe.c, foe.r]) <= m.aoe : true;
      if (hitFoe) {
        let acc = m.acc + (hasStatus(u, 'focus_up') ? 0.1 : 0) - (hasStatus(u, 'confuse') ? 0.4 : 0) - dodgeOf(foe);
        const hit = rand(s) < acc;
        const h = { who: foe.id, hit, dodge: !hit && rand(s) < 0.5 };
        if (hit) {
          const critC = (m.crit || 0) + (u.npc ? 0 : (u.stats.agility || 0) * 0.002) + (hasStatus(u, 'focus_up') ? 0.15 : 0);
          const { dmg, mult } = damage(s, u, foe, m);
          const crit = rand(s) < critC, d = crit ? Math.round(dmg * 1.6) : dmg;
          foe.hp = Math.max(0, foe.hp - d); Object.assign(h, { dmg: d, crit, mult });
          const effs = [...m.effects]; if (u.npc && a.move === 'elem' && ELEM_RIDER[u.elements[0]]) effs.push(ELEM_RIDER[u.elements[0]]);
          h.effects = [];
          for (const x of effs) {
            const chance = x.chance + (!u.npc && x.chance < 1 ? (u.stats.willpower || 0) * 0.003 : 0);
            if (rand(s) < chance) { addStatus(foe, x.k, x.turns); h.effects.push(x.k); }
          }
        }
        e.hits.push(h);
        if (foe.hp <= 0) return finish(s, side, ev);
      }
    }
    return ev;
  }
  throw new Error('Unknown action.');
}

// ---------- AI (used for enemies, and for simulations) ----------
export function aiTurn(s, side, maxSteps = 12) {
  const ev = [];
  for (let i = 0; i < maxSteps && s.status === 'active' && s.side === side; i++) {
    const a = aiChoose(s, side);
    ev.push(...act(s, side, a));
  }
  return ev;
}
function aiChoose(s, side) {
  const u = s.units[side], foe = s.units[other(side)], fpos = [foe.c, foe.r];
  const map = reachable(s, u, u.ap);
  let best = null;
  for (const id of u.moves) {
    const m0 = moveDef(u, id); if (!m0) continue;
    const m = { ...m0, id };
    if (u.ap < m.ap || (!u.npc && (u.st < (m.stamina || 0) || u.ch < (m.chakra || 0)))) continue;
    if (m.target === 'self') {
      if (id === 'focus') { if (!u.npc && (u.ch < u.chmax * 0.25 || u.st < u.stmax * 0.2)) best = pick(best, { score: 30, a: { t: 'use', move: id } }); continue; }
      const useful = m.heal ? (u.hp < u.hpmax * 0.5 ? 40 : 0) : m.effects.every((x) => hasStatus(u, x.k)) ? 0 : (s.turn <= 3 || u.hp > u.hpmax * 0.4 ? 18 : 6);
      if (id === 'guard') continue;
      if (useful) best = pick(best, { score: useful, a: { t: 'use', move: id } });
      continue;
    }
    // where could I stand to use it?
    const radius = m.range[1] === 0 ? m.aoe : m.range[1];
    let opt = null;
    for (const [k, h] of map) {
      const from = [h.c, h.r];
      if (u.ap - h.cost < m.ap) continue;
      const ok = m.range[1] === 0 ? dist(from, fpos) <= m.aoe : canHitFrom(s, m, from, fpos);
      if (!ok) continue;
      // prefer staying far when ranged, and fewer steps
      const keepAway = u.ai === 'ranged' || m.range[1] >= 3 ? dist(from, fpos) * 0.6 : 0;
      const sc = -h.cost + keepAway;
      if (!opt || sc > opt.sc) opt = { sc, h };
    }
    if (!opt) continue;
    const exp = damage(s, u, foe, m, false).dmg * (m.acc || 0.9) + (m.effects.length ? 6 : 0);
    const score = exp - opt.h.cost * 0.5;
    const target = m.range[1] === 0 ? null : fpos;
    const act = opt.h.cost > 0 ? { t: 'move', to: [opt.h.c, opt.h.r] } : { t: 'use', move: id, at: target };
    best = pick(best, { score, a: act });
  }
  if (best) return best.a;
  // nothing to use: walk toward the foe (or keep distance if ranged and close)
  let step = null;
  for (const [k, h] of map) {
    if (h.cost === 0) continue;
    const d = dist([h.c, h.r], fpos), want = u.ai === 'ranged' ? 3 : 1;
    const sc = -Math.abs(d - want) * 3 - h.cost * 0.2;
    if (!step || sc > step.sc) step = { sc, h };
  }
  if (step && (u.ai !== 'ranged' || dist([u.c, u.r], fpos) !== 3)) return { t: 'move', to: [step.h.c, step.h.r] };
  return { t: 'end' };
}
const pick = (a, b) => (!a || b.score > a.score ? b : a);

// ---------- what a player knows ----------
export function knownMoves({ rankIndex = 0, elements = [], bloodline = null }) {
  return Object.entries(MOVES).filter(([id, m]) => {
    if (m.style === 'none') return true;
    if (m.style === 'bloodline') return m.bloodline === bloodline && (m.tier === 0 || rankIndex >= 2);
    if (m.tier > rankIndex) return false;
    if (m.style === 'ninjutsu') return elements.includes(m.element);
    return true;
  }).map(([id]) => id);
}

// ---------- building fighters from game data (shared by server and offline mode) ----------
export const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
export const KITS = { beast: ['claw', 'bite', 'roar'], ninja: ['strike', 'throw', 'elem', 'heavy'], snake: ['claw', 'venom', 'bite'], ranged: ['throw', 'elem', 'guard', 'strike'] };
// c: character row; jl: {move: level}; pools: {php,pmax,pst,pstmax,pch,pchmax}
export function playerSpec(c, jl, pools) {
  const ri = Math.max(0, RANKS.indexOf(c.rank)), elements = [c.element, c.element2].filter(Boolean);
  return { name: c.name, look: c.appearance, kind: 'ninja', level: c.level, stats: { strength: c.strength, agility: c.agility, intelligence: c.intelligence, willpower: c.willpower },
    elements, bloodline: c.bloodline || null, moves: knownMoves({ rankIndex: ri, elements, bloodline: c.bloodline }), jl: jl || {},
    hpmax: pools.pmax, stmax: pools.pstmax, chmax: pools.pchmax, hp: pools.php, st: pools.pst, ch: pools.pch };
}
// st: battle state with foe {hp,atk,def,kit,element,level} and enemy {name,kind,look}
export function enemySpec(st) {
  const f = st.foe, e = st.enemy;
  return { name: e.name, look: e.look, kind: e.kind, level: f.level || e.level, npc: true, hpmax: f.hp, atk: f.atk, def: f.def, element: f.element || null,
    moves: KITS[f.kit] || KITS.ninja, ai: f.kit === 'ranged' ? 'ranged' : 'melee' };
}
export function enemyMoveName(u, id) { return id === 'elem' && u.elements[0] ? `${ELEMENT_INFO[u.elements[0]].label} Jutsu` : ENEMY_MOVES[id]?.name || id; }
// full fight pools for a character row (same formulas as the database)
export function poolsOf(c) {
  const hp = 80 + c.level * 10 + c.strength * 4 + c.willpower, st = 40 + c.level * 3 + c.strength * 2 + c.agility * 2, ch = 40 + c.level * 3 + c.intelligence * 2 + c.willpower * 2;
  return { php: hp, pmax: hp, pst: st, pstmax: st, pch: ch, pchmax: ch };
}
// a duel: both sides are players; faster (higher Agility) ninja moves first
export function newDuel(seed, ca, jla, cb, jlb) {
  const s = newBattle({ seed, a: playerSpec(ca, jla, poolsOf(ca)), b: playerSpec(cb, jlb, poolsOf(cb)), aStarts: ca.agility >= cb.agility });
  return s;
}
export const DUEL_TURN_SEC = 60;
