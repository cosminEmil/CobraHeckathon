// =============================================
//  UCJ - Players Module (Alb-Negru)
// =============================================

function renderPlayers() {
  const grid = document.getElementById('players-grid');
  if (!grid) return;
  grid.innerHTML = UCJ_SQUAD.map(p => {
    const eff = +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(0);
    return `
    <div class="player-card" onclick="openPlayerModal(${p.id})">
      <div class="player-number">${p.number}</div>
      <div class="player-name">${p.name}</div>
      <div class="player-pos"><span class="pos-badge ${p.pos.toLowerCase()}">${p.pos}</span></div>
      <div class="player-stat-row" style="border-top:1px solid var(--border);padding-top:12px">
        <div class="player-stat-mini"><div class="val">${p.goals}</div><div class="lbl">Goluri</div></div>
        <div class="player-stat-mini"><div class="val">${p.assists}</div><div class="lbl">Asisturi</div></div>
        <div class="player-stat-mini"><div class="val">${eff}</div><div class="lbl">Eficiență</div></div>
      </div>
    </div>`;
  }).join('');
}

function openPlayerModal(id) {
  const p = UCJ_SQUAD.find(x => x.id === id);
  if (!p) return;
  const eff = +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(1);
  const modal = document.getElementById('player-modal');
  const body = document.getElementById('modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div>
        <div style="font-size:64px;font-family:Rajdhani,sans-serif;font-weight:900;color:#fff;line-height:1">${p.number}</div>
        <div style="font-size:22px;font-weight:700;color:var(--text-1)">${p.name}</div>
        <div style="margin-top:6px"><span class="pos-badge ${p.pos.toLowerCase()}">${p.pos}</span> <span class="text-muted" style="margin-left:8px">${p.age} ani</span></div>
      </div>
      <canvas id="modal-radar" width="200" height="200"></canvas>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${[
      ['⚽ Goluri', p.goals],
      ['🎯 Asisturi', p.assists],
      ['🔗 Pase', p.passes],
      ['📊 Meciuri', p.matches],
    ].map(([l, v]) => `<div class="mini-stat"><div class="ms-val">${v}</div><div class="ms-lbl">${l}</div></div>`).join('')}
    </div>
    <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-sm);margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;color:var(--text-2)">Scor Eficiență AI (formula: G×10 + A×8 + P×0.1)</span>
        <span style="font-family:Rajdhani,sans-serif;font-size:28px;font-weight:700;color:#fff">${eff}</span>
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-item"><span class="progress-name">Goluri / meci</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(p.goals / p.matches * 100 * 5, 100)}%"></div></div><span class="progress-val">${(p.goals / p.matches).toFixed(2)}</span></div>
      <div class="progress-item"><span class="progress-name">Asisturi / meci</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(p.assists / p.matches * 100 * 6, 100)}%;opacity:0.7"></div></div><span class="progress-val">${(p.assists / p.matches).toFixed(2)}</span></div>
      <div class="progress-item"><span class="progress-name">Pase / meci</span><div class="progress-track"><div class="progress-fill" style="width:${Math.min(p.passes / p.matches / 6 * 100, 100)}%;opacity:0.5"></div></div><span class="progress-val">${Math.round(p.passes / p.matches)}</span></div>
    </div>
  `;

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('visible'));

  setTimeout(() => {
    const ctx = document.getElementById('modal-radar');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Gol', 'Asist', 'Pase', 'Prezență', 'Eficiență', 'Constanță'],
        datasets: [{
          data: [
            Math.min(p.goals / 15 * 100, 100),
            Math.min(p.assists / 10 * 100, 100),
            Math.min(p.passes / 560 * 100, 100),
            Math.min(p.matches / 22 * 100, 100),
            Math.min(eff / 175 * 100, 100),
            Math.min((p.matches / 22 * 50 + eff / 175 * 50), 100),
          ],
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderColor: 'rgba(255,255,255,0.7)',
          pointBackgroundColor: '#fff',
          borderWidth: 2, pointRadius: 3,
        }]
      },
      options: {
        responsive: false, plugins: { legend: { display: false } },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' },
            angleLines: { color: 'rgba(255,255,255,0.05)' },
            pointLabels: { color: '#52525b', font: { size: 10 } },
            min: 0, max: 100,
          }
        }
      }
    });
  }, 50);
}

function closeModal() {
  const modal = document.getElementById('player-modal');
  modal.classList.remove('visible');
  setTimeout(() => modal.style.display = 'none', 300);
}
