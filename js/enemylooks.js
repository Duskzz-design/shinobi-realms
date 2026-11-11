// How each PvE enemy and boss is dressed. Merged on top of the look stored with the enemy, by name.
// Ninja fields: eq (gear ids), robe (colour), mask ('cloth' | 'oni'), maskCol, hat ('straw'), body ('puppet' | 'golem' | 'shade' | 'wraith'),
// glow (eye colour), tail ('scorpion'). Beasts: v (variant).
const E = {
  // Academy & exams
  'Proctor Ume': { eq: { head: 'flak_head', chest: 'flak_chest' } },
  'Sensei Hiro': { eq: { head: 'flak_head', chest: 'flak_chest', arms: 'flak_arms', weapon: 'katana' } },
  'Thorn Serpent': { v: 'thorn' },
  'Rival Sayo': { eq: { head: 'genin_head', arms: 'genin_arms', weapon: 'tanto' } },
  'Taro the Iron Fist': { eq: { head: 'genin_head', chest: 'genin_chest', arms: 'flak_arms' } },
  'Storm Alpha': { v: 'alpha' },
  'Elite Mirei': { eq: { head: 'flak_head', chest: 'anbu_chest', arms: 'anbu_arms', weapon: 'katana' } },
  'Champion Raiden': { eq: { head: 'flak_head', chest: 'flak_chest', arms: 'flak_arms', legs: 'flak_legs', weapon: 'katana' } },
  // Missions
  'Road Bandit': { mask: 'cloth', maskCol: '#6a4024', eq: { arms: 'genin_arms', weapon: 'tanto' } },
  'Shadow Wolf': { v: 'shadow' },
  'Smuggler Chief': { hat: 'straw', eq: { chest: 'genin_chest', weapon: 'tanto' } },
  'Rogue Genin Kaz': { eq: { head: 'genin_head', legs: 'genin_legs', weapon: 'tanto' } },
  'Swamp Serpent': { v: 'swamp' },
  'Exile Ryuto': { eq: { head: 'reaper_hood', chest: 'flak_chest', weapon: 'katana' } },
  'Warlord Gonzo': { eq: { head: 'iron_helm', chest: 'flak_chest', arms: 'flak_arms', weapon: 'cleaver' } },
  'Masked Cultist': { robe: '#4a2a6a', mask: 'oni' },
  'Thunder Wolf': { v: 'thunder' },
  'Rogue Master Oboro': { mask: 'cloth', maskCol: '#24262e', eq: { chest: 'anbu_chest', arms: 'anbu_arms', legs: 'anbu_legs', weapon: 'anbu_blade' } },
  // Quest lines
  'Bandit Raider': { mask: 'cloth', maskCol: '#7a4a24', eq: { legs: 'genin_legs', weapon: 'tanto' } },
  'Bandit Scout': { mask: 'cloth', maskCol: '#5a3418', hat: 'straw' },
  'Lieutenant Senzo': { eq: { head: 'iron_helm', chest: 'flak_chest', arms: 'flak_arms', weapon: 'katana' } },
  'Marsh Viper': { v: 'viper' },
  'Swamp Witch Mirei': { robe: '#2e5a34', eq: { head: 'reaper_hood' }, glow: '#9cff6a' },
  'Cult Leader Jabami': { robe: '#8a2a22', mask: 'oni', eq: { chest: 'kings_mantle' } },
  'Shrine Wraith': { body: 'wraith' },
  'Ash Wolf': { v: 'ash' },
  'Herald Kurogane': { eq: { head: 'iron_helm', chest: 'hollow_plate', arms: 'flak_arms', weapon: 'katana' } },
  'Reaper Scout': { eq: { head: 'anbu_head', chest: 'anbu_chest', weapon: 'tanto' } },
  'Mist Assassin': { eq: { head: 'anbu_head', chest: 'anbu_chest', arms: 'anbu_arms', legs: 'tidewalker_greaves', weapon: 'mistcutter' } },
  'Reaper Alchemist': { robe: '#2f6a7a', mask: 'cloth', maskCol: '#e8e0cf', eq: { head: 'reaper_hood' } },
  'Frost Wolf': { v: 'frost' },
  'Swordsman Raizo': { hat: 'straw', eq: { chest: 'flak_chest', legs: 'tidewalker_greaves', weapon: 'katana' } },
  'Dune Raider': { mask: 'cloth', maskCol: '#d8b070', eq: { arms: 'sandshell_bracers', weapon: 'tanto' } },
  'Sand Wyrm': { v: 'wyrm' },
  'Puppet Master Ayatsu': { robe: '#5a2a6a', eq: { head: 'reaper_hood' }, glow: '#d8b0ff' },
  'War Puppet': { body: 'puppet', eq: { weapon: 'stingblade' } },
  'Stone Guardian': { body: 'golem' },
  'Vizier Kazahana': { robe: '#c8a050', mask: 'cloth', maskCol: '#f2c14a', eq: { chest: 'kings_mantle' } },
  'Covenant Monk': { robe: '#3a2a5a', hat: 'straw' },
  'Pass Shade': { body: 'shade' },
  'Oracle Shirayuki': { robe: '#e8ecf0', eq: { head: 'eclipse_crown' }, glow: '#9fd8ff' },
  'Eclipse Hound': { v: 'eclipse' },
  'Dusk Blade Tsubame': { eq: { head: 'anbu_head', chest: 'anbu_chest', arms: 'anbu_arms', legs: 'moonshadow_greaves', weapon: 'duskfang' } },
  'High Priest Kagerou': { robe: '#5a2a8a', mask: 'oni', eq: { chest: 'kings_mantle' } },
  // Bosses: each wears the set it drops
  'Warlord Gorou': { eq: { head: 'iron_helm', chest: 'flak_chest', arms: 'flak_arms', legs: 'flak_legs', weapon: 'cleaver' }, outfit: 6 },
  'Venomfang': { v: 'giant' },
  'The Hollow Shogun': { body: 'shade', glow: '#ffe07a', eq: { head: 'iron_helm', chest: 'hollow_plate', arms: 'flak_arms', legs: 'flak_legs', weapon: 'thunderclap' } },
  'Kirishima the Mist Reaper': { robe: '#3a4a5a', eq: { head: 'reaper_hood', chest: 'anbu_chest', legs: 'tidewalker_greaves', weapon: 'mistcutter' }, glow: '#7ce8ff' },
  'Sekiryu the Scorpion King': { tail: 'scorpion', tailCol: '#c8892f', mask: 'cloth', maskCol: '#8a2a22', eq: { head: 'eclipse_crown', chest: 'kings_mantle', arms: 'sandshell_bracers', weapon: 'stingblade' } },
  'Mother Yoru, the Eclipse Sage': { robe: '#2e1a44', glow: '#d8b0ff', eq: { head: 'eclipse_crown', legs: 'moonshadow_greaves', weapon: 'duskfang' } },
};
export function enemyLook(name, look) {
  const o = E[name]; if (!o) return look || {};
  return { ...(look || {}), ...o };
}
export function beastVariant(name) { return (E[name] && E[name].v) || ''; }
export const ENEMY_NAMES = Object.keys(E);
