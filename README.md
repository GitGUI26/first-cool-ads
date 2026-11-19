# Site + private browser

## Run it
    npx wrangler dev        # whole site, including the browser's /bare/ endpoint
    # open http://localhost:8787

A plain static server can render the site, but the BROWSER tab needs the Worker: the proxy engine asks `/bare/` on the
same origin for every page it fetches, and a static host has no such endpoint.

## Browser (Ultraviolet)

The BROWSER tab runs [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet), the proxy engine from the
Zaluea project, in place of the old `/p/` page rewriter. `browser/index.html` registers a service worker scoped to
`/browser/service/`, and every request the browser makes under that prefix is fetched by `/bare/` (`proxy/bare.js`)
and rewritten by Ultraviolet before it reaches the frame. `browser/uv/` holds the Ultraviolet build from Zaluea; the
only edit is the two `importScripts` paths in `uv.sw.js`, pointed at `/browser/uv/`.

What it does: pages are fetched by this Worker, so sites see Cloudflare's address instead of the visitor's; the target
origin is encoded into the path rather than shown; loopback and private hosts are refused; response bodies, cookies,
redirects and WebSocket frames are tunnelled back through `/bare/`.

What it does not do: it is not a VPN. A site that blocks Cloudflare's egress, or a device that cannot reach this site,
still fails, and sites that fingerprint browsers or demand a captcha will not work. Only the browser's own scope is
proxied; the rest of the site is served unchanged.

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

### Sharing a sign-in across domains

Accounts, chat messages, notifications, friendships, browsing history, saved sites, app handles, preferences, avatars and
game progress all live on the server (Supabase plus the chat Durable Object), so any domain that serves this Worker shows
the same data. The only per-origin piece is the session, because browsers keep it in that origin's storage.

Account settings has **Share this sign-in with another domain**. It stores the session in the `SESSION_HANDOFF` Durable
Object behind a reusable code and returns `https://other-site/#share=CODE`. Any address that opens that link (or simply
loads with the code remembered) is signed in to the same account, and the address that created it stays signed in.

The share works because the Worker is the only client that refreshes: Supabase rotates refresh tokens on use, so two
domains refreshing the same token would sign each other out. Instead, `POST /api/session/open` returns the current
access token to every domain, refreshing centrally inside the Durable Object when it is within two minutes of expiry.
Each domain runs with `autoRefreshToken` disabled once it is sharing and re-syncs from the Worker every 20 minutes and
when the tab becomes visible again. Signing out on one address only clears that address; the others keep their session.
Share codes are cleaned up after 30 idle days.

Chat history is shared only when the other domain serves this same Worker (a custom domain or route). A separate Worker
deployment has its own Durable Object and therefore its own chat room.

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
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers make it render blank in an iframe). The Android-x86 4.4-r1 ISO is read with HTTP range requests from the Internet Archive through `/api/android-image/...`,
cut into 1 MB chunks and edge-cached, because the archive's own file responses carry no CORS headers. First
boot streams up to about 360 MB and can take several minutes even on a fast connection, so it only starts after
the visitor presses Start. `android.html` is also available as a standalone player with start, pause, restart, and fullscreen
controls. It has no Google Play, no guest networking, and no built-in APK installer. Because v86 translates x86
instructions to WebAssembly in a single browser thread, Android runs far slower here than in a native hypervisor such
as MuMu Player, which uses hardware virtualization, GPU passthrough and ARM translation. A browser tab cannot have
those, so expect a slow, degraded desktop rather than a gaming-grade Android. The v86 runtime is BSD-2-Clause
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

## The bare endpoint

`/bare/` is the only network-facing part of the browser. It accepts the Bare v1 request headers, refuses loopback and
private addresses, strips hop-by-hop headers, and returns the upstream status, headers and body so Ultraviolet can
rewrite them. `GET /bare/` answers with a small version banner and is what the browser uses as a health check.
WebSocket upgrades on the same path are tunnelled frame by frame.

Because the Worker is the client, the site being browsed sees Cloudflare's egress rather than the visitor's. Whoever
runs this site can see the traffic that passes through the proxy; it is a convenience feature, not an anonymity tool.

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
