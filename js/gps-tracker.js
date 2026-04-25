// =============================================
//  UCJ - GPS Tracker Module (Real-time simulation)
// =============================================

let gpsInterval = null;
let alertInterval = null;
let selectedPlayerId = 7; // Hoban default
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

// Player GPS state: pitch is 680x440 SVG
const GPS_PLAYERS = [
  // GK
  { id: 1, number: 1, name: 'Brănescu', pos: 'GK', x: 50, y: 220, baseX: 50, baseY: 220, speed: 0, distance: 0.1, hr: 128, sprints: 0, color: '#ffffff', role: 'gk' },
  // DEF
  { id: 2, number: 4, name: 'Burcă', pos: 'DEF', x: 140, y: 110, baseX: 140, baseY: 110, speed: 7.2, distance: 7.1, hr: 158, sprints: 4, color: '#d4d4d8', role: 'def' },
  { id: 3, number: 5, name: 'Roman', pos: 'DEF', x: 140, y: 185, baseX: 140, baseY: 185, speed: 6.8, distance: 6.8, hr: 154, sprints: 3, color: '#d4d4d8', role: 'def' },
  { id: 4, number: 6, name: 'Bancu', pos: 'DEF', x: 140, y: 260, baseX: 140, baseY: 260, speed: 7.5, distance: 7.4, hr: 162, sprints: 5, color: '#d4d4d8', role: 'def' },
  { id: 5, number: 3, name: 'Manea', pos: 'DEF', x: 140, y: 335, baseX: 140, baseY: 335, speed: 8.1, distance: 7.9, hr: 165, sprints: 6, color: '#d4d4d8', role: 'def' },
  // MID
  { id: 6, number: 8, name: 'Itu', pos: 'MID', x: 280, y: 150, baseX: 280, baseY: 150, speed: 9.4, distance: 9.8, hr: 172, sprints: 8, color: '#a1a1aa', role: 'mid' },
  { id: 7, number: 10, name: 'Hoban', pos: 'MID', x: 280, y: 220, baseX: 280, baseY: 220, speed: 8.8, distance: 10.1, hr: 175, sprints: 9, color: '#a1a1aa', role: 'mid' },
  { id: 8, number: 14, name: 'Callă', pos: 'MID', x: 280, y: 290, baseX: 280, baseY: 290, speed: 9.1, distance: 9.5, hr: 170, sprints: 7, color: '#a1a1aa', role: 'mid' },
  { id: 9, number: 20, name: 'Vătăjelu', pos: 'MID', x: 380, y: 130, baseX: 380, baseY: 130, speed: 10.2, distance: 10.8, hr: 178, sprints: 11, color: '#a1a1aa', role: 'mid' },
  { id: 13, number: 22, name: 'Ioniță', pos: 'MID', x: 380, y: 310, baseX: 380, baseY: 310, speed: 9.8, distance: 10.2, hr: 174, sprints: 10, color: '#a1a1aa', role: 'mid' },
  // ATT
  { id: 10, number: 7, name: 'Munteanu', pos: 'ATT', x: 500, y: 150, baseX: 500, baseY: 150, speed: 11.4, distance: 8.6, hr: 182, sprints: 14, color: '#71717a', role: 'att' },
  { id: 11, number: 9, name: 'Eduardo', pos: 'ATT', x: 540, y: 220, baseX: 540, baseY: 220, speed: 10.8, distance: 8.2, hr: 180, sprints: 12, color: '#71717a', role: 'att' },
  { id: 12, number: 11, name: 'Miculescu', pos: 'ATT', x: 500, y: 290, baseX: 500, baseY: 290, speed: 10.5, distance: 8.4, hr: 179, sprints: 13, color: '#71717a', role: 'att' },
];

const GPS_ALERTS_POOL = [
  { type: 'danger', playerId: 7, title: 'Oboseală detectată - Hoban #10', msg: 'Viteza medie scăzută la 6.2 km/h. Recomandare: substituție sau pauza de refacere.' },
  { type: 'warning', playerId: 4, title: 'Bancu #6 - Ieșit din poziție', msg: 'Fundașul a depășit linia de offside de 3 ori. Recalibrare linie defensivă necesară.' },
  { type: 'warning', playerId: 9, title: 'Vătăjelu #20 - Supra-pozitionare', msg: 'Suprapopulare în zona centrală. Se recomandă distribuire mai largă a mijlocașilor.' },
  { type: 'info', playerId: 10, title: 'Munteanu #7 - Presing eficient', msg: 'Recuperare minge în treimea adversă (min 67). Continuați presing înalt pe fundașii adversi.' },
  { type: 'danger', playerId: 11, title: 'Eduardo - intensitate ridicată', msg: 'Sprinturi repetate și efort susținut. Reduceți expunerea la dueluri sau pregătiți schimbarea.' },
  { type: 'success', playerId: 6, title: 'Itu #8 - Distanță record', msg: '10.8 km parcurși la min 76 - cel mai activ jucător. Contribuție maximă la pressing.' },
  { type: 'warning', playerId: 3, title: 'Roman #5 - Zona punct slab', msg: 'Spațiu descoperit pe flancul drept în ultimele 8 minute. Repoziționare urgentă.' },
  { type: 'info', playerId: 0, title: 'Antrenor secund - sugestie tactică', msg: 'Adversarul atacă sustinut pe flancul stâng. Rotirea fundașului #3 cu 10m mai spre centru.' },
  { type: 'info', playerId: 12, title: 'Miculescu #11 - serie de sprinturi', msg: '4 sprinturi consecutive în 5 minute. Evaluați necesitatea menținerii intensității.' },
  { type: 'danger', playerId: 2, title: 'Burcă #4 - Crampe posibile', msg: 'Scădere bruscă viteză maximă cu 15%. Semn de oboseală musculară. Monitorizare atentă.' },
];

let activeAlertIndices = new Set();
let shownAlerts = [];

function initGPSTracker() {
  if (gpsRunning) return;
  renderGPSPitch();
  renderGPSPlayerList();
  selectGPSPlayer(selectedPlayerId);
  updateTrackingSummary(null);
  initGPSAIUpload();
  initMetricaPlaybackControls();
  startGPSSimulation();
  gpsRunning = true;
}

// ── Pitch SVG ──
function renderGPSPitch() {
  const svg = document.getElementById('gps-pitch-svg');
  if (!svg) return;

  let pitchHTML = getPitchBaseSVG();

  // Player dots
  GPS_PLAYERS.forEach(p => {
    pitchHTML += `
      <g class="player-dot" id="dot-${p.id}" onclick="selectGPSPlayer(${p.id})" style="cursor:pointer">
        <circle cx="${p.x}" cy="${p.y}" r="13" fill="${p.color}22" stroke="${p.color}" stroke-width="2" opacity="0.9">
          <animate attributeName="r" values="11;13;11" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${p.x}" cy="${p.y}" r="10" fill="${p.color}" style="transition:all 0.3s ease"/>
        <text x="${p.x}" y="${p.y}" class="player-label" font-family="Inter,sans-serif" font-size="8" font-weight="700">${p.number}</text>
      </g>
    `;
  });

  svg.innerHTML = pitchHTML;
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

function generateOpponentPlayers() {
  const opp = [
    { x: 560, y: 110 }, { x: 560, y: 185 }, { x: 560, y: 260 }, { x: 560, y: 335 },
    { x: 440, y: 130 }, { x: 440, y: 220 }, { x: 440, y: 310 },
    { x: 400, y: 160 }, { x: 400, y: 280 },
    { x: 500, y: 180 }, { x: 500, y: 260 },
  ];
  return opp.map(o => `
    <circle cx="${o.x}" cy="${o.y}" r="9" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
  `).join('');
}

// ── GPS Simulation Loop ──
function startGPSSimulation() {
  if (gpsInterval) clearInterval(gpsInterval);
  if (alertInterval) clearInterval(alertInterval);

  matchMinute = 60;

  gpsInterval = setInterval(() => {
    if (metricaPlayback.loaded) return;
    matchMinute += 0.25;
    if (matchMinute > 90) matchMinute = 60;

    GPS_PLAYERS.forEach(p => {
      // Random movement within role zones
      const range = p.role === 'gk' ? 15 : p.role === 'att' ? 60 : 50;
      p.x = clamp(p.baseX + (Math.random() - 0.5) * range * 2, 25, 655);
      p.y = clamp(p.baseY + (Math.random() - 0.5) * range * 1.5, 25, 415);

      // Update live stats
      p.speed = +(Math.random() * 6 + (p.role === 'gk' ? 1 : p.role === 'att' ? 7 : 5)).toFixed(1);
      p.distance = +(p.distance + p.speed * 0.0007).toFixed(2);
      p.hr = Math.round(p.hr + (Math.random() - 0.5) * 4);
      p.hr = clamp(p.hr, 130, 195);
      if (Math.random() < 0.015) p.sprints++;

      updateDot(p);
    });

    updateMatchMinute();
    updateSelectedPlayerStats();
    updateTeamStats();
  }, 600);

  // Alert injection every 12 seconds
  alertInterval = setInterval(() => {
    if (!gpsBackendMode) injectRandomAlert();
  }, 12000);

  // First alert immediately
  setTimeout(() => { if (!gpsBackendMode) injectRandomAlert(); }, 2000);
  setTimeout(() => { if (!gpsBackendMode) injectRandomAlert(); }, 6000);
}

function updateDot(p) {
  const dot = document.getElementById(`dot-${p.id}`);
  if (!dot) return;
  const [ring, fill, label] = dot.children;
  const cx = p.x, cy = p.y;
  ring.setAttribute('cx', cx); ring.setAttribute('cy', cy);
  fill.setAttribute('cx', cx); fill.setAttribute('cy', cy);
  label.setAttribute('x', cx); label.setAttribute('y', cy);
  dot.style.transform = '';
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function updateMatchMinute() {
  const el = document.getElementById('gps-match-minute');
  if (el) el.textContent = Math.floor(matchMinute) + "'";
}

// ── Player Selection ──
function selectGPSPlayer(id) {
  selectedPlayerId = id;
  const player = GPS_PLAYERS.find(p => p.id === id);
  if (!player) return;

  // Highlight in list
  document.querySelectorAll('.gps-player-item').forEach(el => el.classList.remove('active-player'));
  const listItem = document.getElementById(`gps-li-${id}`);
  if (listItem) listItem.classList.add('active-player');

  updateSelectedPlayerStats(player);
}

function updateSelectedPlayerStats(player) {
  const p = player || GPS_PLAYERS.find(p => p.id === selectedPlayerId);
  if (!p) return;
  const panel = document.getElementById('player-detail-panel');
  if (!panel) return;

  const speedColor = '#fff';

  panel.innerHTML = `
    <div class="flex-between mb-16">
      <div>
        <div class="player-detail-name">${p.name}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span class="pos-badge ${p.role}">${p.pos}</span>
          <span class="text-muted">#${p.number}</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-family:Rajdhani,sans-serif;font-size:28px;font-weight:700;color:#fff">${Math.floor(matchMinute)}'</div>
        <div style="font-size:10px;color:var(--text-3);letter-spacing:1px">MINUT</div>
      </div>
    </div>
    <div class="mini-stat-grid">
      <div class="mini-stat">
        <div class="ms-val" style="color:${speedColor}">${p.speed}</div>
        <div class="ms-lbl">km/h Viteză</div>
      </div>
      <div class="mini-stat">
        <div class="ms-val">${p.distance}</div>
        <div class="ms-lbl">km Distanță</div>
      </div>
      <div class="mini-stat">
        <div class="ms-val">${p.pos}</div>
        <div class="ms-lbl">Rol</div>
      </div>
      <div class="mini-stat">
        <div class="ms-val">${p.sprints}</div>
        <div class="ms-lbl">Sprinturi</div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-3)">Intensitate efort</span>
        <span style="font-size:12px;font-weight:600;color:#fff">${Math.min(Math.round(p.speed / 14 * 100), 100)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(Math.round(p.speed / 14 * 100), 100)}%"></div></div>
    </div>
    <div style="margin-top:16px;padding:10px 12px;background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);font-size:12px;color:var(--text-2)">
      ${getPlayerAITip(p)}
    </div>
  `;
}

function getPlayerAITip(p) {
  if (p.aiRisk && p.aiRisk !== 'low') {
    return `<strong>Model AI-GPS:</strong> risc ${p.aiRisk}, fatigue score ${p.fatigueScore ?? '--'}/100. Verificați evoluția în următoarele minute.`;
  }
  if (p.speed < 5 && p.role !== 'gk') return `Viteză scăzută detectată. Evaluați starea fizică și considerați substituție.`;
  if (p.sprints > 12) return `${p.sprints} sprinturi — efort maxim. Monitorizați recuperarea musculară.`;
  if (p.role === 'att') return `Mențineti pozitia între linii pentru a crea spațiu de primire.`;
  if (p.role === 'def') return `Linia defensivă stabilă. Coordonați pressing-ul cu mijlocașii.`;
  return `Parametri în limite normale. Mențineți ritmul actual.`;
}

function updateTeamStats() {
  updateTrackingSummary(metricaPlayback.loaded ? metricaPlayback.frames[metricaPlayback.index] : null);
}

// ── Player List ──
function renderGPSPlayerList() {
  const list = document.getElementById('gps-player-list');
  if (!list) return;
  list.innerHTML = GPS_PLAYERS.map(p => `
    <div class="gps-player-item" id="gps-li-${p.id}" onclick="selectGPSPlayer(${p.id})">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:28px;height:28px;border-radius:50%;background:${p.color}22;border:1.5px solid ${p.color};display:flex;align-items:center;justify-content:center;font-family:Rajdhani,sans-serif;font-weight:700;font-size:11px;color:${p.color};flex-shrink:0">${p.number}</div>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-1)">${p.name}</div>
          <span class="pos-badge ${p.role}" style="font-size:9px;padding:1px 6px">${p.pos}</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600;color:var(--text-1)" id="li-speed-${p.id}">${p.speed}</div>
        <div style="font-size:10px;color:var(--text-3)">km/h</div>
      </div>
    </div>
  `).join('');

  // Update speed in list periodically
  setInterval(() => {
    GPS_PLAYERS.forEach(p => {
      const el = document.getElementById(`li-speed-${p.id}`);
      if (el) el.textContent = p.speed;
    });
  }, 800);
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
  renderMetricaFrame();
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
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', analyzeUploadedGPSData);
}

async function analyzeUploadedGPSData(event) {
  event.preventDefault();

  const homeFile = document.getElementById('gps-tracking-home')?.files?.[0];
  const awayFile = document.getElementById('gps-tracking-away')?.files?.[0];
  const eventsFile = document.getElementById('gps-events')?.files?.[0];
  const team = document.getElementById('gps-team')?.value || 'Home';
  const reportMinute = Number(document.getElementById('gps-report-minute')?.value || 45);
  const status = document.getElementById('gps-ai-status');

  if (!homeFile || !awayFile || !eventsFile) {
    setGPSAIStatus('Selectează toate cele 3 CSV-uri.', 'warning');
    return;
  }

  gpsBackendMode = true;
  if (alertInterval) clearInterval(alertInterval);
  setGPSAIStatus('Se încarcă replay-ul și analiza...', 'loading');
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
    await loadMetricaPlaybackFromFiles(homeFile, awayFile);

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
    setGPSAIStatus(`Analiză completă · ${data.counts?.coach_alerts ?? 0} alerte`, 'success');
  } catch (error) {
    gpsBackendMode = false;
    setGPSAIStatus('Eroare backend AI-GPS', 'danger');
    renderGPSAIError(error);
  }
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
  if (metricaPlayback.loaded) return;
  predictions.forEach(prediction => {
    const number = String(prediction.player || '').replace(/\D/g, '');
    const player = GPS_PLAYERS.find(p => String(p.number) === number || String(p.id) === number);
    if (!player) return;
    player.aiRisk = prediction.risk_level;
    player.fatigueScore = prediction.fatigue_score;
  });
  updateSelectedPlayerStats();
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

function injectRandomAlert() {
  const unused = GPS_ALERTS_POOL.filter((_, i) => !activeAlertIndices.has(i));
  if (unused.length === 0) { activeAlertIndices.clear(); return; }
  const alert = unused[Math.floor(Math.random() * unused.length)];
  const idx = GPS_ALERTS_POOL.indexOf(alert);
  activeAlertIndices.add(idx);

  shownAlerts.unshift(alert);
  if (shownAlerts.length > 6) shownAlerts.pop();

  const panel = document.getElementById('gps-alerts-panel');
  if (!panel) return;
  panel.innerHTML = renderCoachColumns(buildLocalCoachViews(shownAlerts), Math.floor(matchMinute));
}
