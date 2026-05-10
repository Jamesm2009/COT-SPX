# CTA Position Tracker

Managed Money Positioning across 8 assets · CFTC COT Data · 52-Week Z-Score · 5-Week SMA

**Live:** https://cta.market-dashboards.com

---

## What It Does

Tracks net positioning of Managed Money (CTA proxy) from the weekly CFTC Commitments of Traders report across 8 futures markets. Net positioning is normalised as a 52-week rolling z-score and smoothed with a 5-week SMA to identify historically extreme crowding — a contrarian risk signal.

---

## Tech Stack

| Layer | Service |
|-------|---------|
| Framework | Next.js 14 (App Router) |
| Hosting | DigitalOcean Droplet (Dokku) |
| Database | Upstash Redis |
| Data source | CFTC COT Report (manual weekly) + Yahoo Finance |
| Updates | Manual — every Friday after COT release |

---

## Assets Tracked

| Asset | ETF | CFTC Code | Report |
|-------|-----|-----------|--------|
| S&P 500 | SPY | CME 13874+ | TFF |
| Nasdaq 100 | QQQ | CME 209742 | TFF |
| Russell 2000 | IWM | CME 239742 | TFF |
| 10Y Treasury | TLT | CFTC 043602 | TFF |
| US Dollar | UUP | CFTC 098662 | TFF |
| Gold | GLD | CFTC 088691 | Disaggregated |
| Copper | CPER | CFTC 085692 | Disaggregated |
| Oil (WTI) | USO | CFTC 067651 | Disaggregated |

---

## Methodology

1. **Net positioning** — Managed Money longs minus shorts, expressed as % of total open interest
2. **52-week rolling z-score** — normalises positioning so extremes are comparable across time and across assets regardless of changes in market size
3. **5-week SMA** — smooths week-to-week noise while preserving the signal

### Z-Score Interpretation

| Range | Signal |
|-------|--------|
| \|Z\| < 1.5σ | Normal — positioning balanced, no crowding risk |
| 1.5σ – 2σ | Elevated — positioning stretched, watch for exhaustion |
| \|Z\| > 2σ | **Extreme** — max long/short, forced liquidation risk |

---

## Weekly Update Process

CFTC publishes COT data every Friday at ~3:30 PM ET. Updates are applied manually each Friday evening.

### What you need
- The weekly CFTC COT file (TFF report for equities/rates/FX; Disaggregated for commodities)
- Friday ETF closing prices for all 8 assets (SPY, QQQ, IWM, TLT, UUP, GLD, CPER, USO)
- The `COT_Weekly_Template.xlsx` file

### Steps

**1. Fill in the template**
Open `COT_Weekly_Template.xlsx` and enter:
- 3 numbers per asset from the CFTC report: **Longs**, **Shorts**, **Open Interest** (Managed Money rows)
- Friday closing price for each ETF

**2. Upload to Claude**
Upload the completed Excel file to Claude (claude.ai). Claude will:
- Calculate net positioning and z-scores
- Generate a `upstash_seeder_vX.html` file

**3. Run the seeder**
- Open the generated HTML file in your browser
- Enter your Upstash credentials when prompted
- Click **Upload**
- The live app updates immediately — no redeployment needed

---

## Deployment (DigitalOcean / Dokku)

The app runs on a DigitalOcean droplet managed by Dokku alongside other dashboards on `market-dashboards.com`.

### Initial setup (one-time)

```bash
# Create the app
dokku apps:create cta-tracker

# Set environment variables
dokku config:set cta-tracker UPSTASH_REDIS_REST_URL=your_url_here
dokku config:set cta-tracker UPSTASH_REDIS_REST_TOKEN=your_token_here

# Set domain
dokku domains:set cta-tracker cta.market-dashboards.com

# Deploy from GitHub
dokku git:sync cta-tracker https://github.com/Jamesm2009/COT-SPX main
dokku ps:rebuild cta-tracker

# Enable SSL
dokku letsencrypt:enable cta-tracker
```

### Redeploying after a code change

```bash
dokku git:sync cta-tracker https://github.com/Jamesm2009/COT-SPX main
dokku ps:rebuild cta-tracker
```

### Environment variables required

| Variable | Where to find it |
|----------|-----------------|
| `UPSTASH_REDIS_REST_URL` | Upstash dashboard → your database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard → your database → REST API |

---

## Project Structure

```
/app
  /api
    /data        ← API route: reads from Upstash Redis, serves chart data
  page.jsx       ← Main dashboard UI (asset selector, chart, stat cards)
  layout.jsx     ← Root layout
/public
COT_Weekly_Template.xlsx   ← Weekly update input template
```

---

## Other Dashboards (same droplet)

| Subdomain | Description |
|-----------|-------------|
| kcm-mutualfunds.market-dashboards.com | KCM Mutual Funds |
| etf.market-dashboards.com | ETF Dashboard |
| regime-tracker.market-dashboards.com | Regime Tracker |
| occ.market-dashboards.com | OCC Dashboard |

---

*For informational purposes only · Not investment advice · COT data reflects Tuesday positions published Friday*
