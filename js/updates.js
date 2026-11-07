(function () {
    'use strict';

    // Add a new entry at the top of this array every time the site changes.
    // Dates are ISO (YYYY-MM-DD); entries are rendered newest first.
    var updates = [
        {
            date: '2026-11-07',
            title: 'Faster, shareable, and personal',
            items: [
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
