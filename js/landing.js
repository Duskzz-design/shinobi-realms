// Landing page: the animated title scene, pixel icons, and "Continue" for returning players.
  import { startTitleScene } from './scene.js';
  import { startPixify } from './pixemoji.js';
  import { sharpenText } from './crisp.js';
  startPixify();
  sharpenText();
  const cv = document.getElementById('scene');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) startTitleScene(cv);
  // returning players: say "Continue" instead of "Play free"
  try {
    if (Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')))
      document.querySelectorAll('.cta').forEach((a) => { a.textContent = a.classList.contains('small') ? 'Continue' : '▶ Continue your ninja'; });
  } catch {}
