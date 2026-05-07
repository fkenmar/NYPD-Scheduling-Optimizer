"""
Generate `design files/data.js` from `../data/predictions.csv`.

Reads the predictions CSV produced by Phase2.ipynb and writes a data.js that
exposes the same `window.NYPDData` API the React dashboard expects, but backed
by real model output instead of the synthetic mock.
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / ".." / "data" / "predictions.csv"
OUT_PATH = ROOT / "docs" / "data.js"


def borough_of(precinct: int) -> str:
    if precinct <= 34:
        return "Manhattan"
    if 40 <= precinct <= 52:
        return "Bronx"
    if 60 <= precinct <= 94:
        return "Brooklyn"
    if 100 <= precinct <= 115:
        return "Queens"
    return "Staten Island"


def main() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(
            f"Predictions file not found at {CSV_PATH}. "
            "Run Phase2.ipynb to generate it first."
        )

    df = pd.read_csv(CSV_PATH)

    # Collapse duplicate (precinct, hour, dow, month) rows that arise from the
    # boro_encoded placeholder split between arrests and crashes.
    grouped = (
        df.groupby(["ARREST_PRECINCT", "month", "day_of_week", "hour"], as_index=False)
        .agg(incident_count=("incident_count", "sum"))
    )

    counts: dict = {}
    for row in grouped.itertuples():
        p, m, d, h = int(row.ARREST_PRECINCT), int(row.month), int(row.day_of_week), int(row.hour)
        counts.setdefault(p, {}).setdefault(m, {}).setdefault(d, {})[h] = float(row.incident_count)

    precincts = sorted(counts.keys())

    cluster_of = (
        df.groupby("ARREST_PRECINCT")["precinct_cluster"]
        .agg(lambda s: int(s.mode().iloc[0]))
        .to_dict()
    )
    cluster_of = {int(k): int(v) for k, v in cluster_of.items()}

    sorted_counts = grouped["incident_count"].sort_values().values
    p60 = float(sorted_counts[int(len(sorted_counts) * 0.60)])
    p85 = float(sorted_counts[int(len(sorted_counts) * 0.85)])

    borough_map = {p: borough_of(p) for p in precincts}

    # Heuristic cluster labels based on average peak hour per cluster
    avg_peak_hour_by_cluster: dict = {}
    for c in sorted(set(cluster_of.values())):
        cluster_precincts = [p for p, cc in cluster_of.items() if cc == c]
        peak_hours = []
        for p in cluster_precincts:
            best_h, best_v = 0, -1
            for m_dict in counts.get(p, {}).values():
                for d_dict in m_dict.values():
                    for h, v in d_dict.items():
                        if v > best_v:
                            best_h, best_v = h, v
            peak_hours.append(best_h)
        avg_peak_hour_by_cluster[c] = sum(peak_hours) / len(peak_hours) if peak_hours else 0

    cluster_labels: dict = {}
    for c, avg_h in avg_peak_hour_by_cluster.items():
        if avg_h < 6 or avg_h >= 22:
            cluster_labels[c] = "Overnight-peaked"
        elif avg_h < 12:
            cluster_labels[c] = "Morning-peaked"
        elif avg_h < 18:
            cluster_labels[c] = "Afternoon-peaked"
        else:
            cluster_labels[c] = "Evening-peaked"

    payload = {
        "PRECINCTS": precincts,
        "COUNTS": counts,
        "CLUSTER_OF": cluster_of,
        "BOROUGH_OF": borough_map,
        "CLUSTER_LABELS": cluster_labels,
        "P60": p60,
        "P85": p85,
    }

    payload_json = json.dumps(payload, separators=(",", ":"))

    js = f"""// AUTO-GENERATED from ../data/predictions.csv by build_dashboard_data.py.
// Do not edit by hand — re-run the script to refresh.

(function () {{
  const D = {payload_json};

  function predict(precinct, hour, dow, month) {{
    const m = D.COUNTS[precinct];
    if (!m) return 0;
    const dd = m[month];
    if (!dd) return 0;
    const hh = dd[dow];
    if (!hh) return 0;
    return hh[hour] || 0;
  }}

  function classify(count) {{
    if (count >= D.P85) return "High";
    if (count >= D.P60) return "Moderate";
    return "Low";
  }}

  window.NYPDData = {{
    PRECINCTS: D.PRECINCTS,
    BOROUGH_OF: (p) => D.BOROUGH_OF[p] || "Unknown",
    BASE_INTENSITY: {{}},
    CLUSTER_OF: D.CLUSTER_OF,
    CLUSTER_LABELS: D.CLUSTER_LABELS,
    predict,
    classify,
    thresholds: {{ P60: D.P60, P85: D.P85 }},

    cityForWindow(hour, dow, month) {{
      let total = 0;
      const byPrecinct = {{}};
      D.PRECINCTS.forEach((p) => {{
        const c = predict(p, hour, dow, month);
        byPrecinct[p] = c;
        total += c;
      }});
      return {{ total, byPrecinct }};
    }},

    aggregate(hours, dows, month) {{
      const byPrecinct = {{}};
      let total = 0;
      const dist = {{ Low: 0, Moderate: 0, High: 0 }};
      D.PRECINCTS.forEach((p) => {{
        let sum = 0, n = 0;
        hours.forEach((h) => {{
          dows.forEach((d) => {{
            const c = predict(p, h, d, month);
            sum += c;
            n++;
            dist[classify(c)]++;
          }});
        }});
        const avg = n ? sum / n : 0;
        byPrecinct[p] = {{ avg, total: sum }};
        total += sum;
      }});
      return {{ byPrecinct, total, dist }};
    }},

    cityHeatmap(month) {{
      const grid = [];
      for (let d = 0; d < 7; d++) {{
        const row = [];
        for (let h = 0; h < 24; h++) {{
          let sum = 0;
          D.PRECINCTS.forEach((p) => (sum += predict(p, h, d, month)));
          row.push(sum);
        }}
        grid.push(row);
      }}
      return grid;
    }},

    precinctHeatmap(precinct, month) {{
      const grid = [];
      for (let d = 0; d < 7; d++) {{
        const row = [];
        for (let h = 0; h < 24; h++) {{
          row.push(predict(precinct, h, d, month));
        }}
        grid.push(row);
      }}
      return grid;
    }},

    monthlySeries() {{
      const out = [];
      for (let m = 1; m <= 12; m++) {{
        let sum = 0;
        D.PRECINCTS.forEach((p) => {{
          for (let h = 0; h < 24; h++) {{
            for (let d = 0; d < 7; d++) {{
              sum += predict(p, h, d, m);
            }}
          }}
        }});
        out.push({{ month: m, value: sum }});
      }}
      return out;
    }},
  }};
}})();
"""

    OUT_PATH.write_text(js)
    print(f"Wrote {OUT_PATH}")
    print(f"  size: {len(js):,} bytes")
    print(f"  precincts: {len(precincts)}")
    print(f"  classify thresholds: P60={p60:.1f}, P85={p85:.1f}")


if __name__ == "__main__":
    main()
