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
      .then(p => {
        if (p.error) { setError(p.error); } 
        else { setChartData(p.data || []); setMeta(p); }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#030712'}}>
        <p style={{color:'#9ca3af'}}>Loading CTA data...</p>
      </div>
    );
  }

  if (error || !chartData.length) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#030712'}}>
        <div style={{border:'1px solid #ef4444',borderRadius:12,padding:32,textAlign:'center',maxWidth:400}}>
          <p style={{color:'#ef4444',fontWeight:'bold',marginBottom:8}}>{error || 'No data available'}</p>
          <p style={{color:'#6b7280',fontSize:12,marginTop:12}}>
            Visit /api/cron?secret=YOUR_CRON_SECRET to seed data
          </p>
        </div>
      </div>
    );
  }

  const latest = chartData[chartData.length - 1];
  const z = latest?.ctaZScore ?? 0;
  const zColor = Math.abs(z) > 2 ? '#ef4444' : Math.abs(z) > 1.5 ? '#f59e0b' : '#22c55e';
  const zLabel = Math.abs(z) > 2 ? 'EXTREME' : Math.abs(z) > 1.5 ? 'ELEVATED' : 'NORMAL';
  const extremeWeeks = chartData.filter(d => Math.abs(d.ctaZScore) > 2).length;
  const maxLong = Math.max(...chartData.map(d => d.ctaZScore));

  return (
    <div style={{background:'#030712',minHeight:'100vh',color:'white',padding:'24px 16px'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>

        <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>CTA Position Tracker</h1>
        <p style={{color:'#9ca3af',fontSize:13,marginBottom:4}}>S&P 500 Futures · Managed Money · 52-Week Z-Score</p>
        <p style={{color:'#4b5563',fontSize:12,marginBottom:24}}>
          Source: CFTC COT Report · Updated: {meta?.updatedAt ? new Date(meta.updatedAt).toDateString() : '—'}
        </p>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}>
            <p style={{color:'#6b7280',fontSize:11,textTransform:'uppercase',marginBottom:4}}>Current Z-Score</p>
            <p style={{color:zColor,fontSize:22,fontWeight:700}}>{z > 0 ? '+' : ''}{z.toFixed(2)}σ</p>
            <p style={{color:zColor,fontSize:11,marginTop:2}}>{zLabel}</p>
          </div>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}>
            <p style={{color:'#6b7280',fontSize:11,textTransform:'uppercase',marginBottom:4}}>SPY Latest</p>
            <p style={{color:'#22d3ee',fontSize:22,fontWeight:700}}>${latest?.spy?.toFixed(2)}</p>
            <p style={{color:'#4b5563',fontSize:11,marginTop:2}}>{latest?.date}</p>
          </div>
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:16}}>
            <p style={{color:'#6b7280',fontSize:11,textTransform:'uppercase',marginBottom:4}}>3Y Max Long</p>
            <p style={{color:'#f97316',fontSize:22,fontWeight:700}}>+{maxLong.toFixed(2)}σ</p>
            <p style={{color:'#4b5563',fontSize:11,marginTop:2}}>{extremeWeeks} extreme weeks</p>
          </div>
        </div>

        <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:12,padding:20,marginBottom:24}}>
          <div style={{display:'flex',gap:24,marginBottom:16,fontSize:13}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{display:'inline-block',width:28,height:2,background:'#22d3ee'}}></span>
              <span style={{color:'#9ca3af'}}>SPY Price</span>
            </span>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{display:'inline-block',width:28,height:2,background:'#f97316'}}></span>
              <span style={{color:'#9ca3af'}}>CTA Z-Score</span>
            </span>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{display:'inline-block',width:28,height:2,borderTop:'2px dashed #ef4444'}}></span>
              <span style={{color:'#9ca3af'}}>±2σ Threshold</span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={440}>
            <ComposedChart data={chartData} margin={{top:8,right:50,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#374151" tick={{fill:'#6b7280',fontSize:11}} tickFormatter={formatDate} minTickGap={50} />
              <YAxis yAxisId="spy" orientation="left" stroke="#22d3ee" tick={{fill:'#22d3ee',fontSize:11}} tickFormatter={v => `$${v}`} width={56} />
              <YAxis yAxisId="z" orientation="right" stroke="#f97316" tick={{fill:'#f97316',fontSize:11}} tickFormatter={v => `${v>0?'+':''}${v.toFixed(1)}σ`} domain={[-3.5,3.5]} width={50} />
              <Tooltip />
              <ReferenceLine yAxisId="z" y={2} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{value:'+2σ',position:'right',fill:'#ef4444',fontSize:11}} />
              <ReferenceLine yAxisId="z" y={-2} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{value:'−2σ',position:'right',fill:'#ef4444',fontSize:11}} />
              <ReferenceLine yAxisId="z" y={0} stroke="#374151" strokeDasharray="2 4" />
              <Line yAxisId="spy" type="monotone" dataKey="spy" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} name="SPY" />
              <Line yAxisId="z" type="monotone" dataKey="ctaZScore" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} name="CTA Z-Score" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
          <div style={{background:'#111827',border:'1px solid #14532d',borderRadius:12,padding:16}}>
            <p style={{color:'#22c55e',fontWeight:600,fontSize:13,marginBottom:4}}>Normal · |Z| &lt; 1.5σ</p>
            <p style={{color:'#9ca3af',fontSize:12}}>Positioning balanced. No crowding risk.</p>
          </div>
          <div style={{background:'#111827',border:'1px solid #78350f',borderRadius:12,padding:16}}>
            <p style={{color:'#f59e0b',fontWeight:600,fontSize:13,marginBottom:4}}>Elevated · 1.5σ – 2σ</p>
            <p style={{color:'#9ca3af',fontSize:12}}>Positioning stretched. Watch for exhaustion.</p>
          </div>
          <div style={{background:'#111827',border:'1px solid #7f1d1d',borderRadius:12,padding:16}}>
            <p style={{color:'#ef4444',fontWeight:600,fontSize:13,marginBottom:4}}>Extreme · |Z| &gt; 2σ</p>
            <p style={{color:'#9ca3af',fontSize:12}}>Max long/short. High liquidation risk.</p>
          </div>
        </div>

        {/* How to Use */}
        <div style={{background:'#0c1220',border:'1px solid #1e3a5f',borderRadius:12,padding:24,marginBottom:24}}>
          <p style={{color:'#22d3ee',fontWeight:700,fontSize:15,marginBottom:16}}>How to Use This Chart</p>

          <p style={{color:'#6b7280',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Data Source</p>
          <p style={{color:'#9ca3af',fontSize:13,lineHeight:1.7,marginBottom:16}}>
            Weekly CFTC Commitments of Traders (COT) report — specifically the <span style={{color:'#e5e7eb'}}>Traders in Financial Futures (TFF)</span> report
            for S&amp;P 500 Consolidated futures (CME: 13874+). The <span style={{color:'#e5e7eb'}}>"Leveraged Money"</span> category is used as the CTA proxy,
            which includes registered CTAs, commodity pool operators, and hedge funds with a trend-following mandate.
          </p>

          <p style={{color:'#6b7280',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Methodology</p>
          <p style={{color:'#9ca3af',fontSize:13,lineHeight:1.7,marginBottom:16}}>
            Net positioning (longs minus shorts) is calculated as a percentage of total open interest each week.
            A <span style={{color:'#e5e7eb'}}>52-week rolling z-score</span> is then applied — this normalizes the raw position data so you can see
            whether current positioning is historically extreme, regardless of changes in market size over time.
          </p>

          <p style={{color:'#6b7280',fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Reading the Chart</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[
              {color:'#22d3ee', label:'Cyan line (left axis)', text:'SPY price'},
              {color:'#f97316', label:'Orange line (right axis)', text:'CTA positioning z-score'},
              {color:'#ef4444', label:'±2σ red bands', text:'Extreme positioning thresholds'},
              {color:'#9ca3af', label:'CTA lag', text:'CTAs trail price by 3–8 weeks — price moves first, they react after'},
              {color:'#9ca3af', label:'Z > +2σ', text:'CTAs extremely long — forced selling risk if trend reverses'},
              {color:'#9ca3af', label:'Z < −2σ', text:'CTAs extremely short — short-covering fuel if market rallies'},
              {color:'#9ca3af', label:'Divergence', text:'Price rising but CTAs not adding = weakening momentum signal'},
            ].map((item, i) => (
              <div key={i} style={{background:'#111827',borderRadius:8,padding:12}}>
                <p style={{color:item.color,fontSize:12,fontWeight:600,marginBottom:3}}>{item.label}</p>
                <p style={{color:'#6b7280',fontSize:12,lineHeight:1.5}}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{color:'#374151',fontSize:11,textAlign:'center',paddingBottom:24}}>
          For informational purposes only · Not investment advice · COT data reflects Tuesday positions published Friday
        </p>
      </div>
    </div>
  );
}
