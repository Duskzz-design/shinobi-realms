#!/usr/bin/env python3
"""Publish the game.

  python3 tools/deploy.py                    -> TEST  (test.shinobirealms.com, test server, fake ninjas)
  python3 tools/deploy.py live --approved    -> LIVE  (shinobirealms.com, real players)

The rule (see CLAUDE.md): every change goes to TEST first. LIVE is only published after the CEO has
seen it on test and said to ship it. To make that hard to get wrong, LIVE refuses any version that is
not already the one running on TEST.

Browsers keep copies of our JavaScript and CSS files for a few minutes. Without care, a player can end up
running a mix of old and new files after an update. So every published file reference gets a version tag
(?v=<commit>) that changes with each release: browsers then always fetch a matching set.
Run from the repository root, with everything committed on main.
"""
import os, re, shutil, subprocess, sys, tempfile

TARGETS = {
    'test': {'remote': 'https://github.com/Duskzz-design/shinobi-realms-test.git', 'domain': 'test.shinobirealms.com', 'hidden': True},
    'live': {'remote': 'origin', 'domain': 'shinobirealms.com', 'hidden': False},
}

def run(*cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        raise subprocess.CalledProcessError(r.returncode, cmd, r.stdout, r.stderr + f'\n[{" ".join(cmd)}] {r.stderr.strip()}')
    return r.stdout.strip()

args = sys.argv[1:]
target = 'live' if 'live' in args else 'test'
cfg = TARGETS[target]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if run('git', 'status', '--porcelain', cwd=root):
    sys.exit('Commit your changes first.')
ver = run('git', 'rev-parse', '--short', 'HEAD', cwd=root)

def on_test():
    """The version currently published to TEST (from its last 'Publish <ver>' commit)."""
    try:
        run('git', 'fetch', '-q', TARGETS['test']['remote'], 'gh-pages', cwd=root)
        msg = run('git', 'log', '-1', '--format=%s', 'FETCH_HEAD', cwd=root)
        return msg.split()[-1] if msg.startswith('Publish ') else None
    except subprocess.CalledProcessError:
        return None

if target == 'live':
    if '--approved' not in args:
        sys.exit('LIVE needs the CEO\'s go-ahead. Re-run with: live --approved')
    t = on_test()
    if t != ver:
        sys.exit(f'LIVE refused: this version ({ver}) is not what is on TEST ({t}). Publish it to test and get it approved first.')

tmp = tempfile.mkdtemp()
run('git', 'worktree', 'add', '-f', os.path.join(tmp, 'site'), 'HEAD', '--detach', cwd=root)
site = os.path.join(tmp, 'site')
try:
    js_import = re.compile(r"""((?:import|export)\s[^'"]*?from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}/[^'"?]+\.js)\2""")
    html_ref = re.compile(r"""((?:src|href)=")((?:\.\./|\./)?(?:js/[^"?]+\.js|css/[^"?]+\.css|assets/fonts/[^"?]+\.ttf))(")""")
    css_ref = re.compile(r"""(url\()(\.\./assets/fonts/[^)?]+)(\))""")
    for d, _, files in os.walk(site):
        if '.git' in d or '/.dev' in d or '/tools' in d:
            continue
        for f in files:
            p = os.path.join(d, f)
            if f.endswith('.js'):
                s = open(p, encoding='utf-8').read()
                s2 = js_import.sub(lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}?v={ver}{m.group(2)}", s)
                if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
            elif f.endswith('.html'):
                s = open(p, encoding='utf-8').read()
                s2 = html_ref.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
                # the test site stays out of search engines
                if cfg['hidden'] and 'name="robots"' not in s2:
                    s2 = s2.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">', 1)
                if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
            elif f.endswith('.css'):
                s = open(p, encoding='utf-8').read()
                s2 = css_ref.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
                if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
    # working files that are not part of the website
    for f in ('CLAUDE.md', 'netlify.toml'):
        if os.path.exists(os.path.join(site, f)): os.remove(os.path.join(site, f))
    for d in ('tools', 'supabase'):
        shutil.rmtree(os.path.join(site, d), ignore_errors=True)
    open(os.path.join(site, 'CNAME'), 'w').write(cfg['domain'] + '\n')
    if cfg['hidden']:
        open(os.path.join(site, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
        for f in ('sitemap.xml',):
            if os.path.exists(os.path.join(site, f)): os.remove(os.path.join(site, f))
    run('git', 'add', '-A', cwd=site)
    run('git', '-c', 'user.name=Duskzz-design', '-c', 'user.email=shinobirealms.game@gmail.com', 'commit', '-q', '-m', f'Publish {ver}', cwd=site)
    run('git', 'push', '-q', '-f', cfg['remote'], 'HEAD:refs/heads/gh-pages', cwd=site)
    print(f'published {ver} to {target.upper()} (https://{cfg["domain"]})')
finally:
    run('git', 'worktree', 'remove', '--force', site, cwd=root)
    shutil.rmtree(tmp, ignore_errors=True)
