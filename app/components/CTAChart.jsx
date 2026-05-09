'use client';

import { useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      lineHeight: 1.7,
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    }}>
      <p style={{ color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>{d.date}</p>
      <p style={{ color: '#58a6ff' }}>SPY: <strong>${d.spy?.toFixed(2)}</strong></p>
      <p style={{ color: '#f97316' }}>
        Z-Score: <strong>{d.ctaZScore > 0 ? '+' : ''}{d.ctaZScore?.toFixed(2)}σ</strong>
        {Math.abs(d.ctaZScore) > 2 && (
          <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 11, fontWeight: 700 }}>EXTREME</span>
        )}
      </p>
      <p style={{ color: '#6b7280', fontSize: 11 }}>Net: {d.netPositionPct?.toFixed(1)}% OI</p>
    </div>
  );
}

const ASSET_LABELS = {
  spx: { label: 'S&P 500', etfKey: 'spy',    etfLabel: 'SPY' },
  ndx: { label: 'Nasdaq',  etfKey: 'qqq',    etfLabel: 'QQQ' },
  rut: { label: 'Russell', etfKey: 'iwm',    etfLabel: 'IWM' },
  ust10: { label: '10Y UST', etfKey: 'tlt',  etfLabel: 'TLT' },
  usd:  { label: 'USD',    etfKey: 'uup',    etfLabel: 'UUP' },
  gold: { label: 'Gold',   etfKey: 'gld',    etfLabel: 'GLD' },
  copper: { label: 'Copper', etfKey: 'cper',  etfLabel: 'CPER' },
  oil:  { label: 'Oil',    etfKey: 'uso',    etfLabel: 'USO' },
};

const VALID_ASSETS = ['spx', 'ndx', 'rut', 'ust10', 'usd', 'gold', 'copper', 'oil'];

export default function CTAChart() {
  const [asset, setAsset]         = useState('spy');
  const [chartData, setChartData] = useState([]);
  const [meta, setMeta]           = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/data?asset=${asset}`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) {
          setError(payload.error);
        } else {
          // Normalise ETF price to the generic key 'etfPrice' so chart always works
          const rows = (payload.data || []).map((row) => ({
            ...row,
            etfPrice: row[ASSET_LABELS[asset]?.etfKey] ?? row.etf_close ?? null,
          }));
          setChartData(rows);
          setMeta({ updatedAt: payload.updatedAt, rows: payload.rows });
        }
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [asset]);

  const assetInfo  = ASSET_LABELS[asset];
  const latest     = chartData[chartData.length - 1];
  const latestZ    = latest?.ctaZScore ?? 0;
  const latestPx   = latest?.etfPrice  ?? 0;
  const extremeCount = chartData.filter((d) => Math.abs(d.ctaZScore) > 2).length;

  const statusColor = Math.abs(latestZ) > 2 ? '#ef4444'
                    : Math.abs(latestZ) > 1.5 ? '#f59e0b'
                    : '#22c55e';
  const statusLabel = Math.abs(latestZ) > 2 ? 'EXTREME'
                    : Math.abs(latestZ) > 1.5 ? 'ELEVATED'
                    : 'NORMAL';

  // Dynamic Y domain for ETF price — add 5% padding
  const prices   = chartData.map((d) => d.etfPrice).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) * 0.95 : 'auto';
  const maxPrice = prices.length ? Math.max(...prices) * 1.05 : 'auto';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Loading {assetInfo?.label} data…</p>
    </div>
  );

  if (error || !chartData.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ background: '#1f1515', border: '1px solid #ef4444', borderRadius: 12, padding: 28, maxWidth: 380, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>No data available</p>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '16px 16px 24px' }}>

      {/* ── Compact header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
            CTA Position Tracker
          </h1>
          <p style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
            CFTC COT · Managed Money Net · Z-Score &nbsp;·&nbsp;
            {meta?.updatedAt ? `Updated ${new Date(meta.updatedAt).toDateString()}` : ''}
          </p>
        </div>

        {/* Asset selector */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VALID_ASSETS.map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: a === asset ? '#6366f1' : '#1e293b',
                color:      a === asset ? '#fff'    : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {ASSET_LABELS[a].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Compact stat bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Z-Score', value: `${latestZ > 0 ? '+' : ''}${latestZ.toFixed(2)}σ`, sub: statusLabel, color: statusColor },
          { label: assetInfo.etfLabel, value: `$${latestPx.toFixed(2)}`, sub: latest?.date, color: '#58a6ff' },
          { label: 'Extreme Weeks', value: extremeCount, sub: '|Z| > 2σ', color: '#f97316' },
          { label: 'Net % OI', value: `${latest?.netPositionPct?.toFixed(1)}%`, sub: 'vs open interest', color: '#a78bfa' },
        ].map((s) => (
          <div key={s.label} style={{
            flex: '1 1 120px',
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 8,
            padding: '8px 12px',
          }}>
            <p style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
            <p style={{ color: '#374151', fontSize: 10, marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: '16px 8px 8px' }}>
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 60, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />

            <XAxis
              dataKey="date"
              stroke="#21262d"
              tick={{ fill: '#4b5563', fontSize: 11 }}
              tickFormatter={formatDate}
              minTickGap={60}
            />

            {/* Left axis: ETF price */}
            <YAxis
              yAxisId="price"
              orientation="left"
              stroke="#58a6ff"
              tick={{ fill: '#58a6ff', fontSize: 11 }}
              tickFormatter={(v) => `$${Math.round(v)}`}
              domain={[minPrice, maxPrice]}
              width={58}
            />

            {/* Right axis: Z-score */}
            <YAxis
              yAxisId="z"
              orientation="right"
              stroke="#f97316"
              tick={{ fill: '#f97316', fontSize: 11 }}
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}σ`}
              domain={[-3.5, 3.5]}
              ticks={[-3, -2, -1, 0, 1, 2, 3]}
              width={52}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine yAxisId="z" y={2}  stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: '+2σ', position: 'right', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine yAxisId="z" y={-2} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: '−2σ', position: 'right', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine yAxisId="z" y={0}  stroke="#21262d" strokeDasharray="2 4" />

            {/* ETF Price line */}
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="etfPrice"
              stroke="#58a6ff"
              strokeWidth={1.5}
              dot={false}
              name={`${assetInfo.etfLabel} Price`}
              isAnimationActive={false}
              connectNulls
            />

            {/* CTA Z-Score line */}
            <Line
              yAxisId="z"
              type="monotone"
              dataKey="ctaZScore"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="CTA Z-Score"
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Signal guide — compact single row ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { color: '#22c55e', label: 'Normal  |Z| < 1.5σ', text: 'Balanced positioning' },
          { color: '#f59e0b', label: 'Elevated  1.5–2σ',   text: 'Positioning stretched' },
          { color: '#ef4444', label: 'Extreme  |Z| > 2σ',  text: 'Max long/short — liquidation risk' },
        ].map((g) => (
          <div key={g.label} style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: 8, background: '#111827', borderRadius: 6, padding: '6px 10px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
            <div>
              <span style={{ color: g.color, fontSize: 11, fontWeight: 600 }}>{g.label}</span>
              <span style={{ color: '#374151', fontSize: 11 }}> · {g.text}</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: '#21262d', fontSize: 10, textAlign: 'center', marginTop: 10 }}>
        For informational purposes only · Not investment advice · COT data reflects Tuesday positions published Friday
      </p>
    </div>
  );
}
