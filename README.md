# Optimal NYPD Scheduling Model
https://fkenmar.github.io/NYPD-Scheduling-Optimizer/

A data science project that uses NYPD arrest records and motor vehicle collision data to build machine learning models for optimizing police officer scheduling across New York City precincts. Outputs feed an interactive web dashboard.
(Updated Every Week)

## Overview

The project predicts incident demand (arrests + crashes) at the precinct level across time windows (hour × day × month), then classifies each window as Low, Moderate, or High demand. The outputs directly inform staffing decisions — which precincts need more officers, and when.

## Data Sources

| Dataset | Records | Source |
|---|---|---|
| NYPD Arrest Data (Year-to-Date) | ~279K | NYC Open Data (`uip8-fykc`) |
| Motor Vehicle Collisions – Crashes | ~2M | NYC Open Data (`h9gi-nx95`) |
| Police Precinct boundaries (GeoJSON) | 78 polygons | NYC Open Data (`y76i-bdw7`) |

Raw datasets are pulled directly from the NYC Open Data API in `clean.ipynb` — no manual download required. Generated CSVs and the dashboard's `data.js` build artifact are excluded from version control (see `.gitignore`).

## Pipeline

```
clean.ipynb  →  ../data/{arrests,crashes}_cleaned.csv
Phase2.ipynb →  ../data/predictions.csv
build_dashboard_data.py →  docs/data.js
docs/index.html (served statically) →  interactive UI
```

## Notebooks

### `clean.ipynb` — Data Cleaning

- Loads raw arrests + crashes directly from NYC Open Data via `pd.read_csv(api_url)`
- Drops rows missing critical fields (`ARREST_DATE`, `ARREST_PRECINCT`, coordinates)
- Fills missing boroughs with `UNKNOWN` rather than dropping
- Caps injury count outliers at the 99th percentile
- Filters coordinates to a valid NYC bounding box (removes ~248K crash rows with bad GPS)
- Engineers temporal features: `hour`, `day_of_week`, `month`, `year`
- Outputs `../data/arrests_cleaned.csv` and `../data/crashes_cleaned.csv`

### `eda.ipynb` — Exploratory Data Analysis

Visualizes patterns in the cleaned data and builds baseline sklearn models:

- **Borough distribution**: Brooklyn and Manhattan lead in arrests; Brooklyn and Queens lead in crashes
- **Demographics**: Adults 25–44 account for the majority of arrests; male arrests outnumber female ~4:1
- **Top offenses**: Assault, controlled substance offenses, and petit larceny dominate
- **Temporal patterns**: Arrests are distributed across weekdays with slight weekend dips; monthly trends show seasonality
- **Crash severity**: Motorist injuries dominate across all boroughs; pedestrian and cyclist injuries follow different causal patterns
- **Baseline ML**: LightGBM regression and classification trained on arrest × crash aggregations per precinct × time window

### `Phase2.ipynb` — Spark ML Pipeline

Full distributed ML pipeline using Apache Spark (swap `file://` for `hdfs://` to point at a cluster):

**K-Means Clustering (Spark MLlib)**
- Builds a per-precinct temporal demand profile (arrest counts by day × hour)
- Evaluates K = 2–7 using silhouette score
- Optimal K = 4 achieves silhouette = 0.614
- Cluster labels are joined back to the main dataset as a feature

**Regression (Spark GBTRegressor + CrossValidator)**
- Crashes are spatially assigned to precincts via BallTree nearest-centroid join
- Arrest and crash counts are unified into a single incident table grouped by precinct × day × hour × month
- Spark CrossValidator tunes `maxDepth` ∈ {5, 7} and `stepSize` ∈ {0.05, 0.1} with 3-fold CV
- Reports MAE, RMSE, and R² on a held-out 20% test split

**Classification (Spark RandomForestClassifier)**
- Labels each precinct × time window as `Low`, `Moderate`, or `High` demand using tertile thresholds on incident count
- 200 trees, max depth 10, stratified 80/20 split
- Evaluates accuracy and weighted F1; outputs a confusion matrix

**Additional Analysis**
- Peak incident windows, precinct density ranking, Pearson correlation between arrests and crashes, seasonal decomposition of monthly crash counts
- Final cell exports `../data/predictions.csv` for the dashboard

### `prediction.ipynb` — LightGBM-on-Spark Variant

Alternative Spark pipeline that swaps `GBTRegressor`/`RandomForestClassifier` for SynapseML LightGBM. Same data path and outputs.

## Dashboard

A React + Tailwind + Leaflet single-page app under `docs/`. Hand-rolled SVG charts, dark-mode styling, real NYC precinct GeoJSON, no build step required (Babel-standalone transpiles JSX in the browser).

**Files**

| File | Purpose |
|---|---|
| `docs/index.html` | Entry point, CDN scripts, base styles |
| `docs/data.js` | Auto-generated lookup table from `predictions.csv` |
| `docs/app.jsx` | Top bar, KPIs, filter rail, layout, precinct detail panel |
| `docs/map.jsx` | Leaflet choropleth with hover/select interactions |
| `docs/charts.jsx` | Ranked bars, donut, heatmap, line chart primitives |

**Run it**
```bash
# 1. Generate / refresh the dashboard data from the latest predictions
python build_dashboard_data.py

# 2. Serve docs/ via any static server
cd docs
python3 -m http.server 8765
# → open http://localhost:8765
```

`data.js` is regenerated whenever `../data/predictions.csv` changes — re-run the build script and reload the browser. Deploying to Vercel / Netlify / GitHub Pages just requires uploading the `docs/` folder.

## Features Used

| Feature | Description |
|---|---|
| `ARREST_PRECINCT` | NYPD precinct number |
| `day_of_week` | 0 = Monday, 6 = Sunday |
| `hour` | Hour of day (0–23) |
| `month` | Month of year (1–12) |
| `is_weekend` | Binary flag for Saturday/Sunday |
| `boro_encoded` | Label-encoded borough |
| `precinct_cluster` | K-Means cluster assignment (0–3) |

## Setup

```bash
pip install pandas numpy matplotlib seaborn scikit-learn lightgbm pyspark statsmodels
```

Run order from a fresh clone:

```bash
jupyter nbconvert --to notebook --execute clean.ipynb     # pulls raw data from NYC Open Data → ../data/
jupyter nbconvert --to notebook --execute Phase2.ipynb    # writes ../data/predictions.csv
python build_dashboard_data.py                            # writes docs/data.js
cd docs && python3 -m http.server 8765               # serve the UI
```
