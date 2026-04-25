// =============================================
//  UCJ - Dashboard
// =============================================

function initDashboard() {
    renderDashboard();
    animateCounters();
    renderFormStrip();
}

function renderDashboard() {
    const matches = Array.isArray(window.MATCHES) ? window.MATCHES : [];
    const squad = Array.isArray(window.UCJ_SQUAD) ? window.UCJ_SQUAD : [];

    const totals = matches.reduce((acc, match) => {
        const [scored, conceded] = String(match.score || "0-0").split("-").map(Number);
        if (Number.isFinite(scored) && Number.isFinite(conceded)) {
            if (scored > conceded) acc.wins += 1;
            else if (scored === conceded) acc.draws += 1;
        }
        acc.passAcc += Number(match.passAcc || 0);
        return acc;
    }, { wins: 0, draws: 0, passAcc: 0 });

    const totalMatches = matches.length;
    const points = totals.wins * 3 + totals.draws;
    const positiveRate = totalMatches > 0 ? ((totals.wins + totals.draws) / totalMatches) * 100 : 0;
    const avgPassAcc = totalMatches > 0 ? totals.passAcc / totalMatches : 0;
    const ppg = totalMatches > 0 ? points / totalMatches : 0;
    setCounter("db-kpi-matches", totalMatches);
    setCounter("db-kpi-points", points);
    setCounter("db-kpi-positive-rate", positiveRate, true, "%");
    setCounter("db-kpi-pass-acc", avgPassAcc, true, "%");

    setText("db-kpi-matches-sub", `${Math.max(totalMatches - 1, 0)} meciuri cu comparație istorică`);
    setText("db-kpi-ppg", `${ppg.toFixed(2)} puncte / meci`);

    renderPositiveSummary({
        wins: totals.wins,
        draws: totals.draws,
        totalMatches,
        ppg,
        avgPassAcc,
    });
    renderTopRankings(squad);
}

function setCounter(id, value, isFloat = false, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    const safeValue = Number.isFinite(value) ? value : 0;
    const printable = isFloat ? safeValue.toFixed(1) : Math.round(safeValue).toString();
    el.dataset.counter = String(Number(printable));
    el.dataset.suffix = suffix;
    el.textContent = `${printable}${suffix}`;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderPositiveSummary({ wins, draws, totalMatches, ppg, avgPassAcc }) {
    const container = document.getElementById("db-positive-summary");
    if (!container) return;
    const matchCount = Math.max(Number(totalMatches || 0), 1);
    const items = [
        { label: "Victorii", value: String(wins), width: (wins / matchCount) * 100 },
        { label: "Egaluri", value: String(draws), width: (draws / matchCount) * 100 },
        { label: "Medie puncte / meci", value: ppg.toFixed(2), width: (ppg / 3) * 100 },
        { label: "Precizie pase", value: `${avgPassAcc.toFixed(1)}%`, width: avgPassAcc },
    ];
    container.innerHTML = items.map((item) => `
        <div class="progress-item">
          <span class="progress-name">${item.label}</span>
          <div class="progress-track"><div class="progress-fill white" style="width:${Math.max(Math.min(item.width, 100), 0)}%"></div></div>
          <span class="progress-val">${item.value}</span>
        </div>
    `).join("");
}

function renderTopRankings(squad) {
    const byGoals = [...squad].sort((a, b) => Number(b.goals || 0) - Number(a.goals || 0)).slice(0, 5);
    const byAssists = [...squad].sort((a, b) => Number(b.assists || 0) - Number(a.assists || 0)).slice(0, 5);
    const byPassing = [...squad]
        .map((player) => ({
            ...player,
            passesPerMatch: Number(player.passes || 0) / Math.max(Number(player.matches || 1), 1),
        }))
        .sort((a, b) => b.passesPerMatch - a.passesPerMatch)
        .slice(0, 5);

    renderRankingBlock("db-top-scorers", byGoals, "goals", 1);
    renderRankingBlock("db-top-assists", byAssists, "assists", 1);
    renderRankingBlock("db-top-build-up", byPassing, "passesPerMatch", 10, true);
}

function renderRankingBlock(containerId, players, key, minMax = 1, isFloat = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!players.length) {
        container.innerHTML = `<div class="text-muted">Date indisponibile momentan.</div>`;
        return;
    }

    const maxValue = Math.max(...players.map((player) => Number(player[key] || 0)), minMax);
    container.innerHTML = players.map((player) => {
        const value = Number(player[key] || 0);
        const width = Math.max((value / maxValue) * 100, 8);
        return `
        <div class="progress-item">
          <span class="progress-name">${player.name}</span>
          <div class="progress-track"><div class="progress-fill green" style="width:${width}%"></div></div>
          <span class="progress-val">${isFloat ? value.toFixed(1) : Math.round(value)}</span>
        </div>`;
    }).join("");
}

function animateCounters() {
    document.querySelectorAll('[data-counter]').forEach(el => {
        const target = parseFloat(el.dataset.counter);
        const isFloat = el.dataset.counter.includes('.');
        const suffix = el.dataset.suffix || '';
        const duration = 1500;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const val = eased * target;
            el.textContent = `${isFloat ? val.toFixed(1) : Math.round(val)}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

function renderFormStrip() {
    const strip = document.getElementById('form-strip');
    if (!strip) return;
    const sourceMatches = Array.isArray(window.MATCHES) ? window.MATCHES.slice(0, 10) : [];
    const form = sourceMatches
        .map((match) => {
            const [scored, conceded] = String(match.score || "0-0").split("-").map(Number);
            if (!Number.isFinite(scored) || !Number.isFinite(conceded)) return null;
            if (scored > conceded) return "W";
            if (scored === conceded) return "D";
            return "L";
        })
        .filter(Boolean);

    if (!form.length) {
        strip.innerHTML = `<span class="text-muted">Nu există meciuri încărcate din baza de date.</span>`;
        return;
    }
    strip.innerHTML = form.map(result => {
        const colors = { W: '#ffffff', D: '#a1a1aa', L: '#52525b' };
        const color = colors[result] || '#52525b';
        return `<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.3);border:2px solid ${color};color:${color};font-size:12px;font-weight:700;">${result}</span>`;
    }).join('');
}
