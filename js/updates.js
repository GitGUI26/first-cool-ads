(function () {
    'use strict';

    // Add a new entry at the top of this array every time the site changes.
    // Dates are ISO (YYYY-MM-DD); entries are rendered newest first.
    var updates = [
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
