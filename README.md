# CTA Position Tracker

S&P 500 Managed Money Positioning · CFTC COT Data · 52-Week Z-Score · Auto-updates weekly.

---

## Tech Stack

| Layer | Service |
|-------|---------|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Upstash Redis |
| Data source | CFTC COT Report + Yahoo Finance |
| Auto-refresh | Vercel Cron (every Friday 10 PM UTC) |

---

## Deployment Steps

### 1. Push to GitHub
- Create a new **private** repository on GitHub
- Upload all these files (or push via Git)

### 2. Create Upstash Redis database
- Go to [upstash.com](https://upstash.com) → Console → Redis → Create Database
- Region: `us-east-1` (closest to Vercel's default)
- Copy: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 3. Deploy to Vercel
- Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
- Add these Environment Variables:

```
UPSTASH_REDIS_REST_URL     = (from Upstash dashboard)
UPSTASH_REDIS_REST_TOKEN   = (from Upstash dashboard)
CRON_SECRET                = (any random string, e.g. abc123xyz)
```

- Click **Deploy**

### 4. Seed the database (one-time)
After deployment, visit this URL in your browser to load historical data:

```
https://your-app.vercel.app/api/cron?secret=YOUR_CRON_SECRET
```

Replace `your-app` with your Vercel subdomain and `YOUR_CRON_SECRET` with what you set in step 3.

Wait ~10 seconds, then visit your app. The chart should appear.

### 5. Verify cron is scheduled
- In Vercel dashboard → your project → Settings → Cron Jobs
- You should see `/api/cron` scheduled for Fridays at 22:00 UTC
- CFTC publishes COT data Fridays ~3:30 PM ET (8:30 PM UTC) — our cron runs 90 min later

---

## How It Works

```
Every Friday (automatic):
  CFTC publishes COT report (3:30 PM ET)
         ↓
  Vercel Cron triggers /api/cron (10 PM UTC)
         ↓
  Fetches 4 years of COT data (E-mini S&P 500)
  Fetches 4 years of SPY weekly prices
  Calculates 52-week rolling z-score
  Filters to last 3 years
         ↓
  Stores result in Upstash Redis
         ↓
  Chart updates automatically on next page visit
```

---

## Z-Score Interpretation

| Range | Signal |
|-------|--------|
| |Z| < 1.5σ | Normal — no crowding |
| 1.5σ – 2σ | Elevated — watch for exhaustion |
| |Z| > 2σ | **Extreme** — forced liquidation risk |

---

## Customization

- **Change lookback window**: Edit `windowSize = 52` in `/app/api/cron/route.js`
- **Change chart range**: Edit `cutoff.setFullYear(cutoff.getFullYear() - 3)` (currently 3 years)
- **Add more contracts**: Duplicate the COT fetch with different contract codes (bonds, oil, etc.)
- **Cron schedule**: Edit `vercel.json` — uses standard cron syntax

---

## Contract Code Reference

| Futures | CME Code |
|---------|----------|
| E-mini S&P 500 | `13874+` |
| E-mini Nasdaq 100 | `209742` |
| 10-Year T-Note | `043602` |
| Crude Oil (WTI) | `067651` |
