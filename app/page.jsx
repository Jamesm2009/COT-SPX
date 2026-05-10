'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const ASSETS = [
  { key: 'spx',    label: 'S&P 500',      etf: 'SPY',  etfKey: 'spy',  color: '#e2e8f0' },
  { key: 'ndx',    label: 'Nasdaq 100',   etf: 'QQQ',  etfKey: 'qqq',  color: '#e2e8f0' },
  { key: 'rut',    label: 'Russell 2000', etf: 'IWM',  etfKey: 'iwm',  color: '#e2e8f0' },
  { key: 'ust10',  label: '10Y Treasury', etf: 'TLT',  etfKey: 'tlt',  color: '#e2e8f0' },
  { key: 'usd',    label: 'US Dollar',    etf: 'UUP',  etfKey: 'uup',  color: '#e2e8f0' },
  { key: 'gold',   label: 'Gold',         etf: 'GLD',  etfKey: 'gld',  color: '#e2e8f0' },
  { key: 'copper', label: 'Copper',       etf: 'CPER', etfKey: 'cper', color: '#e2e8f0' },
  { key: 'oil',    label: 'Oil (WTI)',    etf: 'USO',  etfKey: 'uso',  color: '#e2e8f0' },
];

const ACCENT = {
  spx: '#22d3ee', ndx: '#a78bfa', rut: '#34d399', ust10: '#fbbf24',
  usd: '#f472b6', gold: '#fcd34d', copper: '#fb923c', oil: '#94a3b8',
};

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload, label, asset }) {
  if (!active || !payload?.length) return null;
  const price = payload.find(p => p.dataKey === 'price');
  const z     = payload.find(p => p.dataKey === 'ctaZScore');
  const zVal  = z?.value ?? 0;
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, lineHeight: 1.8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
    }}>
      <p style={{ color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      {price && <p style={{ color: '#e2e8f0' }}>{asset?.etf}: <strong>${price.value?.toFixed(2)}</strong></p>}
      {z && (
        <p style={{ color: zVal >= 0 ? '#22c55e' : '#ef4444' }}>
          Z-Score: <strong>{zVal > 0 ? '+' : ''}{zVal?.toFixed(2)}σ</strong>
          {Math.abs(zVal) > 2 && <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 11, fontWeight: 700 }}>EXTREME</span>}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const [activeTab,     setActiveTab]     = useState('dashboard');
  const [selectedAsset, setSelectedAsset] = useState('spx');
  const [chartData,     setChartData]     = useState([]);
  const [meta,          setMeta]          = useState(null);
  const [error,         setError]         = useState(null);
  const [loading,       setLoading]       = useState(true);

  const fetchData = useCallback((assetKey) => {
    setLoading(true);
    setError(null);
    const assetDef = ASSETS.find(a => a.key === assetKey);
    fetch(`/api/data?asset=${assetKey}`)
      .then(r => r.json())
      .then(p => {
        if (p.error) {
          setError(p.error);
        } else {
          const rows = (p.data || []).map(row => ({
            ...row,
            price: row[assetDef?.etfKey] ?? row.etf_close ?? row.price ?? null,
          }));
          setChartData(rows);
          setMeta(p);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(selectedAsset); }, [selectedAsset, fetchData]);

  const asset        = ASSETS.find(a => a.key === selectedAsset);
  const accentColor  = ACCENT[selectedAsset];
  const latest       = chartData[chartData.length - 1];
  const z            = latest?.ctaZScore ?? 0;
  const zColor       = Math.abs(z) > 2 ? '#ef4444' : Math.abs(z) > 1.5 ? '#f59e0b' : '#22c55e';
  const zLabel       = Math.abs(z) > 2 ? 'EXTREME' : Math.abs(z) > 1.5 ? 'ELEVATED' : 'NORMAL';
  const extremeWeeks = chartData.filter(d => Math.abs(d.ctaZScore) > 2).length;
  const maxZ         = chartData.length ? Math.max(...chartData.map(d => d.ctaZScore)) : 0;

  const prices   = chartData.map(d => d.price).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) * 0.95 : 'auto';
  const maxPrice = prices.length ? Math.max(...prices) * 1.05 : 'auto';

  return (
    <div style={{ background: '#030712', minHeight: '100vh', color: 'white', padding: '12px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Compact header + tabs ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #1f2937',
          marginBottom: 16, paddingBottom: 8,
        }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>CTA Position Tracker</h1>
            <p style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
              Managed Money · CFTC COT · 52-Week Z-Score · 5-Week SMA
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'dashboard', label: 'Dashboard' }, { key: 'howto', label: 'How to Use' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', background: 'transparent',
                color: activeTab === tab.key ? 'white' : '#6b7280',
                borderBottom: activeTab === tab.key ? '2px solid #22d3ee' : '2px solid transparent',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <>
            {/* Asset selector */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {ASSETS.map(a => (
                <button key={a.key} onClick={() => setSelectedAsset(a.key)} style={{
                  padding: '4px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 20,
                  border: `1px solid ${selectedAsset === a.key ? ACCENT[a.key] : '#1f2937'}`,
                  background: selectedAsset === a.key ? `${ACCENT[a.key]}22` : '#111827',
                  color: selectedAsset === a.key ? ACCENT[a.key] : '#9ca3af',
                }}>
                  {a.label}
                </button>
              ))}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
                Loading {asset?.label} data…
              </div>
            )}

            {!loading && (error || !chartData.length) && (
              <div style={{ border: '1px solid #ef4444', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <p style={{ color: '#ef4444', fontWeight: 'bold' }}>{error || 'No data available'}</p>
                <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>Seed this asset via the upload tool first.</p>
              </div>
            )}

            {!loading && !error && chartData.length > 0 && (
              <>
                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }}>Current Z-Score</p>
                    <p style={{ color: zColor, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{z > 0 ? '+' : ''}{z.toFixed(2)}σ</p>
                    <p style={{ color: zColor, fontSize: 10, marginTop: 3 }}>{zLabel}</p>
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }}>{asset?.etf} Price</p>
                    <p style={{ color: accentColor, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>${latest?.price?.toFixed(2) ?? '—'}</p>
                    <p style={{ color: '#374151', fontSize: 10, marginTop: 3 }}>{latest?.date}</p>
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', marginBottom: 3 }}>3Y Max Long</p>
                    <p style={{ color: '#f97316', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>+{maxZ.toFixed(2)}σ</p>
                    <p style={{ color: '#374151', fontSize: 10, marginTop: 3 }}>{extremeWeeks} extreme weeks</p>
                  </div>
                </div>

                {/* ── Chart ── */}
                <div style={{ position: 'relative', background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: '12px 8px 8px', marginBottom: 14 }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 60, paddingRight: 60, marginBottom: 4 }}>
                    <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{asset?.label} · CTA Positioning</p>
                    <p style={{ color: '#4b5563', fontSize: 11 }}>Updated: {meta?.updatedAt ? new Date(meta.updatedAt).toDateString() : '—'}</p>
                  </div>

                  <ResponsiveContainer width="100%" height={460}>
                    <ComposedChart data={chartData} margin={{ top: 36, right: 58, left: 4, bottom: 4 }}>
                      <defs>
                        {/*
                          Domain [-3.5, +3.5]. Zero at 50% from top.
                          GREEN above zero = net long (bullish).
                          RED below zero   = net short (bearish).
                          Higher opacity so fills are visible in daylight.
                        */}
                        <linearGradient id="zGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#22c55e" stopOpacity={0.75} />
                          <stop offset="46%"  stopColor="#22c55e" stopOpacity={0.15} />
                          <stop offset="50%"  stopColor="#ef4444" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.75} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />

                      <XAxis
                        dataKey="date"
                        stroke="#1f2937"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickFormatter={formatDate}
                        minTickGap={55}
                      />

                      <YAxis
                        yAxisId="price"
                        orientation="left"
                        stroke="#1f2937"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickFormatter={v => `$${Math.round(v)}`}
                        domain={[minPrice, maxPrice]}
                        width={54}
                      />

                      <YAxis
                        yAxisId="z"
                        orientation="right"
                        stroke="#1f2937"
                        tick={{ fill: '#f97316', fontSize: 11 }}
                        tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}σ`}
                        domain={[-3.5, 3.5]}
                        ticks={[-3, -2, -1, 0, 1, 2, 3]}
                        width={50}
                      />

                      <Tooltip content={<CustomTooltip asset={asset} />} />

                      <ReferenceLine yAxisId="z" y={2}  stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: '+2σ', position: 'insideRight', fill: '#ef4444', fontSize: 10, dx: 6 }} />
                      <ReferenceLine yAxisId="z" y={-2} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: '−2σ', position: 'insideRight', fill: '#ef4444', fontSize: 10, dx: 6 }} />
                      <ReferenceLine yAxisId="z" y={0} stroke="#374151" strokeWidth={1} />

                      {/* ETF Price — thin white line */}
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="price"
                        stroke="#e2e8f0"
                        strokeWidth={1.5}
                        strokeOpacity={0.85}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                        name={`${asset?.etf} Price`}
                      />

                      {/* CTA Z-Score — area with stronger green/red fill */}
                      <Area
                        yAxisId="z"
                        type="monotone"
                        dataKey="ctaZScore"
                        stroke="#f97316"
                        strokeWidth={2.5}
                        fill="url(#zGrad)"
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                        name="CTA Z-Score"
                        baseValue={0}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* ── Legend overlaid inside chart top-left ── */}
                  <div style={{
                    position: 'absolute', top: 44, left: 68,
                    display: 'flex', gap: 16, flexWrap: 'wrap',
                    fontSize: 11, pointerEvents: 'none',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 20, height: 2, background: '#e2e8f0', opacity: 0.85 }} />
                      <span style={{ color: '#9ca3af' }}>{asset?.etf} Price</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 20, height: 2, background: '#f97316' }} />
                      <span style={{ color: '#9ca3af' }}>CTA Z-Score (5w SMA)</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 12, height: 10, background: 'rgba(34,197,94,0.5)', border: '1px solid rgba(34,197,94,0.8)', borderRadius: 2 }} />
                      <span style={{ color: '#9ca3af' }}>Net Long</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 12, height: 10, background: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.8)', borderRadius: 2 }} />
                      <span style={{ color: '#9ca3af' }}>Net Short</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed #ef4444' }} />
                      <span style={{ color: '#9ca3af' }}>±2σ</span>
                    </span>
                  </div>
                </div>

                {/* Signal legend */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: '#0d1117', border: '1px solid #14532d', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 12, marginBottom: 3 }}>Normal · |Z| &lt; 1.5σ</p>
                    <p style={{ color: '#9ca3af', fontSize: 11 }}>Positioning balanced. No crowding risk.</p>
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #78350f', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12, marginBottom: 3 }}>Elevated · 1.5σ – 2σ</p>
                    <p style={{ color: '#9ca3af', fontSize: 11 }}>Positioning stretched. Watch for exhaustion.</p>
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #7f1d1d', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 12, marginBottom: 3 }}>Extreme · |Z| &gt; 2σ</p>
                    <p style={{ color: '#9ca3af', fontSize: 11 }}>Max long/short. High liquidation risk.</p>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── HOW TO USE ── */}
        {activeTab === 'howto' && (
          <div style={{ background: '#0c1220', border: '1px solid #1e3a5f', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ color: '#22d3ee', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>How to Use This Dashboard</p>

            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Data Source</p>
            <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              Weekly CFTC Commitments of Traders (COT) report — the <span style={{ color: '#e5e7eb' }}>Traders in Financial Futures (TFF)</span> report
              for equity index, rates and currency futures; and the <span style={{ color: '#e5e7eb' }}>Disaggregated COT</span> report for commodities
              (Gold, Copper, Oil). The <span style={{ color: '#e5e7eb' }}>"Leveraged Money"</span> category is used as the CTA proxy —
              registered CTAs, commodity pool operators, and trend-following hedge funds.
            </p>

            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Methodology</p>
            <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              Net positioning (longs minus shorts) is calculated as a percentage of total open interest each week.
              A <span style={{ color: '#e5e7eb' }}>52-week rolling z-score</span> normalizes the raw position data so you can identify
              historically extreme crowding regardless of changes in market size over time. A <span style={{ color: '#e5e7eb' }}>5-week simple
              moving average</span> is then applied to reduce week-to-week noise while preserving the signal.
            </p>

            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Reading the Chart</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { color: '#e2e8f0', label: 'White line (left axis)',   text: 'ETF price for the selected asset' },
                { color: '#f97316', label: 'Orange line (right axis)', text: 'CTA positioning z-score (5-week smoothed)' },
                { color: '#22c55e', label: 'Green fill above zero',    text: 'CTAs net long — bullish positioning' },
                { color: '#ef4444', label: 'Red fill below zero',      text: 'CTAs net short — bearish positioning' },
                { color: '#ef4444', label: '±2σ dashed lines',         text: 'Extreme positioning thresholds — liquidation risk' },
                { color: '#9ca3af', label: 'Divergence',               text: 'Price rising but CTAs not adding = weakening momentum' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#111827', borderRadius: 8, padding: 12 }}>
                  <p style={{ color: item.color, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{item.label}</p>
                  <p style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>{item.text}</p>
                </div>
              ))}
            </div>

            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Assets Tracked</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'S&P 500',      detail: 'CME 13874+',  report: 'TFF' },
                { label: 'Nasdaq 100',   detail: 'CME 209742',  report: 'TFF' },
                { label: 'Russell 2000', detail: 'CME 239742',  report: 'TFF' },
                { label: '10Y Treasury', detail: 'CFTC 043602', report: 'TFF' },
                { label: 'US Dollar',    detail: 'CFTC 098662', report: 'TFF' },
                { label: 'Gold',         detail: 'CFTC 088691', report: 'Disagg' },
                { label: 'Copper',       detail: 'CFTC 085692', report: 'Disagg' },
                { label: 'Oil (WTI)',    detail: 'CFTC 067651', report: 'Disagg' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#111827', borderRadius: 8, padding: 10 }}>
                  <p style={{ color: '#e5e7eb', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.label}</p>
                  <p style={{ color: '#6b7280', fontSize: 11 }}>{item.detail}</p>
                  <p style={{ color: '#374151', fontSize: 10 }}>{item.report} Report</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ color: '#374151', fontSize: 11, textAlign: 'center', paddingBottom: 16 }}>
          For informational purposes only · Not investment advice · COT data reflects Tuesday positions published Friday
        </p>
      </div>
    </div>
  );
}
