// Procedural pixel-art ninja sprites. 22x28 grid (body 18 wide + room for a drawn weapon), auto-outlined.
// look = appearance from the creator, plus optional look.eq = equipped gear ids {weapon, head, chest, arms, legs}.
export const W = 22, H = 28;

export const PALETTES = {
  hair: ['#1d1a2b', '#5b3a24', '#c8892f', '#f2d04b', '#d8452f', '#3b6fd4', '#e9e3d8', '#d86fae'],
  skin: ['#ffe0c2', '#f5c99b', '#e0a878', '#c38556', '#8f5a35', '#5e3a22'],
  outfit: ['#e8742c', '#2f5fa8', '#3a8a4a', '#7a3ea0', '#2b2b38', '#c23a3a', '#8a6a3a', '#3fa3a3'],
  band: ['#2b4fa0', '#1d1d24', '#c23a3a', '#e8e0cf'],
};
export const HAIR_STYLES = ['Spiky', 'Short', 'Long', 'Topknot', 'Ponytail'];
export const BAND_SPOTS = ['Forehead', 'Neck', 'Arm', 'None'];

export const VILLAGES = {
  pine: { name: 'Hidden Pine', short: 'Pine', color: '#3a8a4a', dark: '#245c30', desc: 'Forest village of balance. Gentle valleys, tall pines, quick feet.' },
  dune: { name: 'Hidden Ember', short: 'Ember', color: '#e07a2c', dark: '#9a4a14', desc: 'Canyon fortress in the red sands. Patient, fierce, unbreakable.' },
  tide: { name: 'Hidden Tide', short: 'Tide', color: '#2f7fc4', dark: '#1d4f80', desc: 'Island harbour wrapped in sea fog. Silent, fluid, deadly.' },
};

export const DEFAULT_LOOK = { hairStyle: 0, hair: 0, skin: 1, outfit: 0, band: 0, bandSpot: 0 };

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// How each piece of gear looks on a ninja. Weapons: len short|long|big; colours for blade, hilt, guard, sheath.
const WEAPON_LOOK = {
  tanto: { len: 'short', blade: '#d6dae2', hilt: '#3a2a1e', guard: '#8a8f9c', sheath: '#6a4024' },
  katana: { len: 'long', blade: '#e4e8ee', hilt: '#e8e0cf', wrap: '#2b2b38', guard: '#f2c14a', sheath: '#2b2b38' },
  anbu_blade: { len: 'long', blade: '#c9ccd4', hilt: '#3a3e48', wrap: '#1d1d24', guard: '#8a8f9c', sheath: '#1d1d24' },
  cleaver: { len: 'big', blade: '#b4b9c2', hilt: '#5a3a22', guard: '#3a2a1e' },
  fangblade: { len: 'long', blade: '#8be08f', hilt: '#2e5a34', wrap: '#1d3a22', guard: '#e8e0cf', sheath: '#2e5a34' },
  thunderclap: { len: 'long', blade: '#ffe07a', hilt: '#2b2b38', wrap: '#f2c14a', guard: '#f2c14a', sheath: '#33335a' },
  mistcutter: { len: 'long', blade: '#c8ecf6', hilt: '#3a5a7a', wrap: '#e8f4ff', guard: '#e8f4ff', sheath: '#4a6a8a' },
  stingblade: { len: 'long', blade: '#f0a848', hilt: '#5a2a1a', wrap: '#c43c32', guard: '#c43c32', sheath: '#7a3a1a' },
  duskfang: { len: 'long', blade: '#c49af0', hilt: '#2a1a3a', wrap: '#9a5ad0', guard: '#f2c14a', sheath: '#3a2a5a' },
};
// armour: main colour, light, dark, and an optional accent
const ARMOUR_LOOK = {
  genin_head: { c: '#2b4fa0' }, flak_head: { c: '#4e5e34', big: true }, anbu_head: { mask: true },
  iron_helm: { helm: true, c: '#8a8f9c', l: '#c9ccd4', d: '#5a5f6a' }, reaper_hood: { hood: true, c: '#3a3e4a', l: '#545a6a', d: '#24262e' },
  eclipse_crown: { crown: true, c: '#f2c14a', l: '#fff1a8', d: '#b8862a', a: '#9a5ad0' },
  genin_chest: { strap: true, c: '#6a4024', a: '#c8a070' }, flak_chest: { vest: true, c: '#5f7040', l: '#7a8c52', d: '#44522c' },
  anbu_chest: { plate: true, c: '#d8dce2', l: '#f4f6f8', d: '#9aa0aa' }, hollow_plate: { plate: true, c: '#4a4e5a', l: '#6a707c', d: '#30333c', a: '#ffe07a' },
  kings_mantle: { cape: true, c: '#a8282a', d: '#701a1c', a: '#f2c14a' },
  genin_arms: { c: '#e8e0cf', d: '#c2b8a4' }, flak_arms: { c: '#7a8088', d: '#5a5f68', l: '#a0a6ae' }, anbu_arms: { c: '#e8ecf0', d: '#a8aeb8', l: '#ffffff' },
  scale_bracers: { c: '#3a8a5a', d: '#245c3a', l: '#6ac08a' }, sandshell_bracers: { c: '#d8b070', d: '#a8803e', l: '#f0d49a' },
  genin_legs: { c: '#e8e0cf', d: '#c2b8a4' }, flak_legs: { c: '#7a8088', d: '#5a5f68', l: '#a0a6ae' }, anbu_legs: { c: '#3a3e48', d: '#24262e', l: '#6a707c' },
  tidewalker_greaves: { c: '#2f6fb4', d: '#1d4f80', l: '#6aa8e8' }, moonshadow_greaves: { c: '#4a2a6a', d: '#2e1a44', l: '#8a6ac8' },
};

// dir: 0 down, 1 left, 2 right, 3 up. frame: 0 idle, 1/2 walk, 3 attack
export function drawNinjaRaw(look, dir = 0, frame = 0) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // body coordinates: head top at y=1, feet at y=26; x 0..17 is the body box (centred at 8.5), shifted 2 right
  const P = (col, px, py, w = 1, h = 1) => { if (!col) return; x.fillStyle = col; x.fillRect(px + 2, py + 1, w, h); };
  const line = (col, x0, y0, x1, y1, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) P(col, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w); };
  const L = { ...DEFAULT_LOOK, ...look };
  const eq = L.eq || {};
  const A = (slot) => ARMOUR_LOOK[eq[slot]] || null;
  const wpn = WEAPON_LOOK[eq.weapon] || null;
  const head = A('head'), chest = A('chest'), arms = A('arms'), legs = A('legs');
  const fullAnbu = ['head', 'chest', 'arms', 'legs'].every((s) => String(eq[s] || '').startsWith('anbu_'));
  // special bodies for non-human enemies: wooden puppet, stone golem, living shadow, pale wraith
  const BODY = { puppet: { skin: '#c8945a', hair: '#5a3418', out: '#7a4a2a' }, golem: { skin: '#9a9282', hair: '#6a6252', out: '#7a7266' },
    shade: { skin: '#3a3450', hair: '#1d1828', out: '#241e34' }, wraith: { skin: '#cfe0ea', hair: '#e8f0f4', out: '#8aa4b8' } }[L.body] || null;
  const hair = BODY ? BODY.hair : PALETTES.hair[L.hair] || PALETTES.hair[0];
  const skin = BODY ? BODY.skin : PALETTES.skin[L.skin] || PALETTES.skin[1];
  const out = L.robe || (BODY ? BODY.out : fullAnbu ? '#3a3d48' : PALETTES.outfit[L.outfit] || PALETTES.outfit[0]);
  const band = PALETTES.band[L.band] || PALETTES.band[0];
  const pants = '#33334a', pantsD = '#232333', pantsL = '#47476a';
  const metal = '#d6dae2', metalD = '#8a8f9c', metalL = '#ffffff';
  const outD = shade(out, -40), outDD = shade(out, -70), outL = shade(out, 32);
  const skinD = shade(skin, -28), skinDD = shade(skin, -60), skinL = shade(skin, 14);
  const hairD = shade(hair, -38), hairL = shade(hair, 38);
  const eye = L.glow || (L.body === 'shade' ? '#d8b0ff' : L.body === 'wraith' ? '#7ce8ff' : L.body === 'golem' ? '#ffb04a' : '#20162a');
  const blush = BODY ? skin : mix(skin, '#ff6a6a', 0.28), mouth = shade(skin, -70);
  const sandal = '#4a3020', sandalD = '#2e1c12';
  const side = dir === 1 || dir === 2, back = dir === 3, front = dir === 0;
  const walkA = frame === 1, walkB = frame === 2, atk = frame === 3;
  const hs = L.hairStyle;
  const covered = head && (head.helm || head.hood);

  // ---------- behind the body ----------
  if (L.tail === 'scorpion') { // segmented tail arcing up over the shoulder, stinger raised
    const tc = L.tailCol || '#c8892f', td = shade(tc, -45), tl = shade(tc, 40);
    const segs = side ? [[4, 19], [2, 16], [1, 12], [1, 8], [2, 5], [4, 3], [6, 2]] : [[12, 20], [15, 18], [17, 14], [18, 10], [17, 6], [15, 3], [13, 2]];
    segs.forEach(([a, b], i) => { P(tc, a - 1, b - 1, 3, 3); P(tl, a - 1, b - 1, 1, 1); P(td, a + 1, b + 1, 1, 1); if (i % 2) P(td, a - 1, b, 3, 1); });
    const [sx, sy] = segs[segs.length - 1]; P('#c43c32', sx + (side ? 2 : -2), sy, 2, 2); P('#ffd36b', sx + (side ? 3 : -2), sy + 2, 1, 2);
  }
  if (chest && chest.cape) { // royal mantle hangs behind
    if (front) { P(chest.d, 2, 13, 2, 11); P(chest.d, 14, 13, 2, 11); P(chest.c, 3, 13, 1, 10); P(chest.c, 14, 13, 1, 10); }
    if (side) { P(chest.c, 3, 12, 3, 12); P(chest.d, 3, 21, 3, 3); P(chest.d, 3, 12, 1, 12); }
  }
  if (hs === 2 && !covered) { // long hair behind the shoulders
    if (front) { P(hairD, 3, 5, 2, 10); P(hairD, 13, 5, 2, 10); P(hair, 3, 5, 1, 8); P(hair, 14, 5, 1, 8); }
    if (side) { P(hair, 4, 5, 4, 10); P(hairD, 4, 12, 4, 3); }
  }
  if (hs === 4 && !covered && side) { P(hair, 2, 4, 2, 2); P(hair, 1, 6, 2, 3); P(hairD, 1, 9, 2, 2); }
  const sheathed = wpn && !atk;
  const drawSheath = (x0, y0, x1, y1, hx0, hy0, hx1, hy1) => { // sheath line + hilt line
    if (wpn.len === 'big') { line(wpn.blade, x0, y0, x1, y1, 2); line(shade(wpn.blade, -45), x0 + 1, y0 + 1, x1 + 1, y1, 1); }
    else line(wpn.sheath, x0, y0, x1, y1, 1);
    line(wpn.hilt, hx0, hy0, hx1, hy1, 1);
    if (wpn.wrap) P(wpn.wrap, Math.round((hx0 + hx1) / 2), Math.round((hy0 + hy1) / 2));
    P(wpn.guard, hx1, hy1 + 1); P(wpn.guard, hx1 - 1, hy1 + 1);
  };
  if (sheathed && wpn.len !== 'short') {
    if (front) drawSheath(14, 9, 2, 21, 17, 5, 15, 7);
    if (side) drawSheath(6, 9, 13, 21, 3, 5, 5, 7);
  }

  // ---------- legs + feet ----------
  if (L.body === 'wraith') { // fading ghostly trail instead of legs
    P(out, side ? 6 : 5, 20, side ? 6 : 8, 2); P(shade(out, 25), side ? 6 : 5, 22, side ? 5 : 7, 2); P(shade(out, 45), side ? 7 : 6, 24, side ? 3 : 5, 1); P(shade(out, 60), side ? 8 : 7, 25, side ? 2 : 3, 1);
  } else if (!side) {
    const lU = walkA ? 1 : 0, rU = walkB ? 1 : 0;
    // crotch + legs
    P(pants, 5, 20, 8, 2); P(pantsD, 8, 21, 2, 1);
    P(pants, 5, 21, 3, 4 - lU); P(pantsL, 5, 21, 1, 3 - lU); P(pantsD, 7, 22, 1, 3 - lU);
    P(pants, 10, 21, 3, 4 - rU); P(pantsD, 12, 21, 1, 4 - rU); P(pantsL, 10, 22, 1, 2 - rU);
    const shin = (lx, up) => {
      if (!legs) return;
      P(legs.c, lx, 22 - up, 3, 3); P(legs.d, lx, 24 - up, 3, 1); if (legs.l) P(legs.l, lx, 22 - up, 1, 2);
      if (!legs.l) { P(legs.d, lx, 23 - up, 3, 1); } // bandage wraps
    };
    shin(5, lU); shin(10, rU);
    // sandals with toes
    P(sandal, 5, 25 - lU, 3, 1); P(sandalD, 5, 26 - lU, 3, 1); P(skin, 6, 25 - lU, 1, 1);
    P(sandal, 10, 25 - rU, 3, 1); P(sandalD, 10, 26 - rU, 3, 1); P(skin, 11, 25 - rU, 1, 1);
  } else {
    const legPair = (fx, bx) => { // fx/bx: x of front and back leg
      P(pantsD, bx, 20, 3, 5); P(sandalD, bx, 25, 4, 2);
      P(pants, fx, 20, 3, 5); P(pantsL, fx, 20, 1, 4);
      if (legs) { P(shade(legs.c, -25), bx, 22, 3, 3); P(legs.c, fx, 22, 3, 3); if (legs.l) P(legs.l, fx, 22, 1, 2); else P(legs.d, fx, 23, 3, 1); }
      P(sandal, fx, 25, 4, 1); P(sandalD, fx, 26, 4, 1); P(skin, fx + 3, 25, 1, 1);
    };
    P(pants, 6, 19, 6, 2);
    if (walkA) legPair(9, 5); else if (walkB) legPair(5, 9); else legPair(7, 8);
  }

  // long robe over the legs (cultists, witches, priests, oracles)
  if (L.robe) {
    const rD = shade(L.robe, -40), rL = shade(L.robe, 28);
    if (!side) { P(L.robe, 4, 19, 10, 7); P(rL, 4, 19, 1, 6); P(rD, 13, 19, 1, 7); P(rD, 8, 21, 1, 5); P(rD, 4, 25, 10, 1); }
    else { P(L.robe, 5, 19, 8, 7); P(rL, 6, 19, 1, 6); P(rD, 5, 25, 8, 1); P(rD, 10, 21, 1, 4); }
  }
  // ---------- torso ----------
  const tx0 = side ? 6 : 4, tw = side ? 6 : 10;
  P(out, tx0, 12, tw, 8); P(outL, tx0 + 1, 13, 1, 5); P(outD, tx0 + tw - 1, 13, 1, 6); P(outD, tx0, 18, tw, 1);
  if (front) { P(outDD, 8, 12, 2, 1); P(skinD, 8, 12, 2, 1); P(outD, 7, 12, 1, 2); P(outD, 10, 12, 1, 2); P('#3a3a48', 8, 13, 2, 1); } // collar + mesh undershirt
  if (side) P(outD, 10, 12, 2, 1);
  // belt
  P('#3a2a1e', tx0, 19, tw, 1);
  if (front) { P(metalD, 8, 19, 2, 1); } else if (back) { P('#3a2a1e', 8, 18, 2, 1); } else P(metalD, 10, 19, 1, 1);
  // chest armour
  if (chest) {
    if (chest.strap) { line(chest.c, tx0 + 1, 12, tx0 + tw - 2, 18); if (front) { P(chest.a, 11, 16, 2, 2); P(shade(chest.a, -40), 11, 17, 2, 1); } }
    if (chest.vest) {
      P(chest.c, tx0, 12, tw, 7); P(chest.d, tx0 + tw - 1, 12, 1, 7); P(chest.l, tx0, 13, 1, 5);
      if (front) { P(chest.l, 5, 12, 3, 1); P(chest.l, 10, 12, 3, 1); P(skinD, 8, 12, 2, 1); P(chest.d, 8, 13, 2, 6); P(chest.l, 5, 15, 2, 2); P(chest.d, 5, 15, 2, 1); P(chest.l, 11, 15, 2, 2); P(chest.d, 11, 15, 2, 1); }
      if (back) { P(chest.l, 5, 12, 8, 1); P(chest.d, 6, 15, 6, 1); }
      if (side) { P(chest.l, 7, 12, 4, 1); P(chest.l, 9, 15, 2, 2); }
    }
    if (chest.plate) {
      const px0 = side ? 7 : 5, pw = side ? 5 : 8;
      P(chest.c, px0, 13, pw, 5); P(chest.l, px0, 13, pw, 1); P(chest.l, px0, 13, 1, 4); P(chest.d, px0, 17, pw, 1); P(chest.d, px0 + pw - 1, 13, 1, 5);
      if (!side) { P('#2b2b38', 5, 12, 2, 1); P('#2b2b38', 11, 12, 2, 1); }
      if (chest.a && front) { P(chest.a, 9, 14); P(chest.a, 8, 15); P(chest.a, 9, 16); }
    }
    if (chest.cape) {
      if (front) { P(chest.a, 5, 12, 8, 1); P(shade(chest.a, -40), 8, 13, 2, 1); }
      if (back) { P(chest.c, 3, 12, 12, 12); P(chest.d, 3, 21, 12, 3); P(chest.d, 8, 13, 1, 10); P(chest.a, 4, 12, 10, 1); }
      if (side) { P(chest.a, 6, 12, 5, 1); }
    }
  }

  // ---------- arms ----------
  const sw = walkA ? 1 : walkB ? -1 : 0;
  const armWear = (ax, ay, w) => { if (!arms) return; P(arms.c, ax, ay + 3, w, 3); P(arms.d, ax, ay + 5, w, 1); if (arms.l) P(arms.l, ax, ay + 3, 1, 2); else P(arms.d, ax, ay + 4, w, 1); };
  if (!side) {
    const ly = 12 + Math.max(0, sw), ry = 12 + Math.max(0, -sw);
    P(out, 2, ly, 2, 6); P(outL, 2, ly, 1, 4); P(outD, 3, ly + 5, 1, 1); armWear(2, ly, 2); P(skin, 2, ly + 6, 2, 1); P(skinD, 3, ly + 7, 1, 1); P(skin, 2, ly + 7, 1, 1);
    if (atk) { // right arm thrust forward/up
      P(out, 14, 12, 2, 2); P(out, 15, 11, 2, 2); P(outD, 15, 12, 2, 1); P(skin, 16, 10, 2, 2); P(skinD, 17, 11, 1, 1);
    } else {
      P(out, 14, ry, 2, 6); P(outD, 15, ry, 1, 6); armWear(14, ry, 2); P(skin, 14, ry + 6, 2, 1); P(skinD, 15, ry + 6, 1, 2); P(skin, 14, ry + 7, 1, 1);
    }
  } else if (atk) {
    P(out, 9, 13, 5, 2); P(outD, 9, 14, 5, 1); if (arms) { P(arms.c, 11, 13, 3, 2); P(arms.d, 11, 14, 3, 1); } P(skin, 14, 13, 2, 2); P(skinD, 15, 14, 1, 1);
  } else {
    const ax = 8 + sw;
    P(outD, ax, 13, 3, 5); P(out, ax, 13, 2, 5); P(outL, ax, 13, 1, 3); armWear(ax, 13, 3); P(skin, ax, 18, 2, 2); P(skinD, ax + 1, 19, 1, 1);
  }
  // cosmetic bands on neck / arm
  if (L.bandSpot === 1) { P(band, side ? 6 : 5, 12, side ? 6 : 8, 1); P(shade(band, 30), side ? 7 : 6, 12, 2, 1); }
  if (L.bandSpot === 2) { if (!side) P(band, 2, 14 + Math.max(0, sw), 2, 1); else P(band, 8 + sw, 14, 3, 1); }
  // short blade at the hip
  if (sheathed && wpn.len === 'short') {
    if (front) { P(wpn.sheath, 12, 19, 3, 1); P(wpn.hilt, 15, 18, 1, 1); P(wpn.hilt, 16, 17, 1, 1); P(wpn.guard, 15, 19, 1, 1); }
    if (side) { P(wpn.sheath, 4, 19, 3, 1); P(wpn.hilt, 3, 18, 1, 1); P(wpn.guard, 4, 18, 1, 1); }
    if (back) { P(wpn.sheath, 3, 19, 3, 1); P(wpn.hilt, 2, 18, 1, 1); }
  }

  // ---------- head ----------
  if (!side) {
    P(skin, 6, 1, 6, 1); P(skin, 5, 2, 8, 1); P(skin, 4, 3, 10, 8); P(skin, 5, 11, 8, 1);
    P(skinL, 5, 3, 2, 2); P(skinD, 13, 4, 1, 7); P(skinD, 6, 11, 6, 1); P(skinDD, 7, 12, 4, 0);
    P(skinD, 8, 12, 2, 1); // neck shadow
    if (front) {
      // eyes: dark with a white catch-light, brows, mouth, cheeks
      P(eye, 6, 7, 2, 2); P('#ffffff', 6, 7, 1, 1); P(eye, 10, 7, 2, 2); P('#ffffff', 10, 7, 1, 1);
      P(hairD, 6, 6, 2, 1); P(hairD, 10, 6, 2, 1);
      P(mouth, 8, 10, 2, 1);
      P(blush, 5, 9, 1, 1); P(blush, 12, 9, 1, 1);
    }
  } else {
    P(skin, 7, 1, 5, 1); P(skin, 6, 2, 7, 1); P(skin, 5, 3, 9, 8); P(skin, 6, 11, 7, 1);
    P(skinL, 11, 3, 2, 2); P(skinD, 6, 11, 5, 1); P(skinD, 8, 12, 2, 1);
    P(skin, 14, 7, 1, 2); P(skinD, 14, 8, 1, 1); // nose
    P(eye, 11, 7, 1, 2); P('#ffffff', 12, 7, 1, 1); P(eye, 12, 8, 1, 1); P(hairD, 11, 6, 2, 1);
    P(mouth, 12, 10, 1, 1); P(blush, 11, 9, 1, 1);
    P(skinD, 8, 7, 1, 2); P(skinDD, 8, 8, 1, 1); // ear
  }

  // special-body details: puppet joints, golem cracks, wraith/shade glow
  if (L.body === 'puppet' && !back) { P(shade(skin, -45), front ? 4 : 6, 9, front ? 10 : 8, 1); P(shade(skin, -45), front ? 8 : 12, 10, 1, 2); if (front) { P('#c43c32', 5, 9, 1, 1); P('#c43c32', 12, 9, 1, 1); } }
  if (L.body === 'golem' && !back) { P(shade(skin, -40), front ? 6 : 10, 3, 1, 3); P(shade(skin, -40), front ? 11 : 12, 9, 2, 1); P('#6aa04a', front ? 4 : 6, 3, 2, 1); }
  if ((L.body === 'shade' || L.body === 'wraith' || L.glow) && !back) { if (front) { P(eye, 6, 7, 2, 1); P(eye, 10, 7, 2, 1); P(shade(eye, 60), 6, 7, 1, 1); P(shade(eye, 60), 10, 7, 1, 1); } else { P(eye, 11, 7, 2, 1); } }
  // face masks: cloth over nose and mouth, or a horned oni mask
  if (L.mask === 'cloth' && !back) { const mc = L.maskCol || '#3a3e48'; if (front) { P(mc, 4, 9, 10, 3); P(shade(mc, 30), 4, 9, 10, 1); P(shade(mc, -30), 5, 11, 8, 1); } else { P(mc, 9, 9, 6, 3); P(shade(mc, 30), 9, 9, 6, 1); P(mc, 7, 9, 2, 1); } }
  if (L.mask === 'oni' && !back) {
    if (front) { P('#c43c32', 4, 4, 10, 8); P('#e0584a', 4, 4, 10, 1); P('#8a2a22', 13, 5, 1, 7); P('#ffe07a', 6, 7, 2, 1); P('#ffe07a', 10, 7, 2, 1); P('#2a1a1a', 7, 6, 1, 1); P('#2a1a1a', 10, 6, 1, 1); P('#fff4dc', 6, 10, 6, 1); P('#2a1a1a', 7, 10, 1, 1); P('#2a1a1a', 10, 10, 1, 1); P('#fff4dc', 4, 1, 1, 3); P('#fff4dc', 13, 1, 1, 3); }
    else { P('#c43c32', 9, 4, 6, 8); P('#e0584a', 9, 4, 6, 1); P('#ffe07a', 11, 7, 2, 1); P('#fff4dc', 12, 10, 3, 1); P('#fff4dc', 10, 1, 1, 3); }
  }
  // ---------- hair ----------
  if (!covered) {
    if (back) {
      P(hair, 6, 1, 6, 1); P(hair, 5, 2, 8, 1); P(hair, 4, 3, 10, 7); P(hairD, 4, 10, 10, 1); P(hairD, 5, 11, 8, 1);
      P(hairL, 6, 2, 3, 1); P(hairL, 5, 3, 2, 2); P(hairD, 13, 3, 1, 7);
      if (hs === 0) { P(hair, 5, 0, 1, 1); P(hair, 8, 0, 1, 1); P(hair, 11, 0, 1, 1); P(hair, 3, 2, 1, 2); P(hair, 14, 2, 1, 2); P(hairD, 6, 11, 1, 1); P(hairD, 10, 11, 1, 1); }
      if (hs === 2) { P(hair, 4, 10, 10, 5); P(hairD, 4, 14, 10, 1); P(hairD, 8, 11, 1, 3); }
      if (hs === 3) { P(hair, 7, -1, 4, 2); P(hairL, 7, -1, 2, 1); P(band, 8, 1, 2, 1); }
      if (hs === 4) { P(band, 8, 6, 2, 1); P(hair, 8, 7, 2, 6); P(hairD, 9, 8, 1, 5); P(hair, 8, 13, 2, 1); }
    } else if (front) {
      P(hair, 6, 0, 6, 1); P(hair, 5, 1, 8, 1); P(hair, 4, 2, 10, 3); P(hairL, 6, 1, 3, 1); P(hairL, 5, 2, 2, 1); P(hairD, 13, 2, 1, 3);
      P(hair, 4, 5, 1, 4); P(hair, 13, 5, 1, 4); P(hairD, 4, 8, 1, 1); P(hairD, 13, 5, 1, 4);
      // fringe
      if (hs === 0) { P(hair, 4, -1, 1, 1); P(hair, 7, -1, 1, 1); P(hair, 10, -1, 1, 1); P(hair, 13, -1, 1, 1); P(hair, 3, 1, 1, 3); P(hair, 14, 1, 1, 3); P(hair, 2, 2, 1, 1); P(hair, 15, 2, 1, 1); P(hair, 6, 5, 1, 1); P(hair, 9, 5, 1, 1); P(hair, 11, 5, 1, 1); P(hairD, 9, 5, 1, 0); }
      if (hs === 1) { P(hair, 5, 5, 8, 1); P(hairD, 5, 5, 1, 1); P(hairD, 8, 5, 1, 1); P(hairD, 11, 5, 1, 1); }
      if (hs === 2) { P(hair, 5, 5, 2, 1); P(hair, 11, 5, 2, 1); P(hair, 3, 4, 1, 9); P(hair, 14, 4, 1, 9); P(hairD, 3, 10, 1, 3); P(hairD, 14, 10, 1, 3); }
      if (hs === 3) { P(hair, 7, -1, 4, 1); P(band, 8, 0, 2, 0); P(hair, 6, 5, 6, 1); P(hairD, 7, 5, 1, 1); P(hairD, 10, 5, 1, 1); }
      if (hs === 4) { P(hair, 5, 5, 3, 1); P(hair, 10, 5, 3, 1); P(hair, 14, 4, 2, 2); P(hair, 15, 6, 1, 4); P(hairD, 15, 8, 1, 2); }
    } else { // side, facing right
      P(hair, 7, 0, 5, 1); P(hair, 6, 1, 7, 1); P(hair, 5, 2, 9, 3); P(hair, 5, 5, 3, 5); P(hairD, 5, 9, 3, 1); P(hair, 9, 5, 1, 2);
      P(hairL, 9, 1, 3, 1); P(hairL, 7, 2, 2, 1); P(hairD, 5, 3, 1, 6); P(hair, 13, 5, 1, 1);
      if (hs === 0) { P(hair, 3, 2, 2, 1); P(hair, 2, 3, 2, 1); P(hair, 3, 5, 2, 1); P(hair, 4, 7, 1, 1); P(hair, 8, -1, 1, 1); P(hair, 11, -1, 1, 1); P(hair, 13, 4, 2, 1); }
      if (hs === 2) { P(hair, 4, 5, 3, 9); P(hairD, 4, 12, 3, 2); }
      if (hs === 3) { P(hair, 7, -1, 3, 1); P(band, 8, 0, 1, 1); }
      if (hs === 4) { P(hair, 3, 4, 2, 2); P(band, 4, 5, 1, 1); }
    }
  }

  // ---------- headgear ----------
  const plate = (big) => { // forehead protector plate
    if (back) return;
    if (front) { const x0 = big ? 6 : 7, w = big ? 6 : 4; P(metal, x0, 4, w, 3); P(metalL, x0, 4, w, 1); P(metalD, x0, 6, w, 1); P(metalD, x0 + w - 1, 4, 1, 3); P(metalD, 8, 5, 2, 1); }
    else { P(metal, 11, 4, 3, 3); P(metalL, 11, 4, 3, 1); P(metalD, 11, 6, 3, 1); P(metalD, 12, 5, 1, 1); }
  };
  const headband = (col, big) => {
    if (back) { P(col, 4, 5, 10, 1); P(col, 8, 6, 2, 1); P(col, 7, 7, 1, 2); P(col, 10, 7, 1, 2); return; }
    if (front) P(col, 4, 5, 10, 1); else { P(col, 5, 5, 9, 1); P(col, 3, 5, 2, 1); P(col, 2, 6, 2, 1); P(col, 3, 7, 1, 1); }
    plate(big);
  };
  if (head) {
    if (head.mask) { // ANBU porcelain mask
      if (front) { P('#eef0f2', 5, 5, 8, 6); P('#eef0f2', 6, 11, 6, 1); P('#c8ccd4', 12, 5, 1, 6); P(eye, 6, 7, 2, 1); P(eye, 10, 7, 2, 1); P('#c43c32', 6, 8, 1, 2); P('#c43c32', 11, 8, 1, 2); P('#c43c32', 8, 4, 2, 1); }
      if (side) { P('#eef0f2', 9, 5, 6, 6); P('#c8ccd4', 9, 10, 6, 1); P(eye, 11, 7, 2, 1); P('#c43c32', 12, 8, 1, 2); }
      headband('#1d1d24', false);
    } else if (head.helm) {
      const hx = side ? 5 : 4, hw = side ? 9 : 10;
      P(head.c, hx + 2, -1, hw - 4, 1); P(head.c, hx + 1, 0, hw - 2, 1); P(head.c, hx, 1, hw, 4);
      P(head.l, hx + 2, -1, 3, 1); P(head.l, hx + 1, 0, 2, 1); P(head.l, hx, 1, 1, 2); P(head.d, hx + hw - 1, 1, 1, 4); P(head.d, hx + hw - 2, 0, 1, 1);
      P(head.d, hx - 1, 5, hw + 2, 1); P(head.c, hx - 1, 4, hw + 2, 1); P(head.l, hx, 4, 3, 1); P(head.d, hx + 4, 0, 1, 4);
      if (front) { P(head.c, 8, 6, 2, 3); P(head.d, 9, 6, 1, 3); P(head.c, 3, 6, 1, 4); P(head.c, 14, 6, 1, 4); }
      if (side) { P(head.c, 5, 6, 3, 4); P(head.d, 5, 9, 3, 1); P(head.c, 13, 6, 1, 3); }
      if (back) P(head.c, 4, 6, 10, 4);
    } else if (head.hood) {
      if (back) { P(head.c, 3, -1, 12, 13); P(head.l, 5, 0, 4, 1); P(head.d, 3, 10, 12, 2); P(head.d, 8, 1, 2, 9); }
      else if (front) { P(head.c, 4, -1, 10, 6); P(head.c, 3, 1, 1, 11); P(head.c, 14, 1, 1, 11); P(head.c, 4, 5, 1, 7); P(head.c, 13, 5, 1, 7); P(head.l, 5, 0, 4, 1); P(head.d, 4, 4, 10, 1); P(head.d, 14, 3, 1, 9); P(head.d, 5, 11, 8, 1); P('#2a1a2a', 5, 5, 8, 1); }
      else { P(head.c, 5, -1, 9, 6); P(head.c, 3, 1, 6, 11); P(head.l, 7, 0, 4, 1); P(head.d, 3, 9, 6, 3); P(head.d, 13, 3, 1, 2); P('#2a1a2a', 9, 5, 4, 1); }
    } else if (head.crown) {
      if (!side) { P(head.c, 4, 3, 10, 2); P(head.d, 4, 4, 10, 1); P(head.c, 5, 1, 1, 2); P(head.c, 8, 0, 2, 3); P(head.c, 12, 1, 1, 2); P(head.l, 8, 0, 1, 1); if (front) P(head.a, 8, 3, 2, 1); }
      else { P(head.c, 5, 3, 9, 2); P(head.d, 5, 4, 9, 1); P(head.c, 6, 1, 1, 2); P(head.c, 9, 0, 2, 3); P(head.c, 13, 1, 1, 2); P(head.a, 12, 3, 1, 1); }
    } else headband(head.c, head.big); // genin / flak forehead protectors
  } else if (L.bandSpot === 0) headband(band, false);

  if (L.hat === 'straw') { // conical straw hat (wandering swordsmen, scouts, monks)
    const hc = '#d8b070', hl = '#f0d49a', hd = '#a8803e';
    P(hc, 7, -1, 4, 1); P(hc, 5, 0, 8, 1); P(hc, 3, 1, 12, 1); P(hc, 1, 2, 16, 2); P(hl, 4, 1, 4, 1); P(hl, 2, 2, 5, 1); P(hd, 1, 3, 16, 1); P(hd, 12, 1, 2, 1); P(hd, 14, 2, 2, 1);
    P('#7a4a24', 8, 0, 2, 1); if (front) { P('#7a4a24', 4, 4, 1, 4); P('#7a4a24', 13, 4, 1, 4); }
  }
  // ---------- in front of the body ----------
  if (sheathed && wpn.len !== 'short' && back) drawSheath(15, 8, 3, 20, 17, 4, 16, 6);
  if (wpn && atk) { // blade drawn and raised
    const bl = wpn.len === 'short' ? 4 : wpn.len === 'big' ? 7 : 8;
    if (front) { line(wpn.hilt, 17, 11, 18, 10); P(wpn.guard, 16, 9, 3, 1); line(wpn.blade, 18, 8, 18 + Math.round(bl / 3), 8 - bl, wpn.len === 'big' ? 2 : 1); P(metalL, 18, 7); }
    else if (side) { line(wpn.hilt, 15, 13, 16, 12); P(wpn.guard, 16, 10, 1, 3); line(wpn.blade, 17, 11, 17 + Math.round(bl / 2.5), 11 - bl, wpn.len === 'big' ? 2 : 1); P(metalL, 17, 10); }
  }

  // mirror for left
  if (dir === 1) {
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mx = m.getContext('2d'); mx.translate(W, 0); mx.scale(-1, 1); mx.drawImage(c, 0, 0);
    return outline(m);
  }
  return outline(c);
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// The look a character shows the world: their appearance plus the gear they wear.
export function lookOf(appearance, gear) {
  const eq = {};
  for (const [k, v] of Object.entries(gear || {})) if (v) eq[k] = v;
  return Object.keys(eq).length ? { ...(appearance || {}), eq } : { ...(appearance || {}) };
}
// Draw a ninja scaled to fit a small canvas (cards, boards), at a whole-number scale where possible.
export function drawNinjaFit(cv, look, dir = 0) {
  const c = cv.getContext('2d'), spr = ninjaSprite(look || {}, dir, 0);
  c.imageSmoothingEnabled = false; c.clearRect(0, 0, cv.width, cv.height);
  let s = Math.min(cv.width / spr.width, cv.height / spr.height); if (s >= 1) s = Math.floor(s);
  const w = spr.width * s, h = spr.height * s;
  c.drawImage(spr, Math.round((cv.width - w) / 2), Math.round(cv.height - h), w, h);
}

// pad by 1 and draw dark outline around opaque pixels
export function outline(src, color = '#24160e') {
  const w = src.width + 2, h = src.height + 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  x.fillStyle = color;
  const op = (i, j) => i >= 0 && j >= 0 && i < src.width && j < src.height && d[(j * src.width + i) * 4 + 3] > 0;
  for (let j = -1; j <= src.height; j++) for (let i = -1; i <= src.width; i++) {
    if (op(i, j)) continue;
    if (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
  }
  x.drawImage(src, 1, 1);
  return c;
}

const cache = new Map();
export function ninjaSprite(look, dir, frame) {
  const k = JSON.stringify(look) + dir + ':' + frame;
  if (!cache.has(k)) { if (cache.size > 600) cache.clear(); cache.set(k, drawNinjaRaw(look, dir, frame)); }
  return cache.get(k);
}

// Beast enemies, drawn facing left. kind: beast_cat | beast_boar | beast_wolf | beast_snake
export function beastSprite(kind, tint = '#7a4a2a', frame = 0, v = '') {
  const k = kind + tint + frame + v;
  if (cache.has(k)) return cache.get(k);
  if (kind === 'beast_snake' && v === 'giant') { const g = giantSerpent(tint, frame); cache.set(k, g); return g; }
  const c = document.createElement('canvas'); c.width = 30; c.height = 24;
  const x = c.getContext('2d');
  const P = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const L = shade(tint, 38), LL = shade(tint, 70), D = shade(tint, -38), DD = shade(tint, -70), cream = mix(tint, '#fff4dc', 0.55);
  const eyeC = v === 'shadow' ? '#ff4a3a' : v === 'eclipse' ? '#d8b0ff' : v === 'frost' ? '#7ce8ff' : '#ffe07a';
  const b = frame ? 1 : 0;
  if (kind === 'beast_wolf') {
    // tail
    P(tint, 25, 9 - b, 2, 4); P(tint, 26, 6 - b, 2, 4); P(L, 27, 4 - b, 2, 3); P(LL, 28, 3 - b, 1, 2); P(D, 25, 12 - b, 2, 1);
    // back legs (far one darker), body, belly
    P(DD, 21, 16, 2, 6); P(D, 23, 16, 2, 6); P(DD, 23, 22, 2, 1);
    P(tint, 11, 9 + b, 15, 8); P(L, 12, 9 + b, 12, 2); P(LL, 13, 9 + b, 6, 1); P(D, 22, 11 + b, 4, 5); P(cream, 12, 15 + b, 10, 2); P(D, 11, 16 + b, 14, 1);
    // chest ruff, front legs
    P(tint, 7, 8, 6, 9); P(cream, 7, 11, 3, 5); P(L, 8, 8, 3, 2);
    P(D, 8, 17, 2, 5); P(tint, 11, 17, 2, 5); P(DD, 8, 22, 2, 1); P(D, 11, 22, 2, 1);
    // head with ears, muzzle, eye, nose, teeth
    P(tint, 3, 4, 8, 7); P(L, 4, 4, 4, 2); P(tint, 0, 7, 4, 4); P(cream, 0, 9, 4, 2); P('#1b1424', 0, 7, 1, 1); P(D, 1, 11, 4, 1);
    P(tint, 4, 1, 2, 3); P(tint, 8, 1, 2, 3); P(D, 5, 2, 1, 2); P(D, 9, 2, 1, 2); P(L, 4, 1, 1, 1);
    P(eyeC, 5, 6, 2, 1); P('#1b1424', 5, 6, 1, 1); P('#fff4dc', 1, 11, 1, 1); P('#fff4dc', 3, 11, 1, 1);
    if (v === 'thunder') { for (const [a, bb] of [[13, 10], [14, 11], [13, 12], [18, 10], [19, 11], [18, 12], [23, 11], [24, 12]]) P('#3a3020', a, bb + b); P('#9fd8ff', 27, 3 - b, 1, 1); P('#9fd8ff', 2, 2, 1, 1); }
    if (v === 'frost') { for (let i2 = 0; i2 < 5; i2++) P(i2 % 2 ? '#ffffff' : '#bfe6ff', 10 + i2 * 3, 7 + b - (i2 % 2), 2, 2); P('#ffffff', 7, 7, 2, 1); }
    if (v === 'eclipse') { P('#d8b0ff', 3, 0, 1, 2); P('#d8b0ff', 9, 0, 1, 2); P('#9a5ad0', 12, 8 + b, 12, 1); P('#d8b0ff', 6, 5, 1, 1); }
    if (v === 'alpha') { P(LL, 6, 5, 7, 4); P(L, 6, 9, 7, 3); P('#ffffff', 7, 5, 4, 1); }
    if (v === 'ash') { P('#ff8a3a', 14, 8 + b, 1, 1); P('#ffd36b', 19, 7 + b, 1, 1); P('#ff8a3a', 23, 9 + b, 1, 1); P('#ff8a3a', 9, 6, 1, 1); }
    if (v === 'shadow') { P(DD, 12, 9 + b, 10, 1); }
  } else if (kind === 'beast_cat') {
    P(tint, 22, 6 - b, 2, 8); P(tint, 23, 3 - b, 2, 4); P(L, 24, 2 - b, 1, 2); P(D, 23, 8 - b, 1, 5);
    P(D, 19, 17, 2, 5); P(D, 12, 17, 2, 5);
    P(tint, 9, 11 + b, 14, 7); P(L, 10, 11 + b, 10, 2); P(cream, 11, 16 + b, 9, 2); P(D, 9, 17 + b, 14, 1);
    for (const xx of [12, 15, 18]) { P(D, xx, 11 + b, 1, 4); }
    P(tint, 10, 17, 2, 5); P(tint, 17, 17, 2, 5); P(cream, 10, 21, 2, 1); P(cream, 17, 21, 2, 1);
    P(tint, 2, 6, 9, 8); P(L, 3, 6, 5, 2); P(cream, 2, 10, 4, 3); P(tint, 2, 3, 3, 3); P(tint, 8, 3, 3, 3); P('#ff9fbf', 3, 4, 1, 2); P('#ff9fbf', 9, 4, 1, 2);
    P('#7ce08a', 4, 8, 1, 2); P('#7ce08a', 7, 8, 1, 2); P('#1b1424', 4, 9, 1, 1); P('#1b1424', 7, 9, 1, 1); P('#ff8fb1', 5, 11, 2, 1); P(D, 4, 7, 1, 1); P(D, 7, 7, 1, 1);
    P('#fff4dc', 0, 10, 2, 1); P('#fff4dc', 0, 12, 2, 1);
  } else if (kind === 'beast_boar') {
    P(DD, 22, 18, 3, 4); P(DD, 11, 18, 3, 4);
    P(tint, 8, 8 + b, 19, 11); P(L, 9, 9 + b, 14, 2); P(LL, 10, 9 + b, 6, 1); P(D, 22, 10 + b, 5, 8); P(D, 8, 18 + b, 19, 1);
    for (let i2 = 9; i2 < 25; i2 += 2) P(DD, i2, 7 + b - (i2 % 4 ? 0 : 1), 1, 2); // bristly mane
    P(tint, 13, 18, 3, 4); P(tint, 24, 18, 3, 4); P(DD, 13, 22, 3, 1); P(DD, 24, 22, 3, 1);
    P(tint, 1, 10, 9, 8); P(L, 2, 10, 5, 2); P(D, 0, 13, 3, 4); P(mix(tint, '#ff9fbf', 0.4), 0, 13, 2, 3); P('#1b1424', 0, 14, 1, 1);
    P(tint, 5, 8, 2, 3); P(D, 6, 9, 1, 1); P('#c43c32', 4, 12, 2, 1); P('#1b1424', 4, 12, 1, 1);
    P('#fff4dc', 2, 16, 1, 3); P('#fff4dc', 1, 15, 1, 1); P('#fff4dc', 5, 17, 1, 2); P('#c8bfae', 2, 18, 1, 1);
    P(D, 27, 10 + b, 2, 1); P(D, 28, 9 + b, 1, 1);
  } else { // snakes: coiled body and raised head; variants add hoods, thorns, moss, horns
    P(D, 8, 17, 20, 5); P(tint, 9, 15, 19, 5); P(L, 10, 15, 14, 1); P(cream, 10, 19, 16, 1); P(DD, 9, 20, 18, 1);
    P(tint, 13, 11, 14, 5); P(L, 14, 11, 10, 1); P(D, 13, 15, 14, 1); P(cream, 15, 14, 9, 1);
    for (let i2 = 11; i2 < 27; i2 += 4) { P(D, i2, 16, 2, 2); P(D, i2 + 2, 12, 2, 2); }
    P(tint, 10, 5 + b, 4, 9); P(L, 10, 5 + b, 1, 8); P(cream, 13, 7 + b, 1, 6);
    P(tint, 3, 3 + b, 9, 5); P(L, 4, 3 + b, 6, 1); P(D, 3, 7 + b, 9, 1);
    P('#ffe07a', 5, 4 + b, 2, 1); P('#1b1424', 6, 4 + b, 1, 1); P('#1b1424', 3, 5 + b, 1, 1);
    P('#c43c32', 0, 6 + b, 3, 1); P('#c43c32', 0, 5 + b, 1, 1); P('#c43c32', 0, 7 + b, 1, 1);
    if (v === 'viper') { P(tint, 8, 2 + b, 3, 7); P(D, 9, 3 + b, 1, 5); P(L, 8, 2 + b, 1, 5); }
    if (v === 'thorn') { for (let i2 = 12; i2 < 27; i2 += 3) P('#c43c8a', i2, 10, 1, 1); P('#c43c8a', 10, 4 + b, 1, 1); P('#c43c8a', 12, 5 + b, 1, 1); }
    if (v === 'swamp') { P('#6aa04a', 15, 11, 3, 1); P('#6aa04a', 22, 15, 3, 1); P('#6aa04a', 5, 3 + b, 2, 1); }
    if (v === 'wyrm') { P('#fff4dc', 9, 1 + b, 1, 3); P('#fff4dc', 11, 1 + b, 1, 3); for (let i2 = 13; i2 < 27; i2 += 3) P(LL, i2, 11, 2, 1); P('#ff8a3a', 5, 4 + b, 1, 1); }
  }
  const o = outline(c);
  cache.set(k, o);
  return o;
}
function mixC(a, b, t) { return mix(a, b, t); }
// Venomfang: a giant coiled serpent with a hood, fangs and glowing eyes (drawn big, not scaled)
function giantSerpent(tint, frame) {
  const c = document.createElement('canvas'); c.width = 50; c.height = 44;
  const x = c.getContext('2d');
  const P = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const L = shade(tint, 36), LL = shade(tint, 64), D = shade(tint, -36), DD = shade(tint, -64), belly = mixC(tint, '#f0e0a0', 0.6), b = frame ? 1 : 0;
  // filled ellipse with lit top-left and shaded bottom-right
  const ell = (cx, cy, rx, ry, base = tint) => { for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++) for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) { const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry, d = dx * dx + dy * dy; if (d > 1) continue; P(d > 0.72 && (dx + dy) > 0.3 ? D : d > 0.6 && (dx + dy) < -0.5 ? L : base, xx, yy); } };
  // coils: back coil, front coil, tail
  ell(31, 31, 15, 5.5); for (let i = 20; i < 44; i += 5) { P(D, i, 28, 3, 1); P(LL, i + 1, 27, 1, 1); }
  ell(24, 37, 21, 5.5); for (let i = 8; i < 44; i += 5) { P(D, i, 34, 3, 1); P(LL, i + 1, 33, 1, 1); } P(belly, 10, 40, 28, 1);
  P(tint, 44, 22, 3, 7); P(tint, 46, 18, 2, 5); P(L, 47, 16, 1, 3); P('#c43c32', 47, 15, 1, 1);
  // neck rising from the coils
  ell(17, 26, 5, 9); for (let yy = 18; yy < 34; yy += 3) P(belly, 15, yy + b, 4, 2);
  // flared hood with red-and-gold eye markings
  ell(17, 13 + b, 12, 10); ell(17, 13 + b, 9, 8, shade(tint, -12));
  for (const mx of [10, 24]) { ell(mx, 15 + b, 2.6, 2.6, '#c43c32'); P('#ffd36b', mx - 1, 14 + b, 2, 2); }
  for (let yy = 8; yy < 22; yy += 3) P(belly, 15, yy + b, 4, 2);
  // head with glowing eyes, fangs dripping venom and a forked tongue
  ell(17, 5 + b, 7, 4.5); P(L, 13, 2 + b, 5, 1); P(LL, 14, 2 + b, 2, 1);
  P('#c6ff5a', 12, 4 + b, 3, 2); P('#1b1424', 13, 4 + b, 1, 2); P('#c6ff5a', 20, 4 + b, 3, 2); P('#1b1424', 21, 4 + b, 1, 2);
  P(DD, 13, 8 + b, 9, 1); P('#fff4dc', 14, 9 + b, 1, 3); P('#fff4dc', 20, 9 + b, 1, 3); P('#c6ff5a', 14, 12 + b, 1, 1); P('#c6ff5a', 20, 12 + b, 1, 1);
  P('#c43c32', 17, 9 + b, 1, 4); P('#c43c32', 16, 13 + b, 1, 1); P('#c43c32', 18, 13 + b, 1, 1);
  return outline(c);
}

// Village emblems, 12x12
export function emblem(village, size = 48) {
  const c = document.createElement('canvas'); c.width = 12; c.height = 12;
  const x = c.getContext('2d');
  const P = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const v = VILLAGES[village];
  if (village === 'pine') {
    P(v.color, 5, 0, 2, 1); P(v.color, 4, 1, 4, 2); P(v.color, 3, 3, 6, 2); P(v.color, 2, 5, 8, 2); P(v.color, 1, 7, 10, 2);
    P(shade(v.color, 40), 5, 1, 1, 6); P('#7a4a22', 5, 9, 2, 3);
  } else if (village === 'dune') {
    P('#f2c14a', 5, 1, 2, 2); P(v.color, 4, 3, 4, 2); P(v.color, 3, 5, 6, 2); P(shade(v.color, -30), 1, 9, 10, 2);
    P(v.color, 2, 7, 8, 2); P('#f2c14a', 5, 5, 2, 2);
  } else {
    P(v.color, 1, 6, 10, 2); P(v.color, 2, 4, 3, 2); P(v.color, 7, 4, 3, 2); P(shade(v.color, 50), 3, 3, 2, 1); P(shade(v.color, 50), 8, 3, 2, 1);
    P(shade(v.color, -30), 0, 9, 12, 2); P(shade(v.color, 50), 5, 1, 2, 2);
  }
  const o = outline(c);
  const s = document.createElement('canvas'); s.width = size; s.height = size;
  const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false; sx.drawImage(o, 0, 0, size, size);
  return s;
}
