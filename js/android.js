(function () {
  'use strict';

  var IMAGE_URL = '/api/android-image/android_x86_nonsse3_4.4r1_20140904/.iso';
  var IMAGE_SIZE = 247463936;
  var IMAGE_CHUNK = 1048576;
  var params = new URLSearchParams(window.location.search);
  var embedded = params.get('embed') === '1';
  if (embedded) document.documentElement.classList.add('is-embedded');

  var screen = document.getElementById('screen_container');
  var startScreen = document.getElementById('androidStartScreen');
  var bootButton = document.getElementById('androidBoot');
  var bootMeta = document.getElementById('androidBootMeta');
  var errorBox = document.getElementById('androidError');
  var statePill = document.getElementById('androidState');
  var statusLine = document.getElementById('androidStatus');
  var powerButton = document.getElementById('androidPower');
  var pauseButton = document.getElementById('androidPause');
  var restartButton = document.getElementById('androidRestart');
  var fullscreenButton = document.getElementById('androidFullscreen');
  var screenWrap = document.getElementById('androidScreenWrap');
  var emulator = null;
  var paused = false;
  var booting = false;
  var started = false;
  var runRequested = false;
  var readyWatcher = 0;
  var lastProgressAt = 0;

  function setState(label, state) {
    if (statePill) {
      statePill.textContent = label;
      statePill.dataset.state = state || 'idle';
    }
  }

  function setStatus(text, isError) {
    if (!statusLine) return;
    statusLine.textContent = text;
    statusLine.style.color = isError ? '#ffb4bd' : '';
  }

  function showError(message) {
    window.clearInterval(readyWatcher);
    if (!errorBox) return;
    if (startScreen) startScreen.hidden = false;
    errorBox.hidden = false;
    errorBox.textContent = message;
    setState('Failed', 'error');
    setStatus(message, true);
    if (bootButton) bootButton.disabled = false;
    booting = false;
  }

  function setRunningUi() {
    if (startScreen) startScreen.hidden = true;
    if (powerButton) powerButton.textContent = 'Running';
    if (pauseButton) pauseButton.disabled = false;
    if (restartButton) restartButton.disabled = false;
    if (fullscreenButton) fullscreenButton.disabled = false;
    if (bootMeta) bootMeta.textContent = 'Android is running in this tab.';
  }

  function startReadyWatch() {
    window.clearInterval(readyWatcher);
    readyWatcher = window.setInterval(function () {
      if (!started || paused || !screen) return;
      var canvas = screen.querySelector('canvas');
      if (!canvas || canvas.style.display === 'none' || !canvas.width || !canvas.height) return;
      try {
        var sample = document.createElement('canvas');
        sample.width = 32;
        sample.height = 24;
        var ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, 32, 24);
        var data = ctx.getImageData(0, 0, 32, 24).data;
        var lit = 0;
        for (var i = 0; i < data.length; i += 4) {
          if (data[i] + data[i + 1] + data[i + 2] > 60) lit += 1;
        }
        if (lit > 0.18 * 32 * 24) {
          window.clearInterval(readyWatcher);
          setState('Running', 'running');
          setStatus('Android is ready. Click the screen to capture the mouse; press Esc to release it.');
        }
      } catch (error) {}
    }, 2500);
  }

  function runEmulator() {
    if (!emulator || runRequested) return;
    runRequested = true;
    emulator.run().catch(function (error) {
      runRequested = false;
      showError('Android could not start: ' + ((error && error.message) || 'unknown emulator error'));
    });
  }

  function boot() {
    if (booting) return;
    if (emulator) {
      if (paused) {
        paused = false;
        if (pauseButton) pauseButton.textContent = 'Pause';
        setState('Running', 'running');
        setStatus('Resuming Android…');
        emulator.run().catch(function () { showError('Android could not resume. Reload the page to try again.'); });
      } else if (!runRequested) {
        setState('Starting', 'loading');
        setStatus('Starting the Android runtime…');
        runEmulator();
      }
      return;
    }

    if (!window.V86) {
      showError('The v86 runtime did not load. Reload the page and try again.');
      return;
    }

    booting = true;
    if (bootButton) bootButton.disabled = true;
    if (errorBox) errorBox.hidden = true;
    if (startScreen) startScreen.hidden = false;
    setState('Starting', 'loading');
    setStatus('Starting the v86 runtime. The first boot streams Android in chunks…');
    if (bootMeta) bootMeta.textContent = 'Loading the emulator…';

    try {
      emulator = new window.V86({
        wasm_path: 'v86/v86.wasm',
        memory_size: 512 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: screen,
        bios: { url: 'v86/seabios.bin' },
        vga_bios: { url: 'v86/vgabios.bin' },
        cdrom: {
          url: IMAGE_URL,
          size: IMAGE_SIZE,
          async: true,
          use_parts: true,
          fixed_chunk_size: IMAGE_CHUNK
        },
        autostart: false
      });

      emulator.add_listener('emulator-loaded', function () {
        setState('Starting', 'loading');
        setStatus('Emulator loaded. Booting Android…');
        runEmulator();
      });

      emulator.add_listener('emulator-ready', function () {
        setState('Booting', 'loading');
        setStatus('Android is booting. The first boot may take a minute or two…');
        if (bootMeta) bootMeta.textContent = 'Booting Android-x86…';
      });

      emulator.add_listener('emulator-started', function () {
        booting = false;
        started = true;
        setRunningUi();
        setState('Booting', 'loading');
        setStatus('Android is booting. The first boot can take several minutes; the screen changes when Android is ready.');
        startReadyWatch();
        // Android-x86 stops at its boot menu; the public v86 profile sends Enter
        // after three seconds so the default entry continues automatically.
        window.setTimeout(function () {
          if (!emulator || paused) return;
          try { emulator.keyboard_send_text('\n'); } catch (error) {}
        }, 3000);

      });

      emulator.add_listener('download-progress', function (event) {
        if (!event || !event.lengthComputable) return;
        var now = Date.now();
        if (now - lastProgressAt < 350) return;
        lastProgressAt = now;
        var loaded = Number(event.loaded) || 0;
        var total = Number(event.total) || 0;
        if (!total) return;
        var percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
        if (bootMeta) bootMeta.textContent = 'Downloading Android image… ' + percent + '%';
        setState('Booting ' + percent + '%', 'loading');
      });

      emulator.add_listener('download-error', function (event) {
        var name = event && event.file_name ? ' (' + event.file_name + ')' : '';
        showError('A required Android image chunk could not be loaded' + name + '. The image host or its mirror may be unavailable. Check your connection and try again.');
      });


    } catch (error) {
      showError('Android could not start: ' + ((error && error.message) || 'unknown emulator error'));
    }
  }

  function togglePause() {
    if (!emulator || !started) return;
    window.clearInterval(readyWatcher);
    if (paused) {
      paused = false;
      if (pauseButton) pauseButton.textContent = 'Pause';
      setState('Running', 'running');
      setStatus('Resuming Android…');
      emulator.run().catch(function () { showError('Android could not resume.'); });
      startReadyWatch();
    } else {
      paused = true;
      if (pauseButton) pauseButton.textContent = 'Resume';
      setState('Paused', 'idle');
      setStatus('Android is paused.');
      Promise.resolve(emulator.stop()).catch(function () {});
    }
  }

  function restart() {
    if (!emulator || !started) return;
    window.clearInterval(readyWatcher);
    paused = false;
    if (pauseButton) pauseButton.textContent = 'Pause';
    setState('Restarting', 'loading');
    setStatus('Restarting Android…');
    try { emulator.restart(); } catch (error) { showError('Android could not restart.'); }
    window.setTimeout(startReadyWatch, 5000);
  }

  function goFullscreen() {
    var target = screenWrap || screen;
    if (!target) return;
    var request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    if (request) {
      Promise.resolve(request.call(target)).catch(function () {});
    } else if (emulator && typeof emulator.screen_go_fullscreen === 'function') {
      emulator.screen_go_fullscreen();
    }
  }

  if (bootButton) bootButton.addEventListener('click', boot);
  if (powerButton) powerButton.addEventListener('click', boot);
  if (pauseButton) pauseButton.addEventListener('click', togglePause);
  if (restartButton) restartButton.addEventListener('click', restart);
  if (fullscreenButton) fullscreenButton.addEventListener('click', goFullscreen);
  if (screen) screen.addEventListener('click', function () {
    if (!started || !emulator) return;
    if (typeof emulator.lock_mouse === 'function') {
      Promise.resolve(emulator.lock_mouse()).catch(function () { if (emulator.focus) emulator.focus(); });
    } else if (emulator.focus) {
      emulator.focus();
    }
  });


  if (embedded) {
    setStatus('Press Start to boot Android-x86 4.4 in this panel. Nothing is uploaded.');
  }
})();
