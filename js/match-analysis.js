// =============================================
//  UCJ - Match Analysis Module (Alb-Negru)
//  Mirroring logic from analysis.py
// =============================================

let selectedMatchId = null;
let lineBreakersChart = null;
let possessionChart = null;
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
    renderPossessionChart(match);
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
          ${ucjGoals > oppGoals ? '✓ VICTORIE' : ucjGoals === oppGoals ? '— EGALITATE' : '✗ ÎNFRÂNGERE'}
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
        { id: 'ms-possession', val: match.possession + '%', label: 'Posesie UCJ' },
        { id: 'ms-passes', val: match.passes, label: 'Pase totale' },
        { id: 'ms-pass-acc', val: match.passAcc + '%', label: 'Acuratețe pase' },
        { id: 'ms-shots', val: match.shots, label: 'Șuturi' },
        { id: 'ms-shots-ot', val: match.shotsOT, label: 'Șuturi pe poartă' },
        { id: 'ms-distance', val: match.distanceCovered + ' km', label: 'Distanță acoperită' },
    ];
    stats.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) el.innerHTML = `<div class="stat-value">${s.val}</div><div class="stat-label">${s.label}</div>`;
    });

    const score = Math.round(
        (match.possession / 100) * 25 +
        (match.passAcc / 100) * 25 +
        (match.shotsOT / Math.max(match.shots, 1)) * 25 +
        (match.distanceCovered / 115) * 25
    );
    renderScoreRing(score);
}

function renderScoreRing(score) {
    const el = document.getElementById('perf-score-ring');
    if (!el) return;
    const circumference = 2 * Math.PI * 54;
    const dashoffset = circumference * (1 - score / 100);
    // Monochrome: full white for high, dimmer for low
    const opacity = score >= 70 ? 1 : score >= 50 ? 0.7 : 0.45;
    el.innerHTML = `
    <div class="score-ring">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
        <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="10"
          stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}"
          stroke-linecap="round" transform="rotate(-90 70 70)"
          style="transition:stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)"/>
        <text x="70" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="rgba(255,255,255,${opacity})" font-family="Rajdhani,sans-serif">${score}</text>
        <text x="70" y="84" text-anchor="middle" font-size="11" fill="#52525b" font-family="Inter,sans-serif">SCOR</text>
      </svg>
      <div class="score-label">Performanță meci</div>
    </div>
  `;
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

function renderPossessionChart(match) {
    const canvas = document.getElementById('possession-chart');
    if (!canvas) return;
    if (possessionChart) possessionChart.destroy();
    possessionChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['U Cluj', match.opponent],
            datasets: [{
                data: [match.possession, 100 - match.possession],
                backgroundColor: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.12)'],
                borderColor: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.04)'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#52525b', padding: 12, font: { size: 12 } } }
            }
        }
    });
}

function renderRadarChart(match) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    if (radarChart) radarChart.destroy();
    const normalised = {
        atac: Math.min((match.shots / 18) * 100, 100),
        precizie: match.passAcc,
        posesie: match.possession,
        presing: Math.min(((20 - match.fouls) / 20) * 100, 100),
        acoperire: Math.min((match.distanceCovered / 112) * 100, 100),
        cornere: Math.min((match.corners / 10) * 100, 100),
    };
    radarChart = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: ['Atac', 'Precizie', 'Posesie', 'Presing', 'Acoperire', 'Standarde'],
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

    // Show a loading state
    panel.innerHTML = `
      <div style="color:var(--text-3); font-size:13px; text-align:center; padding: 20px;">
        <svg style="animation: spin 1s linear infinite; height: 24px; width: 24px; color: var(--gold);" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <br/><br/>
        Procesare Insight-uri AI & Generare Tactică Gemini...
      </div>
      <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
    `;

    try {
        const statsPayload = {
            "avg_possession": match.possession,
            "total_passes": match.passes,
            "percent_passAcc": match.passAcc,
            "total_shots": match.shots,
            "total_shotsOnTarget": match.shotsOT,
            "total_distance": match.distanceCovered
        };

        const response = await fetch(`${API_BASE}/diagnostics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stats: statsPayload })
        });

        if (!response.ok) throw new Error('API Response Error');
        const data = await response.json();

        const recs = [];
        
        if (data.tactical_advice) {
            recs.push({ type: 'success', icon: '🤖', title: 'Digital Coach (Gemini)', msg: data.tactical_advice });
        }
        
        if (data.top_strengths && data.top_strengths.length > 0) {
            const sHtml = data.top_strengths.map(s => `<li>${s.feature} <br><span style="color:#22c55e">(Impact +${s.impact.toFixed(3)})</span></li>`).join('');
            recs.push({ type: 'info', icon: '⚡', title: 'Top Puncte Forte (SHAP)', msg: `<ul style="margin:5px 0 0 16px;padding:0">${sHtml}</ul>` });
        }

        if (data.top_weaknesses && data.top_weaknesses.length > 0) {
            const wHtml = data.top_weaknesses.map(s => `<li>${s.feature} <br><span style="color:#ef4444">(Impact ${s.impact.toFixed(3)})</span></li>`).join('');
            recs.push({ type: 'danger', icon: '⚠️', title: 'Top Puncte Slabe (SHAP)', msg: `<ul style="margin:5px 0 0 16px;padding:0">${wHtml}</ul>` });
        }

        panel.innerHTML = recs.map(r => `
        <div class="alert-item ${r.type}">
          <span class="alert-icon">${r.icon}</span>
          <div class="alert-content"><strong>${r.title}</strong>${r.msg}</div>
        </div>`).join('');
        
    } catch (error) {
        panel.innerHTML = `
        <div class="alert-item danger">
          <span class="alert-icon">❌</span>
          <div class="alert-content"><strong>Eroare Conexiune</strong>Nu se poate accesa Backend-ul pe port 8000. Startați serverul Uvicorn!</div>
        </div>`;
    }
}

function renderEfficiencyScores() {
    const tbody = document.getElementById('efficiency-table-body');
    if (!tbody) return;
    const sorted = [...(currentMatchPlayers || [])]
        .map(p => ({
            ...p,
            number: '-',
            eff: +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(1)
        }))
        .sort((a, b) => b.eff - a.eff)
        .slice(0, 10);

    tbody.innerHTML = sorted.map((p, i) => `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:11px 8px;color:var(--text-3);width:32px">${i + 1}</td>
      <td style="padding:11px 8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:30px;height:30px;border-radius:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-family:Rajdhani,sans-serif;font-weight:700;color:#fff;font-size:13px">${p.number}</div>
          <span style="font-weight:500;font-size:13.5px">${p.name}</span>
        </div>
      </td>
      <td style="padding:11px 8px;"><span class="pos-badge ${p.pos.toLowerCase()}">${p.pos}</span></td>
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
