// The game's two fonts in one place (font trial, CEO 19 Nov 2026: Jersey 10 + DotGothic16 for legibility).
// To go back to the old pair, set TRIAL = false and remove the @font-face block at the top of css/style.css.
//
// Pixel fonts are sharpest when each font pixel covers a whole number of screen pixels.
// UNIT = declared CSS px per font pixel (at 1x). The @font-face size-adjust values below scale both fonts up
// without changing the font files: Jersey 10 draws on a 10-per-em grid (×1.6), DotGothic16 on 16 per em (×1.25).
export const TRIAL = true;

export const TITLE_FAMILY = TRIAL ? "'Jersey 10', 'Press Start 2P', monospace" : "'Press Start 2P', monospace";
export const BODY_FAMILY = TRIAL ? "'DotGothic16', 'Pixelify Sans', sans-serif" : "'Pixelify Sans', sans-serif";
export const TITLE_UNIT = TRIAL ? 10 / 1.6 : 8;
export const BODY_UNIT = TRIAL ? 16 / 1.25 : 10.886;
export const isTitleFamily = (fam) => /Jersey|Press Start|--title/.test(fam || '');
