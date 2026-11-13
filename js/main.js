// @ts-nocheck
// Legacy global browser script migrated to TypeScript.
let typedKeys = '';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let favorites = [];
let gameOverlayReturnFocus = null;
try {
    const storedFavorites = JSON.parse(localStorage.getItem('gameFavorites'));
    if (Array.isArray(storedFavorites))
        favorites = storedFavorites.filter(title => typeof title === 'string');
}
catch (error) {
    favorites = [];
}
const secretCode = 'epstein';
let secretUnlocked = false;
document.addEventListener('keydown', function (e) {
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        typedKeys += e.key.toLowerCase();
        if (typedKeys.length > secretCode.length) {
            typedKeys = typedKeys.slice(-secretCode.length);
        }
        if (typedKeys.includes(secretCode) && !secretUnlocked) {
            secretUnlocked = true;
            const secretGame = games.find(game => game.secret);
            if (secretGame) {
                openLesson(secretGame.title, secretGame.url);
                setTimeout(() => {
                    secretUnlocked = false;
                    typedKeys = '';
                }, 10000);
            }
        }
    }
});
function performSearch(searchTerm) {
    const allContainer = document.getElementById('allLessonsGrid');
    if (!allContainer) return;

    const searchTermLower = normalizeText(searchTerm);
    const allCards = Array.from(allContainer.querySelectorAll('.lesson-card'));
    const searchableCards = allCards.filter(card => card.getAttribute('data-random-game') !== 'true');
    const cardsWithScores = [];

    allCards.forEach(card => {
        const titleEl = card.querySelector('.lesson-title');
        let title = titleEl ? titleEl.textContent : '';
        title = normalizeText(title);
        const description = normalizeText(card.getAttribute('data-game-desc') || '');

        let matchScore = 0;

        if (searchTermLower === '') {
            matchScore = 1;
        } else {
            if (title === searchTermLower) {
                matchScore = 100;
            }
            else if (title.startsWith(searchTermLower)) {
                matchScore = 90;
            }
            else if (title.split(/\s+/).includes(searchTermLower)) {
                matchScore = 80;
            }
            else if (title.includes(searchTermLower)) {
                matchScore = 70;
            }
            else if (description.includes(searchTermLower)) {
                matchScore = 40;
            }
            else if (searchTermLower.length >= 3 && isFuzzyMatch(title, searchTermLower)) {
                matchScore = 30;
            }
        }

        cardsWithScores.push({
            card: card,
            score: matchScore,
            title: title
        });
    });

    cardsWithScores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.title.localeCompare(b.title);
    });

    allCards.forEach(card => {
        card.style.display = 'none';
    });

    let visibleCount = 0;
    cardsWithScores.forEach(item => {
        if (item.score > 0 && (searchTermLower || item.card.getAttribute('data-random-game') !== 'true')) {
            item.card.style.display = 'block';
            allContainer.appendChild(item.card);
            visibleCount++;
        }
    });

    const existingEmpty = allContainer.querySelector('.search-empty');
    if (existingEmpty)
        existingEmpty.remove();
    if (searchTermLower && visibleCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'search-empty';
        empty.innerHTML = '<i class="fas fa-ghost" aria-hidden="true"></i><h3>No games found</h3>' +
            '<p>Nothing matched “' + escapeHtml(searchTerm) + '”. Try a shorter title or browse the full library.</p>' +
            '<button type="button">Clear search</button>';
        empty.querySelector('button').addEventListener('click', function () {
            const input = document.getElementById('searchInput');
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            }
        });
        allContainer.appendChild(empty);
    }
    const searchStats = document.getElementById('searchStats');
    if (searchStats) {
        const totalCount = searchableCards.length;
        if (searchTermLower === '') {
            searchStats.textContent = `Showing ${totalCount} games`;
        } else {
            searchStats.textContent = `Found ${visibleCount} of ${totalCount} games for "${String(searchTerm || '').trim()}"`;
        }
    }
    if (typeof placeInFeedAd === 'function') {
        placeInFeedAd();
    }
}

function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[''""`]/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
}

function isFuzzyMatch(title, searchTerm) {
    if (searchTerm.length < 3) return false;
    
    const searchWords = searchTerm.split(/\s+/);
    const titleWords = title.split(/\s+/);
    
    for (const searchWord of searchWords) {
        if (searchWord.length < 3) continue;
        
        for (const titleWord of titleWords) {
            if (Math.abs(titleWord.length - searchWord.length) > 1) continue;
            
            if (isWordVerySimilar(titleWord, searchWord)) {
                return true;
            }
        }
    }
    return false;
}

function isWordVerySimilar(word1, word2) {
    if (word1 === word2) return true;
    if (Math.abs(word1.length - word2.length) > 1) return false;
    
    let differences = 0;
    const maxLen = Math.max(word1.length, word2.length);
    
    for (let i = 0; i < maxLen; i++) {
        if (word1[i] !== word2[i]) {
            differences++;
            if (differences > 1) return false;
        }
    }
    
    return differences === 1;
}
function toggleFullscreen() {
    const activeTab = getActiveGameTab();
    if (!activeTab || !activeTab.frame)
        return;
    const frame = activeTab.frame;
    const enteringFullscreen = !getFullscreenElementCompat();
    if (typeof gtag !== 'undefined') {
        gtag('event', enteringFullscreen ? 'fullscreen_enter' : 'fullscreen_exit', {
            'event_category': 'game_interaction',
            'event_label': activeTab.title,
            'value': 1
        });
    }
    if (enteringFullscreen) {
        if (frame.requestFullscreen) {
            frame.requestFullscreen();
        }
        else if (frame.webkitRequestFullscreen) {
            frame.webkitRequestFullscreen();
        }
        else if (frame.msRequestFullscreen) {
            frame.msRequestFullscreen();
        }
        else if (frame.mozRequestFullScreen) {
            frame.mozRequestFullScreen();
        }
        frame.classList.add('fullscreen');
    }
    else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
        frame.classList.remove('fullscreen');
    }
}
async function downloadCurrentGame() {
    const activeTab = getActiveGameTab();
    if (!activeTab || !activeTab.frame)
        return;
    const frame = activeTab.frame;
    const title = activeTab.title;
    const sourceUrl = activeTab.url || (games.find(game => game.title === title) || {}).url;
    const currentUrl = frame.src;
    const currentSrcDoc = frame.srcdoc;
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download_attempt', {
            'event_category': 'game_interaction',
            'event_label': title,
            'value': 1
        });
    }
    try {
        let content = '';
        if (sourceUrl && currentSrcDoc && currentSrcDoc.includes('<!DOCTYPE')) {
            const response = await fetch(sourceUrl);
            if (!response.ok)
                throw new Error('Network response was not ok');
            content = await response.text();
        }
        else if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.includes('loading')) {
            const response = await fetch(currentUrl);
            if (!response.ok)
                throw new Error('Network response was not ok');
            content = await response.text();
        }
        else if (sourceUrl) {
            const response = await fetch(sourceUrl);
            if (!response.ok)
                throw new Error('Network response was not ok');
            content = await response.text();
        }
        else {
            throw new Error('No source URL available for active tab');
        }
        if (content && !content.includes('cools-watermark')) {
            content = injectWatermark(content, title);
        }
        const blob = new Blob([content], { type: 'text/html' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 100);
        if (typeof gtag !== 'undefined') {
            gtag('event', 'download_success', {
                'event_category': 'game_interaction',
                'event_label': title,
                'value': 1
            });
        }
    }
    catch (error) {
        console.error('Download error:', error);
        if (typeof gtag !== 'undefined') {
            gtag('event', 'download_error', {
                'event_category': 'game_interaction',
                'event_label': title,
                'value': 1
            });
        }
        alert('Unable to download this game. Try another one or use the main site to download.');
    }
}
function injectWatermark(htmlContent, gameTitle) {
    htmlContent = htmlContent.replace(/<script[^>]*src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js[^>]*><\/script>/gi, '');
    htmlContent = htmlContent.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net\/npm\/vanta@[^>]*><\/script>/gi, '');
    htmlContent = htmlContent.replace(/<div[^>]*id="vanta-bg"[^>]*>.*?<\/div>/gis, '');
    htmlContent = htmlContent.replace(/<div[^>]*class="loading-content"[^>]*>.*?<\/div>/gis, '');
    const watermarkHTML = `
		                        <!-- Downloaded From Cool Tutoring Hub -->
		                        <style>
		                            @keyframes subtleGlow {
		                                0%, 100% { box-shadow: 0 0 10px rgba(124, 140, 255, 0.4) !important; }
		                                50% { box-shadow: 0 0 20px rgba(124, 140, 255, 0.6) !important; }
		                            }
		                        <\/style>
		                        <div id="cools-watermark"
		                             style="
		                                all: initial !important;
		                                position: fixed !important;
		                                bottom: 10px !important;
		                                right: 10px !important;
		                                background: rgba(0, 0, 0, 0.85) !important;
		                                color: #7c8cff !important;
		                                padding: 8px 12px !important;
		                                border-radius: 5px !important;
		                                font-family: 'Courier New', monospace !important;
		                                font-size: 12px !important;
		                                z-index: 2147483647 !important;
		                                border: 1px solid #7c8cff !important;
		                                opacity: 0.9 !important;
		                                pointer-events: auto !important;
		                                cursor: pointer !important;
		                                display: flex !important;
		                                align-items: center !important;
		                                gap: 8px !important;
		                                backdrop-filter: blur(4px) !important;
		                                box-shadow: 0 0 15px rgba(124, 140, 255, 0.4) !important;
		                                animation: subtleGlow 3s ease-in-out infinite !important;
		                                user-select: none !important;
		                            ">
		                            <img src="cuh.png"
		                                 alt="Cool Tutoring Hub"
		                                 style="width: 16px !important; height: 16px !important; border-radius: 3px !important; pointer-events: none !important;">
		                            <span style="pointer-events: none !important;">Downloaded from Cool Tutoring Hub<\/span>
		                        <\/div>
		                        <script>
		                            (function() {
		                                var gameTitle = "${gameTitle}";

		                                function protectWatermark() {
		                                    const watermark = document.getElementById('cools-watermark');
		                                    if (!watermark && document.body) {
		                                        location.reload();
		                                    }
		                                }
		                                
		                                setInterval(protectWatermark, 1000);
		                                
		                                console.log('%c🎮 Game: "' + gameTitle + '"', 'color: #7c8cff; font-weight: bold;');
		                                console.log('%c📚 Downloaded from Cool Tutoring Hub', 'color: #22d3ee;');
		                            })();
		                        <\/script>
		                    `;
    const bodyEndIndex = htmlContent.lastIndexOf('<\/body>');
    if (bodyEndIndex !== -1) {
        htmlContent = htmlContent.substring(0, bodyEndIndex) +
            watermarkHTML +
            htmlContent.substring(bodyEndIndex);
    }
    else {
        htmlContent += watermarkHTML;
    }
    return htmlContent;
}
const style = document.createElement('style');
style.textContent = '@keyframes subtleGlow { 0%, 100% { box-shadow: 0 0 10px rgba(124, 140, 255, 0.4) !important; } 50% { box-shadow: 0 0 20px rgba(124, 140, 255, 0.6) !important; } } #cools-watermark { animation: subtleGlow 3s ease-in-out infinite !important; } #cools-watermark:hover { animation: none !important; box-shadow: 0 0 25px rgba(124, 140, 255, 0.8) !important; }';
document.head.appendChild(style);
function generateGameCards() {
    const allContainer = document.getElementById('allLessonsGrid');
    if (!allContainer)
        return;
    const visibleGames = games.filter(game => !game.secret);
    allContainer.innerHTML = '';
    originalGamesOrder = [...visibleGames];
    applySorting();
    initCursorHover();
    startImageFlash();
}
function getRandomGame() {
    const pool = games.filter(game => !game.secret);
    return pool[Math.floor(Math.random() * pool.length)] || games[Math.floor(Math.random() * games.length)];
}
let gameSlugIndex = null;
function baseGameSlug(title) {
    return String(title || '').toLowerCase().trim()
        .replace(/[\u2018\u2019']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function getGameSlugIndex() {
    if (gameSlugIndex)
        return gameSlugIndex;
    const groups = new Map();
    games.forEach(game => {
        if (game.secret)
            return;
        const base = baseGameSlug(game.title);
        const group = groups.get(base);
        if (group)
            group.push(game);
        else
            groups.set(base, [game]);
    });
    const byTitle = new Map();
    const bySlug = new Map();
    groups.forEach((group, base) => {
        group.forEach((game, index) => {
            const slug = group.length === 1 ? base : base + '-' + (index + 1);
            byTitle.set(game.title, slug);
            bySlug.set(slug, game);
        });
    });
    gameSlugIndex = { byTitle, bySlug };
    return gameSlugIndex;
}
function gameSlug(title) {
    if (!title)
        return '';
    return getGameSlugIndex().byTitle.get(title) || '';
}
function findGameBySlug(slug) {
    if (!slug)
        return null;
    return getGameSlugIndex().bySlug.get(slug) || null;
}
function gameHashSlug() {
    const raw = String(location.hash || '').replace(/^#/, '');
    if (!raw.startsWith('game='))
        return '';
    try {
        return decodeURIComponent(raw.slice(5));
    }
    catch (error) {
        return '';
    }
}
function gameHistorySlug() {
    const state = history.state;
    return state && typeof state === 'object' && typeof state.game === 'string'
        ? state.game
        : '';
}
function hasLegacyGameLocation() {
    return new URLSearchParams(location.search).has('game') || /^#game=/.test(location.hash);
}
function gameUrlWithoutTarget() {
    const next = new URL(location.href);
    next.searchParams.delete('game');
    next.hash = '';
    return next;
}
function syncGameUrl(title, options = {}) {
    if (options.syncUrl === false)
        return;
    const game = games.find(item => item.title === title);
    if (game && game.secret)
        return;
    const slug = gameSlug(title);
    if (!slug)
        return;
    if (gameHistorySlug() === slug && !hasLegacyGameLocation())
        return;
    const next = gameUrlWithoutTarget();
    const state = Object.assign({}, history.state);
    state.game = slug;
    try {
        history[options.replaceUrl ? 'replaceState' : 'pushState'](state, '', next);
    }
    catch (error) {
    }
}
function clearGameUrl(mode = 'push') {
    if (!gameHistorySlug() && !hasLegacyGameLocation())
        return;
    const next = gameUrlWithoutTarget();
    const state = Object.assign({}, history.state);
    delete state.game;
    try {
        history[mode === 'replace' ? 'replaceState' : 'pushState'](state, '', next);
    }
    catch (error) {
    }
}
function recordRecentGame(title, url) {
    if (!title)
        return;
    try {
        const stored = JSON.parse(localStorage.getItem('recentGames'));
        const recent = Array.isArray(stored)
            ? stored.filter(entry => entry && entry.title !== title)
            : [];
        recent.unshift({ title: title, url: url || '' });
        localStorage.setItem('recentGames', JSON.stringify(recent.slice(0, 12)));
    }
    catch (error) {
    }
}
function getRecentGames() {
    try {
        const stored = JSON.parse(localStorage.getItem('recentGames'));
        return Array.isArray(stored) ? stored : [];
    }
    catch (error) {
        return [];
    }
}
function updateFavoriteHearts(title, isFavorite) {
    document.querySelectorAll('.card-favorite').forEach(function (heart) {
        if (heart.dataset.gameTitle !== title)
            return;
        heart.classList.toggle('is-favorite', isFavorite);
        heart.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
        heart.setAttribute('aria-label', (isFavorite ? 'Remove ' : 'Add ') + title + (isFavorite ? ' from' : ' to') + ' favorites');
        heart.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    });
}
function syncGameFavoriteButton() {
    const button = document.getElementById('gameFavoriteBtn');
    if (!button)
        return;
    const active = getActiveGameTab();
    const isFavorite = Boolean(active && favorites.indexOf(active.title) !== -1);
    button.classList.toggle('is-favorite', isFavorite);
    button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    button.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    button.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
}
function syncGameOpenRawButton() {
    const link = document.getElementById('gameOpenRaw');
    if (!link)
        return;
    const active = getActiveGameTab();
    if (active && active.url) {
        link.href = active.url;
        link.setAttribute('aria-disabled', 'false');
        link.removeAttribute('tabindex');
    }
    else {
        link.href = '#';
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
    }
}
function toggleFavorite(title, button) {
    const index = favorites.indexOf(title);
    const isNowFavorite = index === -1;
    if (isNowFavorite)
        favorites.push(title);
    else
        favorites.splice(index, 1);
    try {
        localStorage.setItem('gameFavorites', JSON.stringify(favorites));
    }
    catch (error) {
    }
    updateFavoriteHearts(title, isNowFavorite);
    syncGameFavoriteButton();
}
function toggleCurrentGameFavorite() {
    const active = getActiveGameTab();
    if (!active)
        return;
    toggleFavorite(active.title);
}
function openRandomGame() {
    const pick = getRandomGame();
    if (pick) {
        openLesson(pick.title, pick.url);
    }
}
function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
}
function setSiteLogos(src) {
    document.querySelectorAll('.logo, .home-logo').forEach(logoEl => {
        logoEl.dataset.baseSrc = src;
        logoEl.src = src;
    });
    syncLogoThemeTone();
}
function gameCardMarkup(game, isRandom = false) {
    const displayTitle = isRandom ? 'Random' : game.title;
    const innerTag = isRandom ? 'div' : 'a';
    const linkAttributes = isRandom ? '' : ` href="${escapeHtml('#game=' + encodeURIComponent(gameSlug(game.title)))}" aria-label="Play ${escapeHtml(game.title)}"`;
    const isFavorite = !isRandom && favorites.indexOf(game.title) !== -1;
    const favoriteLabel = (isFavorite ? 'Remove ' : 'Add ') + game.title + (isFavorite ? ' from' : ' to') + ' favorites';
    const cardTitle = isRandom ? 'Let fate pick your next game' : game.title + (game.desc ? ' — ' + game.desc : '');
    const cardAttributes = isRandom
        ? ' data-random-game="true" tabindex="0" role="button" aria-label="Play a random game"'
        : ` data-game-title="${escapeHtml(game.title)}" data-game-url="${escapeHtml(game.url)}" data-game-desc="${escapeHtml(game.desc || '')}"`;
    return `<${isRandom ? 'div' : 'article'} class="lesson-card${isRandom ? ' lesson-card-random' : ''}"${cardAttributes} title="${escapeHtml(cardTitle)}">
    <${innerTag} class="card-inner"${linkAttributes}>
      <div class="card-cover">
        <img src="${escapeHtml(game.image)}" alt="${escapeHtml(displayTitle)} cover art" class="lesson-image${isRandom ? ' flash-image' : ''}" width="640" height="360" loading="${isRandom ? 'eager' : 'lazy'}" decoding="async"${isRandom ? ' fetchpriority="high"' : ''}>
        ${isRandom ? '<span class="card-badge card-badge-random">Random</span>' : (game.tag ? `<span class="card-badge">${escapeHtml(game.tag)}</span>` : '')}
        <div class="card-play" aria-hidden="true"></div>
      </div>
      <div class="card-body">
        <h3 class="lesson-title">${escapeHtml(displayTitle)}</h3>
      </div>
    </${innerTag}>
    ${isRandom ? '' : `<button class="card-favorite${isFavorite ? ' is-favorite' : ''}" type="button" data-game-title="${escapeHtml(game.title)}" aria-pressed="${isFavorite ? 'true' : 'false'}" aria-label="${escapeHtml(favoriteLabel)}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}"></button>`}
  </${isRandom ? 'div' : 'article'}>`;
}
function bindLessonGridEvents(grid) {
    if (!grid || grid.dataset.cardEvents === '1')
        return;
    grid.dataset.cardEvents = '1';
    grid.addEventListener('click', function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target)
            return;
        const favorite = target.closest('.card-favorite');
        if (favorite && grid.contains(favorite)) {
            event.preventDefault();
            event.stopPropagation();
            toggleFavorite(favorite.dataset.gameTitle, favorite);
            return;
        }
        const randomCard = target.closest('.lesson-card[data-random-game="true"]');
        if (randomCard && grid.contains(randomCard)) {
            event.preventDefault();
            openRandomGame();
            return;
        }
        const link = target.closest('a.card-inner');
        if (!link || !grid.contains(link))
            return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const card = link.closest('.lesson-card');
        if (!card || !card.dataset.gameTitle || !card.dataset.gameUrl)
            return;
        event.preventDefault();
        openLesson(card.dataset.gameTitle, card.dataset.gameUrl);
    });
    grid.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ')
            return;
        const randomCard = event.target instanceof Element ? event.target.closest('.lesson-card[data-random-game="true"]') : null;
        if (!randomCard)
            return;
        event.preventDefault();
        openRandomGame();
    });
}
function startHomeCarouselAutoplay(carousel) {
    if (!carousel)
        return;
    const track = carousel.querySelector('.home-carousel-track');
    if (!track || prefersReducedMotion || document.body.classList.contains('reduce-motion') ||
        localStorage.getItem('carouselAutoplay') === 'false')
        return;
    const cardCount = Math.max(1, Math.floor(track.querySelectorAll('.home-carousel-card').length / 2));
    const duration = Math.max(18, cardCount * 3.2);
    if (!carousel.dataset.cycleBound) {
        carousel.addEventListener('mouseenter', () => {
            const currentTrack = carousel.querySelector('.home-carousel-track');
            if (currentTrack)
                currentTrack.style.animationPlayState = 'paused';
        });
        carousel.addEventListener('mouseleave', () => {
            const currentTrack = carousel.querySelector('.home-carousel-track');
            if (currentTrack)
                currentTrack.style.animationPlayState = 'running';
        });
        carousel.dataset.cycleBound = '1';
    }
    const animationName = ensureVersionedCarouselAnimation();
    track.style.animation = 'none';
    track.style.transform = 'translateX(0)';
    void track.offsetWidth;
    track.style.animation = `${animationName} ${duration}s linear infinite`;
    track.style.animationPlayState = 'running';
}
function ensureVersionedCarouselAnimation() {
    const animationName = 'daily-games-scroll';
    const styleId = 'daily-games-scroll-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes ${animationName} {
            from { transform: translateX(0) }
            to { transform: translateX(-50%) }
          }
        `;
        document.head.appendChild(style);
    }
    return animationName;
}
let fadeObserver = null;
function initFadeObserver() {
    if (fadeObserver) {
        fadeObserver.disconnect();
        fadeObserver = null;
    }
    const cards = document.querySelectorAll('.lesson-card');
    if (cards.length === 0)
        return;
    fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
            else {
                entry.target.classList.remove('fade-in');
            }
        });
    }, { threshold: 0.1 });
    cards.forEach(card => fadeObserver.observe(card));
}
function initHomeLogoTilt() {
    const wrap = document.getElementById('homeLogoWrap');
    const logo = wrap ? wrap.querySelector('.home-logo') : null;
    const shine = document.getElementById('homeLogoShine');
    if (!wrap || !logo || !shine)
        return;
    wrap.addEventListener('mousemove', (event) => {
        const rect = wrap.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rotateY = (px - 0.5) * 14;
        const rotateX = (0.5 - py) * 14;
        const dx = px - 0.5;
        const dy = py - 0.5;
        const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.7071);
        const glowAlpha = (0.16 + dist * 0.46).toFixed(3);
        const glowOpacity = (0.40 + dist * 0.50).toFixed(3);
        const glowBlur = `${Math.round(12 + dist * 20)}px`;
        const shineOpacity = (0.22 + dist * 0.34).toFixed(3);
        logo.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        wrap.style.setProperty('--glow-x', `${Math.round(px * 100)}%`);
        wrap.style.setProperty('--glow-y', `${Math.round(py * 100)}%`);
        wrap.style.setProperty('--glow-alpha', glowAlpha);
        wrap.style.setProperty('--glow-opacity', glowOpacity);
        wrap.style.setProperty('--glow-blur', glowBlur);
        shine.style.opacity = shineOpacity;
        shine.style.background = `radial-gradient(circle at ${Math.round(px * 100)}% ${Math.round(py * 100)}%, rgba(255, 255, 255, 0.26) 0%, transparent 42%)`;
    });
    wrap.addEventListener('mouseleave', () => {
        logo.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        wrap.style.setProperty('--glow-x', '50%');
        wrap.style.setProperty('--glow-y', '50%');
        wrap.style.setProperty('--glow-alpha', '0.16');
        wrap.style.setProperty('--glow-opacity', '0.40');
        wrap.style.setProperty('--glow-blur', '12px');
        shine.style.opacity = '0';
    });
}
function buildHomePopularCarousel() {
    const carousel = document.getElementById('homePopularCarousel');
    if (!carousel || !Array.isArray(games))
        return;
    const requiredTitles = ['Balatro', 'Cloverpit', 'Peaks of Yore', 'Untitled Goose Game'];
    const selectedRequired = requiredTitles
        .map(title => games.find(game => game.title === title))
        .filter(Boolean);
    const selectedPopular = games.filter(game => game.popular && !game.secret).slice(0, 8);
    const selected = [...new Map([...selectedRequired, ...selectedPopular].map(game => [game.title, game])).values()];
    const pool = games.filter(game => !game.secret && !selected.some(chosen => chosen.title === game.title) && game.image && game.url);
    const randomExtras = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(3, 9 - selected.length));
    const cycleGames = [...selected, ...randomExtras].slice(0, 9);
    const renderGames = [...cycleGames, ...cycleGames];
    carousel.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'home-carousel-track';
    const gapPx = 14;
    const visibleCards = window.innerWidth <= 640 ? 1 : (window.innerWidth <= 1024 ? 2 : 3);
    const cardWidth = Math.max(220, Math.floor((carousel.clientWidth - (gapPx * (visibleCards - 1))) / visibleCards));
    renderGames.forEach(game => {
        const card = document.createElement('button');
        card.className = 'home-carousel-card';
        card.type = 'button';
        card.style.flex = `0 0 ${cardWidth}px`;
        card.innerHTML = `
          <img src="${game.image}" alt="${game.title}">
          <div class="home-carousel-body">
            <div class="home-carousel-title">${game.title}</div>
            <div class="home-carousel-desc">${game.desc}</div>
          </div>
        `;
        card.addEventListener('click', () => openLesson(game.title, game.url));
        track.appendChild(card);
    });
    carousel.appendChild(track);
    startHomeCarouselAutoplay(carousel);
}
function updateGameCounts() {
    const total = games.filter(game => !game.secret).length;
    document.querySelectorAll('[data-game-count]').forEach(function (element) {
        element.textContent = String(total);
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = `Search ${total} games...`;
    }
}
function setupSearchClear() {
    const input = document.getElementById('searchInput');
    const clear = document.getElementById('searchClear');
    if (!input || !clear)
        return;
    const sync = function () {
        clear.hidden = input.value.length === 0;
    };
    input.addEventListener('input', sync);
    clear.addEventListener('click', function () {
        input.value = '';
        sync();
        if (typeof applySorting === 'function') {
            applySorting();
        }
        input.focus();
    });
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && input.value) {
            input.value = '';
            sync();
            if (typeof applySorting === 'function') {
                applySorting();
            }
        }
    });
    document.addEventListener('keydown', function (event) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
            event.preventDefault();
            input.focus();
        }
    });
    sync();
}
function updateSearchStats() {
    const allContainer = document.getElementById('allLessonsGrid');
    if (!allContainer)
        return;
    const nonRandomCards = document.querySelectorAll('#allLessonsGrid .lesson-card:not([data-random-game="true"])');
    const searchStats = document.getElementById('searchStats');
    if (searchStats) {
        searchStats.textContent = `Showing ${nonRandomCards.length} games`;
    }
}
function initCursorHover() {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor || document.documentElement.dataset.cardCursorBound === '1')
        return;
    document.documentElement.dataset.cardCursorBound = '1';
    document.addEventListener('mouseover', function (event) {
        const card = event.target instanceof Element ? event.target.closest('.lesson-card') : null;
        if (card)
            cursor.classList.add('hover');
    });
    document.addEventListener('mouseout', function (event) {
        const card = event.target instanceof Element ? event.target.closest('.lesson-card') : null;
        const nextCard = event.relatedTarget instanceof Element ? event.relatedTarget.closest('.lesson-card') : null;
        if (card && nextCard !== card)
            cursor.classList.remove('hover');
    });
}
window.pageLoadTime = Date.now();
window.matrixColor = '#7c8cff';
const canvas = document.getElementById('matrix-bg');
const ctx = canvas ? canvas.getContext('2d') : null;
const pathsLayer = document.getElementById('paths-layer');
const starfieldLayer = document.getElementById('starfield-layer');
const backgroundGlow = document.getElementById('background-glow');
const backgroundState = {
    active: 'matrix',
    animationFrame: null,
    resizeTimeout: null,
    boostUntil: 0,
    lastRenderAt: 0,
    starfieldBoostTimeout: null,
    starfieldEnabled: false,
    matrix: { drops: [], columns: 0, fontSize: 14, resetFrames: 0, lastColorKey: '' },
    paths: { items: [], colorKey: '' },
    topography: { tick: 0 },
    constellation: { nodes: [], mouseX: -1000, mouseY: -1000, initialized: false },
};
function hexToRgbObject(hex) {
    const cleanHex = (hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(cleanHex))
        return { r: 124, g: 140, b: 255 };
    return {
        r: parseInt(cleanHex.slice(0, 2), 16),
        g: parseInt(cleanHex.slice(2, 4), 16),
        b: parseInt(cleanHex.slice(4, 6), 16)
    };
}
function rgbStringToObject(rgbValue) {
    const parts = (rgbValue || '').match(/\d+/g);
    if (!parts || parts.length < 3)
        return null;
    return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) };
}
function getThemePrimaryColor() {
    const cssColor = getComputedStyle(document.body)
        .getPropertyValue('--primary-accent')
        .trim();
    if (!cssColor)
        return '#7c8cff';
    if (cssColor.startsWith('#'))
        return cssColor;
    const parsedRgb = rgbStringToObject(cssColor);
    if (!parsedRgb)
        return '#7c8cff';
    return `#${[parsedRgb.r, parsedRgb.g, parsedRgb.b]
        .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
        .join('')}`;
}
function getBackgroundColorRGB() {
    return hexToRgbObject(getThemePrimaryColor());
}
function getBackgroundBoost(now = performance.now()) {
    return now < backgroundState.boostUntil ? 2.6 : 1;
}
function syncBackgroundGlow() {
    if (!backgroundGlow)
        return;
    const { r, g, b } = getBackgroundColorRGB();
    backgroundGlow.style.background = `radial-gradient(circle at 50% 45%, rgba(${r}, ${g}, ${b}, 0.2) 0%, rgba(${r}, ${g}, ${b}, 0.09) 35%, transparent 72%)`;
}
function resizeBackgroundCanvas() {
    if (!canvas || !ctx)
        return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function clearBackgroundCanvas() {
    if (!canvas || !ctx)
        return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}
function stopBackgroundLoop() {
    if (backgroundState.animationFrame) {
        cancelAnimationFrame(backgroundState.animationFrame);
        backgroundState.animationFrame = null;
    }
}
function normalizeBackgroundStyle(style) {
    const allowed = ['matrix', 'topography', 'constellation', 'starfield'];
    return allowed.includes(style) ? style : 'matrix';
}
function initMatrixDrops(forceReset = false) {
    if (!canvas)
        return;
    const fontSize = backgroundState.matrix.fontSize;
    backgroundState.matrix.columns = Math.max(1, Math.floor(window.innerWidth / fontSize));
    backgroundState.matrix.drops = Array.from({ length: backgroundState.matrix.columns }, () => Math.floor((Math.random() * window.innerHeight) / fontSize));
    if (forceReset) {
        backgroundState.matrix.resetFrames = 14;
    }
}
function renderMatrixBackground(now) {
    if (!canvas || !ctx)
        return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { r, g, b } = getBackgroundColorRGB();
    const colorKey = `${r},${g},${b}`;
    if (!backgroundState.matrix.drops.length || backgroundState.matrix.columns !== Math.max(1, Math.floor(width / backgroundState.matrix.fontSize))) {
        initMatrixDrops();
    }
    if (backgroundState.matrix.lastColorKey !== colorKey) {
        backgroundState.matrix.lastColorKey = colorKey;
        backgroundState.matrix.resetFrames = Math.max(backgroundState.matrix.resetFrames, 22);
        initMatrixDrops();
        ctx.clearRect(0, 0, width, height);
    }
    const trailR = Math.max(2, Math.round(r * 0.1));
    const trailG = Math.max(2, Math.round(g * 0.1));
    const trailB = Math.max(2, Math.round(b * 0.1));
    const clearingAlpha = backgroundState.matrix.resetFrames > 0 ? 0.46 : 0.1;
    ctx.fillStyle = `rgba(${trailR}, ${trailG}, ${trailB}, ${clearingAlpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgb(${Math.min(255, r + 14)}, ${Math.min(255, g + 14)}, ${Math.min(255, b + 14)})`;
    ctx.font = `${backgroundState.matrix.fontSize}px monospace`;
    const chars = ['0', '1'];
    const advance = 1.06;
    for (let i = 0; i < backgroundState.matrix.drops.length; i++) {
        const text = chars[(Math.random() * chars.length) | 0];
        const y = backgroundState.matrix.drops[i] * backgroundState.matrix.fontSize;
        ctx.fillText(text, i * backgroundState.matrix.fontSize, y);
        if (y > height && Math.random() > 0.972) {
            backgroundState.matrix.drops[i] = 0;
        }
        else {
            backgroundState.matrix.drops[i] += advance;
        }
    }
    if (backgroundState.matrix.resetFrames > 0) {
        backgroundState.matrix.resetFrames -= 1;
    }
}
function updateBackgroundSelectionUI() {
    document.querySelectorAll('.background-option').forEach(option => {
        option.classList.toggle('active', option.dataset.background === backgroundState.active);
    });
}
function ensurePathSvg() {
    if (!pathsLayer)
        return;
    const { r, g, b } = getBackgroundColorRGB();
    const colorKey = `${r},${g},${b}`;
    if (backgroundState.paths.items.length && backgroundState.paths.colorKey === colorKey)
        return;
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 696 316');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const pathItems = [];
    const count = 28;
    const makePath = (position, i) => {
        const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;
        const path = document.createElementNS(svgNs, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', `rgb(${r}, ${g}, ${b})`);
        path.setAttribute('stroke-width', String(0.5 + i * 0.028));
        path.style.opacity = String(Math.min(0.9, 0.12 + i * 0.017));
        svg.appendChild(path);
        return {
            el: path,
            duration: 18 + (i % 9) * 1.4,
            baseOpacity: Math.min(0.9, 0.12 + i * 0.017),
            phase: (i / count) + (position < 0 ? 0.35 : 0),
        };
    };
    for (let i = 0; i < count; i++)
        pathItems.push(makePath(1, i));
    for (let i = 0; i < count; i++)
        pathItems.push(makePath(-1, i));
    pathsLayer.innerHTML = '';
    pathsLayer.appendChild(svg);
    backgroundState.paths.items = pathItems.map(item => ({
        ...item,
        length: Math.max(1, item.el.getTotalLength())
    }));
    backgroundState.paths.colorKey = colorKey;
}
function renderPathsBackground(now) {
    ensurePathSvg();
    const speed = getBackgroundBoost(now);
    const t = (now / 1000) * speed;
    for (const path of backgroundState.paths.items) {
        const phaseTime = (t / path.duration) + path.phase;
        const wave = 0.5 + 0.5 * Math.sin((phaseTime * Math.PI * 2) + path.phase * 4.7);
        const drawLen = path.length * (0.24 + wave * 0.53);
        path.el.style.strokeDasharray = `${drawLen} ${path.length}`;
        path.el.style.strokeDashoffset = `${-(phaseTime * path.length * 1.35)}`;
        path.el.style.opacity = String(Math.max(0.08, path.baseOpacity * (0.56 + wave * 0.78)));
    }
}
function renderTopographyBackground(now) {
    if (!canvas || !ctx)
        return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { r, g, b } = getBackgroundColorRGB();
    const speed = 1 + (getBackgroundBoost(now) - 1) * 0.55;
    backgroundState.topography.tick += 0.008 * speed;
    const t = backgroundState.topography.tick;
    ctx.fillStyle = 'rgb(5, 8, 12)';
    ctx.fillRect(0, 0, width, height);
    const lineCount = Math.max(24, Math.floor(height / 28));
    const spacing = height / (lineCount - 1);
    const padding = 80;
    const terrain = (x, phase) => Math.sin(x * 0.0032 + phase * 0.9) * 30 +
        Math.sin(x * 0.0058 + phase * 0.6) * 24 +
        Math.sin(x * 0.0019 - phase * 0.45) * 40 +
        Math.sin(x * 0.0074 + phase * 1.1) * 14;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.34)`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < lineCount; i++) {
        const baseY = spacing * i;
        ctx.beginPath();
        let started = false;
        for (let x = -padding; x <= width + padding; x += 2.6) {
            const y = baseY + terrain(x + i * 110, t);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            }
            else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.16)`;
    for (let i = 0; i < lineCount; i += 2) {
        const baseY = spacing * i + spacing * 0.35;
        ctx.beginPath();
        let started = false;
        for (let x = -padding; x <= width + padding; x += 3.4) {
            const y = baseY + terrain(x + i * 85, t * 0.83);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            }
            else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
}
function initConstellationNodes() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const count = Math.max(85, Math.min(165, Math.floor((width * height) / 13000)));
    backgroundState.constellation.nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        radius: 0.8 + Math.random() * 1.8
    }));
    backgroundState.constellation.initialized = true;
}
function renderConstellationBackground(now) {
    if (!canvas || !ctx)
        return;
    if (!backgroundState.constellation.initialized || !backgroundState.constellation.nodes.length) {
        initConstellationNodes();
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { r, g, b } = getBackgroundColorRGB();
    const boost = getBackgroundBoost(now);
    const nodes = backgroundState.constellation.nodes;
    const mouseRadius = 140;
    ctx.fillStyle = 'rgb(6, 9, 14)';
    ctx.fillRect(0, 0, width, height);
    for (const node of nodes) {
        const dxMouse = node.x - backgroundState.constellation.mouseX;
        const dyMouse = node.y - backgroundState.constellation.mouseY;
        const distMouse = Math.hypot(dxMouse, dyMouse);
        if (distMouse < mouseRadius && distMouse > 0) {
            const force = ((mouseRadius - distMouse) / mouseRadius) * 0.022 * boost;
            node.vx += (dxMouse / distMouse) * force;
            node.vy += (dyMouse / distMouse) * force;
        }
        node.x += node.vx * boost;
        node.y += node.vy * boost;
        node.vx *= 0.988;
        node.vy *= 0.988;
        node.vx += (Math.random() - 0.5) * 0.009;
        node.vy += (Math.random() - 0.5) * 0.009;
        if (node.x < 0 || node.x > width) {
            node.vx *= -1;
            node.x = Math.max(0, Math.min(width, node.x));
        }
        if (node.y < 0 || node.y > height) {
            node.vy *= -1;
            node.y = Math.max(0, Math.min(height, node.y));
        }
    }
    const connectionDistance = 140;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const distance = Math.hypot(dx, dy);
            if (distance < connectionDistance) {
                const alpha = (1 - distance / connectionDistance) * 0.55;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(nodes[i].x, nodes[i].y);
                ctx.lineTo(nodes[j].x, nodes[j].y);
                ctx.stroke();
            }
        }
    }
    ctx.globalAlpha = 1;
    for (const node of nodes) {
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4.2);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.28)`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
function loopBackground(now) {
    if (now - backgroundState.lastRenderAt < 1000 / 55) {
        backgroundState.animationFrame = requestAnimationFrame(loopBackground);
        return;
    }
    backgroundState.lastRenderAt = now;
    if (backgroundState.active === 'matrix') {
        renderMatrixBackground(now);
    }
    else if (backgroundState.active === 'topography') {
        renderTopographyBackground(now);
    }
    else if (backgroundState.active === 'constellation') {
        renderConstellationBackground(now);
    }
    backgroundState.animationFrame = requestAnimationFrame(loopBackground);
}
function startBackgroundLoop() {
    stopBackgroundLoop();
    backgroundState.lastRenderAt = 0;
    backgroundState.animationFrame = requestAnimationFrame(loopBackground);
}
function initStarfieldBackground() {
    if (!starfieldLayer || !window.Starfield)
        return false;
    try {
        starfieldLayer.innerHTML = '';
        const { r, g, b } = getBackgroundColorRGB();
        const diag = Math.hypot(window.innerWidth, window.innerHeight);
        Starfield.setup({
            container: starfieldLayer,
            auto: false,
            originX: window.innerWidth / 2,
            originY: window.innerHeight / 2,
            numStars: Math.max(500, Math.min(1050, Math.floor((window.innerWidth * window.innerHeight) / 2000))),
            baseSpeed: 1.22,
            trailLength: 0.92,
            starColor: `rgb(${Math.min(255, r + 26)}, ${Math.min(255, g + 26)}, ${Math.min(255, b + 26)})`,
            canvasColor: 'rgb(8, 12, 18)',
            hueJitter: 10,
            maxAcceleration: 12,
            accelerationRate: 0.28,
            decelerationRate: 0.22,
            minSpawnRadius: 30,
            maxSpawnRadius: Math.max(360, Math.min(920, diag * 0.55))
        });
        const starCanvas = starfieldLayer.querySelector('canvas');
        if (!starCanvas)
            throw new Error('Starfield canvas was not created');
        starCanvas.style.zIndex = '0';
        starCanvas.style.opacity = '0.95';
        backgroundState.starfieldEnabled = true;
        return true;
    }
    catch (error) {
        console.error('Starfield initialization failed:', error);
        backgroundState.starfieldEnabled = false;
        starfieldLayer.innerHTML = '';
        return false;
    }
}
function cleanupStarfieldBackground() {
    if (backgroundState.starfieldBoostTimeout) {
        clearTimeout(backgroundState.starfieldBoostTimeout);
        backgroundState.starfieldBoostTimeout = null;
    }
    if (window.Starfield && backgroundState.starfieldEnabled) {
        try {
            Starfield.cleanup();
        }
        catch (error) {
            console.warn('Starfield cleanup warning:', error);
        }
    }
    backgroundState.starfieldEnabled = false;
    if (starfieldLayer)
        starfieldLayer.innerHTML = '';
}
function triggerBackgroundBoost() {
    backgroundState.boostUntil = performance.now() + 420;
    if (backgroundState.active === 'starfield' && window.Starfield && backgroundState.starfieldEnabled) {
        Starfield.setAccelerate(true);
        if (backgroundState.starfieldBoostTimeout) {
            clearTimeout(backgroundState.starfieldBoostTimeout);
        }
        backgroundState.starfieldBoostTimeout = setTimeout(() => {
            if (window.Starfield)
                Starfield.setAccelerate(false);
        }, 520);
    }
}
function refreshActiveBackground() {
    resizeBackgroundCanvas();
    syncBackgroundGlow();
    if (backgroundState.active === 'matrix') {
        clearBackgroundCanvas();
        initMatrixDrops(true);
    }
    else {
        initMatrixDrops();
    }
    if (backgroundState.active === 'constellation') {
        initConstellationNodes();
    }
    if (backgroundState.active === 'starfield' && window.Starfield && backgroundState.starfieldEnabled) {
        const { r, g, b } = getBackgroundColorRGB();
        Starfield.config.starColor = `rgb(${r}, ${g}, ${b})`;
        Starfield.resize(window.innerWidth, window.innerHeight);
        Starfield.setOrigin(window.innerWidth / 2, window.innerHeight / 2);
    }
}
function applyBackgroundStyle(style, shouldPersist = true) {
    const nextStyle = normalizeBackgroundStyle(style);
    backgroundState.active = nextStyle;
    if (shouldPersist) {
        localStorage.setItem('selectedBackground', nextStyle);
    }
    updateBackgroundSelectionUI();
    syncBackgroundGlow();
    if (pathsLayer)
        pathsLayer.classList.remove('active');
    if (starfieldLayer)
        starfieldLayer.classList.toggle('active', nextStyle === 'starfield');
    if (canvas)
        canvas.style.opacity = (nextStyle === 'matrix' || nextStyle === 'topography' || nextStyle === 'constellation') ? '1' : '0';
    if (nextStyle === 'starfield') {
        stopBackgroundLoop();
        clearBackgroundCanvas();
        if (!initStarfieldBackground()) {
            applyBackgroundStyle('matrix', true);
            return;
        }
    }
    else {
        if (backgroundState.starfieldEnabled)
            cleanupStarfieldBackground();
        if (nextStyle === 'matrix') {
            backgroundState.boostUntil = 0;
            clearBackgroundCanvas();
            initMatrixDrops(true);
            startBackgroundLoop();
        }
        else if (nextStyle === 'constellation') {
            initConstellationNodes();
            startBackgroundLoop();
        }
        else {
            startBackgroundLoop();
        }
    }
}
window.setBackgroundStyle = function (style) {
    applyBackgroundStyle(style, true);
    if (typeof gtag !== 'undefined') {
        gtag('event', 'background_change', {
            'event_category': 'settings',
            'event_label': normalizeBackgroundStyle(style),
            'value': 1
        });
    }
};
document.addEventListener('mousemove', (event) => {
    backgroundState.constellation.mouseX = event.clientX;
    backgroundState.constellation.mouseY = event.clientY;
});
window.addEventListener('blur', () => {
    backgroundState.constellation.mouseX = -1000;
    backgroundState.constellation.mouseY = -1000;
});
document.addEventListener('pointerdown', (event) => {
    const interactive = event.target.closest('button, a, .nav-tab, .lesson-card, .apply-btn, .file-btn, .background-option, .theme-option, input, select, label');
    if (interactive)
        triggerBackgroundBoost();
});
let carouselResizeTimeout = null;
window.addEventListener('resize', () => {
    if (backgroundState.resizeTimeout)
        clearTimeout(backgroundState.resizeTimeout);
    backgroundState.resizeTimeout = setTimeout(() => {
        refreshActiveBackground();
    }, 90);
    if (carouselResizeTimeout)
        clearTimeout(carouselResizeTimeout);
    carouselResizeTimeout = setTimeout(() => {
        buildHomePopularCarousel();
    }, 120);
});
function getFullscreenElementCompat() {
    return document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        null;
}
function ensureNativeCursorState() {
    if (!getFullscreenElementCompat()) {
        const savedStyle = localStorage.getItem('cursorStyle') ||
            (localStorage.getItem('cursorEnabled') === 'false' ? 'default' : 'ring');
        setCursorStyle(savedStyle);
        return;
    }
    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
        cursor.style.display = 'none';
        cursor.style.opacity = '0';
    }
    document.documentElement.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');
    document.documentElement.removeAttribute('data-cursor-style');
    document.body.removeAttribute('data-cursor-style');
    document.body.classList.add('cursor-disabled');
}
function requestElementFullscreen(element) {
    if (!element)
        return;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    }
    else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    }
    else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
    else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    }
}
function exitFullscreenCompat() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
    else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
    else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    }
}
function syncGameFullscreenClasses() {
    const fullscreenEl = getFullscreenElementCompat();
    document.querySelectorAll('.game-frame.fullscreen').forEach(frame => {
        if (frame !== fullscreenEl) {
            frame.classList.remove('fullscreen');
        }
    });
}
document.addEventListener('fullscreenchange', () => {
    ensureNativeCursorState();
    syncGameFullscreenClasses();
    setTimeout(() => refreshActiveBackground(), 70);
});
document.addEventListener('webkitfullscreenchange', () => {
    ensureNativeCursorState();
    syncGameFullscreenClasses();
    setTimeout(() => refreshActiveBackground(), 70);
});
document.addEventListener('mozfullscreenchange', () => {
    ensureNativeCursorState();
    syncGameFullscreenClasses();
    setTimeout(() => refreshActiveBackground(), 70);
});
document.addEventListener('MSFullscreenChange', () => {
    ensureNativeCursorState();
    syncGameFullscreenClasses();
    setTimeout(() => refreshActiveBackground(), 70);
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden)
        refreshActiveBackground();
});
window.addEventListener('beforeunload', () => {
    stopBackgroundLoop();
    cleanupStarfieldBackground();
});
resizeBackgroundCanvas();
syncBackgroundGlow();
applyBackgroundStyle(localStorage.getItem('selectedBackground') || 'matrix', false);
let currentSortMethod = 'default';
let originalGamesOrder = [...games];
let isSorterOpen = false;
function sortGames(method) {
    if (method === 'newest') {
        return [...originalGamesOrder];
    }
    const sortedGames = games.filter(game => !game.secret);
    switch (method) {
        case 'default':
        case 'alphabetical':
            sortedGames.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'reverse':
            sortedGames.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'favorites': {
            const favoriteSet = new Set(favorites.map(title => String(title).toLowerCase()));
            sortedGames.sort((a, b) => (favoriteSet.has(b.title.toLowerCase()) - favoriteSet.has(a.title.toLowerCase())) || a.title.localeCompare(b.title));
            break;
        }
        case 'recent': {
            const order = new Map();
            getRecentGames().forEach(entry => {
                if (entry && entry.title && !order.has(entry.title))
                    order.set(entry.title, order.size);
            });
            sortedGames.sort((a, b) => {
                const aIndex = order.has(a.title) ? order.get(a.title) : Number.MAX_SAFE_INTEGER;
                const bIndex = order.has(b.title) ? order.get(b.title) : Number.MAX_SAFE_INTEGER;
                return aIndex - bIndex || a.title.localeCompare(b.title);
            });
            break;
        }
        case 'random':
            for (let i = sortedGames.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sortedGames[i], sortedGames[j]] = [sortedGames[j], sortedGames[i]];
            }
            break;
    }
    return sortedGames;
}
function applySorting() {
    const sortedGames = sortGames(currentSortMethod);
    const allContainer = document.getElementById('allLessonsGrid');
    if (!allContainer)
        return;
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    bindLessonGridEvents(allContainer);
    const cards = [];
    if (!searchTerm && currentSortMethod === 'default') {
        const randomGame = getRandomGame();
        if (randomGame)
            cards.push(gameCardMarkup(randomGame, true));
    }
    sortedGames.forEach(game => cards.push(gameCardMarkup(game)));
    allContainer.innerHTML = cards.join('');
    initCursorHover();
    if (searchTerm) {
        performSearch(searchTerm);
    }
    else {
        updateSearchStats();
    }
    setTimeout(() => {
        initFadeObserver();
    }, 50);
    if (typeof gtag !== 'undefined') {
        gtag('event', 'game_sort', {
            'event_category': 'engagement',
            'event_label': currentSortMethod,
            'value': sortedGames.length
        });
    }
}
document.addEventListener('DOMContentLoaded', function () {
    const sortSelect = document.getElementById('sortSelect');
    const arrow = document.querySelector('.custom-arrow');
    if (!sortSelect || !arrow)
        return;
    sortSelect.value = 'default';
    sortSelect.addEventListener('mousedown', function () {
        if (!isSorterOpen) {
            isSorterOpen = true;
            arrow.classList.add('open');
            arrow.style.animation = 'openFlip 0.25s cubic-bezier(0.2, 0.8, 0.2, 1.2) forwards';
        }
    });
    sortSelect.addEventListener('change', function (e) {
        currentSortMethod = e.target.value;
        applySorting();
        closeSorter();
    });
    sortSelect.addEventListener('blur', function () {
        setTimeout(() => {
            if (document.activeElement !== sortSelect) {
                closeSorter();
            }
        }, 10);
    });
    document.addEventListener('click', function (e) {
        if (!sortSelect.contains(e.target) && isSorterOpen) {
            closeSorter();
        }
    });
    function closeSorter() {
        if (isSorterOpen) {
            isSorterOpen = false;
            arrow.classList.remove('open');
            arrow.style.animation = 'closeFlip 0.25s cubic-bezier(0.2, 0.8, 0.2, 1.2) forwards';
            setTimeout(() => {
                arrow.style.animation = '';
            }, 250);
        }
    }
    applySorting();
});
function switchTab(tab) {
    const lessonsTab = document.getElementById('lessonsTab');
    const musicTab = document.getElementById('musicTab');
    const settingsTab = document.getElementById('settingsTab');
    const homeSection = document.getElementById('home-section');
    const allLessonsSection = document.getElementById('all-lessons');
    const settingsSection = document.getElementById('settings-section');
    const musicSection = document.getElementById('music-section');
    const updatesTab = document.getElementById('updatesTab');
    const updatesSection = document.getElementById('updates-section');
    const chatTab = document.getElementById('chatTab');
    const chatSection = document.getElementById('chat-section');
    const emulatorsTab = document.getElementById('emulatorsTab');
    const emulatorSection = document.getElementById('emulator-section');
    const activeTab = tab === 'settings' ? 'settings' : tab === 'music' ? 'music' : tab === 'updates' ? 'updates' : tab === 'chat' ? 'chat' : tab === 'emulators' ? 'emulators' : 'lessons';

    function showSection(section, displayValue) {
        if (!section)
            return;
        section.hidden = false;
        section.setAttribute('aria-hidden', 'false');
        section.classList.add('is-active-section');
        section.style.display = displayValue || 'block';
        section.style.pointerEvents = 'auto';
        section.style.zIndex = '1';
    }

    [lessonsTab, musicTab, updatesTab, settingsTab, chatTab, emulatorsTab].forEach(function (navItem) {
        if (navItem) {
            navItem.classList.remove('active');
            navItem.removeAttribute('aria-current');
        }
    });
    [homeSection, allLessonsSection, settingsSection, musicSection, updatesSection, chatSection, emulatorSection].forEach(function (section) {
        if (section) {
            section.hidden = true;
            section.setAttribute('aria-hidden', 'true');
            section.classList.remove('is-active-section');
            section.style.display = 'none';
            section.style.pointerEvents = 'none';
            section.style.zIndex = '0';
        }
    });

    document.documentElement.dataset.activeTab = activeTab;
    document.body.dataset.activeTab = activeTab;

    if (activeTab === 'lessons') {
        if (lessonsTab) {
            lessonsTab.classList.add('active');
            lessonsTab.setAttribute('aria-current', 'page');
        }
        showSection(homeSection);
        showSection(allLessonsSection);
    }
    else if (activeTab === 'music') {
        if (musicTab) {
            musicTab.classList.add('active');
            musicTab.setAttribute('aria-current', 'page');
        }
        showSection(musicSection);
    }
    else if (activeTab === 'updates') {
        if (updatesTab) {
            updatesTab.classList.add('active');
            updatesTab.setAttribute('aria-current', 'page');
        }
        showSection(updatesSection);
    }
    else if (activeTab === 'emulators') {
        if (emulatorsTab) {
            emulatorsTab.classList.add('active');
            emulatorsTab.setAttribute('aria-current', 'page');
        }
        showSection(emulatorSection);
    }
    else if (activeTab === 'chat') {
        if (chatTab) {
            chatTab.classList.add('active');
            chatTab.setAttribute('aria-current', 'page');
        }
        showSection(chatSection);
    }
    else {
        if (settingsTab) {
            settingsTab.classList.add('active');
            settingsTab.setAttribute('aria-current', 'page');
        }
        showSection(settingsSection);
    }

    window.dispatchEvent(new CustomEvent('app:switch-tab', {
        detail: { tab: tab }
    }));
}
(function () {
    const c = document.getElementById('custom-cursor');
    if (!c)
        return;
    let mx = 0, my = 0, cx = 0, cy = 0;
    let cursorHidden = false;
    let cursorVisible = true;
    let isOverIframe = false;
    let iframeCheckTimeout;
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';
    function lerp(s, e, a) {
        return (1 - a) * s + a * e;
    }
    function usesNativeCursorMode() {
        return document.body.classList.contains('proto-ui')
            || document.body.classList.contains('cursor-disabled');
    }
    function hideCustomCursor() {
        if (cursorVisible) {
            c.style.display = 'block';
            c.style.opacity = '0';
            cursorVisible = false;
            cursorHidden = true;
        }
    }
    function showCustomCursor() {
        c.style.display = 'block';
        if (!cursorVisible) {
            c.style.opacity = '1';
            cursorVisible = true;
            cursorHidden = false;
        }
    }
    function checkIfOverIframe(x, y) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            const rect = iframe.getBoundingClientRect();
            const buffer = 5;
            const bufferRect = {
                left: rect.left - buffer,
                right: rect.right + buffer,
                top: rect.top - buffer,
                bottom: rect.bottom + buffer
            };
            if (x >= bufferRect.left && x <= bufferRect.right &&
                y >= bufferRect.top && y <= bufferRect.bottom) {
                return true;
            }
        }
        return false;
    }
    function updateIframeStatus(x, y) {
        const wasOverIframe = isOverIframe;
        isOverIframe = checkIfOverIframe(x, y);
        clearTimeout(iframeCheckTimeout);
        iframeCheckTimeout = setTimeout(() => {
            if (isOverIframe && !wasOverIframe) {
                hideCustomCursor();
                document.documentElement.style.cursor = 'auto';
            }
            else if (!isOverIframe && wasOverIframe) {
                showCustomCursor();
                document.documentElement.style.cursor = 'none';
            }
        }, 50);
    }
    document.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (usesNativeCursorMode()) {
            hideCustomCursor();
            document.documentElement.style.cursor = 'auto';
            document.body.style.cursor = 'auto';
            return;
        }
        updateIframeStatus(mx, my);
        if (!isOverIframe) {
            showCustomCursor();
            document.documentElement.style.cursor = 'none';
        }
    });
    function animate() {
        cx = prefersReducedMotion ? mx : lerp(cx, mx, 0.25);
        cy = prefersReducedMotion ? my : lerp(cy, my, 0.25);
        c.style.left = cx + 'px';
        c.style.top = cy + 'px';
        requestAnimationFrame(animate);
    }
    animate();
    document.addEventListener('mousedown', (e) => {
        if (!isOverIframe && !usesNativeCursorMode()) {
            showCustomCursor();
            c.classList.add('click');
        }
    });
    document.addEventListener('mouseup', () => {
        c.classList.remove('click');
    });
    const interactive = document.querySelectorAll('button, a, .partner-card, .nav-tab, .btn, .search-box, input, ' +
        '.lesson-card, .theme-toggle-btn, .sort-select, ' +
        '.visit-btn, .sorter-wrapper, .social-icons a');
    interactive.forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            if (!isOverIframe && !usesNativeCursorMode()) {
                showCustomCursor();
                c.classList.add('hover');
            }
        });
        el.addEventListener('mouseleave', (e) => {
            c.classList.remove('hover');
        });
    });
    const gamePage = document.getElementById('gamePage');
    if (gamePage) {
        const observer = new MutationObserver(() => {
            if (!gamePage.classList.contains('active')) {
                isOverIframe = false;
                if (usesNativeCursorMode()) {
                    hideCustomCursor();
                    document.documentElement.style.cursor = 'auto';
                    document.body.style.cursor = 'auto';
                }
                else {
                    showCustomCursor();
                    document.documentElement.style.cursor = 'none';
                }
            }
        });
        observer.observe(gamePage, { attributes: true });
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (usesNativeCursorMode()) {
                hideCustomCursor();
                document.documentElement.style.cursor = 'auto';
                document.body.style.cursor = 'auto';
            }
            else {
                showCustomCursor();
            }
        }
    });
    if (usesNativeCursorMode()) {
        hideCustomCursor();
        document.documentElement.style.cursor = 'auto';
        document.body.style.cursor = 'auto';
    }
    else {
        showCustomCursor();
    }
    window.addEventListener('beforeunload', () => {
        clearTimeout(iframeCheckTimeout);
    });
})();
document.addEventListener('DOMContentLoaded', function () {
    updateGameCounts();
    generateGameCards();
    buildHomePopularCarousel();
    initHomeLogoTilt();
    setupSearchClear();
    const initialQuery = new URLSearchParams(location.search).get('q');
    if (initialQuery) {
        const input = document.getElementById('searchInput');
        if (input)
            input.value = initialQuery;
        performSearch(initialQuery);
    }
    switchTab('lessons');
    const deepLinkSlug = gameHashSlug() || new URLSearchParams(location.search).get('game');
    if (deepLinkSlug) {
        const deepLinkGame = findGameBySlug(deepLinkSlug);
        if (deepLinkGame)
            openLesson(deepLinkGame.title, deepLinkGame.url, { replaceUrl: true });
        else
            clearGameUrl('replace');
    }
    else if (hasLegacyGameLocation()) {
        clearGameUrl('replace');
    }
    if (typeof window.__hideStartupLoader === 'function')
        window.__hideStartupLoader();
});
document.addEventListener('DOMContentLoaded', function () {
    const scrollbar = document.getElementById('custom-scrollbar');
    const scrollbarThumb = document.getElementById('custom-scrollbar-thumb');
    const scrollbarTrack = document.getElementById('custom-scrollbar-track');
    if (!scrollbar || !scrollbarThumb || !scrollbarTrack)
        return;
    let isDragging = false;
    let lastY = 0;
    let scrollTimeout;
    let mouseMoveTimeout;
    let isHovering = false;
    scrollbar.style.opacity = '0';
    function updateScrollbar() {
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const maxScroll = Math.max(docHeight - windowHeight, 1);
        const thumbHeight = Math.max((windowHeight / docHeight) * windowHeight, 40);
        scrollbarThumb.style.height = thumbHeight + 'px';
        const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (windowHeight - thumbHeight) : 0;
        scrollbarThumb.style.top = thumbTop + 'px';
        showScrollbar();
    }
    function showScrollbar() {
        const gamePage = document.getElementById('gamePage');
        const scrollbar = document.getElementById('custom-scrollbar');
        if (!scrollbar)
            return;
        if (gamePage && gamePage.classList.contains('active')) {
            scrollbar.style.opacity = '0';
            return;
        }
        if (isHovering)
            return;
        scrollbar.style.opacity = '0.8';
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (!isHovering && !isDragging) {
                hideScrollbar();
            }
        }, 1500);
    }
    function hideScrollbar() {
        scrollbar.style.opacity = '0';
    }
    function handleScrollbarMouseEnter() {
        isHovering = true;
        scrollbar.style.opacity = '0.8';
        clearTimeout(scrollTimeout);
    }
    function handleScrollbarMouseLeave() {
        isHovering = false;
        if (!isDragging) {
            scrollTimeout = setTimeout(() => {
                hideScrollbar();
            }, 500);
        }
    }
    function handleDocumentMouseMove(e) {
        const mouseX = e.clientX;
        const windowWidth = window.innerWidth;
        const distanceFromRight = windowWidth - mouseX;
        if (distanceFromRight <= 20) {
            const gamePage = document.getElementById('gamePage');
            if (gamePage && gamePage.classList.contains('active')) {
                return;
            }
            showScrollbar();
        }
        else if (!isHovering && !isDragging && !isMouseOverScrollbar(e)) {
            clearTimeout(mouseMoveTimeout);
            mouseMoveTimeout = setTimeout(() => {
                hideScrollbar();
            }, 500);
        }
    }
    function isMouseOverScrollbar(e) {
        const rect = scrollbar.getBoundingClientRect();
        return e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
    }
    function startDrag(e) {
        isDragging = true;
        lastY = e.clientY;
        scrollbarThumb.classList.add('dragging');
        e.preventDefault();
    }
    function doDrag(e) {
        if (!isDragging)
            return;
        const currentY = e.clientY;
        const deltaY = currentY - lastY;
        lastY = currentY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const maxScroll = Math.max(docHeight - windowHeight, 1);
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 40;
        const trackHeight = windowHeight - thumbHeight;
        const scrollPercent = deltaY / trackHeight;
        window.scrollBy(0, scrollPercent * maxScroll);
        e.preventDefault();
    }
    function stopDrag() {
        isDragging = false;
        scrollbarThumb.classList.remove('dragging');
        setTimeout(() => {
            if (!isHovering) {
                hideScrollbar();
            }
        }, 1000);
    }
    function trackClick(e) {
        if (e.target === scrollbarThumb)
            return;
        const rect = scrollbarTrack.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const maxScroll = Math.max(docHeight - windowHeight, 1);
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 40;
        const newThumbTop = Math.min(Math.max(clickY - thumbHeight / 2, 0), windowHeight - thumbHeight);
        const scrollPercent = newThumbTop / (windowHeight - thumbHeight);
        window.scrollTo(0, scrollPercent * maxScroll);
    }
    scrollbarThumb.addEventListener('mousedown', startDrag);
    scrollbarTrack.addEventListener('mousedown', trackClick);
    scrollbar.addEventListener('mouseenter', handleScrollbarMouseEnter);
    scrollbar.addEventListener('mouseleave', handleScrollbarMouseLeave);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    window.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    const gamePage = document.getElementById('gamePage');
    if (gamePage) {
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.attributeName === 'class') {
                    if (gamePage.classList.contains('active')) {
                        hideScrollbar();
                    }
                    else {
                        setTimeout(updateScrollbar, 100);
                    }
                }
            });
        });
        observer.observe(gamePage, { attributes: true });
    }
    setTimeout(updateScrollbar, 100);
    setTimeout(() => {
        hideScrollbar();
    }, 3000);
});
const DEFAULT_TAB_TITLE = "Home - Classroom";
const schoolSubjects = ["Math", "Science", "English", "History", "Biology", "Chemistry", "Physics", "Calculus", "Algebra", "Geometry", "Literature", "Spanish", "French", "Art", "Music", "Computer Science", "Economics", "Psychology", "Statistics"];
const activeIcon = "cuh.png";
const inactiveIcon = "cuh.png";
let currentSubject = getRandomSubject();
function getRandomSubject() {
    return schoolSubjects[Math.floor(Math.random() * schoolSubjects.length)];
}
function setFavicon(iconUrl) {
    const existingFavicons = document.querySelectorAll('link[rel*="icon"], link[rel*="shortcut"]');
    existingFavicons.forEach(link => link.remove());
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/x-icon';
    favicon.href = iconUrl;
    document.head.appendChild(favicon);
    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.href = iconUrl;
    document.head.appendChild(shortcut);
    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.href = iconUrl;
    document.head.appendChild(apple);
}
function updateTitle() {
    if (!document.hidden) {
        document.title = DEFAULT_TAB_TITLE;
    }
    else {
        document.title = localStorage.getItem('inactiveTabTitle') || DEFAULT_TAB_TITLE;
    }
}
function initializeFaviconAndTitle() {
    setFavicon(activeIcon);
    updateTitle();
}
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        const inactiveTitle = localStorage.getItem('inactiveTabTitle') || DEFAULT_TAB_TITLE;
        const inactiveFavicon = localStorage.getItem('inactiveTabFavicon') || 'cuh.png';
        document.title = inactiveTitle;
        setFavicon(inactiveFavicon);
    }
    else {
        document.title = DEFAULT_TAB_TITLE;
        setFavicon('cuh.png');
    }
});
setInterval(function () {
    if (!document.hidden) {
        document.title = DEFAULT_TAB_TITLE;
    }
}, 30000);
window.addEventListener('load', function () {
    initializeFaviconAndTitle();
    setTimeout(function () {
        setFavicon(activeIcon);
    }, 500);
});
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        setFavicon(activeIcon);
        updateTitle();
    }, 100);
});
document.addEventListener('DOMContentLoaded', function () {
    const gamePage = document.getElementById('gamePage');
    const backToTopBtn = document.getElementById("backToTop");
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility);
    if (backToTopBtn) {
        backToTopBtn.addEventListener("click", scrollToTop);
    }
    if (gamePage) {
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.attributeName === 'class') {
                    setTimeout(updateBackToTopVisibility, 50);
                }
            });
        });
        observer.observe(gamePage, { attributes: true });
    }
    function updateBackToTopVisibility() {
        if (!backToTopBtn)
            return;
        const isGameActive = gamePage && gamePage.classList.contains('active');
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        if (isGameActive) {
            backToTopBtn.classList.remove("show");
            return;
        }
        if (scrollPosition > 18000) {
            backToTopBtn.classList.add("show");
        }
        else {
            backToTopBtn.classList.remove("show");
        }
    }
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
});
function preloadFavicons() {
    const preloadActive = new Image();
    preloadActive.src = activeIcon;
    const preloadInactive = new Image();
    preloadInactive.src = inactiveIcon;
}
preloadFavicons();
let flashInterval;
let flashImages = [];
let lastRandomIndex = -1;
function startImageFlash() {
    flashImages = games.map(game => game.image).filter(img => img);
    if (flashImages.length === 0 || prefersReducedMotion)
        return;
    if (flashInterval)
        clearInterval(flashInterval);
    flashInterval = setInterval(() => {
        const randomCard = document.querySelector('.lesson-card[data-random-game="true"] .lesson-image');
        if (randomCard) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * flashImages.length);
            } while (randomIndex === lastRandomIndex && flashImages.length > 1);
            lastRandomIndex = randomIndex;
            randomCard.src = flashImages[randomIndex];
            randomCard.style.transition = 'opacity 0.3s ease';
            randomCard.style.opacity = '0.8';
            setTimeout(() => {
                randomCard.style.opacity = '1';
            }, 150);
        }
    }, 500);
}
function stopImageFlash() {
    if (flashInterval) {
        clearInterval(flashInterval);
        flashInterval = null;
    }
}
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    let searchInputTimer = 0;
    searchInput.addEventListener('input', function () {
        clearTimeout(searchInputTimer);
        searchInputTimer = setTimeout(function () {
            if (searchInput.value.trim()) {
                performSearch(searchInput.value);
            }
            else if (typeof applySorting === 'function') {
                applySorting();
            }
            else {
                performSearch('');
            }
        }, 90);
    });
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            setTimeout(() => {
                if (searchInput.value) {
                    performSearch(searchInput.value);
                }
                else {
                    updateSearchStats();
                }
            }, 100);
        });
    }
}
let cursorEnabled = true;
let cursorStyle = 'ring';
const themeColors = {
    'default': '#7c8cff',
    'theme-rainbow': '#ff0080',
    'theme-cyber-green': '#00ff00',
    'theme-ice-blue': '#00ccff',
    'theme-solarized': '#2aa198',
    'theme-purple-haze': '#9b59b6'
};
document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('contextmenu', function (e) {
        const target = e.target;
        const isInIframe = target.tagName === 'IFRAME' || target.closest('iframe');
        const isInGamePage = document.getElementById('gamePage').classList.contains('active');
        if (isInIframe || (isInGamePage && !target.closest('.game-tabbar'))) {
            return;
        }
        e.preventDefault();
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu)
            return;
        const x = Math.min(e.clientX, window.innerWidth - contextMenu.offsetWidth - 10);
        const y = Math.min(e.clientY, window.innerHeight - contextMenu.offsetHeight - 10);
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'block';
        setTimeout(() => {
            const closeContextMenu = function (e) {
                if (!contextMenu.contains(e.target)) {
                    contextMenu.style.display = 'none';
                    document.removeEventListener('click', closeContextMenu);
                }
            };
            document.addEventListener('click', closeContextMenu);
        }, 10);
    });
    document.addEventListener('click', function (e) {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu && !contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });
    setDefaultSettings();
    initializeSettings();
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            openSettings();
        }
    });
});
function initializeSettings() {
    const savedCursorStyle = localStorage.getItem('cursorStyle');
    const savedCursorEnabled = localStorage.getItem('cursorEnabled');
    const initialCursorStyle = savedCursorStyle || (savedCursorEnabled === 'false' ? 'default' : 'ring');
    setCursorStyle(initialCursorStyle);
    const cursorStyleSelect = document.getElementById('cursorStyleSelect');
    if (cursorStyleSelect)
        cursorStyleSelect.value = initialCursorStyle;
    const savedTheme = localStorage.getItem('selectedTheme') || 'default';
    const savedCustomColor = localStorage.getItem('customThemeColor');
    if (savedCustomColor && savedTheme === 'custom') {
        document.getElementById('customHexInput').value = savedCustomColor;
        document.getElementById('colorPreview').style.background = savedCustomColor;
    }
    const savedTitle = localStorage.getItem('inactiveTabTitle');
    const savedFavicon = localStorage.getItem('inactiveTabFavicon');
    if (savedTitle)
        document.getElementById('customTitle').value = savedTitle;
    if (savedFavicon)
        document.getElementById('customFavicon').value = savedFavicon;
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
        const logoPreview = document.getElementById('logoPreview');
        if (logoPreview) {
            const previewImg = logoPreview.querySelector('img');
            if (previewImg) {
                previewImg.src = savedLogo;
                previewImg.style.display = 'block';
                logoPreview.querySelector('i').style.display = 'none';
            }
        }
        setSiteLogos(savedLogo);
    }
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            const inactiveTitle = localStorage.getItem('inactiveTabTitle') || DEFAULT_TAB_TITLE;
            const inactiveFavicon = localStorage.getItem('inactiveTabFavicon') || 'cuh.png';
            document.title = inactiveTitle;
            setFavicon(inactiveFavicon);
        }
        else {
            document.title = DEFAULT_TAB_TITLE;
            setFavicon('cuh.png');
        }
    });
    setTimeout(updateCursorColors, 100);
}
function openSettings() {
    switchTab('settings');
    const savedTheme = localStorage.getItem('selectedTheme') || 'default';
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
    applySavedTheme(savedTheme);
    const customColorInput = document.getElementById('customColorInput');
    if (savedTheme === 'custom') {
        customColorInput.style.display = 'flex';
    }
    else {
        customColorInput.style.display = 'none';
    }
    updateBackgroundSelectionUI();
    syncDisplaySettingsUI();
}
function setPopupAdsPreference(enabled) {
    try {
        localStorage.setItem('popupAdsDisabled', enabled ? 'false' : 'true');
    }
    catch (error) {}
    const toggle = document.getElementById('popupAdsToggle');
    if (toggle) toggle.checked = !!enabled;
    if (window.CUHAds && typeof window.CUHAds.refreshPopupAd === 'function') {
        window.CUHAds.refreshPopupAd();
    }
    if (window.CoolAccountStore && typeof window.CoolAccountStore.capturePreferences === 'function') {
        window.CoolAccountStore.capturePreferences();
    }
    window.dispatchEvent(new CustomEvent('cuh-popup-ads-change', { detail: { enabled: !!enabled } }));
}
window.setPopupAdsPreference = setPopupAdsPreference;
function persistPreferenceChange() {
    if (window.CoolAccountStore && typeof window.CoolAccountStore.capturePreferences === 'function') {
        window.CoolAccountStore.capturePreferences();
    }
}
function syncDisplaySettingsUI() {
    const reduceMotionToggle = document.getElementById('reduceMotionToggle');
    if (reduceMotionToggle) {
        reduceMotionToggle.checked = localStorage.getItem('reduceMotion') === 'true';
    }
    const carouselToggle = document.getElementById('carouselAutoplayToggle');
    if (carouselToggle) {
        carouselToggle.checked = localStorage.getItem('carouselAutoplay') !== 'false';
    }
    const gridSelect = document.getElementById('gameGridSelect');
    if (gridSelect) {
        const storedGrid = localStorage.getItem('gameGridColumns');
        gridSelect.value = ['3', '4', '5'].includes(storedGrid) ? storedGrid : 'auto';
    }
}
function updateCarouselAutoplayState() {
    const carousel = document.getElementById('homePopularCarousel');
    if (!carousel)
        return;
    const track = carousel.querySelector('.home-carousel-track');
    if (!track)
        return;
    const enabled = localStorage.getItem('carouselAutoplay') !== 'false' &&
        !document.body.classList.contains('reduce-motion');
    if (!enabled) {
        track.style.animation = 'none';
        track.style.transform = 'translateX(0)';
        return;
    }
    startHomeCarouselAutoplay(carousel);
}
function applyReduceMotionPreference() {
    document.body.classList.toggle('reduce-motion', localStorage.getItem('reduceMotion') === 'true');
    syncDisplaySettingsUI();
}
function setReduceMotionPreference(enabled) {
    try {
        localStorage.setItem('reduceMotion', enabled ? 'true' : 'false');
    }
    catch (error) {
    }
    applyReduceMotionPreference();
    updateCarouselAutoplayState();
    persistPreferenceChange();
}
function applyCarouselAutoplayPreference() {
    const toggle = document.getElementById('carouselAutoplayToggle');
    if (toggle) {
        toggle.checked = localStorage.getItem('carouselAutoplay') !== 'false';
    }
    updateCarouselAutoplayState();
}
function setCarouselAutoplayPreference(enabled) {
    try {
        localStorage.setItem('carouselAutoplay', enabled ? 'true' : 'false');
    }
    catch (error) {
    }
    applyCarouselAutoplayPreference();
    persistPreferenceChange();
}
function getGameGridPreference() {
    const value = localStorage.getItem('gameGridColumns');
    return value === '3' || value === '4' || value === '5' ? value : 'auto';
}
function applyGameGridPreference(value) {
    const preference = value === '3' || value === '4' || value === '5' ? value : getGameGridPreference();
    const select = document.getElementById('gameGridSelect');
    if (select) {
        select.value = preference;
    }
    applyGridColumns(preference);
}
function setGameGridPreference(value) {
    const preference = value === '3' || value === '4' || value === '5' ? value : 'auto';
    try {
        localStorage.setItem('gameGridColumns', preference);
    }
    catch (error) {
    }
    applyGameGridPreference(preference);
    if (typeof placeInFeedAd === 'function') {
        placeInFeedAd();
    }
    persistPreferenceChange();
}
function applySavedTheme(themeName) {
    const body = document.body;
    body.classList.remove('theme-rainbow', 'theme-cyber-green', 'theme-ice-blue', 'theme-solarized', 'theme-purple-haze');
    if (themeName !== 'default' && themeName !== 'custom') {
        body.classList.add(`theme-${themeName}`);
    }
    if (themeName === 'custom') {
        const customColor = localStorage.getItem('customThemeColor') || '#7c8cff';
        applyCustomThemeColors(customColor);
        document.getElementById('customColorInput').style.display = 'flex';
    }
    else {
        document.documentElement.style.removeProperty('--primary-accent');
        document.documentElement.style.removeProperty('--primary-accent-rgb');
        document.documentElement.style.removeProperty('--accent');
        document.getElementById('customColorInput').style.display = 'none';
    }
    const savedBackground = normalizeBackgroundStyle(localStorage.getItem('selectedBackground') || 'matrix');
    applyBackgroundStyle(savedBackground, false);
    updateMatrixTheme();
    updateCursorColors();
}
function closeSettings() {
    switchTab('lessons');
}
function selectPresetTheme(themeName) {
    const body = document.body;
    body.classList.remove('theme-rainbow', 'theme-cyber-green', 'theme-ice-blue', 'theme-solarized', 'theme-purple-haze');
    if (themeName !== 'default' && themeName !== 'custom') {
        body.classList.add(`theme-${themeName}`);
    }
    if (themeName === 'custom') {
        const customColor = localStorage.getItem('customThemeColor') || '#7c8cff';
        applyCustomThemeColors(customColor);
        document.getElementById('customColorInput').style.display = 'flex';
    }
    else {
        document.documentElement.style.removeProperty('--primary-accent');
        document.documentElement.style.removeProperty('--primary-accent-rgb');
        document.documentElement.style.removeProperty('--accent');
        document.getElementById('customColorInput').style.display = 'none';
    }
    localStorage.setItem('selectedTheme', themeName);
    logoTintCache.clear();
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`.theme-option[data-theme="${themeName}"]`);
    if (activeOption)
        activeOption.classList.add('active');
    updateLogoForCurrentTheme();
    updateMatrixTheme();
    updateCursorColors();
    if (typeof gtag !== 'undefined') {
        gtag('event', 'theme_change', {
            'event_category': 'settings',
            'event_label': themeName,
            'value': 1
        });
    }
}
function updateLogoForCurrentTheme() {
    const currentTheme = localStorage.getItem('selectedTheme') || 'default';
    const defaultLogo = "images/logo.webp?v=5";
    document.querySelectorAll('.logo, .home-logo').forEach(logoEl => {
        logoEl.src = defaultLogo;
        logoEl.dataset.baseSrc = defaultLogo;
    });
    if (currentTheme !== 'default') {
        setTimeout(() => {
            const { r, g, b } = getBackgroundColorRGB();
            document.querySelectorAll('.logo, .home-logo').forEach(logoEl => {
                tintLogoElementExact(logoEl, r, g, b);
            });
        }, 50);
    }
}
function updateMatrixBackground() {
    refreshActiveBackground();
}
function applyCustomThemeColors(hexColor) {
    if (!/^#[0-9A-F]{6}$/i.test(hexColor)) {
        if (/^[0-9A-F]{6}$/i.test(hexColor)) {
            hexColor = '#' + hexColor;
        }
        else {
            return false;
        }
    }
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const rgb = `${r}, ${g}, ${b}`;
    const accentR = Math.min(255, Math.floor(r * 1.2));
    const accentG = Math.min(255, Math.floor(g * 1.2));
    const accentB = Math.min(255, Math.floor(b * 1.2));
    const accentColor = `rgb(${accentR}, ${accentG}, ${accentB})`;
    document.documentElement.style.setProperty('--primary-accent', hexColor);
    document.documentElement.style.setProperty('--primary-accent-rgb', rgb);
    document.documentElement.style.setProperty('--accent', accentColor);
    window.matrixColor = hexColor;
    updateMatrixTheme();
    return true;
}
function applyCustomTheme() {
    const hexInput = document.getElementById('customHexInput');
    const colorPreview = document.getElementById('colorPreview');
    if (!hexInput || !colorPreview)
        return;
    const hexColor = hexInput.value.trim();
    if (!applyCustomThemeColors(hexColor)) {
        alert('Please enter a valid hex color (e.g., #7c8cff)');
        hexInput.style.borderColor = '#ff4444';
        setTimeout(() => hexInput.style.borderColor = '', 1000);
        return;
    }
    colorPreview.style.background = hexColor;
    localStorage.setItem('selectedTheme', 'custom');
    localStorage.setItem('customThemeColor', hexColor);
    const body = document.body;
    body.classList.remove('theme-rainbow', 'theme-cyber-green', 'theme-ice-blue', 'theme-solarized', 'theme-purple-haze');
    updateMatrixTheme();
    updateCursorColors();
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    document.querySelector('.theme-option[data-theme="custom"]').classList.add('active');
    hexInput.style.borderColor = 'var(--accent)';
    setTimeout(() => {
        hexInput.style.borderColor = '';
    }, 1000);
}
function setCursorStyle(style) {
    const allowed = ['default', 'ring', 'dot', 'square', 'crosshair'];
    cursorStyle = allowed.includes(style) ? style : 'ring';
    cursorEnabled = cursorStyle !== 'default';
    const cursor = document.getElementById('custom-cursor');
    document.body.classList.toggle('cursor-disabled', !cursorEnabled);
    document.body.setAttribute('data-cursor-style', cursorStyle);
    const cursorStyleSelect = document.getElementById('cursorStyleSelect');
    if (cursorStyleSelect)
        cursorStyleSelect.value = cursorStyle;
    if (cursorEnabled) {
        if (cursor) {
            cursor.style.display = 'block';
            cursor.style.opacity = '1';
            updateCursorColors();
        }
        document.documentElement.style.cursor = 'none';
        document.body.style.cursor = 'none';
    }
    else {
        if (cursor)
            cursor.style.display = 'none';
        document.documentElement.style.cursor = 'default';
        document.body.style.cursor = 'default';
    }
    localStorage.setItem('cursorStyle', cursorStyle);
    localStorage.setItem('cursorEnabled', cursorEnabled);
}
function toggleCursorSetting(enabled) {
    setCursorStyle(enabled ? (localStorage.getItem('cursorStyle') || 'ring') : 'default');
}
function applyMatrixFilterForCustomColor(hexColor) {
    refreshActiveBackground();
}
function setFavicon(url) {
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/x-icon';
    favicon.href = url;
    document.head.appendChild(favicon);
    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.href = url;
    document.head.appendChild(shortcut);
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = url;
    document.head.appendChild(appleIcon);
}
function applyInactiveTabSettings() {
    const titleInput = document.getElementById('customTitle');
    const faviconInput = document.getElementById('customFavicon');
    if (!titleInput || !faviconInput)
        return;
    const newTitle = titleInput.value.trim() || DEFAULT_TAB_TITLE;
    const newFavicon = faviconInput.value.trim() || 'cuh.png';
    localStorage.setItem('inactiveTabTitle', newTitle);
    localStorage.setItem('inactiveTabFavicon', newFavicon);
    if (document.hidden) {
        document.title = newTitle;
        setFavicon(newFavicon);
    }
    const applyBtn = event.target;
    const originalText = applyBtn.innerHTML;
    applyBtn.innerHTML = '<i class="fas fa-check"><\/i> Applied!';
    applyBtn.style.borderColor = 'var(--accent)';
    applyBtn.style.background = 'rgba(var(--primary-accent-rgb), 0.3)';
    setTimeout(() => {
        applyBtn.innerHTML = originalText;
        applyBtn.style.borderColor = '';
        applyBtn.style.background = '';
    }, 1500);
}
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file)
        return;
    if (!file.type.match('image.*')) {
        alert('Please upload an image file (JPG, PNG, GIF, etc.)');
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        const logoData = e.target.result;
        const logoPreview = document.getElementById('logoPreview');
        const previewImg = logoPreview.querySelector('img');
        previewImg.src = logoData;
        previewImg.style.display = 'block';
        logoPreview.querySelector('i').style.display = 'none';
        setSiteLogos(logoData);
        localStorage.setItem('customLogo', logoData);
        const fileBtn = event.target.parentElement;
        const originalHTML = fileBtn.innerHTML;
        fileBtn.innerHTML = '<i class="fas fa-check"><\/i> Logo Uploaded!';
        fileBtn.style.borderColor = 'var(--accent)';
        fileBtn.style.background = 'rgba(var(--primary-accent-rgb), 0.3)';
        setTimeout(() => {
            fileBtn.innerHTML = originalHTML;
            fileBtn.style.borderColor = '';
            fileBtn.style.background = '';
        }, 1500);
    };
    reader.readAsDataURL(file);
}
function updateCursorColors() {
    const cursor = document.getElementById('custom-cursor');
    if (!cursor)
        return;
    const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-accent')
        .trim();
    const primaryRGB = primaryColor.startsWith('#') ?
        hexToRgb(primaryColor) :
        getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-accent-rgb')
            .trim();
    const accentColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim();
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }
    document.documentElement.style.setProperty('--cursor-bg', `rgba(${primaryRGB}, 0.15)`);
    document.documentElement.style.setProperty('--cursor-border', `rgba(${primaryRGB}, 0.5)`);
    document.documentElement.style.setProperty('--cursor-hover-bg', `rgba(${primaryRGB}, 0.25)`);
    document.documentElement.style.setProperty('--cursor-hover-border', accentColor);
}
const logoTintCache = new Map();
function tintLogoElementExact(logoEl, r, g, b) {
    if (!logoEl)
        return;
    const currentTheme = localStorage.getItem('selectedTheme') || 'default';
    const isDefaultTheme = currentTheme === 'default';
    const isDefaultColor = r === 124 && g === 140 && b === 255;
    if (isDefaultTheme || isDefaultColor) {
        const baseSrc = logoEl.dataset.baseSrc ||
            "images/logo.webp?v=5";
        if (logoEl.src !== baseSrc) {
            logoEl.src = baseSrc;
        }
        return;
    }
    const baseSrc = logoEl.dataset.baseSrc || logoEl.getAttribute('src') || logoEl.src;
    if (!baseSrc || baseSrc.startsWith('blob:'))
        return;
    if (!logoEl.dataset.baseSrc)
        logoEl.dataset.baseSrc = baseSrc;
    const cacheKey = `${baseSrc}|${r},${g},${b}`;
    if (logoTintCache.has(cacheKey)) {
        logoEl.src = logoTintCache.get(cacheKey);
        return;
    }
    const img = new Image();
    if (!baseSrc.startsWith('data:'))
        img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 0;
            canvas.height = img.naturalHeight || img.height || 0;
            if (!canvas.width || !canvas.height)
                return;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha === 0)
                    continue;
                const srcR = data[i];
                const srcG = data[i + 1];
                const srcB = data[i + 2];
                const isWhite = srcR > 200 && srcG > 200 && srcB > 200;
                const isNearWhite = Math.abs(srcR - srcG) < 20 &&
                    Math.abs(srcG - srcB) < 20 &&
                    srcR > 180 && srcG > 180 && srcB > 180;
                if (isWhite || isNearWhite) {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                }
                else {
                    const luminance = (0.2126 * srcR + 0.7152 * srcG + 0.0722 * srcB) / 255;
                    const shade = Math.pow(luminance, 0.88);
                    data[i] = Math.round(r * shade);
                    data[i + 1] = Math.round(g * shade);
                    data[i + 2] = Math.round(b * shade);
                }
            }
            ctx.putImageData(imageData, 0, 0);
            const tintedDataUrl = canvas.toDataURL('image/png');
            logoTintCache.set(cacheKey, tintedDataUrl);
            if ((logoEl.dataset.baseSrc || '') === baseSrc) {
                logoEl.src = tintedDataUrl;
            }
        }
        catch (error) {
        }
    };
    img.onerror = () => { };
    img.src = baseSrc;
}
function syncLogoThemeTone() {
    const currentTheme = localStorage.getItem('selectedTheme') || 'default';
    if (currentTheme === 'default') {
        const defaultLogo = "images/logo.webp?v=5";
        document.querySelectorAll('.logo, .home-logo').forEach(logoEl => {
            if (logoEl.src !== defaultLogo) {
                logoEl.src = defaultLogo;
            }
        });
        return;
    }
    const { r, g, b } = getBackgroundColorRGB();
    document.querySelectorAll('.logo, .home-logo').forEach(logoEl => {
        tintLogoElementExact(logoEl, r, g, b);
    });
}
function updateMatrixTheme() {
    syncLogoThemeTone();
    refreshActiveBackground();
}
function revertLogo() {
    const defaultLogo = "images/logo.webp?v=5";
    const logoPreview = document.getElementById('logoPreview');
    const previewImg = logoPreview.querySelector('img');
    previewImg.src = defaultLogo;
    previewImg.style.display = 'block';
    logoPreview.querySelector('i').style.display = 'none';
    setSiteLogos(defaultLogo);
    localStorage.removeItem('customLogo');
    const revertBtn = event.target;
    const originalText = revertBtn.innerHTML;
    revertBtn.innerHTML = '<i class="fas fa-check"><\/i> Logo Reverted!';
    revertBtn.style.background = 'rgba(0, 255, 0, 0.2)';
    revertBtn.style.borderColor = 'var(--accent)';
    setTimeout(() => {
        revertBtn.innerHTML = originalText;
        revertBtn.style.background = '';
        revertBtn.style.borderColor = '';
    }, 1500);
}
function revertFavicon() {
    const defaultFavicon = "cuh.png";
    const defaultInactiveFavicon = "cuh.png";
    const titleInput = document.getElementById('customTitle');
    const faviconInput = document.getElementById('customFavicon');
    if (titleInput)
        titleInput.value = 'Home';
    if (faviconInput)
        faviconInput.value = defaultInactiveFavicon;
    localStorage.removeItem('inactiveTabTitle');
    localStorage.removeItem('inactiveTabFavicon');
    if (document.hidden) {
        document.title = 'Home';
        setFavicon(defaultInactiveFavicon);
    }
    const revertBtn = event.target;
    const originalText = revertBtn.innerHTML;
    revertBtn.innerHTML = '<i class="fas fa-check"><\/i> Favicon Reverted!';
    revertBtn.style.background = 'rgba(0, 255, 0, 0.2)';
    revertBtn.style.borderColor = 'var(--accent)';
    setTimeout(() => {
        revertBtn.innerHTML = originalText;
        revertBtn.style.background = '';
        revertBtn.style.borderColor = '';
    }, 1500);
}
function initializeSettings() {
    const savedCursorStyle = localStorage.getItem('cursorStyle');
    const savedCursorEnabled = localStorage.getItem('cursorEnabled');
    const initialCursorStyle = savedCursorStyle || (savedCursorEnabled === 'false' ? 'default' : 'ring');
    setCursorStyle(initialCursorStyle);
    const cursorStyleSelect = document.getElementById('cursorStyleSelect');
    if (cursorStyleSelect)
        cursorStyleSelect.value = initialCursorStyle;
    const savedTheme = localStorage.getItem('selectedTheme') || 'default';
    if (savedTheme) {
        const body = document.body;
        body.classList.remove('theme-rainbow', 'theme-cyber-green', 'theme-ice-blue', 'theme-solarized', 'theme-purple-haze');
        if (savedTheme !== 'default' && savedTheme !== 'custom') {
            body.classList.add(`theme-${savedTheme}`);
        }
        if (savedTheme === 'custom') {
            const customColor = localStorage.getItem('customThemeColor') || '#7c8cff';
            applyCustomThemeColors(customColor);
        }
        else {
            document.documentElement.style.removeProperty('--primary-accent');
            document.documentElement.style.removeProperty('--primary-accent-rgb');
            document.documentElement.style.removeProperty('--accent');
        }
    }
    const savedBackground = normalizeBackgroundStyle(localStorage.getItem('selectedBackground') || 'matrix');
    applyBackgroundStyle(savedBackground, false);
    updateMatrixTheme();
    updateCursorColors();
    const savedCustomColor = localStorage.getItem('customThemeColor');
    if (savedCustomColor) {
        document.getElementById('customHexInput').value = savedCustomColor;
        const colorPreview = document.getElementById('colorPreview');
        if (colorPreview) {
            colorPreview.style.background = savedCustomColor;
        }
    }
    const savedTitle = localStorage.getItem('inactiveTabTitle');
    const savedFavicon = localStorage.getItem('inactiveTabFavicon');
    if (savedTitle)
        document.getElementById('customTitle').value = savedTitle;
    if (savedFavicon)
        document.getElementById('customFavicon').value = savedFavicon;
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
        const logoPreview = document.getElementById('logoPreview');
        if (logoPreview) {
            const previewImg = logoPreview.querySelector('img');
            if (previewImg) {
                previewImg.src = savedLogo;
                previewImg.style.display = 'block';
                logoPreview.querySelector('i').style.display = 'none';
            }
        }
        setSiteLogos(savedLogo);
    }
    const popupAdsToggle = document.getElementById('popupAdsToggle');
    if (popupAdsToggle) {
        popupAdsToggle.checked = localStorage.getItem('popupAdsDisabled') !== 'true';
    }
    if (window.CUHAds && typeof window.CUHAds.refreshPopupAd === 'function') {
        window.CUHAds.refreshPopupAd();
    }
    applyReduceMotionPreference();
    applyCarouselAutoplayPreference();
    applyGameGridPreference();
    updateBackgroundSelectionUI();
}
function setDefaultSettings() {
    if (!localStorage.getItem('selectedTheme')) {
        localStorage.setItem('selectedTheme', 'default');
    }
    if (!localStorage.getItem('selectedBackground')) {
        localStorage.setItem('selectedBackground', 'matrix');
    }
    if (!localStorage.getItem('cursorEnabled')) {
        localStorage.setItem('cursorEnabled', 'true');
    }
    if (!localStorage.getItem('cursorStyle')) {
        localStorage.setItem('cursorStyle', 'ring');
    }
    if (!localStorage.getItem('inactiveTabTitle')) {
        localStorage.setItem('inactiveTabTitle', DEFAULT_TAB_TITLE);
    }
    if (!localStorage.getItem('inactiveTabFavicon')) {
        localStorage.setItem('inactiveTabFavicon', 'cuh.png');
    }
    if (!localStorage.getItem('carouselAutoplay')) {
        localStorage.setItem('carouselAutoplay', 'true');
    }
    if (!localStorage.getItem('reduceMotion')) {
        localStorage.setItem('reduceMotion', 'false');
    }
    if (!localStorage.getItem('gameGridColumns')) {
        localStorage.setItem('gameGridColumns', 'auto');
    }
}
const ACTIVE_GAME_ID = 'active-game-session';
const GAME_AUDIO_MUTED_KEY = 'coolGameAudioMuted';
let gameAudioMuted = false;
try {
    gameAudioMuted = localStorage.getItem(GAME_AUDIO_MUTED_KEY) === '1';
}
catch (error) {
}
const gameSessionState = {
    activeGame: null,
    hideTimer: null
};
function getGameShellElements() {
    return {
        page: document.getElementById('gamePage'),
        main: document.getElementById('main-container'),
        views: document.getElementById('gameViewStack'),
        title: document.getElementById('gameSessionTitle')
    };
}
function syncGameMuteButton() {
    const button = document.getElementById('gameMuteBtn');
    if (!button)
        return;
    const muted = gameAudioMuted;
    button.classList.toggle('is-muted', muted);
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
    button.title = muted ? 'Unmute game' : 'Mute game';
    button.setAttribute('aria-label', muted ? 'Unmute game' : 'Mute game');
    button.innerHTML = `<i class="fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}" aria-hidden="true"></i>`;
}
function toggleGameMute() {
    gameAudioMuted = !gameAudioMuted;
    try {
        localStorage.setItem(GAME_AUDIO_MUTED_KEY, gameAudioMuted ? '1' : '0');
    }
    catch (error) {
    }
    syncGameMuteButton();
    applyGameMuteToTab(getActiveGameTab());
}
window.toggleGameMute = toggleGameMute;
function updateGameSessionTitle(title = 'Select a game') {
    const titleEl = getGameShellElements().title;
    if (!titleEl)
        return;
    titleEl.textContent = title;
    syncGameMuteButton();
}
function getActiveGameTab() {
    return gameSessionState.activeGame;
}
function destroyActiveGameSession() {
    const shell = getGameShellElements();
    const activeTab = getActiveGameTab();
    if (activeTab?.loadingTimer) {
        clearTimeout(activeTab.loadingTimer);
        activeTab.loadingTimer = null;
    }
    if (activeTab) {
        requestGameProgress(activeTab);
    }
    if (activeTab?.frame) {
        freezeGameTab(activeTab);
        activeTab.frame.classList.remove('active', 'fullscreen');
        activeTab.frame.removeAttribute('srcdoc');
        try {
            activeTab.frame.src = 'about:blank';
        }
        catch (error) {
        }
        try {
            activeTab.frame.remove();
        }
        catch (error) {
        }
    }
    if (shell.views) {
        shell.views.innerHTML = '';
    }
    gameSessionState.activeGame = null;
    updateGameSessionTitle();
}
function setGameOverlayVisible(visible, options = {}) {
    const shell = getGameShellElements();
    if (!shell.page || !shell.main)
        return;
    const { destroyOnHide = false } = options;
    if (gameSessionState.hideTimer) {
        clearTimeout(gameSessionState.hideTimer);
        gameSessionState.hideTimer = null;
    }
    if (visible) {
        const wasActive = shell.page.classList.contains('active');
        if (!wasActive)
            gameOverlayReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        shell.page.setAttribute('aria-hidden', 'false');
        shell.page.classList.remove('slide-down');
        shell.page.classList.add('active');
        shell.main.classList.add('slide-down');
        const activeTab = getActiveGameTab();
        if (activeTab)
            resumeGameTab(activeTab);
        if (!wasActive) {
            const closeButton = shell.page.querySelector('.game-toolbar button[title="Exit Browser"]');
            if (closeButton)
                setTimeout(() => closeButton.focus(), 0);
        }
        return;
    }
    const activeTab = getActiveGameTab();
    if (activeTab)
        freezeGameTab(activeTab);
    shell.page.setAttribute('aria-hidden', 'true');
    shell.page.classList.add('slide-down');
    shell.main.classList.remove('slide-down');
    gameSessionState.hideTimer = setTimeout(() => {
        shell.page.classList.remove('active', 'slide-down');
        if (destroyOnHide)
            destroyActiveGameSession();
        if (gameOverlayReturnFocus && gameOverlayReturnFocus.isConnected) {
            gameOverlayReturnFocus.focus();
            gameOverlayReturnFocus = null;
        }
    }, 500);
}
function pauseMediaInFrame(frame, reset = false) {
    if (!frame)
        return;
    try {
        const iframeDoc = frame.contentDocument || frame.contentWindow.document;
        if (!iframeDoc)
            return;
        const mediaEls = iframeDoc.querySelectorAll('video, audio');
        mediaEls.forEach(media => {
            media.pause();
            if (reset)
                media.currentTime = 0;
        });
    }
    catch (error) {
    }
}
function getGameAudioMuteSource() {
    return `(function () {
  if (window.__coolGameAudioMuteInstalled) return;
  window.__coolGameAudioMuteInstalled = true;

  var STORAGE_KEY = 'coolGameAudioMuted';
  var muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (error) {}
  var contexts = [];

  function suspendContext(ctx) {
    try {
      if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') {
        Promise.resolve(ctx.suspend()).catch(function () {});
      }
    } catch (error) {}
  }

  function resumeContext(ctx) {
    try {
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        Promise.resolve(ctx.resume()).catch(function () {});
      }
    } catch (error) {}
  }

  function rememberContext(ctx) {
    if (!ctx || contexts.indexOf(ctx) !== -1) return;
    contexts.push(ctx);
    if (muted) suspendContext(ctx);
  }

  function scanKnownContexts() {
    var candidates = [];
    try { candidates.push(window.Module && window.Module.SDL2 && window.Module.SDL2.audioContext); } catch (error) {}
    try { candidates.push(window.SDL2 && window.SDL2.audioContext); } catch (error) {}
    try { candidates.push(window.Module && window.Module.audioContext); } catch (error) {}
    try { candidates.push(window.game && window.game.sound && window.game.sound.context); } catch (error) {}
    try { candidates.push(window.cc && window.cc.sys && window.cc.sys.__audioSupport && window.cc.sys.__audioSupport.context); } catch (error) {}
    try { candidates.push(window.unityInstance && window.unityInstance.Module && window.unityInstance.Module.audioContext); } catch (error) {}
    try { candidates.push(window.audioContext); } catch (error) {}
    try { candidates.push(window.audioCtx); } catch (error) {}
    for (var i = 0; i < candidates.length; i++) rememberContext(candidates[i]);
  }

  function applyMediaMuted() {
    try {
      var media = document.querySelectorAll('audio, video');
      for (var i = 0; i < media.length; i++) media[i].muted = muted;
    } catch (error) {}
  }

  function setMuted(nextMuted) {
    muted = !!nextMuted;
    window.__COOL_MUTED__ = muted;
    scanKnownContexts();
    for (var i = 0; i < contexts.length; i++) {
      if (muted) suspendContext(contexts[i]);
      else if (!window.__COOL_FROZEN__) resumeContext(contexts[i]);
    }
    applyMediaMuted();
  }

  try {
    var NativeCtor = window.AudioContext || window.webkitAudioContext;
    if (NativeCtor && !NativeCtor.__coolAudioMuteWrapped) {
      var WrappedAudioContext = function () {
        var ctx = new NativeCtor(...arguments);
        rememberContext(ctx);
        return ctx;
      };
      WrappedAudioContext.prototype = NativeCtor.prototype;
      WrappedAudioContext.__coolAudioMuteWrapped = true;
      try { Object.setPrototypeOf(WrappedAudioContext, NativeCtor); } catch (error) {}
      if (window.AudioContext) window.AudioContext = WrappedAudioContext;
      if (window.webkitAudioContext) window.webkitAudioContext = WrappedAudioContext;
    }
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor && AudioCtor.prototype && typeof AudioCtor.prototype.resume === 'function' && !AudioCtor.prototype.__coolAudioMuteResumePatched) {
      var nativeResume = AudioCtor.prototype.resume;
      AudioCtor.prototype.resume = function () {
        if (muted) return Promise.resolve();
        return nativeResume.apply(this, arguments);
      };
      AudioCtor.prototype.__coolAudioMuteResumePatched = true;
    }
  } catch (error) {}

  try {
    var baseProto = window.BaseAudioContext && window.BaseAudioContext.prototype;
    function trackContextAccess(proto, property) {
      if (!proto) return;
      var descriptor = Object.getOwnPropertyDescriptor(proto, property);
      if (!descriptor || typeof descriptor.get !== 'function' || descriptor.get.__coolAudioMuteTracked) return;
      var nativeGetter = descriptor.get;
      var wrappedGetter = function () {
        rememberContext(this);
        return nativeGetter.call(this);
      };
      wrappedGetter.__coolAudioMuteTracked = true;
      Object.defineProperty(proto, property, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: wrappedGetter,
        set: descriptor.set
      });
    }
    trackContextAccess(baseProto, 'currentTime');
    trackContextAccess(baseProto, 'destination');
    var nodeProto = window.AudioNode && window.AudioNode.prototype;
    if (nodeProto && typeof nodeProto.connect === 'function' && !nodeProto.connect.__coolAudioMuteTracked) {
      var nativeConnect = nodeProto.connect;
      var wrappedConnect = function () {
        try { rememberContext(this.context); } catch (error) {}
        return nativeConnect.apply(this, arguments);
      };
      wrappedConnect.__coolAudioMuteTracked = true;
      nodeProto.connect = wrappedConnect;
    }
  } catch (error) {}

  try {
    var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (mediaProto && typeof mediaProto.play === 'function' && !mediaProto.__coolAudioMutePlayPatched) {
      var nativePlay = mediaProto.play;
      mediaProto.play = function () {
        if (muted) {
          try { this.muted = true; } catch (error) {}
        }
        return nativePlay.apply(this, arguments);
      };
      mediaProto.__coolAudioMutePlayPatched = true;
    }
  } catch (error) {}

  try {
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (muted) applyMediaMuted();
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (error) {}

  window.addEventListener('message', function (event) {
    if (!event || !event.data || event.data.type !== 'COOL_GAME_MUTE') return;
    setMuted(!!event.data.muted);
  });

  window.__COOL_SET_MUTED__ = setMuted;
  setMuted(muted);
})();`;
}
function getGameAudioMuteScript() {
    return `<script>${getGameAudioMuteSource()}</script>`;
}
function applyGameAudioMuteToFrame(frame, depth = 0) {
    if (!frame || depth > 3)
        return;
    const muted = gameAudioMuted;
    try {
        const win = frame.contentWindow;
        if (!win)
            return;
        win.postMessage({ type: 'COOL_GAME_MUTE', muted }, '*');
        const doc = frame.contentDocument;
        if (!doc)
            return;
        if (typeof win.__COOL_SET_MUTED__ === 'function') {
            win.__COOL_SET_MUTED__(muted);
        }
        else if (doc.documentElement && !win.__coolGameAudioMuteInstalled) {
            const script = doc.createElement('script');
            script.textContent = getGameAudioMuteSource();
            (doc.head || doc.documentElement).appendChild(script);
            if (typeof win.__COOL_SET_MUTED__ === 'function')
                win.__COOL_SET_MUTED__(muted);
        }
        const childFrames = doc.querySelectorAll('iframe, frame');
        childFrames.forEach(child => {
            applyGameAudioMuteToFrame(child, depth + 1);
            if (!child.__coolGameMuteLoadBound) {
                child.__coolGameMuteLoadBound = true;
                child.addEventListener('load', () => applyGameAudioMuteToFrame(child, depth + 1));
            }
        });
    }
    catch (error) {
    }
}
function applyGameMuteToTab(tab) {
    if (!tab || !tab.frame)
        return;
    applyGameAudioMuteToFrame(tab.frame);
}
function getGameFreezeHarnessScript() {
    return `<script>
        (function() {
          if (window.__coolFreezeHarnessInstalled) return;
          window.__coolFreezeHarnessInstalled = true;

          var frozen = false;
          var rafCallbacks = new Map();
          var rafPending = new Set();
          var intervals = new Map();
          var timeouts = new Map();
          var audioContexts = [];
          var nextRafId = 1;
          var nextIntervalId = 1;
          var nextTimeoutId = 1;
          var nativeRaf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
          var nativeCancelRaf = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;
          var nativeSetInterval = window.setInterval.bind(window);
          var nativeClearInterval = window.clearInterval.bind(window);
          var nativeSetTimeout = window.setTimeout.bind(window);
          var nativeClearTimeout = window.clearTimeout.bind(window);

          function invokeSafely(cb, args, ts) {
            try {
              if (typeof ts === 'number') cb(ts);
              else cb.apply(window, args || []);
            } catch (error) {
              nativeSetTimeout(function() { throw error; }, 0);
            }
          }

          function scheduleInterval(entry) {
            entry.nativeId = nativeSetInterval(function() {
              if (frozen || !entry.active) return;
              invokeSafely(entry.cb, entry.args);
            }, entry.delay);
          }

          function scheduleTimeout(entry, delayMs) {
            var wait = Math.max(0, delayMs);
            entry.startedAt = Date.now();
            entry.nativeId = nativeSetTimeout(function() {
              if (!entry.active) return;
              entry.nativeId = null;
              if (frozen) {
                entry.remaining = Math.max(0, entry.delay - (Date.now() - entry.startedAt));
                return;
              }
              invokeSafely(entry.cb, entry.args);
              timeouts.delete(entry.id);
            }, wait);
          }

          function scheduleRaf(rafId) {
            if (!nativeRaf) return;
            nativeRaf(function(ts) {
              if (!rafCallbacks.has(rafId)) return;
              if (frozen) {
                rafPending.add(rafId);
                return;
              }
              var cb = rafCallbacks.get(rafId);
              rafCallbacks.delete(rafId);
              invokeSafely(cb, null, ts);
            });
          }

          if (nativeRaf) {
            window.requestAnimationFrame = function(cb) {
              if (typeof cb !== 'function') return nativeRaf(cb);
              var rafId = nextRafId++;
              rafCallbacks.set(rafId, cb);
              if (frozen) {
                rafPending.add(rafId);
                return rafId;
              }
              scheduleRaf(rafId);
              return rafId;
            };

            window.cancelAnimationFrame = function(rafId) {
              rafCallbacks.delete(rafId);
              rafPending.delete(rafId);
              if (nativeCancelRaf) nativeCancelRaf(rafId);
            };
          }

          window.setInterval = function(cb, delay) {
            if (typeof cb !== 'function') return nativeSetInterval(cb, delay);
            var intervalId = nextIntervalId++;
            var entry = {
              id: intervalId,
              cb: cb,
              args: Array.prototype.slice.call(arguments, 2),
              delay: Math.max(0, Number(delay) || 0),
              nativeId: null,
              active: true
            };
            intervals.set(intervalId, entry);
            if (!frozen) scheduleInterval(entry);
            return intervalId;
          };

          window.clearInterval = function(intervalId) {
            var entry = intervals.get(intervalId);
            if (!entry) {
              nativeClearInterval(intervalId);
              return;
            }
            entry.active = false;
            if (entry.nativeId !== null) nativeClearInterval(entry.nativeId);
            intervals.delete(intervalId);
          };

          window.setTimeout = function(cb, delay) {
            if (typeof cb !== 'function') return nativeSetTimeout(cb, delay);
            var timeoutId = nextTimeoutId++;
            var entry = {
              id: timeoutId,
              cb: cb,
              args: Array.prototype.slice.call(arguments, 2),
              delay: Math.max(0, Number(delay) || 0),
              remaining: Math.max(0, Number(delay) || 0),
              startedAt: 0,
              nativeId: null,
              active: true
            };
            timeouts.set(timeoutId, entry);
            if (!frozen) scheduleTimeout(entry, entry.remaining);
            return timeoutId;
          };

          window.clearTimeout = function(timeoutId) {
            var entry = timeouts.get(timeoutId);
            if (!entry) {
              nativeClearTimeout(timeoutId);
              return;
            }
            entry.active = false;
            if (entry.nativeId !== null) nativeClearTimeout(entry.nativeId);
            timeouts.delete(timeoutId);
          };

          function trackAudioContext(ctorName) {
            var NativeCtor = window[ctorName];
            if (!NativeCtor) return;
            function WrappedAudioContext() {
              var ctx = new NativeCtor(...arguments);
              audioContexts.push(ctx);
              if (frozen && typeof ctx.suspend === 'function') {
                Promise.resolve().then(function() { return ctx.suspend(); }).catch(function() {});
              }
              return ctx;
            }
            WrappedAudioContext.prototype = NativeCtor.prototype;
            Object.setPrototypeOf(WrappedAudioContext, NativeCtor);
            window[ctorName] = WrappedAudioContext;
          };
          trackAudioContext('AudioContext');
          trackAudioContext('webkitAudioContext');

          function setFrozen(nextFrozen) {
            frozen = !!nextFrozen;
            window.__COOL_FROZEN__ = frozen;

            if (frozen) {
              document.documentElement.style.animationPlayState = 'paused';
              document.documentElement.style.transitionProperty = 'none';

              intervals.forEach(function(entry) {
                if (entry.nativeId !== null) {
                  nativeClearInterval(entry.nativeId);
                  entry.nativeId = null;
                }
              });

              timeouts.forEach(function(entry) {
                if (entry.nativeId !== null) {
                  entry.remaining = Math.max(0, entry.delay - (Date.now() - entry.startedAt));
                  nativeClearTimeout(entry.nativeId);
                  entry.nativeId = null;
                }
              });

              audioContexts.forEach(function(ctx) {
                if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') {
                  Promise.resolve().then(function() { return ctx.suspend(); }).catch(function() {});
                }
              });

              try {
                var mediaEls = document.querySelectorAll('video, audio');
                mediaEls.forEach(function(media) { media.pause(); });
              } catch (error) {}
              return;
            }

            document.documentElement.style.animationPlayState = '';
            document.documentElement.style.transitionProperty = '';

            intervals.forEach(function(entry) {
              if (entry.active && entry.nativeId === null) scheduleInterval(entry);
            });

            timeouts.forEach(function(entry) {
              if (entry.active && entry.nativeId === null) scheduleTimeout(entry, entry.remaining);
            });

            audioContexts.forEach(function(ctx) {
              if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                Promise.resolve().then(function() { return ctx.resume(); }).catch(function() {});
              }
            });

            if (nativeRaf && rafPending.size) {
              var pendingIds = Array.from(rafPending);
              rafPending.clear();
              pendingIds.forEach(scheduleRaf);
            }
          }

          window.addEventListener('message', function(event) {
            if (!event || !event.data || event.data.type !== 'COOL_TAB_STATE') return;
            setFrozen(!!event.data.frozen);
          });

          window.__COOL_SET_FROZEN__ = setFrozen;
        })();
      <\/script>`;
}
function postTabFreezeMessage(tab, frozen) {
    if (!tab || !tab.frame)
        return;
    try {
        if (tab.frame.contentWindow) {
            tab.frame.contentWindow.postMessage({ type: 'COOL_TAB_STATE', frozen }, '*');
        }
    }
    catch (error) {
    }
    tab.frozen = frozen;
}
function freezeGameTab(tab) {
    if (!tab || !tab.frame)
        return;
    if (document.fullscreenElement === tab.frame && document.exitFullscreen) {
        document.exitFullscreen();
    }
    pauseMediaInFrame(tab.frame, false);
    postTabFreezeMessage(tab, true);
}
function resumeGameTab(tab) {
    if (!tab || !tab.frame)
        return;
    postTabFreezeMessage(tab, false);
}
function ensureActiveGameSession(title, url) {
    const shell = getGameShellElements();
    if (!shell.views)
        return null;
    let activeTab = getActiveGameTab();
    const needsNewFrame = !activeTab || !activeTab.frame || !activeTab.frame.isConnected;
    if (needsNewFrame) {
        shell.views.innerHTML = '';
        const frame = document.createElement('iframe');
        frame.className = 'game-frame active';
        frame.dataset.tabId = ACTIVE_GAME_ID;
        frame.setAttribute('frameborder', '0');
        frame.setAttribute('name', ACTIVE_GAME_ID);
        // Games run sandboxed: no popups/new tabs and no redirecting the page (many bundled games ship
        // ad SDKs that try both). Everything games need to actually play is still allowed.
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-pointer-lock allow-downloads allow-orientation-lock');
        frame.setAttribute('allow', 'fullscreen; autoplay; gamepad; clipboard-write');
        frame.setAttribute('allowfullscreen', '');
        frame.src = 'about:blank';
        activeTab = {
            id: ACTIVE_GAME_ID,
            title,
            url,
            gameId: gameProgressKey(url),
            lastProgressJson: '',
            frame,
            loadingTimer: null,
            frozen: false,
            loadToken: 0
        };
        frame.addEventListener('load', () => {
            const liveTab = getActiveGameTab();
            if (!liveTab || liveTab.frame !== frame)
                return;
            if (liveTab.frozen)
                pauseMediaInFrame(frame, false);
            postTabFreezeMessage(liveTab, !!liveTab.frozen);
            syncGameMuteButton();
            applyGameMuteToTab(liveTab);
        });
        shell.views.appendChild(frame);
        gameSessionState.activeGame = activeTab;
    }
    activeTab.title = title;
    activeTab.url = url;
    activeTab.gameId = gameProgressKey(url);
    activeTab.lastProgressJson = '';
    activeTab.frame.classList.add('active');
    updateGameSessionTitle(title);
    return activeTab;
}
function gameProgressKey(gameUrl) {
    var raw = String(gameUrl || '').trim();
    if (!raw) return '';
    try {
        var parsed = new URL(raw, location.href);
        return (parsed.pathname.replace(/^\/+/, '') + parsed.search).slice(0, 240);
    } catch (error) {
        return raw.slice(0, 240);
    }
}
function getGameProgressBridgeScript(gameId, progress) {
    const store = window.CoolAccountStore;
    // Guests keep the game's native local storage; only accounts get the bridge.
    if (!store || typeof store.getCurrentUser !== 'function' || !store.getCurrentUser())
        return '';
    var gameIdJson = JSON.stringify(String(gameId || '')).replace(/</g, '\\u003c');
    var seedJson = JSON.stringify(progress && typeof progress === 'object' ? progress : {})
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return `<script>
(function () {
  if (window.__coolGameProgressBridge) return;
  window.__coolGameProgressBridge = true;
  var gameId = ${gameIdJson};
  var memory = Object.create(null);
  var seed = ${seedJson};
  var lastSerialized = '';
  var timer = 0;
  var nativeSetTimeout = window.setTimeout.bind(window);
  var nativeSetInterval = window.setInterval.bind(window);
  Object.keys(seed).forEach(function (key) {
    if (typeof seed[key] === 'string') memory[String(key).slice(0, 160)] = seed[key];
  });
  lastSerialized = JSON.stringify(memory);
  function snapshot() {
    var out = {};
    Object.keys(memory).forEach(function (key) {
      var value = memory[key];
      if (typeof value === 'string' && value.length <= 120000) out[key] = value;
    });
    return out;
  }
  function send(force) {
    var payload = snapshot();
    var serialized = JSON.stringify(payload);
    if (!force && serialized === lastSerialized) return;
    lastSerialized = serialized;
    try {
      window.parent.postMessage({ type: 'COOL_GAME_PROGRESS', gameId: gameId, data: payload }, '*');
    } catch (error) {}
  }
  function schedule() {
    if (timer) return;
    timer = nativeSetTimeout(function () { timer = 0; send(false); }, 1200);
  }
  function getValue(key) {
    key = String(key);
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  var api = {
    getItem: getValue,
    setItem: function (key, value) {
      key = String(key);
      memory[key] = String(value);
      schedule();
    },
    removeItem: function (key) {
      key = String(key);
      delete memory[key];
      schedule();
    },
    clear: function () {
      Object.keys(memory).forEach(function (key) { delete memory[key]; });
      schedule();
    },
    key: function (index) {
      var keys = Object.keys(memory);
      return index >= 0 && index < keys.length ? keys[index] : null;
    }
  };
  Object.defineProperty(api, 'length', { get: function () { return Object.keys(memory).length; } });
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return api; } });
  } catch (error) {
    window.__coolGameProgressUnavailable = true;
  }
  window.addEventListener('message', function (event) {
    if (event && event.data && event.data.type === 'COOL_GAME_PROGRESS_REQUEST') send(true);
  });
  window.addEventListener('pagehide', function () { send(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send(true);
  });
  nativeSetInterval(function () { send(false); }, 5000);
})();
<\/script>`;
}
function injectFreezeHarnessIntoHtml(html, gameUrl, gameProgress) {
    if (!html || typeof html !== 'string') return html;
    // Some packed games wrap their real document in a Gadget <Module><![CDATA[...]]>
    // string. In an HTML document the CDATA marker is a bogus comment, so the
    // browser renders a blank page with a stray "]]>" instead of the game.
    if (/<Module\b[\s\S]{0,400}?<Content\b[^>]*>\s*<!\[CDATA\[/i.test(html)) {
        html = html
            .replace(/<Module\b[\s\S]*?<Content\b[^>]*>\s*<!\[CDATA\[/i, '')
            .replace(/\]\]>[\s\S]{0,40}?<\\?\/Content>[\s\S]{0,40}?<\\?\/Module>/i, '');
    }
    if (/^\s*<Module\b/i.test(html)) {
        html = html
            .replace(/^\s*(?:<Module\b[^>]*>\s*)+/i, '')
            .replace(/(?:\s*<\/Content>\s*)?<\/Module>\s*$/i, '');
    }
    let baseTag = '';
    if (!/<base\b[^>]*\bhref\s*=/i.test(html)) {
        try { baseTag = '<base href="' + new URL(gameUrl, location.href).href.replace(/"/g, '%22') + '">'; } catch (e) {}
    }
    const progressScript = getGameProgressBridgeScript(gameProgressKey(gameUrl), gameProgress);
    const compatibility = `<style id="cool-game-fill">ruffle-player,ruffle-object,object,embed{display:block;width:100% !important;height:100vh !important;max-width:100%;max-height:100%}</style>
<script>
(function () {
    try {
        if (typeof window.ga !== 'function') window.ga = function () {};
        if (!window.sdk) window.sdk = {};
        ['showBanner','hideBanner','showAd','on','gameLoadingFinished','gameStart','gameEnd'].forEach(function (name) {
            if (typeof window.sdk[name] !== 'function') window.sdk[name] = function () {};
        });
        if (typeof window.getCookie !== 'function') {
            window.getCookie = function (name) {
                var parts = document.cookie.split('; ');
                var prefix = name + '=';
                for (var i = 0; i < parts.length; i++) {
                    if (parts[i].indexOf(prefix) === 0) return decodeURIComponent(parts[i].slice(prefix.length));
                }
                return null;
            };
        }
        if (typeof window.setCookie !== 'function') {
            window.setCookie = function (name, value, days) {
                var expires = days ? '; expires=' + new Date(Date.now() + days * 864e5).toUTCString() : '';
                document.cookie = name + '=' + encodeURIComponent(value || '') + expires + '; path=/';
            };
        }
        // Sandboxed games run from about:srcdoc. Some ports try to stamp a CDN URL
        // onto history; the browser rejects that cross-origin state and the game
        // stops before it starts. Keep the state, drop only the unusable URL.
        if (window.history && typeof window.history.replaceState === 'function') {
            var nativeReplaceState = window.history.replaceState;
            var nativePushState = window.history.pushState;
            window.history.replaceState = function (state, title, url) {
                try { return nativeReplaceState.call(window.history, state, title, url); }
                catch (error) {
                    try { return nativeReplaceState.call(window.history, state, title); } catch (ignored) {}
                }
            };
            if (typeof nativePushState === 'function') {
                window.history.pushState = function (state, title, url) {
                    try { return nativePushState.call(window.history, state, title, url); }
                    catch (error) {
                        try { return nativePushState.call(window.history, state, title); } catch (ignored) {}
                    }
                };
            }
        }
        if (typeof window.maeExportApis_ !== 'function') window.maeExportApis_ = function () {};
        if (window.parent && window.parent !== window && typeof window.parent.maeExportApis_ !== 'function') {
            window.parent.maeExportApis_ = function () {};
        }
    } catch (error) {}
})();
</script>`;
    const harness = baseTag + compatibility + progressScript + '\n' + getGameFreezeHarnessScript() + '\n' + getGameAudioMuteScript();
    const urlShim = '<script>try{Object.defineProperty(document,"URL",{configurable:true,get:function(){return document.baseURI||"https://cdn.jsdelivr.net/";}});}catch(e){}<\/script>';
    const firstScript = html.search(/<script\b/i);
    const headMatch = html.search(/<head[^>]*>/i);
    const bodyMatch = html.search(/<body[^>]*>/i);
    const beforeFirstScript = index => index >= 0 && (firstScript === -1 || index < firstScript);
    if (beforeFirstScript(headMatch)) {
        return html.replace(/<head[^>]*>/i, match => `${match}\n${urlShim}\n${harness}`);
    }
    if (beforeFirstScript(bodyMatch)) {
        return html.replace(/<body[^>]*>/i, match => `${match}\n${urlShim}\n${harness}`);
    }
    return `${urlShim}\n${harness}\n${html}`;
}
function createQuickGameLoadingScreen(gameTitle) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Loading ${escapeHtml(gameTitle)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #070b16; color: #eef2ff; font-family: "Segoe UI", Arial, sans-serif; }
  .wrap { display: grid; justify-items: center; gap: 14px; padding: 24px; text-align: center; }
  .ring { width: 38px; height: 38px; border: 3px solid rgba(124, 140, 255, 0.22); border-top-color: #22d3ee; border-radius: 50%; animation: spin 0.8s linear infinite; }
  p { margin: 0; color: #9aa6c8; font-size: 14px; }
  strong { display: block; margin-bottom: 4px; color: #eef2ff; font-size: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
</style>
</head>
<body>
  <div class="wrap" role="status" aria-live="polite">
    <span class="ring" aria-hidden="true"></span>
    <p><strong>${escapeHtml(gameTitle)}</strong>Loading game…</p>
  </div>
</body>
</html>`;
}
function loadGameIntoTab(tab) {
    if (!tab || !tab.frame)
        return;
    if (tab.loadingTimer) {
        clearTimeout(tab.loadingTimer);
        tab.loadingTimer = null;
    }
    if (document.fullscreenElement === tab.frame && document.exitFullscreen) {
        document.exitFullscreen();
    }
    tab.loadToken += 1;
    const loadToken = tab.loadToken;
    tab.frozen = false;
    tab.frame.classList.add('active');
    tab.frame.classList.remove('fullscreen');
    tab.frame.srcdoc = createQuickGameLoadingScreen(tab.title);
    const liveTab = getActiveGameTab();
    if (!liveTab || liveTab.frame !== tab.frame || liveTab.loadToken !== loadToken)
        return;
    const gameUrl = liveTab.url || '';
    liveTab.gameId = gameProgressKey(gameUrl);
    const savedProgress = window.CoolAccountStore
        ? window.CoolAccountStore.getGameProgress(liveTab.gameId)
        : {};
    const isHtmlGame = /\.html?([?#].*)?$/i.test(gameUrl);
    if (isHtmlGame) {
        fetch(gameUrl)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok: ' + response.status);
                return response.text();
            })
            .then(html => {
                const currentTab = getActiveGameTab();
                if (currentTab && currentTab.frame && currentTab.loadToken === loadToken) {
                    // Pages with their own absolute CDN base already know where
                    // their assets live; srcdoc only breaks their URL resolution.
                    if (/<base\b[^>]*href\s*=\s*["']https?:/i.test(html)) {
                        currentTab.frame.removeAttribute('srcdoc');
                        currentTab.frame.src = new URL(gameUrl, window.location.href).href;
                    } else {
                        currentTab.frame.srcdoc = injectFreezeHarnessIntoHtml(html, gameUrl, savedProgress);
                    }
                }
            })
            .catch(() => {
                const currentTab = getActiveGameTab();
                if (currentTab && currentTab.frame && currentTab.loadToken === loadToken) {
                    currentTab.frame.srcdoc = createGameFrameWithHarness(gameUrl, liveTab.title);
                }
            });
    }
    else {
        liveTab.frame.srcdoc = createGameFrameWithHarness(gameUrl, liveTab.title);
    }
}
function createGameFrameWithHarness(gamePath, gameTitle) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gameTitle}</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
    ${getGameFreezeHarnessScript()}
    ${getGameAudioMuteScript()}
</head>
<body>
    <iframe id="cool-inner-game-frame" src="${gamePath}" frameborder="0" allowfullscreen></iframe>
    <script>
        (function() {
            var innerFrame = document.getElementById('cool-inner-game-frame');
            var frozen = false;
            
            function applyFrozenState() {
                if (!innerFrame) return;
                innerFrame.style.pointerEvents = frozen ? 'none' : '';
                innerFrame.style.filter = frozen ? 'saturate(0.7) brightness(0.9)' : '';
                try {
                    if (innerFrame.contentWindow) {
                        innerFrame.contentWindow.postMessage({ type: 'COOL_TAB_STATE', frozen: frozen }, '*');
                    }
                } catch (error) {}
            }

            innerFrame.addEventListener('load', function() {
                applyFrozenState();
            });

            window.addEventListener('message', function(event) {
                if (!event || !event.data || event.data.type !== 'COOL_TAB_STATE') return;
                frozen = !!event.data.frozen;
                applyFrozenState();
            });
        })();
    </script>
</body>
</html>`;
}
function requestGameProgress(tab) {
    if (!tab || !tab.frame) return;
    try {
        if (tab.frame.contentWindow) {
            tab.frame.contentWindow.postMessage({ type: 'COOL_GAME_PROGRESS_REQUEST' }, '*');
        }
    } catch (error) {}
}
window.addEventListener('message', function (event) {
    const tab = getActiveGameTab();
    if (!tab || !tab.frame || event.source !== tab.frame.contentWindow) return;
    const message = event.data;
    if (!message || message.type !== 'COOL_GAME_PROGRESS' || message.gameId !== tab.gameId) return;
    const store = window.CoolAccountStore;
    if (!store || typeof store.getCurrentUser !== 'function' || !store.getCurrentUser()) return;
    const serialized = JSON.stringify(message.data || {});
    if (serialized === tab.lastProgressJson) return;
    tab.lastProgressJson = serialized;
    store.setGameProgress(message.gameId, message.data);
});
function openLesson(t, u, options = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'game_launch', {
            'event_category': 'game_interaction',
            'event_label': t,
            'value': 1
        });
    }
    const timeOnSite = Math.round((Date.now() - window.pageLoadTime) / 1000);
    if (typeof gtag !== 'undefined') {
        gtag('event', 'timing_complete', {
            'name': 'time_to_first_game',
            'value': timeOnSite,
            'event_category': 'engagement'
        });
    }
    const normalizedUrl = (u || '').trim();
    recordRecentGame(t, normalizedUrl);
    const requestedGame = games.find(item => item.title === t);
    if (requestedGame && requestedGame.browser && typeof window.openBrowserOverlay === 'function') {
        if (options.replaceUrl && hasLegacyGameLocation())
            clearGameUrl('replace');
        window.openBrowserOverlay(normalizedUrl);
        return;
    }
    const activeTab = getActiveGameTab();
    if (activeTab && activeTab.title === t && (activeTab.url || '').trim() === normalizedUrl) {
        updateGameSessionTitle(activeTab.title);
        setGameOverlayVisible(true);
        syncGameUrl(t, options);
        syncGameFavoriteButton();
        syncGameOpenRawButton();
        return;
    }
    const tab = ensureActiveGameSession(t, normalizedUrl);
    if (!tab)
        return;
    setGameOverlayVisible(true);
    syncGameUrl(t, options);
    syncGameFavoriteButton();
    syncGameOpenRawButton();
    loadGameIntoTab(tab);
}
function exitGameBrowser(options = {}) {
    requestGameProgress(getActiveGameTab());
    setGameOverlayVisible(false, { destroyOnHide: true });
    if (!options.skipUrl)
        clearGameUrl();
}
function copyGameLink() {
    const active = getActiveGameTab();
    if (!active)
        return;
    const slug = gameSlug(active.title);
    if (!slug)
        return;
    const next = new URL(location.href);
    next.searchParams.delete('game');
    next.hash = 'game=' + encodeURIComponent(slug);
    const link = next.href;
    const button = document.querySelector('[data-copy-game-link]');
    const showCopied = function () {
        if (!button)
            return;
        button.classList.add('is-copied');
        button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
        button.title = 'Link copied';
        button.setAttribute('aria-label', 'Link copied');
        setTimeout(function () {
            button.classList.remove('is-copied');
            button.innerHTML = '<i class="fas fa-link" aria-hidden="true"></i>';
            button.title = 'Copy game link';
            button.setAttribute('aria-label', 'Copy game link');
        }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(showCopied).catch(function () {
            window.prompt('Copy this game link:', link);
        });
    }
    else {
        window.prompt('Copy this game link:', link);
    }
}
window.copyGameLink = copyGameLink;
window.addEventListener('popstate', function () {
    const slug = gameHistorySlug() || gameHashSlug() || new URLSearchParams(location.search).get('game');
    const active = getActiveGameTab();
    if (slug) {
        const game = findGameBySlug(slug);
        if (game) {
            if (!active || active.title !== game.title)
                openLesson(game.title, game.url, { replaceUrl: true });
            else if (hasLegacyGameLocation())
                syncGameUrl(game.title, { replaceUrl: true });
        }
        else if (hasLegacyGameLocation()) {
            clearGameUrl('replace');
        }
    }
    else if (active) {
        exitGameBrowser({ skipUrl: true });
    }
});
window.addEventListener('hashchange', function () {
    const slug = gameHashSlug();
    if (!slug)
        return;
    const game = findGameBySlug(slug);
    if (game)
        openLesson(game.title, game.url, { replaceUrl: true });
    else
        clearGameUrl('replace');
});
document.addEventListener('visibilitychange', () => {
    const activeTab = getActiveGameTab();
    if (!activeTab)
        return;
    if (document.hidden) {
        freezeGameTab(activeTab);
    }
    else if (document.getElementById('gamePage')?.classList.contains('active')) {
        resumeGameTab(activeTab);
    }
});
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        openSettings();
    }
});
function readStorageObject(storage) {
    const data = {};
    if (!storage)
        return data;
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null)
            data[key] = storage.getItem(key);
    }
    return data;
}
function parseCookiesToObject() {
    const cookieObject = {};
    const raw = document.cookie || '';
    if (!raw.trim())
        return cookieObject;
    raw.split(';').forEach(cookiePart => {
        const [rawKey, ...rest] = cookiePart.split('=');
        const key = (rawKey || '').trim();
        if (!key)
            return;
        cookieObject[key] = rest.join('=').trim();
    });
    return cookieObject;
}
function getAllSettings() {
    let localData = readStorageObject(window.localStorage);
    let sessionData = readStorageObject(window.sessionStorage);
    if (window.CoolAccountStore) {
        localData = window.CoolAccountStore.redactStorageSnapshot(localData);
        sessionData = window.CoolAccountStore.redactStorageSnapshot(sessionData);
    }
    const cookiesData = parseCookiesToObject();
    return {
        version: '2.0',
        exportDate: new Date().toISOString(),
        siteName: "Cool Tutoring Hub",
        exportType: 'site-data',
        localStorageData: localData,
        sessionStorageData: sessionData,
        cookiesData: cookiesData,
        favorites: Array.isArray(favorites) ? favorites : [],
        settings: {
            selectedTheme: localData.selectedTheme || 'default',
            selectedBackground: localData.selectedBackground || 'matrix',
            customThemeColor: localData.customThemeColor || '#7c8cff',
            cursorEnabled: localData.cursorEnabled || 'true',
            cursorStyle: localData.cursorStyle || 'ring',
            inactiveTabTitle: localData.inactiveTabTitle || DEFAULT_TAB_TITLE,
            inactiveTabFavicon: localData.inactiveTabFavicon || 'cuh.png',
            customLogo: localData.customLogo || null,
            flashEnabled: localData.flashEnabled || 'true',
            popupAdsDisabled: localData.popupAdsDisabled || 'false',
            lastSearchTerm: localData.lastSearchTerm || '',
            sortMethod: localData.sortMethod || 'default',
            carouselAutoplay: localData.carouselAutoplay || 'true',
            reduceMotion: localData.reduceMotion || 'false',
            gameGridColumns: localData.gameGridColumns || 'auto'
        }
    };
}
function isAccountLockedForDataExport() {
    return typeof window.__coolsAccountLocked === 'function' && window.__coolsAccountLocked();
}
function exportSettings() {
    if (isAccountLockedForDataExport()) {
        showImportStatus('Data export is locked for banned or deleted accounts.', 'error');
        return;
    }
    const settings = getAllSettings();
    const settingsJson = JSON.stringify(settings, null, 2);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `coolstutoring-site-data-${timestamp}.json`;
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showImportStatus('Site data exported successfully!', 'success');
        if (typeof gtag !== 'undefined') {
            gtag('event', 'settings_export', {
                'event_category': 'settings',
                'event_label': 'export',
                'value': 1
            });
        }
    }, 100);
}
function importSettings() {
    if (isAccountLockedForDataExport()) {
        showImportStatus('Data import is locked for banned or deleted accounts.', 'error');
        return;
    }
    const importContainer = document.getElementById('importFileContainer');
    const statusDiv = document.getElementById('settingsImportStatus');
    if (importContainer.style.display === 'none') {
        importContainer.style.display = 'flex';
        statusDiv.style.display = 'none';
        return;
    }
    const fileInput = document.getElementById('settingsFileInput');
    if (!fileInput.files || !fileInput.files[0]) {
        showImportStatus('Please select a data export file first.', 'error');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedSettings = JSON.parse(e.target.result);
            if (!validateSettings(importedSettings)) {
                showImportStatus('Invalid data export file format.', 'error');
                return;
            }
            if (confirm(`Import this site data backup? Current local data will be overwritten.`)) {
                applyImportedSettings(importedSettings);
                showImportStatus('Site data imported successfully!', 'success');
                closeSettings();
                if (fileInput) {
                    fileInput.value = '';
                    importContainer.style.display = 'none';
                }
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'settings_import', {
                        'event_category': 'settings',
                        'event_label': 'import',
                        'value': 1
                    });
                }
            }
        }
        catch (error) {
            console.error('Error importing settings:', error);
            showImportStatus('Error reading data export file.', 'error');
        }
    };
    reader.onerror = function () {
        showImportStatus('Error reading file.', 'error');
    };
    reader.readAsText(file);
}
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object')
        return false;
    const hasLegacySettings = settings.settings && typeof settings.settings === 'object';
    const hasStorageSnapshot = settings.localStorageData && typeof settings.localStorageData === 'object';
    if (!hasLegacySettings && !hasStorageSnapshot)
        return false;
    if (settings.favorites !== undefined && !Array.isArray(settings.favorites)) {
        return false;
    }
    return true;
}
function applyImportedSettings(importedSettings) {
    const preservedAccounts = window.CoolAccountStore ? window.CoolAccountStore.snapshotAccountKeys() : {};
    if (importedSettings.localStorageData && typeof importedSettings.localStorageData === 'object') {
        localStorage.clear();
        Object.entries(importedSettings.localStorageData).forEach(([key, value]) => {
            if (typeof key !== 'string' || !key) return;
            if (window.CoolAccountStore && window.CoolAccountStore.isAccountKey(key)) return;
            localStorage.setItem(key, value === null || value === undefined ? '' : String(value));
        });
    }
    if (window.CoolAccountStore) window.CoolAccountStore.restoreAccountKeys(preservedAccounts);
    if (importedSettings.sessionStorageData && typeof importedSettings.sessionStorageData === 'object') {
        sessionStorage.clear();
        Object.entries(importedSettings.sessionStorageData).forEach(([key, value]) => {
            if (typeof key === 'string' && key) {
                sessionStorage.setItem(key, value === null || value === undefined ? '' : String(value));
            }
        });
    }
    if (importedSettings.cookiesData && typeof importedSettings.cookiesData === 'object') {
        Object.entries(importedSettings.cookiesData).forEach(([key, value]) => {
            if (typeof key === 'string' && key) {
                document.cookie = `${key}=${value ?? ''}; path=/; max-age=31536000`;
            }
        });
    }
    if (importedSettings.favorites && Array.isArray(importedSettings.favorites)) {
        favorites = importedSettings.favorites;
        localStorage.setItem('gameFavorites', JSON.stringify(favorites));
    }
    const settings = importedSettings.settings && typeof importedSettings.settings === 'object'
        ? importedSettings.settings
        : {
            selectedTheme: localStorage.getItem('selectedTheme') || 'default',
            selectedBackground: localStorage.getItem('selectedBackground') || 'matrix',
            customThemeColor: localStorage.getItem('customThemeColor') || '#7c8cff',
            cursorEnabled: localStorage.getItem('cursorEnabled') || 'true',
            cursorStyle: localStorage.getItem('cursorStyle') || 'ring',
            inactiveTabTitle: localStorage.getItem('inactiveTabTitle') || DEFAULT_TAB_TITLE,
            inactiveTabFavicon: localStorage.getItem('inactiveTabFavicon') || 'cuh.png',
            customLogo: localStorage.getItem('customLogo') || null,
            flashEnabled: localStorage.getItem('flashEnabled') || 'true',
            popupAdsDisabled: localStorage.getItem('popupAdsDisabled') || 'false',
            lastSearchTerm: localStorage.getItem('lastSearchTerm') || '',
            sortMethod: localStorage.getItem('sortMethod') || 'default',
            carouselAutoplay: localStorage.getItem('carouselAutoplay') || 'true',
            reduceMotion: localStorage.getItem('reduceMotion') || 'false',
            gameGridColumns: localStorage.getItem('gameGridColumns') || 'auto'
        };
    Object.keys(settings).forEach(key => {
        if (settings[key] !== null && settings[key] !== undefined) {
            localStorage.setItem(key, String(settings[key]));
        }
    });
    const selectedTheme = settings.selectedTheme || 'default';
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`.theme-option[data-theme="${selectedTheme}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }
    const body = document.body;
    body.classList.remove('theme-rainbow', 'theme-cyber-green', 'theme-ice-blue', 'theme-solarized', 'theme-purple-haze');
    if (selectedTheme !== 'default' && selectedTheme !== 'custom') {
        body.classList.add(`theme-${selectedTheme}`);
    }
    if (selectedTheme === 'custom') {
        const customColor = settings.customThemeColor || '#7c8cff';
        applyCustomThemeColors(customColor);
        const colorPreview = document.getElementById('colorPreview');
        const hexInput = document.getElementById('customHexInput');
        if (colorPreview)
            colorPreview.style.background = customColor;
        if (hexInput)
            hexInput.value = customColor;
    }
    else {
        document.documentElement.style.removeProperty('--primary-accent');
        document.documentElement.style.removeProperty('--primary-accent-rgb');
        document.documentElement.style.removeProperty('--accent');
    }
    updateMatrixTheme();
    const selectedBackground = normalizeBackgroundStyle(settings.selectedBackground || 'matrix');
    applyBackgroundStyle(selectedBackground, false);
    updateBackgroundSelectionUI();
    const restoredCursorStyle = settings.cursorStyle || (settings.cursorEnabled === 'false' ? 'default' : 'ring');
    setCursorStyle(restoredCursorStyle);
    const cursorStyleSelect = document.getElementById('cursorStyleSelect');
    if (cursorStyleSelect) {
        cursorStyleSelect.value = restoredCursorStyle;
    }
    if (settings.customLogo) {
        const logoPreview = document.getElementById('logoPreview');
        if (logoPreview) {
            const previewImg = logoPreview.querySelector('img');
            if (previewImg) {
                previewImg.src = settings.customLogo;
                previewImg.style.display = 'block';
                logoPreview.querySelector('i').style.display = 'none';
            }
        }
        setSiteLogos(settings.customLogo);
    }
    else {
        const defaultLogo = "images/logo.webp?v=5";
        const logoPreview = document.getElementById('logoPreview');
        setSiteLogos(defaultLogo);
        if (logoPreview) {
            const previewImg = logoPreview.querySelector('img');
            if (previewImg) {
                previewImg.src = defaultLogo;
                previewImg.style.display = 'block';
                logoPreview.querySelector('i').style.display = 'none';
            }
        }
    }
    const titleInput = document.getElementById('customTitle');
    const faviconInput = document.getElementById('customFavicon');
    if (titleInput && settings.inactiveTabTitle) {
        titleInput.value = settings.inactiveTabTitle;
    }
    if (faviconInput && settings.inactiveTabFavicon) {
        faviconInput.value = settings.inactiveTabFavicon;
    }
    updateCursorColors();
    refreshActiveBackground();
    try {
        localStorage.removeItem('adsDisabled');
    }
    catch (error) {
    }
    applyReduceMotionPreference();
    applyCarouselAutoplayPreference();
    applyGameGridPreference();
    const popupAdsToggle = document.getElementById('popupAdsToggle');
    if (popupAdsToggle) {
        popupAdsToggle.checked = localStorage.getItem('popupAdsDisabled') !== 'true';
    }
    if (window.CUHAds && typeof window.CUHAds.refreshPopupAd === 'function') {
        window.CUHAds.refreshPopupAd();
    }
}
function showImportStatus(message, type) {
    const statusDiv = document.getElementById('settingsImportStatus');
    if (!statusDiv)
        return;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.style.color = type === 'success' ? 'var(--accent)' : '#ff4444';
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('settingsFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                const statusDiv = document.getElementById('settingsImportStatus');
                statusDiv.textContent = `Selected: ${this.files[0].name}`;
                statusDiv.style.display = 'block';
                statusDiv.style.color = 'var(--primary-accent)';
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            exportSettings();
        }
    });
});
const backToTopBtn = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
    const gamePage = document.getElementById('gamePage');
    const backToTopBtn = document.getElementById("backToTop");
    if (!backToTopBtn)
        return;
    if (gamePage && gamePage.classList.contains('active')) {
        backToTopBtn.classList.remove("show");
        return;
    }
    if (window.scrollY > 14000) {
        backToTopBtn.classList.add("show");
    }
    else {
        backToTopBtn.classList.remove("show");
    }
});
function convertToCompatibleUrl(url) {
    return url;
}
function loadGameWithCompatibleUrl(title, originalUrl) {
    const compatibleUrl = convertToCompatibleUrl(originalUrl);
    openLesson(title, compatibleUrl);
}
function refreshGame() {
    const activeTab = getActiveGameTab();
    if (!activeTab)
        return;
    if (typeof gtag !== 'undefined') {
        gtag('event', 'game_refresh', {
            'event_category': 'game_interaction',
            'event_label': activeTab.title,
            'value': 1
        });
    }
    loadGameIntoTab(activeTab);
}
function updateGameDisplay(games) {
    const container = document.getElementById('allLessonsGrid');
    if (!container)
        return;
    bindLessonGridEvents(container);
    container.innerHTML = games.map(game => gameCardMarkup(game)).join('');
    initCursorHover();
    setTimeout(() => {
        initFadeObserver();
    }, 50);
}
document.addEventListener('DOMContentLoaded', function () {
    const quotes = [
        "Check out all these amazing lessons (none of these are actually lessons)",
        "400+ unblocked games for when the teacher isn't looking",
        "Your favorite games, all in one place... unlike your grades",
        "The ultimate school gaming hub for professional procrastinators",
        "Play now, learn never",
        "Better than doing homework, trust me I checked",
        "Teacher won't even notice, just keep that tab ready to switch",
        "Secret games are hidden... you gotta find the secret word...",
        "Made by the thugs, for the thugs",
        "Your #1 source for unblocked lessons and bad life choices",
        "Game on, or whatever the kids say these days",
		"Poker? I hardly even know her!",
        "Chat, is this real?",
        "Yk people think you actually learn on here?",
        "If anyone asks, this is a research project",
        "Hopefully your teacher doesnt check your browser history",
        "If the site crashes, it's actually a feature",
        "The code is held together by hopes and prayers",
        "If you find a bug, just ignore it and keep playing",
        "This site is 100% safe, I promise",
        "Heyyyyyy this isnt your math homework",
        "BOMBOCLATTTTTTTTTTTTTTTTTTTTT",
        "Look at the cool backrounds @builder267 made",
        "Ouuuuuh you not my type a lil shitttt",
        "Ohhhh la laaaaa look at this new site design",
        "Whats cookin good lookin?",
        "Youuuuu are feeling VERYYYYY bored... and you want to play MOREEEE games",
        "Hey google show me this guys balls please",
        "My name is anderdingus",
        "Yo speed my reboot card expires in...",
        "Yo yo yo its hump day, what ima need you to do is tag three big di-",
        "but what if hunter hogg really is a femboy tho...?",
        "Hey Alexa how do you say purple in english?",
        "Put the yager black ice in my ass",
        "If this site doesnt work out im making an only fans",
        "I try to add games as quick as possible",
        "PLEASEEEE DONT WHIP ME ANYMORE",
        "I miss the old kanye",
        "Yo who can slide me their penjamin",
        "Fadded than a hoe fadded than a hoe fadded than a hoe",
        "If you're seeing this message its for seahanna heheheheh",
        "shush baka!~ your so mean to me thug-kun.. this is peak!",
        "AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
        "What if we kissed at the cools tutoring loading screen? Haha jk... unless?",
        "My lawyer has advised me not to finish this senten—",
        "Im changing my bloodline with this site frl",
        "I can see your ip (thats a joke please dont sue me)",
        "If you want to know my favorite game its bedwars on minecraft",
        "You miss 95% of the shots you dont take",
        "95% of gamblers give up right before they win",
        "You're in a simulation GET OUT GET OUT GET OUT GET OUT GET OUT GET OUT GET OUT GET OUT GET OUT",
        "We ALL going to tel aviv",
        "Yo grok show me this guy with his pants off",
        "Hey google show me this guys balls please",
        "If your reading this crtl+shift+q+q ur homies chromie",
        "blah blah blah bleh bleh bleh blue blue blueeee",
        "a fawk u mama huevo",
        "japan is turning footseps into electricity",
        "SHE GON CALL ME BABY BOO",
        "ts so crispy",
        "I WANNA BE A THUGGIE WUGGY",
        "Do it jiggle doe?",
        "Im bouta do a money spread",
        "Teach me how to duggy teach me teach me how to duggy",
        "W speed ❤️",
        "Hello im the little goblin thats chained up and writing these quotes",
        "Theres bug under your skin GET THEM OUT NOW",
        "Too much radio not enough head",
        "To be ballin you gotta b-all-in",
        "lowkey im just better",
        "It be the ones closest to you with the sharpest fangs",
        "Life is hard but im harder",
        "Hoes mad",
        "jarvis, more alcohol",
        "I AM the lion",
        "If one man can hold you down TWO can....",
        "B.D.K.M.V",
        "Dont make me up the pole on you mf",
        "Alr bro ts was not the wind",
        "are u from mississippi?",
        "Banana",
        "dubist gut genug",
    ];
    const typingElement = document.getElementById('typing-quote');
    if (!typingElement)
        return;
    let currentQuote = "";
    let charIndex = 0;
    let isDeleting = false;
    let isWaiting = false;
    function getRandomQuote() {
        return quotes[Math.floor(Math.random() * quotes.length)];
    }
    currentQuote = getRandomQuote();
    function typeEffect() {
        if (isDeleting) {
            typingElement.textContent = currentQuote.substring(0, charIndex - 1);
            charIndex--;
        }
        else {
            typingElement.textContent = currentQuote.substring(0, charIndex + 1);
            charIndex++;
        }
        if (!isDeleting && charIndex === currentQuote.length) {
            isWaiting = true;
            setTimeout(() => {
                isDeleting = true;
                isWaiting = false;
                typeEffect();
            }, 2000);
            return;
        }
        else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            let newQuote;
            do {
                newQuote = getRandomQuote();
            } while (newQuote === currentQuote && quotes.length > 1);
            currentQuote = newQuote;
            setTimeout(typeEffect, 500);
            return;
        }
        const speed = isDeleting ? 50 : 100;
        setTimeout(typeEffect, speed);
    }
    setTimeout(typeEffect, 1000);
});
const LESSON_GRID_COLUMNS = 3;
var inFeedAd = document.getElementById('adInFeed');
let inFeedResizeTimer;
function placeInFeedAd() {
    const grid = document.getElementById('allLessonsGrid');
    if (!inFeedAd || !grid)
        return;
    const visibleCards = Array.from(grid.querySelectorAll('.lesson-card'))
        .filter(card => card.style.display !== 'none');
    const columnCount = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
    const hasAd = Boolean(inFeedAd.querySelector('.ad-unit'));
    if (!hasAd || visibleCards.length < columnCount * 5) {
        inFeedAd.hidden = true;
        return;
    }
    inFeedAd.hidden = false;
    if (inFeedAd.parentElement !== grid) {
        grid.appendChild(inFeedAd);
    }
}
function applyGridColumns(columns) {
    const preference = columns === '3' || columns === '4' || columns === '5' ? columns : getGameGridPreference();
    const value = preference === 'auto' ? '' : preference;
    const lessonsGrid = document.getElementById('allLessonsGrid');
    if (lessonsGrid) {
        if (value)
            lessonsGrid.setAttribute('data-columns', value);
        else
            lessonsGrid.removeAttribute('data-columns');
    }
    const anyGrids = document.querySelectorAll('.lessons-grid');
    anyGrids.forEach(grid => {
        if (grid.id !== 'homeCarouselGrid') {
            if (value)
                grid.setAttribute('data-columns', value);
            else
                grid.removeAttribute('data-columns');
        }
    });
}
if (typeof generateGameCards === 'function') {
    const originalGenerateGameCards = generateGameCards;
    window.generateGameCards = function () {
        originalGenerateGameCards();
        applyGridColumns();
    };
}
if (typeof applySorting === 'function') {
    const originalApplySorting = applySorting;
    window.applySorting = function () {
        originalApplySorting();
        placeInFeedAd();
        setTimeout(() => {
            applyGridColumns();
            placeInFeedAd();
        }, 50);
    };
}
window.addEventListener('resize', function () {
    clearTimeout(inFeedResizeTimer);
    inFeedResizeTimer = setTimeout(placeInFeedAd, 150);
});
localStorage.removeItem('gridColumns');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyGridColumns());
}
else {
    applyGridColumns();
}
