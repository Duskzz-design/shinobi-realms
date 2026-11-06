// Mission board, turn-based battle screen, and training (stat points) panel.
import * as net from './net.js';
import { ninjaSprite, beastSprite, VILLAGES } from './sprites.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const STATS = {
  strength: { label: 'Strength', short: 'STR', icon: '💪', color: '#d84a3a', blurb: 'Taijutsu power, Bukijutsu bonus. More health, stamina and defence.' },
  agility: { label: 'Agility', short: 'AGI', icon: '💨', color: '#3a8a4a', blurb: 'Bukijutsu power, Taijutsu bonus. More stamina, dodges and critical hits.' },
  intelligence: { label: 'Intelligence', short: 'INT', icon: '📜', color: '#2f7fc4', blurb: 'Ninjutsu power, Genjutsu bonus. More chakra.' },
  willpower: { label: 'Willpower', short: 'WIL', icon: '🔮', color: '#9a5ad0', blurb: 'Genjutsu power, Ninjutsu bonus. More chakra and health; effects land more often.' },
};
export const STYLES = {
  ninjutsu: { label: 'Ninjutsu', color: '#e8742c', icon: '🔥', main: 'intelligence', sec: 'willpower' },
  genjutsu: { label: 'Genjutsu', color: '#9a5ad0', icon: '🌀', main: 'willpower', sec: 'intelligence' },
  taijutsu: { label: 'Taijutsu', color: '#d84a3a', icon: '👊', main: 'strength', sec: 'agility' },
  bukijutsu: { label: 'Bukijutsu', color: '#7a8a9a', icon: '🗡️', main: 'agility', sec: 'strength' },
};
const RANKS = ['Academy Student', 'Genin', 'Chunin', 'Jonin'];
const TIER = ['Academy', 'Genin', 'Chunin', 'Jonin'];
const GRADE_COL = { D: '#3a8a4a', C: '#2f7fc4', B: '#9a5ad0', A: '#e8742c', S: '#c43c32' };
const cost = (m) => [m.stamina ? `💪${m.stamina}` : '', m.chakra ? `💧${m.chakra}` : ''].filter(Boolean).join(' ') || 'Free';

function overlay(root, cls, html) {
  const el = h(`<div class="ov ${cls}">${html}</div>`);
  root.appendChild(el);
  return el;
}

// ---------- mission board ----------
export async function openMissionBoard(root, char, onPick) {
  const el = overlay(root, 'board-wrap', `<div class="scroll board"><h3>Mission Board</h3><p class="sub">Pick a job. Win to earn XP and ryo.</p><div class="mlist"><div class="spinner"></div></div><button class="btn ghost" data-x>Close</button></div>`);
  el.querySelector('[data-x]').onclick = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  let cat;
  try { cat = await net.getCatalog(); } catch (e) { el.querySelector('.mlist').innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const ri = RANKS.indexOf(char.rank);
  el.querySelector('.mlist').innerHTML = cat.missions.map((m) => {
    const lockRank = ri < m.min_rank, lockLvl = char.level < m.min_level, locked = lockRank || lockLvl;
    const why = lockRank ? `Needs ${RANKS[m.min_rank]} rank` : lockLvl ? `Needs level ${m.min_level}` : '';
    return `<button class="mcard ${locked ? 'locked' : ''}" data-id="${m.id}" ${locked ? 'disabled' : ''}>
      <span class="grade" style="background:${GRADE_COL[m.grade]}">${m.grade}</span>
      <span class="mtxt"><b>${esc(m.name)}</b><small>${esc(m.description)}</small>
      <em>${locked ? '🔒 ' + why : `Foe: ${esc(m.enemy_name)} (Lv ${m.enemy_level}) · +${m.xp} XP · +${m.ryo} ryo`}</em></span></button>`;
  }).join('');
  el.querySelectorAll('.mcard:not(.locked)').forEach((b) => (b.onclick = () => { el.remove(); onPick(b.dataset.id); }));
}

// ---------- training ----------
export async function openTraining(root, getChar, setChar, startTab = 'stats') {
  const el = overlay(root, 'board-wrap', `<div class="scroll board train"></div>`);
  let tab = startTab, cat = null, busy = false, alive = true;
  const close = () => { alive = false; el.remove(); };
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  try { cat = await net.getCatalog(); } catch {}
  const energyNow = () => { const c = getChar(); return Math.min(c.energy_max || 100, c.energy + Math.floor((Date.now() - (c._loadedAt || Date.now())) / 1000 / (c.energy_regen_sec || 9))); };
  function render() {
    const c = getChar(), need = c.level * 100, v = VILLAGES[c.village], e = energyNow();
    const per = c.stat_point_cost || 560, prog = c.train_prog || {};
    const statRows = Object.entries(STATS).map(([k, s]) => {
      const atCap = c[k] >= c.stat_cap, p = prog[k] || 0;
      return `<div class="tst"><div class="tic" style="background:${s.color}">${s.icon}</div>
        <div class="tinfo"><b>${s.label} <span>${c[k]}</span><em>/ ${c.stat_cap}</em></b><small>${s.blurb}</small>
        <div class="mini" title="Progress to next point"><i style="width:${atCap ? 100 : Math.min(100, 100 * p / per)}%;background:${s.color}"></i></div>
        <small class="nx">${atCap ? 'At your rank cap' : `Next point: ${p} / ${per} energy`}</small></div>
        <div class="tbtns"><button class="btn small primary" data-s="${k}" data-n="1" ${atCap || e < 10 || busy ? 'disabled' : ''}>${atCap ? 'Capped' : 'Train<br><small>⚡10</small>'}</button>
        ${atCap ? '' : `<button class="btn small ghost" data-s="${k}" data-n="99" ${e < 10 || busy ? 'disabled' : ''}>Max<br><small>⚡${Math.floor(e / 10) * 10}</small></button>`}</div></div>`;
    }).join('');
    const moves = cat ? cat.moves.filter((m) => m.style !== 'none') : [];
    const jutsuRows = Object.entries(STYLES).map(([sk, st]) => `<h4 style="color:${st.color}">${st.icon} ${st.label} <small>uses ${STATS[st.main].short} + ${STATS[st.sec].short}</small></h4>` +
      moves.filter((m) => m.style === sk).map((m) => {
        const locked = m.tier > c.rank_index, j = (c.jutsu || {})[m.id] || { level: 1, xp: 0, next: 50 }, maxed = j.level >= 10;
        return `<div class="tst jt ${locked ? 'locked' : ''}"><div class="tinfo"><b>${locked ? '🔒 ' : ''}${esc(m.name)} ${locked ? '' : `<span>Lv ${j.level}</span>`}</b>
          <small>${TIER[m.tier]} jutsu · Power ${m.power} · ${cost(m)}${m.effect && m.effect !== 'focus' ? ' · ' + (m.effect === 'confuse' ? 'Confuse' : 'Stun') : ''}</small>
          ${locked ? `<small class="nx">Unlocks at ${RANKS[m.tier]} rank</small>` : `<div class="mini"><i style="width:${maxed ? 100 : 100 * j.xp / j.next}%;background:${st.color}"></i></div>
          <small class="nx">${maxed ? 'Mastered' : `${j.xp} / ${j.next} XP to level ${j.level + 1}`}</small>`}</div>
          ${locked ? '' : `<div class="tbtns"><button class="btn small primary" data-j="${m.id}" data-n="1" ${maxed || e < 10 || busy ? 'disabled' : ''}>${maxed ? 'Mastered' : 'Train<br><small>⚡10</small>'}</button>
          ${maxed ? '' : `<button class="btn small ghost" data-j="${m.id}" data-n="99" ${e < 10 || busy ? 'disabled' : ''}>Max<br><small>⚡${Math.floor(e / 10) * 10}</small></button>`}</div>`}</div>`;
      }).join('')).join('');
    el.querySelector('.board').innerHTML = `
      <h3>${esc(c.name)}</h3>
      <p class="sub" style="color:${v.dark}"><b>${v.name}</b> · ${esc(c.rank)} · Level ${c.level}</p>
      <div class="xp"><div style="width:${Math.min(100, (c.xp / need) * 100)}%"></div></div>
      <p class="sub">${c.xp} / ${need} XP · 💰 ${c.ryo} ryo</p>
      <div class="pools"><span>❤️ <b>${c.hp_max}</b> HP</span><span>💪 <b>${c.stamina_max}</b> Stamina</span><span>💧 <b>${c.chakra_max}</b> Chakra</span></div>
      <div class="energy"><b>⚡ Energy ${e} / ${c.energy_max}</b><div class="ebar"><i style="width:${e}%"></i></div>
        <small>${e >= c.energy_max ? 'Full! Spend it on training.' : `+1 every ${c.energy_regen_sec}s · full in ${fmt((c.energy_max - e) * c.energy_regen_sec)}`}</small></div>
      <div class="ttabs"><button data-tab="stats" class="${tab === 'stats' ? 'on' : ''}">General stats</button><button data-tab="jutsu" class="${tab === 'jutsu' ? 'on' : ''}">Jutsu</button></div>
      <div class="tstyles">${tab === 'stats' ? statRows : jutsuRows}</div>
      <button class="btn ghost" data-x>Close</button>`;
    el.querySelector('[data-x]').onclick = close;
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
    el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => doTrain(() => net.trainStat(b.dataset.s, +b.dataset.n), (r) => r.gained ? `${STATS[b.dataset.s].label} +${r.gained}!` : 'Training progress saved.')));
    el.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => doTrain(() => net.trainJutsu(b.dataset.j, +b.dataset.n), (r) => r.trained && r.trained.up ? `Jutsu level up! Now level ${r.trained.level}.` : 'Jutsu experience gained.')));
  }
  async function doTrain(fn, msg) {
    if (busy) return; busy = true; render();
    try {
      const r = await fn(); r._loadedAt = Date.now(); setChar(r);
      toast(msg(r), 'ok');
    } catch (e) { toast(e.message); }
    busy = false; render();
  }
  render();
  const tick = setInterval(() => { if (!alive || !el.isConnected) return clearInterval(tick); if (!busy) render(); }, 3000);
}
const fmt = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
function toast(msg, kind = 'err') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function alertMsg(el, msg) { toast(msg); }

// ---------- battle ----------
export async function runBattle(root, char, missionId, onEnd) {
  let battle, cat;
  try { [cat, battle] = await Promise.all([net.getCatalog(), net.startMission(missionId)]); }
  catch (e) { alertMsg(root, e.message); onEnd(null); return; }
  const st = () => battle.state;
  const village = VILLAGES[char.village];
  const el = overlay(root, 'battle', `
    <div class="b-top"><span class="grade" style="background:${GRADE_COL[st().mission.grade]}">${st().mission.grade}</span><b>${esc(st().mission.name)}</b><span class="turn">Turn 1</span></div>
    <div class="b-arena"><canvas width="320" height="180"></canvas>
      <div class="hpbox e"><b>${esc(st().enemy.name)}</b><small>Lv ${st().enemy.level}</small><div class="gbar hp"><i></i></div><span class="num ehp"></span></div>
      <div class="hpbox p"><b>${esc(char.name)}</b><small>Lv ${char.level}</small><div class="gbar hp"><i></i></div><span class="num php"></span><div class="gbar sta"><i></i></div><span class="num pst"></span><div class="gbar ch"><i></i></div><span class="num pch"></span></div>
    </div>
    <div class="b-log">What will you do?</div>
    <div class="b-tabs">${Object.entries(STYLES).map(([k, s]) => `<button data-tab="${k}" style="--c:${s.color}">${s.icon} <span>${s.label}</span></button>`).join('')}</div>
    <div class="b-moves"></div>
    <div class="b-extra"><button class="btn small ghost" data-m="focus">🧘 Focus</button><button class="btn small ghost" data-m="flee">🏃 Retreat</button></div>`);
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const logEl = el.querySelector('.b-log');
  let tab = 'ninjutsu', busy = false, alive = true;
  const fx = { pX: 0, eX: 0, pFlash: 0, eFlash: 0, shake: 0, proj: null, swirl: 0, floats: [], t: 0, eDead: false, pDead: false };

  // moves panel
  const moves = cat.moves.filter((m) => m.style !== 'none');
  function renderMoves() {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    el.querySelector('.b-moves').innerHTML = moves.filter((m) => m.style === tab).map((m) => {
      const learned = m.tier <= char.rank_index, afford = st().pst >= m.stamina && st().pch >= m.chakra, j = (char.jutsu || {})[m.id] || { level: 1 };
      return `<button class="mv ${learned ? '' : 'locked'}" data-m="${m.id}" style="--c:${STYLES[m.style].color}" ${learned && afford && !busy ? '' : 'disabled'}>
        <b>${learned ? esc(m.name) + ` <span class="jl">Lv ${j.level}</span>` : '🔒 ' + esc(m.name)}</b>
        <small>${learned ? `Pow ${m.power}${m.effect && m.effect !== 'focus' ? ' · ' + (m.effect === 'confuse' ? 'Confuse' : 'Stun') : ''} · ${cost(m)}` : `${RANKS[m.tier]} rank`}</small></button>`;
    }).join('');
    el.querySelectorAll('.b-moves [data-m]').forEach((b) => (b.onclick = () => act(b.dataset.m)));
    el.querySelectorAll('.b-extra [data-m]').forEach((b) => (b.disabled = busy));
  }
  el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderMoves(); }));
  el.querySelectorAll('.b-extra [data-m]').forEach((b) => (b.onclick = () => act(b.dataset.m)));
  function bars() {
    const s = st();
    el.querySelector('.hpbox.e .hp i').style.width = (100 * s.ehp / s.emax) + '%';
    el.querySelector('.hpbox.p .hp i').style.width = (100 * s.php / s.pmax) + '%';
    el.querySelector('.hpbox.p .ch i').style.width = (100 * s.pch / s.pchmax) + '%';
    el.querySelector('.hpbox.p .sta i').style.width = (100 * s.pst / s.pstmax) + '%';
    el.querySelector('.pst').textContent = `💪 ${s.pst}/${s.pstmax}`;
    el.querySelector('.ehp').textContent = `${s.ehp}/${s.emax}`;
    el.querySelector('.php').textContent = `❤️ ${s.php}/${s.pmax}`;
    el.querySelector('.pch').textContent = `💧 ${s.pch}/${s.pchmax}`;
    el.querySelector('.turn').textContent = 'Turn ' + s.turn;
    el.querySelector('.hpbox.e .hp').classList.toggle('low', s.ehp / s.emax < 0.3);
    el.querySelector('.hpbox.p .hp').classList.toggle('low', s.php / s.pmax < 0.3);
  }
  bars(); renderMoves();

  // ---- drawing ----
  const theme = { pine: ['#9fd1ec', '#5aa64c', '#3f8a46'], dune: ['#ffc79b', '#e8c88a', '#c99a5e'], tide: ['#8fd0f0', '#7cc87a', '#e8d4a8'] }[char.village] || ['#9fd1ec', '#5aa64c', '#3f8a46'];
  function draw() {
    if (!alive) return;
    fx.t++;
    const W = 320, H = 180;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = theme[0]; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(((fx.t / 4) % 380) - 60, 22, 50, 5); ctx.fillRect(((fx.t / 6 + 200) % 380) - 60, 40, 36, 4);
    ctx.fillStyle = theme[1]; for (let x = 0; x < W; x++) ctx.fillRect(x, 92 + Math.round(Math.sin(x / 23) * 6 + Math.sin(x / 9) * 2), 1, 100);
    ctx.fillStyle = theme[2]; ctx.fillRect(0, 130, W, 50);
    ctx.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 53) % W, 135 + (i * 17) % 40, 3, 1);
    const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0; if (fx.shake) fx.shake = Math.max(0, fx.shake - 0.6);
    // shadows
    ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.fillRect(66 + fx.pX, 144, 40, 6); ctx.fillRect(208 + fx.eX, 128, 48, 6);
    // player (faces right)
    const ps = ninjaSprite(char.appearance, 2, fx.pX > 2 ? 3 : (fx.t >> 5) % 2 && !fx.pDead ? 0 : 0);
    if (!fx.pDead || fx.t % 6 < 3) {
      ctx.save(); if (fx.pFlash > 0 && fx.pFlash-- % 4 < 2) ctx.globalAlpha = 0.35;
      const bob = (fx.t >> 5) % 2;
      ctx.drawImage(ps, 68 + fx.pX + sx, 146 - ps.height * 2 + bob * 0 - (fx.pDead ? -8 : 0), ps.width * 2, ps.height * 2); ctx.restore();
    }
    // enemy (faces left)
    const e = st().enemy;
    const es = e.kind === 'ninja' ? ninjaSprite(e.look, 1, fx.eX < -2 ? 3 : 0) : beastSprite(e.kind, e.look.tint, (fx.t >> 4) % 2);
    const esc2 = e.kind === 'ninja' ? 2 : 2;
    if (!fx.eDead) {
      ctx.save(); if (fx.eFlash > 0 && fx.eFlash-- % 4 < 2) ctx.globalAlpha = 0.35;
      ctx.drawImage(es, 232 - es.width + fx.eX - sx, 130 - es.height * esc2 + es.height * (esc2 - 2), es.width * esc2, es.height * esc2); ctx.restore();
    } else if (fx.eFade > 0) { ctx.globalAlpha = fx.eFade / 30; ctx.drawImage(es, 232 - es.width, 130 - es.height * 2, es.width * 2, es.height * 2); ctx.globalAlpha = 1; fx.eFade--; }
    // genjutsu swirl
    if (fx.swirl > 0) {
      fx.swirl--; ctx.strokeStyle = `rgba(154,90,208,${fx.swirl / 30})`; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(232, 102, 10 + i * 9 + (30 - fx.swirl), fx.t / 6 + i, fx.t / 6 + i + 4); ctx.stroke(); }
    }
    // projectile
    if (fx.proj) {
      const p = fx.proj; p.k += p.speed; const x = p.x0 + (p.x1 - p.x0) * Math.min(1, p.k), y = p.y0 + (p.y1 - p.y0) * Math.min(1, p.k) - Math.sin(Math.min(1, p.k) * Math.PI) * p.arc;
      ctx.fillStyle = p.color;
      if (p.kind === 'blade') { ctx.save(); ctx.translate(x, y); ctx.rotate(fx.t / 2); ctx.fillRect(-5, -1, 10, 2); ctx.fillRect(-1, -5, 2, 10); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(x, y, p.size, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, p.size / 2.5, 0, 7); ctx.fill(); }
      if (p.k >= 1) { fx.proj = null; p.done && p.done(); }
    }
    // floating numbers
    ctx.textAlign = 'center'; ctx.font = "bold 14px 'Press Start 2P', monospace";
    fx.floats = fx.floats.filter((f) => f.life-- > 0);
    for (const f of fx.floats) {
      const y = f.y - (40 - f.life) * 0.6;
      ctx.fillStyle = '#24160e'; ctx.fillText(f.text, f.x + 2, y + 2); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  const float = (who, text, color) => fx.floats.push({ x: who === 'e' ? 222 : 86, y: who === 'e' ? 60 : 82, text, color, life: 40 });
  function shoot(from, style, moveId) {
    return new Promise((res) => {
      const colors = { flame: '#ff7a2a', lance: '#4ab0ff', spear: '#ffe14a', dragon: '#9a6a3a', kunai: '#c9ccd4', shuriken: '#c9ccd4', tag: '#f2c14a', blade: '#e8e8f0' };
      const toE = from === 'p';
      fx.proj = { x0: toE ? 100 : 210, y0: toE ? 112 : 96, x1: toE ? 226 : 92, y1: toE ? 100 : 116, k: 0, speed: style === 'bukijutsu' ? 0.08 : 0.055,
        arc: style === 'bukijutsu' ? 10 : 4, size: moveId === 'dragon' ? 9 : moveId === 'spear' ? 5 : 7, color: colors[moveId] || '#ff9a63', kind: style === 'bukijutsu' ? 'blade' : 'orb', done: res };
    });
  }
  async function lunge(who) {
    for (let i = 0; i < 8; i++) { if (who === 'p') fx.pX = i * 5; else fx.eX = -i * 5; await wait(16); }
    for (let i = 8; i >= 0; i--) { if (who === 'p') fx.pX = i * 5; else fx.eX = -i * 5; await wait(14); }
  }

  async function act(moveId) {
    if (busy) return;
    busy = true; renderMoves();
    let res;
    try { res = await net.battleAct(battle.id, moveId); }
    catch (e) { logEl.textContent = e.message; busy = false; renderMoves(); return; }
    if (res.status === 'fled') { alive = false; el.remove(); onEnd({ status: 'fled' }); return; }
    const prev = { ...st() };
    for (const ev of res.events) {
      if (ev.who === 'p') {
        if (ev.focus) { logEl.textContent = `You focus. +${ev.focus} stamina and chakra.`; float('p', '+' + ev.focus, '#7cc4ec'); await wait(700); continue; }
        logEl.textContent = `You used ${ev.name}!`;
        if (ev.style === 'taijutsu') await lunge('p');
        else if (ev.style === 'genjutsu') { fx.swirl = 30; await wait(450); }
        else await shoot('p', ev.style, ev.move);
        if (ev.hit) {
          fx.eFlash = 14; fx.shake = ev.crit ? 7 : 4;
          float('e', ev.crit ? `CRIT ${ev.dmg}` : String(ev.dmg), ev.crit ? '#ffe07a' : '#fff4dc');
          logEl.textContent = `${ev.name} hits for ${ev.dmg}${ev.crit ? ' (critical!)' : ''}.` + (ev.effect === 'confuse' ? ` ${st().enemy.name} is confused!` : ev.effect === 'stun' ? ` ${st().enemy.name} is frozen!` : '');
          prev.ehp = Math.max(0, prev.ehp - ev.dmg);
        } else { float('e', 'MISS', '#c9ccd4'); logEl.textContent = `${ev.name} missed!`; }
        battle.state = { ...st(), ehp: prev.ehp }; bars();
        if (ev.jutsu_up) { char.jutsu = char.jutsu || {}; char.jutsu[ev.move] = { ...(char.jutsu[ev.move] || {}), level: ev.jutsu_level }; toast(`${ev.name} reached level ${ev.jutsu_level}!`, 'ok'); }
        await wait(650);
      } else {
        const en = st().enemy.name;
        if (ev.stunned) { logEl.textContent = `${en} is frozen and can't move!`; await wait(700); continue; }
        logEl.textContent = ev.special ? `${en} unleashes a fierce attack!` : `${en} attacks!`;
        await lunge('e');
        if (ev.hit) {
          fx.pFlash = 14; fx.shake = ev.special ? 6 : 3; float('p', String(ev.dmg), '#ff8f7a'); logEl.textContent = `${en} hits you for ${ev.dmg}.`;
          prev.php = Math.max(0, prev.php - ev.dmg); battle.state = { ...st(), php: prev.php }; bars();
        }
        else if (ev.dodge) { float('p', 'DODGE', '#9fe0a0'); logEl.textContent = `You dodged ${en}'s attack!`; }
        else { float('p', 'MISS', '#c9ccd4'); logEl.textContent = `${en} missed!`; }
        await wait(600);
      }
    }
    battle = { ...battle, state: res.state, status: res.status };
    bars();
    if (res.status === 'won' || res.status === 'lost') {
      if (res.status === 'won') { fx.eDead = true; fx.eFade = 30; } else fx.pDead = true;
      await wait(900);
      showResult(res);
      return;
    }
    logEl.textContent = 'What will you do?';
    busy = false; renderMoves();
  }

  function showResult(res) {
    const won = res.status === 'won', r = res.result || {};
    const box = h(`<div class="b-result"><div class="scroll">
      <h3 class="${won ? 'win' : 'lose'}">${won ? 'Mission complete!' : 'Defeated…'}</h3>
      ${won ? `<p class="big">+${r.xp} XP &nbsp; +${r.ryo} ryo</p>
        ${r.leveled ? `<p class="lvl">⬆ Level up! You are now level ${r.level}.<br>Your HP, stamina and chakra grew, and your energy is full!</p>` : ''}
        ${r.capped ? `<p class="cap">You've reached the highest level for your rank. Pass the rank exam at the Academy to keep growing.</p>` : ''}`
        : `<p>You were carried back to the village to recover.${r.ryo_lost ? ` You dropped ${r.ryo_lost} ryo.` : ''}</p><p class="sub">Tip: train your stats with energy, use Mist Veil to make them miss, and Focus when low on stamina or chakra.</p>`}
      <div class="row"><button class="btn ${won && r.leveled ? 'primary' : 'ghost'}" data-t>Train</button><button class="btn ${won && r.leveled ? 'ghost' : 'primary'}" data-back>Back to village</button></div>
    </div></div>`);
    el.appendChild(box);
    box.querySelector('[data-back]').onclick = () => { alive = false; el.remove(); onEnd({ status: res.status, result: r }); };
    const t = box.querySelector('[data-t]'); if (t) t.onclick = () => { alive = false; el.remove(); onEnd({ status: res.status, result: r, train: true }); };
  }
}
