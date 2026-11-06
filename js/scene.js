// Animated pixel-art title backdrop: sunset village with falling leaves.
const VW = 320, VH = 180;

export function startTitleScene(canvas) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = VW; buf.height = VH;
  const b = buf.getContext('2d');
  const stat = document.createElement('canvas'); stat.width = VW; stat.height = VH;
  paintStatic(stat.getContext('2d'));
  const leaves = Array.from({ length: 28 }, () => newLeaf(true));
  const clouds = [{ x: 30, y: 26, w: 46 }, { x: 170, y: 16, w: 60 }, { x: 260, y: 40, w: 34 }];
  let run = true, t = 0;
  function frame() {
    if (!run) return;
    t++;
    b.drawImage(stat, 0, 0);
    // clouds
    for (const c of clouds) {
      c.x += 0.05; if (c.x > VW + 10) c.x = -c.w - 10;
      b.fillStyle = '#ffe9d2'; b.fillRect(c.x | 0, c.y, c.w, 4); b.fillRect((c.x + 6) | 0, c.y - 3, c.w - 16, 3);
      b.fillStyle = '#f7c9a8'; b.fillRect((c.x + 2) | 0, c.y + 4, c.w - 4, 2);
    }
    // lantern flicker
    const fl = (t >> 3) % 2 ? '#ffd36b' : '#ffbf3f';
    for (const [lx, ly] of [[96, 128], [214, 124], [150, 118]]) { b.fillStyle = fl; b.fillRect(lx, ly, 2, 3); }
    // leaves
    for (const l of leaves) {
      l.y += l.vy; l.x += Math.sin((t + l.p) / 20) * 0.4 + l.vx;
      if (l.y > VH || l.x > VW + 4) Object.assign(l, newLeaf(false));
      b.fillStyle = l.c; b.fillRect(l.x | 0, l.y | 0, 2, 1); b.fillRect((l.x + ((t + l.p) >> 4) % 2) | 0, (l.y + 1) | 0, 1, 1);
    }
    // fit: cover
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const s = Math.max(cw / VW, ch / VH);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffb27a'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(buf, (cw - VW * s) / 2, (ch - VH * s) / 2, VW * s, VH * s);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { run = false; };
}

function newLeaf(anywhere) {
  const cols = ['#ff8fb1', '#ffb3c8', '#ff6f4f', '#f29a3a'];
  return { x: Math.random() * VW - 40, y: anywhere ? Math.random() * VH : -4, vy: 0.15 + Math.random() * 0.25, vx: 0.15 + Math.random() * 0.2, p: Math.random() * 200, c: cols[(Math.random() * 4) | 0] };
}

function paintStatic(b) {
  const R = (c, x, y, w, h) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
  // sky bands with dither
  const bands = ['#7fc3ea', '#9fd1ec', '#c8dcea', '#f6d9c4', '#ffc79b', '#ffaf78', '#ff9a63'];
  const bh = 14;
  bands.forEach((c, i) => {
    R(c, 0, i * bh, VW, bh);
    if (i < bands.length - 1) { b.fillStyle = bands[i + 1]; for (let x = 0; x < VW; x += 2) b.fillRect(x + (i % 2), i * bh + bh - 1, 1, 1); }
  });
  R('#ff9a63', 0, bands.length * bh, VW, VH);
  // sun
  b.fillStyle = '#fff1b8'; circle(b, 232, 82, 16); b.fillStyle = '#ffe07a'; circle(b, 232, 82, 13);
  // far mountains
  ridge(b, '#b08bb8', 96, 22, 0.035, 3);
  ridge(b, '#8f6fa8', 108, 16, 0.05, 7);
  // mid hills
  ridge(b, '#5aa05a', 128, 10, 0.03, 1);
  ridge(b, '#3f8a46', 138, 8, 0.045, 5);
  // pagoda tower centre
  pagoda(b, 146, 72);
  // houses
  house(b, 70, 120, 40, '#c43c32'); house(b, 112, 126, 30, '#d8603a'); house(b, 196, 122, 38, '#c43c32'); house(b, 238, 128, 30, '#b8402e'); house(b, 20, 130, 34, '#d8603a'); house(b, 276, 132, 36, '#c43c32');
  // ground
  R('#4f9a3f', 0, 150, VW, 30); R('#3d7f33', 0, 150, VW, 2);
  R('#d8b37a', 120, 150, 80, 30); R('#c49c63', 120, 150, 80, 2);
  for (let i = 0; i < 40; i++) R('#68b24e', (i * 37) % VW, 156 + (i * 11) % 22, 2, 1);
  // pine trees and blossom trees
  for (const x of [8, 44, 290, 306]) pine(b, x, 150);
  for (const x of [100, 222]) blossom(b, x, 150);
  // torii gate on path
  R('#c43c32', 136, 132, 48, 3); R('#8a2a22', 134, 130, 52, 2); R('#c43c32', 140, 137, 40, 2);
  R('#c43c32', 142, 135, 3, 16); R('#c43c32', 175, 135, 3, 16);
}

function circle(b, cx, cy, r) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); b.fillRect(cx - w, cy + y, w * 2, 1); } }
function ridge(b, col, base, amp, freq, seed) {
  b.fillStyle = col;
  for (let x = 0; x < VW; x++) {
    const h = Math.abs(Math.sin(x * freq + seed)) * amp + Math.sin(x * freq * 2.7 + seed) * amp * 0.3;
    b.fillRect(x, (base - h) | 0, 1, VH);
  }
}
function house(b, x, y, w, roof) {
  b.fillStyle = '#f2e2c4'; b.fillRect(x + 3, y, w - 6, 150 - y);
  b.fillStyle = '#7a4a2a'; b.fillRect(x + 3, y, 2, 150 - y); b.fillRect(x + w - 5, y, 2, 150 - y);
  b.fillStyle = '#5a3a22'; b.fillRect(x + (w >> 1) - 3, 150 - 10, 6, 10);
  b.fillStyle = '#ffd36b'; b.fillRect(x + 8, y + 5, 4, 3);
  b.fillStyle = roof; for (let i = 0; i < 6; i++) b.fillRect(x - 2 + i, y - 6 + i, w + 4 - i * 2, 1);
  b.fillStyle = '#8a2a22'; b.fillRect(x - 3, y - 1, w + 6, 2);
}
function pagoda(b, x, y) {
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const w = 34 - i * 6, ty = y + 64 - i * 16;
    b.fillStyle = '#f2e2c4'; b.fillRect(x + 14 - w / 2 + 4, ty, w - 8, 12);
    b.fillStyle = '#7a4a2a'; b.fillRect(x + 14 - w / 2 + 4, ty, 2, 12); b.fillRect(x + 14 + w / 2 - 6, ty, 2, 12);
    b.fillStyle = '#c43c32'; b.fillRect(x + 14 - w / 2 - 2, ty - 3, w + 4, 3); b.fillStyle = '#8a2a22'; b.fillRect(x + 14 - w / 2 - 4, ty - 1, w + 8, 1);
  }
  b.fillStyle = '#ffd36b'; b.fillRect(x + 13, y + 6, 2, 10);
}
function pine(b, x, base) {
  b.fillStyle = '#6a4024'; b.fillRect(x - 1, base - 8, 3, 8);
  for (let i = 0; i < 4; i++) { b.fillStyle = i % 2 ? '#2e6b35' : '#245c30'; const w = 14 - i * 3; b.fillRect(x - w / 2, base - 10 - i * 7, w, 7); }
}
function blossom(b, x, base) {
  b.fillStyle = '#6a4024'; b.fillRect(x - 1, base - 14, 3, 14); b.fillRect(x - 5, base - 16, 5, 2);
  b.fillStyle = '#ff9fbf'; circle(b, x, base - 22, 9); b.fillStyle = '#ffc4d6'; circle(b, x - 3, base - 25, 5); b.fillStyle = '#f07aa0'; b.fillRect(x + 2, base - 18, 4, 2);
}
