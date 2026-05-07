// Choropleth map of NYC police precincts using Leaflet + real GeoJSON
// Falls back gracefully if the network fetch fails.

const PRECINCT_GEOJSON_URL =
  "https://data.cityofnewyork.us/resource/y76i-bdw7.geojson?$limit=200";

function PrecinctMap({
  precinctValues, // {precinct: {avg, total} or number}
  colorBy, // 'demand' | 'count'
  hovered,
  onHover,
  selected,
  onSelect,
  classify,
}) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const layerRef = React.useRef(null);
  const featuresByPrecinctRef = React.useRef({});
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Compute color for a precinct
  const getValue = React.useCallback(
    (p) => {
      const v = precinctValues[p];
      if (v == null) return 0;
      return typeof v === "number" ? v : v.avg;
    },
    [precinctValues]
  );

  const maxVal = React.useMemo(() => {
    let m = 0;
    Object.values(precinctValues).forEach((v) => {
      const x = typeof v === "number" ? v : v.avg;
      if (x > m) m = x;
    });
    return m || 1;
  }, [precinctValues]);

  const colorFor = React.useCallback(
    (p) => {
      const v = getValue(p);
      if (colorBy === "demand") {
        const lvl = classify(v);
        return DEMAND_COLORS[lvl] || "#222";
      }
      // gradient teal by intensity
      const t = Math.min(1, Math.pow(v / maxVal, 0.7));
      // interp from #1a2e2c to #5EEAD4
      const r = Math.round(26 + (94 - 26) * t);
      const g = Math.round(46 + (234 - 46) * t);
      const b = Math.round(44 + (212 - 44) * t);
      return `rgb(${r},${g},${b})`;
    },
    [getValue, colorBy, maxVal, classify]
  );

  // Init map
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 9,
      maxZoom: 14,
    }).setView([40.7128, -73.97], 10);

    // Subtle dark basemap (CartoDB voyager dark)
    L.tileLayer(
      "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        opacity: 0.55,
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    // Fetch precinct geojson
    fetch(PRECINCT_GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => {
        const layer = L.geoJSON(geo, {
          style: (f) => ({
            color: "rgba(255,255,255,0.18)",
            weight: 0.6,
            fillColor: "#1a1a1a",
            fillOpacity: 0.85,
          }),
          onEachFeature: (feature, lyr) => {
            const p = parseInt(feature.properties.precinct, 10);
            featuresByPrecinctRef.current[p] = lyr;
            lyr.on({
              mouseover: () => onHover && onHover(p),
              mouseout: () => onHover && onHover(null),
              click: () => onSelect && onSelect(p),
            });
          },
        }).addTo(map);
        layerRef.current = layer;
        try {
          map.fitBounds(layer.getBounds(), { padding: [12, 12] });
        } catch (e) {}
        setLoaded(true);
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load precinct boundaries");
      });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Restyle on data / colorBy change
  React.useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.eachLayer((lyr) => {
      const p = parseInt(lyr.feature.properties.precinct, 10);
      const isHover = hovered === p;
      const isSel = selected === p;
      lyr.setStyle({
        color: isSel
          ? "#5EEAD4"
          : isHover
          ? "rgba(255,255,255,0.7)"
          : "rgba(255,255,255,0.18)",
        weight: isSel ? 2 : isHover ? 1.4 : 0.6,
        fillColor: colorFor(p),
        fillOpacity: isHover || isSel ? 0.95 : 0.78,
      });
      if (isSel || isHover) lyr.bringToFront();
    });
  }, [precinctValues, colorBy, hovered, selected, colorFor]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 bg-neutral-950" />
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[11px] font-mono text-neutral-500 tracking-wider">
            LOADING PRECINCT BOUNDARIES…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[11px] font-mono text-red-400">{error}</div>
        </div>
      )}

      {/* Color legend overlay */}
      <div className="absolute left-3 bottom-3 bg-neutral-950/85 backdrop-blur border border-white/10 rounded-md px-3 py-2.5 pointer-events-none">
        <div className="text-[9px] font-mono text-neutral-500 tracking-widest mb-1.5">
          {colorBy === "demand" ? "DEMAND LEVEL" : "INCIDENT INTENSITY"}
        </div>
        {colorBy === "demand" ? (
          <div className="flex flex-col gap-1">
            {["High", "Moderate", "Low"].map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ background: DEMAND_COLORS[k] }}
                />
                <span className="text-[10px] text-neutral-300">{k}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-24 h-2 rounded-sm"
              style={{
                background:
                  "linear-gradient(to right, rgb(26,46,44), rgb(94,234,212))",
              }}
            />
            <span className="text-[9px] font-mono text-neutral-500">
              0–{Math.round(maxVal)}
            </span>
          </div>
        )}
      </div>

      {/* Precinct count overlay */}
      <div className="absolute right-3 top-3 bg-neutral-950/85 backdrop-blur border border-white/10 rounded-md px-2.5 py-1.5 pointer-events-none">
        <span className="text-[9px] font-mono text-neutral-500 tracking-widest">
          NYC · 77 PRECINCTS
        </span>
      </div>
    </div>
  );
}

window.PrecinctMap = PrecinctMap;
