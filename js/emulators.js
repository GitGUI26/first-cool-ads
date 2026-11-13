(function () {
  'use strict';

  var CDN_DATA = 'https://cdn.emulatorjs.org/stable/data/';
  var ANDROID_URL = 'android.html';
  var SYSTEMS = [
    { id: 'nes', label: 'Nintendo Entertainment System / Famicom', short: 'NES', group: 'Nintendo', core: 'nes', exts: ['nes', 'fds', 'unf'], bios: false, hint: 'Famicom Disk System games may need their BIOS.' },
    { id: 'snes', label: 'Super Nintendo / Super Famicom', short: 'SNES', group: 'Nintendo', core: 'snes', exts: ['sfc', 'smc', 'fig', 'swc', 'bs'], bios: false, hint: 'BS-X and Sufami Turbo games may need their optional BIOS.' },
    { id: 'n64', label: 'Nintendo 64', short: 'N64', group: 'Nintendo', core: 'n64', exts: ['z64', 'n64', 'v64', 'rom'], bios: false, hint: '' },
    { id: 'gb', label: 'Game Boy / Game Boy Color', short: 'GB / GBC', group: 'Nintendo', core: 'gb', exts: ['gb', 'gbc'], bios: false, hint: '' },
    { id: 'gba', label: 'Game Boy Advance', short: 'GBA', group: 'Nintendo', core: 'gba', exts: ['gba'], bios: false, hint: '' },
    { id: 'nds', label: 'Nintendo DS', short: 'NDS', group: 'Nintendo', core: 'nds', exts: ['nds'], bios: false, hint: 'Most games boot without a BIOS; add one if your dump asks for it.' },
    { id: 'vb', label: 'Virtual Boy', short: 'VB', group: 'Nintendo', core: 'vb', exts: ['vb', 'vboy'], bios: false, hint: '' },
    { id: '3ds', label: 'Nintendo 3DS (experimental)', short: '3DS', group: 'Nintendo', core: '3ds', exts: ['3ds', 'cci', 'cxi'], bios: false, hint: '3DS support is experimental and may be slow or incomplete.' },

    { id: 'psx', label: 'PlayStation', short: 'PS1', group: 'Sony', core: 'psx', exts: ['cue', 'bin', 'iso', 'img', 'chd', 'pbp'], bios: true, hint: 'A PlayStation BIOS file is usually required. Use a single-disc image or a ZIP containing the cue and bin files.' },
    { id: 'psp', label: 'PlayStation Portable', short: 'PSP', group: 'Sony', core: 'psp', exts: ['iso', 'cso', 'pbp'], bios: false, hint: '' },

    { id: 'segaMD', label: 'Sega Genesis / Mega Drive', short: 'Genesis', group: 'Sega', core: 'segaMD', exts: ['md', 'gen', 'smd', 'bin'], bios: false, hint: '' },
    { id: 'segaMS', label: 'Sega Master System', short: 'Master System', group: 'Sega', core: 'segaMS', exts: ['sms', 'bin'], bios: false, hint: '' },
    { id: 'segaGG', label: 'Sega Game Gear', short: 'Game Gear', group: 'Sega', core: 'segaGG', exts: ['gg'], bios: false, hint: '' },
    { id: 'segaCD', label: 'Sega CD / Mega CD', short: 'Sega CD', group: 'Sega', core: 'segaCD', exts: ['cue', 'bin', 'iso', 'chd'], bios: true, hint: 'A Sega CD BIOS file is required. Put cue and bin files in one ZIP or use a single CHD.' },
    { id: 'sega32x', label: 'Sega 32X', short: '32X', group: 'Sega', core: 'sega32x', exts: ['32x', 'bin'], bios: false, hint: '' },
    { id: 'segaSaturn', label: 'Sega Saturn', short: 'Saturn', group: 'Sega', core: 'segaSaturn', exts: ['cue', 'bin', 'iso', 'chd'], bios: true, hint: 'A Saturn BIOS file is required. Use a single-disc image or a ZIP containing the cue and bin files.' },

    { id: 'atari2600', label: 'Atari 2600', short: '2600', group: 'Atari', core: 'atari2600', exts: ['a26', 'bin'], bios: false, hint: '' },
    { id: 'atari5200', label: 'Atari 5200', short: '5200', group: 'Atari', core: 'atari5200', exts: ['a52', 'bin'], bios: true, hint: 'An Atari 5200 BIOS is required for most dumps.' },
    { id: 'atari7800', label: 'Atari 7800', short: '7800', group: 'Atari', core: 'atari7800', exts: ['a78', 'bin'], bios: false, hint: '' },
    { id: 'jaguar', label: 'Atari Jaguar', short: 'Jaguar', group: 'Atari', core: 'jaguar', exts: ['j64', 'jag', 'bin'], bios: false, hint: '' },
    { id: 'lynx', label: 'Atari Lynx', short: 'Lynx', group: 'Atari', core: 'lynx', exts: ['lnx', 'bin'], bios: false, hint: '' },

    { id: 'arcade', label: 'Arcade (FBNeo)', short: 'FBNeo', group: 'Arcade', core: 'arcade', exts: ['zip', '7z'], bios: false, hint: 'Use a complete, non-merged arcade ROM set in one ZIP.' },
    { id: 'mame2003', label: 'Arcade (MAME 2003)', short: 'MAME 2003', group: 'Arcade', core: 'mame2003', exts: ['zip', '7z'], bios: false, hint: 'Use a ROM set made for MAME 2003. Other sets may not load.' },

    { id: 'pce', label: 'PC Engine / TurboGrafx-16', short: 'PCE', group: 'NEC / SNK', core: 'pce', exts: ['pce', 'bin'], bios: false, hint: 'CD titles may need a system card or BIOS.' },
    { id: 'pcfx', label: 'PC-FX', short: 'PC-FX', group: 'NEC / SNK', core: 'pcfx', exts: ['cue', 'bin', 'iso', 'chd'], bios: true, hint: 'A PC-FX BIOS is required.' },
    { id: 'ngp', label: 'Neo Geo Pocket / Color', short: 'NGP', group: 'NEC / SNK', core: 'ngp', exts: ['ngp', 'ngc'], bios: false, hint: '' },
    { id: 'ws', label: 'WonderSwan / WonderSwan Color', short: 'WonderSwan', group: 'NEC / SNK', core: 'ws', exts: ['ws', 'wsc'], bios: false, hint: '' },

    { id: 'c64', label: 'Commodore 64', short: 'C64', group: 'Computers', core: 'c64', exts: ['d64', 't64', 'tap', 'prg', 'crt'], bios: false, hint: 'JiffyDOS is optional; the standard Commodore ROMs are built in.' },
    { id: 'c128', label: 'Commodore 128', short: 'C128', group: 'Computers', core: 'c128', exts: ['d64', 'd71', 'd81', 'tap', 'prg', 'crt'], bios: false, hint: '' },
    { id: 'amiga', label: 'Commodore Amiga', short: 'Amiga', group: 'Computers', core: 'amiga', exts: ['adf', 'hdf', 'ipf', 'dms'], bios: true, hint: 'A Kickstart ROM is required. Pick the BIOS that matches the game.' },
    { id: 'pet', label: 'Commodore PET', short: 'PET', group: 'Computers', core: 'pet', exts: ['prg', 'tap', 'd64'], bios: false, hint: '' },
    { id: 'plus4', label: 'Commodore Plus/4', short: 'Plus/4', group: 'Computers', core: 'plus4', exts: ['prg', 'tap', 'd64'], bios: false, hint: '' },
    { id: 'vic20', label: 'Commodore VIC-20', short: 'VIC-20', group: 'Computers', core: 'vic20', exts: ['prg', 'tap', 'd64', 'crt'], bios: false, hint: '' },
    { id: 'dos', label: 'DOS (DOSBox Pure)', short: 'DOS', group: 'Computers', core: 'dos', exts: ['zip', 'dosz', 'jsdos'], bios: false, hint: 'Put the game and its files in one ZIP, or use a DOSZ/JSDOS package.' },

    { id: '3do', label: '3DO Interactive Multiplayer', short: '3DO', group: 'Other', core: '3do', exts: ['iso', 'cue', 'chd'], bios: true, hint: 'A 3DO BIOS is required.' },
    { id: 'coleco', label: 'ColecoVision', short: 'ColecoVision', group: 'Other', core: 'coleco', exts: ['col', 'bin'], bios: true, hint: 'A ColecoVision BIOS is required for most dumps.' }
  ];
  var GROUP_ORDER = ['Nintendo', 'Sony', 'Sega', 'Atari', 'Arcade', 'NEC / SNK', 'Computers', 'Other'];
  var BY_ID = Object.create(null);
  var initialized = false;
  var frame = null;
  var romFile = null;
  var biosFile = null;
  var romUrl = '';
  var biosUrl = '';

  SYSTEMS.forEach(function (system) { BY_ID[system.id] = system; });

  function $(id) { return document.getElementById(id); }

  function systemById(id) { return id ? BY_ID[id] || null : null; }

  function extensionOf(name) {
    var match = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    return match ? match[1] : '';
  }

  function detectSystem(file) {
    if (!file) return null;
    var extension = extensionOf(file.name);
    var matches = SYSTEMS.filter(function (system) { return system.exts.indexOf(extension) !== -1; });
    return matches.length === 1 ? matches[0] : null;
  }

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setStatus(text, state) {
    var status = $('emulatorStatus');
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state || '';
  }

  function renderEmptyStage() {
    var stage = $('emulatorStage');
    if (!stage) return;
    stage.innerHTML = '<div class="emulator-empty"><i class="fas fa-gamepad" aria-hidden="true"></i><h3>Your ROM or Android goes here</h3><p>Choose a supported ROM and press Play ROM, or boot the Android virtual device.</p></div>';
    $('emulatorStageTitle').textContent = 'No device loaded';
  }

  function releaseUrls() {
    if (romUrl) {
      try { URL.revokeObjectURL(romUrl); } catch (error) {}
      romUrl = '';
    }
    if (biosUrl) {
      try { URL.revokeObjectURL(biosUrl); } catch (error) {}
      biosUrl = '';
    }
  }

  function removeFrame() {
    if (!frame) return;
    try { frame.src = 'about:blank'; } catch (error) {}
    frame.remove();
    frame = null;
  }

  function selectedSystem() {
    var select = $('emulatorSystem');
    if (!select) return null;
    if (select.value) return systemById(select.value);
    return detectSystem(romFile);
  }

  function updateBiosUi(system) {
    var details = $('biosDetails');
    var note = $('emulatorBiosNote');
    var file = $('biosFile');
    if (!details || !note || !file) return;
    var needsBios = !!(system && system.bios);
    details.open = needsBios && !biosFile;
    note.textContent = needsBios
      ? (system.hint || 'This system may require a BIOS file for some games.')
      : (system && system.hint ? system.hint : 'Most games do not need a BIOS. Add one only if your core asks for it.');
    file.hidden = !biosFile;
    file.textContent = biosFile ? 'BIOS: ' + biosFile.name + ' · ' + formatBytes(biosFile.size) : '';
  }

  function updateUi() {
    var fileBox = $('romFile');
    var fileName = $('romFileName');
    var fileMeta = $('romFileMeta');
    var coreNote = $('emulatorCoreNote');
    var start = $('emulatorStart');
    var clear = $('emulatorClear');
    var system = selectedSystem();

    if (fileBox) fileBox.hidden = !romFile;
    if (fileName) fileName.textContent = romFile ? romFile.name : 'No file selected';
    if (fileMeta) fileMeta.textContent = romFile ? formatBytes(romFile.size) + ' · stays on this device' : '';
    if (coreNote) {
      coreNote.textContent = system
        ? 'Core: ' + system.core + ' · ' + system.label
        : (romFile ? 'Choose a console above; this file type is shared by more than one system.' : 'Pick a ROM to see its matching core.');
    }
    updateBiosUi(system);
    if (start) start.disabled = !romFile || !system;
    if (clear) clear.disabled = !romFile && !frame;
    if (!romFile) setStatus('Choose a ROM or boot Android to begin.');
    else if (!system) setStatus('Choose the console for this file.', 'warning');
    else if (!frame) setStatus('Ready: ' + system.short + ' · ' + formatBytes(romFile.size), 'ready');
  }

  function chooseRom(file) {
    if (!file) return;
    romFile = file;
    var detected = detectSystem(file);
    var select = $('emulatorSystem');
    if (select && detected) select.value = detected.id;
    updateUi();
  }

  function chooseBios(file) {
    biosFile = file || null;
    updateUi();
  }

  function buildSystemOptions() {
    var select = $('emulatorSystem');
    if (!select) return;
    select.replaceChildren();
    var auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Auto-detect from file extension';
    select.appendChild(auto);
    GROUP_ORDER.forEach(function (groupName) {
      var systems = SYSTEMS.filter(function (system) { return system.group === groupName; });
      if (!systems.length) return;
      var optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      systems.forEach(function (system) {
        var option = document.createElement('option');
        option.value = system.id;
        option.textContent = system.label;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
  }

  function gameIdFor(file) {
    var seed = String(file.name || '') + ':' + String(file.size || 0) + ':' + String(file.lastModified || 0);
    var hash = 0;
    for (var i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return Math.max(1, Math.abs(hash) || 1);
  }

  function startAndroid(event) {
    if (event) event.preventDefault();
    var stage = $('emulatorStage');
    var start = $('emulatorStart');
    var clear = $('emulatorClear');
    var title = $('emulatorStageTitle');
    if (!stage) return;

    removeFrame();
    releaseUrls();
    romFile = null;
    biosFile = null;
    var romInput = $('romInput');
    var biosInput = $('biosInput');
    var systemSelect = $('emulatorSystem');
    var fileBox = $('romFile');
    var coreNote = $('emulatorCoreNote');
    if (romInput) romInput.value = '';
    if (biosInput) biosInput.value = '';
    if (systemSelect) systemSelect.value = '';
    if (fileBox) fileBox.hidden = true;
    if (coreNote) coreNote.textContent = 'Android 4.4 · v86 · in this panel';

    frame = document.createElement('iframe');
    frame.className = 'emulator-frame';
    frame.title = 'Android 4.4 virtual device';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('allow', 'fullscreen; autoplay; gamepad; pointer-lock');
    frame.src = ANDROID_URL + '?embed=1';
    frame.addEventListener('load', function () {
      setStatus('Android is ready. Press Start in the device to boot. First boot streams about 360 MB and can take several minutes.', 'ready');
    });
    frame.addEventListener('error', function () {
      setStatus('The Android device could not load.', 'error');
    });

    stage.replaceChildren(frame);
    if (title) title.textContent = 'Android 4.4 · v86';
    if (start) start.disabled = true;
    if (clear) clear.disabled = false;
    setStatus('Loading the Android device. Press Start when it appears. First boot streams about 360 MB.', 'loading');
  }

  function startEmulator() {
    var system = selectedSystem();
    if (!romFile || !system) {
      updateUi();
      return;
    }
    var stage = $('emulatorStage');
    var start = $('emulatorStart');
    if (!stage) return;

    removeFrame();
    releaseUrls();

    try {
      romUrl = URL.createObjectURL(romFile);
      if (biosFile) biosUrl = URL.createObjectURL(biosFile);
    } catch (error) {
      setStatus('This browser could not open that ROM file.', 'error');
      return;
    }

    var params = new URLSearchParams();
    params.set('core', system.core);
    params.set('rom', romUrl);
    params.set('name', String(romFile.name || 'rom').replace(/[<>]/g, '').slice(0, 100));
    params.set('gameId', String(gameIdFor(romFile)));
    if (biosUrl) params.set('bios', biosUrl);

    frame = document.createElement('iframe');
    frame.className = 'emulator-frame';
    frame.title = 'Emulator: ' + system.label;
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('allow', 'fullscreen; gamepad; autoplay; clipboard-read; clipboard-write');
    frame.src = 'emulator-frame.html?' + params.toString();
    frame.addEventListener('load', function () {
      if (start) start.disabled = false;
      setStatus('Starting ' + system.short + '...', 'loading');
    });
    frame.addEventListener('error', function () {
      if (start) start.disabled = false;
      setStatus('The emulator frame could not load.', 'error');
    });

    stage.replaceChildren(frame);
    if (start) start.disabled = true;
    var title = $('emulatorStageTitle');
    if (title) title.textContent = romFile.name + ' · ' + system.short;
    setStatus('Starting ' + system.short + '...', 'loading');
  }

  function clearEmulator() {
    removeFrame();
    releaseUrls();
    romFile = null;
    biosFile = null;
    var romInput = $('romInput');
    var biosInput = $('biosInput');
    var systemSelect = $('emulatorSystem');
    if (romInput) romInput.value = '';
    if (biosInput) biosInput.value = '';
    if (systemSelect) systemSelect.value = '';
    renderEmptyStage();
    updateUi();
    setStatus('Choose a ROM or boot Android to begin.');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    buildSystemOptions();

    var dropzone = $('romDropzone');
    var romInput = $('romInput');
    var biosInput = $('biosInput');
    var systemSelect = $('emulatorSystem');
    var start = $('emulatorStart');
    var clear = $('emulatorClear');
    var androidStart = $('androidStart');

    if (androidStart) androidStart.addEventListener('click', startAndroid);

    if (dropzone && romInput) {
      dropzone.addEventListener('click', function (event) {
        if (event.target === romInput) return;
        romInput.click();
      });
      dropzone.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        romInput.click();
      });
      ['dragenter', 'dragover'].forEach(function (name) {
        dropzone.addEventListener(name, function (event) {
          event.preventDefault();
          dropzone.classList.add('is-dragging');
        });
      });
      ['dragleave', 'drop'].forEach(function (name) {
        dropzone.addEventListener(name, function (event) {
          event.preventDefault();
          if (name === 'dragleave' && event.relatedTarget && dropzone.contains(event.relatedTarget)) return;
          dropzone.classList.remove('is-dragging');
        });
      });
      dropzone.addEventListener('drop', function (event) {
        var files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) chooseRom(files[0]);
      });
      romInput.addEventListener('change', function () {
        chooseRom(romInput.files && romInput.files[0]);
      });
    }

    if (biosInput) {
      biosInput.addEventListener('change', function () {
        chooseBios(biosInput.files && biosInput.files[0]);
      });
    }
    if (systemSelect) {
      systemSelect.addEventListener('change', updateUi);
    }
    if (start) start.addEventListener('click', startEmulator);
    if (clear) clear.addEventListener('click', clearEmulator);

    window.addEventListener('message', function (event) {
      if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return;
      var data = event.data || {};
      if (data.type === 'emulator-ready') {
        if (start) start.disabled = false;
        setStatus('Emulator ready. Press Start Game in the player.', 'ready');
      } else if (data.type === 'emulator-error') {
        if (start) start.disabled = false;
        setStatus(String(data.message || 'The emulator could not start.'), 'error');
      }
    });

    window.addEventListener('app:switch-tab', function (event) {
      var active = event.detail && event.detail.tab === 'emulators';
      document.body.classList.toggle('emulator-active', active);
      if (!active && frame && !frame.dataset.external && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'emulator-pause' }, location.origin);
      }
      if (active && dropzone) {
        window.setTimeout(function () { dropzone.focus(); }, 50);
      }
    });

    window.addEventListener('beforeunload', releaseUrls);
    renderEmptyStage();
    updateUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
