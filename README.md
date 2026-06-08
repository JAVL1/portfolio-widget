# portfolio-widget

A lightweight (~6kb), zero-dependency embeddable investment portfolio tracker for personal websites and resumes.

Drop in a `<script>` tag, add your holdings, and get a beautiful line chart of your cumulative return over time — no backend, no build step, no framework.


---

## Features

- 📈 Cumulative return line chart (stock market style)
- 📊 Holdings breakdown table with allocation bars
- 🌗 Light / dark / auto theme
- 💱 Multi-currency & locale support
- 🎨 Custom accent colour
- ✅ Works in any HTML page — Webflow, Squarespace, GitHub Pages, plain HTML

---

## Quick start

```html
<!-- 1. Add a container -->
<div id="my-portfolio"></div>

<!-- 2. Load the widget (via jsDelivr CDN — no install needed) -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/portfolio-widget/portfolio-widget.js"></script>

<!-- 3. Configure your holdings -->
<script>
  PortfolioWidget.init({
    container:   '#my-portfolio',
    title:       'My Investment Portfolio',
    lastUpdated: '2024-06-01',
    assets: [
      {
        ticker:        'AAPL',
        name:          'Apple Inc.',
        allocation:    40,              // % of total portfolio — must sum to 100
        purchaseDate:  '2022-01-15',    // YYYY-MM-DD
        purchasePrice: 172.50,
        currentPrice:  213.00,         // update this manually (v2 will auto-fetch)
      },
      {
        ticker:        'BTC',
        name:          'Bitcoin',
        allocation:    35,
        purchaseDate:  '2021-06-01',
        purchasePrice: 35000,
        currentPrice:  67000,
      },
      {
        ticker:        'VTI',
        name:          'Vanguard Total Market',
        allocation:    25,
        purchaseDate:  '2020-03-01',
        purchasePrice: 140.00,
        currentPrice:  242.00,
      },
    ]
  });
</script>
```

That's it. Open your page and the widget renders itself.

---

## All options

| Option | Type | Default | Description |
|---|---|---|---|
| `assets` | `Asset[]` | **required** | Array of asset objects (see below) |
| `container` | `string \| Element` | `'#portfolio-widget'` | CSS selector or DOM element |
| `title` | `string \| null` | `null` | Optional title shown above the widget |
| `height` | `number` | `220` | Chart height in pixels |
| `showStats` | `boolean` | `true` | Show summary stat cards |
| `showTable` | `boolean` | `true` | Show holdings breakdown table |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Colour scheme |
| `accentColor` | `string \| null` | `null` | Override chart line colour, e.g. `'#6366f1'` |
| `currency` | `string` | `'USD'` | ISO 4217 currency code |
| `locale` | `string` | `'en-US'` | BCP 47 locale for formatting |
| `lastUpdated` | `string \| null` | `null` | Date shown in footer, e.g. `'2024-06-01'` |

### Asset object

| Field | Type | Required | Description |
|---|---|---|---|
| `ticker` | `string` | ✅ | Symbol shown in the table, e.g. `'AAPL'` |
| `name` | `string` | — | Full name shown as subtitle |
| `allocation` | `number` | ✅ | Portfolio weight in %. All assets must sum to 100 |
| `purchaseDate` | `string` | ✅ | ISO date string `'YYYY-MM-DD'` |
| `purchasePrice` | `number` | ✅ | Price you paid per unit/share/coin |
| `currentPrice` | `number` | ✅ | Current price per unit (update manually in v1) |

---

## How returns are calculated

The cumulative return line uses a **time-weighted, allocation-weighted** method:

1. For each monthly data point on the chart, only assets already purchased by that date contribute.
2. Each asset's contribution is scaled by how far through its total holding period that date is (so early months aren't inflated by a recent big win).
3. Returns are weighted by each asset's `allocation` percentage.

This means the chart accurately shows how *your actual portfolio* has grown month-by-month, not a hypothetical "if you'd bought everything on day 1" view.

---

## Keeping prices up to date (v1)

In v1, prices are hardcoded. When you want to refresh the widget, update `currentPrice` for each asset and re-deploy your site. It takes about 2 minutes.

To make this easier, you can keep your config in a separate file:

```html
<script src="my-portfolio-config.js"></script>  <!-- your holdings -->
<script src="portfolio-widget.js"></script>
<script>
  PortfolioWidget.init(MY_PORTFOLIO_CONFIG);
</script>
```

```js
// my-portfolio-config.js — the only file you edit
var MY_PORTFOLIO_CONFIG = {
  lastUpdated: '2024-06-01',   // ← update this date
  assets: [
    { ticker: 'AAPL', allocation: 40, purchaseDate: '2022-01-15', purchasePrice: 172.50, currentPrice: 213.00 },
    // ...
  ]
};
```

**v2 (planned):** automatic price fetching via Alpha Vantage / Yahoo Finance — see [#roadmap](#roadmap).

---

## Roadmap

- [x] **v1** — hardcoded prices, full chart + table
- [ ] **v2** — live price fetching (Alpha Vantage API key)
- [ ] **v2.1** — optional Cloudflare Worker proxy (no exposed API key)
- [ ] **v3** — multiple purchase lots per asset (dollar-cost averaging)
- [ ] **v3.1** — benchmark comparison line (e.g. vs S&P 500)
- [ ] **v4** — optional `<iframe>` embed mode for CMS sites

PRs welcome!

---

## Contributing

1. Fork the repo
2. Make your changes in `portfolio-widget.js`
3. Test with `demo/index.html` (open locally in a browser — no build step)
4. Open a PR with a description of what changed

Please keep the widget self-contained in a single file with no npm dependencies. The zero-install embed experience is a core design goal.

---

## License

MIT © JAVL
