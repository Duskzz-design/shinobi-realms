// Procedural pixel-art ninja sprites. 16x24 grid, auto-outlined.
export const W = 16, H = 24;

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

// dir: 0 down, 1 left, 2 right, 3 up. frame: 0 idle, 1/2 walk, 3 attack
export function drawNinjaRaw(look, dir = 0, frame = 0) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const P = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const L = { ...DEFAULT_LOOK, ...look };
  const hair = PALETTES.hair[L.hair] || PALETTES.hair[0];
  const skin = PALETTES.skin[L.skin] || PALETTES.skin[1];
  const out = PALETTES.outfit[L.outfit] || PALETTES.outfit[0];
  const band = PALETTES.band[L.band] || PALETTES.band[0];
  const pants = '#2c2c3c', pantsD = '#1f1f2b', metal = '#c9ccd4', metalD = '#8a8f9c';
  const outD = shade(out, -45), outL = shade(out, 30), skinD = shade(skin, -30), hairD = shade(hair, -40), hairL = shade(hair, 35);
  const side = dir === 1 || dir === 2;
  const walkA = frame === 1, walkB = frame === 2;

  // long hair behind body
  if (L.hairStyle === 2 && dir !== 0) P(hair, 4, 8, 8, 7);
  if (L.hairStyle === 2 && dir === 0) { P(hairD, 3, 7, 1, 7); P(hairD, 12, 7, 1, 7); }

  // legs
  if (!side) {
    const lU = walkA ? 1 : 0, rU = walkB ? 1 : 0;
    P(pants, 5, 18, 2, 4 - lU); P(pantsD, 5, 22 - lU, 2, 1);
    P(pants, 9, 18, 2, 4 - rU); P(pantsD, 9, 22 - rU, 2, 1);
  } else {
    const f = walkA ? 1 : walkB ? -1 : 0;
    P(pants, 6, 18, 3, 2);
    P(pants, 6 + f, 20, 2, 2); P(pantsD, 6 + f, 22, 2, 1);
    P(pantsD, 8 - f, 20, 2, 2); P('#15151e', 8 - f, 22, 2, 1);
  }
  // torso
  if (!side) {
    P(out, 4, 11, 8, 7); P(outD, 4, 16, 8, 1); P(outL, 5, 12, 1, 3);
    if (dir === 0) { P(outD, 7, 11, 2, 1); P(skin, 7, 11, 2, 1); P(outD, 6, 12, 1, 4); }
  } else {
    P(out, 5, 11, 6, 7); P(outD, 5, 16, 6, 1);
  }
  // arms
  const swing = walkA ? 1 : walkB ? -1 : 0;
  if (!side) {
    P(out, 3, 12 + Math.max(0, swing), 1, 4); P(skin, 3, 16 + Math.max(0, swing), 1, 1);
    P(out, 12, 12 + Math.max(0, -swing), 1, 4); P(skin, 12, 16 + Math.max(0, -swing), 1, 1);
    if (frame === 3) { P(out, 12, 11, 2, 2); P(skin, 14, 11, 1, 1); }
  } else {
    if (frame === 3) { P(outD, 9, 12, 4, 2); P(skin, 13, 12, 1, 2); }
    else { P(outD, 7 + swing, 12, 2, 4); P(skin, 7 + swing, 16, 2, 1); }
  }
  // neck band / arm band
  if (L.bandSpot === 1) P(band, side ? 6 : 5, 11, side ? 4 : 6, 1);
  if (L.bandSpot === 2) { if (!side) P(band, 3, 13, 1, 1); else P(band, 7 + swing, 13, 2, 1); }
  // head
  if (!side) {
    P(skin, 4, 3, 8, 8); P(skin, 5, 2, 6, 1); P(skinD, 4, 10, 8, 1);
    if (dir === 0) { P('#1b1424', 6, 7, 1, 2); P('#1b1424', 9, 7, 1, 2); P(skinD, 7, 9, 2, 1); }
  } else {
    P(skin, 5, 3, 7, 8); P(skin, 6, 2, 5, 1); P(skinD, 5, 10, 7, 1);
    P('#1b1424', 10, 7, 1, 2); P(skin, 12, 6, 1, 2);
  }
  // hair
  const hs = L.hairStyle;
  if (dir === 3) {
    P(hair, 4, 2, 8, 9); P(hair, 5, 1, 6, 1); P(hairD, 4, 9, 8, 1);
    if (hs === 0) { P(hair, 3, 1, 1, 2); P(hair, 12, 1, 1, 2); P(hair, 6, 0, 1, 1); P(hair, 9, 0, 1, 1); }
    if (hs === 3) P(hair, 7, 0, 2, 1);
    if (hs === 4) { P(hairD, 7, 10, 2, 4); }
    if (hs === 2) P(hair, 4, 10, 8, 4);
  } else if (!side) {
    P(hair, 4, 2, 8, 3); P(hair, 5, 1, 6, 1); P(hairL, 6, 2, 3, 1);
    P(hair, 4, 5, 1, 3); P(hair, 11, 5, 1, 3);
    if (hs === 0) { P(hair, 3, 1, 1, 2); P(hair, 12, 1, 1, 2); P(hair, 5, 0, 1, 1); P(hair, 8, 0, 1, 1); P(hair, 10, 0, 1, 1); P(hair, 5, 5, 1, 1); P(hair, 10, 5, 1, 1); P(hair, 7, 5, 1, 1); }
    if (hs === 1) { P(hairD, 5, 5, 6, 0); }
    if (hs === 2) { P(hair, 3, 4, 1, 8); P(hair, 12, 4, 1, 8); P(hair, 4, 5, 1, 6); P(hair, 11, 5, 1, 6); }
    if (hs === 3) { P(hair, 7, 0, 2, 1); P(hairD, 6, -1, 4, 1); P(hairD, 7, 1, 2, 1); }
    if (hs === 4) { P(hair, 12, 5, 1, 4); P(hairD, 13, 7, 1, 3); }
  } else {
    P(hair, 5, 2, 7, 3); P(hair, 6, 1, 5, 1); P(hair, 5, 5, 3, 4); P(hairL, 7, 2, 3, 1);
    if (hs === 0) { P(hair, 4, 2, 1, 2); P(hair, 3, 3, 1, 1); P(hair, 7, 0, 1, 1); P(hair, 10, 0, 1, 1); P(hair, 11, 5, 1, 1); }
    if (hs === 2) { P(hair, 4, 4, 3, 9); }
    if (hs === 3) { P(hair, 6, 0, 2, 1); P(hairD, 5, 0, 1, 1); }
    if (hs === 4) { P(hair, 3, 5, 2, 2); P(hairD, 2, 7, 2, 4); }
  }
  // forehead protector
  if (L.bandSpot === 0) {
    if (dir === 3) P(band, 4, 5, 8, 1);
    else if (!side) { P(band, 4, 5, 8, 1); P(metal, 6, 4, 4, 2); P(metalD, 7, 5, 2, 1); }
    else { P(band, 5, 5, 7, 1); P(metal, 9, 4, 3, 2); P(metalD, 10, 5, 1, 1); P(band, 4, 6, 1, 2); }
  }
  // mirror for left
  if (dir === 1) {
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mx = m.getContext('2d'); mx.translate(W, 0); mx.scale(-1, 1); mx.drawImage(c, 0, 0);
    return outline(m);
  }
  return outline(c);
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
