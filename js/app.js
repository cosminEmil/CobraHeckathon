// =============================================
//  UCJ - App.js (Router + Shared Utilities)
// =============================================

const API_BASE = 'http://127.0.0.1:8000/api/v1';

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

const FALLBACK_SQUAD = [
  { id: 1, number: 1, name: 'Test Goalkeeper', pos: 'GK', age: 0, goals: 0, assists: 0, passes: 180, matches: 10 },
  { id: 2, number: 2, name: 'Test Defender', pos: 'DEF', age: 0, goals: 1, assists: 1, passes: 360, matches: 10 },
  { id: 3, number: 3, name: 'Test Midfielder', pos: 'MID', age: 0, goals: 3, assists: 4, passes: 520, matches: 10 },
  { id: 4, number: 4, name: 'Test Attacker', pos: 'ATT', age: 0, goals: 7, assists: 2, passes: 200, matches: 10 },
];

window.MATCHES = [];
window.UCJ_SQUAD = [...FALLBACK_SQUAD];
window.PLAYER_INSIGHTS = { top_strengths: [], top_weaknesses: [] };

async function loadBackendData() {
  try {
    const [matchesRes, playersRes] = await Promise.all([
      fetch(`${API_BASE}/matches/ucluj`),
      fetch(`${API_BASE}/players/overall-insights`),
    ]);

    if (matchesRes.ok) {
      const matchesPayload = await matchesRes.json();
      const apiMatches = Array.isArray(matchesPayload.matches) ? matchesPayload.matches : [];
      if (apiMatches.length > 0) {
        window.MATCHES = [...apiMatches];
      }
    }

    if (playersRes.ok) {
      const playersPayload = await playersRes.json();
      if (Array.isArray(playersPayload.squad) && playersPayload.squad.length > 0) {
        window.UCJ_SQUAD = playersPayload.squad;
      }
      window.PLAYER_INSIGHTS = {
        top_strengths: playersPayload.top_strengths || [],
        top_weaknesses: playersPayload.top_weaknesses || [],
      };
    }
  } catch (err) {
    // keep fallbacks when backend is offline
  }
}

// ── Init default page ──
loadBackendData().finally(() => navigate('dashboard-page'));
