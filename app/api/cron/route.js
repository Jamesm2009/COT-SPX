import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ── Asset config ─────────────────────────────────────────────────────────────
// report: 'tff'    → Traders in Financial Futures (equity index, rates, FX)
// report: 'disagg' → Disaggregated COT (commodities)
const ASSETS = [
  { key: 'spx',    label: 'S&P 500',      cftcCode: '13874+', report: 'tff',    etf: 'SPY'  },
  { key: 'ndx',    label: 'Nasdaq 100',   cftcCode: '209742', report: 'tff',    etf: 'QQQ'  },
  { key: 'rut',    label: 'Russell 2000', cftcCode: '239742', report: 'tff',    etf: 'IWM'  },
  { key: 'ust10',  label: '10Y Treasury', cftcCode: '043602', report: 'tff',    etf: 'TLT'  },
  { key: 'usd',    label: 'US Dollar',    cftcCode: '098662', report: 'tff',    etf: 'UUP'  },
  { key: 'gold',   label: 'Gold',         cftcCode: '088691', report: 'disagg', etf: 'GLD'  },
  { key: 'copper', label: 'Copper',       cftcCode: '085692', report: 'disagg', etf: 'CPER' },
  { key: 'oil',    label: 'Oil (WTI)',    cftcCode: '067651', report: 'disagg', etf: 'USO'  },
];

const TFF_URL    = 'https://publicreporting.cftc.gov/resource/jun7-fc8e.json';
const DISAGG_URL = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json';

// ── Maths ────────────────────────────────────────────────────────────────────
function calculateZScore(values, index, windowSize = 52) {
  if (index < windowSize) return null;
  const w    = values.slice(index - windowSize, index);
  const mean = w.reduce((s, v) => s + v, 0) / w.length;
  const std  = Math.sqrt(w.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / w.length);
  return std === 0 ? 0 : (values[index] - mean) / std;
}

function applySMA(values, window = 5) {
  return values.map((v, i) => {
    if (i < window - 1 || v === null) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.some(x => x === null) ? null : slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function nearestPrice(targetDate, priceMap) {
  const target  = new Date(targetDate).getTime();
  const fourDays = 4 * 24 * 60 * 60 * 1000;
  let best = null, bestDiff = Infinity;
  for (const [date, price] of Object.entries(priceMap)) {
    const diff = Math.abs(new Date(date).getTime() - target);
    if (diff < bestDiff && diff <= fourDays) { bestDiff = diff; best = price; }
  }
  return best;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchPriceMap(ticker) {
  const endTs   = Math.floor(Date.now() / 1000);
  const startTs = endTs - 4 * 365 * 24 * 60 * 60;
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTs}&period2=${endTs}&interval=1wk`,
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Yahoo Finance error for ${ticker}: ${res.status}`);
  const json   = await res.json();
  const result = json.chart.result[0];
  const map    = {};
  result.timestamp.forEach((ts, i) => {
    const price = result.indicators.quote[0].close[i];
    if (price) map[new Date(ts * 1000).toISOString().split('T')[0]] = price;
  });
  return map;
}

async function fetchCOT(asset) {
  const endpoint   = asset.report === 'tff' ? TFF_URL : DISAGG_URL;
  const longField  = asset.report === 'tff' ? 'noncomm_positions_long_all'  : 'm_money_positions_long_all';
  const shortField = asset.report === 'tff' ? 'noncomm_positions_short_all' : 'm_money_positions_short_all';

  const url = `${endpoint}?` +
    `$where=${encodeURIComponent(`cftc_contract_market_code='${asset.cftcCode}' AND report_date_as_yyyy_mm_dd>='2021-01-01'`)}` +
    `&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd ASC')}` +
    `&$limit=1000` +
    `&$select=${encodeURIComponent(`report_date_as_yyyy_mm_dd,${longField},${shortField},open_interest_all`)}`;

  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CFTC error for ${asset.key}: ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error(`No COT data returned for ${asset.key}`);

  return rows
    .map(row => ({
      date: row.report_date_as_yyyy_mm_dd,
      netPositionPct:
        ((parseFloat(row[longField] ?? 0) - parseFloat(row[shortField] ?? 0)) /
          parseFloat(row.open_interest_all ?? 1)) * 100,
    }))
    .filter(r => r.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ── Per-asset processor ───────────────────────────────────────────────────────
async function processAsset(asset) {
  const [cotRaw, priceMap] = await Promise.all([fetchCOT(asset), fetchPriceMap(asset.etf)]);

  // Deduplicate by date
  const seen = new Map();
  cotRaw.forEach(r => seen.set(r.date, r));
  const deduped = Array.from(seen.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Z-score → 5-week SMA
  const netPcts   = deduped.map(d => d.netPositionPct);
  const rawZ      = deduped.map((_, i) => calculateZScore(netPcts, i, 52));
  const smoothedZ = applySMA(rawZ, 5);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);

  const finalData = deduped
    .map((row, i) => ({ ...row, zScore: smoothedZ[i] }))
    .filter(row => row.zScore !== null && new Date(row.date) >= cutoff)
    .map(row => ({
      date:           row.date,
      price:          nearestPrice(row.date, priceMap),
      ctaZScore:      parseFloat(row.zScore.toFixed(3)),
      netPositionPct: parseFloat(row.netPositionPct.toFixed(2)),
    }))
    .filter(row => row.price !== null);

  if (!finalData.length) throw new Error(`No matched data for ${asset.key}`);

  const payload = {
    updatedAt: new Date().toISOString(),
    asset:     asset.key,
    label:     asset.label,
    etf:       asset.etf,
    rows:      finalData.length,
    data:      finalData,
  };
  await redis.set(`cta_data_${asset.key}`, JSON.stringify(payload));
  return { key: asset.key, rows: finalData.length };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request) {
  const querySecret = new URL(request.url).searchParams.get('secret');
  const authHeader  = request.headers.get('authorization');
  const authorized  =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Optional: run a single asset via ?asset=gold
  const assetParam  = new URL(request.url).searchParams.get('asset');
  const assetsToRun = assetParam ? ASSETS.filter(a => a.key === assetParam) : ASSETS;

  const results = [], errors = [];
  for (const asset of assetsToRun) {
    try {
      const r = await processAsset(asset);
      results.push(r);
      console.log(`[cron] ✓ ${asset.key}: ${r.rows} rows`);
    } catch (err) {
      console.error(`[cron] ✗ ${asset.key}: ${err.message}`);
      errors.push({ key: asset.key, error: err.message });
    }
  }
  return Response.json({ success: true, results, errors, updatedAt: new Date().toISOString() });
}
