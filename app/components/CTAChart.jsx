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
} from 'recharts';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: 12, fontSize: 13 }}>
      <p style={{ color: '#d1d5db', marginBottom: 6 }}>{d.date}</p>
      <p style={{ color: '#22d3ee' }}>SPY: ${d.spy?.toFixed(2)}</p>
      <p style={{ color: '#f97316' }}>
        CTA Z-Score: {d.ctaZScore > 0 ? '+' : ''}{d.ctaZScore?.toFixed(2)}σ
        {Math.abs(d.ctaZScore) > 2 && <span style={{ color: '#ef4444', marginLeft: 8 }}>EXTREME</span>}
      </p>
      <p style={{ color: '#6b7280', marginTop: 4 }}>Net Position: {d.netPositionPct?.toFixed(1)}% of OI</p>
    </div>
  );
}

export default function CTAChart() {
  const [chartData, setChartData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) {
          setError(payload.error);
        } else {
          setChartData(payload.data || []);
          setMeta({ updatedAt: payload.updatedAt, rows: payload.rows });
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <p style={{ color: '#9ca3af' }}>Loading CTA data...</p>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ background: '#1f1515', border: '1px solid #ef4444', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 8 }}>No data available</p>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>{error}</p>
          <p style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>
            Seed the database by visiting:<br />
            <code style={{ color: '#f97316' }}>/api/cron?secret=YOUR_CRON_SECRET</code>
          </p>
        </div>
      </div>
    );
  }

  const latest = chartData[chartData.length - 1];
  const latestZ = latest?.ctaZScore ?? 0;
  const statusColor = Math.abs(latestZ) > 2 ? '#ef4444' : Math.abs(latestZ) > 1.5 ? '#f59e0b' : '#22c55e';
  const statusLabel = Math.abs(latestZ) > 2 ? 'EXTREME' : Math.abs(latestZ) > 1.5 ? 'ELEVATED' : 'NORMAL';
  const maxLong = Math.max(...chartData.map((d) => d.ctaZScore));
  const extremeCount = chartData.filter((d) => Math.abs(d.ctaZScore) > 2).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>CTA Position Tracker</h1>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>S&P 500 Futures · Managed Money · 52-Week Z-Score</p>
      <p style={{ color: '#4b5563', fontSize: 12, marginBottom: 24 }}>
        Source: CFTC COT Report · Updated: {meta?.updatedAt ? new Date(meta.updatedAt).toDateString() : '—'}
      </p>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Current Z-Score', value: `${latestZ > 0 ? '+' : ''}${latestZ.toFixed(2)}σ`, sub: statusLabel, color: statusColor },
          { label: 'SPY Latest', value: `$${latest?.spy?.toFixed(2)}`, sub: latest?.date, color: '#22d3ee' },
          { label: '3Y Max Long', value: `+${maxLong.toFixed(2)}σ`, sub: `${extremeCount} extreme weeks`, color: '#f97316' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
            <p style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</p>
            <p style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={440}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 50, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatDate} minTickGap={50} />
            <YAxis yAxisId="spy" orientation="left" stroke="#22d3ee" tick={{ fill: '#22d3ee', fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={56} />
            <YAxis yAxisId="z" orientation="right" stroke="#f97316" tick={{ fill: '#f97316', fontSize: 11 }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}σ`} domain={[-3.5, 3.5]} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="z" y={2} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: '+2σ', position: 'right', fill: '#ef4444', fontSize: 11 }} />
            <ReferenceLine yAxisId="z" y={-2} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: '−2σ', position: 'right', fill: '#ef4444', fontSize: 11 }} />
            <ReferenceLine yAxisId="z" y={0} stroke="#374151" strokeDasharray="2 4" />
            <Line yAxisId="spy" type="monotone" dataKey="spy" stroke="#22d3ee" strokeWidth={2} dot={false} name="SPY" isAnimationActive={false} />
            <Line yAxisId="z" type="monotone" dataKey="ctaZScore" stroke="#f97316" strokeWidth={2} dot={false} name="CTA Z-Score" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { color: '#22c55e', border: '#14532d', label: 'Normal · |Z| < 1.5σ', text: 'Positioning is balanced. No crowding risk.' },
          { color: '#f59e0b', border: '#78350f', label: 'Elevated · 1.5σ – 2σ', text: 'Positioning stretched. Watch for exhaustion.' },
          { color: '#ef4444', border: '#7f1d1d', label: 'Extreme · |Z| > 2σ', text: 'Max long/short. High forced liquidation risk.' },
        ].map((g) => (
          <div key={g.label} style={{ background: '#111827', border: `1px solid ${g.border}`, borderRadius: 12, padding: 16 }}>
            <p style={{ color: g.color, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{g.label}</p>
            <p style={{ color: '#9ca3af', fontSize: 12 }}>{g.text}</p>
          </div>
        ))}
      </div>

      <p style={{ color: '#374151', fontSize: 11, textAlign: 'center', paddingBottom: 24 }}>
        For informational purposes only · Not investment advice · COT data reflects Tuesday positions published Friday
      </p>
    </div>
  );
}
