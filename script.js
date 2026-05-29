// ── Colour palette for intervals (cycles if more than 8) ────────────────────

const PALETTE = [
  { stroke: '#1a56c4', badge: '#e8f0fe', text: '#1a56c4', border: '#a8c3fa' },
  { stroke: '#1e6e34', badge: '#e6f4ea', text: '#1e6e34', border: '#a8d5b5' },
  { stroke: '#b45309', badge: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { stroke: '#7c3aed', badge: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  { stroke: '#be185d', badge: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { stroke: '#0e7490', badge: '#cffafe', text: '#0e7490', border: '#67e8f9' },
  { stroke: '#065f46', badge: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  { stroke: '#9a3412', badge: '#ffedd5', text: '#9a3412', border: '#fdba74' },
];

const CHIMES = [
  [783, 659, 523],
  [523, 659, 783],
  [659, 783, 880],
  [880, 783, 659],
];

const DEFAULT_INTERVALS = [
  { name: 'Sit',   mins: 30 },
  { name: 'Stand', mins: 10 },
];

// ── Persistence ──────────────────────────────────────────────────────────────

function loadIntervals() {
  try {
    const saved = localStorage.getItem('intervals');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_INTERVALS.map(i => ({ ...i }));
}

function saveIntervals(intervals) {
  localStorage.setItem('intervals', JSON.stringify(intervals));
}

// ── Timer state ──────────────────────────────────────────────────────────────

let intervals  = loadIntervals();
let phaseIndex = 0;
let remaining  = intervals[0].mins * 60;
let running    = false;
let ticker     = null;

const CIRC = 2 * Math.PI * 98;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const timeEl       = document.getElementById('time-display');
const labelEl      = document.getElementById('phase-label');
const circle       = document.getElementById('progress');
const btnLabel     = document.getElementById('btn-label');
const btnIcon      = document.getElementById('btn-icon');
const carouselTrack = document.getElementById('carousel-track');
const intervalList = document.getElementById('interval-list');

const PLAY_ICON  = '<path d="M8 5v14l11-7z"/>';
const PAUSE_ICON = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

// ── Formatting ───────────────────────────────────────────────────────────────

function fmt(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Carousel ─────────────────────────────────────────────────────────────────

// Max number of items visible in the track at once (active + neighbours each side)
const CAROUSEL_VISIBLE = 5;

function renderCarousel() {
  carouselTrack.innerHTML = '';
  intervals.forEach((iv, i) => {
    const c = PALETTE[i % PALETTE.length];
    const item = document.createElement('span');
    item.className = 'carousel-item';
    item.id = 'ci-' + i;
    item.textContent = iv.name + ' · ' + iv.mins + 'm';
    item.style.color = c.text;
    carouselTrack.appendChild(item);
  });
  updateCarousel();
}

function updateCarousel() {
  const items = carouselTrack.querySelectorAll('.carousel-item');
  const n = intervals.length;

  items.forEach((item, i) => {
    const c = PALETTE[i % PALETTE.length];
    const dist = Math.min(Math.abs(i - phaseIndex), n - Math.abs(i - phaseIndex));
    item.classList.remove('active', 'neighbour');
    if (i === phaseIndex) {
      item.classList.add('active');
      item.style.background = c.badge;
      item.style.borderColor = c.border;
    } else {
      item.style.background = '#fafafa';
      item.style.borderColor = '#e8e8e8';
      if (dist === 1) item.classList.add('neighbour');
    }
  });

  // Slide track so active item is centred
  // Measure after a tick to ensure items are laid out
  requestAnimationFrame(() => {
    const activeEl = document.getElementById('ci-' + phaseIndex);
    if (!activeEl) return;
    const trackRect = carouselTrack.parentElement.getBoundingClientRect();
    const itemRect  = activeEl.getBoundingClientRect();
    // Current offset already applied via transform, so work from offsetLeft
    const offset = activeEl.offsetLeft - (carouselTrack.parentElement.offsetWidth / 2) + (activeEl.offsetWidth / 2);
    carouselTrack.style.transform = 'translateX(' + (-offset) + 'px)';
  });
}

// ── Main UI update ───────────────────────────────────────────────────────────

function updateUI() {
  const iv   = intervals[phaseIndex];
  const c    = PALETTE[phaseIndex % PALETTE.length];
  const frac = remaining / (iv.mins * 60);

  timeEl.textContent  = fmt(remaining);
  labelEl.textContent = iv.name;

  circle.style.strokeDashoffset = CIRC * (1 - frac);
  circle.style.stroke = c.stroke;

  updateCarousel();
}

// ── Chime ────────────────────────────────────────────────────────────────────

function playChime(freqs) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } catch (e) {}
}

// ── Timer controls ───────────────────────────────────────────────────────────

function nextPhase() {
  phaseIndex = (phaseIndex + 1) % intervals.length;
  remaining  = intervals[phaseIndex].mins * 60;
  playChime(CHIMES[phaseIndex % CHIMES.length]);
  updateUI();
}

function startTicker() {
  ticker = setInterval(() => {
    remaining--;
    if (remaining <= 0) nextPhase();
    else updateUI();
  }, 1000);
}

function toggleTimer() {
  if (running) {
    clearInterval(ticker);
    running = false;
    btnLabel.textContent = 'Resume';
    btnIcon.innerHTML    = PLAY_ICON;
  } else {
    running = true;
    btnLabel.textContent = 'Pause';
    btnIcon.innerHTML    = PAUSE_ICON;
    startTicker();
  }
}

function resetTimer() {
  clearInterval(ticker);
  running    = false;
  phaseIndex = 0;
  remaining  = intervals[0].mins * 60;
  btnLabel.textContent = 'Start';
  btnIcon.innerHTML    = PLAY_ICON;
  updateUI();
}

function skipPhase() {
  nextPhase();
  if (running) {
    clearInterval(ticker);
    startTicker();
  }
}

// ── Settings panel — drag and drop ───────────────────────────────────────────

let dragSrcIndex = null;

function readPanelIntervals() {
  const rows = intervalList.querySelectorAll('.interval-row');
  const result = [];
  rows.forEach(row => {
    const name = row.querySelector('input[type="text"]').value.trim() || 'Interval';
    const mins = Math.max(1, parseInt(row.querySelector('input[type="number"]').value, 10) || 1);
    result.push({ name, mins });
  });
  return result;
}

function renderIntervalList() {
  intervalList.innerHTML = '';
  intervals.forEach((iv, i) => {
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.draggable = true;
    row.dataset.index = i;

    row.innerHTML =
      '<span class="drag-handle" title="Drag to reorder">' +
        '<svg viewBox="0 0 24 24" width="14" height="14">' +
          '<circle cx="9"  cy="5"  r="1.4" fill="#bbb"/>' +
          '<circle cx="15" cy="5"  r="1.4" fill="#bbb"/>' +
          '<circle cx="9"  cy="12" r="1.4" fill="#bbb"/>' +
          '<circle cx="15" cy="12" r="1.4" fill="#bbb"/>' +
          '<circle cx="9"  cy="19" r="1.4" fill="#bbb"/>' +
          '<circle cx="15" cy="19" r="1.4" fill="#bbb"/>' +
        '</svg>' +
      '</span>' +
      '<input type="text" value="' + escHtml(iv.name) + '" placeholder="Name" maxlength="20">' +
      '<input type="number" value="' + iv.mins + '" min="1" max="999">' +
      '<span class="unit">min</span>' +
      '<button class="icon-btn delete" onclick="removeInterval(' + i + ')" title="Remove"' + (intervals.length <= 1 ? ' disabled' : '') + '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
      '</button>';

    // ── Drag events ──
    row.addEventListener('dragstart', e => {
      // Snapshot input values so reorder uses current text
      intervals = readPanelIntervals();
      dragSrcIndex = i;
      e.dataTransfer.effectAllowed = 'move';
      // Small delay so the ghost image renders before the class applies opacity
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('.interval-row').forEach(r => r.classList.remove('drag-over'));
      dragSrcIndex = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (i === dragSrcIndex) return;
      document.querySelectorAll('.interval-row').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === i) return;
      const moved = intervals.splice(dragSrcIndex, 1)[0];
      intervals.splice(i, 0, moved);
      dragSrcIndex = null;
      renderIntervalList();
    });

    intervalList.appendChild(row);
  });
}

function addInterval() {
  intervals = readPanelIntervals();
  intervals.push({ name: 'Interval', mins: 5 });
  renderIntervalList();
  intervalList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Focus the name field of the new row
  const rows = intervalList.querySelectorAll('.interval-row');
  rows[rows.length - 1]?.querySelector('input[type="text"]')?.focus();
}

function removeInterval(i) {
  intervals = readPanelIntervals();
  if (intervals.length <= 1) return;
  intervals.splice(i, 1);
  renderIntervalList();
}

function togglePanel() {
  const open = document.getElementById('panel').classList.toggle('open');
  document.getElementById('settings-btn').classList.toggle('shifted', open);
  document.getElementById('overlay').classList.toggle('visible', open);
  if (open) renderIntervalList();
}

function closePanel() {
  document.getElementById('panel').classList.remove('open');
  document.getElementById('settings-btn').classList.remove('shifted');
  document.getElementById('overlay').classList.remove('visible');
}

function applySettings() {
  const newIntervals = readPanelIntervals();
  if (newIntervals.length === 0) return;
  intervals = newIntervals;
  saveIntervals(intervals);
  renderCarousel();
  resetTimer();
  closePanel();
}

// ── Init ─────────────────────────────────────────────────────────────────────

renderCarousel();
updateUI();
