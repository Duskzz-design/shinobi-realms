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
  if ((i + 1) % 5 === j) return 1.25;
  if ((j + 1) % 5 === i) return 0.8;
  return 1;
}
export const STATUS = {
  atk_up: { label: 'Power up', icon: '⬆️', good: true }, def_up: { label: 'Armour', icon: '🛡️', good: true }, speed_up: { label: 'Haste', icon: '💨', good: true },
  focus_up: { label: 'Keen eye', icon: '🎯', good: true }, regen: { label: 'Regenerate', icon: '💚', good: true },
  burn: { label: 'Burning', icon: '🔥' }, poison: { label: 'Poisoned', icon: '☠️' }, slow: { label: 'Slowed', icon: '🐌' }, root: { label: 'Rooted', icon: '🌿' },
  stun: { label: 'Stunned', icon: '💫' }, confuse: { label: 'Confused', icon: '🌀' }, weaken: { label: 'Weakened', icon: '⬇️' }, armor_break: { label: 'Armour broken', icon: '💔' },
  sub: { label: 'Substitution ready', icon: '🪵', good: true }, steady: { label: 'Steadfast (cannot be stunned)', icon: '🧘', good: true },
};
// PvP fairness: no debuff lands more than 75% of the time, and a stunned ninja can't be stunned again straight away
export const DEBUFF_CAP = 0.75;
export const DEBUFFS = ['burn', 'poison', 'slow', 'root', 'weaken', 'confuse', 'armor_break'];
export const BUFFS = ['atk_up', 'def_up', 'speed_up', 'focus_up', 'regen', 'sub'];
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
  // Bloodlines (main/secondary set per bloodline below): one jutsu per rank, as strong as normal jutsu of that rank,
  // special in what they do rather than how hard they hit. Cooldown is one turn longer than normal (see cooldownOf).
  thornbind: J({ name: 'Thorn Bind', style: 'bloodline', bloodline: 'verdant', tier: 0, ap: 3, chakra: 10, range: [1, 4], power: 14, effects: [E('root', 1, 0.4), E('poison', 2, 0.25)], desc: 'Living roots may seize and poison.' }),
  barkskin: J({ name: 'Bark Skin', style: 'bloodline', bloodline: 'verdant', tier: 1, ap: 2, chakra: 14, target: 'self', heal: 0.05, effects: [E('def_up', 1), E('regen', 1)], desc: 'Wooden armour that slowly heals you.' }),
  forest: J({ name: 'Thorn Forest', style: 'bloodline', bloodline: 'verdant', tier: 2, ap: 4, chakra: 22, range: [1, 4], aoe: 1, target: 'hex', power: 28, effects: [E('root', 1, 0.5)], desc: 'A forest bursts from the ground.' }),
  grove: J({ name: 'Ancient Grove', style: 'bloodline', bloodline: 'verdant', tier: 3, ap: 4, chakra: 28, range: [1, 4], aoe: 1, target: 'hex', power: 46, effects: [E('root', 1, 0.5), E('poison', 2, 0.4)], desc: 'An ancient forest crushes and binds an area.' }),
  icelance: J({ name: 'Ice Lances', style: 'bloodline', bloodline: 'frost', tier: 0, ap: 3, chakra: 10, range: [1, 5], power: 15, effects: [E('slow', 1, 0.35)], desc: 'Long-range ice shards that may slow.' }),
  icemirror: J({ name: 'Ice Mirror', style: 'bloodline', bloodline: 'frost', tier: 1, ap: 2, chakra: 14, target: 'self', effects: [E('def_up', 1), E('focus_up', 2)], desc: 'Mirrors of ice: armour and keen aim.' }),
  blizzard: J({ name: 'Blizzard', style: 'bloodline', bloodline: 'frost', tier: 2, ap: 4, chakra: 22, range: [1, 4], aoe: 1, target: 'hex', power: 24, effects: [E('slow', 1, 0.45)], desc: 'A freezing storm that chills an area.' }),
  coffin: J({ name: 'Frozen Coffin', style: 'bloodline', bloodline: 'frost', tier: 3, ap: 4, chakra: 28, range: [1, 3], power: 46, effects: [E('root', 2, 0.5), E('stun', 1, 0.3)], desc: 'Seal the target in ice. May root and freeze them.' }),
  lavaspit: J({ name: 'Lava Spit', style: 'bloodline', bloodline: 'magma', tier: 0, ap: 3, chakra: 10, range: [1, 4], power: 17, effects: [E('burn', 2, 0.3)], desc: 'A glob of molten rock that may burn.' }),
  moltenarmor: J({ name: 'Molten Armour', style: 'bloodline', bloodline: 'magma', tier: 1, ap: 2, chakra: 14, target: 'self', effects: [E('def_up', 1), E('atk_up', 1)], desc: 'Armour of magma: tougher and stronger for a turn.' }),
  lavaflow: J({ name: 'Lava Flow', style: 'bloodline', bloodline: 'magma', tier: 2, ap: 3, chakra: 18, range: [1, 4], power: 28, effects: [E('burn', 2, 0.4), E('armor_break', 2, 0.3)], desc: 'A river of lava that burns and melts armour.' }),
  eruption: J({ name: 'Eruption', style: 'bloodline', bloodline: 'magma', tier: 3, ap: 4, chakra: 28, range: [1, 4], aoe: 1, target: 'hex', power: 48, effects: [E('burn', 3, 0.5)], desc: 'The ground erupts in lava.' }),
  gaze: J({ name: 'Paralysing Gaze', style: 'bloodline', bloodline: 'stormeye', tier: 0, ap: 3, chakra: 10, range: [1, 4], power: 12, acc: 1, effects: [E('confuse', 1, 0.35)], desc: 'A piercing look that may confuse.' }),
  truesight: J({ name: 'True Sight', style: 'bloodline', bloodline: 'stormeye', tier: 1, ap: 1, chakra: 12, target: 'self', effects: [E('focus_up', 2)], desc: 'Your eyes see every move: +accuracy and more critical hits for 2 turns.' }),
  eyestorm: J({ name: 'Storm Eye', style: 'bloodline', bloodline: 'stormeye', tier: 2, ap: 4, chakra: 22, range: [1, 6], power: 27, crit: 0.15, desc: 'Lightning answers your gaze, from far away.' }),
  thousandeyes: J({ name: 'Thousand Eyes', style: 'bloodline', bloodline: 'stormeye', tier: 3, ap: 4, chakra: 28, range: [1, 5], power: 42, acc: 1, crit: 0.15, effects: [E('confuse', 2, 0.5), E('stun', 1, 0.3)], desc: 'Every eye in the storm turns on them.' }),
  bladearms: J({ name: 'Blade Arms', style: 'bloodline', bloodline: 'steel', tier: 0, ap: 3, stamina: 8, power: 17, crit: 0.15, effects: [E('armor_break', 2, 0.3)], desc: 'Arms become blades that may break armour.' }),
  steelskin: J({ name: 'Steel Skin', style: 'bloodline', bloodline: 'steel', tier: 1, ap: 1, stamina: 10, target: 'self', effects: [E('def_up', 1)], desc: 'Your skin hardens to steel for a turn.' }),
  spikeburst: J({ name: 'Spike Burst', style: 'bloodline', bloodline: 'steel', tier: 2, ap: 4, stamina: 16, range: [0, 0], aoe: 2, target: 'hex', power: 28, effects: [E('poison', 2, 0.3)], desc: 'Steel spikes burst out in all directions.' }),
  ironmaiden: J({ name: 'Iron Maiden', style: 'bloodline', bloodline: 'steel', tier: 3, ap: 4, stamina: 20, chakra: 4, power: 48, crit: 0.12, effects: [E('armor_break', 2, 0.5), E('stun', 1, 0.25)], desc: 'A cage of blades closes around the target.' }),
  // Always available
  focus: J({ name: 'Focus', style: 'none', tier: 0, ap: 2, target: 'self', desc: 'Restore stamina and chakra.' }),
  guard: J({ name: 'Guard', style: 'none', tier: 0, ap: 1, target: 'self', effects: [E('def_up', 1)], desc: 'Brace: take less damage until your next turn.' }),
  slash: J({ name: 'Sword Slash', style: 'bukijutsu', gear: true, tier: 0, ap: 2, stamina: 6, power: 0, crit: 0.1, desc: 'Strike with your equipped sword. Its power depends on the sword.' }),
  // counter scrolls (bought at the Library, always ready: they don't use a loadout slot)
  substitution: J({ name: 'Substitution', style: 'none', scroll: true, counter: true, price: 800, tier: 0, ap: 2, chakra: 10, target: 'self', effects: [E('sub', 1)], cd: 3, desc: 'Swap with a log: the next hit on you misses and you reappear away from your attacker.' }),
  release: J({ name: 'Chakra Release', style: 'none', scroll: true, counter: true, price: 1500, tier: 0, ap: 2, chakra: 12, target: 'self', cleanse: true, cd: 3, desc: 'Flush your chakra to clear burning, poison, slow, root, weaken, confusion and armour break.' }),
  dispel: J({ name: 'Dispel', style: 'none', scroll: true, counter: true, price: 2000, tier: 0, ap: 2, chakra: 12, range: [1, 4], acc: 1, dispel: true, cd: 2, desc: 'Break the enemy\'s jutsu: removes all their buffs (power, armour, haste, keen eye, regenerate, substitution).' }),
  // boss scrolls (learned only from boss drops)
  serpentfang: J({ name: 'Serpent Fang', style: 'bukijutsu', scroll: true, tier: 2, ap: 3, stamina: 8, chakra: 6, range: [1, 3], power: 40, crit: 0.2, effects: [E('poison', 3, 0.8), E('armor_break', 2, 0.5)], desc: 'Boss scroll: a coiling strike that poisons and breaks armour.' }),
};
// cooldowns by rank tier: Academy 0, Genin 1, Chunin 2, Jonin 3 turns (players only)
export function cooldownOf(id) { const m = MOVES[id]; if (!m || m.gear || id === 'focus' || id === 'guard') return 0; return m.cd ?? ([0, 1, 2, 3][m.tier] ?? 0) + (m.style === 'bloodline' ? 1 : 0); }
export const COUNTERS = Object.keys(MOVES).filter((id) => MOVES[id].counter);
// consumable items: bought in the Tool Shop, 3 kinds can be packed per fight, each use costs AP
export const ITEMS = {
  pill_heal: { name: 'Healing Pill', icon: '💊', ap: 2, price: 120, desc: 'Heal 30% of your health.' },
  pill_chakra: { name: 'Chakra Pill', icon: '🔷', ap: 1, price: 100, desc: 'Restore 40% of your chakra and stamina.' },
  smoke: { name: 'Smoke Bomb', icon: '💨', ap: 2, price: 150, desc: 'Confuse every enemy next to you for 2 turns.' },
  antidote: { name: 'Antidote', icon: '🧪', ap: 1, price: 80, desc: 'Cure burning, poison, slow, root, weaken and confusion.' },
  // thrown weapons: aimed like a weapon technique, then used up
  kunai: { name: 'Kunai', icon: '🔪', ap: 1, price: 40, rank: 0, range: [1, 3], power: 12, acc: 0.95, crit: 0.1, effects: [], desc: 'A thrown blade. Range 1-3.' },
  shuriken: { name: 'Shuriken', icon: '✴️', ap: 1, price: 30, rank: 0, range: [2, 4], power: 10, acc: 0.95, crit: 0.25, effects: [], desc: 'A throwing star that often lands a critical hit. Range 2-4.' },
  kunai_x: { name: 'Explosive Kunai', icon: '🧨', ap: 2, price: 160, rank: 2, range: [2, 3], aoe: 1, power: 26, acc: 0.9, crit: 0.05, effects: [E('burn', 2, 0.4)], desc: 'Explodes in an area and may burn. Range 2-3.' },
  shuriken_w: { name: 'Windmill Shuriken', icon: '🌀', ap: 2, price: 110, rank: 2, range: [2, 5], power: 30, acc: 0.92, crit: 0.15, effects: [E('armor_break', 2, 0.5)], desc: 'A huge spinning star that may break armour. Range 2-5.' },
};
// equipment: 1 weapon + head, chest, arms and legs. Bought once and kept.
const GP = (o) => ({ def: 0, boost: 0, slash: 0, ...o });
export const GEAR = {
  tanto: GP({ slot: 'weapon', name: 'Tanto', icon: '🗡️', tier: 'basic', price: 400, boost: 0.1, slash: 20 }),
  katana: GP({ slot: 'weapon', name: 'Katana', icon: '⚔️', tier: 'adv', price: 2500, boost: 0.2, slash: 40 }),
  anbu_blade: GP({ slot: 'weapon', name: 'ANBU Blade', icon: '🔱', tier: 'anbu', price: 8000, boost: 0.25, slash: 48 }),
  cleaver: GP({ slot: 'weapon', name: "Warlord's Cleaver", icon: '🪓', tier: 'boss', boss: 'iron', boost: 0.25, slash: 60, slashFx: [E('stun', 1, 0.25)], note: 'Slash may stun' }),
  fangblade: GP({ slot: 'weapon', name: 'Venomfang Fang-Blade', icon: '🐍', tier: 'boss', boss: 'serpent', boost: 0.25, slash: 58, slashFx: [E('poison', 3, 0.6)], note: 'Slash may poison' }),
  thunderclap: GP({ slot: 'weapon', name: 'Thunderclap Blade', icon: '⚡', tier: 'boss', boss: 'shrine', boost: 0.3, slash: 70, slashFx: [E('stun', 1, 0.3)], note: 'Slash may stun' }),
};
for (const [set, tier, def, price, label] of [['genin', 'basic', 4, 100, 'Genin'], ['flak', 'adv', 8, 500, 'Flak'], ['anbu', 'anbu', 10, 2000, 'ANBU']])
  for (const [slot, nm, icon] of [['head', 'Headband', '🎽'], ['chest', 'Vest', '🦺'], ['arms', 'Bracers', '🧤'], ['legs', 'Greaves', '👖']])
    GEAR[`${set}_${slot}`] = GP({ slot, set, name: `${label} ${nm}`, icon, tier, def, price: slot === 'chest' ? price * 2 : price });
Object.assign(GEAR, {
  iron_helm: GP({ slot: 'head', name: 'Iron Helm', icon: '⛑️', tier: 'boss', boss: 'iron', def: 12, stunResist: 0.3, note: 'Shrugs off 30% of stuns' }),
  scale_bracers: GP({ slot: 'arms', name: 'Scale Bracers', icon: '🐉', tier: 'boss', boss: 'serpent', def: 12, poisonImmune: true, note: 'Immune to poison' }),
  hollow_plate: GP({ slot: 'chest', name: 'Hollow Breastplate', icon: '🛡️', tier: 'boss', boss: 'shrine', def: 14, lightningResist: 0.15, note: 'Lightning hurts 15% less' }),
  // Jonin boss drops: Mist Reaper (lv 30 line), Scorpion King (lv 40), Eclipse Sage (lv 50)
  mistcutter: GP({ slot: 'weapon', name: 'Mistcutter', icon: '🌫️', tier: 'boss', boss: 'mist', boost: 0.32, slash: 76, slashFx: [E('slow', 1, 0.35)], note: 'Slash may chill (slow)' }),
  reaper_hood: GP({ slot: 'head', name: 'Reaper Hood', icon: '🥷', tier: 'boss', boss: 'mist', def: 15, dodge: 0.03, note: '+3% dodge' }),
  tidewalker_greaves: GP({ slot: 'legs', name: 'Tidewalker Greaves', icon: '🌊', tier: 'boss', boss: 'mist', def: 15, immune: ['slow'], note: 'Cannot be slowed' }),
  stingblade: GP({ slot: 'weapon', name: "Scorpion King's Stinger", icon: '🦂', tier: 'boss', boss: 'sands', boost: 0.36, slash: 84, slashFx: [E('armor_break', 2, 0.4)], note: 'Slash may break armour' }),
  sandshell_bracers: GP({ slot: 'arms', name: 'Sandshell Bracers', icon: '🏜️', tier: 'boss', boss: 'sands', def: 17, resist: { earth: 0.2 }, immune: ['root'], note: 'Earth hurts 20% less, cannot be rooted' }),
  kings_mantle: GP({ slot: 'chest', name: "King's Mantle", icon: '👘', tier: 'boss', boss: 'sands', def: 18, hp: 0.05, note: '+5% max HP' }),
  duskfang: GP({ slot: 'weapon', name: 'Duskfang', icon: '🌒', tier: 'boss', boss: 'eclipse', boost: 0.4, slash: 92, slashFx: [E('weaken', 2, 0.4)], note: 'Slash may weaken' }),
  eclipse_crown: GP({ slot: 'head', name: 'Eclipse Crown', icon: '👑', tier: 'boss', boss: 'eclipse', def: 20, immune: ['confuse'], note: 'Cannot be confused' }),
  moonshadow_greaves: GP({ slot: 'legs', name: 'Moonshadow Greaves', icon: '🌙', tier: 'boss', boss: 'eclipse', def: 20, dodge: 0.04, note: '+4% dodge' }),
});
export const GEAR_SETS = { genin: { name: 'Genin Uniform', hp: 0.05 }, flak: { name: 'Flak Uniform', hp: 0.08 }, anbu: { name: 'ANBU Uniform', hp: 0.1, dodge: 0.05 } };
export const GEAR_SLOTS = ['weapon', 'head', 'chest', 'arms', 'legs'];
export const BOSS_DROPS = { iron: ['cleaver', 'iron_helm'], serpent: ['fangblade', 'scale_bracers'], shrine: ['thunderclap', 'hollow_plate'],
  mist: ['mistcutter', 'reaper_hood', 'tidewalker_greaves'], sands: ['stingblade', 'sandshell_bracers', 'kings_mantle'], eclipse: ['duskfang', 'eclipse_crown', 'moonshadow_greaves'] };
// who may wear a piece: basic for everyone, advanced from Chunin, ANBU for squad members, boss drops for whoever owns them
export function canWear(id, rankIndex, anbu) { const g = GEAR[id]; if (!g) return false; return g.tier === 'anbu' ? !!anbu : g.tier === 'adv' ? rankIndex >= 2 : true; }
// combined bonuses of what a character is wearing
export function gearStats(c) {
  const eq = c.gear || {}, ri = Math.max(0, RANKS.indexOf(c.rank)), out = { def: 0, hp: 0, dodge: 0, boost: 0, slash: 0, slashFx: [], weapon: null, sets: {} };
  for (const slot of GEAR_SLOTS) {
    const id = eq[slot], g = GEAR[id]; if (!g || g.slot !== slot || !canWear(id, ri, c.anbu || c.anbu_squad)) continue;
    out.def += g.def; if (g.set) out.sets[g.set] = (out.sets[g.set] || 0) + 1;
    if (slot === 'weapon') Object.assign(out, { weapon: id, boost: g.boost, slash: g.slash, slashFx: g.slashFx || [] });
    if (g.stunResist) out.stunResist = g.stunResist; if (g.poisonImmune) out.poisonImmune = true; if (g.lightningResist) out.lightningResist = g.lightningResist;
    if (g.dodge) out.dodge += g.dodge; if (g.hp) out.hp += g.hp;
    if (g.immune) out.immune = [...(out.immune || []), ...g.immune];
    if (g.resist) out.resist = { ...(out.resist || {}), ...g.resist };
  }
  for (const [set, n] of Object.entries(out.sets)) if (n >= 4) { out.hp += GEAR_SETS[set].hp || 0; out.dodge += GEAR_SETS[set].dodge || 0; out.fullSet = set; }
  return out;
}
export const ITEM_SLOTS = 3, ITEM_STACK = 10;
export const BLOODLINES = {
  verdant: { label: 'Verdant Blood', icon: '🌳', main: 'willpower', sec: 'strength', desc: 'Living wood answers your call.', passive: 'Heal 1.5% of your health at the start of each turn.' },
  frost: { label: 'Frost Blood', icon: '❄️', main: 'intelligence', sec: 'agility', desc: 'Your chakra freezes the air.', passive: '+4% accuracy with every attack.' },
  magma: { label: 'Magma Blood', icon: '🌋', main: 'intelligence', sec: 'strength', desc: 'Molten rock flows in your veins.', passive: '+4% damage with every attack.' },
  stormeye: { label: 'Storm Eye', icon: '👁️', main: 'agility', sec: 'willpower', desc: 'Eyes that read every move.', passive: '+3% chance to dodge.' },
  steel: { label: 'Steel Blood', icon: '⚔️', main: 'strength', sec: 'agility', desc: 'A body forged like a blade.', passive: 'Take 4% less damage.' },
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
  slam: EM({ name: 'Crushing Sweep', ap: 3, range: [0, 0], aoe: 1, target: 'hex', f: 1.1 }),
  rain: EM({ name: 'Barrage', ap: 4, range: [1, 5], aoe: 1, target: 'hex', f: 0.9, effects: [E('burn', 2, 0.3)] }),
  ice: EM({ name: 'Frost Needles', ap: 3, range: [1, 3], f: 0.95, effects: [E('slow', 1, 0.45)] }),
  mend: EM({ name: 'Mending Mist', ap: 3, target: 'self', heal: 0.12 }),
  mist: EM({ name: 'Veil of Mist', ap: 3, target: 'self', heal: 0.04, effects: [E('def_up', 1)] }),
  sever: EM({ name: 'Severing Blade', ap: 3, f: 1.4, effects: [E('armor_break', 2, 0.4)] }),
  hex: EM({ name: 'Curse Seal', ap: 3, range: [1, 3], f: 0.8, effects: [E('weaken', 2, 0.55)] }),
  illusion: EM({ name: 'Demon Illusion', ap: 3, range: [1, 4], f: 0.75, effects: [E('confuse', 1, 0.45)] }),
  puppet: EM({ name: 'Puppet Strings', ap: 3, range: [1, 3], f: 1.05, effects: [E('root', 1, 0.35)] }),
  sting: EM({ name: 'Scorpion Sting', ap: 3, f: 1.4, effects: [E('poison', 3, 0.6)] }),
  quake: EM({ name: 'Earth Ripple', ap: 4, range: [1, 3], aoe: 1, target: 'hex', f: 1, effects: [E('slow', 1, 0.4)] }),
  drain: EM({ name: 'Soul Drain', ap: 3, range: [1, 2], f: 1, drain: 0.5 }),
  howl: EM({ name: 'Moon Howl', ap: 2, target: 'self', effects: [E('atk_up', 2), E('speed_up', 1)] }),
  eclipse: EM({ name: 'Black Eclipse', ap: 5, range: [0, 0], aoe: 2, target: 'hex', f: 1.2, effects: [E('weaken', 2, 0.4)] }),
};
export const BOSS_KITS = { warlord: ['heavy', 'slam', 'throw', 'roar'], wyrm: ['bite', 'venom', 'slam', 'rain'], shogun: ['strike', 'elem', 'slam', 'rain', 'roar'],
  reaper: ['sever', 'ice', 'mist', 'rain', 'strike'], scorpionking: ['sting', 'quake', 'puppet', 'rain', 'roar'], eclipse: ['illusion', 'hex', 'eclipse', 'drain', 'elem'] };
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
export function apMax(u) { return u.npc ? u.apBase || 5 : 5 + Math.min(4, Math.floor((u.stats.agility || 0) / 50)); }
export function newBattle({ seed, a, b, aStarts = null }) {
  const s = { v: 1, seed: seed >>> 0, turn: 1, side: 'a', status: 'active', winner: null, rocks: [], units: {}, log: [] };
  const R = () => rand(s);
  // terrain: 5-7 rocks in the middle columns, never fully blocking a row
  const n = 5 + Math.floor(R() * 3);
  while (s.rocks.length < n) { const c = 2 + Math.floor(R() * 5), r = Math.floor(R() * GH), k = key(c, r); if (!s.rocks.includes(k) && !(r === 3 && (c === 1 || c === 7))) s.rocks.push(k); }
  s.units.a = mkUnit('a', a, 1, 3, 'A'); s.units.b = mkUnit('b', b, 7, 3, 'B'); s.order = ['a', 'b'];
  const first = aStarts !== null ? (aStarts ? 'a' : 'b') : ((a.stats?.agility || 0) >= (b.npc ? 0 : b.stats?.agility || 0) ? 'a' : 'b');
  s.side = first;
  startTurn(s, first, []);
  return s;
}
// team boss fight: up to 3 players (p1..p3, acting in order) against one boss
export function newRaid({ seed, players, boss }) {
  const s = { v: 1, seed: seed >>> 0, turn: 1, side: 'p1', status: 'active', winner: null, rocks: [], units: {}, log: [], raid: true };
  const R = () => rand(s), starts = [[1, 3], [1, 1], [1, 5]];
  const n = 5 + Math.floor(R() * 3);
  while (s.rocks.length < n) { const c = 2 + Math.floor(R() * 4), r = Math.floor(R() * GH), k = key(c, r); if (!s.rocks.includes(k)) s.rocks.push(k); }
  s.order = [];
  players.forEach((p, i) => { const id = 'p' + (i + 1); s.units[id] = mkUnit(id, p, starts[i][0], starts[i][1], 'A'); s.order.push(id); });
  s.units.boss = mkUnit('boss', boss, 7, 3, 'B'); s.order.push('boss');
  s.side = s.order[0];
  startTurn(s, s.side, []);
  return s;
}
function mkUnit(id, spec, c, r, team) {
  const u = { id, c, r, team, boss: !!spec.boss, apBase: spec.apBase || 0, uid: spec.uid || null, name: spec.name, look: spec.look || {}, kind: spec.kind || 'ninja', level: spec.level || 1, npc: !!spec.npc,
    stats: spec.stats || {}, elements: spec.elements || (spec.element ? [spec.element] : []), bloodline: spec.bloodline || null,
    moves: spec.moves || [], jl: spec.jl || {}, atk: spec.atk || 0, def: spec.def || 0, ai: spec.ai || 'melee',
    hpmax: spec.hpmax, stmax: spec.stmax || 0, chmax: spec.chmax || 0, effects: [], cd: {}, ap: 0, items: { ...(spec.items || {}) }, usedItems: {}, gear: spec.gear || null };
  u.hp = Math.min(u.hpmax, spec.hp ?? u.hpmax); u.st = Math.min(u.stmax, spec.st ?? u.stmax); u.ch = Math.min(u.chmax, spec.ch ?? u.chmax);
  return u;
}
export const other = (side) => (side === 'a' ? 'b' : 'a');
export function hasStatus(u, k) { return u.effects.some((e) => e.k === k && e.turns > 0); }
function addStatus(u, k, turns) { const e = u.effects.find((x) => x.k === k); if (e) e.turns = Math.max(e.turns, turns); else u.effects.push({ k, turns }); }

export const foesOf = (s, u) => Object.values(s.units).filter((x) => x.team !== u.team && x.hp > 0);
const teamAlive = (s, team) => Object.values(s.units).some((x) => x.team === team && x.hp > 0);
function finishTeam(s, team, ev) { s.status = 'over'; s.winner = s.raid ? team : team === 'A' ? 'a' : 'b'; ev.push({ t: 'end', winner: s.winner }); return ev; }
function checkWipe(s, ev) {
  if (!teamAlive(s, 'B')) { finishTeam(s, 'A', ev); return true; }
  if (!teamAlive(s, 'A')) { finishTeam(s, 'B', ev); return true; }
  return false;
}
function startTurn(s, side, ev) {
  const u = s.units[side];
  u.ap = apMax(u) + (hasStatus(u, 'speed_up') ? 2 : 0) - (hasStatus(u, 'slow') ? 2 : 0);
  if (!u.npc) { u.st = Math.min(u.stmax, u.st + 3); u.ch = Math.min(u.chmax, u.ch + 2); }
  for (const k of ['burn', 'poison']) if (hasStatus(u, k)) {
    const d = Math.max(1, Math.round(u.hpmax * (k === 'burn' ? 0.06 : 0.05) * (u.boss ? 0.25 : 1))); u.hp = Math.max(0, u.hp - d);
    ev.push({ t: 'dot', who: side, k, dmg: d });
  }
  if (!u.npc && u.bloodline === 'verdant' && u.hp > 0 && u.hp < u.hpmax) { const h = Math.max(1, Math.round(u.hpmax * 0.015)); u.hp = Math.min(u.hpmax, u.hp + h); ev.push({ t: 'heal', who: side, amount: h, bl: true }); }
  if (hasStatus(u, 'regen')) { const h = Math.round(u.hpmax * 0.06); u.hp = Math.min(u.hpmax, u.hp + h); ev.push({ t: 'heal', who: side, amount: h }); }
  if (u.hp <= 0) { ev.push({ t: 'down', who: side }); if (checkWipe(s, ev)) return; return endTurn(s, ev); }
  if (hasStatus(u, 'stun')) { u.ap = 0; addStatus(u, 'steady', 2); ev.push({ t: 'stunned', who: side }); }
  ev.push({ t: 'turn', who: side, ap: u.ap });
}
function endTurn(s, ev) {
  const u = s.units[s.side];
  for (const e of u.effects) e.turns--;
  if (u.cd) for (const k of Object.keys(u.cd)) if (--u.cd[k] <= 0) delete u.cd[k];
  u.effects = u.effects.filter((e) => e.turns > 0);
  let i = s.order.indexOf(s.side);
  for (let k = 0; k < s.order.length; k++) { i = (i + 1) % s.order.length; if (i === 0) s.turn++; if (s.units[s.order[i]].hp > 0) break; }
  s.side = s.order[i];
  startTurn(s, s.side, ev);
  if (s.status === 'active' && s.units[s.side].ap <= 0 && hasStatus(s.units[s.side], 'stun')) { ev.push({ t: 'skip', who: s.side }); endTurn(s, ev); }
}
function finish(s, winner, ev) { return finishTeam(s, s.units[winner].team, ev); }

// ---------- move helpers ----------
export function moveDef(u, id) { return u.npc ? ENEMY_MOVES[id] : MOVES[id]; }
export function canUse(s, u, id) {
  const m = moveDef(u, id); if (!m) return 'Unknown technique.';
  if (!u.moves.includes(id)) return 'You have not learned that.';
  if (u.cd && u.cd[id] > 0) return `${m.name} is recharging (${cdLeft(u, id)} turn${cdLeft(u, id) === 1 ? '' : 's'}).`;
  if (u.ap < m.ap) return 'Not enough AP.';
  if (!u.npc && u.st < (m.stamina || 0)) return 'Not enough stamina.';
  if (!u.npc && u.ch < (m.chakra || 0)) return 'Not enough chakra.';
  return null;
}
// own turns still to wait before a technique can be used again
export function cdLeft(u, id) { return u.cd && u.cd[id] > 0 ? Math.min(u.cd[id], cooldownOf(id)) : 0; }
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
export function defenceOf(u) { return u.npc ? u.def : 3 + u.level * 1.5 + (u.stats.strength || 0) * 0.6 + (u.gear ? u.gear.def : 0); }
export function dodgeOf(u) { return u.npc ? 0.05 : Math.min(0.3, (u.stats.agility || 0) * 0.004 + (u.gear ? u.gear.dodge : 0) + (u.bloodline === 'stormeye' ? 0.03 : 0)); }
// player-vs-player damage scale by level: keeps duels around 5-6 turns at every rank
const PVP_TABLE = [[20, 1], [25, 0.72], [30, 0.6], [40, 0.33], [50, 0.26], [60, 0.22]];
export function pvpScale(level) {
  if (level <= PVP_TABLE[0][0]) return 1;
  for (let i = 1; i < PVP_TABLE.length; i++) { const [l1, v1] = PVP_TABLE[i - 1], [l2, v2] = PVP_TABLE[i]; if (level <= l2) return v1 + ((level - l1) / (l2 - l1)) * (v2 - v1); }
  return PVP_TABLE[PVP_TABLE.length - 1][1];
}
// expected / rolled damage of move m from u to t
export function damage(s, u, t, m, roll = true) {
  let base;
  if (u.npc) base = u.atk * (m.f || 1) * (roll ? 0.85 + rand(s) * 0.3 : 1);
  else {
    const [a, b] = statsFor(u, m), jl = u.jl[m.id || m.key] || 1;
    base = m.power * (1 + jl * 0.08) * (1 + (a + b * 0.5) / 40) * (1 + u.level * 0.02) * (roll ? 0.9 + rand(s) * 0.2 : 1);
    if (m.style === 'bukijutsu' && u.gear && u.gear.boost) base *= 1 + u.gear.boost; // a sword sharpens every weapon technique
  }
  const el = m.element || (u.npc && m === ENEMY_MOVES.elem ? u.elements[0] : null);
  let mult = elementMult(el, t.elements[0]);
  if (hasStatus(u, 'atk_up')) mult *= 1.3;
  if (hasStatus(u, 'weaken')) mult *= 0.75;
  if (hasStatus(t, 'armor_break')) mult *= 1.25;
  if (hasStatus(t, 'def_up')) mult *= 0.65;
  if (el === 'lightning' && t.gear && t.gear.lightningResist) mult *= 1 - t.gear.lightningResist;
  if (el && t.gear && t.gear.resist && t.gear.resist[el]) mult *= 1 - t.gear.resist[el];
  if (!u.npc && u.bloodline === 'magma') mult *= 1.04;
  if (!t.npc && t.bloodline === 'steel') mult *= 0.96;
  if (s.pvp && !u.npc && !t.npc) mult *= pvpScale(u.level); // ninja vs ninja: longer, more tactical duels
  return { dmg: Math.max(1, Math.round(base * mult - defenceOf(t) * 0.5)), mult: elementMult(el, t.elements[0]) };
}

// ---------- actions ----------
// action: {t:'move', to:[c,r]} | {t:'use', move, at:[c,r]} | {t:'end'} | {t:'flee'}
// roll every hit of a technique (or thrown weapon) on its targets; returns true if someone went down
function strike(s, u, m, moveId, targets, e) {
  let downed = false;
  for (const foe of targets) {
    const acc = m.acc + (!u.npc && u.bloodline === 'frost' ? 0.04 : 0) + (hasStatus(u, 'focus_up') ? 0.1 : 0) - (hasStatus(u, 'confuse') ? 0.4 : 0) - dodgeOf(foe);
    let hit = rand(s) < acc;
    const h = { who: foe.id, hit, dodge: !hit && rand(s) < 0.5 };
    if (hit && hasStatus(foe, 'sub')) { // the log takes the hit; the ninja reappears away from the attacker
      foe.effects = foe.effects.filter((x) => x.k !== 'sub'); h.hit = false; h.dodge = false; h.sub = true;
      let best = null;
      for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
        if (blockedHex(s, c, r, foe) || dist([c, r], [foe.c, foe.r]) > 3) continue;
        const sc = dist([c, r], [u.c, u.r]) * 2 - dist([c, r], [foe.c, foe.r]);
        if (!best || sc > best.sc) best = { sc, c, r };
      }
      if (best) { foe.c = best.c; foe.r = best.r; h.to = [best.c, best.r]; }
      e.hits.push(h); continue;
    }
    if (hit) {
      const critC = (m.crit || 0) + (u.npc ? 0 : (u.stats.agility || 0) * 0.002) + (hasStatus(u, 'focus_up') ? 0.15 : 0);
      const { dmg, mult } = damage(s, u, foe, m);
      const crit = rand(s) < critC, d = crit ? Math.round(dmg * 1.6) : dmg;
      foe.hp = Math.max(0, foe.hp - d); Object.assign(h, { dmg: d, crit, mult });
      if (m.drain) { const g = Math.round(d * m.drain); u.hp = Math.min(u.hpmax, u.hp + g); h.drain = g; }
      const effs = [...(m.effects || [])]; if (u.npc && moveId === 'elem' && ELEM_RIDER[u.elements[0]]) effs.push(ELEM_RIDER[u.elements[0]]);
      h.effects = [];
      for (const x of effs) {
        if (foe.boss && (x.k === 'stun' || x.k === 'root') && rand(s) < 0.5) continue; // bosses shrug off half of all stuns and roots
        if (foe.gear && foe.gear.poisonImmune && x.k === 'poison') continue;
        if (foe.gear && foe.gear.immune && foe.gear.immune.includes(x.k)) continue;
        if (foe.gear && foe.gear.stunResist && x.k === 'stun' && rand(s) < foe.gear.stunResist) continue;
        if (x.k === 'stun' && hasStatus(foe, 'steady')) continue;
        const chance = Math.min(DEBUFF_CAP, x.chance + (!u.npc && x.chance < 1 ? (u.stats.willpower || 0) * 0.003 : 0));
        if (rand(s) < chance) { addStatus(foe, x.k, x.turns); h.effects.push(x.k); }
      }
      if (foe.boss && !foe.enraged && foe.hp > 0 && foe.hp < foe.hpmax / 2) { foe.enraged = true; addStatus(foe, 'atk_up', 99); h.enrage = true; }
      if (foe.hp <= 0) downed = true;
    }
    e.hits.push(h);
  }
  return downed;
}
export function act(s, side, a) {
  const ev = [];
  if (s.status !== 'active') throw new Error('This fight is over.');
  if (s.side !== side) throw new Error('It is not your turn.');
  const u = s.units[side];
  if (a.t === 'flee') {
    ev.push({ t: 'flee', who: side });
    if (!s.raid) return finish(s, other(side), ev);
    u.hp = 0; ev.push({ t: 'down', who: side }); if (!checkWipe(s, ev)) endTurn(s, ev); return ev;
  }
  if (a.t === 'end') { ev.push({ t: 'endturn', who: side }); endTurn(s, ev); return ev; }
  if (a.t === 'item') {
    const it = ITEMS[a.item];
    if (!it || !(u.items && u.items[a.item] > 0)) throw new Error('You have none of that item left.');
    if (u.ap < it.ap) throw new Error('Not enough AP.');
    if (it.power) { // thrown weapon
      const m = { ...it, id: 'it:' + a.item, style: 'bukijutsu', target: it.aoe ? 'hex' : 'enemy' }, target = a.at;
      if (!target) throw new Error('Choose a target.');
      if (!canHitFrom(s, m, [u.c, u.r], target)) throw new Error(inRange(m, [u.c, u.r], target) ? 'A rock is in the way.' : 'Out of range.');
      const foes = foesOf(s, u), tgt = foes.find((f) => f.c === target[0] && f.r === target[1]);
      if (!it.aoe && !tgt) throw new Error('No enemy there.');
      u.ap -= it.ap; u.items[a.item]--; u.usedItems = u.usedItems || {}; u.usedItems[a.item] = (u.usedItems[a.item] || 0) + 1;
      const e = { t: 'use', who: side, move: 'it:' + a.item, item: a.item, name: it.name, style: 'bukijutsu', element: null, at: target, aoe: it.aoe || 0, hits: [] };
      ev.push(e);
      if (strike(s, u, m, m.id, it.aoe ? foes.filter((f) => dist(target, [f.c, f.r]) <= it.aoe) : [tgt], e)) { for (const h of e.hits) if (s.units[h.who].hp <= 0) ev.push({ t: 'down', who: h.who }); checkWipe(s, ev); }
      return ev;
    }
    u.ap -= it.ap; u.items[a.item]--; u.usedItems = u.usedItems || {}; u.usedItems[a.item] = (u.usedItems[a.item] || 0) + 1;
    const e = { t: 'item', who: side, item: a.item, name: it.name, hits: [] };
    if (a.item === 'pill_heal') { const h = Math.round(u.hpmax * 0.3); u.hp = Math.min(u.hpmax, u.hp + h); e.heal = h; }
    if (a.item === 'pill_chakra') { const g = Math.round(u.chmax * 0.4), g2 = Math.round(u.stmax * 0.4); u.ch = Math.min(u.chmax, u.ch + g); u.st = Math.min(u.stmax, u.st + g2); e.focus = g; }
    if (a.item === 'antidote') { const bad = ['burn', 'poison', 'slow', 'root', 'weaken', 'confuse']; e.cured = u.effects.filter((x) => bad.includes(x.k)).map((x) => x.k); u.effects = u.effects.filter((x) => !bad.includes(x.k)); }
    if (a.item === 'smoke') for (const f of foesOf(s, u)) if (dist([u.c, u.r], [f.c, f.r]) <= 1) { if (!(f.boss && rand(s) < 0.5)) { addStatus(f, 'confuse', 2); e.hits.push({ who: f.id, effects: ['confuse'] }); } }
    ev.push(e);
    return ev;
  }
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
    if (a.move === 'slash') { if (!u.gear || !u.gear.slash) throw new Error('Equip a sword first.'); m.power = u.gear.slash; m.effects = u.gear.slashFx || []; }
    let target = a.at;
    if (m.target === 'self') target = [u.c, u.r];
    if (m.target === 'hex' && m.range[1] === 0) target = [u.c, u.r];
    if (!target) throw new Error('Choose a target.');
    if (m.target !== 'self' && !(m.range[1] === 0) && !inRange(m, [u.c, u.r], target)) throw new Error('Out of range.');
    if (m.target !== 'self' && !(m.range[1] === 0) && !canHitFrom(s, m, [u.c, u.r], target)) throw new Error('A rock is in the way.');
    const foes = foesOf(s, u), tgt = m.target === 'enemy' ? foes.find((f) => f.c === target[0] && f.r === target[1]) : null;
    if (m.target === 'enemy' && !tgt) throw new Error('No enemy there.');
    u.ap -= m.ap; if (!u.npc) { u.st -= m.stamina || 0; u.ch -= m.chakra || 0; const n = cooldownOf(a.move); if (n) { u.cd = u.cd || {}; u.cd[a.move] = n + 1; } }
    const e = { t: 'use', who: side, move: a.move, name: u.npc ? enemyMoveName(u, a.move) : m.name, style: m.style, element: m.element || (u.npc && a.move === 'elem' ? u.elements[0] : null), at: target, aoe: m.aoe, hits: [] };
    ev.push(e);
    if (a.move === 'focus') { const g = 12 + u.level; u.st = Math.min(u.stmax, u.st + g); u.ch = Math.min(u.chmax, u.ch + g); e.focus = g; }
    if (m.heal) { const h = Math.round(u.hpmax * m.heal); u.hp = Math.min(u.hpmax, u.hp + h); e.heal = h; }
    if (m.cleanse) { e.cured = u.effects.filter((x) => DEBUFFS.includes(x.k)).map((x) => x.k); u.effects = u.effects.filter((x) => !DEBUFFS.includes(x.k)); }
    if (m.dispel) { const gone = tgt.effects.filter((x) => BUFFS.includes(x.k)).map((x) => x.k); tgt.effects = tgt.effects.filter((x) => !BUFFS.includes(x.k)); e.hits.push({ who: tgt.id, hit: true, dmg: 0, dispelled: gone, effects: [] }); return ev; }
    if (m.target === 'self') { for (const x of m.effects) addStatus(u, x.k, x.turns + 1); e.self = m.effects.map((x) => x.k); }
    else {
      const downed = strike(s, u, m, a.move, m.aoe ? foes.filter((f) => dist(target, [f.c, f.r]) <= m.aoe) : [tgt], e);
      if (downed) { for (const h of e.hits) if (s.units[h.who].hp <= 0) ev.push({ t: 'down', who: h.who }); if (checkWipe(s, ev)) return ev; }
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
  const u = s.units[side], foes = foesOf(s, u);
  const map = reachable(s, u, u.ap);
  let best = null;
  for (const id of u.moves) {
    const m0 = moveDef(u, id); if (!m0) continue;
    const m = { ...m0, id };
    if (u.ap < m.ap || (u.cd && u.cd[id] > 0) || (!u.npc && (u.st < (m.stamina || 0) || u.ch < (m.chakra || 0)))) continue;
    if (m.dispel || m.cleanse) continue; // left to human players
    if (m.target === 'self') {
      if (id === 'focus') { if (!u.npc && (u.ch < u.chmax * 0.25 || u.st < u.stmax * 0.2)) best = pick(best, { score: 30, a: { t: 'use', move: id } }); continue; }
      const useful = m.heal ? (u.hp < u.hpmax * 0.5 ? 40 : 0) : m.effects.every((x) => hasStatus(u, x.k)) ? 0 : (s.turn <= 3 || u.hp > u.hpmax * 0.4 ? 18 : 6);
      if (id === 'guard') continue;
      if (useful) best = pick(best, { score: useful, a: { t: 'use', move: id } });
      continue;
    }
    for (const foe of foes) {
      const fpos = [foe.c, foe.r];
      let opt = null;
      for (const [k, h] of map) {
        const from = [h.c, h.r];
        if (u.ap - h.cost < m.ap) continue;
        const ok = m.range[1] === 0 ? dist(from, fpos) <= m.aoe : canHitFrom(s, m, from, fpos);
        if (!ok) continue;
        const keepAway = u.ai === 'ranged' || m.range[1] >= 3 ? dist(from, fpos) * 0.6 : 0;
        const sc = -h.cost + keepAway;
        if (!opt || sc > opt.sc) opt = { sc, h };
      }
      if (!opt) continue;
      const from = [opt.h.c, opt.h.r], center = m.range[1] === 0 ? from : fpos;
      const n = m.aoe ? foes.filter((f) => dist(center, [f.c, f.r]) <= m.aoe).length : 1;
      const exp = damage(s, u, foe, m, false).dmg * (m.acc || 0.9) * n + (m.effects.length ? 6 : 0) + (1 - foe.hp / foe.hpmax) * 8;
      const score = exp - opt.h.cost * 0.5;
      const act = opt.h.cost > 0 ? { t: 'move', to: [opt.h.c, opt.h.r] } : { t: 'use', move: id, at: m.range[1] === 0 ? null : fpos };
      best = pick(best, { score, a: act });
    }
  }
  if (best) return best.a;
  let step = null;
  const near = foes.reduce((a, f) => (!a || dist([u.c, u.r], [f.c, f.r]) < dist([u.c, u.r], [a.c, a.r]) ? f : a), null);
  if (!near) return { t: 'end' };
  const fpos = [near.c, near.r];
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
export function knownMoves({ rankIndex = 0, elements = [], bloodline = null, scrolls = [] }) {
  return Object.entries(MOVES).filter(([id, m]) => {
    if (m.gear) return false;
    if (m.scroll) return scrolls.includes(id);
    if (m.style === 'none') return true;
    if (m.style === 'bloodline') return m.bloodline === bloodline && m.tier <= rankIndex;
    if (m.tier > rankIndex) return false;
    if (m.style === 'ninjutsu') return elements.includes(m.element);
    return true;
  }).map(([id]) => id);
}

// ---------- building fighters from game data (shared by server and offline mode) ----------
export const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
export const KITS = { beast: ['claw', 'bite', 'roar'], ninja: ['strike', 'throw', 'elem', 'heavy'], snake: ['claw', 'venom', 'bite'], ranged: ['throw', 'elem', 'guard', 'strike'],
  // Jonin-era enemies
  mistnin: ['strike', 'ice', 'throw', 'mend'], alchemist: ['venom', 'hex', 'throw', 'mend'], frostbeast: ['bite', 'ice', 'claw'], swordsman: ['sever', 'strike', 'heavy', 'guard'],
  scorpion: ['claw', 'sting', 'quake'], puppeteer: ['puppet', 'throw', 'hex', 'guard'], puppet: ['strike', 'puppet', 'heavy'], golem: ['heavy', 'quake', 'guard'],
  cultist: ['hex', 'illusion', 'elem', 'strike'], shade: ['illusion', 'drain', 'strike'], oracle: ['illusion', 'ice', 'mend', 'elem'], hound: ['bite', 'claw', 'howl'] };
export const RANGED_KITS = ['ranged', 'mistnin', 'alchemist', 'puppeteer', 'oracle', 'cultist'];
// c: character row; jl: {move: level}; pools: {php,pmax,pst,pstmax,pch,pchmax}
export const ALWAYS = ['focus', 'guard'];
// the jutsu a character takes into a fight: their saved loadout, or (if none) their strongest known jutsu
export function loadoutMoves(c) {
  const ri = Math.max(0, RANKS.indexOf(c.rank)), elements = [c.element, c.element2].filter(Boolean);
  const known = knownMoves({ rankIndex: ri, elements, bloodline: c.bloodline, scrolls: c.scrolls || [] }).filter((m) => !ALWAYS.includes(m) && !MOVES[m].counter);
  const slots = c.jutsu_slots || 6, saved = (c.loadout && c.loadout.jutsu) || [];
  let pick = saved.filter((m) => known.includes(m)).slice(0, slots);
  if (!pick.length) pick = [...known].sort((a, b) => MOVES[b].tier - MOVES[a].tier).slice(0, slots);
  return { known, pick, slots };
}
export function loadoutItems(c) {
  const owned = c.items || {}, saved = (c.loadout && c.loadout.items) || [], out = {};
  for (const id of saved.slice(0, ITEM_SLOTS)) if (ITEMS[id] && owned[id] > 0) out[id] = owned[id];
  return out;
}
export function playerSpec(c, jl, pools) {
  const elements = [c.element, c.element2].filter(Boolean);
  const g = gearStats(c), hpx = 1 + g.hp;
  return { uid: c.user_id || null, name: c.name, look: c.appearance, kind: 'ninja', level: c.level, stats: { strength: c.strength, agility: c.agility, intelligence: c.intelligence, willpower: c.willpower },
    elements, bloodline: c.bloodline || null, moves: [...loadoutMoves(c).pick, ...(g.weapon ? ['slash'] : []), ...ALWAYS, ...COUNTERS.filter((id) => (c.scrolls || []).includes(id))], items: loadoutItems(c), jl: jl || {}, gear: g,
    hpmax: Math.round(pools.pmax * hpx), stmax: pools.pstmax, chmax: pools.pchmax, hp: Math.round(pools.php * hpx), st: pools.pst, ch: pools.pch };
}
// st: battle state with foe {hp,atk,def,kit,element,level} and enemy {name,kind,look}
export function enemySpec(st) {
  const f = st.foe, e = st.enemy;
  // academy sparring partners fight exactly like players (same techniques and rules)
  if (f.kit === 'student') {
    const v = f.atk, c = { name: e.name, rank: 'Academy Student', level: f.level || 1, strength: v, agility: v, intelligence: v, willpower: v, element: f.element, appearance: e.look };
    const sp = playerSpec(c, {}, poolsOf(c));
    if (f.moves && f.moves.length) sp.moves = f.moves.filter((m) => MOVES[m]);
    return { ...sp, ai: f.ranged ? 'ranged' : 'melee' };
  }
  return { name: e.name, look: e.look, kind: e.kind, level: f.level || e.level, npc: true, hpmax: f.hp, atk: f.atk, def: f.def, element: f.element || null,
    moves: KITS[f.kit] || KITS.ninja, ai: RANGED_KITS.includes(f.kit) ? 'ranged' : 'melee' };
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
  s.pvp = true;
  return s;
}
export const DUEL_TURN_SEC = 60;
// XP to go from level lv to lv+1 (same formula as the database's xp_need)
export function xpNeed(lv) { return 100 * lv * (lv < 5 ? 3 : lv < 15 ? 22 : lv < 30 ? 85 : 190); }
export const MISSION_DAILY_LIMIT = 20;
// XP for one training session (10 energy), same as the database's training_xp
export function trainingXp(lv) { return Math.ceil(xpNeed(lv) / (lv < 5 ? 80 : lv < 15 ? 450 : lv < 30 ? 900 : 1300)); }
// mission, quest and boss XP grow with level (same as the database's reward_mult)
export function rewardMult(lv) { return lv < 5 ? 3 : lv < 15 ? 3.96 : lv < 30 ? 4.5 : 5.9; }

// boss for a team of n players (1-3): smaller teams face a weaker boss
export const BOSSES = {
  iron: { name: 'Warlord Gorou', kind: 'ninja', kit: 'warlord', hp: 7600, atk: 85, def: 22, element: 'earth', level: 26, look: { hairStyle: 0, hair: 0, skin: 3, outfit: 6, band: 1, bandSpot: 1 } },
  serpent: { name: 'Venomfang', kind: 'beast_snake', kit: 'wyrm', hp: 8000, atk: 86, def: 22, element: null, level: 26, look: { tint: '#3a6a3a' } },
  shrine: { name: 'The Hollow Shogun', kind: 'ninja', kit: 'shogun', hp: 14600, atk: 188, def: 36, element: 'lightning', level: 40, look: { hairStyle: 3, hair: 0, skin: 5, outfit: 4, band: 2, bandSpot: 0 } },
  mist: { name: 'Kirishima the Mist Reaper', kind: 'ninja', kit: 'reaper', hp: 40000, atk: 285, def: 40, element: 'water', level: 42, look: { hairStyle: 1, hair: 7, skin: 0, outfit: 5, band: 2, bandSpot: 2 } },
  sands: { name: 'Sekiryu the Scorpion King', kind: 'ninja', kit: 'scorpionking', hp: 54000, atk: 330, def: 46, element: 'earth', level: 52, look: { hairStyle: 4, hair: 3, skin: 2, outfit: 6, band: 1, bandSpot: 1 } },
  eclipse: { name: 'Mother Yoru, the Eclipse Sage', kind: 'ninja', kit: 'eclipse', hp: 80000, atk: 490, def: 52, element: 'wind', level: 62, look: { hairStyle: 2, hair: 6, skin: 4, outfit: 3, band: 1, bandSpot: 0 } },
};
const BOSS_SCALE = { 1: [0.3, 0.65], 2: [0.6, 0.85], 3: [1, 1] };
export function bossSpec(line, n) {
  const b = BOSSES[line], [hf, af] = BOSS_SCALE[Math.max(1, Math.min(3, n))];
  return { name: b.name, look: b.look, kind: b.kind, level: b.level, npc: true, boss: true, apBase: 7, hpmax: Math.round(b.hp * hf), atk: Math.round(b.atk * af), def: b.def,
    element: b.element, moves: BOSS_KITS[b.kit], ai: 'melee' };
}
