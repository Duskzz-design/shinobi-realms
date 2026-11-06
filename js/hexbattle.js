// Hex tactical battle screen (missions and exams). The battle server decides every roll; this file draws and animates.
import * as net from './net.js';
import * as G from './engine.js';
import { ninjaSprite, beastSprite } from './sprites.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));
const GRADE_COL = { D: '#3a8a4a', C: '#2f7fc4', B: '#9a5ad0', A: '#e8742c', S: '#c43c32', X: '#b8860b' };
const RANKS = G.RANKS;
export const STYLE_INFO = {
  ninjutsu: { label: 'Ninjutsu', color: '#e8742c', icon: '🔥' }, genjutsu: { label: 'Genjutsu', color: '#9a5ad0', icon: '🌀' },
  taijutsu: { label: 'Taijutsu', color: '#d84a3a', icon: '👊' }, bukijutsu: { label: 'Bukijutsu', color: '#7a8a9a', icon: '🗡️' },
  bloodline: { label: 'Bloodline', color: '#c43c8a', icon: '🧬' }, none: { label: 'Basic', color: '#8a7a5a', icon: '🧘' },
};
function toast(msg, kind = 'err') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

// board geometry (canvas pixels)
const W = 320, H = 200, S = 16, HW = Math.sqrt(3) * S, X0 = (W - HW * (G.GW + 0.5)) / 2 + HW / 2, Y0 = 26;
const hx = (c, r) => [X0 + c * HW + (r & 1 ? HW / 2 : 0), Y0 + r * S * 1.5];
function hexPath(ctx, x, y, s = S - 0.5) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); ctx.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)); } ctx.closePath(); }
function hexAt(px, py) { let best = null, bd = 1e9; for (let r = 0; r < G.GH; r++) for (let c = 0; c < G.GW; c++) { const [x, y] = hx(c, r), d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; best = [c, r]; } } return bd < S * S ? best : null; }

export async function runBattle(root, char, missionId, onEnd, start = null) {
  let battle;
  try { battle = await (start ? start() : net.startMission(missionId)); }
  catch (e) { toast(e.message); onEnd(null); return; }
  let S0 = battle.state, eng = S0.engine;
  const me = () => eng.units.a, foe = () => eng.units.b;
  const el = h(`<div class="ov battle hexb">
    <div class="b-top"><span class="grade" style="background:${GRADE_COL[S0.mission.grade]}">${S0.exam ? '★' : S0.mission.grade}</span><b>${esc(S0.mission.name)}</b>${S0.exam ? `<span class="rnd">Round ${S0.exam.round}/${S0.exam.rounds}</span>` : ''}<span class="turn"></span></div>
    <div class="hx-arena"><canvas width="${W}" height="${H}"></canvas><div class="hx-banner" hidden></div></div>
    <div class="hx-cards"><div class="hx-card p"></div><div class="hx-card e"></div></div>
    <div class="hx-info"></div>
    <div class="b-tabs"></div>
    <div class="hx-moves"></div>
    <div class="hx-bar"><button class="btn small ghost" data-u="guard">🛡️ Guard <small>1 AP</small></button><button class="btn small ghost" data-u="focus">🧘 Focus <small>2 AP</small></button>
      <button class="btn small primary" data-end>End turn ▶</button><button class="btn small ghost" data-flee>🏃</button></div>
  </div>`);
  root.appendChild(el);
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), info = el.querySelector('.hx-info'), banner = el.querySelector('.hx-banner');
  let sel = null, hover = null, busy = false, alive = true, tab = null, t = 0;
  const fx = { floats: [], proj: null, flash: null, anim: {} };
  const mine = () => me().moves.filter((id) => id !== 'focus' && id !== 'guard');
  const styles = () => [...new Set(mine().map((id) => G.MOVES[id].style))].sort((a, b) => Object.keys(STYLE_INFO).indexOf(a) - Object.keys(STYLE_INFO).indexOf(b));
  tab = styles()[0] || 'taijutsu';

  // ---------- panels ----------
  const elChip = (e) => e ? `<span class="elc" style="--c:${G.ELEMENT_INFO[e].color}">${G.ELEMENT_INFO[e].icon} ${G.ELEMENT_INFO[e].label}</span>` : '';
  const stIcons = (u) => u.effects.map((x) => `<span class="sti ${G.STATUS[x.k].good ? 'good' : 'bad'}" title="${G.STATUS[x.k].label} (${x.turns})">${G.STATUS[x.k].icon}<small>${x.turns}</small></span>`).join('');
  function cards() {
    const p = me(), e = foe(), max = G.apMax(p) + 2, myTurn = eng.side === 'a';
    el.querySelector('.hx-card.p').innerHTML = `<div class="nm"><b>${esc(p.name)}</b>${p.elements.map(elChip).join('')}${p.bloodline ? `<span class="elc" style="--c:#c43c8a">${G.BLOODLINES[p.bloodline].icon}</span>` : ''}</div>
      <div class="gbar hp ${p.hp / p.hpmax < 0.3 ? 'low' : ''}"><i style="width:${100 * p.hp / p.hpmax}%"></i><span>❤️ ${p.hp}/${p.hpmax}</span></div>
      <div class="gbar sta"><i style="width:${100 * p.st / p.stmax}%"></i><span>💪 ${p.st}/${p.stmax}</span></div>
      <div class="gbar ch"><i style="width:${100 * p.ch / p.chmax}%"></i><span>💧 ${p.ch}/${p.chmax}</span></div>
      <div class="aprow">${myTurn ? Array.from({ length: Math.max(max, p.ap) }, (_, i) => `<i class="${i < p.ap ? 'on' : ''}"></i>`).join('') + `<b>${p.ap} AP</b>` : '<b class="wait">Enemy turn…</b>'}</div>
      <div class="sts">${stIcons(p)}</div>`;
    el.querySelector('.hx-card.e').innerHTML = `<div class="nm"><b>${esc(e.name)}</b><small>Lv ${e.level}</small>${e.elements.map(elChip).join('')}</div>
      <div class="gbar hp ${e.hp / e.hpmax < 0.3 ? 'low' : ''}"><i style="width:${100 * e.hp / e.hpmax}%"></i><span>${e.hp}/${e.hpmax}</span></div>
      <div class="sts">${stIcons(e)}</div>`;
    el.querySelector('.turn').textContent = `Turn ${eng.turn}`;
  }
  function moveBtn(id) {
    const m = G.MOVES[id], p = me(), learned = p.moves.includes(id), jl = p.jl[id] || 1;
    const afford = learned && p.ap >= m.ap && p.st >= m.stamina && p.ch >= m.chakra;
    const rng = m.target === 'self' ? 'Self' : m.range[1] === 0 ? `Around you` : m.range[0] === m.range[1] ? `Range ${m.range[1]}` : `Range ${m.range[0]}-${m.range[1]}`;
    const c = STYLE_INFO[m.style].color;
    return `<button class="mv hx ${learned ? '' : 'locked'} ${sel === id ? 'sel' : ''}" data-m="${id}" style="--c:${m.element ? G.ELEMENT_INFO[m.element].color : c}" ${learned && afford && !busy && eng.side === 'a' ? '' : 'disabled'}>
      <b>${learned ? '' : '🔒 '}${esc(m.name)}${learned ? ` <span class="jl">Lv ${jl}</span>` : ''}</b>
      <small>${learned ? `<em class="ap">${m.ap} AP</em> ${rng}${m.aoe ? ' · Area' : ''} · ${[m.stamina ? '💪' + m.stamina : '', m.chakra ? '💧' + m.chakra : ''].join(' ').trim() || 'Free'}` : `${RANKS[m.tier]} rank`}</small></button>`;
  }
  function panel() {
    const st = styles();
    el.querySelector('.b-tabs').innerHTML = st.map((k) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}" style="--c:${STYLE_INFO[k].color}">${STYLE_INFO[k].icon} <span>${STYLE_INFO[k].label}</span></button>`).join('');
    const p = me();
    const locked = Object.keys(G.MOVES).filter((id) => { const m = G.MOVES[id]; return m.style === tab && !p.moves.includes(id) && m.style !== 'bloodline' && (m.style !== 'ninjutsu' || p.elements.includes(m.element)); });
    el.querySelector('.hx-moves').innerHTML = mine().filter((id) => G.MOVES[id].style === tab).concat(locked).map(moveBtn).join('');
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; panel(); }));
    el.querySelectorAll('.hx-moves [data-m]').forEach((b) => (b.onclick = () => pick(b.dataset.m)));
    const myTurn = eng.side === 'a' && !busy;
    el.querySelectorAll('.hx-bar [data-u]').forEach((b) => { const m = G.MOVES[b.dataset.u]; b.disabled = !myTurn || p.ap < m.ap; b.classList.toggle('sel', sel === b.dataset.u); });
    el.querySelector('[data-end]').disabled = !myTurn; el.querySelector('[data-flee]').disabled = busy;
    cards();
  }
  function say(html) { info.innerHTML = html; }
  function idleInfo() {
    if (eng.side !== 'a') return say('Enemy turn…');
    const p = me();
    if (G.hasStatus(p, 'root')) return say(`🌿 You are <b>rooted</b> and cannot move this turn. Use a technique or end your turn.`);
    say(`<b>Tap a blue hex</b> to move (1 AP each), or <b>pick a technique</b> below. You have <b>${p.ap} AP</b>.`);
  }
  function moveInfo(id) {
    const m = G.MOVES[id], p = me(), e = foe();
    const mult = m.element ? G.elementMult(m.element, e.elements[0]) : 1;
    const mtxt = mult > 1 ? `<span class="good">Strong vs ${G.ELEMENT_INFO[e.elements[0]].label} ×1.5</span>` : mult < 1 ? `<span class="bad">Weak vs ${G.ELEMENT_INFO[e.elements[0]].label} ×0.7</span>` : '';
    const effs = m.effects.map((x) => `${G.STATUS[x.k].icon} ${G.STATUS[x.k].label}${x.chance < 1 ? ` ${Math.round(x.chance * 100)}%` : ''}`).join(', ');
    let how = '';
    if (m.target === 'self' || m.range[1] === 0) how = `<b>Tap it again</b> (or tap yourself) to use.`;
    else {
      const ok = m.target === 'enemy' ? G.canHitFrom(eng, m, [p.c, p.r], [e.c, e.r]) : true;
      how = m.target === 'enemy' ? (ok ? `<b>Tap the enemy</b> to strike.` : G.inRange(m, [p.c, p.r], [e.c, e.r]) ? `<span class="bad">A rock blocks your line.</span> Move to get a clear shot.` : `<span class="bad">Out of range.</span> Move into the orange area first.`) : `<b>Tap a hex</b> in the orange area to aim.`;
    }
    say(`<b>${esc(m.name)}</b> ${m.power ? `· Power ${m.power}` : ''} ${mtxt}<br><small>${esc(m.desc)}${effs ? ' · ' + effs : ''}</small><br>${how}`);
  }
  function pick(id) {
    if (busy || eng.side !== 'a') return;
    const m = G.MOVES[id];
    if (sel === id && (m.target === 'self' || m.range[1] === 0)) return send({ t: 'use', move: id, at: null });
    sel = sel === id ? null : id; panel(); sel ? moveInfo(id) : idleInfo();
  }
  el.querySelectorAll('.hx-bar [data-u]').forEach((b) => (b.onclick = () => pick(b.dataset.u)));
  el.querySelector('[data-end]').onclick = () => { sel = null; send({ t: 'end' }); };
  el.querySelector('[data-flee]').onclick = () => { if (confirmFlee()) send({ t: 'flee' }); };
  let fleeArmed = 0;
  function confirmFlee() { if (Date.now() - fleeArmed < 3000) return true; fleeArmed = Date.now(); say(`<b>Retreat?</b> Tap 🏃 again to give up this fight.${S0.exam ? ' You will fail the exam.' : ''}`); return false; }

  // ---------- board input ----------
  const toCanvas = (ev) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height]; };
  cv.addEventListener('pointermove', (ev) => { hover = hexAt(...toCanvas(ev)); });
  cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('click', (ev) => {
    const hex = hexAt(...toCanvas(ev)); if (!hex || busy || eng.side !== 'a') return;
    const p = me(), e = foe(), onFoe = hex[0] === e.c && hex[1] === e.r, onMe = hex[0] === p.c && hex[1] === p.r;
    if (sel) {
      const m = G.MOVES[sel];
      if (m.target === 'self' || m.range[1] === 0) { if (onMe || (m.range[1] === 0 && G.dist(hex, [p.c, p.r]) <= m.aoe)) return send({ t: 'use', move: sel, at: null }); }
      else if (m.target === 'enemy' && onFoe) { if (G.canHitFrom(eng, m, [p.c, p.r], hex)) return send({ t: 'use', move: sel, at: hex }); return moveInfo(sel); }
      else if (m.target === 'hex' && G.canHitFrom(eng, m, [p.c, p.r], hex)) return send({ t: 'use', move: sel, at: hex });
    }
    if (onFoe) { const e2 = foe(); say(`<b>${esc(e2.name)}</b> ${e2.elements[0] ? `· ${G.ELEMENT_INFO[e2.elements[0]].label} user: weak to ${G.ELEMENT_INFO[G.ELEMENTS[(G.ELEMENTS.indexOf(e2.elements[0]) + 4) % 5]].label}` : '· no element'}<br><small>${e2.ai === 'ranged' ? 'Fights from range: close the gap or break line of sight.' : 'Fights up close: keep your distance and strike from range.'}</small>`); return; }
    const reach = G.reachable(eng, p, p.ap), k = G.key(hex[0], hex[1]);
    if (reach.has(k) && reach.get(k).cost > 0) return send({ t: 'move', to: hex });
  });

  // ---------- server round trip ----------
  async function send(action) {
    if (busy) return; busy = true; panel();
    let res;
    try { res = await net.battleAct(battle.id, action); }
    catch (e) { busy = false; panel(); say(`<span class="bad">${esc(e.message)}</span>`); return; }
    sel = null;
    if (res.status === 'fled') { finish(); onEnd({ status: 'fled' }); return; }
    await play(res.events);
    S0 = res.state; eng = S0.engine; battle.status = res.status;
    busy = false; panel();
    if (res.status === 'won' || res.status === 'lost') { await wait(500); showResult(res); return; }
    idleInfo();
    if (eng.side === 'a' && me().ap <= 0 && !G.hasStatus(me(), 'stun')) { say('Out of AP. Ending your turn…'); await wait(500); send({ t: 'end' }); }
  }

  // ---------- event animation ----------
  const unit = (who) => eng.units[who];
  const float = (who, text, color, dy = 0) => { const u = unit(who); const [x, y] = hx(u.c, u.r); fx.floats.push({ x, y: y - 26 - dy, text, color, life: 50 }); };
  function showBanner(text, cls) { banner.textContent = text; banner.className = 'hx-banner ' + cls; banner.hidden = false; setTimeout(() => (banner.hidden = true), 900); }
  async function play(events) {
    eng = clone(eng);
    for (const ev of events) {
      if (!alive) return;
      const name = ev.who ? unit(ev.who).name : '';
      if (ev.t === 'move') {
        say(ev.who === 'a' ? 'You move.' : `${esc(name)} moves.`);
        for (const [c, r] of ev.path) { unit(ev.who).c = c; unit(ev.who).r = r; fx.anim[ev.who] = t; await wait(110); }
      } else if (ev.t === 'use') {
        const u = unit(ev.who), tgt = unit(ev.who === 'a' ? 'b' : 'a'), m = ev.who === 'a' ? G.MOVES[ev.move] : G.ENEMY_MOVES[ev.move];
        say(`${ev.who === 'a' ? 'You use' : esc(name) + ' uses'} <b>${esc(ev.name)}</b>!`);
        const col = ev.element ? G.ELEMENT_INFO[ev.element].color : STYLE_INFO[ev.style || 'taijutsu']?.color || '#c9ccd4';
        if (m.target === 'self') { fx.flash = { at: [u.c, u.r], r: 0, col, life: 18 }; await wait(380); }
        else {
          const to = ev.at || [u.c, u.r];
          if (m.range[1] <= 1 && !m.aoe) { fx.anim[ev.who] = t; fx.lunge = { who: ev.who, to: [tgt.c, tgt.r], start: t }; await wait(260); fx.lunge = null; }
          else if (m.range[1] > 0) await shoot([u.c, u.r], to, col, ev.style === 'bukijutsu' ? 'blade' : ev.style === 'genjutsu' ? 'swirl' : 'orb', !!ev.aoe);
          if (ev.aoe) { fx.flash = { at: to, r: ev.aoe, col, life: 22 }; await wait(200); }
        }
        if (ev.focus) float(ev.who, `+${ev.focus} 💪💧`, '#7cc4ec');
        if (ev.heal) { u.hp = Math.min(u.hpmax, u.hp + ev.heal); float(ev.who, `+${ev.heal}`, '#7ce08a'); }
        if (ev.self) ev.self.forEach((k, i) => setTimeout(() => float(ev.who, G.STATUS[k].icon + ' ' + G.STATUS[k].label, '#ffe07a', 12 + i * 10), i * 150));
        for (const hit of ev.hits || []) {
          if (!hit.hit) { float(hit.who, hit.dodge ? 'DODGE' : 'MISS', hit.dodge ? '#9fe0a0' : '#c9ccd4'); continue; }
          const v = unit(hit.who); v.hp = Math.max(0, v.hp - hit.dmg); fx.hurt = { who: hit.who, start: t };
          float(hit.who, hit.crit ? `CRIT ${hit.dmg}` : String(hit.dmg), hit.crit ? '#ffe07a' : hit.who === 'a' ? '#ff8f7a' : '#fff4dc');
          if (hit.mult > 1) float(hit.who, 'Super effective!', '#ffb04a', 14); else if (hit.mult < 1) float(hit.who, 'Resisted', '#9ab0c0', 14);
          (hit.effects || []).forEach((k, i) => setTimeout(() => float(hit.who, G.STATUS[k].icon + ' ' + G.STATUS[k].label, '#e0a0ff', 26 + i * 10), 200 + i * 160));
        }
        cards(); await wait(ev.hits?.length ? 620 : 300);
      } else if (ev.t === 'dot') {
        const u = unit(ev.who); u.hp = Math.max(0, u.hp - ev.dmg); float(ev.who, `${G.STATUS[ev.k].icon} ${ev.dmg}`, '#ff9a63'); cards(); await wait(420);
      } else if (ev.t === 'heal') { const u = unit(ev.who); u.hp = Math.min(u.hpmax, u.hp + ev.amount); float(ev.who, `💚 +${ev.amount}`, '#7ce08a'); cards(); await wait(380);
      } else if (ev.t === 'stunned') { float(ev.who, '💫 Stunned!', '#ffe07a'); await wait(450);
      } else if (ev.t === 'turn') { eng.side = ev.who; showBanner(ev.who === 'a' ? 'Your turn' : 'Enemy turn', ev.who); cards(); await wait(ev.who === 'b' ? 500 : 250);
      } else if (ev.t === 'end') { fx.dead = ev.winner === 'a' ? 'b' : 'a'; await wait(600); }
    }
  }
  function shoot(from, to, col, kind, big) {
    return new Promise((res) => { const [x0, y0] = hx(...from), [x1, y1] = hx(...to); fx.proj = { x0, y0: y0 - 10, x1, y1: y1 - 10, k: 0, col, kind, big, done: res }; });
  }

  // ---------- drawing ----------
  const theme = { pine: ['#5aa64c', '#4f9a44', '#3f8a46'], dune: ['#e8c88a', '#dcb978', '#c99a5e'], tide: ['#7cc87a', '#6cbc6c', '#5aa858'] }[char.village] || ['#5aa64c', '#4f9a44', '#3f8a46'];
  function rock(x, y) {
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 10, y - 4, 20, 9); ctx.fillStyle = '#8a7a66'; ctx.fillRect(x - 9, y - 8, 17, 10); ctx.fillStyle = '#a89a84'; ctx.fillRect(x - 6, y - 9, 9, 4);
    ctx.fillStyle = '#6a5a48'; ctx.fillRect(x + 2, y - 3, 6, 3); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 10, y + 5, 20, 2);
  }
  function draw() {
    if (!alive) return; t++;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme[2]; ctx.fillRect(0, 0, W, H);
    const p = me(), e = foe(), myTurn = eng.side === 'a' && !busy;
    const reach = myTurn && !sel ? G.reachable(eng, p, p.ap) : null;
    const m = sel ? G.MOVES[sel] : null;
    let aoe = null;
    if (m && myTurn) {
      if (m.range[1] === 0) aoe = { at: [p.c, p.r], r: m.aoe };
      else if (m.target === 'hex' && hover && G.canHitFrom(eng, m, [p.c, p.r], hover)) aoe = { at: hover, r: m.aoe };
    }
    let path = null;
    if (reach && hover && reach.has(G.key(...hover))) path = G.pathTo(reach, ...hover);
    for (let r = 0; r < G.GH; r++) for (let c = 0; c < G.GW; c++) {
      const [x, y] = hx(c, r), k = G.key(c, r);
      hexPath(ctx, x, y); ctx.fillStyle = (c + r) % 2 ? theme[0] : theme[1]; ctx.fill();
      if (reach && reach.has(k) && reach.get(k).cost > 0) { ctx.fillStyle = 'rgba(120,200,255,.3)'; ctx.fill(); }
      if (m && myTurn && m.target !== 'self' && m.range[1] > 0 && G.canHitFrom(eng, m, [p.c, p.r], [c, r])) { ctx.fillStyle = 'rgba(255,170,60,.45)'; ctx.fill(); }
      if (aoe && G.dist(aoe.at, [c, r]) <= aoe.r) { ctx.fillStyle = 'rgba(230,50,40,.35)'; ctx.fill(); }
      if (fx.flash && G.dist(fx.flash.at, [c, r]) <= fx.flash.r) { ctx.globalAlpha = fx.flash.life / 22; ctx.fillStyle = fx.flash.col; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = 'rgba(30,40,20,.35)'; ctx.lineWidth = 1; ctx.stroke();
      if (hover && hover[0] === c && hover[1] === r && myTurn) { ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2; hexPath(ctx, x, y, S - 2); ctx.stroke(); }
    }
    if (fx.flash && --fx.flash.life <= 0) fx.flash = null;
    if (path) { ctx.fillStyle = '#fff4dc'; for (const [c, r] of path) { const [x, y] = hx(c, r); ctx.fillRect(x - 2, y - 2, 4, 4); } }
    // things sorted by row so lower rows draw on top
    const things = eng.rocks.map((k) => { const [c, r] = k.split(',').map(Number); return { r, c, rock: true }; });
    for (const id of ['a', 'b']) { const u = unit(id); things.push({ r: u.r, c: u.c, u, id }); }
    things.sort((a, b) => a.r - b.r);
    for (const th of things) {
      let [x, y] = hx(th.c, th.r);
      if (th.rock) { rock(x, y); continue; }
      const u = th.u, foeU = unit(th.id === 'a' ? 'b' : 'a');
      if (fx.dead === th.id && t % 8 < 4) continue;
      if (fx.lunge && fx.lunge.who === th.id) { const [tx, ty] = hx(...fx.lunge.to), k = Math.sin(Math.min(1, (t - fx.lunge.start) / 14) * Math.PI) * 0.45; x += (tx - x) * k; y += (ty - y) * k; }
      const hurt = fx.hurt && fx.hurt.who === th.id && t - fx.hurt.start < 16;
      const dir = foeU.c < u.c || (foeU.c === u.c && th.id === 'b') ? 1 : 2;
      const moving = fx.anim[th.id] && t - fx.anim[th.id] < 8;
      ctx.fillStyle = 'rgba(20,20,10,.3)'; ctx.fillRect(x - 7, y + 5, 14, 3);
      if (th.id === eng.side && !busy) { ctx.strokeStyle = th.id === 'a' ? '#ffe07a' : '#ff8f7a'; ctx.lineWidth = 1; hexPath(ctx, x, y, S - 3); ctx.stroke(); }
      let spr;
      if (u.kind === 'ninja') spr = ninjaSprite(u.look, dir, moving ? 1 + ((t >> 3) & 1) : fx.lunge && fx.lunge.who === th.id ? 3 : 0);
      else spr = beastSprite(u.kind, u.look?.tint, (t >> 4) % 2);
      ctx.save(); if (hurt && t % 4 < 2) ctx.globalAlpha = 0.35;
      if (u.kind !== 'ninja' && dir === 2) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -spr.width / 2, y + 7 - spr.height); }
      else ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y + 7 - spr.height));
      ctx.restore();
      // mini hp bar
      const bw = 22; ctx.fillStyle = '#24160e'; ctx.fillRect(x - bw / 2 - 1, y - spr.height + 2, bw + 2, 4);
      ctx.fillStyle = th.id === 'a' ? '#5ccf5c' : '#e8542c'; ctx.fillRect(x - bw / 2, y - spr.height + 3, Math.max(0, bw * u.hp / u.hpmax), 2);
      if (G.hasStatus(u, 'stun')) { ctx.fillStyle = '#ffe07a'; for (let i = 0; i < 3; i++) { const a = t / 8 + i * 2.1; ctx.fillRect(x + Math.cos(a) * 7 - 1, y - spr.height - 3 + Math.sin(a) * 2, 2, 2); } }
    }
    // projectile
    if (fx.proj) {
      const pr = fx.proj; pr.k += pr.kind === 'blade' ? 0.09 : 0.06; const k = Math.min(1, pr.k);
      const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * (pr.kind === 'blade' ? 8 : 4);
      ctx.fillStyle = pr.col;
      if (pr.kind === 'blade') { ctx.save(); ctx.translate(x, y); ctx.rotate(t / 2); ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8); ctx.restore(); }
      else if (pr.kind === 'swirl') { ctx.strokeStyle = pr.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, t / 3, t / 3 + 4); ctx.stroke(); }
      else { const s = pr.big ? 6 : 4; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 1, y - 2, 2, 2); }
      if (pr.k >= 1) { fx.proj = null; pr.done(); }
    }
    ctx.textAlign = 'center'; ctx.font = "8px 'Press Start 2P', monospace";
    fx.floats = fx.floats.filter((f) => f.life-- > 0);
    for (const f of fx.floats) { const y = f.y - (50 - f.life) * 0.4; ctx.fillStyle = '#24160e'; ctx.fillText(f.text, f.x + 1, y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y); }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  panel(); idleInfo(); showBanner('Your turn', 'a');
  if (S0.exam && S0.exam.round === 1) say(`<b>${esc(S0.mission.name)}.</b> Move with blue hexes, use rocks as cover, and strike from range. Good luck!`);
  window.__hex = { get eng() { return eng; }, send, pick, hx, cv };

  function finish() { alive = false; el.remove(); }
  function showResult(res) {
    const won = res.status === 'won', r = res.result || {}, exam = S0.exam;
    let body;
    const ups = Object.entries(r.jutsu_up || {}).map(([id, lv]) => `<p class="lvl">📜 ${esc(G.MOVES[id]?.name || id)} reached level ${lv}!</p>`).join('');
    const blood = r.bloodline_test ? (r.bloodline ? `<div class="blood"><div class="bico">${G.BLOODLINES[r.bloodline].icon}</div><h4>Bloodline awakened: ${esc(G.BLOODLINES[r.bloodline].label)}!</h4><p>${esc(G.BLOODLINES[r.bloodline].desc)} Only 1 in 100 ninja are born with this. You can now use its secret techniques in battle.</p></div>`
      : `<div class="blood none"><h4>🧬 Bloodline test</h4><p>The Academy tested your blood: no bloodline awakened. Only 1 in 100 carry one. Most legends were made by training and clever tactics.</p></div>`) : '';
    if (exam && won && r.next) body = `<h3 class="win">Round ${r.exam_round} cleared!</h3>${ups}<p>Catch your breath: you recover 30% of your HP, stamina and chakra before the next round.</p>
      <div class="row"><button class="btn primary" data-next>Next round ▶</button></div>`;
    else if (exam && won && r.promoted) body = `<div class="promo">★</div><h3 class="win">You are now a ${esc(r.promoted)}!</h3>${blood}
      <p class="lvl">New level cap, higher stat caps, and ${esc(r.promoted)} jutsu unlocked.<br>+${r.ryo} ryo and your energy is full.</p>${ups}
      <div class="row"><button class="btn primary" data-t>Train new jutsu</button><button class="btn ghost" data-back>Back to village</button></div>`;
    else if (exam) body = `<h3 class="lose">Exam failed…</h3><p>The proctors send you home to recover. You can try again after a 5-minute rest.</p>${ups}
      <p class="sub">Tip: use elements your opponent is weak to, and debuff them before big attacks.</p><div class="row"><button class="btn ghost" data-t>Train</button><button class="btn primary" data-back>Back to village</button></div>`;
    else body = `<h3 class="${won ? 'win' : 'lose'}">${won ? 'Mission complete!' : 'Defeated…'}</h3>
      ${won ? `<p class="big">+${r.xp} XP &nbsp; +${r.ryo} ryo</p>
        ${r.leveled ? `<p class="lvl">⬆ Level up! You are now level ${r.level}.<br>Your HP, stamina and chakra grew, and your energy is full!</p>` : ''}
        ${r.capped ? `<p class="cap">You've reached the highest level for your rank. Take the rank exam at the Academy to keep growing.</p>` : ''}`
        : `<p>You were carried back to the village to recover.${r.ryo_lost ? ` You dropped ${r.ryo_lost} ryo.` : ''}</p><p class="sub">Tip: keep out of melee foes' reach, hide behind rocks from ranged foes, and Focus when low on chakra.</p>`}${ups}
      <div class="row"><button class="btn ${won && r.leveled ? 'primary' : 'ghost'}" data-t>Train</button><button class="btn ${won && r.leveled ? 'ghost' : 'primary'}" data-back>Back to village</button></div>`;
    const box = h(`<div class="b-result"><div class="scroll">${body}</div></div>`);
    el.appendChild(box);
    const done = (extra = {}) => { finish(); onEnd({ status: res.status, result: r, ...extra }); };
    const back = box.querySelector('[data-back]'); if (back) back.onclick = () => done();
    const tr = box.querySelector('[data-t]'); if (tr) tr.onclick = () => done({ train: true });
    const nx = box.querySelector('[data-next]');
    if (nx) nx.onclick = () => { nx.disabled = true; finish(); runBattle(root, char, null, onEnd, () => net.examContinue(battle.id)); };
  }
}
