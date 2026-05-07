// Main dashboard app

const { useState, useEffect, useMemo, useCallback } = React;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toLocaleString();
}

// ---------- Filter rail ----------
function FilterRail({ filters, setFilters }) {
  const setHour = (h) => setFilters((f) => ({ ...f, hour: h }));
  const toggleDow = (d) =>
    setFilters((f) => {
      const next = new Set(f.dows);
      if (next.has(d)) {
        if (next.size > 1) next.delete(d);
      } else next.add(d);
      return { ...f, dows: next };
    });
  const setMonth = (m) => setFilters((f) => ({ ...f, month: m }));
  const setColorBy = (c) => setFilters((f) => ({ ...f, colorBy: c }));
  const setHourMode = (m) =>
    setFilters((f) => ({ ...f, hourMode: m }));

  return (
    <aside className="w-[260px] shrink-0 border-r border-white/[0.06] bg-neutral-950 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-neutral-500 tracking-[0.18em]">
          FILTERS
        </div>
      </div>

      {/* Hour */}
      <Section
        label="HOUR OF DAY"
        right={
          <div className="flex gap-0.5 text-[9px] font-mono">
            <button
              onClick={() => setHourMode("single")}
              className={`px-1.5 py-0.5 rounded ${
                filters.hourMode === "single"
                  ? "bg-white/10 text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              SINGLE
            </button>
            <button
              onClick={() => setHourMode("all")}
              className={`px-1.5 py-0.5 rounded ${
                filters.hourMode === "all"
                  ? "bg-white/10 text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              24H AVG
            </button>
          </div>
        }
      >
        <div className={filters.hourMode === "all" ? "opacity-40 pointer-events-none" : ""}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[28px] font-light tabular-nums text-neutral-100 tracking-tight">
              {String(filters.hour).padStart(2, "0")}
              <span className="text-neutral-500">:00</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              {hourLabel(filters.hour)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="23"
            value={filters.hour}
            onChange={(e) => setHour(parseInt(e.target.value, 10))}
            className="w-full hour-slider"
          />
          <div className="flex justify-between mt-1">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h} className="text-[9px] font-mono text-neutral-600">
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* Day of week */}
      <Section label="DAY OF WEEK">
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => {
            const active = filters.dows.has(i);
            return (
              <button
                key={i}
                onClick={() => toggleDow(i)}
                className={`h-7 rounded text-[10px] font-mono transition-colors ${
                  active
                    ? "bg-teal-300/15 text-teal-200 border border-teal-300/30"
                    : "border border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/15"
                }`}
              >
                {d.slice(0, 1)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-2">
          <SubChip
            active={filters.dows.size === 7}
            onClick={() =>
              setFilters((f) => ({ ...f, dows: new Set([0, 1, 2, 3, 4, 5, 6]) }))
            }
          >
            All
          </SubChip>
          <SubChip
            active={
              filters.dows.size === 5 &&
              [0, 1, 2, 3, 4].every((d) => filters.dows.has(d))
            }
            onClick={() =>
              setFilters((f) => ({ ...f, dows: new Set([0, 1, 2, 3, 4]) }))
            }
          >
            Weekdays
          </SubChip>
          <SubChip
            active={
              filters.dows.size === 2 && filters.dows.has(5) && filters.dows.has(6)
            }
            onClick={() => setFilters((f) => ({ ...f, dows: new Set([5, 6]) }))}
          >
            Weekend
          </SubChip>
        </div>
      </Section>

      {/* Month */}
      <Section label="MONTH">
        <div className="relative">
          <select
            value={filters.month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="w-full appearance-none bg-white/[0.03] border border-white/[0.08] rounded px-3 py-2 text-[12px] text-neutral-200 focus:outline-none focus:border-teal-300/40 cursor-pointer"
          >
            {MONTH_LABELS.map((m, i) => (
              <option key={i + 1} value={i + 1} className="bg-neutral-900">
                {m} 2025
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500"
            width="10"
            height="6"
            viewBox="0 0 10 6"
          >
            <path d="M0 0 L5 6 L10 0" fill="currentColor" />
          </svg>
        </div>
      </Section>

      {/* Color by */}
      <Section label="COLOR MAP BY">
        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded p-0.5">
          <button
            onClick={() => setColorBy("demand")}
            className={`flex-1 px-2 py-1.5 text-[10px] font-mono rounded transition-colors ${
              filters.colorBy === "demand"
                ? "bg-white/10 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            DEMAND LEVEL
          </button>
          <button
            onClick={() => setColorBy("count")}
            className={`flex-1 px-2 py-1.5 text-[10px] font-mono rounded transition-colors ${
              filters.colorBy === "count"
                ? "bg-white/10 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            RAW COUNT
          </button>
        </div>
      </Section>

      <Section label="MODEL">
        <div className="space-y-1.5">
          <ModelRow label="Type" value="Gradient Boost · v2.1" />
          <ModelRow label="Trained" value="Apr 28, 2026" />
          <ModelRow label="Window" value="2019–2025 · 7Y" />
          <ModelRow label="MAE" value="3.42 incidents/hr" />
        </div>
      </Section>

      <div className="mt-auto px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" />
          <span className="text-[10px] font-mono text-neutral-500">
            LIVE · synced 2m ago
          </span>
        </div>
      </div>
    </aside>
  );
}

function Section({ label, right, children }) {
  return (
    <div className="px-4 py-3.5 border-b border-white/[0.04]">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] font-mono text-neutral-500 tracking-[0.18em]">
          {label}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

function SubChip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${
        active
          ? "bg-white/10 text-neutral-200"
          : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function ModelRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between text-[10px]">
      <span className="text-neutral-500 font-mono">{label}</span>
      <span className="text-neutral-300 font-mono tabular-nums">{value}</span>
    </div>
  );
}

function hourLabel(h) {
  if (h >= 6 && h < 12) return "MORNING";
  if (h >= 12 && h < 17) return "AFTERNOON";
  if (h >= 17 && h < 22) return "EVENING";
  return "OVERNIGHT";
}

// ---------- Top bar / KPIs ----------
function TopBar({ kpis, filters }) {
  return (
    <header className="h-[60px] border-b border-white/[0.06] bg-neutral-950 flex items-stretch shrink-0">
      <div className="px-5 flex items-center gap-3 border-r border-white/[0.06] min-w-[260px]">
        <div className="w-7 h-7 rounded bg-teal-300/10 border border-teal-300/30 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1 L13 4 V8 C13 11 10 13 7 13 C4 13 1 11 1 8 V4 Z"
              stroke="#5EEAD4" strokeWidth="1.2" />
            <circle cx="7" cy="7" r="2" fill="#5EEAD4" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[12px] text-neutral-100 font-medium tracking-tight">
            Sentinel <span className="text-neutral-500 font-normal">/ NYPD Ops</span>
          </div>
          <div className="text-[9px] font-mono text-neutral-500 tracking-wider">
            DEMAND FORECAST · v2.1
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center">
        <KPI label="Citywide forecast" value={formatNum(kpis.cityTotal)}
          sub={`incidents in window`} />
        <KPI label="Avg / precinct" value={formatNum(kpis.avg)}
          sub={`across ${kpis.activePrecincts} precincts`} />
        <KPI label="Peak precinct" value={`#${String(kpis.peakPrecinct).padStart(3, "0")}`}
          sub={kpis.peakBoro} accent />
        <KPI label="Peak hour" value={`${String(kpis.peakHour).padStart(2, "0")}:00`}
          sub={`${formatNum(kpis.peakHourValue)} incidents`} />
        <KPI label="High-demand precincts" value={kpis.highCount.toString()}
          sub={`${Math.round((kpis.highCount / kpis.activePrecincts) * 100)}% of total`} />
      </div>

    </header>
  );
}

function KPI({ label, value, sub, accent }) {
  return (
    <div className="px-5 py-2 border-r border-white/[0.04] min-w-[160px]">
      <div className="text-[9px] font-mono text-neutral-500 tracking-[0.14em] uppercase mb-0.5">
        {label}
      </div>
      <div className={`text-[20px] font-light tabular-nums tracking-tight ${
        accent ? "text-teal-300" : "text-neutral-100"
      }`}>
        {value}
      </div>
      <div className="text-[9.5px] font-mono text-neutral-500 mt-0.5 truncate">
        {sub}
      </div>
    </div>
  );
}

// ---------- Side panel for selected precinct ----------
function PrecinctPanel({ precinct, filters, onClose }) {
  if (!precinct) return null;
  const data = window.NYPDData;
  const grid = useMemo(
    () => data.precinctHeatmap(precinct, filters.month),
    [precinct, filters.month]
  );
  const max = Math.max(...grid.flat(), 1);
  const cluster = data.CLUSTER_OF[precinct];
  const boro = data.BOROUGH_OF(precinct);

  // Current-window stats for this precinct
  const hours = filters.hourMode === "all" ? Array.from({ length: 24 }, (_, i) => i) : [filters.hour];
  const dows = Array.from(filters.dows);
  let sum = 0, n = 0;
  hours.forEach((h) => dows.forEach((d) => { sum += data.predict(precinct, h, d, filters.month); n++; }));
  const avg = n ? sum / n : 0;
  const lvl = data.classify(avg);

  // Peak time for this precinct in this month
  let peak = { v: -1, h: 0, d: 0 };
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) {
      const v = grid[d][h];
      if (v > peak.v) peak = { v, h, d };
    }

  return (
    <div className="absolute top-0 right-0 h-full w-[420px] bg-neutral-950 border-l border-white/[0.08] z-20 flex flex-col shadow-2xl">
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.06] flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono text-neutral-500 tracking-[0.18em] mb-1">
            PRECINCT DETAIL
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[32px] font-light tabular-nums text-neutral-100 tracking-tight leading-none">
              #{String(precinct).padStart(3, "0")}
            </span>
            <span className="text-[12px] text-neutral-400">{boro}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-200 transition-colors p-1"
          aria-label="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-3 border-b border-white/[0.06]">
        <div className="grid grid-cols-3 gap-2">
          <PanelStat label="Forecast" value={formatNum(avg)} sub="this window" />
          <PanelStat label="Demand" value={lvl} accent={DEMAND_COLORS[lvl]} />
          <PanelStat
            label="Peak"
            value={`${DAY_LABELS[peak.d].slice(0, 3)} ${String(peak.h).padStart(2, "0")}:00`}
            sub={`${formatNum(peak.v)} incidents`}
          />
        </div>
      </div>

      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="text-[9px] font-mono text-neutral-500 tracking-[0.18em] mb-3">
          HOUR × DAY HEATMAP · {MONTH_LABELS[filters.month - 1].toUpperCase()}
        </div>
        <HeatmapChart grid={grid} max={max} />
      </div>

      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="text-[9px] font-mono text-neutral-500 tracking-[0.18em] mb-2">
          CLUSTER MEMBERSHIP · K-MEANS k=4
        </div>
        <div className="flex items-center gap-3 mb-3">
          <ClusterDot c={cluster} large />
          <div>
            <div className="text-[12px] text-neutral-200">
              Cluster {cluster}
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              {data.CLUSTER_LABELS[cluster]}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((c) => (
            <div
              key={c}
              className={`flex-1 h-1 rounded-full ${
                c === cluster ? "bg-teal-300" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="text-[9px] font-mono text-neutral-500 tracking-[0.18em] mb-2">
          STAFFING RECOMMENDATION
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded p-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-neutral-400">Suggested officers</span>
            <span className="text-[20px] font-light tabular-nums text-teal-300">
              {Math.max(4, Math.round(avg / 4))}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 leading-relaxed">
            Based on {lvl.toLowerCase()} demand classification at {Math.round(avg)} predicted incidents · 1 officer per 4 incidents/hr baseline.
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelStat({ label, value, sub, accent }) {
  return (
    <div>
      <div className="text-[9px] font-mono text-neutral-500 tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className="text-[16px] font-light tabular-nums tracking-tight"
        style={{ color: accent || "#e5e5e5" }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9.5px] font-mono text-neutral-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function ClusterDot({ c, large }) {
  const colors = ["#E26D5C", "#D4A24C", "#5EEAD4", "#6B7C8A"];
  const sz = large ? 28 : 10;
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: sz,
        height: sz,
        background: `${colors[c]}25`,
        border: `1px solid ${colors[c]}80`,
      }}
    >
      {large && (
        <span className="text-[11px] font-mono tabular-nums" style={{ color: colors[c] }}>
          C{c}
        </span>
      )}
    </div>
  );
}

// ---------- Card wrapper ----------
function Card({ title, sub, right, children, className = "" }) {
  return (
    <div className={`bg-neutral-950 border border-white/[0.06] rounded-md flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.04]">
        <div>
          <div className="text-[10px] font-mono text-neutral-400 tracking-[0.16em]">
            {title}
          </div>
          {sub && (
            <div className="text-[9.5px] font-mono text-neutral-600 mt-0.5">
              {sub}
            </div>
          )}
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-0 p-3.5">{children}</div>
    </div>
  );
}

// ---------- Main Dashboard ----------
function Dashboard() {
  const data = window.NYPDData;

  const [filters, setFilters] = useState({
    hour: 22,
    hourMode: "single", // 'single' | 'all'
    dows: new Set([3, 4]), // Thu, Fri
    month: 6,
    colorBy: "demand",
  });

  const [hoveredPrecinct, setHoveredPrecinct] = useState(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Aggregate for current filter
  const agg = useMemo(() => {
    const hours = filters.hourMode === "all" ? Array.from({ length: 24 }, (_, i) => i) : [filters.hour];
    return data.aggregate(hours, Array.from(filters.dows), filters.month);
  }, [filters]);

  // KPIs
  const kpis = useMemo(() => {
    const arr = Object.entries(agg.byPrecinct).map(([p, v]) => ({
      p: parseInt(p, 10),
      avg: v.avg,
    }));
    arr.sort((a, b) => b.avg - a.avg);
    const peak = arr[0];
    const total = arr.reduce((s, x) => s + x.avg, 0);
    const highCount = arr.filter((x) => data.classify(x.avg) === "High").length;

    // peak hour citywide for this month + current dows
    const dows = Array.from(filters.dows);
    let peakHour = 0, peakHourValue = -1;
    for (let h = 0; h < 24; h++) {
      let s = 0;
      data.PRECINCTS.forEach((p) => {
        dows.forEach((d) => (s += data.predict(p, h, d, filters.month)));
      });
      if (s > peakHourValue) { peakHourValue = s; peakHour = h; }
    }

    return {
      cityTotal: total * (filters.hourMode === "all" ? 24 : 1),
      avg: total / arr.length,
      activePrecincts: arr.length,
      peakPrecinct: peak.p,
      peakBoro: data.BOROUGH_OF(peak.p),
      peakHour,
      peakHourValue: peakHourValue / Array.from(filters.dows).length,
      highCount,
    };
  }, [agg, filters]);

  // Top-15 ranked
  const topRanked = useMemo(() => {
    const arr = Object.entries(agg.byPrecinct).map(([p, v]) => ({
      precinct: parseInt(p, 10),
      value: v.avg,
      demand: data.classify(v.avg),
    }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 15);
  }, [agg]);

  // City heatmap
  const cityHeat = useMemo(() => data.cityHeatmap(filters.month), [filters.month]);

  // Donut data
  const donut = useMemo(() => {
    const total = agg.dist.Low + agg.dist.Moderate + agg.dist.High;
    return [
      { label: "High", value: agg.dist.High, color: DEMAND_COLORS.High },
      { label: "Moderate", value: agg.dist.Moderate, color: DEMAND_COLORS.Moderate },
      { label: "Low", value: agg.dist.Low, color: DEMAND_COLORS.Low },
    ];
  }, [agg]);

  // Monthly time-series
  const monthly = useMemo(() => data.monthlySeries(), []);

  // Map values: pass {precinct: {avg}} dict
  const mapValues = useMemo(() => {
    const out = {};
    Object.entries(agg.byPrecinct).forEach(([p, v]) => (out[p] = v.avg));
    return out;
  }, [agg]);

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-200 overflow-hidden">
      <TopBar kpis={kpis} filters={filters} />
      <div className="flex flex-1 min-h-0">
        <FilterRail filters={filters} setFilters={setFilters} />

        {/* Main canvas */}
        <main className="flex-1 min-w-0 p-3 flex flex-col gap-3 relative">
          {/* Top section: map + side charts */}
          <div className="flex gap-3 flex-1 min-h-0" style={{ flexBasis: "65%" }}>
            {/* Map */}
            <Card
              title="PRECINCT FORECAST MAP"
              sub={`${filters.hourMode === "all" ? "24h avg" : `${String(filters.hour).padStart(2, "0")}:00`} · ${[...filters.dows].map(d => DAY_LABELS[d].slice(0,3)).join(", ")} · ${MONTH_LABELS[filters.month - 1]}`}
              className="flex-1 min-w-0"
              right={
                <div className="flex items-center gap-2">
                  {hoveredPrecinct && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.04] rounded">
                      <span className="text-[10px] font-mono text-neutral-500">P</span>
                      <span className="text-[11px] font-mono text-neutral-100 tabular-nums">
                        #{String(hoveredPrecinct).padStart(3, "0")}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {Math.round(agg.byPrecinct[hoveredPrecinct]?.avg || 0)} pred.
                      </span>
                    </div>
                  )}
                </div>
              }
            >
              <div className="w-full h-full -m-3.5 mt-0">
                <div className="w-full h-full relative" style={{ height: "calc(100% + 14px)" }}>
                  <PrecinctMap
                    precinctValues={mapValues}
                    colorBy={filters.colorBy}
                    hovered={hoveredPrecinct}
                    onHover={setHoveredPrecinct}
                    selected={selectedPrecinct}
                    onSelect={setSelectedPrecinct}
                    classify={data.classify}
                  />
                </div>
              </div>
            </Card>

            {/* Right column */}
            <div className="w-[400px] shrink-0 flex flex-col gap-3 min-h-0">
              <Card
                title="TOP 15 PRECINCTS"
                sub="ranked by predicted incidents in window"
                className="flex-1 min-h-0 overflow-hidden"
              >
                <div className="overflow-y-auto h-full -mx-3.5 -my-3.5 px-2 py-2">
                  <RankedBarChart
                    data={topRanked}
                    hovered={hoveredPrecinct}
                    onHover={setHoveredPrecinct}
                    onClick={setSelectedPrecinct}
                  />
                </div>
              </Card>

              <Card title="DEMAND DISTRIBUTION"
                    sub={`${data.PRECINCTS.length} precincts × ${filters.hourMode === "all" ? 24 : 1} hr × ${filters.dows.size} day${filters.dows.size > 1 ? "s" : ""}`}>
                <div className="flex items-center justify-center h-full">
                  <DonutChart data={donut} />
                </div>
              </Card>
            </div>
          </div>

          {/* Bottom section: heatmap + line chart */}
          <div className="flex gap-3" style={{ flexBasis: "35%", minHeight: 0 }}>
            <Card
              title="CITYWIDE HEATMAP"
              sub={`hour × day-of-week · ${MONTH_LABELS[filters.month - 1]}`}
              className="flex-1 min-w-0"
              right={
                hoveredCell && (
                  <div className="text-[10px] font-mono text-neutral-300">
                    {DAY_LABELS[hoveredCell.d]} {String(hoveredCell.h).padStart(2, "0")}:00
                    <span className="text-neutral-500 ml-2">
                      {formatNum(hoveredCell.v)} incidents
                    </span>
                  </div>
                )
              }
            >
              <div className="h-full flex items-center">
                <div className="w-full">
                  <HeatmapChart
                    grid={cityHeat}
                    onCellHover={setHoveredCell}
                    hoveredCell={hoveredCell}
                  />
                </div>
              </div>
            </Card>

            <Card
              title="MONTHLY TREND"
              sub={`citywide incident totals · 12-month forecast`}
              className="w-[42%] shrink-0"
              right={
                hoveredMonth && (
                  <div className="text-[10px] font-mono text-neutral-300">
                    {MONTH_LABELS[hoveredMonth - 1]}
                    <span className="text-neutral-500 ml-2">
                      {formatNum(monthly[hoveredMonth - 1].value)}
                    </span>
                  </div>
                )
              }
            >
              <div className="h-full flex items-center">
                <LineChart
                  data={monthly}
                  currentMonth={hoveredMonth || filters.month}
                  onMonthHover={setHoveredMonth}
                  height={140}
                />
              </div>
            </Card>
          </div>

          <PrecinctPanel
            precinct={selectedPrecinct}
            filters={filters}
            onClose={() => setSelectedPrecinct(null)}
          />
        </main>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Dashboard />);
