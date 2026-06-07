/*!
 * portfolio-widget v1.0.0
 * A lightweight, embeddable investment portfolio tracker for personal websites.
 * https://github.com/JAVL1/portfolio-widget
 * MIT License
 *
 * QUICK START:
 *   <div id="my-portfolio"></div>
 *   <script src="portfolio-widget.js"></script>
 *   <script>
 *     PortfolioWidget.init({
 *       container: '#my-portfolio',
 *       assets: [
 *         { ticker: 'AAPL',  name: 'Apple Inc.',       allocation: 40, purchaseDate: '2022-01-15', purchasePrice: 172.50, currentPrice: 213.00 },
 *         { ticker: 'BTC',   name: 'Bitcoin',           allocation: 35, purchaseDate: '2021-06-01', purchasePrice: 35000,  currentPrice: 67000  },
 *         { ticker: 'VTI',   name: 'Vanguard Total Mkt',allocation: 25, purchaseDate: '2020-03-01', purchasePrice: 140.00, currentPrice: 242.00 },
 *       ]
 *     });
 *   </script>
 */

(function (global) {
  'use strict';

  // ─── DEFAULTS ────────────────────────────────────────────────────────────────

  const DEFAULTS = {
    container: '#portfolio-widget',
    currency: 'USD',
    locale: 'en-US',
    theme: 'auto',           // 'light' | 'dark' | 'auto'
    accentColor: null,       // override chart line color, e.g. '#6366f1'
    showTable: true,         // show holdings breakdown table
    showStats: true,         // show summary stat cards
    height: 220,             // chart height in px
    title: null,             // optional widget title, e.g. 'My Portfolio'
    lastUpdated: null,       // optional date string shown in footer, e.g. '2024-06-01'
  };

  const PALETTE = ['#3f8fe4', '#2a9d67', '#e88a20', '#9b59b6', '#e24b4a', '#0ea5e9', '#f59e0b'];

  // ─── CHART.JS LOADER ─────────────────────────────────────────────────────────

  function loadChartJS(callback) {
    if (global.Chart) return callback();
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = callback;
    script.onerror = () => console.error('[PortfolioWidget] Failed to load Chart.js');
    document.head.appendChild(script);
  }

  // ─── MATH HELPERS ────────────────────────────────────────────────────────────

  function assetReturn(asset) {
    return (asset.currentPrice - asset.purchasePrice) / asset.purchasePrice;
  }

  /**
   * Build a monthly timeline of weighted portfolio return.
   * Each month, only assets already purchased contribute to the return,
   * proportional to how much of their total gain has elapsed.
   */
  function buildTimeline(assets) {
    const today = new Date();
    const minDate = new Date(Math.min(...assets.map(a => new Date(a.purchaseDate))));

    const dates = [];
    let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    while (cursor <= today) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    // always include today as the last point
    const todayStr = today.toISOString().split('T')[0];
    if (dates[dates.length - 1] !== todayStr) dates.push(todayStr);

    const returnSeries = dates.map(dateStr => {
      const target = new Date(dateStr);
      let weighted = 0;
      let activeAllocation = 0;

      for (const asset of assets) {
        const purchased = new Date(asset.purchaseDate);
        if (purchased > target) continue;

        const totalDuration = today - purchased;
        const elapsedDuration = target - purchased;
        const progress = totalDuration > 0 ? Math.min(elapsedDuration / totalDuration, 1) : 1;

        const r = assetReturn(asset);
        weighted += (asset.allocation / 100) * r * progress;
        activeAllocation += asset.allocation;
      }

      // normalise if not all assets are active yet
      const normalised = activeAllocation > 0 ? (weighted / activeAllocation) * 100 : weighted * 100;
      return parseFloat(normalised.toFixed(3));
    });

    return { dates, returns: returnSeries };
  }

  function totalPortfolioReturn(assets) {
    return assets.reduce((sum, a) => sum + (a.allocation / 100) * assetReturn(a), 0);
  }

  function bestPerformer(assets) {
    return assets.reduce((best, a) => assetReturn(a) > assetReturn(best) ? a : best, assets[0]);
  }

  function worstPerformer(assets) {
    return assets.reduce((worst, a) => assetReturn(a) < assetReturn(worst) ? a : worst, assets[0]);
  }

  // ─── FORMATTERS ──────────────────────────────────────────────────────────────

  function fmt(value, opts) {
    return new Intl.NumberFormat(opts.locale, {
      style: 'currency',
      currency: opts.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function fmtPct(value, decimals = 1) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  function fmtDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ─── CSS INJECTION ───────────────────────────────────────────────────────────

  function injectStyles(widgetId, opts) {
    const styleId = `pw-styles-${widgetId}`;
    if (document.getElementById(styleId)) return;

    const isDark = opts.theme === 'dark' ||
      (opts.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const colors = isDark ? {
      bg: '#18181b',
      surface: '#27272a',
      border: 'rgba(255,255,255,0.08)',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      subtle: '#71717a',
    } : {
      bg: '#ffffff',
      surface: '#f4f4f5',
      border: 'rgba(0,0,0,0.08)',
      text: '#18181b',
      muted: '#52525b',
      subtle: '#a1a1aa',
    };

    const css = `
      #${widgetId} {
        --pw-bg: ${colors.bg};
        --pw-surface: ${colors.surface};
        --pw-border: ${colors.border};
        --pw-text: ${colors.text};
        --pw-muted: ${colors.muted};
        --pw-subtle: ${colors.subtle};
        --pw-green: #2a9d67;
        --pw-red: #e24b4a;
        --pw-radius: 10px;
        --pw-radius-sm: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        color: var(--pw-text);
        background: var(--pw-bg);
        border: 1px solid var(--pw-border);
        border-radius: var(--pw-radius);
        padding: 1.25rem 1.5rem;
        max-width: 900px;
        box-sizing: border-box;
      }
      #${widgetId} *, #${widgetId} *::before, #${widgetId} *::after {
        box-sizing: border-box;
      }
      #${widgetId} .pw-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--pw-text);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${widgetId} .pw-title svg {
        opacity: 0.5;
      }
      #${widgetId} .pw-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
        margin-bottom: 1.25rem;
      }
      #${widgetId} .pw-stat {
        background: var(--pw-surface);
        border-radius: var(--pw-radius-sm);
        padding: 0.75rem 1rem;
      }
      #${widgetId} .pw-stat-label {
        font-size: 11px;
        color: var(--pw-muted);
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 500;
      }
      #${widgetId} .pw-stat-val {
        font-size: 22px;
        font-weight: 600;
        line-height: 1.1;
        color: var(--pw-text);
      }
      #${widgetId} .pw-stat-val.pw-pos { color: var(--pw-green); }
      #${widgetId} .pw-stat-val.pw-neg { color: var(--pw-red); }
      #${widgetId} .pw-stat-sub {
        font-size: 11px;
        color: var(--pw-subtle);
        margin-top: 2px;
      }
      #${widgetId} .pw-chart-label {
        font-size: 11px;
        color: var(--pw-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
        margin-bottom: 6px;
      }
      #${widgetId} .pw-chart-wrap {
        position: relative;
        width: 100%;
        margin-bottom: 1.25rem;
      }
      #${widgetId} .pw-table-wrap {
        overflow-x: auto;
        margin-top: 0.25rem;
      }
      #${widgetId} table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      #${widgetId} th {
        text-align: left;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 500;
        color: var(--pw-muted);
        border-bottom: 1px solid var(--pw-border);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      #${widgetId} td {
        padding: 9px 10px;
        border-bottom: 1px solid var(--pw-border);
        color: var(--pw-text);
        white-space: nowrap;
      }
      #${widgetId} tr:last-child td { border-bottom: none; }
      #${widgetId} .pw-ticker {
        font-weight: 600;
        font-size: 13px;
      }
      #${widgetId} .pw-name {
        font-size: 11px;
        color: var(--pw-muted);
        margin-top: 1px;
      }
      #${widgetId} .pw-alloc-bar-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #${widgetId} .pw-alloc-bar-track {
        width: 60px;
        height: 4px;
        background: var(--pw-border);
        border-radius: 2px;
        overflow: hidden;
      }
      #${widgetId} .pw-alloc-bar-fill {
        height: 100%;
        border-radius: 2px;
      }
      #${widgetId} .pw-badge {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 4px;
      }
      #${widgetId} .pw-badge.pw-pos {
        background: rgba(42,157,103,0.12);
        color: var(--pw-green);
      }
      #${widgetId} .pw-badge.pw-neg {
        background: rgba(226,75,74,0.12);
        color: var(--pw-red);
      }
      #${widgetId} .pw-footer {
        margin-top: 1rem;
        font-size: 11px;
        color: var(--pw-subtle);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
      }
      #${widgetId} .pw-footer a {
        color: var(--pw-subtle);
        text-decoration: none;
      }
      #${widgetId} .pw-footer a:hover { text-decoration: underline; }
      #${widgetId} .pw-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        vertical-align: middle;
        margin-right: 4px;
        flex-shrink: 0;
      }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  function render(el, opts, assets) {
    const isDark = opts.theme === 'dark' ||
      (opts.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const { dates, returns } = buildTimeline(assets);
    const totalReturn = totalPortfolioReturn(assets) * 100;
    const best = bestPerformer(assets);
    const worst = worstPerformer(assets);
    const lineColor = opts.accentColor || (totalReturn >= 0 ? '#2a9d67' : '#e24b4a');

    // validate allocations
    const allocSum = assets.reduce((s, a) => s + a.allocation, 0);
    if (Math.abs(allocSum - 100) > 0.5) {
      console.warn(`[PortfolioWidget] Allocations sum to ${allocSum}%, expected 100%.`);
    }

    // ── Title
    const titleHTML = opts.title
      ? `<div class="pw-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
          ${opts.title}
        </div>`
      : '';

    // ── Stats
    const statsHTML = opts.showStats ? `
      <div class="pw-stats">
        <div class="pw-stat">
          <div class="pw-stat-label">Total Return</div>
          <div class="pw-stat-val ${totalReturn >= 0 ? 'pw-pos' : 'pw-neg'}">${fmtPct(totalReturn)}</div>
          <div class="pw-stat-sub">weighted by allocation</div>
        </div>
        <div class="pw-stat">
          <div class="pw-stat-label">Best Performer</div>
          <div class="pw-stat-val pw-pos">${best.ticker}</div>
          <div class="pw-stat-sub">${fmtPct(assetReturn(best) * 100)}</div>
        </div>
        <div class="pw-stat">
          <div class="pw-stat-label">Worst Performer</div>
          <div class="pw-stat-val pw-neg">${worst.ticker}</div>
          <div class="pw-stat-sub">${fmtPct(assetReturn(worst) * 100)}</div>
        </div>
        <div class="pw-stat">
          <div class="pw-stat-label">Holdings</div>
          <div class="pw-stat-val">${assets.length}</div>
          <div class="pw-stat-sub">since ${fmtDate(dates[0])}</div>
        </div>
      </div>
    ` : '';

    // ── Chart canvas
    const chartHTML = `
      <div class="pw-chart-label">Cumulative portfolio return</div>
      <div class="pw-chart-wrap" style="height: ${opts.height}px;">
        <canvas id="pw-canvas-${el.id}" role="img"
          aria-label="Line chart showing cumulative portfolio return from ${dates[0]} to ${dates[dates.length - 1]}">
          Portfolio return: ${fmtPct(totalReturn)} since ${fmtDate(dates[0])}.
        </canvas>
      </div>
    `;

    // ── Holdings table
    const rowsHTML = assets.map((a, i) => {
      const ret = assetReturn(a);
      const retPct = ret * 100;
      const color = PALETTE[i % PALETTE.length];
      return `
        <tr>
          <td>
            <span class="pw-dot" style="background:${color}"></span>
            <span class="pw-ticker">${a.ticker}</span>
            ${a.name ? `<div class="pw-name">${a.name}</div>` : ''}
          </td>
          <td>
            <div class="pw-alloc-bar-wrap">
              <div class="pw-alloc-bar-track">
                <div class="pw-alloc-bar-fill" style="width:${a.allocation}%; background:${color}"></div>
              </div>
              <span>${a.allocation}%</span>
            </div>
          </td>
          <td>${fmtDate(a.purchaseDate)}</td>
          <td>${fmt(a.purchasePrice, opts)}</td>
          <td>${fmt(a.currentPrice, opts)}</td>
          <td><span class="pw-badge ${ret >= 0 ? 'pw-pos' : 'pw-neg'}">${fmtPct(retPct)}</span></td>
        </tr>
      `;
    }).join('');

    const tableHTML = opts.showTable ? `
      <div class="pw-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Allocation</th>
              <th>Purchased</th>
              <th>Entry price</th>
              <th>Current price</th>
              <th>Return</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
    ` : '';

    // ── Footer
    const lastUpdatedStr = opts.lastUpdated
      ? `Prices as of ${fmtDate(opts.lastUpdated)}.`
      : `Update <code>currentPrice</code> to refresh returns.`;

    const footerHTML = `
      <div class="pw-footer">
        <span>${lastUpdatedStr}</span>
        <a href="https://github.com/YOUR_USERNAME/portfolio-widget" target="_blank" rel="noopener">
          portfolio-widget v1
        </a>
      </div>
    `;

    el.innerHTML = titleHTML + statsHTML + chartHTML + tableHTML + footerHTML;

    // ── Draw chart
    const ctx = document.getElementById(`pw-canvas-${el.id}`);
    if (!ctx) return;

    // format x-axis labels — show fewer ticks for long timelines
    const labelEvery = dates.length > 36 ? 6 : dates.length > 12 ? 3 : 1;
    const xLabels = dates.map((d, i) => {
      if (i % labelEvery !== 0 && i !== dates.length - 1) return '';
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = isDark ? '#71717a' : '#a1a1aa';

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [{
          label: 'Return %',
          data: returns,
          borderColor: lineColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: lineColor,
          tension: 0.35,
          fill: true,
          backgroundColor: (context) => {
            const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, opts.height);
            const hex = lineColor;
            gradient.addColorStop(0, hex + '28');
            gradient.addColorStop(1, hex + '00');
            return gradient;
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#27272a' : '#ffffff',
            titleColor: isDark ? '#f4f4f5' : '#18181b',
            bodyColor: isDark ? '#a1a1aa' : '#52525b',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => {
                const d = new Date(dates[items[0].dataIndex]);
                return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              },
              label: (item) => ` Return: ${fmtPct(item.parsed.y, 2)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: tickColor,
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: false,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: {
              callback: (v) => fmtPct(v, 0),
              color: tickColor,
              font: { size: 11 },
            },
            grid: { color: gridColor },
            border: { display: false },
          },
        },
      },
    });
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────────────

  function init(userOpts) {
    const opts = Object.assign({}, DEFAULTS, userOpts);
    const assets = opts.assets || [];

    if (!assets.length) {
      console.error('[PortfolioWidget] No assets provided. Pass an `assets` array to PortfolioWidget.init().');
      return;
    }

    // resolve container
    const el = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;

    if (!el) {
      console.error(`[PortfolioWidget] Container "${opts.container}" not found in the DOM.`);
      return;
    }

    // give element a stable id for scoped CSS
    if (!el.id) el.id = 'pw-' + Math.random().toString(36).slice(2, 8);

    // validate assets
    for (const a of assets) {
      if (!a.ticker)        console.warn('[PortfolioWidget] An asset is missing `ticker`.');
      if (!a.allocation)    console.warn(`[PortfolioWidget] ${a.ticker} is missing \`allocation\`.`);
      if (!a.purchaseDate)  console.warn(`[PortfolioWidget] ${a.ticker} is missing \`purchaseDate\`.`);
      if (!a.purchasePrice) console.warn(`[PortfolioWidget] ${a.ticker} is missing \`purchasePrice\`.`);
      if (!a.currentPrice)  console.warn(`[PortfolioWidget] ${a.ticker} is missing \`currentPrice\`. Returns will be 0.`);
    }

    injectStyles(el.id, opts);

    loadChartJS(() => render(el, opts, assets));
  }

  // ─── EXPORT ──────────────────────────────────────────────────────────────────

  global.PortfolioWidget = { init };

}(typeof window !== 'undefined' ? window : this));
