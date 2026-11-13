# Site + private browser

## Run it
    python3 -m http.server 8300  # static site; the BROWSER tab falls back to Render
    # open http://localhost:8300

Or run the Node server for a self-hosted local proxy:
    node server.js            # Node 18+, no npm install needed
    # open http://localhost:8080; the browser uses this same origin automatically

Optional: `PROXY_KEY=somesecret node server.js` makes the local proxy ask for a key. `PORT=3000` changes its port.

Hosting: the BROWSER tab sends proxy traffic to whatever origin served the page (`/p/...` on the same host), then to
any relay origins configured in the **Proxy network** panel or `PROXY_RELAYS`. No relay is hard-coded: the previous
Render mirror was suspended by its host, and a dead default is worse than none. If the site has no `/p` endpoint and no
relay answers, the browser says so instead of silently failing.

## Optional: deploy a Node relay

A relay gives the proxy a second network identity, which is the only thing that clears a site blocking Cloudflare's
egress. Any Node host works (Render, Fly, Koyeb, Railway, a VPS); `render.yaml` is a ready Render blueprint, and
`server.js` exposes the relay protocol at `GET /p/raw?u=<url>`.
1. Push this folder to GitHub.
2. render.com -> New -> Blueprint (it reads `render.yaml`) or New -> Web Service (Runtime Node, Start Command `node server.js`, Free plan).
3. Set the `PROXY_KEY` environment variable (the blueprint generates one; find it under Environment). Visitors to the BROWSER tab are asked for it once.
Free instances sleep after ~15 min idle, so the first load can take about a minute.

## Accounts (Supabase)

Accounts are stored by Supabase Auth and use a username and password. There is no email field, email verification, email sign-in link, or email password recovery in the site.

Because Supabase's password endpoint expects an email-shaped identifier, accounts receive a hidden, random login address using a plus-addressed alias on the site's contact mailbox. Older accounts, and signups made before the resolver schema is applied, use an address derived from their original username instead. The address stays fixed when the username changes; sign-in resolves the current username to that address through a database function. It is never shown, and the site never sends account email to it. Supabase rejects reserved and non-resolving test domains, so the alias must stay on a real mail domain. Existing accounts created before this update can still enter their previous email in the username box to sign in for compatibility.

If `js/auth-config.js` is left empty, online accounts are disabled and new browser-only accounts are not created. Add the Supabase URL and anon key to enable username accounts.

1. Create a project at https://supabase.com/dashboard.
2. Open Project Settings -> API and copy the Project URL and the `anon` / publishable key into `js/auth-config.js`.
3. In Authentication -> Providers -> Email, keep Email enabled and turn **off** "Confirm email". This is required: new usernames use an internal address that cannot receive a confirmation message.
4. In the SQL editor, run `supabase/schema.sql`. It creates the `profiles` table, repairs any older duplicate usernames with a numeric suffix, and adds case-insensitive unique indexes plus triggers. This update also adds `site_admins`, username-change limits, the login resolver, and owner functions. Re-running it is safe for these objects.
5. SMTP, email templates, and Auth URL Configuration are not needed for username accounts because the site never sends account email.

Signed-in users get an Account settings panel for their username, profile picture, bio, avatar reset, sync status, history, saved sites, app handles, and preferences. The bio is a public 160-character line shown on the member's chat profile. Regular accounts can change their username once every 7 days; the account that held the username `cool` when the schema was applied is seeded into `site_admins` and can change it without that cooldown. Usernames remain case-insensitively unique and are also the login. The owner account can use Owner tools to grant or remove Owner access, rename or delete other accounts, and delete room or direct messages. The owner cannot remove their own access. Passwords are stored by Supabase as one-way hashes and cannot be viewed; there is no email password recovery, so choose them carefully. Profile pictures are cropped and resized to 256 × 256 in the browser, then stored in the account profile so they follow the account across domains and devices.

Signed-in users can permanently delete their account from Account settings. Deletion removes the Supabase auth user, synced profile, posted room and direct chat messages, notifications, friendships, friend requests, the chat directory entry, saved history, sites, app handles, game progress, and the local session. The Worker purges the user's chat data before the auth deletion; if that purge fails, the account is not deleted. There is no undo.

### Chat

CHAT is one shared room for the whole site. It uses a Cloudflare Durable Object named `global` and requires a
Supabase-authenticated username account; the Worker verifies the Supabase access token before opening the WebSocket.
The room keeps the latest 100 messages, blocks slurs and hate speech on the server, shows member avatars, and has a
short polling fallback so a missed WebSocket broadcast does not hide messages from other members.

Friends and direct messages live in the same Durable Object. Friend requests and direct messages can be sent while
the other member is offline; they are stored and delivered when the member returns. Direct messages remain
friends-only. Room messages support `@username` mentions and replies, with the reply target stored alongside the
message. Mentions, replies, friend requests, and DMs create persistent notifications. Signed-in pages register a small
directory entry so offline usernames can be resolved without exposing the private Supabase profile table. Directory
entries also carry the member's public bio; clicking a name or avatar in the room, friends list, or a direct message
opens a profile card. Usernames
are unique case-insensitively; run `supabase/schema.sql` so the `profiles` and `auth.users` unique indexes and triggers
enforce that rule for new accounts. The binding and migration are in `wrangler.jsonc`; the health endpoint is
`/api/chat/health`, notifications use `/api/chat/notifications` and `/api/chat/notifications/read`, and directory
registration uses `/api/chat/register`. Account deletion calls the authenticated `/api/chat/purge` endpoint first,
which removes that user's messages, notifications, friendships, requests, directory entry, and member entry from the
Durable Object before the Supabase auth user is deleted. Owner account deletion uses the authenticated
`/api/chat/admin/purge-user` endpoint first, then the `site_admin_delete_account` database function. Owner message
deletion uses `/api/chat/admin/delete-message`; `/api/admin/status` tells the account and chat pages whether to show
owner controls. Owner checks use the stable `site_admins` table, never the current username.

### Emulators

The EMULATORS tab accepts local ROM files by drag-and-drop or file picker. It uses EmulatorJS, a browser frontend for
libretro cores, loaded from `https://cdn.emulatorjs.org/stable/data/` only when a game is started. The console picker
lists the systems exposed by that frontend, including Nintendo, Sony, Sega, Atari, arcade, NEC/SNK, and classic
computer cores. ROMs are turned into temporary browser blob URLs and are never uploaded. A BIOS can be supplied for
systems such as PlayStation, Sega CD, Saturn, 3DO, PC-FX, Amiga, Atari 5200, and ColecoVision; cue/bin games should be
zipped together. EmulatorJS does not have browser cores for every RetroArch target (for example GameCube/Wii,
Dreamcast, and PlayStation 2 are not available), so the picker only lists systems that can actually run here.

The EMULATORS tab also has an **Android 4.4** experimental device. It runs directly in the player panel using a
self-hosted copy of [v86](https://github.com/copy/v86) in `v86/`, rather than framing the copy.sh demo (whose
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers make it render blank in an iframe). The
Android-x86 4.4 image is streamed in 1 MB chunks from the public v86 image cache through `/api/android-image/...`;
the Worker tries `c.copy.sh` first and automatically falls back to the `i.copy.sh` mirror, then proxies and edge-caches
the successful chunks because the upstream cache rejects browser hotlink requests. First
boot downloads up to about 247 MB and can take several minutes even on a fast connection, so it only starts after
the visitor presses Start. `android.html` is also available as a standalone player with start, pause, restart, and fullscreen
controls. It has no Google Play, no guest networking, and no built-in APK installer. The v86 runtime is BSD-2-Clause
licensed, and its bundled firmware is LGPL (see `v86/LICENSE`, `v86/COPYING.LESSER`, and `v86/NOTICE.md`);
Android-x86 is a separate open-source project.

### Game progress

Signed-in players' progress is saved to their account. The game loader injects a small bridge that mirrors each game's `localStorage` into the account profile under `gameProgress`, keyed by the game's URL, and seeds it again the next time the game opens. With Supabase configured, that profile syncs through the `profiles` table, so progress follows the account across domains and devices. Limits: 80 games per profile, 120 keys per game, 1 MB per profile. Only `localStorage` saves are captured; games that keep progress in IndexedDB or on their own servers manage it themselves. Signed-out visitors keep the game's native local storage.

Never put the `service_role` key in `js/auth-config.js`; it would be public. Existing online accounts keep their saved profiles. If the schema finds duplicate usernames, the newer rows are given a numeric suffix and their auth metadata is updated so chat and account pages stay consistent; those users can still sign in with their previous email.

## Site updates

The UPDATES tab is generated from `js/updates.js`. Every change to the site adds an entry at the top of the `updates` array with an ISO date, a short title, and a list of what changed. Bump the `?v=` query on the `updates.js` script tag in `index.html` when editing it so browsers fetch the new list.

## Add the games
    python3 tools/add_games.py --dry-run      # preview (clones both repos, needs git + internet)
    python3 tools/add_games.py                # import everything, skipping duplicates
    python3 tools/add_games.py --max-mb 25    # skip huge games to keep the site small
Duplicates are detected by normalized title and by identical file contents, against your existing games and
within the new ones. Re-running is safe.

## What the proxy does / doesn't do
Does: sites see the proxy server's network instead of your device; target URLs are base64url-encoded in `/p/<target>`
so hostnames do not appear in the browser's URL bar or request path; cookies + referrers are stripped; private/local
addresses are blocked.

Doesn't: make the proxy host reachable when the network blocks the site or proxy domain. A proxy is not a VPN: a VPN
changes the network your device sits on, while this proxy only changes the network the page is fetched from, and the
browser must still be able to reach the proxy. Nothing inside this repo can move a device onto another network, and a
Cloudflare Worker cannot choose its own egress IP.

### Route ladder

Every page request walks a ladder and stops at the first route that returns a real page (`proxy/index.js`):

1. **Direct** — the Worker fetches the site itself, with a browser profile and a no-cache request. Most sites answer here.
2. **Relay** — if the site answers with a block page or 401/403/407/429/451/503, the same URL is fetched through every
   origin listed in the `PROXY_RELAYS` variable (comma-separated), using its `GET /p/raw?u=<url>` endpoint. A relay is a
   different machine on a different network, which is what clears an IP-level block. `server.js` speaks this protocol;
   deploy it on Render, Fly, Koyeb, Railway or any Node host and put its origin in `PROXY_RELAYS`, e.g.
   `npx wrangler deploy --var PROXY_RELAYS:"https://relay-a.example.com,https://relay-b.example.com"`.
3. **Reader** — if no relay answers, the page is fetched through a text-only gateway and rendered as readable text with a
   banner, so a block page never replaces the content. `/p/reader/<encoded-url>` opens that view directly, and
   `/p/diag` lists the configured routes.

Sites that fingerprint browsers or demand a captcha (Cloudflare's "Just a moment", Google sign-in) cannot be solved at
this layer; they need the relay from step 2. Heavy apps (YouTube playback, Google login, anything that builds URLs in
complex JS) may still not work. For better compatibility swap in Ultraviolet or Scramjet on the same proxy.

### Relays in the browser UI

The BROWSER tab's **Proxy network** panel accepts one or more relay origins, comma-separated, or `?relay=` in the URL.
Routes are health-checked before use, tried in order, and skipped when they stop answering, so a suspended relay no
longer breaks the browser. The old Render mirror is gone (the service was suspended), so no relay is hard-coded —
without `PROXY_RELAYS` a blocked site falls through to the reader view. Whoever runs a relay can see the traffic that
passes through it.

## Ads

The site carries no advertising: there are no ad units, no sponsored popup offer, and no ad network scripts.
The Adsterra renderer (`js/ads.js`), its stylesheet, every ad slot in `index.html`, the in-feed and mobile-sticky
placements, and the **Popup ads** Settings control have all been removed. Settings now covers themes, backgrounds,
logo, game-grid columns, featured-carousel autoplay, reduced motion, and site-data export/import only. Bundled
games keep their own markup, but nothing on the site requests an ad network.

## Games from the Offline HTML Games Pack

69 games from the Offline HTML Games Pack remain after 66 that no longer rendered were removed, bringing the catalog to 633 entries: 632 public cards plus the hidden secret game. The pack is 5.3 GB, so those games are not copied into the repo; the catalog points at the pack's public raw GitHub files and the existing loader fetches each game's HTML. Catalogue covers are 640x360 WebP files in `images/thumbs/`, using official art wherever a game publishes it; site-made arcade games keep their gameplay art, and a few pack games with no published cover keep their generated title cards. Re-running the importer is safe; it skips duplicates by title, URL, alias, and file contents:

    node tools/import_offline_pack.js "C:/path/to/Offline-HTML-Games-Pack-master/offline"

The tool defaults to the Downloads path and writes `.wrangler/import-report.json`. The generated title-card step remains in the importer for brand-new pack games until official cover art is added.

The 126 pack games are fetched from GitHub, so they need an internet connection. Games stored under `games/` remain fully local.
