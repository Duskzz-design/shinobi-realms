// Sharper pixel text on high-density screens (phones, Retina).
// A pixel font is only crisp when each of its pixels covers a whole number of screen pixels.
// This nudges every font size in our stylesheets to the nearest such size (usually by about 1px).
//   Pixelify Sans: one font pixel = 1/10.886 em    Press Start 2P: one font pixel = 1/8 em
const BODY_UNIT = 10.886, TITLE_UNIT = 8;
function isTitle(rule) {
  const fam = rule.style.fontFamily || '';
  if (fam) return /--title|Press Start/.test(fam);
  return /\.btn\b/.test(rule.selectorText || '') && !/\.btn\.icon\b/.test(rule.selectorText || '');
}
function walk(rules, dpr) {
  for (const r of rules) {
    if (r.cssRules && !r.style) { walk(r.cssRules, dpr); continue; }
    if (!r.style || !r.style.fontSize || !r.style.fontSize.endsWith('px')) continue;
    const px = parseFloat(r.style.fontSize); if (!px) continue;
    const step = (isTitle(r) ? TITLE_UNIT : BODY_UNIT) / dpr;
    const snapped = Math.max(step, Math.round(px / step) * step);
    if (Math.abs(snapped - px) / px <= 0.2) r.style.fontSize = snapped.toFixed(3) + 'px';
  }
}
export function sharpenText() {
  const dpr = window.devicePixelRatio || 1;
  if (dpr < 1.5) return; // ordinary screens: sizes are already set on the 1x grid by hand
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; } // skip anything not ours
    if (rules) walk(rules, dpr);
  }
}
