// Compact charting primitives — hand-rolled SVG, dark-mode tuned

const ACCENT = "#5EEAD4"; // teal accent
const DEMAND_COLORS = {
  Low: "#3F8F6E",
  Moderate: "#D4A24C",
  High: "#E26D5C",
};
const DEMAND_COLORS_BRIGHT = {
  Low: "#52C49A",
  Moderate: "#F0B95B",
  High: "#F08574",
};

// ---------- Ranked horizontal bar chart ----------
function RankedBarChart({ data, hovered, onHover, onClick, max }) {
  // data: [{precinct, value, demand}]
  const m = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-[3px]">
      {data.map((d) => {
        const pct = (d.value / m) * 100;
        const isHover = hovered === d.precinct;
        return (
          <div
            key={d.precinct}
            onMouseEnter={() => onHover && onHover(d.precinct)}
            onMouseLeave={() => onHover && onHover(null)}
            onClick={() => onClick && onClick(d.precinct)}
            className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
              isHover ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
            }`}
          >
            <span className="text-[10px] font-mono text-neutral-500 w-8 tabular-nums">
              {String(d.precinct).padStart(3, "0")}
            </span>
            <div className="flex-1 h-[18px] relative bg-white/[0.025] rounded-sm overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-200"
                style={{
                  width: `${pct}%`,
                  background: isHover
                    ? DEMAND_COLORS_BRIGHT[d.demand]
                    : DEMAND_COLORS[d.demand],
                }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-1.5">
                <span className="text-[10px] font-mono text-white/90 tabular-nums">
                  {Math.round(d.value).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Heatmap (hour × dow) ----------
function HeatmapChart({ grid, max, onCellHover, hoveredCell, compact }) {
  // grid: 7 rows × 24 cols
  const m = max || Math.max(...grid.flat(), 1);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const cellH = compact ? 14 : 18;
  return (
    <div className="w-full">
      <div className="flex flex-col gap-[2px]">
        {grid.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-neutral-500 w-3 text-right">
              {days[d]}
            </span>
            <div className="flex-1 grid grid-cols-24 gap-[2px]">
              {row.map((v, h) => {
                const intensity = Math.pow(v / m, 0.7);
                const isHover =
                  hoveredCell && hoveredCell.h === h && hoveredCell.d === d;
                return (
                  <div
                    key={h}
                    onMouseEnter={() =>
                      onCellHover && onCellHover({ h, d, v })
                    }
                    onMouseLeave={() => onCellHover && onCellHover(null)}
                    style={{
                      height: cellH,
                      background: `rgba(94, 234, 212, ${0.04 + intensity * 0.85})`,
                      outline: isHover ? "1px solid #5EEAD4" : "none",
                    }}
                    className="rounded-[2px] transition-colors cursor-crosshair"
                    title={`${days[d]} ${String(h).padStart(2, "0")}:00 — ${v.toLocaleString()}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-1.5 pl-4">
        {[0, 4, 8, 12, 16, 20].map((h) => (
          <span
            key={h}
            className="text-[9px] font-mono text-neutral-600"
            style={{ width: `${(4 / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Donut chart ----------
function DonutChart({ data, size = 140, stroke = 18 }) {
  // data: [{label, value, color}]
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={stroke}
        />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const dasharray = `${len} ${c - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-sm"
                style={{ background: d.color }}
              />
              <span className="text-[11px] text-neutral-300 w-16">
                {d.label}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-neutral-400 w-10 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Line chart (monthly time series) ----------
function LineChart({ data, height = 120, currentMonth, onMonthHover }) {
  // data: [{month: 1..12, value}]
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const W = 1000; // viewBox width — scales
  const H = height;
  const padL = 40,
    padR = 20,
    padT = 10,
    padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const x = (i) => padL + (i / (data.length - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - min) / (max - min || 1)) * innerH;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const area =
    `M ${x(0)} ${padT + innerH} ` +
    data.map((d, i) => `L ${x(i)} ${y(d.value)}`).join(" ") +
    ` L ${x(data.length - 1)} ${padT + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH * t}
          y2={padT + innerH * t}
          stroke="rgba(255,255,255,0.04)"
        />
      ))}
      {/* y axis labels */}
      {[0, 0.5, 1].map((t, i) => {
        const v = max - (max - min) * t;
        return (
          <text
            key={i}
            x={padL - 6}
            y={padT + innerH * t + 4}
            textAnchor="end"
            className="fill-neutral-600"
            style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
          >
            {Math.round(v / 1000)}k
          </text>
        );
      })}
      <path d={area} fill="url(#lc-area)" />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.5" />
      {data.map((d, i) => {
        const isCurrent = currentMonth === d.month;
        return (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={isCurrent ? 4 : 2.5}
              fill={isCurrent ? ACCENT : "#0a0a0a"}
              stroke={ACCENT}
              strokeWidth="1.2"
            />
            <rect
              x={x(i) - 30}
              y={padT}
              width={60}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => onMonthHover && onMonthHover(d.month)}
              onMouseLeave={() => onMonthHover && onMonthHover(null)}
              style={{ cursor: "pointer" }}
            />
            <text
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className={isCurrent ? "fill-neutral-200" : "fill-neutral-600"}
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            >
              {months[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, {
  RankedBarChart,
  HeatmapChart,
  DonutChart,
  LineChart,
  DEMAND_COLORS,
  DEMAND_COLORS_BRIGHT,
  ACCENT,
});
