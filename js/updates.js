(function () {
    'use strict';

    // Add a new entry at the top of this array every time the site changes.
    // Dates are ISO (YYYY-MM-DD); entries are rendered newest first.
    var updates = [
        {
            date: '2026-11-13',
            title: 'Browser searches now use Bing',
            items: [
                'Typing a search into the private browser used to land on DuckDuckGo\u2019s anti-bot page almost every time, which looks like a captcha you can never pass.',
                'Searches now go to Bing, which answers the proxy in about 200 ms and returns ten real results with no challenge page.',
                'The start page shortcut now opens Bing too.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Emoji picker in chat',
            items: [
                'A smiley button next to the message box opens a grid of common emoji in both the room and friend conversations.',
                'Picked emoji drop in at your cursor, the character counter and the growing textarea stay in sync, and Escape closes the picker.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Android emulator boots again',
            items: [
                'The old image host started returning 404 for every chunk, which is why the Android device never showed anything. The player now streams the Android-x86 4.4-r1 image from a live range-readable source.',
                'Chunks are still cut into 1 MB pieces and edge-cached, so a second visit starts far faster than the first.',
                'A browser tab emulates the CPU in WebAssembly, so this is much slower than a native emulator like MuMu Player: no Google Play, no ARM translation, no GPU acceleration.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Faster browsing through the proxy',
            items: [
                'Images, stylesheets, scripts and media are now cached at the edge and in the browser, so a repeat page load skips them entirely.',
                'A Wikipedia page reload through the proxy went from 615 ms and 588 KB to 166 ms and 45 KB, with 39 of 41 requests served from cache.',
                'Healthy pages skip the block-detection pass that used to read and decode every response twice, and a real 404 is no longer mistaken for a block.',
                'Each proxied response reports server-timing for upstream, body and rewrite time, plus an x-proxy-cache hit/miss header.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Proxy route ladder and reader fallback',
            items: [
                'A blocked page no longer replaces the content: the proxy retries through configured relay origins, then falls back to a text-only reader view.',
                'The browser UI accepts a list of relays, health-checks each one, and skips any route that stops answering instead of failing the whole session.',
                'Captcha and JavaScript challenge pages are passed through with a banner that offers the reader view, and /p/diag lists the configured routes.',
                'The old Render mirror was suspended, so no relay is hard-coded; add your own under Proxy network.'
            ]
        },
        {
            date: '2026-11-13',
            title: '1v1.lol loads again and the site is ad-free',
            items: [
                '1v1.lol no longer hangs on its loading screen: it loads a live mirrored build instead of a deleted storage host, so the client reaches its main menu.',
                'All advertising is gone: the Adsterra renderer, every ad slot, the sponsored popup, the mobile banner, and the Settings popup-ads control.',
                'Bundled game pages dropped their AdSense loaders, which are replaced with an inert stub so the games keep running.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Android now boots in the emulator panel',
            items: [
                'Android 4.4 runs inside the EMULATORS player instead of opening the copy.sh demo in another tab.',
                'A self-hosted v86 runtime streams the Android-x86 image in chunks and reuses cached chunks on later boots.',
                'The Android view has Start, Pause, Restart, and Fullscreen controls, plus a standalone android.html player.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Smarter search and cleaner site details',
            items: [
                'Search now matches game descriptions as well as titles, so themes like zombies or racing are easier to find.',
                'Search waits briefly while you type instead of rerendering the whole library on every keystroke.',
                'Fixed the stale game count in share previews, metadata, and the empty-search field, and added a proper page heading for screen readers.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Game audio mute and a faster Animal Crossing port',
            items: [
                'The game browser toolbar has a mute toggle that remembers its setting across games and reloads.',
                'Animal Crossing now caps its render target at a 4:3 1280x960 maximum, requests the high-performance GPU, and only preserves the WebGL drawing buffer when a filter needs it.',
                'The port loads from a pinned CDN revision with preloaded loader and WebAssembly files.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Proxy relay control and Android virtual device',
            items: [
                'The BROWSER tab can now use a relay on another domain, so the proxy path does not depend on this site\'s domain alone.',
                'Proxy target URLs are encoded instead of showing the visited hostname in the address bar; failures now explain when the network is blocking the proxy itself.',
                'EMULATORS has an experimental Android 4.4 virtual device powered by v86. First boot is slow and there is no Google Play.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'One email for suggestions and bug reports',
            items: [
                'The home hero and footer now use a single contact message for both game suggestions and bug reports.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Chat profiles and bios',
            items: [
                'Click a member\'s name or profile picture in chat to open their profile card.',
                'Add a short bio in Account settings; it is shown on your chat profile and synced with your account.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Owner tools can grant admin access',
            items: [
                'Owner tools now show Make admin and Remove admin buttons for every other account.',
                'You cannot remove your own owner access, so the site always keeps at least one owner.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Owner access moves to the cool account',
            items: [
                'The site admin allowlist now points at the username cool instead of the old placeholder account.',
                'Owner tools and chat moderation follow that account after the database migration is applied.'
            ]
        },
        {
            date: '2026-11-13',
            title: 'Catalog cleanup and CDN game loader fixes',
            items: [
                'Retested the catalog and repaired shared packed-game wrapper parsing, Papa\'s Burgeria, Tattletail, FNF Rewrite/Camellia/Impostor V4, and the FNAF CDN hosts.',
                'Games whose pages declare their own absolute CDN base now load directly in the game frame instead of a nested document.',
                'Removed 19 games that still would not load, leaving 634 entries.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Private browser fills the screen and gets page controls',
            items: [
                'The private browser now opens across the whole viewport, with native fullscreen requested when the browser allows it.',
                'The outer browser bar now has Back, Forward, and Reload buttons.',
                'The top-right control is now an Exit button; Escape also closes the browser.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Usernames can change, and the owner gets account tools',
            items: [
                'Regular accounts can change their username once every 7 days. The current owner account can change as often as they like.',
                'Usernames stay unique, and sign-in follows the new username while the hidden login address stays stable.',
                'The owner can rename or delete other accounts and delete room or direct messages from chat.',
                'Passwords are stored as one-way hashes by Supabase and cannot be viewed.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Selected cursor stays visible over buttons',
            items: [
                'Buttons and links no longer bring back the native pointer when a custom cursor is selected.',
                'The selected cursor also stays active inside the account panel.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Reply controls stay out of the message layout',
            items: [
                'Reply now slides in as a small floating control when hovering over someone else\'s message.',
                'Reply no longer adds a full line beneath messages, and your own messages no longer show a reply button.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Mentions, replies, notifications, and offline chat',
            items: [
                'Room messages and direct messages now support @username mentions and replies, with highlighted mentions and quoted reply context.',
                'A notification bell beside the profile button shows unread mentions, replies, friend requests, and direct messages.',
                'Friend requests and direct messages can be sent to offline members; offline members can accept requests too. They see everything when they return.',
                'Fixed chat avatars so each member keeps their own profile picture instead of every message showing the signed-in user\'s picture.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Sent chat messages use the full bubble width',
            items: [
                'Fixed a style conflict that squeezed your own chat messages into the avatar column, wrapping their text one letter per line.'
            ]
        },
        {
            date: '2026-11-12',
            title: 'Deleted accounts now clear chat messages',
            items: [
                'Deleting an account now removes that user\'s posted room messages and direct messages from chat.',
                'If the chat cleanup fails, the account is not deleted, so a successful deletion does not leave messages behind.',
                'The delete confirmation and Account settings now include chat messages in the list of removed data.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Delete your account',
            items: [
                'Signed-in users can now permanently delete their account from Account settings.',
                'Deletion removes the login, profile, saved data, game progress, and local session.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Username signup fixed',
            items: [
                'New accounts use a hidden login identifier on a real mail domain instead of a reserved or non-resolving test domain that Supabase rejects.',
                'You still enter only a username and password; there is no email field, verification step, or email recovery.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Compatibility fix and dead games removed',
            items: [
                'PEAK now gets past a history-update crash and loads its build inside the sandboxed player.',
                'Undertale Yellow now runs in a real-URL frame, so its intro and game canvas render instead of staying blank.',
                'Removed The Final Earth and Trombone Champ because their game files are no longer available.',
                'The catalog now has 653 entries: 652 public cards plus the hidden secret game.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Clearer suggestion and bug-report contacts',
            items: [
                'Game suggestions and bug reports now have separate email links with pre-filled subjects.',
                'Each link explains what to include so reports are easier to act on.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Official cover art across the library',
            items: [
                'Replaced generated title cards and gameplay captures with official cover art for 168 games.',
                'Covers are normalised to 640x360 WebP, and retired placeholder files were removed.',
                'Games with no published official cover keep their existing in-game artwork.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Username-only accounts',
            items: [
                'Removed email fields, verification screens, password recovery by email, and email account settings.',
                'New accounts use a unique username and password; usernames are permanent and case-insensitive.',
                'The database now rejects duplicate usernames and resolves older duplicates once during setup.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Hotline Miami gets a newer script',
            items: [
                'Hotline Miami now loads its game script from the newer jsDelivr-hosted web port.',
                'The game card, cover art, and catalog count are unchanged.'
            ]
        },
        {
            date: '2026-11-11',
            title: "Class of '09 gets a newer port",
            items: [
                "Class of '09 now uses a newer Ren'Py web loader with save import and export support.",
                'The existing cover art is retained, and the card has moved into the newest additions.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Sally Face joins the library',
            items: [
                'Added Sally Face to ALL GAMES with its official cover art.',
                'The Unity WebGL port loads its game build from a CDN, so the first launch can take a while on slower connections.',
                'The library now has 654 public games.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Roblox in the library',
            items: [
                'Added Roblox to ALL GAMES. It launches in the site\'s private browser instead of a direct iframe.',
                'Roblox loads through the same /p proxy as the BROWSER tab, so its links and navigation use the proxy too.',
                'The library now has 653 public games.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Games stay on the home URL',
            items: [
                'Opening a game no longer changes the address bar to a game query URL.',
                'Back and forward still close and reopen games, and copied game links use a root hash link that cleans itself back to the home URL.',
                'Older ?game= links still open, then remove the query from the address bar automatically.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'More display settings',
            items: [
                'Settings now includes a game-grid column picker, a featured-carousel autoplay control, and a reduced-motion option.',
                'Reduced motion stops the featured carousel and most interface animations without changing games or their content.',
                'Display ads remain required and always on. Only the optional sponsored popup offer can be turned off.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Friends and direct messages',
            items: [
                'Chat now has a friends panel. Add online members, accept or decline requests, and see which friends are online.',
                'Friends can send private direct messages without posting them in the shared room. Messages are stored separately for each friendship and sync live.',
                'Friend requests and direct messages are checked on the server. Offline members cannot be added, accepted, or messaged, and browser-only accounts cannot use chat or friends.',
                'Usernames are unique case-insensitively, and the schema enforces that rule for new signups and username changes.',
                'The full-screen chat header now stays visible, with an Exit button that returns to the game library from the room or a direct message.'
            ]
        },
        {
            date: '2026-11-11',
            title: 'Chat reliability and account polish',
            items: [
                'Chat now blocks slurs and hate speech on the server before a message reaches the room.',
                'Profile pictures appear beside chat messages and in the online-member stack, with a fallback avatar for members who have not uploaded one.',
                'Messages now recover through a short history sync, so everyone sees the room even if a live broadcast is missed.',
                'The custom cursor stays visible instead of disappearing after a few idle seconds, including while chat is open.',
                'The chat layout, account screens, navigation, focus states, and form controls received a cleaner, more consistent interface pass.',
                'Email verification now explains link-based confirmation and offers a sign-in-link fallback when a code is not present.'
            ]
        },
        {
            date: '2026-11-10',
            title: 'Bring your own ROMs',
            items: [
                'Added an EMULATORS section where you can drop in a local ROM file and play it in the browser.',
                'The console picker covers the systems available through the EmulatorJS/libretro frontend, from NES and SNES to PlayStation, Sega, Atari, arcade, and classic computers.',
                'ROMs stay on your device and are never uploaded. Optional BIOS support is available for systems that need one.',
                'Multi-file games can be zipped, and the player includes keyboard, touch, gamepad, save-state, and fullscreen support from EmulatorJS.'
            ]
        },
        {
            date: '2026-11-10',
            title: 'One shared chat and refreshed ads',
            items: [
                'Added a CHAT section with one shared room for the whole site. Guests are sent to sign in or create an account first.',
                'The chat room is verified against an online account on the server, and signed-in browser-only accounts can add an email to join.',
                'Replaced the old ad units with the new placements, including a responsive leaderboard, library banners, a desktop rail, an in-feed native unit, and a mobile banner.',
                'Added a Settings option for popup ads. Display ads stay on; only the sponsored popup offer can be hidden.',
                'Ad frames are sandboxed so they cannot redirect the site or open new tabs, and known adult destinations are blocked from the popup offer.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'Faster, shareable, and personal',
            items: [
                'The player toolbar can open any game in its own tab, and closing the player returns keyboard focus to the card you used.',
                'The game toolbar now has a heart button, and favorites stay in sync between the toolbar and the card grid.',
                'A new Recently played sort puts the games you opened last at the top of the library.',
                'Games start loading immediately instead of waiting through a 1.5-second loading screen; the first frame now appears in about a quarter of a second.',
                'The site logo now loads as a 42 KB WebP instead of an 87 KB PNG, and the library renders with about 2,000 fewer DOM nodes.',
                'Startup is much lighter: the classroom loader is now about 10 KB instead of 1 MB, and card art loads as optimized WebP thumbnails.',
                'Every game has a shareable link. Use the link button in the game toolbar, or copy the address bar after opening a game.',
                'Press the heart on any game card to save favorites, then choose Favorites first in the sort menu.',
                'The library now has a labeled search box, a no-results state, visible keyboard focus, and reduced-motion support.',
                'The library renders and filters in one pass, so sorting and searching stay responsive even with 652 games.',
                'Added a social preview image, structured data for search engines, robots.txt, and a sitemap.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'Email is optional, with verified upgrades',
            items: [
                'You can create an account without an email; it stays in this browser until you add one.',
                'Adding an email later sends a verification code and upgrades the browser account to online sync.',
                'Accounts created with email also finish with a verification code from the inbox.',
                'Online usernames and emails are unique, and browser accounts are checked in this browser before they are created.',
                'Existing duplicate usernames are preserved so current accounts keep working.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'Online accounts now sync across devices',
            items: [
                'Accounts are now backed by Supabase, so signing in on another device restores the same account.',
                'The profile, history, saved sites, and preferences follow you instead of staying in one browser.',
                'Passwords are handled by Supabase Auth and are never stored by the site.',
                'Browser-only accounts remain the fallback when Supabase is not configured.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'Accounts work without Supabase',
            items: [
                'Sign-up and sign-in no longer fail with “online accounts are temporarily unavailable” when no Supabase project is connected.',
                'Browser-only accounts use salted PBKDF2 password hashes stored on this device.',
                'Adding a Supabase URL and anon key in js/auth-config.js switches the same screens back to online accounts and sync.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'Site updates page added',
            items: [
                'New UPDATES tab collects every change to the site in one place.',
                'This changelog is now kept current with each update.'
            ]
        },
        {
            date: '2026-11-07',
            title: 'COD Nazi Zombies added to the catalog',
            items: [
                'The old COD Nazi Zombies Portable card now runs the live NZ: Portable build from nzp.gay.',
                'Plays in the game overlay with solo and co-op modes, powered by WebGL.'
            ]
        },
        {
            date: '2026-11-06',
            title: 'Catalog health pass',
            items: [
                'Removed 60 games that no longer loaded, including 57 broken Flash pack dumps.',
                'Fixed 43 Flash game wrappers that were missing the player type.',
                'Moved 82 game embeds off a dead CDN onto a working one.',
                'Catalog verified at 653 entries: 652 public games plus the hidden secret game.'
            ]
        },
        {
            date: '2026-11-06',
            title: 'New default avatar',
            items: [
                'The gamepad icon is now a person silhouette styled to match the site theme.'
            ]
        },
        {
            date: '2026-11-06',
            title: 'Contact email updated',
            items: [
                'Recommendations now go to arrestmrmann@outlook.com in the hero and footer.'
            ]
        }
    ];

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        var date = new Date(iso + 'T12:00:00');
        if (isNaN(date.getTime()))
            return iso;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function render() {
        var list = document.getElementById('updatesList');
        if (!list)
            return;

        var sorted = updates.slice().sort(function (a, b) {
            return b.date.localeCompare(a.date);
        });

        list.innerHTML = sorted.map(function (update, index) {
            var items = update.items.map(function (item) {
                return '<li>' + escapeHtml(item) + '</li>';
            }).join('');
            return '<article class="update-entry' + (index === 0 ? ' is-latest' : '') + '">' +
                '<time class="update-date" datetime="' + escapeHtml(update.date) + '">' +
                escapeHtml(formatDate(update.date)) + '</time>' +
                '<div class="update-card"><h3>' + escapeHtml(update.title) +
                (index === 0 ? '<span class="update-badge">Latest</span>' : '') +
                '</h3><ul>' + items + '</ul></div></article>';
        }).join('');
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', render);
    else
        render();
})();
