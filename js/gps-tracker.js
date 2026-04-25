// =============================================
//  UCJ - GPS Tracker Module (Real-time simulation)
// =============================================

let gpsInterval = null;
let alertInterval = null;
let selectedPlayerId = 7; // Hoban default
let matchMinute = 0;
let gpsRunning = false;

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
  { type: 'danger', icon: '🔴', playerId: 7, title: 'Oboseală detectată – Hoban #10', msg: 'Viteza medie scăzută la 6.2 km/h. Recomandare: substituție sau pauza de refacere.' },
  { type: 'warning', icon: '⚠️', playerId: 4, title: 'Bancu #6 – Ieșit din poziție', msg: 'Fundașul a depășit linia de offside de 3 ori. Recalibrare linie defensivă necesară.' },
  { type: 'warning', icon: '📍', playerId: 9, title: 'Vătăjelu #20 – Supra-pozitionare', msg: 'Suprapopulare în zona centrală. Se recomandă distribuire mai largă a mijlocașilor.' },
  { type: 'info', icon: '💡', playerId: 10, title: 'Munteanu #7 – Presing eficient', msg: 'Recuperare minge în treimea adversă (min 67). Continuați presing înalt pe fundașii adversi.' },
  { type: 'danger', icon: '❤️', playerId: 11, title: 'Eduardo – Puls 95% din maxim', msg: 'Frecvența cardiacă la limita roșie. Reduceți intensitatea sau pregătiți schimbarea.' },
  { type: 'success', icon: '✅', playerId: 6, title: 'Itu #8 – Distanță record', msg: '10.8 km parcurși la min 76 — cel mai activ jucător. Contribuție maximă la pressing.' },
  { type: 'warning', icon: '🔮', playerId: 3, title: 'Roman #5 – Zona punct slab', msg: 'Spațiu descoperit pe flancul drept în ultimele 8 minute. Repoziționare urgentă.' },
  { type: 'info', icon: '🤖', playerId: 0, title: 'AI Coach – Sugestie tactică', msg: 'Adversarul atacă sustinut pe flancul stâng. Rotira fundașului #3 cu 10m mai spre centru.' },
  { type: 'info', icon: '🏃', playerId: 12, title: 'Miculescu #11 – Sprint burst', msg: '4 sprinturi consecutive în 5 minute. Evaluați necesitatea menținerii intensității.' },
  { type: 'danger', icon: '⚡', playerId: 2, title: 'Burcă #4 – Crampe posibile', msg: 'Scădere bruscă viteză maximă cu 15%. Semn de oboseală musculară. Monitorizare atentă.' },
];

let activeAlertIndices = new Set();
let shownAlerts = [];

function initGPSTracker() {
  if (gpsRunning) return;
  renderGPSPitch();
  renderGPSPlayerList();
  selectGPSPlayer(selectedPlayerId);
  startGPSSimulation();
  gpsRunning = true;
}

// ── Pitch SVG ──
function renderGPSPitch() {
  const svg = document.getElementById('gps-pitch-svg');
  if (!svg) return;

  // Draw lines
  let pitchHTML = `
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
    <!-- Opponent players -->
    <circle cx="630" cy="220" r="10" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <text x="630" y="220" text-anchor="middle" dominant-baseline="central" font-size="8" fill="white" font-weight="700">GK</text>
    ${generateOpponentPlayers()}
  `;

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
    injectRandomAlert();
  }, 12000);

  // First alert immediately
  setTimeout(() => injectRandomAlert(), 2000);
  setTimeout(() => injectRandomAlert(), 6000);
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

  const hrPct = Math.round((p.hr - 50) / (200 - 50) * 100);
  const hrColor = '#fff';
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
        <div class="ms-val" style="color:${hrColor}">${p.hr}</div>
        <div class="ms-lbl">bpm Puls</div>
      </div>
      <div class="mini-stat">
        <div class="ms-val">${p.sprints}</div>
        <div class="ms-lbl">Sprinturi</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-3)">Puls %FCmax</span>
        <span style="font-size:12px;font-weight:600;color:${hrColor}">${hrPct}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${hrPct > 85 ? 'red' : hrPct > 70 ? '' : 'green'}" style="width:${hrPct}%;background:${hrColor}"></div></div>
    </div>
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-3)">Intensitate efort</span>
        <span style="font-size:12px;font-weight:600;color:#fff">${Math.min(Math.round(p.speed / 14 * 100), 100)}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(Math.round(p.speed / 14 * 100), 100)}%"></div></div>
    </div>
    <div style="margin-top:16px;padding:10px 12px;background:rgba(0,0,0,0.3);border-radius:var(--radius-sm);font-size:12px;color:var(--text-2)">
      <span style="color:#fff;margin-right:6px">🤖</span>
      ${getPlayerAITip(p)}
    </div>
  `;
}

function getPlayerAITip(p) {
  if (p.hr > 185) return `<strong>Alertă!</strong> FCmax atinsă — se recomandă înlocuire în următoarele 5 minute.`;
  if (p.speed < 5 && p.role !== 'gk') return `Viteză scăzută detectată. Evaluați starea fizică și considerați substituție.`;
  if (p.sprints > 12) return `${p.sprints} sprinturi — efort maxim. Monitorizați recuperarea musculară.`;
  if (p.role === 'att') return `Mențineti pozitia între linii pentru a crea spațiu de primire.`;
  if (p.role === 'def') return `Linia defensivă stabilă. Coordonați pressing-ul cu mijlocașii.`;
  return `Parametri în limite normale. Mențineți ritmul actual.`;
}

function updateTeamStats() {
  const avgSpeed = (GPS_PLAYERS.reduce((a, p) => a + p.speed, 0) / GPS_PLAYERS.length).toFixed(1);
  const totalDist = GPS_PLAYERS.reduce((a, p) => a + p.distance, 0).toFixed(1);
  const avgHR = Math.round(GPS_PLAYERS.reduce((a, p) => a + p.hr, 0) / GPS_PLAYERS.length);
  const intensive = GPS_PLAYERS.filter(p => p.hr > 170).length;

  const e = id => document.getElementById(id);
  if (e('team-avg-speed')) e('team-avg-speed').textContent = avgSpeed;
  if (e('team-total-dist')) e('team-total-dist').textContent = totalDist;
  if (e('team-avg-hr')) e('team-avg-hr').textContent = avgHR;
  if (e('team-intensive')) e('team-intensive').textContent = intensive + '/13';
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

// ── Alerts ──
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
  panel.innerHTML = shownAlerts.map(a => `
    <div class="alert-item ${a.type}">
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-content"><strong>${a.title}</strong>${a.msg}</div>
    </div>`).join('');
}
