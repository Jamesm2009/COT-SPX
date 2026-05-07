'use client';

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';

const SPX_COLOR = '#22D3EE';   // cyan
const CTA_COLOR = '#F97316';   // orange
const BAND_COLOR = '#EF4444';  // red

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function StatusBadge({ z }) {
  if (Math.abs(z) > 2)
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500">EXTREME</span>;
  if (Math.abs(z) > 1.5)
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500">ELEVATED</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500">NORMAL</span>;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isExtreme = Math.abs(d.ctaZScore) > 2;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-sm">
      <p className="text-gray-300 font-semibold mb-2">{d.date}</p>
      <p className="text-cyan-400">SPY: <span className="font-bold">${d.spy?.toFixed(2)}</span></p>
      <p className="text-orange-400">
        CTA Z-Score:{' '}
        <span className="font-bold">
          {d.ctaZScore > 0 ? '+' : ''}{d.ctaZScore?.toFixed(2)}σ
        </span>
        {isExtreme && <span className="ml-2 text-red-400 font-bold text-xs">● EXTREME</span>}
      </p>
      <p className="text-gray-500 mt-1">Net Position: {d.netPositionPct?.toFixed(1)}% of OI</p>
    </div>
  );
}

// Collapse consecutive extreme weeks into contiguous zones
function buildExtremeZones(data) {
  const zones = [];
  let inZone = false;
  let zoneStart = null;

  data.forEach((row, i) => {
    const extreme = Math.abs(row.ctaZScore) > 2;
    if (extreme && !inZone) {
      inZone = true;
      zoneStart = row.date;
    } else if (!extreme && inZone) {
      zones.push({ x1: zoneStart, x2: data[i - 1].date });
      inZone = false;
    }
  });
  if (inZone) zones.push({ x1: zoneStart, x2: data[data.length - 1].date });
  return zones;
}

export default function CTAChart({ data, updatedAt, error }) {
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-900/20 border border-red-500 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-400 font-bold text-lg mb-2">No data available</p>
          <p className="text-gray-400 text-sm">
            {error ?? 'Database is empty.'}
          </p>
          <p className="text-gray-500 text-xs mt-4">
            Seed the database by visiting:<br />
            <code className="text-orange-400">/api/cron?secret=YOUR_CRON_SECRET</code>
          </p>
        </div>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const latestZ = latest?.ctaZScore ?? 0;
  const extremeZones = buildExtremeZones(data);

  // Count extreme events
  const extremeCount = data.filter((d) => Math.abs(d.ctaZScore) > 2).length;
  const maxLong = Math.max(...data.map((d) => d.ctaZScore));
  const maxShort = Math.min(...data.map((d) => d.ctaZScore));

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="pt-6">
        <h1 className="text-2xl font-bold tracking-tight">CTA Position Tracker</h1>
        <p className="text-gray-400 text-sm mt-1">
          S&amp;P 500 Futures · Managed Money (Non-Commercial) · 52-Week Z-Score
        </p>
        <p className="text-gray-600 text-xs mt-0.5">
          Source: CFTC COT Report &nbsp;·&nbsp; Last updated: {updatedAt ? new Date(updatedAt).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
        </p>
      </div>

      {/* ── Status Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Current Z-Score</p>
          <p className={`text-2xl font-bold ${Math.abs(latestZ) > 2 ? 'text-red-400' : Math.abs(latestZ) > 1.5 ? 'text-yellow-400' : 'text-green-400'}`}>
            {latestZ > 0 ? '+' : ''}{latestZ.toFixed(2)}σ
          </p>
          <div className="mt-1"><StatusBadge z={latestZ} /></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">SPY (Latest)</p>
          <p className="text-2xl font-bold text-cyan-400">${latest?.spy?.toFixed(2)}</p>
          <p className="text-gray-500 text-xs mt-1">{latest?.date}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">3Y Max Long</p>
          <p className="text-2xl font-bold text-orange-400">+{maxLong.toFixed(2)}σ</p>
          <p className="text-gray-500 text-xs mt-1">Peak CTA exposure</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Extreme Weeks</p>
          <p className="text-2xl font-bold text-red-400">{extremeCount}</p>
          <p className="text-gray-500 text-xs mt-1">|Z| &gt; 2σ in 3 years</p>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
        {/* Legend */}
        <div className="flex flex-wrap gap-5 mb-5 text-sm">
          <span className="flex items-center gap-2">
            <span className="inline-block w-7 h-0.5 bg-cyan-400"></span>
            <span className="text-gray-400">SPY Price</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-7 h-0.5 bg-orange-500"></span>
            <span className="text-gray-400">CTA Position (Z-Score)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-7 h-0.5 border-t-2 border-dashed border-red-500"></span>
            <span className="text-gray-400">±2σ Threshold</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-gray-400">Extreme Zone</span>
          </span>
        </div>

        <ResponsiveContainer width="100%" height={460}>
          <ComposedChart data={data} margin={{ top: 8, right: 55, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />

            <XAxis
              dataKey="date"
              stroke="#374151"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickFormatter={formatDate}
              minTickGap={50}
            />

            {/* Left axis — SPY price */}
            <YAxis
              yAxisId="spy"
              orientation="left"
              stroke="#22D3EE"
              tick={{ fill: '#22D3EE', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
              width={58}
            />

            {/* Right axis — Z-score */}
            <YAxis
              yAxisId="z"
              orientation="right"
              stroke="#F97316"
              tick={{ fill: '#F97316', fontSize: 11 }}
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}σ`}
              domain={[-3.5, 3.5]}
              width={52}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Extreme zone shading (collapsed into bands) */}
            {extremeZones.map((zone, i) => (
              <ReferenceArea
                key={i}
                yAxisId="z"
                x1={zone.x1}
                x2={zone.x2}
                fill={BAND_COLOR}
                fillOpacity={0.12}
                stroke={BAND_COLOR}
                strokeOpacity={0.3}
              />
            ))}

            {/* ±2σ threshold lines */}
            <ReferenceLine
              yAxisId="z"
              y={2}
              stroke={BAND_COLOR}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: '+2σ', position: 'right', fill: BAND_COLOR, fontSize: 11 }}
            />
            <ReferenceLine
              yAxisId="z"
              y={-2}
              stroke={BAND_COLOR}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: '−2σ', position: 'right', fill: BAND_COLOR, fontSize: 11 }}
            />

            {/* Zero line */}
            <ReferenceLine
              yAxisId="z"
              y={0}
              stroke="#374151"
              strokeDasharray="2 4"
            />

            {/* SPY price line */}
            <Line
              yAxisId="spy"
              type="monotone"
              dataKey="spy"
              stroke={SPX_COLOR}
              strokeWidth={2}
              dot={false}
              name="SPY"
              isAnimationActive={false}
            />

            {/* CTA z-score line with extreme dot markers */}
            <Line
              yAxisId="z"
              type="monotone"
              dataKey="ctaZScore"
              stroke={CTA_COLOR}
              strokeWidth={2}
              name="CTA Z-Score"
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (Math.abs(payload.ctaZScore) > 2) {
                  return (
                    <circle
                      key={`dot-${payload.date}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={BAND_COLOR}
                      stroke="#fca5a5"
                      strokeWidth={1.5}
                    />
                  );
                }
                return null;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Interpretation Guide ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-green-800 rounded-xl p-4">
          <p className="text-green-400 font-semibold text-sm mb-1">Normal · |Z| &lt; 1.5σ</p>
          <p className="text-gray-400 text-xs">Positioning is balanced. No crowding risk in either direction.</p>
        </div>
        <div className="bg-gray-900 border border-yellow-800 rounded-xl p-4">
          <p className="text-yellow-400 font-semibold text-sm mb-1">Elevated · 1.5σ – 2σ</p>
          <p className="text-gray-400 text-xs">Positioning is stretched. Watch for trend exhaustion or volatility.</p>
        </div>
        <div className="bg-gray-900 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Extreme · |Z| &gt; 2σ</p>
          <p className="text-gray-400 text-xs">CTAs are max long/short. High risk of forced liquidation and sharp reversal.</p>
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────────────── */}
      <div className="bg-blue-900/10 border border-blue-900 rounded-xl p-4 text-xs text-gray-400 space-y-1">
        <p><span className="text-blue-400 font-semibold">Data:</span> CFTC COT Legacy Report · Non-Commercial (Managed Money proxy) · E-mini S&amp;P 500 (CME: 13874+)</p>
        <p><span className="text-blue-400 font-semibold">Methodology:</span> Net position (longs − shorts) as % of open interest · 52-week rolling z-score</p>
        <p><span className="text-blue-400 font-semibold">Lag:</span> COT data reflects Tuesday positions, published Friday. CTAs typically lag price by 3–8 weeks (trend-following behavior).</p>
        <p><span className="text-blue-400 font-semibold">Update schedule:</span> Automatic every Friday at 10 PM UTC via Vercel Cron.</p>
      </div>

      <p className="text-center text-gray-700 text-xs pb-6">
        For informational purposes only · Not investment advice
      </p>
    </div>
  );
}
