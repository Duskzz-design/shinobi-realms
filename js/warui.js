// War camp at a territory: see who is fighting, challenge the other side, and hold the ground.
import * as net from './net.js';
import { ninjaSprite, VILLAGES } from './sprites.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function toast(msg, kind = 'err') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
const left = (iso) => { const s = Math.max(0, (new Date(iso) - Date.now()) / 1000); const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return hh ? `${hh}h ${m}m` : `${m}m`; };

// hooks: { challenge(target, warId), onClose() }
export function openWarCamp(root, char, war, terrName, hooks = {}) {
  const el = h(`<div class="ov board-wrap"><div class="scroll board warcamp"><h3>⚔️ ${esc(terrName)}</h3><div class="wc-body"><div class="spinner"></div></div><button class="btn ghost" data-x>Leave the battlefield</button></div></div>`);
  root.appendChild(el);
  const body = el.querySelector('.wc-body');
  let st = null, alive = true;
  const close = () => { alive = false; clearInterval(hold); clearInterval(poll); net.warLeave(war.id); el.remove(); hooks.onClose && hooks.onClose(); };
  el.querySelector('[data-x]').onclick = close;

  async function refresh(holdNow) {
    if (!el.isConnected) { alive = false; clearInterval(hold); clearInterval(poll); return; }
    try { st = await (holdNow ? net.warHold(war.id) : net.warStatus(war.id)); } catch (e) { body.innerHTML = `<p class="sub">${esc(e.message)}</p>`; return; }
    if (alive) render();
  }
  function card(p) {
    const vv = VILLAGES[p.village] || {}, me = p.id === char.user_id, rival = st.side && p.side !== st.side;
    return `<div class="wc-p ${me ? 'me' : ''}"><canvas width="18" height="26" data-look='${esc(JSON.stringify(p.look || {}))}'></canvas>
      <span class="nm"><b>${esc(p.name)}${me ? ' (you)' : ''}</b><small style="color:${vv.dark}">${esc(p.rank)} · Lv ${p.level}</small></span>
      ${rival && st.war.status === 'active' ? `<button class="btn small primary" data-ch="${p.id}">Duel</button>` : ''}</div>`;
  }
  function render() {
    const w = st.war, A = VILLAGES[w.attacker], D = w.defender ? VILLAGES[w.defender] : null;
    const tot = Math.max(1, w.att_score + w.def_score), pa = Math.round((w.att_score / tot) * 100);
    const att = st.present.filter((p) => p.side === 'attacker'), def = st.present.filter((p) => p.side === 'defender');
    const over = w.status !== 'active' || new Date(w.ends_at) <= new Date();
    let note;
    if (over) note = `<p class="wc-note">This war is over. ${w.winner ? `<b>${esc(VILLAGES[w.winner].name)}</b> holds ${esc(terrName)}.` : ''}</p>`;
    else if (!st.side) note = '<p class="wc-note">Your village is not part of this war. You can watch, but not fight.</p>';
    else if (st.side === 'attacker' && !def.length) note = `<p class="wc-note hold">🏳️ No defenders are here. While you stay, ${esc(A.short)} gains <b>+5 war points every 10 minutes</b>.</p>`;
    else if (st.side === 'attacker') note = '<p class="wc-note">Defenders are here! Duel them to score <b>+10 war points</b> a win.</p>';
    else note = `<p class="wc-note">Hold the line! Every duel you win here scores <b>+10</b> for ${esc(D.short)}. While no defenders are here, the attackers score for free.</p>`;
    body.innerHTML = `
      <div class="wc-score"><div class="wc-side" style="--vc:${A.color}"><small>Attackers</small><b>${esc(A.short)}</b><em>${w.att_score}</em></div>
        <div class="wc-mid"><small>${over ? 'Final' : `${left(w.ends_at)} left`}</small><b>VS</b></div>
        <div class="wc-side" style="--vc:${D ? D.color : '#8a7a6a'}"><small>Defenders</small><b>${D ? esc(D.short) : 'Unclaimed'}</b><em>${w.def_score}</em></div></div>
      <div class="wc-bar"><i style="width:${pa}%;background:${A.color}"></i><i style="width:${100 - pa}%;background:${D ? D.color : '#c9b48a'}"></i></div>
      ${!D && !over ? '<p class="sub">Nobody holds this land. Reach <b>20 war points</b> by the end to claim it.</p>' : ''}
      ${note}
      <div class="wc-cols"><div><h4 style="color:${A.dark}">${esc(A.short)} here (${att.length})</h4>${att.map(card).join('') || '<p class="sub">Nobody</p>'}</div>
        <div><h4 style="color:${D ? D.dark : '#555'}">${D ? `${esc(D.short)} here (${def.length})` : 'Defenders'}</h4>${D ? def.map(card).join('') || '<p class="sub">Nobody</p>' : '<p class="sub">No village holds this land.</p>'}</div></div>
      <p class="sub">Stay on this screen to count as present. War duels also earn your village <b>25 points</b>.</p>`;
    body.querySelectorAll('canvas[data-look]').forEach((cv) => { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; try { c.drawImage(ninjaSprite(JSON.parse(cv.dataset.look), 0, 0), 0, 0); } catch {} });
    body.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => {
      const p = st.present.find((x) => x.id === b.dataset.ch); if (!p) return;
      if (hooks.challenge) hooks.challenge(p, war.id); else toast('Duels are not available here.');
    }));
  }
  const canHold = () => st && st.side && char.rank !== 'Academy Student';
  refresh(false).then(() => canHold() && refresh(true));
  const hold = setInterval(() => canHold() && refresh(true), 60000);
  const poll = setInterval(() => refresh(false), 12000);
  return { close };
}
