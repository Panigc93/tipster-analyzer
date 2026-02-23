javascript: (async () => {

    // ─── SCRAPER ─────────────────────────────────────────────────────────────────
    async function scrapeTipsterData() {
        const baseUrl = window.location.origin;

        const statsHtml = await fetch(`${baseUrl}/blog/stats?_=${Date.now()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' },
            credentials: 'include'
        }).then(r => r.text());

        const doc = new DOMParser().parseFromString(statsHtml, 'text/html');

        function parseNum(v) { return parseFloat((v ?? '').replace('+', '').replace('%', '')) || 0; }

        function parseSection(sectionId) {
            const container = doc.querySelector(`#${sectionId}`);
            if (!container) return [];
            const table = container.querySelector('table');
            if (!table) return [];
            const headers = Array.from(table.querySelectorAll('th'))
                .map(h => h.textContent.trim().toLowerCase().replace(/ /g, '_'));
            return Array.from(table.querySelectorAll('tbody tr')).map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                const obj = {};
                headers.forEach((h, i) => { obj[h] = cells[i]?.textContent?.trim() ?? ''; });
                return obj;
            });
        }

        // ✅ Header: lo sacamos del archive all-time (suma total)
        const archiveAlltime = parseSection('alltime-archive-StatsTabContent').map(r => {
            const parts = (r.archive ?? '').split('\n').map(s => s.trim()).filter(Boolean);
            const archiveName = parts.find(p => /^[A-Za-z]/.test(p))
                ?? parts[parts.length - 1]?.replace(/^\d+\s*/, '')
                ?? r.archive;
            return {
                archive: archiveName,   // ← "Aug 2016", "Feb 2026", etc.
                picks: parseNum(r.picks),
                yield: parseNum(r.yield),
                odds_avg: parseNum(r.odds_avg),
            };
        });
        const totalPicks = archiveAlltime.reduce((s, m) => s + m.picks, 0);
        const totalProfit = parseFloat((doc.querySelector('#header-profit-val')?.value ?? '0').replace('+', ''));
        // Yield ponderado all-time
        const totalYield = totalPicks > 0
            ? parseFloat((archiveAlltime.reduce((s, m) => s + m.yield * m.picks, 0) / totalPicks).toFixed(1))
            : 0;

        const username = document.querySelector('.blog-name, .tipster-name, h1')?.textContent?.trim() ?? 'Tipster';

        // ✅ Todas las secciones desde ALL-TIME
        const categories = parseSection('alltime-categories-StatsTabContent').map(r => {
            const nameParts = (r.categories ?? '').split('\n').map(s => s.trim()).filter(Boolean);
            // El nombre real viene del icono sport: "Sport-League"
            const sportIcon = doc.querySelector(`#alltime-categories-StatsTabContent`)
                ?.querySelectorAll('tbody tr');
            return {
                categories: nameParts[0] ?? '',
                picks: parseNum(r.picks),
                win_rate: parseNum(r.win_rate),
                profit: parseNum(r.profit),
                yield: parseNum(r.yield),
                odds_avg: parseNum(r.odds_avg),
            };
        }).filter(r => r.picks > 0);

        // ✅ Reconstruir nombres de categorías con Sport-League desde los iconos
        const catRows = doc.querySelectorAll('#alltime-categories-StatsTabContent tbody tr');
        categories.forEach((c, i) => {
            const firstCell = catRows[i]?.querySelector('td');
            if (!firstCell) return;
            const sport = catRows[i]?.querySelector('i.sport-icon')?.getAttribute('title')?.trim() ?? '';
            // El texto de la celda: "Basketball - Livebet Livebet" → coger la parte entre sport y el duplicado
            const raw = firstCell.textContent.trim().replace(/\s+/g, ' ');
            // Formato: "Sport - League League" → extraer "League"
            const match = raw.match(/^[^-]+-\s*(.+)$/);
            if (match) {
                // El league aparece duplicado ("Livebet Livebet"), coger solo la primera mitad
                const leagueRaw = match[1].trim();
                const half = Math.ceil(leagueRaw.length / 2);
                const league = leagueRaw.slice(0, half).trim();
                c.categories = sport ? `${sport} - ${league}` : leagueRaw;
            }
        });

        const pick_types = parseSection('alltime-pick_types-StatsTabContent').map(r => ({
            pick_types: r.pick_types?.trim(),
            picks: parseNum(r.picks),
            yield: parseNum(r.yield),
        }));

        const stakes = parseSection('alltime-stakes-StatsTabContent').map(r => ({
            stakes: r.stakes?.trim(),
            picks: parseNum(r.picks),
            yield: parseNum(r.yield),
            win_rate: parseNum(r.win_rate),
        }));

        const hour_of_the_day = parseSection('alltime-hour_of_the_day-StatsTabContent').map(r => {
            const parts = (r.hour_of_the_day ?? '').split('\n').map(s => s.trim()).filter(Boolean);
            return {
                hour_of_the_day: parts[parts.length - 1] ?? r.hour_of_the_day,
                picks: parseNum(r.picks),
                yield: parseNum(r.yield),
            };
        });

        const hours_to_event = parseSection('alltime-hours_to_event-StatsTabContent').map(r => {
            const parts = (r.hours_to_event ?? '').split('\n').map(s => s.trim()).filter(Boolean);
            return {
                hours_to_event: parts[parts.length - 1] ?? r.hours_to_event,
                picks: parseNum(r.picks),
                yield: parseNum(r.yield),
            };
        });


        return {
            header: { username, picks: totalPicks, yield: totalYield, profit: totalProfit },
            paid: { categories, pick_types, stakes, hour_of_the_day, hours_to_event, archive: archiveAlltime },
        };
    }


    // ─── STYLES ──────────────────────────────────────────────────────────────────
    const CSS = `
  #ta-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:999998;display:flex;align-items:center;justify-content:center;}
  #ta-popup{background:#0f1117;color:#e8eaf0;font-family:'Segoe UI',sans-serif;font-size:13px;width:700px;max-width:95vw;max-height:90vh;border-radius:12px;border:1px solid #2a2d3a;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.7);}
  #ta-header{padding:16px 20px;background:#161922;border-bottom:1px solid #2a2d3a;display:flex;align-items:center;justify-content:space-between;}
  #ta-header h1{margin:0;font-size:16px;font-weight:700;color:#fff;}
  #ta-header .ta-sub{font-size:11px;color:#7b8199;margin-top:2px;}
  #ta-close{background:none;border:none;color:#7b8199;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;}
  #ta-close:hover{background:#2a2d3a;color:#fff;}
  #ta-body{overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px;}
  .ta-scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
  .ta-score-card{background:#161922;border:1px solid #2a2d3a;border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:3px;}
  .ta-sc-header{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
  .ta-sc-label{font-size:10px;color:#7b8199;text-transform:uppercase;letter-spacing:.5px;}
  .ta-sc-value{font-size:18px;font-weight:800;}
  .ta-sc-desc{font-size:10px;color:#9ca3b8;line-height:1.3;}

  .score-green{color:#22c55e;}.score-yellow{color:#eab308;}.score-orange{color:#f97316;}.score-red{color:#ef4444;}
  .ta-bar-wrap{background:#1e2130;border-radius:4px;height:6px;width:100%;overflow:hidden;}
  .ta-bar{height:100%;border-radius:4px;}
  .ta-section{background:#161922;border:1px solid #2a2d3a;border-radius:10px;padding:14px 16px;}
  .ta-section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7b8199;display:flex;align-items:center;gap:6px;}
  .ta-row{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid #1e2130;font-size:12px;}
  .ta-row:last-child{border-bottom:none;}
  .ta-rl{color:#9ca3b8;}.ta-rv{font-weight:600;color:#e8eaf0;}
  .ta-rv.green{color:#22c55e;}.ta-rv.yellow{color:#eab308;}.ta-rv.red{color:#ef4444;}
  .ta-flags{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
  .ta-flag{font-size:11px;padding:5px 10px;border-radius:6px;line-height:1.4;background:#1e2130;border-left:3px solid;}
  .ta-flag.warn{border-color:#f97316;color:#fbd38d;}.ta-flag.info{border-color:#3b82f6;color:#93c5fd;}.ta-flag.ok{border-color:#22c55e;color:#86efac;}
  .ta-cats{display:flex;flex-direction:column;gap:6px;}
  .ta-cat{display:flex;align-items:center;justify-content:space-between;background:#1e2130;border-radius:8px;padding:8px 12px;}
  .ta-cat-name{font-weight:600;font-size:12px;}
  .ta-cat-stats{display:flex;gap:10px;font-size:11px;color:#9ca3b8;}
  .ta-cat-stats span{white-space:nowrap;}
  .ta-cat.star{border-left:3px solid #22c55e;}.ta-cat.watch{border-left:3px solid #eab308;}.ta-cat.lock{border-left:3px solid #ef4444;}
  .ta-follow{border-radius:10px;padding:16px;text-align:center;}
  .ta-follow.yes{background:#0d1f12;border:2px solid #22c55e;}.ta-follow.no{background:#1f0d0d;border:2px solid #ef4444;}.ta-follow.maybe{background:#1a1a0d;border:2px solid #eab308;}
  .ta-f-emoji{font-size:14px;margin-bottom:4px;}
  .ta-f-title{font-size:15px;font-weight:800;margin-bottom:6px;}
  .ta-f-reason{font-size:11px;color:#9ca3b8;line-height:1.6;display: flex}
  .ta-follow.yes .ta-f-title{color:#22c55e;}.ta-follow.no .ta-f-title{color:#ef4444;}.ta-follow.maybe .ta-f-title{color:#eab308;}
  #ta-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:40px;color:#7b8199;font-size:13px;}
  .ta-spinner{width:32px;height:32px;border:3px solid #2a2d3a;border-top-color:#3b82f6;border-radius:50%;animation:ta-spin .8s linear infinite;}
  @keyframes ta-spin{to{transform:rotate(360deg);}}
  /* ── PORTFOLIO BUILDER ── */
  .ta-pf-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;}
  .ta-pf-stat{background:#1a1f2e;border:1px solid #2a2d3a;border-radius:8px;padding:8px 10px;text-align:center;}
  .ta-pf-stat-label{font-size:9px;color:#7b8199;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:2px;}
  .ta-pf-stat-value{font-size:16px;font-weight:800;}
  .ta-pf-table{width:100%;border-collapse:collapse;font-size:11px;}
  .ta-pf-table thead th{color:#7b8199;font-weight:600;text-align:left;padding:4px 6px;border-bottom:1px solid #2a2d3a;font-size:10px;text-transform:uppercase;}
  .ta-pf-table thead th:not(:first-child){text-align:right;}
  .ta-pf-table tbody tr{border-bottom:1px solid #1e2130;cursor:pointer;transition:background .1s;}
  .ta-pf-table tbody tr:hover{background:#1e2130;}
  .ta-pf-table tbody tr:last-child{border-bottom:none;}
  .ta-pf-table td{padding:4px 6px;vertical-align:middle;}
  .ta-pf-table td:not(:first-child){text-align:right;}
  .ta-pf-check-cell{width:20px;}
  .ta-pf-check-cell input{accent-color:#3b82f6;cursor:pointer;}
    /* ── COLLAPSIBLE SECTIONS ── */
  details.ta-section summary::-webkit-details-marker{display:none;}
  details.ta-section[open] .ta-collapse-arrow{transform:rotate(180deg);}
  details.ta-section .ta-collapse-arrow{display:inline-block;transition:transform .2s;}

`;

    // ─── HELPERS ─────────────────────────────────────────────────────────────────
    function isLiquid(leagueName) {
        if (!leagueName) return false;
        const LIQUID = [
            'NBA', 'NCAA', 'Euroleague', 'ACB', 'Lega Basket', 'Pro A', 'BBL',
            'Eng. Premier', 'Premier League',
            'Spa. Primera', 'La Liga',
            'Ger. Bundesliga', 'Bundesliga',
            'Ita. Serie A', 'Serie A',
            'Fra. Ligue 1', 'Ligue 1',
            'Champions L', 'Champions League',
            'Europa League',
            'Conference League',
            'Eredivisie',
            'Por. Superliga', 'Primeira Liga',
            'Eng. Championship', 'Championship',
            'NHL', 'NFL', 'MLB',
            'ATP', 'WTA',
            'Livebet'
        ];
        return LIQUID.some(l => leagueName.toLowerCase().includes(l.toLowerCase()));
    }

    function scoreColor(s) { return s >= 80 ? 'score-green' : s >= 60 ? 'score-yellow' : s >= 40 ? 'score-orange' : 'score-red'; }
    function barColor(s) { return s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444'; }
    function renderRow(label, value, cls = '') {
        return `<div class="ta-row"><span class="ta-rl">${label}</span><span class="ta-rv ${cls}">${value}</span></div>`;
    }
    function renderFlag(text, type = 'warn') {
        return `<div class="ta-flag ${type}">${text}</div>`;
    }
    function renderScoreCard(label, score, desc) {
        return `<div class="ta-score-card">
        <div class="ta-sc-header">
            <span class="ta-sc-label">${label}</span>
            <span class="ta-sc-value ${scoreColor(score)}">${score}<span style="font-size:11px;color:#7b8199;font-weight:400">/100</span></span>
        </div>
        <div class="ta-sc-desc">${desc}</div>
    </div>`;
    }


    // ─── ANALYZERS ───────────────────────────────────────────────────────────────
    function buildProfitability(td) {
        const MIN_PICKS = 15;
        const cats = td.paid.categories.map(c => {
            const idx = (c.categories || '').indexOf(' - ');
            const league = idx === -1 ? c.categories : c.categories.slice(idx + 3).trim();
            const sport = idx === -1 ? null : c.categories.slice(0, idx).trim();
            return {
                name: c.categories, sport, league,
                picks: c.picks, yield: c.yield, wr: c.win_rate,
                profit: c.profit, oddsAvg: c.odds_avg,
                reliable: c.picks >= MIN_PICKS, liquid: isLiquid(league)
            };
        });
        return {
            global: { picks: td.header.picks, yield: td.header.yield, profit: td.header.profit },
            categories: cats, reliable: cats.filter(c => c.reliable)
        };
    }

    function buildConsistency(td) {
        const monthMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const sorted = [...td.paid.archive].sort((a, b) => {
            const [am, ay] = a.archive.split(' '), [bm, by] = b.archive.split(' ');
            return (parseInt(ay) * 12 + (monthMap[am?.toLowerCase()] ?? 0)) - (parseInt(by) * 12 + (monthMap[bm?.toLowerCase()] ?? 0));
        });
        const totalMonths = sorted.length;
        const positiveMonths = sorted.filter(m => m.yield > 0).length;
        const winRate = Math.round(positiveMonths / totalMonths * 100);
        const neverLost = positiveMonths === totalMonths;

        let trend = { status: 'insuficiente', diff: 0, avgRecent: 0, avgHistoric: 0 };
        if (sorted.length >= 4) {
            const rec = sorted.slice(-3), his = sorted.slice(0, -3);
            const wAvg = arr => { const tp = arr.reduce((s, m) => s + m.picks, 0); return tp > 0 ? arr.reduce((s, m) => s + m.yield * m.picks, 0) / tp : 0; };
            const ar = wAvg(rec), ah = wAvg(his), diff = ar - ah;
            trend = { status: diff > 5 ? 'mejorando' : diff < -5 ? 'bajista' : 'estable', diff: parseFloat(diff.toFixed(1)), avgRecent: parseFloat(ar.toFixed(1)), avgHistoric: parseFloat(ah.toFixed(1)) };
        }

        let oddsShift = { shifted: false };
        if (sorted.length >= 4) {
            const rec = sorted.slice(-3), his = sorted.slice(0, -3);
            const wO = arr => { const tp = arr.reduce((s, m) => s + m.picks, 0); return tp > 0 ? arr.reduce((s, m) => s + (m.odds_avg ?? 0) * m.picks, 0) / tp : 0; };
            const rO = wO(rec), hO = wO(his);
            if (hO > 0) { const ratio = rO / hO; oddsShift = { shifted: Math.abs(ratio - 1) >= 0.15, ratio: parseFloat(ratio.toFixed(2)), recentOdds: parseFloat(rO.toFixed(3)), historicOdds: parseFloat(hO.toFixed(3)) }; }
        }

        const r12 = sorted.slice(-12), r12t = r12.reduce((s, m) => s + m.picks, 0);
        const r6 = sorted.slice(-6), r6t = r6.reduce((s, m) => s + m.picks, 0);
        const yield6m = r6t > 0 ? parseFloat((r6.reduce((s, m) => s + m.yield * m.picks, 0) / r6t).toFixed(1)) : null;
        const recentYield = r12t > 0 ? parseFloat((r12.reduce((s, m) => s + m.yield * m.picks, 0) / r12t).toFixed(1)) : null;

        let maxDrawdown = 0, currentDD = 0, ddStreak = 0, maxDDStreak = 0;
        sorted.forEach(m => {
            if (m.yield < 0) {
                currentDD += m.yield;
                ddStreak++;
                if (currentDD < maxDrawdown) { maxDrawdown = currentDD; maxDDStreak = ddStreak; }
            } else {
                currentDD = 0;
                ddStreak = 0;
            }
        });

        // Overbetting: picks/mes reciente (3m) vs histórico
        const recentMonths = sorted.slice(-3);
        const historicMonths = sorted.slice(0, -3);
        const avgRecent = recentMonths.reduce((s, m) => s + m.picks, 0) / Math.max(recentMonths.length, 1);
        const avgHistoric = historicMonths.reduce((s, m) => s + m.picks, 0) / Math.max(historicMonths.length, 1);
        const overbetting = avgHistoric > 10 && avgRecent > avgHistoric * 2
            ? { detected: true, ratio: parseFloat((avgRecent / avgHistoric).toFixed(1)), recentAvg: Math.round(avgRecent), historicAvg: Math.round(avgHistoric) }
            : { detected: false, ratio: parseFloat((avgRecent / avgHistoric).toFixed(1)), recentAvg: Math.round(avgRecent), historicAvg: Math.round(avgHistoric) };

        return { sorted, totalMonths, positiveMonths, winRate, neverLost, trend, oddsShift, recentYield, yield6m, maxDrawdown: parseFloat(maxDrawdown.toFixed(1)), maxDDStreak, overbetting };
    }

    function buildSpecialization(profitability) {
        const MIN_PICKS = 15;   // mínimo para aparecer
        const MIN_PICKS_STAR = 50;   // mínimo para ser "especialista" fiable

        const classified = profitability.categories.map(c => {
            const liquid = isLiquid(c.league);
            let tag;
            if (!c.reliable) tag = 'low_sample';
            else if (c.yield >= 20 && liquid && c.picks >= MIN_PICKS_STAR) tag = 'star';
            else if (c.yield >= 20 && liquid && c.picks < MIN_PICKS_STAR) tag = 'watch_yield';   // líquida pero poca muestra
            else if (c.yield >= 20 && !liquid && c.picks >= MIN_PICKS_STAR) tag = 'star_illiquid';
            else if (c.yield >= 20 && !liquid && c.picks < MIN_PICKS_STAR) tag = 'watch_illiquid'; // ilíquida y poca muestra
            else if (c.yield >= 12 && liquid) tag = 'watch_yield';
            else if (c.yield >= 12 && !liquid) tag = 'watch_illiquid';
            else if (c.yield >= 0) tag = 'positive';
            else tag = 'negative';
            return { ...c, liquid, tag };
        });
        return {
            classified,
            stars: classified.filter(c => c.tag === 'star'),
            starsIlliquid: classified.filter(c => c.tag === 'star_illiquid'),
            watchYield: classified.filter(c => c.tag === 'watch_yield'),
            watchIlliquid: classified.filter(c => c.tag === 'watch_illiquid'),
            negatives: classified.filter(c => c.tag === 'negative'),
            lowSample: classified.filter(c => c.tag === 'low_sample'),
        };
    }


    function buildFollowability(td) {
        const paid = td.paid;
        const liveRow = paid.pick_types?.find(p => p.pick_types?.toLowerCase() === 'live');
        const livePicks = liveRow?.picks ?? 0;
        const total = paid.pick_types?.reduce((s, p) => s + p.picks, 0) || 1;
        const liveRatio = parseFloat((livePicks / total * 100).toFixed(1));

        let anticipationPct = null;
        if (paid.hours_to_event?.length) {
            const ht = paid.hours_to_event.reduce((s, h) => s + h.picks, 0);
            const early = paid.hours_to_event.filter(h => ['LIVE', '0-1'].includes(h.hours_to_event?.toUpperCase())).reduce((s, h) => s + h.picks, 0);
            anticipationPct = parseFloat((early / ht * 100).toFixed(1));
        }

        const peakHour = paid.hour_of_the_day?.length
            ? paid.hour_of_the_day.reduce((max, h) => h.picks > max.picks ? h : max, paid.hour_of_the_day[0])
            : null;
        const stakes = paid.stakes ?? [];

        let baseScore = 100;
        if (liveRatio >= 80) baseScore -= 40;
        else if (liveRatio >= 60) baseScore -= 25;
        else if (liveRatio >= 40) baseScore -= 10;
        if ((anticipationPct ?? 0) >= 90) baseScore -= 30;
        else if ((anticipationPct ?? 0) >= 70) baseScore -= 15;

        return { liveRatio, anticipationPct, peakHour, stakes, baseScore: Math.max(0, baseScore) };
    }

    async function loadChartJs() {
        if (window.Chart) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function buildChartHtml(sorted) {
        return `
    <div class="ta-section">
      <div class="ta-section-title">📈 Yield mensual por año</div>
      <div style="font-size:10px;color:#7b8199;margin-bottom:8px">
        Click en el año de la leyenda para mostrar/ocultar · barras = picks del año actual
      </div>
      <div style="position:relative;height:280px">
        <canvas id="ta-yield-chart"></canvas>
      </div>
    </div>`;
    }

    function initChart(sorted) {
        const canvas = document.getElementById('ta-yield-chart');
        if (!canvas) return;

        const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYear = String(new Date().getFullYear());
        const years = [...new Set(sorted.map(m => m.archive.split(' ')[1]))].sort();
        const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#eab308', '#06b6d4', '#ef4444'];
        const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

        // ─── Datasets de líneas (yield por año) ──────────────────────────────────
        const lineDatasets = years.map((year, i) => {
            const data = Array(12).fill(null);
            const picks = Array(12).fill(0);
            sorted.filter(m => m.archive.split(' ')[1] === year).forEach(m => {
                const idx = monthMap[m.archive.split(' ')[0].toLowerCase()];
                if (idx !== undefined) { data[idx] = m.yield; picks[idx] = m.picks; }
            });

            // Media mensual de picks de ESTE año concreto
            const yearPicks = picks.filter(p => p > 0);
            const yearMonthlyAvg = yearPicks.length > 0
                ? yearPicks.reduce((s, p) => s + p, 0) / yearPicks.length
                : 0;
            const overbettingThreshold = yearMonthlyAvg * 1.2;

            const isCurrentYear = year === currentYear;
            const lineColor = COLORS[i % COLORS.length];

            // Color de cada punto: rojo si overbetting, color de línea si normal
            const pointColors = picks.map((p, j) =>
                data[j] == null ? 'transparent' :
                    p > overbettingThreshold ? '#ef4444' : lineColor
            );
            const radii = picks.map((p, j) =>
                data[j] == null ? 0 : isCurrentYear ? Math.min(10, Math.max(3, Math.sqrt(p) * 0.6)) : 3
            );

            return {
                type: 'line',
                yAxisID: 'yYield',
                label: year, data, _picks: picks,
                borderColor: lineColor,
                backgroundColor: 'transparent',
                borderWidth: isCurrentYear ? 2.5 : 1,
                tension: 0.3, spanGaps: false,
                hidden: parseInt(year) < new Date().getFullYear() - 2,
                pointRadius: radii,
                pointHoverRadius: radii.map(r => r > 0 ? r + 2 : 0),
                pointBackgroundColor: pointColors,   // ← rojo si overbetting
                pointBorderColor: pointColors,
                pointHoverBackgroundColor: pointColors,
                pointHoverBorderColor: pointColors,
                _yearMonthlyAvg: yearMonthlyAvg,     // ← para el tooltip
                order: isCurrentYear ? 0 : 1,
            };
        });


        // ─── Dataset de barras (picks año actual) ─────────────────────────────────
        const currentData = Array(12).fill(null);
        const currentPicks = Array(12).fill(0);
        sorted.filter(m => m.archive.split(' ')[1] === currentYear).forEach(m => {
            const idx = monthMap[m.archive.split(' ')[0].toLowerCase()];
            if (idx !== undefined) { currentData[idx] = m.yield; currentPicks[idx] = m.picks; }
        });

        // Media de picks por mes entre TODOS los años
        const monthlyAvgPicks = Array(12).fill(0).map((_, monthIdx) => {
            const entries = sorted.filter(m => {
                const idx = monthMap[m.archive.split(' ')[0].toLowerCase()];
                return idx === monthIdx && m.picks > 0;
            });
            return entries.length > 0
                ? Math.round(entries.reduce((s, m) => s + m.picks, 0) / entries.length)
                : 0;
        });

        const barsDataset = {
            type: 'bar',
            yAxisID: 'yPicks',
            label: 'Picks (media histórica por mes)',
            data: monthlyAvgPicks,
            backgroundColor: 'rgba(99,102,241,0.25)',
            borderColor: 'rgba(99,102,241,0.5)',
            borderWidth: 1,
            borderRadius: 3,
            order: 2,
        };


        // ─── Plugin fondo verde/rojo ──────────────────────────────────────────────
        const greenRedBgPlugin = {
            id: 'greenRedBg',
            beforeDraw(chart) {
                const { ctx, chartArea: { left, right, top, bottom }, scales } = chart;
                const y = scales['yYield'];
                if (!y) return;
                const zero = y.getPixelForValue(0);
                const clampedZero = Math.max(top, Math.min(bottom, zero));
                ctx.save();
                ctx.fillStyle = 'rgba(34,197,94,0.05)';
                ctx.fillRect(left, top, right - left, clampedZero - top);
                ctx.fillStyle = 'rgba(239,68,68,0.05)';
                ctx.fillRect(left, clampedZero, right - left, bottom - clampedZero);
                ctx.restore();
            }
        };

        new window.Chart(canvas, {
            type: 'bar',   // tipo base del chart mixto
            data: { labels: MONTH_SHORT, datasets: [...lineDatasets, barsDataset] },
            plugins: [greenRedBgPlugin],
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e8eaf0',        // ← blanco/gris claro, igual que el resto del popup
                            font: { size: 10 },
                            padding: 8,
                            boxWidth: 12,
                            boxHeight: 12,
                            generateLabels(chart) {
                                return chart.data.datasets
                                    .filter(ds => ds.type === 'line')
                                    .map((ds) => {
                                        const realIdx = chart.data.datasets.indexOf(ds);
                                        const meta = chart.getDatasetMeta(realIdx);
                                        // ← meta.hidden puede ser null en el primer render, hay que combinar con ds.hidden
                                        const isHidden = meta.hidden ?? ds.hidden ?? false;
                                        return {
                                            text: ds.label,
                                            fillStyle: isHidden ? 'rgba(0,0,0,0)' : ds.borderColor,
                                            strokeStyle: ds.borderColor,
                                            lineWidth: 2,
                                            hidden: isHidden,
                                            datasetIndex: realIdx,
                                            fontColor: isHidden ? '#555566' : '#e8eaf0',
                                        };
                                    });
                            },

                        },
                        onClick(e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const meta = legend.chart.getDatasetMeta(index);
                            const ds = legend.chart.data.datasets[index];
                            // Leer estado actual correcto
                            const currentlyHidden = meta.hidden ?? ds.hidden ?? false;
                            meta.hidden = !currentlyHidden;
                            ds.hidden = !currentlyHidden;
                            legend.chart.update();
                        }

                    },

                    tooltip: {
                        backgroundColor: '#1e2130', titleColor: '#e8eaf0', bodyColor: '#9ca3b8',
                        callbacks: {
                            label: ctx => {
                                if (ctx.dataset.type === 'bar')
                                    return ` Media histórica: ${ctx.parsed.y} picks`;
                                const picks = ctx.dataset._picks?.[ctx.dataIndex] ?? 0;
                                const avg = ctx.dataset._yearMonthlyAvg ?? 0;
                                const over = avg > 0 && picks > avg * 1.2;
                                const yVal = ctx.parsed.y != null ? ctx.parsed.y + '%' : 'N/A';
                                return ` ${ctx.dataset.label}: ${yVal} (${picks} picks${over ? ' ⚠️ overbetting' : ''})`;
                            }

                        }
                    },
                },
                scales: {
                    x: {
                        ticks: { color: '#7b8199', font: { size: 10 } },
                        grid: { color: '#1e2130' }
                    },
                    yYield: {
                        type: 'linear', position: 'left',
                        ticks: { color: '#7b8199', font: { size: 10 }, callback: v => v + '%' },
                        grid: {
                            color: ctx => ctx.tick.value === 0 ? 'rgba(255,255,255,0.15)' : '#1e2130',
                            lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1,
                        },
                        afterDataLimits: scale => {
                            scale.min = Math.min(scale.min, -5);
                            scale.max = Math.max(scale.max, 5);
                        }
                    },
                    yPicks: {
                        type: 'linear', position: 'right',
                        ticks: { color: '#4a5068', font: { size: 9 } },
                        grid: { drawOnChartArea: false }, // no superponer grid con el de yield
                        afterDataLimits: scale => {
                            // Comprimir barras en la parte inferior — estilo TradingView
                            scale.max = scale.max * 4;
                            scale.min = 0;
                        }
                    }
                }
            }
        });
    }



    async function fetchCategoryYield(categories, months = 12) {
        const baseUrl = window.location.origin + '/blog/picks';
        const res = await fetch(`${baseUrl}?_=${Date.now()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' }, credentials: 'include'
        });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const map = {};
        doc.querySelectorAll('input[name="filters[categories][]"]').forEach(i => {
            const row = i.closest('tr');
            const key = row?.querySelector('i.sport-icon')?.getAttribute('title')?.trim();
            if (key) map[key] = i.value;
        });
        const archiveValues = Array.from(doc.querySelectorAll('input[name="filters[archive][]"]')).slice(0, months).map(i => i.value);

        const results = [];
        for (const cat of categories) {
            const catValue = map[cat.name];
            console.log(`Buscando "${cat.name}" → ${catValue ?? 'NO ENCONTRADO'}`);
            if (!catValue) { results.push({ ...cat, recentYield: null, recentPicks: null }); continue; }
            const params = new URLSearchParams({ '_': Date.now() });
            params.append('filters[categories][]', catValue);
            archiveValues.forEach(v => params.append('filters[archive][]', v));
            const r = await fetch(`${baseUrl}?${params}`, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' }, credentials: 'include' });
            const h = await r.text();
            const d = new DOMParser().parseFromString(h, 'text/html');
            results.push({
                ...cat,
                recentYield: d.querySelector('#header-yield-val')?.value != null ? parseFloat(d.querySelector('#header-yield-val').value) : null,
                recentPicks: d.querySelector('#header-picks-val')?.value != null ? parseFloat(d.querySelector('#header-picks-val').value) : null,
                recentProfit: d.querySelector('#header-profit-val')?.value != null ? parseFloat(d.querySelector('#header-profit-val').value) : null,
            });
        }
        return results;
    }

    function computeScores(profitability, consistency, specialization, followability, categoryYieldData) {
        const picks = profitability.global.picks, months = consistency.totalMonths;
        const ps = picks >= 400 ? 100 : picks >= 200 ? 60 + (picks - 200) / 200 * 40 : picks >= 100 ? 30 + (picks - 100) / 100 * 30 : picks / 100 * 30;
        const ms = months >= 24 ? 100 : months >= 12 ? 70 + (months - 12) / 12 * 30 : months >= 6 ? 40 + (months - 6) / 6 * 30 : months / 6 * 40;
        const muestraScore = Math.round((ps + ms) / 2);
        const muestraDesc = picks >= 400 && months >= 12 ? 'Muestra sólida para sacar conclusiones fiables' : picks >= 200 ? 'Muestra suficiente, aunque mejoraría con más meses' : 'Muestra insuficiente — resultados poco concluyentes';

        const globalY = profitability.global.yield, recentY = consistency.recentYield;
        const followableLiquid = specialization.classified.filter(c => c.reliable && c.yield >= 12 && isLiquid(c.league));
        const followableIlliquid = specialization.classified.filter(c => c.reliable && c.yield >= 20 && !isLiquid(c.league));
        const followable = followableLiquid; // para seguibilidad seguimos usando solo líquidas
        const followableAll = [...followableLiquid, ...followableIlliquid]; // para rendimiento
        let categoryBonus = 0;
        if (categoryYieldData?.length) {
            const wd = categoryYieldData.filter(c => c.recentYield !== null);
            if (wd.length > 0) {
                const avg = wd.reduce((s, c) => s + c.recentYield, 0) / wd.length;
                if (avg >= 20) categoryBonus = 15; else if (avg >= 12) categoryBonus = 5; else if (avg >= 0) categoryBonus = -10; else categoryBonus = -25;
            }
        }
        const yScore = y => y >= 30 ? 100 : y >= 20 ? 85 : y >= 12 ? 65 : y >= 5 ? 40 : y >= 0 ? 20 : 0;
        const catsScore = Math.min(followableLiquid.length * 20 + followableIlliquid.length * 10, 100);
        const yieldScore = Math.min(100, Math.max(0,
            Math.round(yScore(globalY) * 0.4 + yScore(recentY ?? 0) * 0.4 + catsScore * 0.2) + categoryBonus
        ));
        const yieldDesc = yieldScore >= 85 ? 'Rendimiento excelente y consistente en el tiempo' : yieldScore >= 65 ? 'Buen rendimiento, por encima del mínimo recomendado' : yieldScore >= 40 ? 'Rendimiento moderado — vigilar evolución' : 'Rendimiento insuficiente o en declive';

        const reliable = specialization.classified.filter(c => c.reliable);
        const liquidR = reliable.filter(c => isLiquid(c.league));
        const illiquidR = reliable.filter(c => !isLiquid(c.league));
        const totalRP = reliable.reduce((s, c) => s + c.picks, 0);
        const liquidPicks = liquidR.reduce((s, c) => s + c.picks, 0);
        const liquidPicksRatio = totalRP > 0 ? liquidPicks / totalRP : 0;
        let segScore = followability.baseScore;
        if (liquidPicksRatio >= 0.75) segScore += 10;
        else if (liquidPicksRatio >= 0.50) segScore -= 10;
        else if (liquidPicksRatio >= 0.25) segScore -= 25;
        else segScore -= 40;
        segScore = Math.min(100, Math.max(0, segScore));
        const segDesc = segScore >= 70 ? 'Fácil de seguir — picks con antelación en mercados líquidos' : segScore >= 40 ? 'Seguimiento posible pero requiere disponibilidad inmediata' : 'Muy difícil de seguir — picks casi exclusivamente live o en mercados ilíquidos';

        return {
            muestra: { score: muestraScore, desc: muestraDesc, ps: Math.round(ps), ms: Math.round(ms) },
            yield: { score: yieldScore, desc: yieldDesc, globalY, recentY, categoryBonus, followable },
            seguibilidad: {
                score: segScore, desc: segDesc, liquidPicksRatio, liveRatio: followability.liveRatio,
                anticipationPct: followability.anticipationPct, illiquidLeagues: illiquidR
            },
        };
    }

    function getFollowVerdict(scores, specialization, consistency, followability, categoryYieldData) {
        const { muestra: mR, yield: yR, seguibilidad: sR } = scores;
        const hasStars = specialization.stars.length > 0;
        const hasExpert = specialization.starsIlliquid.length > 0;
        const isBajista = consistency.trend.status === 'bajista';
        const isShift = consistency.oddsShift?.shifted;
        const lowSeg = sR.score <= 40;
        const highLive = followability.liveRatio >= 60;
        const lowSample = mR.score < 50;
        const badYield = yR.score < 40;

        const bigDrawdown = consistency.maxDrawdown < -40;
        const isOverbetting = consistency.overbetting.detected;


        // Construir razones concretas
        const reasons = [];
        if (lowSample) reasons.push(`muestra insuficiente (${mR.ps < 50 ? `solo ${scores.muestra.ps} pts en picks` : `solo ${consistency.totalMonths} meses de historial`})`);
        if (badYield) reasons.push(`yield global insuficiente (${yR.globalY}%)`);
        if (isBajista) reasons.push(`tendencia bajista reciente (${consistency.trend.avgRecent}% vs histórico ${consistency.trend.avgHistoric}%)`);
        if (highLive) reasons.push(`${followability.liveRatio}% de picks son live — muy difícil de replicar`);
        if (lowSeg && !highLive) reasons.push(`picks mayoritariamente en ligas ilíquidas (${Math.round(sR.liquidPicksRatio * 100)}% líquido)`);
        if (bigDrawdown) reasons.push(`drawdown máximo consecutivo de ${consistency.maxDrawdown.toFixed(0)}% (${consistency.maxDDStreak} meses) — requiere bankroll alto`);
        if (isOverbetting) reasons.push(`posible overbetting — picks recientes ${consistency.overbetting.recentAvg}/mes vs ${consistency.overbetting.historicAvg}/mes histórico (×${consistency.overbetting.ratio})`);
        if (isShift) reasons.push(`cambio de odds medias reciente (${consistency.oddsShift.historicOdds} → ${consistency.oddsShift.recentOdds}) — posible cambio de estrategia`);

        const positives = [];
        if (!lowSample && mR.score >= 70) positives.push(`muestra sólida (${mR.ps} pts picks, ${consistency.totalMonths} meses)`);
        if (yR.globalY >= 20) positives.push(`yield global excelente (${yR.globalY}%)`);
        if (yR.recentY >= 12) positives.push(`yield último año positivo (${yR.recentY}%)`);
        if (!isBajista && consistency.trend.status === 'mejorando') positives.push(`tendencia mejorando (${consistency.trend.avgRecent}% reciente)`);
        if (hasStars) positives.push(`especialidad líquida: ${specialization.stars.map(c => `${c.name} (${c.yield}%)`).join(', ')}`);
        if (hasExpert && !hasStars) positives.push(`especialidad ilíquida: ${specialization.starsIlliquid.map(c => `${c.name} (${c.yield}%)`).join(', ')}`);
        if (sR.score >= 70) positives.push(`fácil de seguir (${Math.round(sR.liquidPicksRatio * 100)}% picks en mercados líquidos)`);

        const reasonHtml = reasons.length
            ? `<div style="margin-top:8px;font-size:11px;color:#9ca3b8;text-align:left; width:50%">
             <b style="color:#f97316">⚠️ Puntos débiles:</b><br>
             ${reasons.map(r => `· ${r}`).join('<br>')}
           </div>` : '';
        const positiveHtml = positives.length
            ? `<div style="margin-top:6px;font-size:11px;color:#9ca3b8;text-align:left; width:50%">
             <b style="color:#22c55e">✅ Puntos fuertes:</b><br>
             ${positives.map(r => `· ${r}`).join('<br>')}
           </div>` : '';

        if (yR.score >= 70 && mR.score >= 60 && (hasStars || hasExpert) && !lowSeg) {
            return {
                decision: 'yes', emoji: '✅', title: 'Recomendado para seguir',
                html: reasonHtml + positiveHtml
            };
        } else if (yR.score >= 50 && mR.score >= 50) {
            return {
                decision: 'maybe', emoji: '👀', title: 'En vigilancia — prometedor pero con reservas',
                html: reasonHtml + positiveHtml
            };
        } else {
            return {
                decision: 'no', emoji: '❌', title: 'No recomendado ahora',
                html: reasonHtml + positiveHtml
            };
        }
    }


    // ─── RENDER ───────────────────────────────────────────────────────────────────
    function renderCat(c, type, categoryYieldData) {
        const recent = categoryYieldData?.find(r => r.name === c.name);

        // Badge de confianza según picks
        const confidence = c.picks >= 200 ? { label: 'Alta', color: '#22c55e' }
            : c.picks >= 50 ? { label: 'Media', color: '#eab308' }
                : { label: 'Baja ⚠️', color: '#ef4444' };

        function yieldBadge(val, label) {
            if (val === null || val === undefined) return '';
            const color = val >= 20 ? '#22c55e' : val >= 12 ? '#eab308' : val >= 0 ? '#f97316' : '#ef4444';
            return `<span style="display:flex;flex-direction:column;align-items:center;gap:1px">
            <span style="font-size:9px;color:#7b8199">${label}</span>
            <b style="color:${color}">${val}%</b>
        </span>`;
        }

        const icon = type === 'star' ? '⭐' : type === 'watch' ? '🟡' : '🔒';

        return `<div class="ta-cat ${type}">
        <span class="ta-cat-name">${icon} ${c.name}
            <span style="font-size:10px;font-weight:400;color:${confidence.color};margin-left:6px">
                (confianza: ${confidence.label})
            </span>
        </span>
        <div class="ta-cat-stats" style="align-items:center">
            <span>Global: <b>${c.yield}%</b></span>
            <span>WR: ${c.wr}%</span>
            <span>${c.picks} picks</span>
            ${recent?.recentYield6 != null ? yieldBadge(recent.recentYield6, '6m') : ''}
            ${recent?.recentYield != null ? yieldBadge(recent.recentYield, '12m') : ''}
        </div>
    </div>`;
    }

    function buildPortfolioHtml(profitability, innerOnly = false) {
        const cats = [...profitability.categories]
            .filter(c => c.picks >= 15)
            .sort((a, b) => b.yield - a.yield || b.picks - a.picks);

        const rows = cats.map(c => {
            const isSelected = c.yield >= 12;
            const yieldColor = c.yield >= 20 ? '#22c55e' : c.yield >= 12 ? '#eab308' : c.yield >= 0 ? '#f97316' : '#ef4444';
            const liq = isLiquid(c.league) ? '💧' : '🔒';
            return `<tr>
          <td class="ta-pf-check-cell"><input type="checkbox" class="ta-pf-check" data-picks="${c.picks}" data-yield="${c.yield}" data-wr="${c.wr}" ${isSelected ? 'checked' : ''}></td>
          <td>${liq} ${c.name}</td>
          <td style="color:${yieldColor};font-weight:700">${c.yield}%</td>
          <td style="color:#9ca3b8">${c.wr}%</td>
          <td style="color:#9ca3b8">${c.picks}</td>
        </tr>`;
        }).join('');

        const inner = `
      <div style="font-size:10px;color:#7b8199;margin-bottom:8px">
        Selecciona las categorías — el yield combinado se recalcula en tiempo real
      </div>
      <div class="ta-pf-summary">
        <div class="ta-pf-stat"><span class="ta-pf-stat-label">Yield combinado</span><span class="ta-pf-stat-value" id="ta-pf-yield">—</span></div>
        <div class="ta-pf-stat"><span class="ta-pf-stat-label">Picks/mes est.</span><span class="ta-pf-stat-value" id="ta-pf-picks" style="color:#e8eaf0">—</span></div>
        <div class="ta-pf-stat"><span class="ta-pf-stat-label">Win rate</span><span class="ta-pf-stat-value" id="ta-pf-wr" style="color:#e8eaf0">—</span></div>
      </div>
      <table class="ta-pf-table">
        <thead><tr><th></th><th>Categoría</th><th>Yield</th><th>WR</th><th>Picks</th></tr></thead>
        <tbody id="ta-pf-list">${rows}</tbody>
      </table>`;

        if (innerOnly) return inner;
        return `<div class="ta-section"><div class="ta-section-title">🎯 Portfolio builder</div>${inner}</div>`;
    }



    function initPortfolio(profitability) {
        const list = document.getElementById('ta-pf-list');
        if (!list) return;

        function recalc() {
            const checks = list.querySelectorAll('.ta-pf-check:checked');
            const yieldEl = document.getElementById('ta-pf-yield');
            const picksEl = document.getElementById('ta-pf-picks');
            const wrEl = document.getElementById('ta-pf-wr');
            if (!yieldEl) return;

            if (checks.length === 0) {
                yieldEl.textContent = '—'; yieldEl.style.color = '#555566';
                picksEl.textContent = '— picks/mes'; wrEl.textContent = 'WR —';
                return;
            }

            let totalPicks = 0, weightedYield = 0, weightedWr = 0;
            checks.forEach(ch => {
                const p = parseFloat(ch.dataset.picks);
                weightedYield += parseFloat(ch.dataset.yield) * p;
                weightedWr += parseFloat(ch.dataset.wr) * p;
                totalPicks += p;
            });

            const combinedYield = parseFloat((weightedYield / totalPicks).toFixed(1));
            const combinedWr = parseFloat((weightedWr / totalPicks).toFixed(1));
            const monthlyEst = Math.round(totalPicks / Math.max(profitability.global.picks, 1)
                * (profitability.global.picks / 12));

            const yColor = combinedYield >= 20 ? '#22c55e' : combinedYield >= 12 ? '#eab308' : combinedYield >= 0 ? '#f97316' : '#ef4444';
            yieldEl.textContent = combinedYield + '% yield combinado';
            yieldEl.style.color = yColor;
            picksEl.textContent = `~${monthlyEst} picks/mes`;
            wrEl.textContent = `WR ${combinedWr}%`;
        }

        list.addEventListener('click', e => {
            const row = e.target.closest('tr');
            if (!row || e.target.type === 'checkbox') return;
            const cb = row.querySelector('.ta-pf-check');
            if (cb) { cb.checked = !cb.checked; recalc(); }
        });
        list.addEventListener('change', recalc);
        recalc();
    }




    function renderPopup(td, profitability, scores, specialization, consistency, followability, categoryYieldData, followVerdict) {
        const { muestra: mR, yield: yR, seguibilidad: sR } = scores;
        const prof = { global: { picks: td.header.picks, yield: td.header.yield } };

        const byPicksThenYield = (a, b) => b.picks - a.picks || b.yield - a.yield;
        const recommended = [...specialization.stars].sort(byPicksThenYield);
        const recommendedIll = [...specialization.starsIlliquid].sort(byPicksThenYield);
        const watch = [...specialization.watchYield, ...specialization.watchIlliquid].sort(byPicksThenYield);
        const negatives = [...specialization.negatives].sort(byPicksThenYield);

        const mFlags = [];
        if (td.header.picks < 200) mFlags.push(renderFlag(`Solo ${td.header.picks} picks — se necesitan al menos 200 para conclusiones fiables`));
        if (consistency.totalMonths < 6) mFlags.push(renderFlag(`Solo ${consistency.totalMonths} meses de historial — mínimo recomendado: 6`));
        if (consistency.neverLost) mFlags.push(renderFlag('Nunca ha tenido mes negativo — sin datos de reacción ante drawdown', 'info'));

        const yFlags = [];
        if (consistency.trend.status === 'bajista')
            yFlags.push(renderFlag(`Tendencia bajista: yield reciente ${consistency.trend.avgRecent}% vs histórico ${consistency.trend.avgHistoric}%`));
        if (consistency.oddsShift?.shifted)
            yFlags.push(renderFlag(`Cambio de odds del ${((consistency.oddsShift.ratio - 1) * 100).toFixed(0)}% — posible cambio de estrategia`));
        if (yR.recentY !== null && yR.globalY - yR.recentY > 15)
            yFlags.push(renderFlag(`Caída notable: yield global ${yR.globalY}% vs último año ${yR.recentY}%`));
        if (yR.categoryBonus > 0)
            yFlags.push(renderFlag(`Las categorías recomendadas mantienen buen yield reciente (+${yR.categoryBonus} pts)`, 'ok'));
        if (yR.categoryBonus < 0)
            yFlags.push(renderFlag(`El yield reciente de las categorías recomendadas está cayendo (${yR.categoryBonus} pts)`));
        if (consistency.overbetting.detected)
            yFlags.push(renderFlag(`Posible overbetting — ${consistency.overbetting.recentAvg} picks/mes recientes vs ${consistency.overbetting.historicAvg}/mes histórico (×${consistency.overbetting.ratio})`, 'warn'));
        if (consistency.maxDrawdown < -30)
            yFlags.push(renderFlag(`Drawdown consecutivo de ${consistency.maxDrawdown}% en ${consistency.maxDDStreak} meses`, consistency.maxDrawdown < -50 ? 'warn' : 'info'));

        const sFlags = [];
        if (sR.liveRatio >= 80) sFlags.push(renderFlag(`${sR.liveRatio}% de picks son live — prácticamente imposible colocarlos a tiempo`));
        else if (sR.liveRatio >= 40) sFlags.push(renderFlag(`${sR.liveRatio}% de picks son live — requiere estar pendiente en tiempo real`));
        if ((sR.anticipationPct ?? 0) >= 90) sFlags.push(renderFlag(`${sR.anticipationPct}% de picks con menos de 1h de antelación`));
        if (sR.liquidPicksRatio >= 0.75) sFlags.push(renderFlag(`${Math.round(sR.liquidPicksRatio * 100)}% de los picks en mercados líquidos`, 'ok'));
        else if (sR.liquidPicksRatio < 0.5) sFlags.push(renderFlag(`Solo ${Math.round(sR.liquidPicksRatio * 100)}% en mercados líquidos`));
        if (sR.illiquidLeagues?.length > 0) sFlags.push(renderFlag(`Ligas ilíquidas con muestra: ${sR.illiquidLeagues.map(c => c.name).join(', ')}`));

        function section(id, emoji, title, badge, content, startOpen = false) {
            return `<details class="ta-section" ${startOpen ? 'open' : ''}>
            <summary class="ta-section-title" style="cursor:pointer;list-style:none;user-select:none;display:flex;align-items:center;gap:6px;">
                <span>${emoji} ${title}</span>
                ${badge ? `<span style="margin-left:4px">${badge}</span>` : ''}
                <span class="ta-collapse-arrow" style="margin-left:auto;font-size:10px;color:#555">▾</span>
            </summary>
            <div style="margin-top:10px">${content}</div>
            </details>`;
        }


        // ── Veredicto compacto ────────────────────────────────────────────────────
        const verdictHtml = `
    <div class="ta-follow ${followVerdict.decision}" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;text-align:left;">
      <div style="font-size:14px;line-height:1;flex-shrink:0">${followVerdict.emoji}</div>
      <div style="flex:1;min-width:0">
        <div class="ta-f-title" style="font-size:13px;margin-bottom:4px">${followVerdict.title}</div>
        <div class="ta-f-reason" style="font-size:11px">${followVerdict.html}</div>
      </div>
    </div>`;

        // ── Categorías — tabla unificada ─────────────────────────────────────────
        const allCats = profitability.categories
            .filter(c => c.picks >= 15 && c.yield > 0)
            .sort((a, b) => b.picks - a.picks)
            .map(c => {
                const spec = specialization.classified.find(s => s.name === c.name);
                return { ...c, _type: spec?.tag ?? 'positive' };
            });

        // Preselección óptima: añadir en orden picks desc mientras el yield combinado no baje
        const candidates = allCats.filter(c => c.yield >= 12 && c.picks >= 50);
        const scored = candidates.map(c => ({ ...c, score: c.yield * Math.sqrt(c.picks) }));
        const avgScore = scored.reduce((s, c) => s + c.score, 0) / Math.max(scored.length, 1);
        const preselected = new Set(
            scored
                .filter(c => c.score >= avgScore)
                .map(c => c.name)
        );


        function catBadge(type) {
            return type === 'star' ? '⭐ Líquida'
                : type === 'star_illiquid' ? '🔥 Ilíquida'
                    : type === 'watch_yield' ? '🟡 A vigilar'
                        : type === 'watch_illiquid' ? '🔒 Ilíquida'
                            : type === 'positive' ? '✅ Positiva'
                                : '—';
        }
        function catBadgeColor(type) {
            return type === 'star' ? '#22c55e'
                : type === 'star_illiquid' ? '#f97316'
                    : (type === 'watch_yield' || type === 'watch_illiquid') ? '#eab308'
                        : type === 'positive' ? '#6b7280'
                            : '#555566';
        }

        const hasCatYield = categoryYieldData?.length > 0;
        const catsRowsHtml = allCats.map(c => {
            const recent = categoryYieldData?.find(r => r.name === c.name);
            const isSelected = preselected.has(c.name);
            const yc = c.yield >= 20 ? '#22c55e' : c.yield >= 12 ? '#eab308' : c.yield >= 0 ? '#f97316' : '#ef4444';
            const r12c = recent?.recentYield != null ? (recent.recentYield >= 20 ? '#22c55e' : recent.recentYield >= 12 ? '#eab308' : recent.recentYield >= 0 ? '#f97316' : '#ef4444') : '#555';
            const r6c = recent?.recentYield6 != null ? (recent.recentYield6 >= 20 ? '#22c55e' : recent.recentYield6 >= 12 ? '#eab308' : recent.recentYield6 >= 0 ? '#f97316' : '#ef4444') : '#555';
            return `<tr>
        <td class="ta-pf-check-cell"><input type="checkbox" class="ta-pf-check" data-picks="${c.picks}" data-yield="${c.yield}" data-wr="${c.wr}" ${isSelected ? 'checked' : ''}></td>
        <td style="color:#e8eaf0;font-weight:600">${c.name}</td>
        <td><span style="color:${catBadgeColor(c._type)};font-size:10px;white-space:nowrap">${catBadge(c._type)}</span></td>
        <td style="color:${yc};font-weight:700">${c.yield}%</td>
        <td style="color:#9ca3b8">${c.wr}%</td>
        <td style="color:#9ca3b8">${c.picks}</td>
        ${hasCatYield ? `<td style="color:${r12c}">${recent?.recentYield != null ? recent.recentYield + '%' : '—'}</td><td style="color:${r6c}">${recent?.recentYield6 != null ? recent.recentYield6 + '%' : '—'}</td>` : ''}
    </tr>`;
        }).join('');



        const catsTableContent = allCats.length === 0
            ? '<div style="font-size:11px;color:#555;text-align:center;padding:8px">Sin categorías con muestra suficiente</div>'
            : `<table class="ta-pf-table">
            <thead><tr>
            <th></th><th>Categoría</th><th>Tipo</th><th>Yield</th><th>WR</th><th>Picks</th>
            ${hasCatYield ? '<th>12m</th><th>6m</th>' : ''}
            </tr></thead>
            <tbody id="ta-pf-list">${catsRowsHtml}</tbody>
        </table>`;

        return `
        <div id="ta-overlay">
            <div id="ta-popup">
                <div id="ta-header">
                    <div>
                    <h1>📊 Análisis: ${td.header.username}</h1>
                    <div class="ta-sub">${td.header.picks} picks · ${consistency.totalMonths} meses · Yield global ${td.header.yield}%</div>
                    </div>
                    <button id="ta-close">✕</button>
                </div>
                <div id="ta-body">

        ${verdictHtml}

        ${section('muestra', '🔬', 'Muestra', `${mR.score}/100`, `
        ${renderRow('Meses en positivo', `${consistency.positiveMonths}/${consistency.totalMonths} (${consistency.winRate}%)`, consistency.winRate >= 80 ? 'green' : consistency.winRate >= 60 ? 'yellow' : 'red')}
        ${renderRow('Ligas con muestra fiable (≥15 picks)', specialization.classified.filter(c => c.reliable).length)}
        ${mFlags.length ? `<div class="ta-flags">${mFlags.join('')}</div>` : ''}`)}


        ${section('trend', '💰', 'Rendimiento', `${yR.score}/100`, `
        <div class="ta-row">
            <span class="ta-rl">Yield</span>
            <span style="display:flex;gap:14px;font-size:12px;font-weight:600">
            <span title="All-time">
                <span style="color:#7b8199;font-size:10px">ALL </span>
                <span class="${yR.globalY >= 20 ? 'green' : yR.globalY >= 12 ? 'yellow' : 'red'} ta-rv">${yR.globalY}%</span>
            </span>
            <span title="Último año">
                <span style="color:#7b8199;font-size:10px">12M </span>
                <span class="${(yR.recentY ?? 0) >= 20 ? 'green' : (yR.recentY ?? 0) >= 12 ? 'yellow' : 'red'} ta-rv">${yR.recentY != null ? yR.recentY + '%' : '—'}</span>
            </span>
            <span title="Últimos 6 meses">
                <span style="color:#7b8199;font-size:10px">6M </span>
                <span class="${(consistency.yield6m ?? 0) >= 20 ? 'green' : (consistency.yield6m ?? 0) >= 12 ? 'yellow' : 'red'} ta-rv">${consistency.yield6m != null ? consistency.yield6m + '%' : '—'}</span>
            </span>
            <span title="Últimos 3 meses">
                <span style="color:#7b8199;font-size:10px">3M </span>
                <span class="${consistency.trend.avgRecent >= 20 ? 'green' : consistency.trend.avgRecent >= 12 ? 'yellow' : consistency.trend.avgRecent >= 0 ? 'orange' : 'red'} ta-rv">${consistency.trend.avgRecent}%</span>
            </span>
            </span>
        </div>
        ${renderRow('Tendencia', `${consistency.trend.status} (${consistency.trend.avgRecent}% vs ${consistency.trend.avgHistoric}%)`, consistency.trend.status === 'mejorando' ? 'green' : consistency.trend.status === 'bajista' ? 'red' : 'yellow')}
        ${renderRow('Cambio en odds medias', consistency.oddsShift?.shifted ? `${consistency.oddsShift.historicOdds} → ${consistency.oddsShift.recentOdds} ⚠️` : 'Estable', consistency.oddsShift?.shifted ? 'yellow' : '')}
        ${renderRow('Drawdown máx. consecutivo', `${consistency.maxDrawdown}% (${consistency.maxDDStreak} ${consistency.maxDDStreak === 1 ? 'mes' : 'meses'})`, consistency.maxDrawdown < -40 ? 'red' : consistency.maxDrawdown < -20 ? 'yellow' : 'green')}
        ${renderRow('Picks recientes vs histórico', `${consistency.overbetting.recentAvg}/mes vs ${consistency.overbetting.historicAvg}/mes${consistency.overbetting.detected ? ' ⚠️' : ''}`, consistency.overbetting.detected ? 'yellow' : 'green')}
        ${yFlags.length ? `<div class="ta-flags">${yFlags.join('')}</div>` : ''}`)}

        ${section('seg', '👁️', 'Seguibilidad', `${sR.score}/100`, `
          ${renderRow('% picks live', `${sR.liveRatio}%`, sR.liveRatio >= 80 ? 'red' : sR.liveRatio >= 40 ? 'yellow' : 'green')}
          ${renderRow('% picks con <1h antelación', sR.anticipationPct != null ? `${sR.anticipationPct}%` : 'N/A', (sR.anticipationPct ?? 0) >= 90 ? 'red' : (sR.anticipationPct ?? 0) >= 70 ? 'yellow' : 'green')}
          ${renderRow('% picks en mercados líquidos', `${Math.round(sR.liquidPicksRatio * 100)}%`, sR.liquidPicksRatio >= 0.75 ? 'green' : sR.liquidPicksRatio >= 0.5 ? 'yellow' : 'red')}
          ${followability.peakHour ? renderRow('Hora pico de actividad', `${followability.peakHour.hour_of_the_day} (${followability.peakHour.picks} picks · yield ${followability.peakHour.yield}%)`) : ''}
          ${followability.stakes?.[0] ? renderRow('Stake habitual', followability.stakes[0].stakes) : ''}
          ${sFlags.length ? `<div class="ta-flags">${sFlags.join('')}</div>` : ''}`)}

        ${section('cats', '🏅', 'Categorías', '', `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <span style="background:#1a2e1a;border:1px solid #22c55e;color:#22c55e;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px">COMBINACIÓN RECOMENDADA</span>
            <span style="display:inline-flex;gap:12px;align-items:baseline">
            <span id="ta-pf-yield" style="font-size:12px;font-weight:800;color:#22c55e">—</span>
            <span id="ta-pf-picks" style="font-size:10px;color:#7b8199">— picks/mes</span>
            <span id="ta-pf-wr"    style="font-size:10px;color:#7b8199">WR —</span>
            </span>
        </div>
        ${catsTableContent}`)}


        ${section('chart', '📈', 'Yield mensual por año', '', `
          <div style="font-size:10px;color:#7b8199;margin-bottom:8px">Click en el año de la leyenda para mostrar/ocultar · barras = picks históricos</div>
          <div style="position:relative;height:280px"><canvas id="ta-yield-chart"></canvas></div>`)}

      </div>
    </div>
  </div>`;
    }


    // ─── MAIN ─────────────────────────────────────────────────────────────────────
    // Inject styles + loading screen
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    document.body.insertAdjacentHTML('beforeend', `
  <div id="ta-overlay">
    <div id="ta-popup">
      <div id="ta-header"><div><h1>📊 Analizando tipster...</h1></div></div>
      <div id="ta-loading">
        <div class="ta-spinner"></div>
        <span>Obteniendo datos y calculando yield por categoría...</span>
      </div>
    </div>
  </div>
`);

    // Click outside to close loading
    document.getElementById('ta-overlay').addEventListener('click', e => {
        if (e.target.id === 'ta-overlay') { document.getElementById('ta-overlay')?.remove(); style.remove(); }
    });

    try {
        const td = await scrapeTipsterData();
        const profitability = buildProfitability(td);
        const consistency = buildConsistency(td);
        const specialization = buildSpecialization(profitability);
        const followability = buildFollowability(td);

        const catsToAnalyze = [
            ...specialization.stars,
            ...specialization.starsIlliquid,
            ...specialization.watchYield,
            ...specialization.watchIlliquid,
        ]; const [catYield12, catYield6] = catsToAnalyze.length > 0
            ? await Promise.all([
                fetchCategoryYield(catsToAnalyze, 12),
                fetchCategoryYield(catsToAnalyze, 6),
            ])
            : [[], []];
        const categoryYieldData = catYield12.map(c => {
            const c6 = catYield6.find(x => x.name === c.name);
            return { ...c, recentYield6: c6?.recentYield ?? null };
        });
        categoryYieldData.forEach(c => {
            const spec = specialization.classified.find(s => s.name === c.name);
            if (spec) c.tag = spec.tag;
        });

        const scores = computeScores(profitability, consistency, specialization, followability, categoryYieldData);
        const followVerdict = getFollowVerdict(scores, specialization, consistency, followability, categoryYieldData);

        // Replace loading with real popup
        document.getElementById('ta-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend',
            renderPopup(td, profitability, scores, specialization, consistency, followability, categoryYieldData, followVerdict)
        );

        await loadChartJs();
        requestAnimationFrame(() => initChart(consistency.sorted));
        initPortfolio(profitability);
        document.getElementById('ta-close').addEventListener('click', () => {
            document.getElementById('ta-overlay')?.remove(); style.remove();
        });
        document.getElementById('ta-overlay').addEventListener('click', e => {
            if (e.target.id === 'ta-overlay') { document.getElementById('ta-overlay')?.remove(); style.remove(); }
        });

    } catch (err) {
        document.getElementById('ta-overlay')?.remove();
        style.remove();
        alert('❌ Error al analizar el tipster: ' + err.message);
        console.error(err);
    }

})();