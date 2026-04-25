// =============================================
//  UCJ - Players Module (Alb-Negru)
// =============================================

function renderPlayers() {
  const grid = document.getElementById('players-grid');
  if (!grid) return;
  if (!Array.isArray(window.UCJ_SQUAD) || !window.UCJ_SQUAD.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1 / -1"><div class="text-muted">Nu există jucători încărcați din baza de date.</div></div>`;
    return;
  }
  grid.innerHTML = (window.UCJ_SQUAD || []).map(p => {
    const eff = +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(0);
    return `
    <div class="player-card" onclick="openPlayerModal(${p.id})">
      <div class="player-name">${p.name}</div>
      <div class="player-stat-row" style="border-top:1px solid var(--border);padding-top:12px">
        <div class="player-stat-mini"><div class="val">${p.goals}</div><div class="lbl">Goluri</div></div>
        <div class="player-stat-mini"><div class="val">${p.assists}</div><div class="lbl">Asisturi</div></div>
        <div class="player-stat-mini"><div class="val">${eff}</div><div class="lbl">Indice</div></div>
      </div>
    </div>`;
  }).join('');
}

function openPlayerModal(id) {
  const p = (window.UCJ_SQUAD || []).find(x => x.id === id);
  if (!p) return;
  const eff = +(p.goals * 10 + p.assists * 8 + p.passes * 0.1).toFixed(1);
  const modal = document.getElementById('player-modal');
  const body = document.getElementById('modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div>
        <div style="font-size:22px;font-weight:700;color:var(--text-1)">${p.name}</div>
        <div style="margin-top:6px"><span class="text-muted">ID dataset ${p.id}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${[
      ['Goluri', p.goals],
      ['Asisturi', p.assists],
      ['Pase', p.passes],
      ['Meciuri', p.matches],
    ].map(([l, v]) => `<div class="mini-stat"><div class="ms-val">${v}</div><div class="ms-lbl">${l}</div></div>`).join('')}
    </div>
    <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-sm);margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;color:var(--text-2)">Indice calculat din DB (G×10 + A×8 + P×0.1)</span>
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
}

function closeModal() {
  const modal = document.getElementById('player-modal');
  modal.classList.remove('visible');
  setTimeout(() => modal.style.display = 'none', 300);
}
