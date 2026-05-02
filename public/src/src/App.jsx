import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, ComposedChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const START_DATE     = new Date("2026-05-02");
const INITIAL_GBP    = 5_000;

const PORTFOLIOS = {
  conservative: { label: "Conservative", annualReturn: 0.07, color: "#16a34a", desc: "Global ETFs (VWRL, ISF)", risk: "Low" },
  balanced:     { label: "Balanced",     annualReturn: 0.11, color: "#2563eb", desc: "Stocks + ETFs mix",       risk: "Medium" },
  aggressive:   { label: "Aggressive",   annualReturn: 0.18, color: "#f97316", desc: "Growth stocks & Tech",   risk: "High" },
};

const ASSETS = [
  { ticker: "VWRL", name: "Vanguard All-World ETF",  allocation: 35, type: "ETF",   emoji: "🌍" },
  { ticker: "AAPL", name: "Apple Inc.",               allocation: 20, type: "Stock", emoji: "🍎" },
  { ticker: "NVDA", name: "NVIDIA Corp.",             allocation: 15, type: "Stock", emoji: "🟢" },
  { ticker: "ISF",  name: "iShares FTSE 100 ETF",    allocation: 15, type: "ETF",   emoji: "🇬🇧" },
  { ticker: "TSLA", name: "Tesla Inc.",               allocation: 10, type: "Stock", emoji: "⚡" },
  { ticker: "CASH", name: "Cash Reserve",             allocation: 5,  type: "Cash",  emoji: "💷" },
];

// ─────────────────────────────────────────────
//  FORMATTERS
// ─────────────────────────────────────────────
const gbp = (v, dec = 0) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v);

const gbpShort = (v) =>
  v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000   ? `£${(v / 1_000).toFixed(1)}k`
  : `£${Math.round(v)}`;

// ─────────────────────────────────────────────
//  CALC HELPERS
// ─────────────────────────────────────────────
function calcCompound(initial, annualAdd, ratePct, years) {
  const r = ratePct / 100;
  const rows = [];
  let withAdd = initial, withoutAdd = initial;
  for (let y = 0; y <= years; y++) {
    rows.push({
      year: y === 0 ? "Start" : `Y${y}`, yearNum: y,
      withAdd: Math.round(withAdd), withoutAdd: Math.round(withoutAdd),
      principalWith: Math.round(initial + annualAdd * y),
      gainWith: Math.round(withAdd - (initial + annualAdd * y)),
      gainWithout: Math.round(withoutAdd - initial),
    });
    withAdd    = (withAdd + annualAdd) * (1 + r);
    withoutAdd = withoutAdd * (1 + r);
  }
  return rows;
}

function calcMonthlyGrowth(mode, years) {
  const r = PORTFOLIOS[mode].annualReturn / 12;
  const months = years * 12;
  return Array.from({ length: months + 1 }, (_, i) => {
    const d = new Date(START_DATE);
    d.setMonth(d.getMonth() + i);
    return {
      month: i,
      value: parseFloat((INITIAL_GBP * Math.pow(1 + r, i)).toFixed(2)),
      date: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    };
  });
}

// ─────────────────────────────────────────────
//  REUSABLE: SLIDER
// ─────────────────────────────────────────────
function Slider({ label, sublabel, value, min, max, step, onChange, fmt, accent = "#2563eb" }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
          {sublabel && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>{sublabel}</span>}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: accent, fontFamily: "monospace", background: `${accent}14`, padding: "2px 10px", borderRadius: 7 }}>
          {fmt(value)}
        </span>
      </div>
      <div style={{ position: "relative", height: 6 }}>
        <div style={{ position: "absolute", inset: 0, background: "#e2e8f0", borderRadius: 3 }} />
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`, background: accent, borderRadius: 3, transition: "width .08s" }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `calc(${pct}% - 9px)`,
          width: 18, height: 18, borderRadius: "50%",
          background: "#fff", border: `3px solid ${accent}`,
          boxShadow: `0 0 0 3px ${accent}22`,
          pointerEvents: "none", transition: "left .08s",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  REUSABLE: STAT CARD
// ─────────────────────────────────────────────
function Card({ icon, label, value, sub, accent = "#2563eb", onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "#fff", border: "1px solid #e8edf3",
      borderTop: `3px solid ${accent}`,
      borderRadius: 14, padding: "16px 18px",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TOOLTIPS
// ─────────────────────────────────────────────
const DashTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const gain = val - INITIAL_GBP;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
      <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 17, fontWeight: 700 }}>{gbp(val)}</div>
      <div style={{ color: gain >= 0 ? "#16a34a" : "#dc2626", fontSize: 12, marginTop: 2 }}>
        {gain >= 0 ? "+" : ""}{gbp(gain)} ({((gain / INITIAL_GBP) * 100).toFixed(1)}%)
      </div>
    </div>
  );
};

const CalcTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(0,0,0,.08)", minWidth: 190 }}>
      <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
        {label === "Start" ? "Start · 2 May 2026" : `Year ${d.yearNum}`}
      </div>
      {[
        { l: "With top-ups",    v: gbp(d.withAdd),    c: "#2563eb" },
        { l: "Without top-ups", v: gbp(d.withoutAdd), c: "#94a3b8" },
        { l: "Gain (with)",     v: gbp(d.gainWith),   c: "#16a34a" },
      ].map(r => (
        <div key={r.l} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: "#64748b" }}>{r.l}</span>
          <span style={{ color: r.c, fontWeight: 700 }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  NAV ITEM
// ─────────────────────────────────────────────
function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10, border: "none",
      background: active ? "#eff6ff" : "transparent",
      color: active ? "#2563eb" : "#64748b",
      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 700 : 500,
      cursor: "pointer", width: "100%", textAlign: "left",
      transition: "all 0.15s",
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
      {active && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#2563eb" }} />}
    </button>
  );
}

// ─────────────────────────────────────────────
//  DASHBOARD SECTION
// ─────────────────────────────────────────────
function DashboardView({ liveValue }) {
  const [mode, setMode]           = useState("balanced");
  const [horizon, setHorizon]     = useState(5);
  const [monthlyAdd, setMonthlyAdd] = useState(100);
  const [dashTab, setDashTab]     = useState("growth");
  const [animKey, setAnimKey]     = useState(0);

  const port = PORTFOLIOS[mode];
  const growthData = useMemo(() => calcMonthlyGrowth(mode, horizon), [mode, horizon]);
  const finalValue = growthData[growthData.length - 1].value;
  const totalGain  = finalValue - INITIAL_GBP;
  const gainPct    = ((totalGain / INITIAL_GBP) * 100).toFixed(1);

  // with monthly deposits
  const totalWithDeposits = useMemo(() => {
    const r = port.annualReturn / 12, months = horizon * 12;
    let v = INITIAL_GBP;
    for (let i = 0; i < months; i++) v = v * (1 + r) + monthlyAdd;
    return v;
  }, [port, horizon, monthlyAdd]);
  const totalDeposited = INITIAL_GBP + monthlyAdd * horizon * 12;
  const pureGrowth     = totalWithDeposits - totalDeposited;

  const today = new Date();
  const daysIn = Math.max(0, Math.floor((today - START_DATE) / 86_400_000));

  useEffect(() => setAnimKey(k => k + 1), [mode, horizon]);

  const tabBtn = (t, label) => (
    <button onClick={() => setDashTab(t)} style={{
      padding: "7px 18px", borderRadius: 999, border: "none", cursor: "pointer",
      fontFamily: "monospace", fontSize: 12, fontWeight: 600,
      background: dashTab === t ? "#0f172a" : "transparent",
      color: dashTab === t ? "#fff" : "#94a3b8",
      transition: "all 0.18s",
    }}>{label}</button>
  );

  return (
    <div>
      {/* Live header bar */}
      <div style={{
        background: "#0f172a", borderRadius: 16, padding: "20px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 4 }}>
            TRADING 212 · ISA · GBP · STARTED {START_DATE.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
            {gbp(liveValue, 2)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#4ade80", fontFamily: "monospace" }}>LIVE · Day {daysIn === 0 ? 1 : daysIn}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginBottom: 4 }}>STRATEGY</div>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(PORTFOLIOS).map(([key, p]) => (
              <button key={key} onClick={() => setMode(key)} style={{
                padding: "6px 12px", borderRadius: 8, border: `1px solid ${mode === key ? p.color : "#1e293b"}`,
                background: mode === key ? `${p.color}22` : "#1e293b",
                color: mode === key ? p.color : "#475569",
                fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer",
                transition: "all 0.18s",
              }}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Card icon="💷" label="Invested"          value={gbp(INITIAL_GBP)}  sub="Initial capital"                   accent="#0f172a" />
        <Card icon="📈" label={`${horizon}Y Proj.`} value={gbpShort(finalValue)} sub={`+${gainPct}% growth`}       accent={port.color} />
        <Card icon="✨" label="Projected Gain"    value={gbpShort(totalGain)} sub={`${port.label} strategy`}       accent="#16a34a" />
        <Card icon="📅" label="Ann. Return"       value={`${(port.annualReturn * 100).toFixed(0)}%`} sub={`${port.risk} risk`} accent="#f59e0b" />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f1f5f9", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {tabBtn("growth",    "📊 Growth")}
        {tabBtn("compound",  "🔁 Compound")}
        {tabBtn("portfolio", "🗂 Holdings")}
      </div>

      {/* Growth tab */}
      {dashTab === "growth" && (
        <div key={animKey} style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>COMPOUND GROWTH PROJECTION</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: port.color, fontFamily: "monospace" }}>
                {gbpShort(finalValue)} <span style={{ fontSize: 14, color: "#16a34a" }}>+{gainPct}%</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[3, 5, 10].map(y => (
                <button key={y} onClick={() => setHorizon(y)} style={{
                  padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${horizon === y ? port.color : "#e8edf3"}`,
                  background: horizon === y ? `${port.color}15` : "#f8fafc",
                  color: horizon === y ? port.color : "#94a3b8",
                  fontFamily: "monospace", fontSize: 12,
                }}>{y}Y</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={port.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={port.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} interval={Math.floor(growthData.length / 5)} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={gbpShort} width={50} />
              <Tooltip content={<DashTooltip />} />
              <ReferenceLine y={INITIAL_GBP} stroke="#e2e8f0" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="value" stroke={port.color} strokeWidth={2.5} fill="url(#dg)" dot={false} activeDot={{ r: 5, fill: port.color }} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, display: "flex", gap: 24 }}>
            {[
              { l: "Start", v: "2 May 2026" },
              { l: "Target year", v: new Date(START_DATE.getTime() + horizon * 365.25 * 86_400_000).getFullYear() },
              { l: "Return", v: `${(port.annualReturn * 100).toFixed(0)}% p.a.` },
            ].map(i => (
              <div key={i.l} style={{ fontSize: 12, color: "#94a3b8" }}>
                {i.l}: <span style={{ color: "#0f172a", fontWeight: 600 }}>{i.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compound tab */}
      {dashTab === "compound" && (
        <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 18 }}>COMPOUND WITH MONTHLY TOP-UPS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Monthly top-up</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={0} max={500} step={10} value={monthlyAdd}
                  onChange={e => setMonthlyAdd(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#2563eb" }} />
                <span style={{ fontFamily: "monospace", color: "#2563eb", fontSize: 16, fontWeight: 700, minWidth: 60 }}>£{monthlyAdd}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Time horizon</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[3, 5, 7, 10].map(y => (
                  <button key={y} onClick={() => setHorizon(y)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${horizon === y ? "#2563eb" : "#e8edf3"}`,
                    background: horizon === y ? "#eff6ff" : "#f8fafc",
                    color: horizon === y ? "#2563eb" : "#94a3b8",
                    fontFamily: "monospace", fontSize: 12,
                  }}>{y}Y</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { l: "Total deposited",   v: gbp(totalDeposited),     c: "#0f172a" },
              { l: "Investment growth", v: gbp(Math.round(pureGrowth)), c: "#16a34a" },
              { l: "Final value",       v: gbp(Math.round(totalWithDeposits)), c: "#2563eb" },
            ].map(it => (
              <div key={it.l} style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 5 }}>{it.l.toUpperCase()}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: it.c, fontFamily: "monospace" }}>{it.v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
            <span>Capital deposited</span><span>Compounded growth</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", background: "#f1f5f9" }}>
            <div style={{ width: `${(totalDeposited / totalWithDeposits) * 100}%`, background: "#bfdbfe", transition: "width .4s" }} />
            <div style={{ flex: 1, background: "#2563eb", transition: "flex .4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 5 }}>
            <span style={{ color: "#2563eb" }}>{((totalDeposited / totalWithDeposits) * 100).toFixed(0)}%</span>
            <span style={{ color: "#16a34a" }}>{((pureGrowth / totalWithDeposits) * 100).toFixed(0)}%</span>
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 12, color: "#1d4ed8" }}>
            💡 Trading 212 ISA — up to £20,000/year tax-free. Zero capital gains tax on profits.
          </div>
        </div>
      )}

      {/* Holdings tab */}
      {dashTab === "portfolio" && (
        <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 18 }}>SUGGESTED ALLOCATION · £{INITIAL_GBP.toLocaleString()}</div>
          {ASSETS.map((a, i) => {
            const val = (a.allocation / 100) * INITIAL_GBP;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < ASSETS.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                  {a.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{a.ticker}</span>
                      <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 8 }}>{a.name}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: "#0f172a" }}>{gbp(val)}</span>
                      <span style={{
                        marginLeft: 8, fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: a.type === "ETF" ? "#eff6ff" : a.type === "Stock" ? "#fff7ed" : "#f1f5f9",
                        color: a.type === "ETF" ? "#2563eb" : a.type === "Stock" ? "#f97316" : "#94a3b8",
                        fontFamily: "monospace",
                      }}>{a.type}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${a.allocation}%`,
                      background: a.type === "ETF" ? "linear-gradient(90deg,#60a5fa,#818cf8)" : a.type === "Stock" ? "linear-gradient(90deg,#f97316,#fb923c)" : "#d1d5db",
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#cbd5e1", minWidth: 34, textAlign: "right" }}>{a.allocation}%</div>
              </div>
            );
          })}
          <div style={{ marginTop: 18, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600, marginBottom: 3 }}>🎓 Student tip</div>
            <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
              Start with VWRL for instant global diversification, then layer individual stocks as you build conviction. T212 charges zero commission.
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: "18px 24px" }}>
        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 14 }}>MILESTONES</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { label: "Break Even", target: INITIAL_GBP, emoji: "🎯" },
            { label: "£6K",  target: 6_000,  emoji: "🌱" },
            { label: "£7.5K", target: 7_500, emoji: "🚀" },
            { label: "£10K", target: 10_000, emoji: "💎" },
            { label: "£15K", target: 15_000, emoji: "🏆" },
          ].map((m, i) => {
            const r = port.annualReturn / 12;
            let mo = 0, v = INITIAL_GBP;
            while (v < m.target && mo < 600) { v *= (1 + r); mo++; }
            const reached = mo < 600;
            return (
              <div key={i} style={{ flexShrink: 0, background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 12, padding: "12px 16px", textAlign: "center", minWidth: 95 }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{m.emoji}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{m.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{reached ? `~${(mo / 12).toFixed(1)}y` : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  CALCULATOR SECTION
// ─────────────────────────────────────────────
function CalculatorView() {
  const [initial,   setInitial]   = useState(5_000);
  const [annualAdd, setAnnualAdd] = useState(1_200);
  const [rate,      setRate]      = useState(11);
  const [years,     setYears]     = useState(10);
  const [chartMode, setChartMode] = useState("growth");

  const data = useMemo(() => calcCompound(initial, annualAdd, rate, years), [initial, annualAdd, rate, years]);
  const last = data[data.length - 1];
  const totalInvested = initial + annualAdd * years;
  const gainWith      = last.withAdd - totalInvested;
  const gainWithout   = last.withoutAdd - initial;
  const extraTopups   = last.withAdd - last.withoutAdd;
  const multiplier    = (last.withAdd / initial).toFixed(2);

  const presets = [
    { label: "🎓 Now (student)",    i: 5_000, a: 1_200, r: 11, y: 5,  desc: "£5k · £100/mo · 11% · 5yr" },
    { label: "💼 Working (3yr+)",  i: 5_000, a: 6_000, r: 11, y: 10, desc: "£5k · £500/mo · 11% · 10yr" },
    { label: "🚀 Aggressive",      i: 5_000, a: 2_400, r: 18, y: 10, desc: "£5k · £200/mo · 18% · 10yr" },
    { label: "🛡 Conservative",   i: 5_000, a: 1_200, r: 7,  y: 10, desc: "£5k · £100/mo · 7% · 10yr" },
  ];

  const tabBtn = (k, label) => (
    <button onClick={() => setChartMode(k)} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontFamily: "monospace", fontSize: 12, fontWeight: 600,
      background: chartMode === k ? "#0f172a" : "transparent",
      color: chartMode === k ? "#fff" : "#94a3b8",
      transition: "all 0.18s",
    }}>{label}</button>
  );

  return (
    <div>
      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Card icon="💷" label="Final (with top-ups)" value={gbpShort(last.withAdd)}   sub={`×${multiplier} your money`}                              accent="#2563eb" />
        <Card icon="📈" label="Total gain"           value={gbpShort(gainWith)}        sub={`+${((gainWith/totalInvested)*100).toFixed(1)}% on invested`} accent="#16a34a" />
        <Card icon="➕" label="Bonus from top-ups"   value={gbpShort(extraTopups)}     sub="vs no extra deposits"                                     accent="#f59e0b" />
        <Card icon="🏦" label="Without top-ups"      value={gbpShort(last.withoutAdd)} sub={`+${((gainWithout/initial)*100).toFixed(1)}% on £${initial.toLocaleString()}`} accent="#94a3b8" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>

        {/* Controls */}
        <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: "24px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
            Adjust Parameters
          </div>
          <Slider label="Initial Investment" sublabel="Your current: £5,000"
            value={initial} min={500} max={50_000} step={500}
            onChange={setInitial} fmt={v => `£${v.toLocaleString()}`} accent="#2563eb" />
          <Slider label="Annual Top-up" sublabel="£100/mo = £1,200/yr"
            value={annualAdd} min={0} max={12_000} step={100}
            onChange={setAnnualAdd} fmt={v => v === 0 ? "£0" : `£${v.toLocaleString()}/yr`} accent="#f59e0b" />
          <Slider label="Annual Return" sublabel="Balanced ~11%"
            value={rate} min={1} max={30} step={0.5}
            onChange={setRate} fmt={v => `${v}%`} accent="#16a34a" />
          <Slider label="Time Horizon"
            value={years} min={1} max={40} step={1}
            onChange={setYears} fmt={v => `${v}yr${v > 1 ? "s" : ""}`} accent="#7c3aed" />

          {/* Presets */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Quick Presets</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => { setInitial(p.i); setAnnualAdd(p.a); setRate(p.r); setYears(p.y); }}
                  style={{ background: "#f8fafc", border: "1px solid #e8edf3", borderRadius: 10, padding: "9px 12px", cursor: "pointer", textAlign: "left", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "#eff6ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8edf3"; e.currentTarget.style.background = "#f8fafc"; }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "flex", gap: 5, background: "#f1f5f9", borderRadius: 11, padding: 4, width: "fit-content" }}>
            {tabBtn("growth", "📈 Growth Curves")}
            {tabBtn("stack",  "📊 Principal vs Gain")}
          </div>

          {chartMode === "growth" && (
            <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: 24 }}>
              <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 3 }}>Asset Growth — {years} Year Projection</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginBottom: 18 }}>
                Blue (with top-ups) vs grey dashed (without) — starting £{initial.toLocaleString()} @ {rate}% p.a.
              </div>
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={gbpShort} width={54} />
                  <Tooltip content={<CalcTooltip />} />
                  <ReferenceLine y={initial} stroke="#e2e8f0" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="withAdd"    stroke="#2563eb" strokeWidth={2.5} fill="url(#cg1)" dot={false} activeDot={{ r: 5, fill: "#2563eb" }} />
                  <Area type="monotone" dataKey="withoutAdd" stroke="#94a3b8" strokeWidth={1.8} fill="url(#cg2)" dot={false} strokeDasharray="6 3" activeDot={{ r: 4, fill: "#94a3b8" }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#eff6ff", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#1d4ed8", fontFamily: "monospace" }}>🎯 Gap at Year {years}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb", fontFamily: "monospace" }}>+{gbpShort(extraTopups)} from top-ups</span>
              </div>
            </div>
          )}

          {chartMode === "stack" && (
            <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: 24 }}>
              <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 3 }}>Principal vs Compounded Gain</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginBottom: 18 }}>
                Light blue = principal · dark blue = gain (with top-ups)
              </div>
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#cbd5e1", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} tickFormatter={gbpShort} width={54} />
                  <Tooltip content={<CalcTooltip />} />
                  <Bar dataKey="principalWith" stackId="a" fill="#dbeafe" name="Principal" radius={[0,0,4,4]} />
                  <Bar dataKey="gainWith"      stackId="a" fill="#2563eb" name="Gain"      radius={[4,4,0,0]} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>
                  <span>Principal {((totalInvested / last.withAdd) * 100).toFixed(0)}%</span>
                  <span>Gain {((gainWith / last.withAdd) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, overflow: "hidden", display: "flex", background: "#f1f5f9" }}>
                  <div style={{ width: `${(totalInvested / last.withAdd) * 100}%`, background: "#bfdbfe", transition: "width .4s" }} />
                  <div style={{ flex: 1, background: "#2563eb" }} />
                </div>
              </div>
            </div>
          )}

          {/* Milestone table */}
          <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 16, padding: "18px 22px" }}>
            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13, marginBottom: 12 }}>Key Milestones</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["Year","With top-ups","Without","Difference","×Initial"].map(h => (
                      <th key={h} style={{ textAlign: "right", padding: "5px 10px", color: "#94a3b8", fontWeight: 500, borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.filter((_, i) => {
                    const pts = new Set([0, Math.round(years*.25), Math.round(years*.5), Math.round(years*.75), years]);
                    return pts.has(i);
                  }).map(d => (
                    <tr key={d.yearNum} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "7px 10px", color: "#64748b", textAlign: "right" }}>{d.yearNum === 0 ? "Start" : `Y${d.yearNum}`}</td>
                      <td style={{ padding: "7px 10px", color: "#2563eb", fontWeight: 700, textAlign: "right" }}>{gbpShort(d.withAdd)}</td>
                      <td style={{ padding: "7px 10px", color: "#94a3b8", textAlign: "right" }}>{gbpShort(d.withoutAdd)}</td>
                      <td style={{ padding: "7px 10px", color: "#16a34a", textAlign: "right" }}>+{gbpShort(d.withAdd - d.withoutAdd)}</td>
                      <td style={{ padding: "7px 10px", color: "#7c3aed", textAlign: "right" }}>×{(d.withAdd / initial).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Insight footer */}
      <div style={{ marginTop: 18, padding: "18px 24px", background: "#0f172a", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 5 }}>JINWOO'S PROJECTION</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>
            Adding{" "}
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>{annualAdd === 0 ? "nothing extra" : `£${Math.round(annualAdd/12).toLocaleString()}/month`}</span>
            {" "}for{" "}<span style={{ color: "#60a5fa", fontWeight: 700 }}>{years} years</span>
            {" "}at{" "}<span style={{ color: "#4ade80", fontWeight: 700 }}>{rate}% p.a.</span>
            {" "}→{" "}<span style={{ color: "#fff", fontWeight: 800 }}>{gbp(last.withAdd)}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, background: "#1e293b", borderRadius: 12, padding: "10px 18px", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>TOTAL GAIN</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>+{gbpShort(gainWith)}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────
export default function JinwooPortfolio() {
  const [page, setPage]         = useState("dashboard");
  const [liveValue, setLiveVal] = useState(INITIAL_GBP);

  // Simulated live ticker
  useEffect(() => {
    const id = setInterval(() => {
      setLiveVal(v => parseFloat(Math.max(4_800, v + (Math.random() - 0.49) * 2).toFixed(2)));
    }, 2_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const daysIn = Math.max(0, Math.floor((today - START_DATE) / 86_400_000));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 230, flexShrink: 0, background: "#fff",
        borderRight: "1px solid #e8edf3",
        display: "flex", flexDirection: "column",
        padding: "24px 14px",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, paddingLeft: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📈</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Jinwoo</div>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: "0.06em", paddingLeft: 2 }}>
            PORTFOLIO · T212 ISA
          </div>
        </div>

        {/* Live badge */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: "12px 14px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 9, color: "#4ade80", fontFamily: "monospace", letterSpacing: "0.1em" }}>LIVE</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
            {new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",minimumFractionDigits:2,maximumFractionDigits:2}).format(liveValue)}
          </div>
          <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>Day {daysIn === 0 ? 1 : daysIn} · Started 2 May 2026</div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 9, color: "#cbd5e1", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 8px", marginBottom: 5 }}>Main</div>
          <NavItem icon="🏠" label="Dashboard"   active={page === "dashboard"}   onClick={() => setPage("dashboard")} />
          <NavItem icon="🧮" label="Calculator"  active={page === "calculator"}  onClick={() => setPage("calculator")} />
        </div>

        {/* Bottom info */}
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>
            Trading 212 ISA<br />
            0% commission · Tax-free<br />
            ISA allowance: £20k/yr
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxHeight: "100vh" }}>
        {/* Page header */}
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
              {page === "dashboard" ? "Portfolio Dashboard" : "Compound Calculator"}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
              {page === "dashboard"
                ? "Real-time overview of your Trading 212 ISA"
                : "Simulate growth scenarios interactively"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { k: "dashboard",  icon: "🏠", label: "Dashboard"  },
              { k: "calculator", icon: "🧮", label: "Calculator" },
            ].map(t => (
              <button key={t.k} onClick={() => setPage(t.k)} style={{
                padding: "8px 16px", borderRadius: 10, border: "1px solid #e8edf3",
                background: page === t.k ? "#0f172a" : "#fff",
                color: page === t.k ? "#fff" : "#64748b",
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s",
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ animation: "fadeUp 0.3s ease" }} key={page}>
          {page === "dashboard"  && <DashboardView  liveValue={liveValue} />}
          {page === "calculator" && <CalculatorView />}
        </div>
      </div>
    </div>
  );
}
