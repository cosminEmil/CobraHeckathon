// =============================================
//  UCJ - App.js (Router + Shared Utilities)
// =============================================

// ── Navigation ──
function navigate(pageId) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // Trigger page-specific init
  if (pageId === 'gps-tracker-page') initGPSTracker();
  if (pageId === 'match-analysis-page') initMatchAnalysis();
  if (pageId === 'players-page') renderPlayers();
  if (pageId === 'dashboard-page') initDashboard();
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// ── Clock ──
function updateClock() {
  const now = new Date();
  const el = document.getElementById('topbar-clock');
  if (el) el.textContent = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ── UCJ Squad Data ──
const UCJ_SQUAD = [
  { id: 1, number: 1,  name: 'Laurențiu Brănescu',     pos: 'GK',  age: 33, goals: 0, assists: 0, passes: 210, efficiency: 15.4, matches: 18 },
  { id: 2, number: 4,  name: 'Burcă Andrei',           pos: 'DEF', age: 28, goals: 1, assists: 3, passes: 412, efficiency: 59.2, matches: 21 },
  { id: 3, number: 5,  name: 'Mihai Roman',            pos: 'DEF', age: 26, goals: 0, assists: 1, passes: 380, efficiency: 44.0, matches: 20 },
  { id: 4, number: 6,  name: 'Nicusor Bancu',          pos: 'DEF', age: 29, goals: 2, assists: 2, passes: 350, efficiency: 70.0, matches: 22 },
  { id: 5, number: 3,  name: 'Cristi Manea',           pos: 'DEF', age: 26, goals: 1, assists: 4, passes: 320, efficiency: 68.0, matches: 19 },
  { id: 6, number: 8,  name: 'Cătălin Itu',            pos: 'MID', age: 27, goals: 3, assists: 5, passes: 520, efficiency: 108.0, matches: 22 },
  { id: 7, number: 10, name: 'Ovidiu Hoban',           pos: 'MID', age: 30, goals: 4, assists: 6, passes: 480, efficiency: 128.0, matches: 21 },
  { id: 8, number: 14, name: 'Andreas Callă',          pos: 'MID', age: 25, goals: 2, assists: 3, passes: 440, efficiency: 88.0, matches: 20 },
  { id: 9, number: 20, name: 'Bogdan Vătăjelu',        pos: 'MID', age: 27, goals: 5, assists: 7, passes: 395, efficiency: 141.5, matches: 22 },
  { id: 10, number: 7, name: 'Louis Munteanu',         pos: 'ATT', age: 22, goals: 11, assists: 4, passes: 220, efficiency: 174.0, matches: 22 },
  { id: 11, number: 9, name: 'Eduardo Camavinga-UCJ', pos: 'ATT', age: 24, goals: 8, assists: 3, passes: 195, efficiency: 134.5, matches: 20 },
  { id: 12, number: 11, name: 'David Miculescu',      pos: 'ATT', age: 23, goals: 6, assists: 5, passes: 210, efficiency: 120.0, matches: 21 },
  { id: 13, number: 22, name: 'Alexandru Ioniță',     pos: 'MID', age: 31, goals: 3, assists: 8, passes: 460, efficiency: 122.0, matches: 18 },
  { id: 14, number: 17, name: 'Ciprian Deac',         pos: 'ATT', age: 37, goals: 5, assists: 6, passes: 310, efficiency: 136.0, matches: 17 },
  { id: 15, number: 25, name: 'Vasile Mogoș',         pos: 'DEF', age: 28, goals: 1, assists: 2, passes: 295, efficiency: 55.5, matches: 19 },
  { id: 16, number: 77, name: 'Băluță Alexandru',     pos: 'MID', age: 29, goals: 4, assists: 5, passes: 410, efficiency: 117.0, matches: 20 },
];

const MATCHES = [
  { id: 'cfr-ucj',  label: 'CFR Cluj 1-1',      opponent: 'CFR Cluj',  score: '1-1', date: '20 Apr 2025', possession: 43, shots: 9, shotsOT: 4, passes: 412, passAcc: 78, corners: 5, fouls: 12, yellowCards: 2, redCards: 0, distanceCovered: 105.4, topSpeed: 33.2 },
  { id: 'fcsb-ucj', label: 'FCSB 0-2',           opponent: 'FCSB',     score: '2-0', date: '13 Apr 2025', possession: 52, shots: 14, shotsOT: 7, passes: 510, passAcc: 84, corners: 7, fouls: 9, yellowCards: 1, redCards: 0, distanceCovered: 108.1, topSpeed: 34.5 },
  { id: 'sep-ucj',  label: 'Sepsi OSK 3-1',      opponent: 'Sepsi OSK', score: '1-3', date: '6 Apr 2025',  possession: 38, shots: 7, shotsOT: 3, passes: 355, passAcc: 71, corners: 3, fouls: 15, yellowCards: 3, redCards: 1, distanceCovered: 101.8, topSpeed: 32.1 },
  { id: 'fcb-ucj',  label: 'FC Botoșani 2-2',    opponent: 'Botoșani',  score: '2-2', date: '30 Mar 2025', possession: 56, shots: 16, shotsOT: 8, passes: 560, passAcc: 87, corners: 9, fouls: 8, yellowCards: 1, redCards: 0, distanceCovered: 110.2, topSpeed: 35.0 },
];

window.UCJ_SQUAD = UCJ_SQUAD;
window.MATCHES = MATCHES;

// ── Init default page ──
navigate('dashboard-page');
