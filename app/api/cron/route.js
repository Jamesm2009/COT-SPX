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

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
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
    // ── 1. Fetch COT data via CFTC CSV download (more reliable than API) ──────
    // This is the annual CSV file for financial futures (Legacy report)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    
    let allRows = [];
    
    for (const year of years) {
      try {
        const csvUrl = `https://www.cftc.gov/files/dea/history/fin_fut_txt_${year}.zip`;
        // Use the text file version instead
        const txtUrl = `https://www.cftc.gov/files/dea/history/financial_lf_txt_${year}.zip`;
        
        // Try the Socrata CSV export which is more accessible
        const socrataUrl = `https://publicreporting.cftc.gov/api/views/jun7-fc8e/rows.csv?accessType=DOWNLOAD&bom=true&$where=report_date_as_yyyy_mm_dd>='${year}-01-01' AND report_date_as_yyyy_mm_dd<='${year}-12-31'`;
        
        const res = await fetch(socrataUrl, { cache: 'no-store' });
        if (!res.ok) continue;
        
        const text = await res.text();
        const rows = parseCSV(text);
        
        // Filter for S&P 500 contracts
        const sp500 = rows.filter(r => 
          (r['Market_and_Exchange_Names'] || r['market_and_exchange_names'] || '').includes('S&P 500') ||
          (r['CFTC_Contract_Market_Code'] || r['cftc_contract_market_code'] || '').includes('13874')
        );
        
        allRows = allRows.concat(sp500);
      } catch (e) {
        console.log(`[cron] Year ${year} failed:`, e.message);
      }
    }

    console.log('[cron] Total SP500 rows found:', allRows.length);
    
    if (!allRows.length) {
      // Last resort: try direct Socrata JSON with minimal filtering
      const fallbackUrl = `https://publicreporting.cftc.gov/resource/jun7-fc8e.json?$limit=5`;
      const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store' });
      const fallbackData = await fallbackRes.json();
      const fields = fallbackData.length ? Object.keys(fallbackData[0]) : [];
      const sample = fallbackData[0] || {};
      throw new Error(`No data found. API fields available: ${fields.join(', ')}. Sample market name: ${sample.market_and_exchange_names || sample.Market_and_Exchange_Names || 'unknown'}`);
    }

    // Normalize field names
    const cotProcessed = allRows
      .map(row => {
        const date = row['Report_Date_as_YYYY_MM_DD'] || row['report_date_as_yyyy_mm_dd'] || '';
        const longs = parseFloat(row['NonComm_Positions_Long_All'] || row['noncomm_positions_long_all'] || 0);
        const shorts = parseFloat(row['NonComm_Positions_Short_All'] || row['noncomm_positions_short_all'] || 0);
        const oi = parseFloat(row['Open_Interest_All'] || row['open_interest_all'] || 1);
        return { date, netPositionPct: ((longs - shorts) / oi) * 100 };
      })
      .filter(r => r.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Deduplicate by date (keep last)
    const seen = new Map();
    cotProcessed.forEach(r => seen.set(r.date, r));
    const cotDeduped = Array.from(seen.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── 2. Fetch SPY weekly prices ────────────────────────────────────────────
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 4 * 365 * 24 * 60 * 60;
    const spyRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/SPY?period1=${startTs}&period2=${endTs}&interval=1wk`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' }
    );
    if (!spyRes.ok) throw new Error(`Yahoo Finance error: ${spyRes.status}`);
    const spyJson = await spyRes.json();
    const spyResult = spyJson.chart.result[0];

    const spyMap = {};
    spyResult.timestamp.forEach((ts, i) => {
      const price = spyResult.indicators.quote[0].close[i];
      if (price) spyMap[new Date(ts * 1000).toISOString().split('T')[0]] = price;
    });

    // ── 3. Z-score + filter to 3 years ───────────────────────────────────────
    const netPcts = cotDeduped.map(d => d.netPositionPct);
    const withZ = cotDeduped.map((row, i) => ({ ...row, zScore: calculateZScore(netPcts, i, 52) }));

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 3);

    const finalData = withZ
      .filter(row => row.zScore !== null && new Date(row.date) >= cutoff)
      .map(row => ({
        date: row.date,
        spy: nearestSPY(row.date, spyMap),
        ctaZScore: parseFloat(row.zScore.toFixed(3)),
        netPositionPct: parseFloat(row.netPositionPct.toFixed(2)),
      }))
      .filter(row => row.spy !== null);

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

