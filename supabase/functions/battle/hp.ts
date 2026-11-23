// Lasting health (v0.15.0): fights start with the health you have now and save what is left.
// Health is kept as a share of your maximum (characters.hp_frac) and refills fully in 15 minutes.
import * as G from './engine.js';

export function poolsNow(c: any) {
  const p: any = G.poolsOf(c);
  const since = c.hp_at ? Date.now() - Date.parse(c.hp_at) : 0;
  const f = Math.min(1, Math.max(0, c.hp_frac ?? 1) + Math.max(0, since) / 900000);
  p.php = Math.max(1, Math.round(p.pmax * f));
  return p;
}

export async function saveHp(admin: any, units: any[]) {
  for (const u of units) {
    if (!u || !u.uid || !u.hpmax) continue;
    const { error } = await admin.rpc('set_hp', { p_user: u.uid, p_frac: Math.max(0, u.hp) / u.hpmax });
    if (error) console.error('set_hp', error.message);
  }
}
