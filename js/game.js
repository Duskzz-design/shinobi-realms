// The live village: movement, camera, other players, chat, interactions.
import * as net from './net.js';
import { buildWorld, blocked, T, MW, MH } from './world.js';
import { ninjaSprite, emblem, VILLAGES } from './sprites.js';
import { openMissionBoard, openTraining, runBattle } from './battle.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const SPEED = 78; // px per second
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export async function enterWorld(app, char, hooks) {
  const world = buildWorld(char.village);
  const me = {
    id: char.user_id || 'me', name: char.name, village: char.village, rank: char.rank, level: char.level, look: char.appearance,
    x: world.spawn.x, y: world.spawn.y, dir: 0, moving: false, anim: 0,
  };
  if (char.pos_x && char.pos_y && !blocked(world, char.pos_x, char.pos_y)) { me.x = char.pos_x; me.y = char.pos_y; }
  const others = new Map(); // id -> {meta, x,y, tx,ty, dir, moving, anim, last}
  const bubbles = new Map(); // id -> {text, until}
  const v = VILLAGES[char.village];
  char._loadedAt = char._loadedAt || Date.now();
  setInterval(() => { try { refreshPlate(); } catch {} }, 10000);

  // ---------- DOM ----------
  const root = h(`
  <div class="world">
    <canvas id="view"></canvas>
    <div class="hud-top">
      <div class="plate">
        <canvas class="face" width="36" height="36"></canvas>
        <div><b>${esc(char.name)}</b><small id="plateSub">Lv ${char.level} · ${esc(char.rank)}</small></div>
      </div>
      <div class="hud-right">
        <div class="online" title="Ninja in this village right now">👥 <span id="count">1</span> here</div>
        <button class="btn small primary train-btn" id="trainBtn">⭐ Train<i id="ptsBadge" hidden></i></button>
        <button class="btn small ghost" id="menuBtn">☰ Menu</button>
      </div>
    </div>
    <div class="vname"><span class="em"></span>${esc(v.name)} Village</div>
    <div class="prompt" id="prompt" hidden></div>
    <div class="chat" id="chat">
      <div class="chat-tabs"><button data-ch="village" class="on">Village</button><button data-ch="world">World</button><button class="chat-close" id="chatClose" aria-label="Close chat">✕</button></div>
      <div class="chat-log" id="log"></div>
      <form class="chat-form" id="chatForm"><input id="chatIn" maxlength="120" placeholder="${isTouch ? 'Say something…' : 'Press Enter to chat'}" autocomplete="off"><button class="btn small primary" type="submit">Send</button></form>
    </div>
    <button class="chat-toggle btn icon" id="chatToggle" aria-label="Open chat">💬<i id="unread" hidden></i></button>
    <div class="stick" id="stick" ${isTouch ? '' : 'hidden'}><div class="knob"></div></div>
    <button class="act btn primary" id="act" ${isTouch ? '' : 'hidden'}>A</button>
    <div class="menu scroll" id="menu" hidden>
      <button class="btn ghost" id="mProfile">My Ninja & training</button>
      <button class="btn ghost" id="mOut">Sign out</button>
      <button class="btn ghost" id="mClose">Close</button>
    </div>
    <div class="modal-wrap" id="modal" hidden><div class="scroll modal"></div></div>
  </div>`);
  app.innerHTML = ''; app.appendChild(root);
  document.body.classList.add('in-world');
  root.querySelector('.vname .em').appendChild(emblem(char.village, 18));
  setTimeout(() => refreshPlate(), 0);
  const face = root.querySelector('.face').getContext('2d');
  face.imageSmoothingEnabled = false;
  const fs = ninjaSprite(me.look, 0, 0);
  face.drawImage(fs, 0, 0, 18, 14, 0, 0, 36, 28);

  const view = root.querySelector('#view');
  const ctx = view.getContext('2d');
  let scale = 3, vw = 0, vh = 0;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = innerWidth; vh = innerHeight;
    view.width = Math.round(vw * dpr); view.height = Math.round(vh * dpr);
    view.style.width = vw + 'px'; view.style.height = vh + 'px';
    scale = Math.max(2, Math.floor(Math.min(vw, vh) / (T * 12))) * dpr;
  }
  resize(); addEventListener('resize', resize);

  // ---------- input ----------
  const keys = new Set();
  const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
  const onKey = (e) => {
    if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (root.querySelector('.ov')) { if (e.key === 'Escape') { const o = root.querySelector('.ov:not(.battle)'); o && o.remove(); } return; }
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if (k === 'enter') { e.preventDefault(); openChat(); chatIn.focus(); return; }
      if (k === 'e' || k === ' ') { e.preventDefault(); interact(); return; }
      if (k === 'escape') { closeModal(); menu.hidden = true; }
      keys.add(k);
    } else keys.delete(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  addEventListener('blur', () => keys.clear());
  // joystick
  const stick = root.querySelector('#stick'), knob = stick.querySelector('.knob');
  const joy = { x: 0, y: 0, id: null };
  stick.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveJoy(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
  const endJoy = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
  function moveJoy(e) {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const max = r.width / 2 - 14, d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
  }
  root.querySelector('#act').onclick = () => interact();

  // tap on another player -> card
  view.addEventListener('click', (e) => {
    const wx = camX + e.clientX * (view.width / vw) / scale, wy = camY + e.clientY * (view.height / vh) / scale;
    for (const o of others.values()) {
      if (Math.abs(wx - o.x) < 10 && wy < o.y + 2 && wy > o.y - 28) { playerCard(o.meta); return; }
    }
  });

  // ---------- chat ----------
  const log = root.querySelector('#log'), chatIn = root.querySelector('#chatIn'), chatBox = root.querySelector('#chat');
  const unread = root.querySelector('#unread');
  let chatTab = 'village', lastSent = 0;
  const msgs = [];
  root.querySelectorAll('.chat-tabs [data-ch]').forEach((b) => (b.onclick = () => {
    chatTab = b.dataset.ch; root.querySelectorAll('.chat-tabs [data-ch]').forEach((x) => x.classList.toggle('on', x === b)); renderLog();
  }));
  function openChat() { chatBox.classList.add('open'); unread.hidden = true; }
  root.querySelector('#chatToggle').onclick = () => { chatBox.classList.contains('open') ? chatBox.classList.remove('open') : openChat(); };
  root.querySelector('#chatClose').onclick = () => chatBox.classList.remove('open');
  function addMsg(m) {
    msgs.push(m); if (msgs.length > 120) msgs.shift();
    if (m.ch === chatTab || m.sys) renderLog();
    if (!chatBox.classList.contains('open') && isTouch && !m.sys) unread.hidden = false;
  }
  function renderLog() {
    log.innerHTML = msgs.filter((m) => m.ch === chatTab || m.sys).slice(-60).map((m) => m.sys
      ? `<p class="sys">${esc(m.text)}</p>`
      : `<p><b style="color:${(VILLAGES[m.village] || v).dark}">${esc(m.name)}</b> ${esc(m.text)}</p>`).join('');
    log.scrollTop = log.scrollHeight;
  }
  root.querySelector('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const text = chatIn.value.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) { chatIn.blur(); return; }
    if (Date.now() - lastSent < 1200) return;
    lastSent = Date.now();
    const m = { id: me.id, name: me.name, village: me.village, text, ch: chatTab };
    (chatTab === 'world' ? worldRoom : room)?.send('chat', m);
    addMsg(m); bubbles.set(me.id, { text, until: performance.now() + 5000 });
    chatIn.value = '';
    if (!isTouch) chatIn.blur();
  };
  addMsg({ sys: true, text: `Welcome to ${v.name}. ` + (isTouch ? 'Use the stick to move and A to interact.' : 'Arrows or WASD to move, E to interact, Enter to chat.') });

  // ---------- menu / modal ----------
  const menu = root.querySelector('#menu'), modal = root.querySelector('#modal');
  root.querySelector('#menuBtn').onclick = () => (menu.hidden = !menu.hidden);
  root.querySelector('#mClose').onclick = () => (menu.hidden = true);
  root.querySelector('#mOut').onclick = async () => { await leave(); net.signOut(); };
  root.querySelector('#mProfile').onclick = () => { menu.hidden = true; train(); };
  root.querySelector('#trainBtn').onclick = () => train();
  function train() { openTraining(root, () => char, (c) => { Object.assign(char, c); refreshPlate(); }); }
  function refreshPlate() {
    root.querySelector('#plateSub').textContent = `Lv ${char.level} · ${char.rank}`;
    root.querySelector('#ptsBadge').hidden = !(char.energy + Math.floor((Date.now() - (char._loadedAt || Date.now())) / 9000) >= (char.energy_max || 100));
    me.level = char.level; me.rank = char.rank;
  }
  if (net.isOffline()) window.__game = { startBattle: (m) => startBattle(m), board: () => openMissionBoard(root, char, startBattle), char };
  function startBattle(mid) {
    keys.clear();
    runBattle(root, char, mid, async (r) => {
      try { Object.assign(char, await net.loadCharacter(), { _loadedAt: Date.now() }); } catch {}
      refreshPlate(); room?.track(meta());
      if (r && r.status === 'won' && r.result && r.result.leveled) room?.send('chat', { id: me.id, name: me.name, village: me.village, text: `reached level ${char.level}! 🎉`, ch: 'village' });
      if (r && r.train) train();
    });
  }
  function showModal(html, onReady) {
    modal.querySelector('.modal').innerHTML = html + `<button class="btn primary" data-close>OK</button>`;
    modal.hidden = false; modal.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
    onReady && onReady(modal.querySelector('.modal'));
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  function playerCard(m) {
    const vv = VILLAGES[m.village] || v;
    showModal(`<div class="pcard"><canvas width="64" height="80"></canvas><div><h3>${esc(m.name)}</h3><p style="color:${vv.dark}"><b>${vv.name}</b></p><p>${esc(m.rank || 'Academy Student')} · Level ${m.level || 1}</p></div></div><p class="soon">Challenges arrive with the Arena update.</p>`, (el) => {
      const c = el.querySelector('canvas').getContext('2d'); c.imageSmoothingEnabled = false;
      c.drawImage(ninjaSprite(m.look || {}, 0, 0), 0, 0, 18, 26, 5, 2, 54, 78);
    });
  }
  const SPOT_TEXT = {
    academy: ['Academy', 'Sensei Hiro nods at you. "Rank exams open here soon. Keep training, and come back when you\'re ready to test for Genin."'],
    shop: ['Tool Shop', 'Kunai, shuriken and scrolls are on their way. The shopkeeper is still unpacking crates.'],
    arena: ['Arena', 'Player duels and village wars will be fought here.'],
    gate: ['Village Gate', 'Beyond the gate lie the Wilds. The guards won\'t let Academy students out alone… yet.'],
  };
  function interact() {
    if (root.querySelector('.ov')) return;
    const s = nearSpot(); if (!s) return;
    if (s.id === 'missions') { openMissionBoard(root, char, startBattle); return; }
    const [title, text] = SPOT_TEXT[s.id] || [s.name, ''];
    showModal(`<h3>${title}</h3><p>${text}</p>`);
  }
  function nearSpot() { for (const s of world.spots) if (Math.hypot(s.x - me.x, s.y - me.y) < 22) return s; return null; }
  const promptEl = root.querySelector('#prompt');

  // ---------- network ----------
  let room = null, worldRoom = null, lastSend = 0, lastTrack = 0, lastSave = performance.now();
  const meta = () => ({ id: me.id, name: me.name, village: me.village, rank: me.rank, level: me.level, look: me.look, x: Math.round(me.x), y: Math.round(me.y), dir: me.dir });
  const onEvent = (ev, p) => {
    if (!p || p.id === me.id) return;
    if (ev === 'mv') { const o = others.get(p.id); if (o) { o.tx = p.x; o.ty = p.y; o.dir = p.dir; o.moving = !!p.m; o.last = performance.now(); } }
    if (ev === 'chat') { addMsg({ ...p, text: String(p.text).slice(0, 120), name: String(p.name).slice(0, 16) }); if (p.ch === 'village') bubbles.set(p.id, { text: String(p.text).slice(0, 120), until: performance.now() + 5000 }); }
  };
  const countEl = root.querySelector('#count');
  const onPresence = (list) => {
    const seen = new Set();
    for (const m of list) {
      if (!m || m.id === me.id) continue; seen.add(m.id);
      if (!others.has(m.id)) { others.set(m.id, { meta: m, x: m.x, y: m.y, tx: m.x, ty: m.y, dir: m.dir || 0, moving: false, anim: 0, last: performance.now() }); addMsg({ sys: true, text: `${m.name} arrived.`, ch: 'village' }); }
      else others.get(m.id).meta = m;
    }
    for (const id of [...others.keys()]) if (!seen.has(id)) { addMsg({ sys: true, text: `${others.get(id).meta.name} left.` }); others.delete(id); }
    countEl.textContent = others.size + 1;
  };
  try {
    room = await net.joinRoom('village:' + char.village, { me: meta(), onEvent, onPresence, events: ['mv', 'chat'] });
    worldRoom = await net.joinRoom('world', { onEvent, events: ['chat'] });
  } catch (e) { addMsg({ sys: true, text: 'Could not connect to other players. You can still explore.' }); console.error(e); }

  // ---------- loop ----------
  let camX = 0, camY = 0, last = performance.now(), alive = true, t = 0;
  function step(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    // movement
    let mx = 0, my = 0;
    const frozen = !!root.querySelector('.ov') || !modal.hidden;
    if (!typing() && !frozen) {
      if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
      if (keys.has('arrowright') || keys.has('d')) mx += 1;
      if (keys.has('arrowup') || keys.has('w')) my -= 1;
      if (keys.has('arrowdown') || keys.has('s')) my += 1;
    }
    if (!frozen && joy.id !== null && Math.hypot(joy.x, joy.y) > 0.25) { mx = joy.x; my = joy.y; }
    const mag = Math.hypot(mx, my);
    me.moving = mag > 0;
    if (me.moving) {
      mx /= Math.max(1, mag); my /= Math.max(1, mag);
      const nx = me.x + mx * SPEED * dt, ny = me.y + my * SPEED * dt;
      if (!blocked(world, nx, me.y)) me.x = nx;
      if (!blocked(world, me.x, ny)) me.y = ny;
      me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
      me.anim += dt;
    } else me.anim = 0;
    // network send
    if (room && now - lastSend > (me.moving ? 100 : 1000)) {
      if (me.moving || now - lastSend > 1000) { room.send('mv', { id: me.id, x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, m: me.moving ? 1 : 0 }); lastSend = now; }
    }
    if (room && now - lastTrack > 4000) { room.track(meta()); lastTrack = now; }
    if (now - lastSave > 15000) { lastSave = now; net.savePosition(me.x, me.y).catch(() => {}); }
    // others interpolate
    for (const o of others.values()) {
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy);
      if (d > 120) { o.x = o.tx; o.y = o.ty; }
      else if (d > 0.5) { const s = Math.min(d, Math.max(SPEED * 1.15 * dt, d * 0.2)); o.x += (dx / d) * s; o.y += (dy / d) * s; o.anim += dt; }
      else if (!o.moving) o.anim = 0;
    }
    // prompt
    const s = nearSpot();
    if (s) { promptEl.hidden = false; promptEl.textContent = (isTouch ? 'Tap A: ' : 'Press E: ') + s.name; } else promptEl.hidden = true;
    draw();
    requestAnimationFrame(step);
  }

  function draw() {
    const W = view.width, H = view.height, sc = scale;
    const viewW = W / sc, viewH = H / sc;
    camX = Math.round(Math.max(0, Math.min(MW * T - viewW, me.x - viewW / 2)));
    camY = Math.round(Math.max(0, Math.min(MH * T - viewH, me.y - 12 - viewH / 2)));
    if (viewW > MW * T) camX = Math.round((MW * T - viewW) / 2);
    if (viewH > MH * T) camY = Math.round((MH * T - viewH) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = world.th.edge === 'sea' ? world.th.water : '#2a3a1e';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(world.groundCanvas, camX, camY, viewW, viewH, 0, 0, viewW * sc, viewH * sc);
    // water shimmer
    ctx.fillStyle = world.th.waterL;
    for (let ty = Math.max(0, (camY / T) | 0); ty < Math.min(MH, (camY + viewH) / T + 1); ty++)
      for (let tx = Math.max(0, (camX / T) | 0); tx < Math.min(MW, (camX + viewW) / T + 1); tx++)
        if (world.ground[ty * MW + tx] === 3) { const o = ((t * 4 + tx * 3 + ty * 5) | 0) % 12; ctx.fillRect((tx * T + o - camX) * sc, (ty * T + 6 + (tx % 3) * 3 - camY) * sc, 3 * sc, sc); }
    // sortable drawables
    const list = [];
    for (const p of world.props) {
      if (!p.img) continue;
      const x = p.x + p.img.ox, y = p.y + p.img.oy;
      if (x > camX + viewW || y > camY + viewH || x + p.img.img.width < camX || y + p.img.img.height < camY) continue;
      list.push({ y: p.y, draw: () => ctx.drawImage(p.img.img, Math.round((x - camX) * sc), Math.round((y - camY) * sc), p.img.img.width * sc, p.img.img.height * sc) });
    }
    const drawNinja = (n, look, isMe) => {
      const frame = n.moving || (n.anim > 0) ? [1, 0, 2, 0][Math.floor(n.anim * 8) % 4] : 0;
      const spr = ninjaSprite(look || {}, n.dir || 0, frame);
      const x = n.x - 9, y = n.y - 25;
      list.push({ y: n.y, draw: () => {
        ctx.fillStyle = 'rgba(30,20,10,.28)'; ctx.fillRect(Math.round((n.x - 6 - camX) * sc), Math.round((n.y - 1 - camY) * sc), 12 * sc, 2 * sc);
        ctx.drawImage(spr, Math.round((x - camX) * sc), Math.round((y - camY) * sc), spr.width * sc, spr.height * sc);
      }, label: { x: n.x, y: n.y - 28, name: n.name || n.meta?.name, me: isMe, id: n.id || n.meta?.id } });
    };
    for (const o of others.values()) drawNinja(o, o.meta.look, false);
    drawNinja(me, me.look, true);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    // labels + bubbles (screen space, crisp text)
    const fsz = Math.max(11, Math.round(sc * 3.3));
    ctx.font = `${fsz}px 'Pixelify Sans', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const now = performance.now();
    for (const d of list) {
      if (!d.label) continue;
      const L = d.label, sx = Math.round((L.x - camX) * sc), sy = Math.round((L.y - camY) * sc);
      const w = ctx.measureText(L.name).width + 8;
      ctx.fillStyle = 'rgba(36,22,14,.62)'; ctx.fillRect(sx - w / 2, sy - fsz - 2, w, fsz + 4);
      ctx.fillStyle = L.me ? '#ffe07a' : '#fff4dc'; ctx.fillText(L.name, sx, sy + 1);
      const b = bubbles.get(L.id);
      if (b && b.until > now) drawBubble(sx, sy - fsz - 6, b.text, fsz);
    }
  }
  function drawBubble(x, y, text, fsz) {
    const maxW = Math.min(240 * (view.width / vw), view.width * 0.6);
    const words = text.split(' '); const lines = []; let line = '';
    for (const w of words) { const tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; }
    if (line) lines.push(line);
    const lh = fsz + 2, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, bh = lines.length * lh + 8;
    const bx = x - bw / 2, by = y - bh - 6;
    ctx.fillStyle = '#24160e'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillRect(x - 3, by + bh, 6, 4); ctx.fillStyle = '#24160e'; ctx.fillRect(x - 5, by + bh, 2, 4); ctx.fillRect(x + 3, by + bh, 2, 4); ctx.fillRect(x - 3, by + bh + 4, 6, 2);
    ctx.fillStyle = '#3a2414';
    lines.forEach((l, i) => ctx.fillText(l, x, by + 4 + (i + 1) * lh - 1));
  }

  async function leave() {
    alive = false;
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('resize', resize);
    document.body.classList.remove('in-world');
    try { await net.savePosition(me.x, me.y); } catch {}
    room?.leave(); worldRoom?.leave();
  }
  addEventListener('pagehide', () => { room?.leave(); }, { once: true });
  requestAnimationFrame(step);
  return { leave };
}
