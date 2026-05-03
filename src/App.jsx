bash

cat > /mnt/user-data/outputs/src/App.jsx << 'EOF'
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, ComposedChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const START_DATE  = new Date("2026-05-02");
const INITIAL_GBP = 5000;
const PORTFOLIOS  = {
  conservative: { label:"Conservative", r:0.07, color:"#16a34a" },
  balanced:     { label:"Balanced",     r:0.11, color:"#2563eb" },
  aggressive:   { label:"Aggressive",   r:0.18, color:"#f97316" },
};
const ASSETS = [
  {ticker:"VWRL",name:"Vanguard All-World ETF",alloc:35,type:"ETF",  emoji:"🌍"},
  {ticker:"AAPL",name:"Apple Inc.",             alloc:20,type:"Stock",emoji:"🍎"},
  {ticker:"NVDA",name:"NVIDIA Corp.",           alloc:15,type:"Stock",emoji:"🟢"},
  {ticker:"ISF", name:"iShares FTSE 100 ETF",  alloc:15,type:"ETF",  emoji:"🇬🇧"},
  {ticker:"TSLA",name:"Tesla Inc.",             alloc:10,type:"Stock",emoji:"⚡"},
  {ticker:"CASH",name:"Cash Reserve",           alloc:5, type:"Cash", emoji:"💷"},
];
const TABS=[{id:"tracker",icon:"📊",label:"Tracker"},{id:"simulate",icon:"🧮",label:"Simulator"},{id:"holdings",icon:"🗂",label:"Holdings"}];

const gbp  = v => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(v);
const gbp2 = v => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const gbpS = v => v>=1e6?`£${(v/1e6).toFixed(2)}M`:v>=1000?`£${(v/1000).toFixed(1)}k`:`£${Math.round(v)}`;
const pct  = v => `${v>=0?"+":""}${v.toFixed(1)}%`;

function calcGrowth(initial,annualAdd,ratePct,years){
  const r=ratePct/100; let w=initial,wo=initial;
  return Array.from({length:years+1},(_,y)=>{
    const row={y,label:y===0?"Start":`Y${y}`,withAdd:Math.round(w),withoutAdd:Math.round(wo),
      principal:Math.round(initial+annualAdd*y),gain:Math.round(w-(initial+annualAdd*y))};
    w=(w+annualAdd)*(1+r); wo=wo*(1+r); return row;
  });
}

const LS="jinwoo_v3";
const loadE=()=>{try{return JSON.parse(localStorage.getItem(LS)||"[]");}catch{return[];}};
const saveE=a=>localStorage.setItem(LS,JSON.stringify(a));

const Tip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",fontFamily:"monospace",fontSize:12,boxShadow:"0 4px 16px rgba(0,0,0,.08)"}}>
    <div style={{color:"#64748b",marginBottom:6,fontWeight:600}}>{label}</div>
    {payload.map((p,i)=>p.value!=null&&<div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <strong>{gbp(p.value)}</strong></div>)}
  </div>);
};

function SRow({label,sub,value,min,max,step,onChange,fmt,color="#2563eb"}){
  const p=((value-min)/(max-min))*100;
  return(<div style={{marginBottom:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
      <div><span style={{fontSize:11,color:"#64748b",fontFamily:"monospace",letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
        {sub&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:6}}>{sub}</span>}</div>
      <span style={{fontSize:15,fontWeight:700,color,fontFamily:"monospace",background:`${color}14`,padding:"2px 10px",borderRadius:7}}>{fmt(value)}</span>
    </div>
    <div style={{position:"relative",height:6}}>
      <div style={{position:"absolute",inset:0,background:"#e2e8f0",borderRadius:3}}/>
      <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${p}%`,background:color,borderRadius:3}}/>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}
        style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",margin:0}}/>
      <div style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:`calc(${p}% - 9px)`,
        width:18,height:18,borderRadius:"50%",background:"#fff",border:`3px solid ${color}`,
        boxShadow:`0 0 0 3px ${color}22`,pointerEvents:"none"}}/>
    </div>
  </div>);
}

function TrackerView(){
  const [entries,setE]=useState(loadE);
  const [form,setF]=useState({date:new Date().toISOString().slice(0,10),value:"",note:""});
  const [adding,setA]=useState(false);
  const [mode,setM]=useState("balanced");
  const port=PORTFOLIOS[mode];

  const add=()=>{
    if(!form.value)return;
    const ne={id:Date.now(),date:form.date,value:parseFloat(form.value),note:form.note};
    const u=[...entries,ne].sort((a,b)=>a.date.localeCompare(b.date));
    setE(u);saveE(u);setF({date:new Date().toISOString().slice(0,10),value:"",note:""});setA(false);
  };
  const del=id=>{const u=entries.filter(e=>e.id!==id);setE(u);saveE(u);};

  const days=Math.max(1,Math.ceil((new Date()-START_DATE)/86400000));
  const proj=useMemo(()=>{
    const r=port.r/365;
    return Array.from({length:Math.min(days+1,1825)},(_,i)=>{
      const d=new Date(START_DATE);d.setDate(d.getDate()+i);
      return{date:d.toISOString().slice(0,10),projected:Math.round(INITIAL_GBP*Math.pow(1+r,i))};
    });
  },[port.r,days]);

  const chart=useMemo(()=>{
    const em={};entries.forEach(e=>{em[e.date]=e.value;});
    return proj.map(d=>({...d,actual:em[d.date]??null,label:d.date.slice(5)}));
  },[proj,entries]);

  const latest=entries.length?entries[entries.length-1]:null;
  const lv=latest?.value??INITIAL_GBP;
  const ga=lv-INITIAL_GBP;
  const gp=(ga/INITIAL_GBP)*100;
  const din=latest?Math.max(1,Math.ceil((new Date(latest.date)-START_DATE)/86400000)):1;

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:"#0f172a",borderRadius:16,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:10,color:"#475569",fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:4}}>CURRENT PORTFOLIO VALUE</div>
        <div style={{fontSize:30,fontWeight:800,color:"#fff",fontFamily:"monospace",lineHeight:1}}>{gbp2(lv)}</div>
        <div style={{fontSize:12,color:ga>=0?"#4ade80":"#f87171",marginTop:5,fontFamily:"monospace"}}>
          {ga>=0?"▲":"▼"} {gbp(Math.abs(ga))} ({pct(gp)}) from £{INITIAL_GBP.toLocaleString()}
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.entries(PORTFOLIOS).map(([k,p])=>(
          <button key={k} onClick={()=>setM(k)} style={{padding:"6px 12px",borderRadius:8,
            border:`1px solid ${mode===k?p.color:"#1e293b"}`,background:mode===k?`${p.color}22`:"#1e293b",
            color:mode===k?p.color:"#475569",fontFamily:"monospace",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {p.label}
          </button>
        ))}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
      {[
        {icon:"💷",l:"Invested",   v:gbp(INITIAL_GBP),  sub:"2 May 2026",    c:"#0f172a"},
        {icon:"📅",l:"Day",        v:`Day ${din}`,       sub:"Keep going! 💪", c:"#2563eb"},
        {icon:"📈",l:"Return",     v:pct(gp),            sub:ga>=0?`+${gbp(ga)}`:gbp(ga), c:ga>=0?"#16a34a":"#dc2626"},
      ].map(s=>(
        <div key={s.l} style={{background:"#fff",border:"1px solid #e2e8f0",borderTop:`3px solid ${s.c}`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:5}}>{s.icon} {s.l.toUpperCase()}</div>
          <div style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{s.sub}</div>
        </div>
      ))}
    </div>

    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"18px 20px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontWeight:700,color:"#0f172a",fontSize:14}}>Projected vs Actual</div>
          <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginTop:2}}>
            {port.label} ({(port.r*100).toFixed(0)}% p.a.) projection vs your logged values
          </div>
        </div>
        <button onClick={()=>setA(true)} style={{padding:"8px 16px",borderRadius:10,border:"none",
          background:"#2563eb",color:"#fff",fontFamily:"monospace",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          + Log Value
        </button>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chart} margin={{top:5,right:5,left:0,bottom:0}}>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false}/>
          <XAxis dataKey="label" tick={{fill:"#cbd5e1",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false} interval={Math.floor(chart.length/5)}/>
          <YAxis tick={{fill:"#cbd5e1",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false} tickFormatter={gbpS} width={46}/>
          <Tooltip content={<Tip/>}/>
          <Area type="monotone" dataKey="projected" stroke={port.color} strokeWidth={2} fill={`${port.color}15`} dot={false} name="Projected"/>
          <Line type="monotone" dataKey="actual" stroke="#f97316" strokeWidth={2.5} dot={{fill:"#f97316",r:5}} connectNulls={false} name="Actual"/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>

    {adding&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:20,padding:"28px",width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:20}}>📝 Log Portfolio Value</div>
          {[{l:"Date",k:"date",t:"date",ph:""},{l:"Value (£)",k:"value",t:"number",ph:"e.g. 5050"},{l:"Note",k:"note",t:"text",ph:"e.g. After NVDA surge"}].map(f=>(
            <div key={f.k} style={{marginBottom:14}}>
              <div style={{fontSize:11,color:"#64748b",fontFamily:"monospace",marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{f.l}</div>
              <input type={f.t} value={form[f.k]} placeholder={f.ph} onChange={e=>setF(p=>({...p,[f.k]:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontFamily:"monospace",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={()=>setA(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontFamily:"monospace",fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={add} style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontFamily:"monospace",fontSize:13,fontWeight:700,cursor:"pointer"}}>Save Entry</button>
          </div>
        </div>
      </div>
    )}

    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"18px 20px"}}>
      <div style={{fontWeight:700,color:"#0f172a",fontSize:14,marginBottom:14}}>Entry Log</div>
      {entries.length===0?(
        <div style={{textAlign:"center",padding:"24px 0",color:"#94a3b8",fontSize:13}}>No entries yet — click "+ Log Value" to start tracking!</div>
      ):(
        <div>{[...entries].reverse().map((e,i)=>{
          const idx=entries.indexOf(e);
          const prev=entries[idx-1];
          const diff=prev?e.value-prev.value:e.value-INITIAL_GBP;
          return(<div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<entries.length-1?"1px solid #f1f5f9":"none"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:diff>=0?"#16a34a":"#dc2626",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#0f172a"}}>
                {gbp2(e.value)}<span style={{fontSize:11,color:diff>=0?"#16a34a":"#dc2626",marginLeft:8}}>{diff>=0?"+":""}{gbp(diff)}</span>
              </div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                {new Date(e.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                {e.note&&<span style={{marginLeft:8,color:"#64748b"}}>· {e.note}</span>}
              </div>
            </div>
            <button onClick={()=>del(e.id)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid #fee2e2",background:"#fff",color:"#dc2626",fontSize:11,cursor:"pointer"}}>✕</button>
          </div>);
        })}</div>
      )}
    </div>
  </div>);
}

function SimulatorView(){
  const [initial,setI]=useState(5000);
  const [annualAdd,setA]=useState(1200);
  const [rate,setR]=useState(11);
  const [years,setY]=useState(10);
  const [cm,setCm]=useState("growth");
  const data=useMemo(()=>calcGrowth(initial,annualAdd,rate,years),[initial,annualAdd,rate,years]);
  const last=data[data.length-1];
  const totalIn=initial+annualAdd*years;
  const gainWith=last.withAdd-totalIn;
  const extra=last.withAdd-last.withoutAdd;
  const presets=[
    {label:"🎓 Student now",   i:5000,a:1200,r:11,y:5},
    {label:"💼 Working (3yr+)",i:5000,a:6000,r:11,y:10},
    {label:"🚀 Aggressive",    i:5000,a:2400,r:18,y:10},
    {label:"🛡 Conservative",  i:5000,a:1200,r:7, y:10},
  ];
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:"#0f172a",borderRadius:16,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:10,color:"#475569",fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:4}}>PROJECTED FINAL VALUE</div>
        <div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{gbpS(last.withAdd)}</div>
        <div style={{fontSize:12,color:"#4ade80",marginTop:4,fontFamily:"monospace"}}>+{gbpS(gainWith)} gain · ×{(last.withAdd/initial).toFixed(2)} your money</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:10,color:"#475569",fontFamily:"monospace",marginBottom:4}}>BONUS FROM TOP-UPS</div>
        <div style={{fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"monospace"}}>+{gbpS(extra)}</div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:14}}>
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"20px 18px"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:16,paddingBottom:12,borderBottom:"1px solid #f1f5f9"}}>Adjust Parameters</div>
        <SRow label="Initial" sub="Your: £5k" value={initial} min={500} max={50000} step={500} onChange={setI} fmt={v=>`£${v.toLocaleString()}`} color="#2563eb"/>
        <SRow label="Annual top-up" sub="£100/mo=£1.2k" value={annualAdd} min={0} max={12000} step={100} onChange={setA} fmt={v=>v===0?"£0":`£${v.toLocaleString()}/yr`} color="#f59e0b"/>
        <SRow label="Return %" sub="Balanced ~11%" value={rate} min={1} max={30} step={0.5} onChange={setR} fmt={v=>`${v}%`} color="#16a34a"/>
        <SRow label="Horizon" value={years} min={1} max={40} step={1} onChange={setY} fmt={v=>`${v}yr${v>1?"s":""}`} color="#7c3aed"/>
        <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Quick Presets</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {presets.map(p=>(
            <button key={p.label} onClick={()=>{setI(p.i);setA(p.a);setR(p.r);setY(p.y);}}
              style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:9,padding:"8px 12px",cursor:"pointer",textAlign:"left"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.background="#eff6ff";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
              <div style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>{p.label}</div>
              <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",marginTop:1}}>£{p.i.toLocaleString()} · £{(p.a/12).toFixed(0)}/mo · {p.r}% · {p.y}yr</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:11,padding:4,width:"fit-content"}}>
          {[{k:"growth",l:"📈 Growth Curves"},{k:"stack",l:"📊 Principal vs Gain"}].map(t=>(
            <button key={t.k} onClick={()=>setCm(t.k)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",
              fontFamily:"monospace",fontSize:11,fontWeight:600,background:cm===t.k?"#0f172a":"transparent",
              color:cm===t.k?"#fff":"#94a3b8",transition:"all .18s"}}>{t.l}</button>
          ))}
        </div>
        {cm==="growth"&&(
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"18px 20px"}}>
            <div style={{fontWeight:600,color:"#0f172a",marginBottom:3,fontSize:13}}>{years}-Year Growth Projection</div>
            <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginBottom:14}}>Blue = with top-ups · Grey dashed = without · £{initial.toLocaleString()} @ {rate}%</div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={data} margin={{top:5,right:8,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:"#cbd5e1",fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fill:"#cbd5e1",fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={false} tickFormatter={gbpS} width={50}/>
                <Tooltip content={<Tip/>}/>
                <ReferenceLine y={initial} stroke="#e2e8f0" strokeDasharray="5 5"/>
                <Area type="monotone" dataKey="withAdd" stroke="#2563eb" strokeWidth={2.5} fill="url(#g1)" dot={false} name="With top-ups"/>
                <Area type="monotone" dataKey="withoutAdd" stroke="#94a3b8" strokeWidth={1.8} fill="none" dot={false} strokeDasharray="6 3" name="Without top-ups"/>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{marginTop:12,padding:"10px 14px",background:"#eff6ff",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:"#1d4ed8",fontFamily:"monospace"}}>🎯 Year {years} gap</span>
              <span style={{fontSize:15,fontWeight:800,color:"#2563eb",fontFamily:"monospace"}}>+{gbpS(extra)} from top-ups</span>
            </div>
          </div>
        )}
        {cm==="stack"&&(
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"18px 20px"}}>
            <div style={{fontWeight:600,color:"#0f172a",marginBottom:3,fontSize:13}}>Principal vs Compounded Gain</div>
            <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginBottom:14}}>Light = principal · Dark = gain</div>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={data} margin={{top:5,right:8,left:0,bottom:0}}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:"#cbd5e1",fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                <YAxis tick={{fill:"#cbd5e1",fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={false} tickFormatter={gbpS} width={50}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="principal" stackId="a" fill="#dbeafe" name="Principal" radius={[0,0,4,4]}/>
                <Bar dataKey="gain" stackId="a" fill="#2563eb" name="Gain" radius={[4,4,0,0]}/>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8",marginBottom:5}}>
                <span>Principal {((totalIn/last.withAdd)*100).toFixed(0)}%</span>
                <span>Gain {((gainWith/last.withAdd)*100).toFixed(0)}%</span>
              </div>
              <div style={{height:8,borderRadius:4,overflow:"hidden",display:"flex",background:"#f1f5f9"}}>
                <div style={{width:`${(totalIn/last.withAdd)*100}%`,background:"#bfdbfe",transition:"width .4s"}}/>
                <div style={{flex:1,background:"#2563eb"}}/>
              </div>
            </div>
          </div>
        )}
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"16px 20px"}}>
          <div style={{fontWeight:600,color:"#0f172a",fontSize:13,marginBottom:12}}>Key Milestones</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"monospace",fontSize:11}}>
            <thead><tr>{["Year","With top-ups","Without","Diff","×Initial"].map(h=>(
              <th key={h} style={{textAlign:"right",padding:"5px 10px",color:"#94a3b8",fontWeight:500,borderBottom:"1px solid #f1f5f9"}}>{h}</th>
            ))}</tr></thead>
            <tbody>{data.filter((_,i)=>{const s=new Set([0,Math.round(years*.25),Math.round(years*.5),Math.round(years*.75),years]);return s.has(i);}).map(d=>(
              <tr key={d.y} style={{borderBottom:"1px solid #f8fafc"}}>
                <td style={{padding:"7px 10px",color:"#64748b",textAlign:"right"}}>{d.y===0?"Start":`Y${d.y}`}</td>
                <td style={{padding:"7px 10px",color:"#2563eb",fontWeight:700,textAlign:"right"}}>{gbpS(d.withAdd)}</td>
                <td style={{padding:"7px 10px",color:"#94a3b8",textAlign:"right"}}>{gbpS(d.withoutAdd)}</td>
                <td style={{padding:"7px 10px",color:"#16a34a",textAlign:"right"}}>+{gbpS(d.withAdd-d.withoutAdd)}</td>
                <td style={{padding:"7px 10px",color:"#7c3aed",textAlign:"right"}}>×{(d.withAdd/initial).toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>);
}

function HoldingsView(){
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"20px 24px"}}>
      <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:18}}>SUGGESTED ALLOCATION · £5,000</div>
      {ASSETS.map((a,i)=>{
        const val=(a.alloc/100)*INITIAL_GBP;
        return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:i<ASSETS.length-1?"1px solid #f1f5f9":"none"}}>
          <div style={{width:38,height:38,borderRadius:9,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{a.emoji}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <div>
                <span style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#0f172a"}}>{a.ticker}</span>
                <span style={{color:"#94a3b8",fontSize:11,marginLeft:8}}>{a.name}</span>
              </div>
              <div>
                <span style={{fontFamily:"monospace",fontSize:13,color:"#0f172a"}}>{gbp(val)}</span>
                <span style={{marginLeft:8,fontSize:10,padding:"2px 7px",borderRadius:999,
                  background:a.type==="ETF"?"#eff6ff":a.type==="Stock"?"#fff7ed":"#f1f5f9",
                  color:a.type==="ETF"?"#2563eb":a.type==="Stock"?"#f97316":"#94a3b8",fontFamily:"monospace"}}>{a.type}</span>
              </div>
            </div>
            <div style={{height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${a.alloc}%`,borderRadius:3,
                background:a.type==="ETF"?"linear-gradient(90deg,#60a5fa,#818cf8)":a.type==="Stock"?"linear-gradient(90deg,#f97316,#fb923c)":"#d1d5db"}}/>
            </div>
          </div>
          <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:"#cbd5e1",minWidth:34,textAlign:"right"}}>{a.alloc}%</div>
        </div>);
      })}
    </div>
    <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"16px 20px"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#15803d",marginBottom:6}}>🎓 Student Tips</div>
      <div style={{fontSize:12,color:"#166534",lineHeight:1.7}}>
        • Trading 212 = <strong>zero commission</strong><br/>
        • Use <strong>Stocks & Shares ISA</strong> → £20,000/yr tax-free<br/>
        • Start with <strong>VWRL</strong> for instant diversification<br/>
        • Add individual stocks once you have conviction
      </div>
    </div>
  </div>);
}

export default function App(){
  const [tab,setTab]=useState("tracker");
  const [live,setLive]=useState(INITIAL_GBP);
  useEffect(()=>{
    const id=setInterval(()=>setLive(v=>parseFloat(Math.max(4800,v+(Math.random()-.49)*1.5).toFixed(2))),2000);
    return()=>clearInterval(id);
  },[]);
  const daysIn=Math.max(1,Math.ceil((new Date()-START_DATE)/86400000));

  return(<div style={{display:"flex",minHeight:"100vh",background:"#f8fafc",fontFamily:"'DM Sans',system-ui,sans-serif",color:"#0f172a"}}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      ::-webkit-scrollbar{width:4px;height:4px;}
      ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px;}
      input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    `}</style>

    <div style={{width:200,flexShrink:0,background:"#fff",borderRight:"1px solid #e8edf3",
      display:"flex",flexDirection:"column",padding:"20px 12px",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{marginBottom:20,paddingLeft:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#2563eb,#7c3aed)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📈</div>
          <span style={{fontSize:15,fontWeight:800,color:"#0f172a",letterSpacing:"-0.02em"}}>Jinwoo</span>
        </div>
        <div style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",letterSpacing:"0.06em",paddingLeft:2}}>PORTFOLIO · T212 ISA</div>
      </div>
      <div style={{background:"#0f172a",borderRadius:12,padding:"12px 14px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:9,color:"#4ade80",fontFamily:"monospace",letterSpacing:"0.1em"}}>LIVE</span>
        </div>
        <div style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{gbp2(live)}</div>
        <div style={{fontSize:9,color:"#475569",marginTop:3}}>Day {daysIn} · 2 May 2026</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <div style={{fontSize:9,color:"#cbd5e1",fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",padding:"0 8px",marginBottom:4}}>Menu</div>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:8,
            padding:"9px 10px",borderRadius:9,border:"none",background:tab===t.id?"#eff6ff":"transparent",
            color:tab===t.id?"#2563eb":"#64748b",fontFamily:"'DM Sans',sans-serif",fontSize:13,
            fontWeight:tab===t.id?700:500,cursor:"pointer",width:"100%",textAlign:"left"}}>
            <span style={{fontSize:15}}>{t.icon}</span>{t.label}
            {tab===t.id&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#2563eb"}}/>}
          </button>
        ))}
      </div>
      <div style={{marginTop:"auto",paddingTop:16,borderTop:"1px solid #f1f5f9"}}>
        <div style={{fontSize:10,color:"#94a3b8",lineHeight:1.7}}>T212 ISA<br/>0% commission<br/>ISA: £20k/yr</div>
      </div>
    </div>

    <div style={{flex:1,padding:"24px 28px",overflowY:"auto",maxHeight:"100vh"}}>
      <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a",letterSpacing:"-0.02em"}}>
            {tab==="tracker"?"Portfolio Tracker":tab==="simulate"?"Compound Simulator":"Holdings"}
          </div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>
            {tab==="tracker"?"Log your real T212 values & track vs projection":
             tab==="simulate"?"Adjust variables and see growth in real-time":"Suggested £5,000 allocation"}
          </div>
        </div>
        <div style={{display:"flex",gap:5}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 14px",borderRadius:9,
              border:"1px solid #e8edf3",background:tab===t.id?"#0f172a":"#fff",
              color:tab===t.id?"#fff":"#64748b",fontFamily:"'DM Sans',sans-serif",fontSize:12,
              fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab==="tracker"  &&<TrackerView/>}
      {tab==="simulate" &&<SimulatorView/>}
      {tab==="holdings" &&<HoldingsView/>}
    </div>
  </div>);
}
EOF
echo "Done: $(wc -l < /mnt/user-data/outputs/src/App.jsx) lines"
Output

Done: 463 lines
