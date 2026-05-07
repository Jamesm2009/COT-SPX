import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function calculateZScore(values, index, windowSize = 52) {
  if (index < windowSize) return null;
  const window = values.slice(index - windowSize, index);
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance = window.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / window.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (values[index] - mean) / std;
}

function nearestSPY(targetDate, spyMap) {
  const target = new Date(targetDate).getTime();
  const fourDays = 4 * 24 * 60 * 60 * 1000;
  let best = null;
  let bestDiff = Infinity;
  for (const [date, price] of Object.entries(spyMap)) {
    const diff = Math.abs(new Date(date).getTime() - target);
    if (diff < bestDiff && diff <= fourDays) {
      bestDiff = diff;
      best = price;
    }
  }
  return best;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const querySecret = new URL(request.url).searchParams.get('secret');
  const authorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;

  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── 1. Fetch COT data using $where syntax (more reliable than $query) ────
    // Using the Legacy Combined dataset (jun7-fc8e)
    // Contract code 13874+ is the CME S&P 500 Consolidated (e-mini + standard + micro)
    const cotUrl =
      `https://publicreporting.cftc.gov/resource/jun7-fc8e.json` +
      `?$where=cftc_contract_market_code=%2713874%2B%27` +
      `%20AND%20report_date_as_yyyy_mm_dd%20%3E=%20%272021-01-01%27` +
      `&$order=report_date_as_yyyy_mm_dd%20ASC` +
      `&$limit=400` +
      `&$select=report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all`;

    console.log('[cron] Fetching COT data from:', cotUrl);
    const cotRes = await fetch(cotUrl, { cache: 'no-store' });
    if (!cotRes.ok) throw new Error(`CFTC API error: ${cotRes.status}`);
    const cotRaw = await cotRes.json();
    console.log('[cron] COT rows returned:', cotRaw.length);

    if (!cotRaw.length) {
      // Try fallback with market_and_exchange_names
      const fallbackUrl =
        `https://publicreporting.cftc.gov/resource/jun7-fc8e.json` +
        `?$where=market_and_exchange_names%20like%20%27%25S%26P%20500%20STOCK%25%27` +
        `%20AND%20report_date_as_yyyy_mm_dd%20%3E=%20%272021-01-01%27` +
        `&$order=report_date_as_yyyy_mm_dd%20ASC` +
        `&$limit=400` +
        `&$select=report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all,market_and_exchange_names,cftc_contract_market_code`;

      console.log('[cron] Trying fallback URL:', fallbackUrl);
      const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store' });
      const fallbackData = await fallbackRes.json();
      console.log('[cron] Fallback rows:', fallbackData.length);
      console.log('[cron] Fallback sample:', JSON.stringify(fallbackData.slice(0, 2)));

      throw new Error(`No COT data returned. Fallback found ${fallbackData.length} rows. Sample: ${JSON.stringify(fallbackData.slice(0,1))}`);
    }

    // ── 2. Fetch SPY weekly prices ────────────────────────────────────────────
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 4 * 365 * 24 * 60 * 60;
    const spyUrl =
      `https://query1.finance.yahoo.com/v8/finance/chart/SPY` +
      `?period1=${startTs}&period2=${endTs}&interval=1wk`;

    const spyRes = await fetch(spyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!spyRes.ok) throw new Error(`Yahoo Finance error: ${spyRes.status}`);
    const spyJson = await spyRes.json();
    const spyResult = spyJson.chart.result[0];

    const spyMap = {};
    spyResult.timestamp.forEach((ts, i) => {
      const price = spyResult.indicators.quote[0].close[i];
      if (price) {
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        spyMap[date] = price;
      }
    });

    // ── 3. Process COT ────────────────────────────────────────────────────────
    const cotProcessed = cotRaw
      .map((row) => {
        const longs = parseFloat(row.noncomm_positions_long_all ?? 0);
        const shorts = parseFloat(row.noncomm_positions_short_all ?? 0);
        const oi = parseFloat(row.open_interest_all ?? 1);
        return {
          date: row.report_date_as_yyyy_mm_dd,
          netPositionPct: ((longs - shorts) / oi) * 100,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── 4. Z-score ────────────────────────────────────────────────────────────
    const netPcts = cotProcessed.map((d) => d.netPositionPct);
    const withZ = cotProcessed.map((row, i) => ({
      ...row,
      zScore: calculateZScore(netPcts, i, 52),
    }));

    // ── 5. Filter to 3 years + match SPY ─────────────────────────────────────
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 3);

    const finalData = withZ
      .filter((row) => row.zScore !== null && new Date(row.date) >= cutoff)
      .map((row) => ({
        date: row.date,
        spy: nearestSPY(row.date, spyMap),
        ctaZScore: parseFloat(row.zScore.toFixed(3)),
        netPositionPct: parseFloat(row.netPositionPct.toFixed(2)),
      }))
      .filter((row) => row.spy !== null);

    if (!finalData.length) throw new Error('No matched data after alignment');

    // ── 6. Store in Upstash ───────────────────────────────────────────────────
    const payload = {
      updatedAt: new Date().toISOString(),
      rows: finalData.length,
      data: finalData,
    };
    await redis.set('cta_tracker_data', JSON.stringify(payload));

    return Response.json({ success: true, rows: finalData.length, updatedAt: payload.updatedAt });
  } catch (err) {
    console.error('[cron] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
