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

window.MATCHES = [];
window.UCJ_SQUAD = [];
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
    // Backend offline: keep empty data instead of showing fabricated statistics.
  }
}

// ── Init default page ──
loadBackendData().finally(() => navigate('dashboard-page'));
