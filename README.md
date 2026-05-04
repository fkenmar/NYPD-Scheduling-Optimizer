# Optimal NYPD Scheduling Model

A data science project that uses NYPD arrest records and motor vehicle collision data to build machine learning models for optimizing police officer scheduling across New York City precincts.

## Overview

The project predicts incident demand (arrests + crashes) at the precinct level across time windows (hour × day × month), then classifies each window as Low, Moderate, or High demand. The outputs directly inform staffing decisions — which precincts need more officers, and when.

## Data Sources

| Dataset | Records | Source |
|---|---|---|
| NYPD Arrest Data (Year-to-Date) | 278,953 | NYC Open Data |
| Motor Vehicle Collisions – Crashes | 2,000,126 | NYC Open Data |

Data files are excluded from version control (see `.gitignore`).

## Notebooks

### `clean.ipynb` — Data Cleaning

Prepares both datasets for analysis:

- Drops rows missing critical fields (`ARREST_DATE`, `ARREST_PRECINCT`, coordinates)
- Fills missing boroughs with `UNKNOWN` rather than dropping (too many to lose)
- Caps injury count outliers at the 99th percentile
- Filters coordinates to valid NYC bounding box (removes ~248K crash rows with bad GPS)
- Engineers temporal features: `hour`, `day_of_week`, `month`, `year`
- Outputs `arrests_cleaned.csv` and `crashes_cleaned.csv`

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
- Peak incident windows: highest combined arrest + crash counts cluster around midnight on mid-week days
- Precinct density ranking: top precincts by total incident volume with cluster membership
- Pearson correlation between arrest and crash counts per precinct × time window
- Seasonal decomposition of monthly crash counts (trend + seasonal + residual)

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

Place the raw CSV files in `../data/` relative to the notebooks before running `clean.ipynb`. Phase 2 reads from a `phase2/` directory configured via the `DATA_URI` variable in `Phase2.ipynb`.
