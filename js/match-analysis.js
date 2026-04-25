// =============================================
//  UCJ - Match Analysis Module (Alb-Negru)
//  Mirroring logic from analysis.py
// =============================================

let selectedMatchId = null;
let lineBreakersChart = null;
let radarChart = null;
const matchInsightsCache = {};
const matchPlayersCache = {};
let currentMatchPlayers = [];

function initMatchAnalysis() {
    if (!selectedMatchId && Array.isArray(window.MATCHES) && window.MATCHES.length > 0) {
        selectedMatchId = window.MATCHES[0].id;
    }
    renderMatchChips();
    if (selectedMatchId) loadMatch(selectedMatchId);
}

function renderMatchChips() {
    const container = document.getElementById('match-chips');
    if (!container) return;
    container.innerHTML = (window.MATCHES || []).map(m =>
        `<button class="match-chip ${m.id === selectedMatchId ? 'active' : ''}"
      onclick="loadMatch('${m.id}')" id="chip-${m.id}">${m.label}</button>`
    ).join('');
}

async function loadMatch(matchId) {
    selectedMatchId = matchId;
    document.querySelectorAll('.match-chip').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById(`chip-${matchId}`);
    if (chip) chip.classList.add('active');

    const match = (window.MATCHES || []).find(m => m.id === matchId);
    if (!match) return;
    currentMatchPlayers = await fetchMatchPlayers(matchId);

    renderMatchHeader(match);
    renderMatchStats(match);
    renderLineBreakersChart(matchId);
    renderRadarChart(match);
    renderAIRecommendations(match);
    renderEfficiencyScores();
}

function renderMatchHeader(match) {
    const el = document.getElementById('analysis-match-header');
    if (!el) return;
    const [ucjGoals, oppGoals] = match.score.split('-').map(Number);
    el.innerHTML = `
    <div class="team-block">
      <div class="team-badge ucj">U</div>
      <div class="team-name">U Cluj</div>
    </div>
    <div class="score-display">
      <div class="score-nums">
        <span>${ucjGoals}</span>
        <span class="score-sep">:</span>
        <span>${oppGoals}</span>
      </div>
      <div class="score-meta">${match.date} · ${match.opponent}</div>
      <div style="margin-top:8px">
        <span class="tag ${ucjGoals > oppGoals ? 'white' : ucjGoals === oppGoals ? 'white' : 'white'}">
          ${ucjGoals > oppGoals ? 'VICTORIE' : ucjGoals === oppGoals ? 'EGALITATE' : 'ÎNFRÂNGERE'}
        </span>
      </div>
    </div>
    <div class="team-block">
      <div class="team-badge opp">${match.opponent.substring(0, 2).toUpperCase()}</div>
      <div class="team-name">${match.opponent}</div>
    </div>
  `;
}

function renderMatchStats(match) {
    const stats = [
        { id: 'ms-passes', val: match.passes, label: 'Pase totale' },
        { id: 'ms-pass-acc', val: match.passAcc + '%', label: 'Acuratețe pase' },
        { id: 'ms-shots', val: match.shots, label: 'Șuturi' },
        { id: 'ms-shots-ot', val: match.shotsOT, label: 'Șuturi pe poartă' },
        { id: 'ms-corners', val: match.corners, label: 'Cornere' },
        { id: 'ms-fouls', val: match.fouls, label: 'Faulturi' },
    ];
    stats.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) el.innerHTML = `<div class="stat-value">${s.val}</div><div class="stat-label">${s.label}</div>`;
    });

}

function renderLineBreakersChart(matchId) {
    const canvas = document.getElementById('line-breakers-chart');
    if (!canvas) return;

    const ranked = [...(currentMatchPlayers || [])]
        .sort((a, b) => (b.passes_final_third || 0) - (a.passes_final_third || 0))
        .slice(0, 5);
    const players = ranked.map(p => p.name);
    const data = ranked.map(p => p.passes_final_third || 0);

    if (lineBreakersChart) lineBreakersChart.destroy();
    lineBreakersChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: players,
            datasets: [{
                label: 'Pase în treimea adversă',
                data: data,
                backgroundColor: data.map((_, i) =>
                    i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'
                ),
                borderColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#52525b' }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { ticks: { color: '#52525b' }, grid: { color: 'rgba(255,255,255,0.03)' } }
            }
        }
    });
}

function renderRadarChart(match) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    if (radarChart) radarChart.destroy();
    const maxFinalThirdPasses = Math.max(
        1,
        ...(currentMatchPlayers || []).map(p => p.passes_final_third || 0)
    );
    const totalFinalThirdPasses = (currentMatchPlayers || []).reduce(
        (sum, p) => sum + (p.passes_final_third || 0),
        0
    );
    const normalised = {
        atac: Math.min((match.shots / 18) * 100, 100),
        precizie: match.passAcc,
        progresie: Math.min((totalFinalThirdPasses / (maxFinalThirdPasses * 5)) * 100, 100),
        disciplina: Math.max(0, Math.min(((20 - match.fouls) / 20) * 100, 100)),
        cornere: Math.min((match.corners / 10) * 100, 100),
    };
    radarChart = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: ['Atac', 'Precizie', 'Pase T3', 'Disciplină', 'Cornere'],
            datasets: [{
                label: 'U Cluj',
                data: Object.values(normalised),
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.7)',
                pointBackgroundColor: '#fff',
                borderWidth: 2,
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    angleLines: { color: 'rgba(255,255,255,0.05)' },
                    pointLabels: { color: '#52525b', font: { size: 12 } },
                    min: 0, max: 100,
                }
            }
        }
    });
}

async function renderAIRecommendations(match) {
    const panel = document.getElementById('ai-recommendations');
    if (!panel) return;

    panel.innerHTML = `
      <div style="color:var(--text-3); font-size:13px; text-align:center; padding: 20px;">
        Se încarcă insight-urile din baza de date...
      </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/matches/${encodeURIComponent(match.id)}/insights`);
        if (!response.ok) throw new Error('Nu s-au putut încărca insight-urile din DB');
        const data = await response.json();

        panel.innerHTML = [
            renderDbInsightCard('info', 'Puncte forte din baza de date', data.top_strengths || []),
            renderDbInsightCard('danger', 'Puncte de risc din baza de date', data.top_weaknesses || []),
        ].join('');
    } catch (error) {
        panel.innerHTML = `
        <div class="alert-item danger">
          <div class="alert-content"><strong>Date indisponibile</strong>Nu se pot încărca insight-urile calculate din baza de date pentru acest meci.</div>
        </div>`;
    }
}

function renderDbInsightCard(type, title, items) {
    if (!items.length) {
        return `
        <div class="alert-item ${type}">
          <div class="alert-content"><strong>${title}</strong>Nu există suficiente date în baza SQLite pentru această categorie.</div>
        </div>`;
    }
    const list = items.map(item => `
      <li>
        ${escapeHTML(item.feature)}
        ${item.evidence ? `<br><span style="color:var(--text-2)">${escapeHTML(item.evidence)}</span>` : ''}
      </li>
    `).join('');
    return `
    <div class="alert-item ${type}">
      <div class="alert-content"><strong>${title}</strong><ul style="margin:5px 0 0 16px;padding:0">${list}</ul></div>
    </div>`;
}

function escapeHTML(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function renderEfficiencyScores() {
    const tbody = document.getElementById('efficiency-table-body');
    if (!tbody) return;
    const sorted = [...(currentMatchPlayers || [])]
        .map(p => ({
            ...p,
            eff: +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(1)
        }))
        .sort((a, b) => b.eff - a.eff)
        .slice(0, 10);

    tbody.innerHTML = sorted.map((p, i) => `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:11px 8px;color:var(--text-3);width:32px">${i + 1}</td>
      <td style="padding:11px 8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-weight:500;font-size:13.5px">${p.name}</span>
        </div>
      </td>
      <td style="padding:11px 8px;color:var(--text-2);text-align:center">${p.goals}</td>
      <td style="padding:11px 8px;color:var(--text-2);text-align:center">${p.assists}</td>
      <td style="padding:11px 8px;color:var(--text-2);text-align:center">${p.passes}</td>
      <td style="padding:11px 8px;text-align:center">
        <span style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:#fff">${p.eff}</span>
      </td>
    </tr>
  `).join('');
}

async function fetchMatchPlayers(matchId) {
    let cached = matchPlayersCache[matchId];
    if (cached) return cached;
    try {
        const response = await fetch(`${API_BASE}/matches/${encodeURIComponent(matchId)}/players`);
        if (!response.ok) return [];
        const payload = await response.json();
        cached = Array.isArray(payload.players) ? payload.players : [];
        matchPlayersCache[matchId] = cached;
        return cached;
    } catch (error) {
        return [];
    }
}

function toggleMatchList() {
    const panel = document.getElementById('match-list-panel');
    const arrow = document.getElementById('match-list-arrow');
    if (!panel || !arrow) return;
    panel.classList.toggle('collapsed');
    arrow.style.transform = panel.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
}
