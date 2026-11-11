# Site + private browser

## Run it
    python3 -m http.server 8300  # static site; the BROWSER tab falls back to Render
    # open http://localhost:8300

Or run the Node server for a self-hosted local proxy:
    node server.js            # Node 18+, no npm install needed
    # open http://localhost:8080; the browser uses this same origin automatically

Optional: `PROXY_KEY=somesecret node server.js` makes the local proxy ask for a key. `PORT=3000` changes its port.

Hosting: when a site served by `server.js` is used, the BROWSER tab sends its proxy traffic to that same origin
(for example `https://rcms-gmk0.onrender.com/p?u=...`), so the main site and proxy share one origin. Static hosts
such as GitHub Pages fall back to the Render service at `https://rcms-gmk0.onrender.com/`; its source is `server.js`
and its configuration is `render.yaml`. If the main site has no `/p` endpoint, the browser detects that and switches
to Render automatically.

## Optional: deploy a Node proxy on Render
1. Push this folder to GitHub.
2. render.com -> New -> Blueprint (it reads `render.yaml`) or New -> Web Service (Runtime Node, Start Command `node server.js`, Free plan).
3. Set the `PROXY_KEY` environment variable (the blueprint generates one; find it under Environment). Visitors to the BROWSER tab are asked for it once.
Free instances sleep after ~15 min idle, so the first load can take about a minute.

## Accounts (Supabase)

Accounts are stored by Supabase Auth, so they keep working when the site moves to a new domain or host. The browser only caches the signed-in profile.

If `js/auth-config.js` is left empty, the account screens fall back to browser-only accounts. Sign-up and sign-in still work, and salted PBKDF2 password hashes plus the profile stay in that browser's `localStorage`; nothing syncs across devices. Adding the Supabase URL and anon key switches the same screens back to online accounts and sync.

1. Create a project at https://supabase.com/dashboard.
2. Open Project Settings -> API and copy the Project URL and the `anon` / publishable key into `js/auth-config.js`.
3. In Authentication -> Providers -> Email, keep Email enabled. For instant sign-up, turn off "Confirm email"; otherwise users verify with the link in the message (and with a code when the template includes one).
4. In Authentication -> Email Templates, add `{{ .Token }}` to both **Confirm signup** and **Reset Password** if you want 6-digit codes. For example: `<p>Your code is <strong>{{ .Token }}</strong>.</p><p>Or open {{ .ConfirmationURL }}</p>`. The site supports the link even when no code is present; the separate "Email me a sign-in link" button uses the Magic Link template.
5. Supabase's built-in email sender is limited and only delivers to authorized team addresses. For real users, configure Authentication -> SMTP Settings with a custom provider. Without it, the app can show a successful request while no message is delivered.
6. In Authentication -> URL Configuration, set the Site URL to the current site and add every domain the site may use. This is needed for sign-up confirmation links, sign-in links, and reset links; code verification does not need a redirect URL. Normal password sign-in works on any domain.
7. Optional but recommended: run `supabase/schema.sql` in the SQL editor. That creates the `profiles` table used to sync history, saved sites, and preferences across devices. Without it, sign-in still works and the profile stays in the browser.

The Forgot password form sends a recovery email, verifies a code when one is present, and asks for a new password. If the Reset Password template still contains only the default link, users can click that link instead and the site will ask for the new password. The verification screen also offers a Magic Link fallback when a code never arrives.

Signed-in users get an Account settings panel for their display name, email, profile picture, password reset, and sync status. Profile pictures are cropped and resized to 256 × 256 in the browser, then stored in the account profile so they follow the account across domains and devices. A default avatar is shown until a picture is uploaded, and the profile picture card can restore it at any time.

### Chat

CHAT is one shared room for the whole site. It uses a Cloudflare Durable Object named `global` and requires a
Supabase-authenticated online account; the Worker verifies the Supabase access token before opening the WebSocket.
Browser-only accounts are prompted to add a verified email first. The room keeps the latest 100 messages, blocks
slurs and hate speech on the server, shows member avatars, and has a short polling fallback so a missed WebSocket
broadcast does not hide messages from other members. The binding and migration are in `wrangler.jsonc`; the health
endpoint is `/api/chat/health`.

### Emulators

The EMULATORS tab accepts local ROM files by drag-and-drop or file picker. It uses EmulatorJS, a browser frontend for
libretro cores, loaded from `https://cdn.emulatorjs.org/stable/data/` only when a game is started. The console picker
lists the systems exposed by that frontend, including Nintendo, Sony, Sega, Atari, arcade, NEC/SNK, and classic
computer cores. ROMs are turned into temporary browser blob URLs and are never uploaded. A BIOS can be supplied for
systems such as PlayStation, Sega CD, Saturn, 3DO, PC-FX, Amiga, Atari 5200, and ColecoVision; cue/bin games should be
zipped together. EmulatorJS does not have browser cores for every RetroArch target (for example GameCube/Wii,
Dreamcast, and PlayStation 2 are not available), so the picker only lists systems that can actually run here.

### Game progress

Signed-in players' progress is saved to their account. The game loader injects a small bridge that mirrors each game's `localStorage` into the account profile under `gameProgress`, keyed by the game's URL, and seeds it again the next time the game opens. With Supabase configured, that profile syncs through the `profiles` table, so progress follows the account across domains and devices. Limits: 80 games per profile, 120 keys per game, 1 MB per profile. Only `localStorage` saves are captured; games that keep progress in IndexedDB or on their own servers manage it themselves. Signed-out visitors keep the game's native local storage.

Never put the `service_role` key in `js/auth-config.js`; it would be public. Accounts created before this update lived only in one browser, so those users need to create an account again; if they use the same username or recovery email, their saved history and preferences are copied over automatically.

## Site updates

The UPDATES tab is generated from `js/updates.js`. Every change to the site adds an entry at the top of the `updates` array with an ISO date, a short title, and a list of what changed. Bump the `?v=` query on the `updates.js` script tag in `index.html` when editing it so browsers fetch the new list.

## Add the games
    python3 tools/add_games.py --dry-run      # preview (clones both repos, needs git + internet)
    python3 tools/add_games.py                # import everything, skipping duplicates
    python3 tools/add_games.py --max-mb 25    # skip huge games to keep the site small
Duplicates are detected by normalized title and by identical file contents, against your existing games and
within the new ones. Re-running is safe.

## What the proxy does / doesn't do
Does: sites see the site's proxy server instead of your device; cookies + referrers are stripped; private/local addresses are blocked.
Doesn't: encrypt anything from whoever runs the proxy, or work on heavy sites (YouTube, Google login, anything that
builds URLs in complex JS). For better compatibility swap in Ultraviolet or Scramjet on the same proxy.

## Ads

The site uses labeled Adsterra placements: a desktop leaderboard, a banner below the hero, a 300x250 and
160x300 above the game library, a sticky 160x600 desktop rail, a native unit after the first five rows of games,
and a dismissible 320x50 banner on mobile. Display ads are always on. Settings has one ad control, **Popup ads**,
which hides the sponsored popup offer only; it never turns off the display units. Each display unit is rendered in
a sandboxed iframe without popup or top-navigation permission, and the popup offer is checked against known adult
destinations before it can open. Update the unit keys in `js/ads.js` when changing campaigns.

## Games from the Offline HTML Games Pack

78 games from the Offline HTML Games Pack remain after 57 that no longer rendered were removed, bringing the catalog to 653 entries: 652 public cards plus the hidden secret game. The pack is 5.3 GB, so those games are not copied into the repo; the catalog points at the pack's public raw GitHub files and the existing loader fetches each game's HTML. Their covers are generated 640x360 SVG title cards in `images/g_pack_*.svg`, checked against every title with no text overflow. Re-running the importer is safe; it skips duplicates by title, URL, alias, and file contents:

    node tools/import_offline_pack.js "C:/path/to/Offline-HTML-Games-Pack-master/offline"

The tool defaults to the Downloads path and writes `.wrangler/import-report.json`. Earlier local additions in `games/pack/` and `games/mgg/` still have generated thumbnails; run `python tools/make_thumbs.py` to replace those with real screenshots.

The 135 pack games are fetched from GitHub, so they need an internet connection. Games stored under `games/` remain fully local.
