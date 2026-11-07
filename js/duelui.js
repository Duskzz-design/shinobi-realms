// Duel challenges: send, receive, wait, and launch the live duel screen.
import * as net from './net.js';
import { runDuel } from './hexbattle.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function toast(msg, kind = 'err') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }

// hooks: { canStart() -> bool, onEnd(res, duel), stopWalking() }
export function setupDuels(root, char, hooks) {
  const myId = char.user_id;
  let pop = null, popDuel = null, inDuel = null, stop = null;
  const closePop = () => { if (pop) pop.remove(); pop = null; popDuel = null; };
  function countdown(el, until, onZero) {
    const t = setInterval(() => {
      if (!el.isConnected) return clearInterval(t);
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      el.textContent = left + 's'; if (!left) { clearInterval(t); onZero && onZero(); }
    }, 300);
  }
  function popup(html) { closePop(); pop = h(`<div class="duel-pop"><div class="scroll">${html}</div></div>`); root.appendChild(pop); return pop; }

  function showInvite(d) {
    if (inDuel) return;
    popDuel = d.id;
    const what = d.kind === 'kage' ? `<p><b>A challenge for the Kage's seat!</b> If you lose, or decline, or don't answer in time, ${esc(d.a_name)} becomes Kage.</p>`
      : d.kind === 'war' ? '<p><b>A war duel!</b> The winner scores +10 war points for their village. 60 seconds per turn.</p>'
      : '<p>A live duel on the hex battlefield. 60 seconds per turn. The winner earns Arena points.</p>';
    const el = popup(`<div class="dp-ico">${d.kind === 'kage' ? '👑' : '⚔️'}</div><h3>${esc(d.a_name)} challenges you!</h3>${what}
      <p class="sub">Answer within <b class="cd">60s</b></p><div class="row"><button class="btn ghost" data-no>Decline</button><button class="btn primary" data-yes>Accept ⚔️</button></div>`);
    countdown(el.querySelector('.cd'), new Date(d.created_at || Date.now()).getTime() + 60000, closePop);
    el.querySelector('[data-no]').onclick = () => { net.duelCancel(d.id).catch(() => {}); closePop(); };
    el.querySelector('[data-yes]').onclick = async (e) => {
      if (!hooks.canStart()) { toast('Finish what you are doing first.'); return; }
      e.target.disabled = true; e.target.textContent = 'Starting…';
      try { start(await net.duelAccept(d.id)); } catch (err) { toast(err.message); closePop(); }
    };
  }
  function showWaiting(d) {
    popDuel = d.id;
    const el = popup(`<div class="dp-ico">⏳</div><h3>Challenge sent</h3><p>Waiting for <b>${esc(d.b_name)}</b> to accept…</p><p class="sub">Expires in <b class="cd">60s</b></p>
      <div class="row"><button class="btn ghost" data-no>Cancel</button></div>`);
    countdown(el.querySelector('.cd'), Date.now() + 60000, () => { closePop(); toast(`${d.b_name} didn't answer.`); net.duelCancel(d.id).catch(() => {}); });
    el.querySelector('[data-no]').onclick = () => { net.duelCancel(d.id).catch(() => {}); closePop(); };
  }
  function start(d) {
    if (inDuel === d.id) return;
    closePop(); inDuel = d.id; hooks.stopWalking();
    runDuel(root, char, d, (res) => { inDuel = null; hooks.onEnd(res, d); });
  }
  function onRow(d) {
    if (!d || !d.id) return;
    if (d.status === 'pending' && d.b === myId) return showInvite(d);
    if (d.status === 'active' && !inDuel && (d.a === myId || d.b === myId) && d.seq <= 2) return start(d);
    if (['declined', 'cancelled', 'expired'].includes(d.status) && popDuel === d.id) {
      closePop();
      if (d.a === myId) toast(d.status === 'declined' ? `${d.b_name} declined your challenge.` : 'The challenge expired.');
      else toast(`${d.a_name} withdrew the challenge.`);
    }
  }
  net.watchMyDuels(myId, onRow).then((off) => (stop = off));
  // came back mid-duel (refresh or dropped connection)?
  net.myActiveDuel().then((d) => d && start(d)).catch(() => {});

  return {
    async challenge(target, kind = 'duel', war = null) {
      if (inDuel) return;
      try { showWaiting(await net.duelChallenge(target.id, kind, war)); } catch (e) { toast(e.message); }
    },
    stop() { stop && stop(); closePop(); },
  };
}
