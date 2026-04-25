// =============================================
//  UCJ - GPS Tracker Module
// =============================================

let matchMinute = 0;
let gpsRunning = false;
let gpsBackendMode = false;
const API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:8000';
const METRICA_SAMPLE_STEP = 10;
let metricaPlayback = {
  loaded: false,
  playing: false,
  speed: 1,
  index: 0,
  frames: [],
  timer: null,
  sourceKey: '',
};
let selectedMetricaPlayerId = null;
let gpsPreviewTimer = null;
let gpsAutoAnalysis = {
  enabled: false,
  nextMinute: null,
  intervalMinutes: 5,
  inFlight: false,
};
const GPS_PREVIEW_PLAYERS = [
  // Home, left side: 4-3-3
  { id: 'H1', team: 'Home', x: 58, y: 220 },
  { id: 'H2', team: 'Home', x: 128, y: 82 },
  { id: 'H3', team: 'Home', x: 128, y: 174 },
  { id: 'H4', team: 'Home', x: 128, y: 266 },
  { id: 'H5', team: 'Home', x: 128, y: 358 },
  { id: 'H6', team: 'Home', x: 202, y: 125 },
  { id: 'H7', team: 'Home', x: 202, y: 220 },
  { id: 'H8', team: 'Home', x: 202, y: 315 },
  { id: 'H9', team: 'Home', x: 276, y: 105 },
  { id: 'H10', team: 'Home', x: 276, y: 220 },
  { id: 'H11', team: 'Home', x: 276, y: 335 },
  // Away, right side: 4-3-2-1
  { id: 'A1', team: 'Away', x: 622, y: 220 },
  { id: 'A2', team: 'Away', x: 552, y: 82 },
  { id: 'A3', team: 'Away', x: 552, y: 174 },
  { id: 'A4', team: 'Away', x: 552, y: 266 },
  { id: 'A5', team: 'Away', x: 552, y: 358 },
  { id: 'A6', team: 'Away', x: 478, y: 125 },
  { id: 'A7', team: 'Away', x: 478, y: 220 },
  { id: 'A8', team: 'Away', x: 478, y: 315 },
  { id: 'A9', team: 'Away', x: 404, y: 170 },
  { id: 'A10', team: 'Away', x: 404, y: 270 },
  { id: 'A11', team: 'Away', x: 350, y: 220 },
];
const COACH_PERSONAS = [
  {
    tone: 'optimist',
    coach: 'Mihai',
    label: 'Optimist',
    personality: 'Caută oportunități și păstrează echipa încrezătoare.',
  },
  {
    tone: 'mixt',
    coach: 'Andrei',
    label: 'Mixt',
    personality: 'Echilibrează riscurile cu soluții imediate.',
  },
  {
    tone: 'pesimist',
    coach: 'Sorin',
    label: 'Pesimist',
    personality: 'Anticipează scenariul dificil și cere măsuri rapide.',
  },
];

function initGPSTracker() {
  if (gpsRunning) return;
  renderGPSPitch();
  startGPSPreviewAnimation();
  renderEmptyGPSState();
  matchMinute = 0;
  updateMatchMinute();
  updateTrackingSummary(null);
  initGPSAIUpload();
  initMetricaPlaybackControls();
  gpsRunning = true;
}

// ── Pitch SVG ──
function renderGPSPitch() {
  const svg = document.getElementById('gps-pitch-svg');
  if (!svg) return;
  svg.innerHTML = getPitchBaseSVG();
}

function startGPSPreviewAnimation() {
  if (gpsPreviewTimer || metricaPlayback.loaded) return;
  renderGPSPreviewFrame();
}

function stopGPSPreviewAnimation() {
  if (gpsPreviewTimer) cancelAnimationFrame(gpsPreviewTimer);
  gpsPreviewTimer = null;
}

function renderGPSPreviewFrame() {
  if (metricaPlayback.loaded) {
    stopGPSPreviewAnimation();
    return;
  }
  const svg = document.getElementById('gps-pitch-svg');
  if (!svg) return;
  const playersHtml = GPS_PREVIEW_PLAYERS.map((player) => {
    const radius = player.team === 'Home' ? 9 : 8;
    return `
      <g class="metrica-dot">
        <circle class="metrica-player ${player.team.toLowerCase()}" cx="${player.x}" cy="${player.y}" r="${radius}" opacity="0.9" stroke-width="1.5"/>
        <text x="${player.x}" y="${player.y}" text-anchor="middle" dominant-baseline="central" font-size="7" fill="${player.team === 'Home' ? '#000' : '#fff'}" font-weight="800">${player.id.slice(1)}</text>
      </g>`;
  }).join('');
  const ballHtml = `<circle class="metrica-ball" cx="340" cy="220" r="5.5"/>`;
  svg.innerHTML = `${getPitchBaseSVG()}${playersHtml}${ballHtml}`;
}

function renderEmptyGPSState() {
  const list = document.getElementById('gps-player-list');
  const panel = document.getElementById('player-detail-panel');
  const alerts = document.getElementById('gps-alerts-panel');
  const source = document.getElementById('gps-alert-source');
  if (list) list.innerHTML = `<div class="text-muted">Încarcă CSV-urile Metrica pentru a afișa jucători reali din tracking.</div>`;
  if (panel) panel.innerHTML = `<div style="color:var(--text-3);font-size:13px">Încarcă CSV-urile Metrica pentru detalii tracking.</div>`;
  if (alerts) alerts.innerHTML = `<div style="color:var(--text-3);font-size:13px">Așteptare CSV-uri pentru analiza AI-GPS.</div>`;
  if (source) source.textContent = 'Date CSV necesare';
}

function getPitchBaseSVG() {
  return `
    <!-- Grass stripes -->
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 85}" y="0" width="85" height="440" fill="${i % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'transparent'}"/>`).join('')}
    <!-- Border -->
    <rect x="20" y="20" width="640" height="400" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
    <!-- Halfway line -->
    <line x1="340" y1="20" x2="340" y2="420" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
    <!-- Center circle -->
    <circle cx="340" cy="220" r="60" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
    <circle cx="340" cy="220" r="4" fill="rgba(255,255,255,0.5)"/>
    <!-- Left penalty area -->
    <rect x="20" y="130" width="110" height="180" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Left goal area -->
    <rect x="20" y="175" width="45" height="90" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Left penalty spot -->
    <circle cx="90" cy="220" r="3" fill="rgba(255,255,255,0.4)"/>
    <!-- Left goal -->
    <rect x="8" y="192" width="14" height="56" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
    <!-- Right penalty area -->
    <rect x="550" y="130" width="110" height="180" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Right goal area -->
    <rect x="615" y="175" width="45" height="90" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Right penalty spot -->
    <circle cx="590" cy="220" r="3" fill="rgba(255,255,255,0.4)"/>
    <!-- Right goal -->
    <rect x="658" y="192" width="14" height="56" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
    <!-- Arc left -->
    <path d="M 130 178 A 60 60 0 0 1 130 262" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Arc right -->
    <path d="M 550 178 A 60 60 0 0 0 550 262" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <!-- Corner arcs -->
    <path d="M 20 32 A 12 12 0 0 1 32 20" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <path d="M 648 20 A 12 12 0 0 1 660 32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <path d="M 20 408 A 12 12 0 0 0 32 420" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <path d="M 648 420 A 12 12 0 0 0 660 408" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
  `;
}

function updateMatchMinute() {
  const el = document.getElementById('gps-match-minute');
  if (el) el.textContent = Math.floor(matchMinute) + "'";
}

function updateTeamStats() {
  updateTrackingSummary(metricaPlayback.loaded ? metricaPlayback.frames[metricaPlayback.index] : null);
}

// ── Metrica playback ──
function initMetricaPlaybackControls() {
  const play = document.getElementById('gps-play-toggle');
  const speed = document.getElementById('gps-speed-toggle');
  const slider = document.getElementById('gps-playback-slider');
  if (play && play.dataset.bound !== 'true') {
    play.dataset.bound = 'true';
    play.addEventListener('click', toggleMetricaPlayback);
  }
  if (speed && speed.dataset.bound !== 'true') {
    speed.dataset.bound = 'true';
    speed.addEventListener('click', cycleMetricaSpeed);
  }
  if (slider && slider.dataset.bound !== 'true') {
    slider.dataset.bound = 'true';
    slider.addEventListener('input', () => {
      if (!metricaPlayback.loaded) return;
      metricaPlayback.index = Number(slider.value || 0);
      renderMetricaFrame();
    });
  }
}

async function loadMetricaPlaybackFromFiles(homeFile, awayFile) {
  const sourceKey = `${homeFile.name}:${homeFile.lastModified}|${awayFile.name}:${awayFile.lastModified}`;
  if (metricaPlayback.loaded && metricaPlayback.sourceKey === sourceKey) return;
  stopGPSPreviewAnimation();
  setMetricaStatus('Se încarcă tracking-ul pe teren...');

  const [homeFrames, awayFrames] = await Promise.all([
    parseMetricaTrackingFile(homeFile, 'Home'),
    parseMetricaTrackingFile(awayFile, 'Away'),
  ]);
  const total = Math.min(homeFrames.length, awayFrames.length);
  const frames = [];
  for (let i = 0; i < total; i++) {
    frames.push({
      time: homeFrames[i].time,
      period: homeFrames[i].period,
      players: [...homeFrames[i].players, ...awayFrames[i].players],
      ball: homeFrames[i].ball || awayFrames[i].ball,
    });
  }

  metricaPlayback = {
    loaded: frames.length > 0,
    playing: false,
    speed: 1,
    index: 0,
    frames,
    timer: null,
    sourceKey,
  };
  selectedMetricaPlayerId = frames[0]?.players?.[0]?.id || null;
  configureMetricaControls();
  if (frames.length) renderMetricaFrame();
  else startGPSPreviewAnimation();
  setMetricaStatus(frames.length ? `${frames.length} cadre încărcate din Metrica` : 'Nu s-au putut citi cadrele Metrica');
}

async function parseMetricaTrackingFile(file, team) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 4) return [];

  const header = splitCsvLine(lines[2]);
  const entities = [];
  for (let col = 3; col < header.length; col += 2) {
    const raw = (header[col] || '').trim();
    if (!raw) continue;
    const number = raw.replace(/\D/g, '') || raw;
    entities.push({
      raw,
      id: `${team}-${raw}`,
      label: raw === 'Ball' ? 'Ball' : `${team === 'Home' ? 'H' : 'A'}${number}`,
      team,
      xCol: col,
      yCol: col + 1,
    });
  }

  const frames = [];
  for (let rowIndex = 3; rowIndex < lines.length; rowIndex += METRICA_SAMPLE_STEP) {
    const row = splitCsvLine(lines[rowIndex]);
    if (row.length < 4) continue;
    const frame = {
      period: Number(row[0] || 0),
      frame: Number(row[1] || 0),
      time: Number(row[2] || 0),
      players: [],
      ball: null,
    };

    entities.forEach(entity => {
      const x = Number(row[entity.xCol]);
      const y = Number(row[entity.yCol]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const point = {
        id: entity.id,
        label: entity.label,
        team: entity.team,
        x: 20 + x * 640,
        y: 20 + y * 400,
      };
      if (entity.raw === 'Ball') frame.ball = point;
      else frame.players.push(point);
    });
    frames.push(frame);
  }
  return frames;
}

function splitCsvLine(line) {
  return line.split(',');
}

function configureMetricaControls() {
  const slider = document.getElementById('gps-playback-slider');
  const play = document.getElementById('gps-play-toggle');
  const speed = document.getElementById('gps-speed-toggle');
  if (slider) {
    slider.disabled = !metricaPlayback.loaded;
    slider.min = 0;
    slider.max = Math.max(metricaPlayback.frames.length - 1, 0);
    slider.value = 0;
  }
  if (play) {
    play.disabled = !metricaPlayback.loaded;
    play.textContent = 'Start';
  }
  if (speed) {
    speed.disabled = !metricaPlayback.loaded;
    speed.textContent = `${metricaPlayback.speed}x`;
  }
}

function toggleMetricaPlayback() {
  if (!metricaPlayback.loaded) return;
  metricaPlayback.playing = !metricaPlayback.playing;
  const play = document.getElementById('gps-play-toggle');
  if (play) play.textContent = metricaPlayback.playing ? 'Pauză' : 'Start';
  if (metricaPlayback.playing) startMetricaTimer();
  else stopMetricaTimer();
}

function startMetricaTimer() {
  stopMetricaTimer();
  metricaPlayback.timer = setInterval(() => {
    if (!metricaPlayback.loaded) return;
    metricaPlayback.index += metricaPlayback.speed;
    if (metricaPlayback.index >= metricaPlayback.frames.length) {
      metricaPlayback.index = metricaPlayback.frames.length - 1;
      metricaPlayback.playing = false;
      stopMetricaTimer();
      const play = document.getElementById('gps-play-toggle');
      if (play) play.textContent = 'Start';
    }
    renderMetricaFrame();
  }, 160);
}

function stopMetricaTimer() {
  if (metricaPlayback.timer) clearInterval(metricaPlayback.timer);
  metricaPlayback.timer = null;
}

function cycleMetricaSpeed() {
  const speeds = [1, 2, 4, 8];
  const next = speeds[(speeds.indexOf(metricaPlayback.speed) + 1) % speeds.length];
  metricaPlayback.speed = next;
  const speed = document.getElementById('gps-speed-toggle');
  if (speed) speed.textContent = `${next}x`;
  if (metricaPlayback.playing) startMetricaTimer();
}

function renderMetricaFrame() {
  const frame = metricaPlayback.frames[metricaPlayback.index];
  if (!frame) return;
  const svg = document.getElementById('gps-pitch-svg');
  if (!svg) return;

  const playersHtml = frame.players.map(player => `
    <g class="metrica-dot" onclick="selectMetricaPlayer('${player.id}')" style="cursor:pointer">
      <circle class="metrica-player ${player.team.toLowerCase()}" cx="${player.x.toFixed(1)}" cy="${player.y.toFixed(1)}" r="${player.team === 'Home' ? 9 : 8}" opacity="${player.id === selectedMetricaPlayerId ? '1' : '0.88'}"/>
      <text x="${player.x.toFixed(1)}" y="${player.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="7" fill="${player.team === 'Home' ? '#000' : '#fff'}" font-weight="800">${player.label.replace(/[HA]/, '')}</text>
    </g>
  `).join('');
  const ballHtml = frame.ball ? `
    <circle class="metrica-ball" cx="${frame.ball.x.toFixed(1)}" cy="${frame.ball.y.toFixed(1)}" r="5"/>
  ` : '';

  svg.innerHTML = `${getPitchBaseSVG()}${playersHtml}${ballHtml}`;
  matchMinute = frame.time / 60;
  updateMatchMinute();
  updateMetricaControls(frame);
  updateTrackingSummary(frame);
  renderMetricaPlayerList(frame);
  updateSelectedMetricaPlayerStats(frame);
  maybeRunGPSAutoAnalysis(frame.time / 60);
}

function updateMetricaControls(frame) {
  const slider = document.getElementById('gps-playback-slider');
  const time = document.getElementById('gps-playback-time');
  if (slider) slider.value = metricaPlayback.index;
  if (time) time.textContent = formatClock(frame.time);
}

function updateTrackingSummary(frame) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  if (!frame) {
    setText('tracking-time', '--:--');
    setText('tracking-period', '-');
    setText('tracking-players', '0');
    setText('tracking-frame', '-');
    return;
  }
  setText('tracking-time', formatClock(frame.time));
  setText('tracking-period', frame.period || '-');
  setText('tracking-players', frame.players?.length || 0);
  setText('tracking-frame', metricaPlayback.index + 1);
}

function setMetricaStatus(text) {
  const status = document.getElementById('gps-playback-status');
  if (status) status.textContent = text;
}

function formatClock(seconds) {
  const minute = Math.floor(seconds / 60);
  const second = Math.floor(seconds % 60);
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function selectMetricaPlayer(id) {
  selectedMetricaPlayerId = id;
  renderMetricaFrame();
}

function renderMetricaPlayerList(frame) {
  const list = document.getElementById('gps-player-list');
  if (!list) return;
  list.innerHTML = frame.players.map(player => `
    <div class="gps-player-item ${player.id === selectedMetricaPlayerId ? 'active-player' : ''}" onclick="selectMetricaPlayer('${player.id}')">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:28px;height:28px;border-radius:50%;background:${player.team === 'Home' ? 'rgba(255,255,255,0.9)' : 'rgba(82,82,91,0.9)'};border:1.5px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-family:Rajdhani,sans-serif;font-weight:700;font-size:10px;color:${player.team === 'Home' ? '#000' : '#fff'};flex-shrink:0">${player.label}</div>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-1)">${player.team} ${player.label}</div>
          <span class="pos-badge mid" style="font-size:9px;padding:1px 6px">ANON</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600;color:var(--text-1)">${formatClock(frame.time)}</div>
        <div style="font-size:10px;color:var(--text-3)">timp</div>
      </div>
    </div>
  `).join('');
}

function updateSelectedMetricaPlayerStats(frame) {
  const selected = frame.players.find(player => player.id === selectedMetricaPlayerId) || frame.players[0];
  const panel = document.getElementById('player-detail-panel');
  if (!selected || !panel) return;
  panel.innerHTML = `
    <div class="flex-between mb-16">
      <div>
        <div class="player-detail-name">${selected.team} ${selected.label}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span class="pos-badge mid">ANON</span>
          <span class="text-muted">Metrica sample data</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-family:Rajdhani,sans-serif;font-size:28px;font-weight:700;color:#fff">${Math.floor(frame.time / 60)}'</div>
        <div style="font-size:10px;color:var(--text-3);letter-spacing:1px">MINUT</div>
      </div>
    </div>
    <div class="mini-stat-grid">
      <div class="mini-stat"><div class="ms-val">${selected.x.toFixed(0)}</div><div class="ms-lbl">X SVG</div></div>
      <div class="mini-stat"><div class="ms-val">${selected.y.toFixed(0)}</div><div class="ms-lbl">Y SVG</div></div>
      <div class="mini-stat"><div class="ms-val">${frame.period}</div><div class="ms-lbl">Repriză</div></div>
      <div class="mini-stat"><div class="ms-val">${formatClock(frame.time)}</div><div class="ms-lbl">Timp</div></div>
    </div>
    <div style="margin-top:16px;padding:10px 12px;background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);font-size:12px;color:var(--text-2)">
      Jucătorii Metrica sunt anonimi. Eticheta ${selected.label} vine din tracking, nu din lotul real U Cluj.
    </div>
  `;
}

// ── Alerts ──
function initGPSAIUpload() {
  const form = document.getElementById('gps-ai-form');
  if (form && form.dataset.bound !== 'true') {
    form.dataset.bound = 'true';
    form.addEventListener('submit', analyzeUploadedGPSData);
  }
  const loadMatch = document.getElementById('gps-load-match');
  if (loadMatch && loadMatch.dataset.bound !== 'true') {
    loadMatch.dataset.bound = 'true';
    loadMatch.addEventListener('click', loadGPSMatchForPlayback);
  }
  const autoToggle = document.getElementById('gps-auto-toggle');
  if (autoToggle && autoToggle.dataset.bound !== 'true') {
    autoToggle.dataset.bound = 'true';
    autoToggle.addEventListener('click', toggleGPSAutoAnalysis);
  }
}

async function analyzeUploadedGPSData(event) {
  event.preventDefault();
  const reportMinute = Number(document.getElementById('gps-report-minute')?.value || 45);
  await runGPSAnalysisAtMinute(reportMinute, 'manual');
}

function getGPSAnalysisInputs() {
  return {
    homeFile: document.getElementById('gps-tracking-home')?.files?.[0],
    awayFile: document.getElementById('gps-tracking-away')?.files?.[0],
    eventsFile: document.getElementById('gps-events')?.files?.[0],
    team: document.getElementById('gps-team')?.value || 'Home',
  };
}

async function loadGPSMatchForPlayback() {
  const { homeFile, awayFile } = getGPSAnalysisInputs();
  if (!homeFile || !awayFile) {
    setGPSAIStatus('Selectează Tracking Home și Tracking Away.', 'warning');
    return false;
  }

  try {
    setGPSAIStatus('Se încarcă meciul pentru replay...', 'loading');
    await loadMetricaPlaybackFromFiles(homeFile, awayFile);
    if (!metricaPlayback.loaded) {
      setGPSAIStatus('Nu s-au putut citi fișierele tracking.', 'danger');
      return false;
    }
    setGPSAIStatus('Meci încărcat · poți porni simularea.', 'success');
    setGPSAutoStatus('Replay încărcat. Poți solicita analiză manuală sau porni auto.');
    return true;
  } catch (error) {
    setGPSAIStatus('Eroare la încărcarea meciului.', 'danger');
    renderGPSAIError(error);
    return false;
  }
}

function selectedTrackingSourceKey() {
  const { homeFile, awayFile } = getGPSAnalysisInputs();
  if (!homeFile || !awayFile) return '';
  return `${homeFile.name}:${homeFile.lastModified}|${awayFile.name}:${awayFile.lastModified}`;
}

function isSelectedMatchLoaded() {
  return metricaPlayback.loaded && metricaPlayback.sourceKey === selectedTrackingSourceKey();
}

async function runGPSAnalysisAtMinute(reportMinute, mode = 'manual') {
  const { homeFile, awayFile, eventsFile, team } = getGPSAnalysisInputs();

  if (!homeFile || !awayFile || !eventsFile) {
    setGPSAIStatus('Selectează toate cele 3 CSV-uri.', 'warning');
    return null;
  }

  gpsBackendMode = true;
  setGPSAIStatus(
    mode === 'auto'
      ? `Analiză automată la minutul ${Math.round(reportMinute)}...`
      : 'Se încarcă replay-ul și analiza...',
    'loading'
  );
  renderGPSLoadingAlerts();

  const formData = new FormData();
  formData.append('tracking_home', homeFile);
  formData.append('tracking_away', awayFile);
  formData.append('events', eventsFile);
  formData.append('team', team);
  formData.append('report_time', String(reportMinute * 60));
  formData.append('max_alerts', '3');
  formData.append('use_gemini', 'true');

  try {
    if (!isSelectedMatchLoaded()) {
      await loadMetricaPlaybackFromFiles(homeFile, awayFile);
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/gps/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    renderGPSAIResult(data);
    setGPSAIStatus(`${mode === 'auto' ? 'Auto' : 'Analiză'} completă · ${data.counts?.coach_alerts ?? 0} alerte`, 'success');
    return data;
  } catch (error) {
    gpsBackendMode = false;
    setGPSAIStatus('Eroare backend AI-GPS', 'danger');
    renderGPSAIError(error);
    return null;
  }
}

async function toggleGPSAutoAnalysis() {
  if (gpsAutoAnalysis.enabled) {
    stopGPSAutoAnalysis('Analiza automată este oprită.');
    return;
  }

  const { homeFile, awayFile, eventsFile } = getGPSAnalysisInputs();
  if (!homeFile || !awayFile || !eventsFile) {
    setGPSAIStatus('Selectează toate cele 3 CSV-uri.', 'warning');
    return;
  }

  const interval = Number(document.getElementById('gps-auto-interval')?.value || 5);
  if (!Number.isFinite(interval) || interval < 1) {
    setGPSAIStatus('Intervalul auto trebuie să fie cel puțin 1 minut.', 'warning');
    return;
  }

  if (!isSelectedMatchLoaded()) {
    const loaded = await loadGPSMatchForPlayback();
    if (!loaded) return;
  }
  gpsAutoAnalysis = {
    enabled: true,
    nextMinute: Number(document.getElementById('gps-report-minute')?.value || 1),
    intervalMinutes: interval,
    inFlight: false,
  };
  setGPSAutoStatus(`Auto activ · următoarea analiză la minutul ${Math.round(gpsAutoAnalysis.nextMinute)}`);
  const toggle = document.getElementById('gps-auto-toggle');
  if (toggle) toggle.textContent = 'Oprește auto';
  maybeRunGPSAutoAnalysis(matchMinute);
}

function stopGPSAutoAnalysis(message = 'Analiza automată este oprită.') {
  gpsAutoAnalysis.enabled = false;
  gpsAutoAnalysis.inFlight = false;
  const toggle = document.getElementById('gps-auto-toggle');
  if (toggle) toggle.textContent = 'Pornește auto';
  setGPSAutoStatus(message);
}

function maybeRunGPSAutoAnalysis(currentMinute) {
  if (!gpsAutoAnalysis.enabled || gpsAutoAnalysis.inFlight) return;
  if (!Number.isFinite(currentMinute) || currentMinute + 0.05 < gpsAutoAnalysis.nextMinute) return;

  const targetMinute = Math.max(1, Math.round(gpsAutoAnalysis.nextMinute));
  gpsAutoAnalysis.inFlight = true;
  const minuteInput = document.getElementById('gps-report-minute');
  if (minuteInput) minuteInput.value = String(targetMinute);
  setGPSAutoStatus(`Se solicită analiza pentru minutul ${targetMinute}...`);

  runGPSAnalysisAtMinute(targetMinute, 'auto').finally(() => {
    gpsAutoAnalysis.inFlight = false;
    gpsAutoAnalysis.nextMinute += gpsAutoAnalysis.intervalMinutes;
    while (gpsAutoAnalysis.nextMinute <= currentMinute) {
      gpsAutoAnalysis.nextMinute += gpsAutoAnalysis.intervalMinutes;
    }
    if (gpsAutoAnalysis.nextMinute > 120) {
      stopGPSAutoAnalysis('Analiza automată s-a încheiat.');
      return;
    }
    if (gpsAutoAnalysis.enabled) {
      setGPSAutoStatus(`Auto activ · următoarea analiză la minutul ${Math.round(gpsAutoAnalysis.nextMinute)}`);
    }
  });
}

function setGPSAutoStatus(text) {
  const el = document.getElementById('gps-auto-status');
  if (el) el.textContent = text;
}

function setGPSAIStatus(text, type = 'info') {
  const el = document.getElementById('gps-ai-status');
  if (!el) return;
  const colors = {
    info: 'var(--text-3)',
    loading: '#fff',
    success: 'var(--green)',
    warning: '#d4d4d8',
    danger: '#fff',
  };
  el.textContent = text;
  el.style.color = colors[type] || colors.info;
}

function renderGPSLoadingAlerts() {
  const panel = document.getElementById('gps-alerts-panel');
  const source = document.getElementById('gps-alert-source');
  const summary = document.getElementById('gps-ai-summary');
  if (source) source.textContent = 'Backend AI-GPS';
  if (summary) summary.textContent = 'Analizăm tracking-ul, evenimentele și predicțiile modelului de oboseală.';
  if (!panel) return;
  panel.innerHTML = `
    <div class="coach-alert-grid">
      ${COACH_PERSONAS.map(persona => `
        <div class="coach-column ${persona.tone}">
          <div class="coach-column-head">
            <div>
              <div class="coach-name">${persona.coach}</div>
              <div class="coach-tone">${persona.label}</div>
            </div>
          </div>
          <div class="coach-personality">${persona.personality}</div>
          <div class="coach-empty">Procesează alertele pentru această perspectivă.</div>
        </div>
      `).join('')}
    </div>`;
}

function renderGPSAIResult(data) {
  const source = document.getElementById('gps-alert-source');
  const summary = document.getElementById('gps-ai-summary');
  const panel = document.getElementById('gps-alerts-panel');
  const minute = data.minute ?? Math.floor((data.report_time || 0) / 60);
  const feed = data.coach_feed || {};
  const alerts = feed.coach_alerts || [];
  const coachViews = normalizeCoachViews(feed, alerts);

  if (source) {
    source.textContent = feed.source === 'gemini'
      ? `Gemini · minutul ${minute}`
      : `Filtru local · minutul ${minute}`;
  }
  if (summary) {
    summary.innerHTML = `<strong>Rezumat AI:</strong> ${escapeHTML(feed.summary || 'Nu există rezumat disponibil.')}`;
  }
  if (!panel) return;

  panel.innerHTML = renderCoachColumns(coachViews, minute);

  updateGPSPlayerRisks(data.model_predictions || []);
}

function normalizeCoachViews(feed, alerts) {
  if (Array.isArray(feed.coach_views) && feed.coach_views.length) {
    return COACH_PERSONAS.map(persona => {
      const view = feed.coach_views.find(item => item.tone === persona.tone) || {};
      return {
        ...persona,
        coach: view.coach || persona.coach,
        personality: view.personality || persona.personality,
        alerts: Array.isArray(view.alerts) ? view.alerts : [],
      };
    });
  }
  return buildLocalCoachViews(alerts);
}

function buildLocalCoachViews(alerts) {
  const baseAlerts = (alerts || []).map((alert, index) => ({
    priority: alert.priority || index + 1,
    minute: alert.minute ?? Math.floor(matchMinute),
    category: alert.category || 'local',
    severity: alert.severity || alert.type || 'mediu',
    player: alert.player || null,
    message: alert.message || alert.title || 'Alertă importantă',
    evidence: alert.evidence || alert.msg || '',
    suggestion: alert.suggestion || 'Evaluați contextul și decideți intervenția potrivită.',
  }));
  return COACH_PERSONAS.map(persona => ({
    ...persona,
    alerts: baseAlerts.map(alert => localToneAlert(alert, persona.tone)),
  }));
}

function localToneAlert(alert, tone) {
  const copy = { ...alert };
  if (tone === 'optimist') {
    copy.message = `Oportunitate: ${copy.message}`;
    copy.suggestion = copy.suggestion || 'Folosiți momentul pentru a ajusta rolul fără a rupe ritmul echipei.';
  } else if (tone === 'pesimist') {
    copy.message = `Risc: ${copy.message}`;
    copy.suggestion = copy.suggestion || 'Pregătiți imediat o soluție de rezervă dacă semnalul persistă.';
  } else {
    copy.message = `Observație: ${copy.message}`;
  }
  return copy;
}

function renderCoachColumns(views, fallbackMinute) {
  return `
    <div class="coach-alert-grid">
      ${views.map(view => `
        <div class="coach-column ${view.tone}">
          <div class="coach-column-head">
            <div>
              <div class="coach-name">${escapeHTML(view.coach)}</div>
              <div class="coach-tone">${escapeHTML(view.label || view.tone)}</div>
            </div>
          </div>
          <div class="coach-personality">${escapeHTML(view.personality || '')}</div>
          <div class="coach-alert-list">
            ${renderCoachAlerts(view.alerts || [], fallbackMinute)}
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderCoachAlerts(alerts, fallbackMinute) {
  if (!alerts.length) {
    return `<div class="coach-empty">Fără alerte critice pentru această perspectivă.</div>`;
  }
  return alerts.map(alert => {
    const cls = severityToAlertClass(alert.severity);
    const player = alert.player ? ` · ${escapeHTML(String(alert.player))}` : '';
    const title = alert.message || alert.title || 'Alertă AI';
    const evidence = alert.evidence ? `<div class="coach-evidence">${escapeHTML(String(alert.evidence))}</div>` : '';
    const suggestion = alert.suggestion ? `<div class="coach-suggestion">${escapeHTML(String(alert.suggestion))}</div>` : '';
    return `
      <div class="alert-item ${cls}">
        <div class="alert-content">
          <strong>#${alert.priority || '-'} · Min ${alert.minute ?? fallbackMinute}${player}</strong>
          <div>${escapeHTML(String(title))}</div>
          ${evidence}
          ${suggestion}
        </div>
      </div>`;
  }).join('');
}

function renderGPSAIError(error) {
  const panel = document.getElementById('gps-alerts-panel');
  const source = document.getElementById('gps-alert-source');
  const summary = document.getElementById('gps-ai-summary');
  if (source) source.textContent = 'Eroare backend';
  if (summary) summary.textContent = 'Backend-ul nu a putut procesa CSV-urile. Verifică serverul și formatul fișierelor.';
  if (!panel) return;
  panel.innerHTML = `
    <div class="alert-item danger">
      <div class="alert-content"><strong>Analiza AI-GPS a eșuat</strong>${escapeHTML(error.message || 'Eroare necunoscută')}</div>
    </div>`;
}

function updateGPSPlayerRisks(predictions) {
  // Metrica sample tracking is anonymous, so model predictions are shown in alert cards,
  // not attached to invented player identities.
}

function severityToAlertClass(severity) {
  const value = String(severity || '').toLowerCase();
  if (value.includes('ridicat') || value.includes('high')) return 'danger';
  if (value.includes('mediu') || value.includes('medium')) return 'warning';
  if (value.includes('scazut') || value.includes('low')) return 'info';
  return 'info';
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
