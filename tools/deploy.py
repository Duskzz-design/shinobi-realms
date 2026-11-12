#!/usr/bin/env python3
"""Publish the game to GitHub Pages (the gh-pages branch).

Browsers keep copies of our JavaScript and CSS files for a few minutes. Without care, a player can end up
running a mix of old and new files after an update. So every published file reference gets a version tag
(?v=<commit>) that changes with each release: browsers then always fetch a matching set.
Usage: python3 tools/deploy.py   (from the repository root, with everything committed on main)
"""
import os, re, shutil, subprocess, sys, tempfile

def run(*cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if run('git', 'status', '--porcelain', cwd=root):
    sys.exit('Commit your changes first.')
ver = run('git', 'rev-parse', '--short', 'HEAD', cwd=root)
tmp = tempfile.mkdtemp()
run('git', 'worktree', 'add', '-f', os.path.join(tmp, 'site'), 'HEAD', '--detach', cwd=root)
site = os.path.join(tmp, 'site')
try:
    js_import = re.compile(r"""((?:import|export)\s[^'"]*?from\s*|import\s*\(\s*|import\s+)(['"])(\.{1,2}/[^'"?]+\.js)\2""")
    html_ref = re.compile(r"""((?:src|href)=")((?:\.\./|\./)?(?:js|css)/[^"?]+\.(?:js|css))(")""")
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
                if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
            elif f.endswith('.css'):
                s = open(p, encoding='utf-8').read()
                s2 = css_ref.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
                if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
    run('git', 'add', '-A', cwd=site)
    run('git', '-c', 'user.name=Duskzz-design', '-c', 'user.email=chinkstanator@gmail.com', 'commit', '-q', '-m', f'Publish {ver}', cwd=site)
    run('git', 'push', '-q', '-f', 'origin', 'HEAD:gh-pages', cwd=site)
    print('published', ver)
finally:
    run('git', 'worktree', 'remove', '--force', site, cwd=root)
    shutil.rmtree(tmp, ignore_errors=True)
