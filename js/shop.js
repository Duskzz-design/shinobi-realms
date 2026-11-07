// Tool Shop: buy consumable items with ryo. Pack up to 3 kinds into each fight from the loadout screen.
import * as net from './net.js';
import * as G from './engine.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function toast(msg, kind = 'err') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

export function openShop(root, char, onChange) {
  const el = h(`<div class="ov board-wrap"><div class="scroll board shop"><h3>🏪 Tool Shop</h3><div class="sh-body"></div><button class="btn ghost" data-x>Close</button></div></div>`);
  root.appendChild(el);
  const close = () => el.remove();
  el.querySelector('[data-x]').onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  const body = el.querySelector('.sh-body');
  let busy = false;
  function render() {
    const owned = char.items || {};
    body.innerHTML = `<p class="sub">"Fresh pills and smoke bombs! Pack up to <b>${G.ITEM_SLOTS}</b> kinds before each fight."</p>
      <div class="sh-ryo">💰 <b>${Number(char.ryo || 0).toLocaleString('en-GB')}</b> ryo</div>
      <div class="sh-list">${Object.entries(G.ITEMS).map(([id, it]) => { const n = owned[id] || 0, full = n >= G.ITEM_STACK;
        return `<div class="sh-it"><span class="ic">${it.icon}</span><span class="nm"><b>${esc(it.name)}</b><small>${esc(it.desc)} · ${it.ap} AP to use</small><small>You have <b>${n}</b>/${G.ITEM_STACK}</small></span>
          <span class="buy"><button class="btn small primary" data-b="${id}" data-q="1" ${full || char.ryo < it.price || busy ? 'disabled' : ''}>Buy ${it.price} 💰</button>
          <button class="btn small ghost" data-b="${id}" data-q="5" ${G.ITEM_STACK - n < 5 || char.ryo < it.price * 5 || busy ? 'disabled' : ''}>×5 · ${it.price * 5}</button></span></div>`; }).join('')}</div>`;
    body.querySelectorAll('[data-b]').forEach((b) => (b.onclick = async () => {
      busy = true; render();
      try { const me = await net.buyItem(b.dataset.b, +b.dataset.q); Object.assign(char, me, { _loadedAt: Date.now() }); toast(`Bought ${G.ITEMS[b.dataset.b].name}${+b.dataset.q > 1 ? ' ×' + b.dataset.q : ''}!`, 'ok'); onChange && onChange(); }
      catch (e) { toast(e.message); }
      busy = false; render();
    }));
  }
  render();
  return { close };
}
