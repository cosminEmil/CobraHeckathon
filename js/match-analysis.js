// =============================================
//  UCJ - Match Analysis Module (Alb-Negru)
//  Mirroring logic from analysis.py
// =============================================

let selectedMatchId = 'fcsb-ucj';
let lineBreakersChart = null;
let possessionChart = null;
let radarChart = null;

function initMatchAnalysis() {
    renderMatchChips();
    loadMatch(selectedMatchId);
}

function renderMatchChips() {
    const container = document.getElementById('match-chips');
    if (!container) return;
    container.innerHTML = MATCHES.map(m =>
        `<button class="match-chip ${m.id === selectedMatchId ? 'active' : ''}"
      onclick="loadMatch('${m.id}')" id="chip-${m.id}">${m.label}</button>`
    ).join('');
}

function loadMatch(matchId) {
    selectedMatchId = matchId;
    document.querySelectorAll('.match-chip').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById(`chip-${matchId}`);
    if (chip) chip.classList.add('active');

    const match = MATCHES.find(m => m.id === matchId);
    if (!match) return;

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

    const matchData = {
        'fcsb-ucj': [42, 38, 35, 29, 24],
        'cfr-ucj': [31, 27, 25, 21, 18],
        'sep-ucj': [22, 19, 17, 14, 11],
        'fcb-ucj': [48, 43, 39, 32, 27],
    };
    const players = ['Hoban', 'Munteanu', 'Vătăjelu', 'Itu', 'Deac'];
    const data = matchData[matchId] || matchData['fcsb-ucj'];

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

function renderAIRecommendations(match) {
    const panel = document.getElementById('ai-recommendations');
    if (!panel) return;
    const recs = [];

    if (match.possession < 45) {
        recs.push({ type: 'danger', icon: '⚠️', title: 'Posesie scăzută', msg: `Posesia de ${match.possession}% indică dominanța adversarului. Recomandare: presing mai agresiv și rotație rapidă.` });
    }
    if (match.passAcc < 78) {
        recs.push({ type: 'warning', icon: '📉', title: 'Acuratețe pase sub medie', msg: `${match.passAcc}% acuratețe — sub pragul optim de 80%. Antrenament pe pase sub presing recomandat.` });
    }
    if (match.shotsOT < match.shots * 0.45) {
        recs.push({ type: 'warning', icon: '🎯', title: 'Eficiență la finalizare redusă', msg: `Doar ${match.shotsOT} din ${match.shots} șuturi pe poartă (${Math.round(match.shotsOT / match.shots * 100)}%). Exerciții de finalizare prioritare.` });
    }
    if (match.possession >= 50) {
        recs.push({ type: 'success', icon: '✅', title: 'Dominanță posesie excelentă', msg: `${match.possession}% posesie — U Cluj controlează ritmul. Continuați să exploatați spațiile libere.` });
    }
    if (match.passAcc >= 82) {
        recs.push({ type: 'success', icon: '🔗', title: 'Circuit de pase solid', msg: `Acuratețe de ${match.passAcc}% confirmă circulația eficientă a mingii. Modelul de triangulare funcționează.` });
    }
    recs.push({ type: 'info', icon: '💡', title: 'Line-Breakers top', msg: `Hoban și Munteanu generează cele mai multe pase în treimea adversă — menținerea acestui pattern crește șansele de gol.` });
    if (match.yellowCards >= 2) {
        recs.push({ type: 'danger', icon: '🟨', title: `${match.yellowCards} cartonașe galbene`, msg: 'Disciplina tactică necesită îmbunătățire. Faulturile repetate expun echipa la superioritate numerică adversă.' });
    }

    panel.innerHTML = recs.map(r => `
    <div class="alert-item ${r.type}">
      <span class="alert-icon">${r.icon}</span>
      <div class="alert-content"><strong>${r.title}</strong>${r.msg}</div>
    </div>`).join('');
}

function renderEfficiencyScores() {
    const tbody = document.getElementById('efficiency-table-body');
    if (!tbody) return;
    const sorted = [...UCJ_SQUAD]
        .map(p => ({
            ...p,
            eff: +(p.goals * 10 + p.assists * 8 + p.passes * 0.1 - (Math.random() * 3 | 0) * 2).toFixed(1)
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
