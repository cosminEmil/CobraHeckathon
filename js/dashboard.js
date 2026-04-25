// =============================================
//  UCJ - Dashboard
// =============================================

function initDashboard() {
    animateCounters();
    renderFormStrip();
}

function animateCounters() {
    document.querySelectorAll('[data-counter]').forEach(el => {
        const target = parseFloat(el.dataset.counter);
        const isFloat = el.dataset.counter.includes('.');
        const duration = 1500;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const val = eased * target;
            el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

function renderFormStrip() {
    const strip = document.getElementById('form-strip');
    if (!strip) return;
    const form = ['W', 'W', 'D', 'L', 'W', 'D', 'W', 'W', 'L', 'W'];
    strip.innerHTML = form.map(r => {
        const cls = r === 'W' ? 'green' : r === 'D' ? 'gold' : 'red';
        const colors = { green: '#ffffff', gold: '#a1a1aa', red: '#52525b' };
        return `<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.3);border:2px solid ${colors[cls]};color:${colors[cls]};font-size:12px;font-weight:700;">${r}</span>`;
    }).join('');
}
