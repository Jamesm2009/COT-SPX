'use client';
import { useEffect, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export default function Home() {
  const [chartData, setChartData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(p => { if (p.error) { setError(p.error); } else { setChartData(p.data || []); setMeta(p); } setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#030712'}}><p style={{color:'#9ca3af'}}>Loading...</p></div>;
  if (error || !chartData.length) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#030712'}}><div style={{border:'1px solid #ef4444',borderRadius:12,padding:32,textAlign:'center'}}><p style={{color:'#ef4444',fontWeight:'bold'}}>{error || 'No data'}</p><p style={{color:'#6b7280',fontSize:12,marginTop:12}}>Visit /api/cron?secret=YOUR_CRON_SECRET to seed data</p></div></div>;

  const latest = chartData[chartData.length - 1];
  const z = latest?.ctaZScore ?? 0;
  const zColor = Math.abs(z) > 2 ? '#ef4444' : Math.abs(z) > 1.5 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{background:'#030712',minHeight:'100vh',color:'white',padding:'24px 16px'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>CTA Position Tracker</h1>
        <p style={{color:'#9ca3af',fontSize:13,marginBottom:20}}>S&P 500 Futures · Managed Money · 52-Week Z-Score · Updated: {meta?.updatedAt ? new Date(meta.updatedAt).toDateString() : '—'}</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}><p style={{color:'#6b7280',fontSize:11,marginBottom:4}}>CURRENT Z-SCORE</p><p style={{color:zColor,fontSize:22,fontWeight:700}}>{z > 0 ? '+' : ''}{z.toFixed(2)}σ</p></div>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}><p style={{color:'#6b7280',fontSize:11,marginBottom:4}}>SPY LATEST</p><p style={{color:'#22d3ee',fontSize:22,fontWeight:700}}>${latest?.spy?.toFixed(2)}</p></div>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}><p style={{color:'#6b7280',fontSize:11,marginBottom:4}}>EXTREME WEEKS</p><p style={{color:'#f97316',fontSize:22,fontWeight:700}}>{chartData.filter(d => Math.abs(d.ctaZScore) > 2).length}</p></div>
        </div>
        <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:20}}>
          <ResponsiveContainer width="100%" height={440}>
            <ComposedChart data={chartData} margin={{top:8,right:50,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#374151" tick={{fill:'#6b7280',fontSize:11}} tickFormatter={formatDate} minTickGap={50} />
              <YAxis yAxisId="spy" orientation="left" stroke="#22d3ee" tick={{fill:'#22d3ee',fontSize:11}} tickFormatter={v => `$${v}`} width={56} domain={['auto', 'auto']} />
              <YAxis yAxisId="z" orientation="right" stroke="#f97316" tick={{fill:'#f97316',fontSize:11}} tickFormatter={v => `${v>0?'+':''}${v.toFixed(1)}σ`} domain={[-3.5,3.5]} width={50} />
              <Tooltip />
              <ReferenceLine yAxisId="z" y={2} stroke="#ef4444" strokeDasharray="4 3" label={{value:'+2σ',position:'right',fill:'#ef4444',fontSize:11}} />
              <ReferenceLine yAxisId="z" y={-2} stroke="#ef4444" strokeDasharray="4 3" label={{value:'−2σ',position:'right',fill:'#ef4444',fontSize:11}} />
              <ReferenceLine yAxisId="z" y={0} stroke="#374151" strokeDasharray="2 4" />
              <Line yAxisId="spy" type="monotone" dataKey="spy" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="z" type="monotone" dataKey="ctaZScore" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

