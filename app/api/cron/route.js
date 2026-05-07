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
    // ── 1. Fetch COT data ─────────────────────────────────────────────────────
    // Use URLSearchParams to avoid encoding issues
    const params = new URLSearchParams({
      '$where': "contract_market_name like '%S&P 500%' AND report_date_as_yyyy_mm_dd >= '2021-01-01'",
      '$order': 'report_date_as_yyyy_mm_dd ASC',
      '$limit': '400',
      '$select': 'report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all,contract_market_name,cftc_contract_market_code',
    });

    const cotUrl = `https://publicreporting.cftc.gov/resource/jun7-fc8e.json?${params}`;
    console.log('[cron] Fetching:', cotUrl);

    const cotRes = await fetch(cotUrl, { cache: 'no-store' });
    if (!cotRes.ok) throw new Error(`CFTC API error: ${cotRes.status} ${await cotRes.text()}`);
    const cotRaw = await cotRes.json();
    console.log('[cron] Total rows returned:', cotRaw.length);

    if (!cotRaw.length) {
      throw new Error('No COT data returned from CFTC API. URL was: ' + cotUrl);
    }

    // Log unique contract names to find the right one
    const contracts = [...new Set(cotRaw.map(r => `${r.cftc_contract_market_code}: ${r.contract_market_name}`))];
    console.log('[cron] Contracts found:', contracts);

    // Filter to consolidated S&P 500 (code 13874+) or E-mini (13874A)
    // Pick whichever has the most rows
    const consolidated = cotRaw.filter(r => r.cftc_contract_market_code === '13874+');
    const emini = cotRaw.filter(r => r.cftc_contract_market_code === '13874A');
    const cotFiltered = consolidated.length >= emini.length ? consolidated : emini;

    console.log('[cron] Consolidated rows:', consolidated.length, '| E-mini rows:', emini.length);

    if (!cotFiltered.length) {
      throw new Error(`No matching S&P 500 contract found. Available: ${contracts.join(', ')}`);
    }

    // ── 2. Fetch SPY weekly prices ────────────────────────────────────────────
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 4 * 365 * 24 * 60 * 60;

    const spyRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=${startTs}&period2=${endTs}&interval=1wk`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        cache: 'no-store',
      }
    );
    if (!spyRes.ok) throw new Error(`Yahoo Finance error: ${spyRes.status}`);
    const spyJson = await spyRes.json();
    const spyResult = spyJson.chart.result[0];

    const spyMap = {};
    spyResult.timestamp.forEach((ts, i) => {
      const price = spyResult.indicators.quote[0].close[i];
      if (price) spyMap[new Date(ts * 1000).toISOString().split('T')[0]] = price;
    });

    // ── 3. Process COT → z-score ──────────────────────────────────────────────
    const cotProcessed = cotFiltered
      .map((row) => ({
        date: row.report_date_as_yyyy_mm_dd,
        netPositionPct:
          ((parseFloat(row.noncomm_positions_long_all ?? 0) -
            parseFloat(row.noncomm_positions_short_all ?? 0)) /
            parseFloat(row.open_interest_all ?? 1)) * 100,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const netPcts = cotProcessed.map((d) => d.netPositionPct);
    const withZ = cotProcessed.map((row, i) => ({
      ...row,
      zScore: calculateZScore(netPcts, i, 52),
    }));

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

    if (!finalData.length) throw new Error('No matched data after SPY alignment');

    // ── 4. Store in Upstash ───────────────────────────────────────────────────
    const payload = { updatedAt: new Date().toISOString(), rows: finalData.length, data: finalData };
    await redis.set('cta_tracker_data', JSON.stringify(payload));

    return Response.json({ success: true, rows: finalData.length, updatedAt: payload.updatedAt });
  } catch (err) {
    console.error('[cron] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
