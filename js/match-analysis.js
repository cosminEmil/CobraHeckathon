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
}

function renderMatchHeader(match) {
    const el = document.getElementById('analysis-match-header');
    if (!el) return;
    const [ucjGoals, oppGoals] = match.score.split('-').map(Number);
    el.innerHTML = `
    <div class="team-block">
      <div class="team-badge ucj" style="background:transparent; border:none; display:flex; align-items:center; justify-content:center;">
        <img src="styles/fc-universitatea-cluj-vector-logo-11574297717uidis1p0oi.png" alt="U Cluj" style="max-width:100%; max-height:100%; object-fit:contain;">
      </div>
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
      <div style="color:var(--text-3); font-size:13px; text-align:center; padding: 20px; grid-column: span 2;">
        Se încarcă insight-urile din baza de date și analiza AI...
      </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/matches/${encodeURIComponent(match.id)}/insights`);
        if (!response.ok) throw new Error('Nu s-au putut încărca insight-urile din DB');
        const data = await response.json();

        let html = '';
        
        // AI Summary Card
        if (data.ai_summary) {
            html += `
            <div class="alert-item primary" style="grid-column: span 2; border-left: 4px solid #fff; background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 20px;">
              <div class="alert-content">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#fff">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  <strong style="font-size:14px; letter-spacing:1px; text-transform:uppercase;">Analiză Tactică Post-Meci (AI)</strong>
                </div>
                <p style="margin-top:0; line-height:1.6; color: #eee; font-size:15px; font-style: italic;">
                  "${escapeHTML(data.ai_summary)}"
                </p>
              </div>
            </div>`;
        }

        html += renderDbInsightCard('info', 'Puncte forte (Top 5)', data.top_strengths || []);
        html += renderDbInsightCard('danger', 'Puncte de risc (Top 5)', data.top_weaknesses || []);
        
        panel.innerHTML = html;

        // Update the Win Probability Gauge with the real backend AI result
        if (data.ai_win_probability !== undefined) {
            renderAIWinProbGauge(data.ai_win_probability);
        }
    } catch (error) {
        panel.innerHTML = `
        <div class="alert-item danger" style="grid-column: span 2;">
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

// Efficiency scores rendering removed for cleaner UI

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

function renderAIWinProbGauge(probValue) {
    const valEl = document.getElementById('ai-win-prob-val');
    const labelEl = document.getElementById('ai-win-label');
    const gaugeFill = document.getElementById('gauge-fill');
    if (!valEl || !labelEl || !gaugeFill) return;

    const prob = probValue * 100;

    // Update Gauge
    valEl.textContent = `${prob.toFixed(1)}%`;
    labelEl.textContent = prob > 55 ? "Favoriți la Victorie" : 
                         prob < 45 ? "Risc de Înfrângere" : "Echilibru Tactic";
    
    // Gauge SVG logic
    const offset = 125.6 - (prob / 100) * 125.6;
    gaugeFill.style.strokeDashoffset = offset;
}

function toggleMatchList() {
    const panel = document.getElementById('match-list-panel');
    const arrow = document.getElementById('match-list-arrow');
    if (!panel || !arrow) return;
    panel.classList.toggle('collapsed');
    arrow.style.transform = panel.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
}
