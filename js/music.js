(function () {
  'use strict';

  var API = 'https://api.audius.co/v1';
  var APP_NAME = 'CoolTutoringHub';
  var LIMIT = 18;
  var form = document.getElementById('audiusSearchForm');
  var input = document.getElementById('audiusSearchInput');
  var results = document.getElementById('musicResults');
  var status = document.getElementById('musicStatus');
  var audio = document.getElementById('musicAudio');
  var title = document.getElementById('musicTrackTitle');
  var artist = document.getElementById('musicTrackArtist');
  var cover = document.getElementById('musicCover');

  if (!form || !input || !results || !status || !audio || !title || !artist || !cover) return;

  var tracks = [];
  var activeIndex = -1;
  var initialized = false;
  var controller = null;
  var submit = form.querySelector('button[type="submit"]');

  function artistName(track) {
    return (track && track.user && (track.user.name || track.user.handle)) || 'Unknown artist';
  }

  function formatDuration(seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total < 0) return '';
    var mins = Math.floor(total / 60);
    var secs = Math.floor(total % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function artworkUrl(track) {
    var art = track && track.artwork;
    if (!art) return '';
    return art['480x480'] || art['150x150'] || art['1000x1000'] || '';
  }

  function icon(name, className) {
    var node = document.createElement('i');
    node.className = (className || 'fas') + ' ' + name;
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('is-error', !!isError);
  }

  function setCover(url) {
    cover.replaceChildren();
    if (!url) {
      cover.appendChild(icon('fa-headphones'));
      return;
    }
    var image = document.createElement('img');
    image.alt = '';
    image.src = url;
    image.addEventListener('error', function () {
      cover.replaceChildren(icon('fa-headphones'));
    }, { once: true });
    cover.appendChild(image);
  }

  function makeResult(track, index) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'music-result';
    row.setAttribute('data-track-index', String(index));
    row.setAttribute('aria-label', 'Play ' + (track.title || 'track') + ' by ' + artistName(track));

    var art = document.createElement('span');
    art.className = 'music-result-art';
    var artUrl = artworkUrl(track);
    if (artUrl) {
      var thumb = document.createElement('img');
      thumb.src = artUrl;
      thumb.alt = '';
      thumb.loading = 'lazy';
      art.appendChild(thumb);
    } else {
      art.appendChild(icon('fa-music'));
    }

    var copy = document.createElement('span');
    copy.className = 'music-result-copy';
    var name = document.createElement('strong');
    name.className = 'music-result-title';
    name.textContent = track.title || 'Untitled track';
    var meta = document.createElement('span');
    meta.className = 'music-result-meta';
    meta.textContent = [artistName(track), track.genre].filter(Boolean).join(' · ');
    copy.appendChild(name);
    copy.appendChild(meta);

    var length = document.createElement('span');
    length.className = 'music-result-duration';
    length.textContent = formatDuration(track.duration);

    row.appendChild(art);
    row.appendChild(copy);
    row.appendChild(length);
    row.addEventListener('click', function () { play(index); });
    return row;
  }

  function renderResults() {
    results.replaceChildren();
    if (!tracks.length) {
      var empty = document.createElement('p');
      empty.className = 'music-empty';
      empty.textContent = 'No tracks found. Try a different search.';
      results.appendChild(empty);
      return;
    }
    tracks.forEach(function (track, index) {
      results.appendChild(makeResult(track, index));
    });
  }

  function markPlaying(index) {
    results.querySelectorAll('.music-result').forEach(function (row) {
      var isPlaying = Number(row.getAttribute('data-track-index')) === index;
      row.classList.toggle('is-playing', isPlaying);
    });
  }

  function play(index) {
    var track = tracks[index];
    if (!track || !track.id) return;
    activeIndex = index;
    setCover(artworkUrl(track));
    title.textContent = track.title || 'Untitled track';
    artist.textContent = [artistName(track), track.genre].filter(Boolean).join(' · ');
    markPlaying(index);

    audio.src = API + '/tracks/' + encodeURIComponent(track.id) +
      '/stream?app_name=' + encodeURIComponent(APP_NAME);

    var attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(function () {
        setStatus('Press play on the player to start the track.', false);
      });
    }
  }

  async function loadTracks(query) {
    if (controller) controller.abort();
    var thisController = new AbortController();
    controller = thisController;
    var search = String(query || '').trim();
    var url = API + (search
      ? '/tracks/search?query=' + encodeURIComponent(search) + '&'
      : '/tracks/trending?') +
      'app_name=' + encodeURIComponent(APP_NAME) + '&limit=' + LIMIT;

    setStatus(search ? 'Searching…' : 'Loading trending…', false);
    results.setAttribute('aria-busy', 'true');
    if (submit) submit.disabled = true;

    try {
      var response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: thisController.signal
      });
      if (!response.ok) throw new Error('Music request returned ' + response.status);
      var payload = await response.json();
      tracks = (Array.isArray(payload.data) ? payload.data : [])
        .filter(function (track) { return track && track.id; })
        .slice(0, LIMIT);
      renderResults();
      if (tracks.length) {
        setStatus(search ? tracks.length + ' results' : 'Trending now', false);
      } else {
        setStatus('No tracks found.', true);
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      tracks = [];
      renderResults();
      setStatus('Music service is unavailable. Try again in a moment.', true);
    } finally {
      if (controller === thisController) {
        results.removeAttribute('aria-busy');
        if (submit) submit.disabled = false;
      }
    }
  }

  function ensureLoaded() {
    if (initialized) return;
    initialized = true;
    loadTracks('');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    initialized = true;
    loadTracks(input.value);
  });

  audio.addEventListener('error', function () {
    if (activeIndex !== -1) {
      setStatus('That track could not be streamed. Try another one.', true);
    }
  });

  window.addEventListener('app:switch-tab', function (event) {
    if (event.detail && event.detail.tab === 'music') ensureLoaded();
  });

  if (document.documentElement.dataset.activeTab === 'music') ensureLoaded();
})();
