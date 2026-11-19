# Shinobi Realms: working rules

## Test first, then ask before going live (CEO rule, 12 Nov 2026)

Every change goes to the TEST environment first. Nothing reaches LIVE until the CEO has seen it on
test and explicitly said to ship it ("ship it", "go live", "yes, publish to live" or similar).
Ask for that permission every time. Never assume it, and never carry an earlier approval over to a new change.

| | LIVE (real players) | TEST (fake ninjas) |
|---|---|---|
| Website | https://shinobirealms.com (repo Duskzz-design/shinobi-realms, branch gh-pages) | https://test.shinobirealms.com (repo Duskzz-design/shinobi-realms-test, branch gh-pages) |
| Supabase project | `azetseowvqyqhcnjzvnb` (ninja-mmorpg) | `lkvlpbdjuokemtucjnlk` (shinobi-realms-test) |
| Sign-in | Google | Guest only, through the secret tester link (the word is kept in the private claude.ai project notes, never in this public repo) |

The game picks the server from the address it is opened on (`js/net.js`, `IS_TEST`). The test site shows a purple
"TEST SERVER" badge.

### The steps for every change
1. Build it on `main` and commit.
2. Database changes (migrations): apply to the TEST project only.
3. Edge function changes: deploy to the TEST project only.
4. Publish the website to test: `python3 tools/deploy.py`
5. Check it on test.shinobirealms.com on desktop and phone, send the CEO screenshots, and ask:
   "Shall I ship this to live?"
6. Only after a clear yes: apply the same migrations / edge functions to LIVE, then
   `python3 tools/deploy.py live --approved`. The script refuses any version that is not the one already on test.
7. Check live, and tell the CEO it is out.

Exceptions: none by default. If live is broken for players and an urgent fix is needed, still ask first, but say it is
urgent and why. A fix can go to test and live straight after each other once the CEO says yes.

### Versions (CEO, 19 Nov 2026)
- The version number lives in `js/version.js` (`VERSION`, plus the `CHANGES` changelog, newest first). Format `0.MINOR.PATCH`
  while in alpha (`1.0.0` at public launch): MINOR for a feature or balance change, PATCH for a small fix or tweak.
- **Bundling (CEO's choice):** collect changes on test under the next version number, and keep a running list of them.
  When the CEO says ship, the whole bundle goes live as one version. Before asking, list everything in the bundle.
- Every bundle gets a changelog entry in plain English. Set `notice: true` only for MINOR releases: players then see a
  one-time "What's new" note. Small fixes stay quiet.
- `tools/deploy.py live --approved` refuses a version number that already went live with different code, and tags each live
  release in GitHub (`v0.13.0`). To roll back: publish the tagged commit again (to test first, then live with approval).
- After each live release, update the changelog in the claude.ai project notes (`claude/changelog.md`).

### Notes
- The test server is on Supabase's free plan and goes to sleep after 7 days without use. Wake it from the Supabase
  dashboard (Restore project) before testing.
- Keep the two databases' structure identical: every migration that lands on live must have landed on test first.
- Never copy real player data into test.
