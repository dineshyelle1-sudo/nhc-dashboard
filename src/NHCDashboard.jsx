import React, { useState, useMemo } from "react";
import {
  ComposedChart, Line, Area, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";

/* ----------------------------- data ----------------------------- */
// ─── CONFIG: paste your Apps Script Web App URL here ───────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9GF93juynp-ovve1qWKc6f3EW86cPCRTmjvO4SrMVBA8HrGFA3up62XaesCn6ItQz7g/exec";
// ────────────────────────────────────────────────────────────────────────────

/* ----------------------------- theme ----------------------------- */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", ink: "#11161D", sub: "#5A6573",
  faint: "#909AA6", line: "#E6E9ED", line2: "#F0F2F5",
  overall: "#0E9F8C", google: "#3E7BFA", meta: "#8257FE", apple: "#586173",
  up: "#16A35A", down: "#E04A3C", neutral: "#7C8794",
};
const CH = {
  overall: { key: "overall", label: "Overall", color: C.overall },
  google: { key: "google", label: "Google", color: C.google },
  meta: { key: "meta", label: "Meta", color: C.meta },
  apple: { key: "apple", label: "Apple Ads", color: C.apple },
};

/* ----------------------------- helpers ----------------------------- */
const FIELDS = ["spends", "impr", "clicks", "installs", "d0packs", "d7packs", "d30packs", "revenue"];

function dayChannel(rec, ch) {
  if (ch === "overall") {
    const o = {};
    FIELDS.forEach((f) => {
      // Revenue: Google + Meta only (Apple revenue is attributed differently)
      if (f === "revenue") {
        o[f] = rec.google[f] + rec.meta[f];
      } else {
        o[f] = rec.google[f] + rec.meta[f] + rec.apple[f];
      }
    });
    o.organic = rec.organic;
    return o;
  }
  return { ...rec[ch], organic: ch === "overall" ? rec.organic : 0 };
}

function aggregate(days, ch) {
  const a = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  a.organic = 0;
  days.forEach((rec) => {
    const d = dayChannel(rec, ch);
    FIELDS.forEach((f) => (a[f] += d[f] || 0));
    a.organic += rec.organic || 0;
  });
  a.cpi = a.installs ? a.spends / a.installs : null;
  a.cpm = a.impr ? (a.spends / a.impr) * 1000 : null;
  a.cpc = a.clicks ? a.spends / a.clicks : null;
  a.ctr = a.impr ? a.clicks / a.impr : null;
  a.roi = a.spends ? a.revenue / a.spends : null;
  a.cvr = a.clicks ? a.installs / a.clicks : null;          // click -> install
  a.purchaseRate = a.installs ? a.d30packs / a.installs : null;
  a.ndays = days.length;
  return a;
}

/* date utilities (treat ISO yyyy-mm-dd as plain calendar dates) */
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtD = (iso) => { const d = parse(iso); return `${d.getDate()} ${MON[d.getMonth()]}`; };

/* build periods at a granularity from the full record list */
function buildPeriods(records, gran) {
  if (gran === "daily")
    return records.map((r) => ({ label: fmtD(r.date), sub: r.day.slice(0, 3), start: r.date, end: r.date, days: [r] }));

  if (gran === "monthly") {
    const m = {};
    records.forEach((r) => { (m[r.month] ??= []).push(r); });
    return Object.entries(m).map(([month, days]) => ({
      label: month, sub: `${days.length}d`, start: days[0].date, end: days[days.length - 1].date, days,
    }));
  }

  // weekly: Monday-anchored buckets
  const buckets = {};
  records.forEach((r) => {
    const d = parse(r.date);
    const dow = (d.getDay() + 6) % 7;           // 0 = Monday
    const monday = addDays(d, -dow);
    const key = iso(monday);
    (buckets[key] ??= []).push(r);
  });
  return Object.keys(buckets).sort().map((k) => {
    const days = buckets[k];
    return { label: `${fmtD(days[0].date)}–${fmtD(days[days.length - 1].date)}`, sub: `wk`, start: days[0].date, end: days[days.length - 1].date, days };
  });
}

/* ----------------------------- formatting ----------------------------- */
function inr(v, compact = true) {
  if (v == null || isNaN(v)) return "—";
  const n = Math.round(v);
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}
const intf = (v) => (v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("en-IN"));
const cnt = (v) => {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return Math.round(v).toLocaleString("en-IN");
};
const pct = (v) => (v == null || isNaN(v) ? "—" : `${(v * 100).toFixed(2)}%`);
const money2 = (v) => (v == null || isNaN(v) ? "—" : `₹${v.toFixed(v < 100 ? 1 : 0)}`);
const roiF = (v) => (v == null || isNaN(v) ? "—" : `${v.toFixed(2)}×`);

/* metric registry */
const M = {
  spends: { label: "Spend", fmt: inr, sense: "neutral", chart: true },
  revenue: { label: "Revenue", fmt: inr, sense: "pos", chart: true },
  roi: { label: "ROI", fmt: roiF, sense: "pos", chart: true, ratio: true },
  installs: { label: "Installs", fmt: cnt, sense: "pos", chart: true },
  impr: { label: "Impressions", fmt: cnt, sense: "pos", chart: true },
  clicks: { label: "Clicks", fmt: cnt, sense: "pos", chart: true },
  ctr: { label: "CTR", fmt: pct, sense: "pos", chart: true, ratio: true },
  cpi: { label: "CPI", fmt: money2, sense: "neg", chart: true, ratio: true },
  cpm: { label: "CPM", fmt: money2, sense: "neg", chart: true, ratio: true },
  cpc: { label: "CPC", fmt: money2, sense: "neg", chart: true, ratio: true },
  d30packs: { label: "D30 Packs", fmt: cnt, sense: "pos", chart: true },
  organic: { label: "Organic Installs", fmt: cnt, sense: "pos", chart: true },
};

function delta(cur, prev, sense) {
  if (cur == null || prev == null || prev === 0) return null;
  const pctChange = (cur - prev) / Math.abs(prev);
  let dir = pctChange > 0.0005 ? "up" : pctChange < -0.0005 ? "down" : "flat";
  let good = "neutral";
  if (sense === "pos") good = dir === "up" ? "good" : dir === "down" ? "bad" : "flat";
  if (sense === "neg") good = dir === "up" ? "bad" : dir === "down" ? "good" : "flat";
  return { pctChange, dir, good };
}

/* ----------------------------- small components ----------------------------- */
function Delta({ d, big }) {
  if (!d || d.dir === "flat") return <span style={{ color: C.faint, fontSize: big ? 13 : 11 }}>—</span>;
  const col = d.good === "good" ? C.up : d.good === "bad" ? C.down : C.neutral;
  const arrow = d.dir === "up" ? "▲" : "▼";
  return (
    <span style={{ color: col, fontSize: big ? 13 : 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {arrow} {Math.abs(d.pctChange * 100).toFixed(1)}%
    </span>
  );
}

function Seg({ items, value, onChange, accentMap }) {
  return (
    <div style={{ display: "inline-flex", background: C.line2, borderRadius: 10, padding: 3, gap: 2 }}>
      {items.map((it) => {
        const active = it.key === value;
        const acc = accentMap ? accentMap(it.key) : C.ink;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} style={{
            border: "none", cursor: "pointer", padding: "6px 13px", borderRadius: 8,
            fontSize: 13, fontWeight: active ? 650 : 500, letterSpacing: 0.1,
            background: active ? C.panel : "transparent",
            color: active ? acc : C.sub,
            boxShadow: active ? "0 1px 2px rgba(16,22,29,.10)" : "none",
            transition: "all .12s",
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

/* ----------------------------- main ----------------------------- */
export default function NHCDashboard({ RAW }) {
  if (!RAW) return null;
  return <Dashboard RAW={RAW} />;
}

function Dashboard({ RAW }) {
  const [channel, setChannel] = useState("overall");
  const [gran, setGran] = useState("monthly");
  const [idx, setIdx] = useState(null);            // index into periods, null => last
  const [compare, setCompare] = useState(true);
  const [trendMetric, setTrendMetric] = useState("spends");
  const [trendGran, setTrendGran] = useState("daily");
  const [cStart, setCStart] = useState(RAW[Math.max(0, RAW.length - 7)].date);
  const [cEnd, setCEnd] = useState(RAW[RAW.length - 1].date);

  const accent = CH[channel].color;
  const periods = useMemo(() => buildPeriods(RAW, gran === "custom" ? "daily" : gran), [gran]);

  /* resolve current + previous period */
  const { cur, prev } = useMemo(() => {
    if (gran === "custom") {
      const s = cStart <= cEnd ? cStart : cEnd, e = cStart <= cEnd ? cEnd : cStart;
      const days = RAW.filter((r) => r.date >= s && r.date <= e);
      const len = Math.round((parse(e) - parse(s)) / 864e5) + 1;
      const pe = iso(addDays(parse(s), -1)), ps = iso(addDays(parse(s), -len));
      const pdays = RAW.filter((r) => r.date >= ps && r.date <= pe);
      return {
        cur: { label: `${fmtD(s)} – ${fmtD(e)}`, days, start: s, end: e },
        prev: pdays.length ? { label: `${fmtD(ps)} – ${fmtD(pe)}`, days: pdays } : null,
      };
    }
    const i = idx == null ? periods.length - 1 : Math.min(idx, periods.length - 1);
    return { cur: periods[i], prev: i > 0 ? periods[i - 1] : null };
  }, [gran, idx, periods, cStart, cEnd]);

  const A = useMemo(() => aggregate(cur.days, channel), [cur, channel]);
  const P = useMemo(() => (compare && prev ? aggregate(prev.days, channel) : null), [prev, channel, compare]);

  /* trend series at the chosen trend granularity, with current/compare highlighting */
  const tConf = M[trendMetric];
  const curS = cur.days[0].date, curE = cur.days[cur.days.length - 1].date;
  const prevS = prev ? prev.days[0].date : null, prevE = prev ? prev.days[prev.days.length - 1].date : null;
  const trendPeriods = useMemo(() => buildPeriods(RAW, trendGran), [trendGran]);
  const series = useMemo(
    () => trendPeriods.map((p) => {
      const ag = aggregate(p.days, channel);
      const sel = p.start <= curE && p.end >= curS;
      const cmp = !!(compare && prevS && p.start <= prevE && p.end >= prevS);
      return { date: p.start, label: p.label, value: ag[trendMetric] ?? null, sel, cmp };
    }),
    [trendPeriods, channel, trendMetric, curS, curE, prevS, prevE, compare]
  );
  const isDailyTrend = trendGran === "daily";

  const channelItems = Object.values(CH);
  const isApple = channel === "apple";

  /* funnel stages */
  const stages = [
    { k: "impr", label: "Impressions", val: A.impr, conv: null },
    { k: "clicks", label: "Clicks", val: A.clicks, conv: A.ctr, convLabel: "CTR" },
    { k: "installs", label: "Installs", val: A.installs, conv: A.cvr, convLabel: "Click→Install" },
    { k: "d30packs", label: "D30 Packs", val: A.d30packs, conv: A.purchaseRate, convLabel: "Install→Pack" },
  ];
  const funnelMax = Math.max(...stages.map((s) => s.val), 1);

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100%", padding: "20px 22px 40px",
      fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif", fontFeatureSettings: "'tnum'" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nhc-disp { font-family:'Space Grotesk', ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
        .nhc-card { background:${C.panel}; border:1px solid ${C.line}; border-radius:14px; }
        .nhc-btn { border:1px solid ${C.line}; background:${C.panel}; border-radius:9px; cursor:pointer; color:${C.sub}; font-size:13px; padding:6px 10px; }
        .nhc-btn:hover { border-color:#cfd4da; }
        input[type=date]{ font-family:inherit; font-size:13px; color:${C.ink}; border:1px solid ${C.line}; border-radius:9px; padding:5px 8px; background:${C.panel}; }
        ::selection{ background:${accent}22; }
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>
            NHC · Day-over-Day Performance
          </div>
          <div className="nhc-disp" style={{ fontSize: 27, fontWeight: 700, marginTop: 3, letterSpacing: -0.4 }}>
            Acquisition Funnel
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Seg items={channelItems} value={channel} onChange={setChannel} accentMap={(k) => CH[k].color} />
        </div>
      </div>

      {/* control bar */}
      <div className="nhc-card" style={{ padding: "12px 14px", marginBottom: 16, display: "flex",
        gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Seg
          items={[{ key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" }, { key: "custom", label: "Custom" }]}
          value={gran} onChange={(g) => { setGran(g); setIdx(null); }}
        />

        {gran === "custom" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.sub, fontSize: 13 }}>
            <input type="date" min={RAW[0].date} max={RAW[RAW.length - 1].date} value={cStart} onChange={(e) => setCStart(e.target.value)} />
            <span>to</span>
            <input type="date" min={RAW[0].date} max={RAW[RAW.length - 1].date} value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="nhc-btn" onClick={() => setIdx((v) => Math.max(0, (v == null ? periods.length - 1 : v) - 1))}>‹</button>
            <select
              value={idx == null ? periods.length - 1 : idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.ink, border: `1px solid ${C.line}`,
                borderRadius: 9, padding: "6px 10px", background: C.panel, cursor: "pointer", minWidth: 150 }}>
              {periods.map((p, i) => <option key={i} value={i}>{p.label}{gran !== "monthly" ? ` · ${p.sub}` : ""}</option>)}
            </select>
            <button className="nhc-btn" onClick={() => setIdx((v) => Math.min(periods.length - 1, (v == null ? periods.length - 1 : v) + 1))}>›</button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>Compare to previous</span>
          <span onClick={() => setCompare((v) => !v)} style={{
            width: 38, height: 22, borderRadius: 12, background: compare ? accent : "#D3D7DD",
            position: "relative", transition: "background .15s",
          }}>
            <span style={{ position: "absolute", top: 2, left: compare ? 18 : 2, width: 18, height: 18, borderRadius: "50%",
              background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "left .15s" }} />
          </span>
        </label>
      </div>

      {/* period summary line */}
      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, display: "inline-block" }} />
        <b style={{ color: C.ink }}>{cur.label}</b>
        <span style={{ color: C.faint }}>· {A.ndays} day{A.ndays > 1 ? "s" : ""} · {CH[channel].label}</span>
        {compare && prev && <span style={{ color: C.faint }}>vs <b style={{ color: C.sub }}>{prev.label}</b></span>}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["spends", A.spends], ["installs", A.installs], ["cpi", A.cpi],
          ["revenue", A.revenue], ["roi", A.roi], ["ctr", A.ctr],
        ].map(([k, v]) => {
          const cfg = M[k];
          const na = isApple && (k === "cpi" || k === "ctr") && !A.spends;
          return (
            <div key={k} className="nhc-card" style={{ padding: "13px 15px" }}>
              <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600, letterSpacing: 0.3, marginBottom: 7 }}>{cfg.label}</div>
              <div className="nhc-disp" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
                {na ? "—" : cfg.fmt(v)}
              </div>
              {compare && P && !na && (
                <div style={{ marginTop: 5 }}><Delta d={delta(v, P[k], cfg.sense)} /></div>
              )}
            </div>
          );
        })}
      </div>

      {/* funnel + breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* funnel */}
        <div className="nhc-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div style={{ fontWeight: 650, fontSize: 15 }}>Conversion funnel</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>step rate shown between stages</div>
          </div>

          {isApple && !A.impr && (
            <div style={{ fontSize: 12, color: C.sub, background: "#FAFAFB", border: `1px dashed ${C.line}`,
              borderRadius: 10, padding: "9px 12px", marginBottom: 14 }}>
              Apple Ads upper funnel (impressions / clicks) isn’t tracked in this sheet — installs, packs & revenue are attributed.
            </div>
          )}

          {stages.map((s, i) => {
            const w = Math.max(2, (s.val / funnelMax) * 100);
            const pcur = compare && P ? aggregate(cur.days, channel)[s.k] : null;
            const dl = compare && P ? delta(s.val, P[s.k], "pos") : null;
            return (
              <div key={s.k} style={{ marginBottom: i === stages.length - 1 ? 4 : 18 }}>
                {s.conv != null && (
                  <div style={{ fontSize: 11, color: C.faint, margin: "0 0 7px 2px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#B7BEC7" }}>↓</span> {s.convLabel} <b style={{ color: C.sub, fontWeight: 600 }}>{pct(s.conv)}</b>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ height: 34, borderRadius: 8, width: `${w}%`, minWidth: 64,
                      background: `linear-gradient(90deg, ${accent}, ${accent}C8)`,
                      display: "flex", alignItems: "center", paddingLeft: 12, transition: "width .3s" }}>
                      <span className="nhc-disp" style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{intf(s.val)}</span>
                    </div>
                  </div>
                  <div style={{ width: 92, textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{s.label}</div>
                    {dl && <Delta d={dl} />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* outcome */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line2}`, display: "flex", gap: 22 }}>
            <Outcome label="Revenue (D0)" value={inr(A.revenue)} d={compare && P ? delta(A.revenue, P.revenue, "pos") : null} accent={accent} />
            <Outcome label="ROI" value={roiF(A.roi)} d={compare && P ? delta(A.roi, P.roi, "pos") : null} accent={accent} na={isApple && !A.spends} />
            <Outcome label="CPI" value={money2(A.cpi)} d={compare && P ? delta(A.cpi, P.cpi, "neg") : null} accent={accent} na={isApple && !A.spends} />
          </div>
        </div>

        {/* breakdown */}
        <div className="nhc-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 16 }}>
            {channel === "overall" ? "Channel mix" : "Pack maturation"}
          </div>
          {channel === "overall"
            ? <ChannelMix days={cur.days} />
            : <PackMix A={A} accent={accent} />}
        </div>
      </div>

      {/* trend */}
      <div className="nhc-card" style={{ padding: "18px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 650, fontSize: 15 }}>
              {isDailyTrend ? "Daily" : trendGran === "weekly" ? "Weekly" : "Monthly"} trend · {CH[channel].label}
            </div>
            <Seg items={[{ key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" }]}
              value={trendGran} onChange={setTrendGran} accentMap={() => accent} />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["spends", "revenue", "installs", "impr", "clicks", "roi", "cpi", "ctr"].map((k) => (
              <button key={k} onClick={() => setTrendMetric(k)} style={{
                border: "none", cursor: "pointer", padding: "5px 10px", borderRadius: 7, fontSize: 12,
                fontWeight: trendMetric === k ? 650 : 500,
                background: trendMetric === k ? accent + "1A" : "transparent",
                color: trendMetric === k ? accent : C.sub,
              }}>{M[k].label}</button>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.line2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: C.faint }}
                interval={isDailyTrend ? Math.ceil(series.length / 12) : 0}
                angle={trendGran === "weekly" ? -20 : 0}
                textAnchor={trendGran === "weekly" ? "end" : "middle"}
                height={trendGran === "weekly" ? 46 : 30}
                tickLine={false} axisLine={{ stroke: C.line }} />
              <YAxis tick={{ fontSize: 10.5, fill: C.faint }} tickLine={false} axisLine={false} width={46}
                tickFormatter={(v) => tConf.ratio ? (M[trendMetric].fmt(v)) : cnt(v)} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12, fontFamily: "inherit" }}
                formatter={(v) => [M[trendMetric].fmt(v), M[trendMetric].label]} labelFormatter={(l) => l} />
              {isDailyTrend && compare && prev && (
                <ReferenceArea x1={fmtD(prevS)} x2={fmtD(prevE)} strokeOpacity={0} fill={C.neutral} fillOpacity={0.07} />
              )}
              {isDailyTrend && (
                <ReferenceArea x1={fmtD(curS)} x2={fmtD(curE)} strokeOpacity={0} fill={accent} fillOpacity={0.09} />
              )}
              {isDailyTrend && (
                <Area type="monotone" dataKey="value" stroke="none" fill="url(#g)" isAnimationActive={false} />
              )}
              {isDailyTrend && (
                <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: accent }} isAnimationActive={false} />
              )}
              {!isDailyTrend && (
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={trendGran === "monthly" ? 130 : 48} isAnimationActive={false}>
                  {series.map((d, i) => (
                    <Cell key={i} fill={d.sel ? accent : d.cmp ? C.neutral : accent + "33"} />
                  ))}
                </Bar>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: C.faint, padding: "4px 2px 10px" }}>
          {isDailyTrend
            ? `Shaded band = selected period${compare && prev ? "; grey band = compare period" : ""}.`
            : `Solid bar = selected period${compare && prev ? "; grey = compare period" : ""}; lighter bars = other ${trendGran === "weekly" ? "weeks" : "months"}.`}
        </div>
      </div>

      {/* Day of Week analysis */}
      <DayOfWeekPanel days={cur.days} label={cur.label} channel={channel} accent={accent} />

      <div style={{ fontSize: 11, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>
        Source: “DOD-NHC” tab, NHC Perf Tracker · 2 Apr – 10 Jun 2026. Overall = Google + Meta + Apple Ads. Currency ₹.
        Cost & efficiency metrics (CPI, CPM, CPC, CTR, ROI) are recomputed from summed spend/impressions/clicks for each period.
      </div>
    </div>
  );
}

/* ----------------------------- sub-panels ----------------------------- */
function Outcome({ label, value, d, accent, na }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div className="nhc-disp" style={{ fontSize: 18, fontWeight: 700, color: accent }}>{na ? "—" : value}</div>
      {d && !na && <div style={{ marginTop: 2 }}><Delta d={d} /></div>}
    </div>
  );
}

function ChannelMix({ days }) {
  const rows = ["google", "meta", "apple"].map((ch) => ({ ch, a: aggregate(days, ch) }));
  const totSpend = rows.reduce((s, r) => s + r.a.spends, 0) || 1;
  const totRev = rows.reduce((s, r) => s + r.a.revenue, 0) || 1;
  return (
    <div>
      {[["Spend", "spends", totSpend, inr], ["Revenue", "revenue", totRev, inr]].map(([title, key, tot, f]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 9 }}>{title}</div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
            {rows.map((r) => (
              <div key={r.ch} style={{ width: `${(r.a[key] / tot) * 100}%`, background: CH[r.ch].color }} title={CH[r.ch].label} />
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.ch} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: CH[r.ch].color }} />
              <span style={{ color: C.sub, flex: 1 }}>{CH[r.ch].label}</span>
              <span className="nhc-disp" style={{ fontWeight: 600 }}>{f(r.a[key])}</span>
              <span style={{ color: C.faint, width: 44, textAlign: "right" }}>{((r.a[key] / tot) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PackMix({ A, accent }) {
  const items = [
    { label: "D0 Packs", v: A.d0packs },
    { label: "D7 Packs", v: A.d7packs },
    { label: "D30 Packs", v: A.d30packs },
  ];
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>
        Purchase packs maturing over the period — D0 same-day, building to D30.
      </div>
      {items.map((it) => (
        <div key={it.label} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
            <span style={{ color: C.sub, fontWeight: 600 }}>{it.label}</span>
            <span className="nhc-disp" style={{ fontWeight: 700 }}>{intf(it.v)}</span>
          </div>
          <div style={{ height: 10, background: C.line2, borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${(it.v / max) * 100}%`, height: "100%", background: accent, borderRadius: 5 }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line2}`, display: "flex", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>Install → D30 Pack</div>
          <div className="nhc-disp" style={{ fontSize: 17, fontWeight: 700, color: accent }}>{pct(A.purchaseRate)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>Revenue / Install</div>
          <div className="nhc-disp" style={{ fontSize: 17, fontWeight: 700, color: accent }}>
            {A.installs ? money2(A.revenue / A.installs) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Day of Week Panel ----------------------------- */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayOfWeekPanel({ days, label, channel, accent }) {
  const [dowMetric, setDowMetric] = useState("cpi");
  const [dowView, setDowView] = useState("bar"); // "bar" | "heatmap"

  // Aggregate by day of week — only from the selected period's days
  const byDow = useMemo(() => {
    const buckets = {};
    DAYS.forEach((d) => (buckets[d] = []));
    days.forEach((r) => {
      const dow = r.day.trim();
      if (buckets[dow]) buckets[dow].push(r);
    });

    return DAYS.map((day, i) => {
      const ds = buckets[day];
      if (!ds.length) return { day, short: DAY_SHORT[i], n: 0, cpi: null, roi: null, installs: null, spends: null, revenue: null, ctr: null, cvr: null };
      const a = aggregate(ds, channel);
      return {
        day, short: DAY_SHORT[i], n: ds.length,
        cpi: a.cpi, roi: a.roi, installs: a.installs,
        spends: a.spends, revenue: a.revenue, ctr: a.ctr,
        cvr: a.cvr,
      };
    });
  }, [days, channel]);

  const DOW_METRICS = [
    { key: "cpi", label: "CPI", fmt: money2, sense: "neg", note: "Lower is better" },
    { key: "roi", label: "ROI", fmt: roiF, sense: "pos", note: "Higher is better" },
    { key: "ctr", label: "CTR", fmt: pct, sense: "pos", note: "Higher is better" },
    { key: "installs", label: "Installs", fmt: cnt, sense: "pos", note: "Volume" },
    { key: "spends", label: "Spend", fmt: inr, sense: "neutral", note: "Total spend" },
    { key: "revenue", label: "Revenue", fmt: inr, sense: "pos", note: "Total revenue" },
  ];

  const mConf = DOW_METRICS.find((m) => m.key === dowMetric);
  const vals = byDow.map((d) => d[dowMetric]).filter((v) => v != null && !isNaN(v));
  const maxVal = Math.max(...vals, 1);
  const minVal = Math.min(...vals);
  const avgVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  // Best/worst day
  const sense = mConf.sense;
  const bestDay = byDow.reduce((best, d) => {
    if (d[dowMetric] == null) return best;
    if (!best) return d;
    if (sense === "neg") return d[dowMetric] < best[dowMetric] ? d : best;
    return d[dowMetric] > best[dowMetric] ? d : best;
  }, null);
  const worstDay = byDow.reduce((worst, d) => {
    if (d[dowMetric] == null) return worst;
    if (!worst) return d;
    if (sense === "neg") return d[dowMetric] > worst[dowMetric] ? d : worst;
    return d[dowMetric] < worst[dowMetric] ? d : worst;
  }, null);

  // Color scale for bar
  function barColor(d) {
    if (d[dowMetric] == null) return C.line2;
    if (d.day === bestDay?.day) return sense === "neutral" ? accent : C.up;
    if (d.day === worstDay?.day) return sense === "neutral" ? accent : C.down;
    return accent + "99";
  }

  // Heatmap: all 4 efficiency metrics × 7 days
  const HEAT_METRICS = [
    { key: "cpi", label: "CPI", sense: "neg", fmt: money2 },
    { key: "roi", label: "ROI", sense: "pos", fmt: roiF },
    { key: "ctr", label: "CTR", sense: "pos", fmt: pct },
    { key: "cvr", label: "Click→Install", sense: "pos", fmt: pct },
  ];

  function heatColor(val, allVals, sense) {
    if (val == null || isNaN(val)) return "#F0F2F5";
    const min = Math.min(...allVals), max = Math.max(...allVals);
    const t = max === min ? 0.5 : (val - min) / (max - min); // 0–1
    const score = sense === "neg" ? 1 - t : t; // higher score = better
    if (score >= 0.75) return "#D1FAE5";
    if (score >= 0.5) return "#FEF9C3";
    if (score >= 0.25) return "#FEE2E2";
    return "#FECACA";
  }

  return (
    <div className="nhc-card" style={{ padding: "18px 20px", marginTop: 16 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 15 }}>Day of Week Analysis · {CH[channel].label}</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>
            Based on <b style={{ color: C.sub }}>{label}</b> · {days.length} day{days.length !== 1 ? "s" : ""} · {byDow.filter(d => d.n > 0).length} day-of-week buckets with data
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Seg items={[{ key: "bar", label: "Bar view" }, { key: "heatmap", label: "Heatmap" }]}
            value={dowView} onChange={setDowView} accentMap={() => accent} />
        </div>
      </div>

      {dowView === "bar" ? (
        <>
          {/* metric selector */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
            {DOW_METRICS.map((m) => (
              <button key={m.key} onClick={() => setDowMetric(m.key)} style={{
                border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: 7, fontSize: 12.5,
                fontWeight: dowMetric === m.key ? 650 : 500,
                background: dowMetric === m.key ? accent + "1A" : "transparent",
                color: dowMetric === m.key ? accent : C.sub,
              }}>{m.label}</button>
            ))}
          </div>

          {/* insight strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            {bestDay && (
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>🏆</span>
                <div>
                  <div style={{ fontSize: 11, color: "#15803D", fontWeight: 600 }}>Best day · {mConf.label}</div>
                  <div className="nhc-disp" style={{ fontSize: 15, fontWeight: 700, color: "#15803D" }}>
                    {bestDay.day} — {mConf.fmt(bestDay[dowMetric])}
                  </div>
                </div>
              </div>
            )}
            {worstDay && worstDay.day !== bestDay?.day && (
              <div style={{ background: "#FFF7F7", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 11, color: "#B91C1C", fontWeight: 600 }}>Weakest day · {mConf.label}</div>
                  <div className="nhc-disp" style={{ fontSize: 15, fontWeight: 700, color: "#B91C1C" }}>
                    {worstDay.day} — {mConf.fmt(worstDay[dowMetric])}
                  </div>
                </div>
              </div>
            )}
            <div style={{ background: C.line2, borderRadius: 10, padding: "8px 14px" }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>Weekly avg · {mConf.label}</div>
              <div className="nhc-disp" style={{ fontSize: 15, fontWeight: 700 }}>{mConf.fmt(avgVal)}</div>
            </div>
          </div>

          {/* bars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {byDow.map((d) => {
              const w = d[dowMetric] != null ? Math.max(4, (d[dowMetric] / maxVal) * 100) : 0;
              const isBest = d.day === bestDay?.day;
              const isWorst = d.day === worstDay?.day && d.day !== bestDay?.day;
              return (
                <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  {/* value label */}
                  <div className="nhc-disp" style={{ fontSize: 13, fontWeight: 700, color: isBest ? C.up : isWorst ? C.down : C.ink }}>
                    {d[dowMetric] != null ? mConf.fmt(d[dowMetric]) : "—"}
                  </div>
                  {/* bar */}
                  <div style={{ width: "100%", height: 160, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{
                      width: "100%", height: `${w}%`, minHeight: d[dowMetric] != null ? 6 : 0,
                      background: barColor(d), borderRadius: "6px 6px 0 0",
                      transition: "height .3s", position: "relative",
                    }}>
                      {isBest && <div style={{ position: "absolute", top: -20, width: "100%", textAlign: "center", fontSize: 14 }}>🏆</div>}
                      {isWorst && <div style={{ position: "absolute", top: -20, width: "100%", textAlign: "center", fontSize: 14 }}>⚠️</div>}
                    </div>
                  </div>
                  {/* day label */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: isBest ? C.up : isWorst ? C.down : C.sub }}>{d.short}</div>
                  <div style={{ fontSize: 10.5, color: C.faint }}>{d.n}w</div>
                </div>
              );
            })}
          </div>

          {/* avg reference line note */}
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.faint }}>
            {mConf.note} · {mConf.fmt(avgVal)} avg across selected period · {days.length} days of data
          </div>
        </>
      ) : (
        /* heatmap view */
        <>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>
            Color scale per metric: <span style={{ background: "#D1FAE5", padding: "1px 8px", borderRadius: 4, fontSize: 11 }}>Best</span>{" "}
            <span style={{ background: "#FEF9C3", padding: "1px 8px", borderRadius: 4, fontSize: 11 }}>Mid</span>{" "}
            <span style={{ background: "#FECACA", padding: "1px 8px", borderRadius: 4, fontSize: 11 }}>Worst</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 12, color: C.sub, fontWeight: 600, textAlign: "left", paddingBottom: 8, width: 120 }}>Metric</th>
                  {byDow.map((d) => (
                    <th key={d.day} style={{ fontSize: 12, color: C.sub, fontWeight: 600, textAlign: "center", paddingBottom: 8 }}>{d.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEAT_METRICS.map((hm) => {
                  const rowVals = byDow.map((d) => d[hm.key]).filter((v) => v != null && !isNaN(v));
                  return (
                    <tr key={hm.key}>
                      <td style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, paddingRight: 12, paddingBottom: 6 }}>
                        {hm.label}
                        <div style={{ fontSize: 10.5, color: C.faint, fontWeight: 400 }}>{hm.sense === "neg" ? "↓ lower better" : "↑ higher better"}</div>
                      </td>
                      {byDow.map((d) => {
                        const val = d[hm.key];
                        const bg = heatColor(val, rowVals, hm.sense);
                        return (
                          <td key={d.day} style={{
                            background: bg, borderRadius: 8, textAlign: "center",
                            padding: "10px 4px", fontSize: 12.5, fontWeight: 700,
                            color: "#1F2937", minWidth: 72,
                          }}>
                            <div className="nhc-disp">{val != null ? hm.fmt(val) : "—"}</div>
                            {d.day === byDow.reduce((b, x) => {
                              if (x[hm.key] == null) return b;
                              if (!b) return x;
                              return hm.sense === "neg" ? (x[hm.key] < b[hm.key] ? x : b) : (x[hm.key] > b[hm.key] ? x : b);
                            }, null)?.day && <div style={{ fontSize: 9, marginTop: 2 }}>🏆</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.faint }}>
            Each cell aggregates all occurrences of that day within <b>{label}</b>. Efficiency metrics recomputed from summed spend/installs per day-of-week bucket.
          </div>
        </>
      )}
    </div>
  );
}
