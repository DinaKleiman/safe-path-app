import { useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import {
  buildMunicipalityRoute,
  buildRoadGraph,
  buildTrafficLightRoute,
} from "./utils/municipalityRouting";
import "./styles/app.css";

const TEL_AVIV_BOUNDS = {
  minLon: 34.73,
  minLat: 32.02,
  maxLon: 34.86,
  maxLat: 32.16,
};

const LOCAL_PLACE_FALLBACKS = [
  {
    match: (address) =>
      address.toLowerCase().includes("dizengoff center") ||
      /דיזנגוף\s+סנטר/.test(address),
    result: {
      lat: 32.07532,
      lon: 34.77542,
      displayName: "Dizengoff Center, Tel Aviv",
      matchedQuery: "local:dizengoff-center",
    },
  },
  {
    match: (address) =>
      address.toLowerCase().includes("tel aviv port") ||
      address.toLowerCase().includes("namal tel aviv") ||
      /נמל\s+תל\s+אביב/.test(address),
    result: {
      lat: 32.09612,
      lon: 34.77455,
      displayName: "Tel Aviv Port, Tel Aviv",
      matchedQuery: "local:tel-aviv-port",
    },
  },
  {
    match: (address) => /משה\s+שרת/.test(address) && /80/.test(address),
    result: {
      lat: 32.08747,
      lon: 34.79287,
      displayName: "משה שרת 80, תל אביב",
      matchedQuery: "local:moshe-sharet-80",
    },
  },
  {
    match: (address) =>
      /גרץ/.test(address) &&
      /(בהס|בה"ס|בה״ס|ביהס|ביה"ס|ביה״ס|בית ספר|בית הספר)/.test(address),
    result: {
      lat: 32.08485,
      lon: 34.77714,
      displayName: 'בית הספר גרץ, אד"ם הכהן, תל אביב',
      matchedQuery: "local:graetz-school",
    },
  },
];

const MIN_AUTOCOMPLETE_LENGTH = 2;
const WALKING_SPEED_METERS_PER_SECOND = 1.3;

const ROUTE_MODES = [
  {
    id: "safest",
    label: "Prefer traffic lights",
    description: "Accept a longer route for more signalized crossings",
  },
  {
    id: "fastest",
    label: "Fastest",
    description: "Shortest walking time",
  },
];

function normalizeAddress(address) {
  return address.trim().replace(/\s+/g, " ");
}

function normalizeHebrewAddress(address) {
  return normalizeAddress(address)
    .replace(/[׳']/g, "'")
    .replace(/[״"]/g, '"');
}

function getLocalFallback(address) {
  const normalized = normalizeHebrewAddress(address);
  const fallback = LOCAL_PLACE_FALLBACKS.find((item) => item.match(normalized));

  return fallback ? fallback.result : null;
}

function getLocalSuggestions(address) {
  const normalized = normalizeHebrewAddress(address);
  const lower = normalized.toLowerCase();

  return LOCAL_PLACE_FALLBACKS
    .filter((item) => item.match(normalized) || item.result.displayName.toLowerCase().includes(lower))
    .map((item) => ({
      ...item.result,
      source: "local",
    }));
}

function buildGeocodeQueries(address) {
  const normalized = normalizeAddress(address);
  const hebrewNormalized = normalizeHebrewAddress(address);
  const lower = normalized.toLowerCase();
  const hasTelAviv = lower.includes("tel aviv") || lower.includes("tel-aviv");
  const hasIsrael = lower.includes("israel");
  const queries = [
    normalized,
    hasTelAviv ? normalized : `${normalized}, Tel Aviv`,
    hasIsrael ? normalized : `${normalized}, Israel`,
    hasTelAviv || hasIsrael ? normalized : `${normalized}, Tel Aviv, Israel`,
  ];

  if (/גרץ/.test(hebrewNormalized)) {
    queries.push("גרץ, תל אביב", "Graetz, Tel Aviv");
  }

  return [...new Set(queries)];
}

function isInTelAvivBounds(result) {
  const lat = Number(result.lat);
  const lon = Number(result.lon);

  return (
    lat >= TEL_AVIV_BOUNDS.minLat &&
    lat <= TEL_AVIV_BOUNDS.maxLat &&
    lon >= TEL_AVIV_BOUNDS.minLon &&
    lon <= TEL_AVIV_BOUNDS.maxLon
  );
}

function toSuggestion(result, matchedQuery) {
  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    displayName: result.display_name,
    matchedQuery,
    source: "geocoder",
  };
}

function estimateWalkingDurationSeconds(distanceMeters) {
  return distanceMeters / WALKING_SPEED_METERS_PER_SECOND;
}

async function searchAddressSuggestions(address, signal) {
  const normalized = normalizeAddress(address);

  if (normalized.length < MIN_AUTOCOMPLETE_LENGTH) {
    return [];
  }

  const localSuggestions = getLocalSuggestions(normalized);
  const queries = buildGeocodeQueries(normalized);
  const externalSuggestions = [];
  const seen = new Set(localSuggestions.map((item) => item.displayName));

  for (const query of queries.slice(0, 2)) {
    try {
      const url =
        "https://nominatim.openstreetmap.org/search" +
        `?q=${encodeURIComponent(query)}` +
        "&format=json" +
        "&limit=4" +
        "&countrycodes=il" +
        "&addressdetails=1" +
        "&bounded=1" +
        `&viewbox=${TEL_AVIV_BOUNDS.minLon},${TEL_AVIV_BOUNDS.maxLat},${TEL_AVIV_BOUNDS.maxLon},${TEL_AVIV_BOUNDS.minLat}`;

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal,
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      for (const result of data.filter(isInTelAvivBounds)) {
        if (seen.has(result.display_name)) {
          continue;
        }

        seen.add(result.display_name);
        externalSuggestions.push(toSuggestion(result, query));

        if (localSuggestions.length + externalSuggestions.length >= 5) {
          return [...localSuggestions, ...externalSuggestions];
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }

      continue;
    }
  }

  return [...localSuggestions, ...externalSuggestions].slice(0, 5);
}

function AddressField({ id, label, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [open, setOpen] = useState(false);
  const listId = useMemo(() => `${id}-suggestions`, [id]);

  useEffect(() => {
    const normalized = normalizeAddress(value);

    if (normalized.length < MIN_AUTOCOMPLETE_LENGTH) {
      setSuggestions([]);
      setStatus("idle");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setStatus("searching");
        const results = await searchAddressSuggestions(
          normalized,
          controller.signal,
        );

        setSuggestions(results);
        setStatus(results.length ? "found" : "empty");
      } catch (error) {
        if (error.name !== "AbortError") {
          setSuggestions([]);
          setStatus("error");
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [value]);

  function handleSelect(suggestion) {
    onChange(suggestion.displayName);
    setSuggestions([]);
    setOpen(false);
    setStatus("found");
  }

  const showSuggestions = open && (status !== "idle" || suggestions.length > 0);

  return (
    <label className="field address-field">
      {label}
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showSuggestions}
        autoComplete="off"
        value={value}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />

      {showSuggestions && (
        <div className="suggestion-panel" id={listId} role="listbox">
          {status === "searching" && (
            <div className="suggestion-status">Checking address...</div>
          )}

          {status === "empty" && (
            <div className="suggestion-status">No Tel Aviv match found yet</div>
          )}

          {status === "error" && (
            <div className="suggestion-status">Address check is unavailable</div>
          )}

          {suggestions.map((suggestion) => (
            <button
              className="suggestion-option"
              key={`${suggestion.source}-${suggestion.lat}-${suggestion.lon}-${suggestion.displayName}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
              role="option"
              type="button"
            >
              <span>{suggestion.displayName}</span>
              <small>
                {suggestion.source === "local"
                  ? "Local Tel Aviv match"
                  : "Address match"}
              </small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export default function App() {
  const [from, setFrom] = useState("Dizengoff Center, Tel Aviv");
  const [to, setTo] = useState("Tel Aviv Port");
  const [routeMode, setRouteMode] = useState("safest");
  const [roadGraph, setRoadGraph] = useState(null);
  const [roadGraphError, setRoadGraphError] = useState("");
  const [route, setRoute] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRoadNetwork() {
      try {
        const [roadsResponse, signalsResponse] = await Promise.all([
          fetch("/data/roads.geojson"),
          fetch("/data/signalized_intersections.geojson"),
        ]);

        if (!roadsResponse.ok) {
          throw new Error("Could not load municipality roads.geojson");
        }

        if (!signalsResponse.ok) {
          throw new Error(
            "Could not load municipality signalized_intersections.geojson",
          );
        }

        const roads = await roadsResponse.json();
        const signals = await signalsResponse.json();
        setRoadGraph(buildRoadGraph(roads, signals));
        setRoadGraphError("");
      } catch (error) {
        setRoadGraphError(error.message);
      }
    }

    loadRoadNetwork();
  }, []);

  async function geocodeAddress(address) {
    const localFallback = getLocalFallback(address);

    if (localFallback) {
      return localFallback;
    }

    const queries = buildGeocodeQueries(address);
    let fallbackResult = null;

    for (const query of queries) {
      const url =
        "https://nominatim.openstreetmap.org/search" +
        `?q=${encodeURIComponent(query)}` +
        "&format=json" +
        "&limit=5" +
        "&countrycodes=il" +
        "&addressdetails=1" +
        "&bounded=1" +
        `&viewbox=${TEL_AVIV_BOUNDS.minLon},${TEL_AVIV_BOUNDS.maxLat},${TEL_AVIV_BOUNDS.maxLon},${TEL_AVIV_BOUNDS.minLat}`;

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to geocode: ${address}`);
      }

      const data = await response.json();
      const telAvivResult = data.find(isInTelAvivBounds);

      if (telAvivResult) {
        return {
          lat: Number(telAvivResult.lat),
          lon: Number(telAvivResult.lon),
          displayName: telAvivResult.display_name,
          matchedQuery: query,
        };
      }

      if (!fallbackResult && data.length) {
        fallbackResult = data[0];
      }
    }

    if (!fallbackResult) {
      throw new Error(
        `Address not found: ${address}. I checked several Tel Aviv search variants. Try a street number, nearby landmark, or a more specific place name.`,
      );
    }

    return {
      lat: Number(fallbackResult.lat),
      lon: Number(fallbackResult.lon),
      displayName: fallbackResult.display_name,
      matchedQuery: queries[0],
    };
  }

  async function getWalkingRoute(start, end, mode = routeMode) {
    if (!roadGraph) {
      throw new Error("Municipality road network is still loading.");
    }

    const municipalityRoute =
      mode === "trafficLightsPriority"
        ? buildTrafficLightRoute(roadGraph, start, end)
        : buildMunicipalityRoute(
            roadGraph,
            start,
            end,
            mode,
          );

    return {
      type: "Feature",
      properties: {
        distanceMeters: municipalityRoute.distanceMeters,
        durationSeconds: estimateWalkingDurationSeconds(
          municipalityRoute.distanceMeters,
        ),
        source: "municipality-roads",
        start,
        end,
        routeMode: municipalityRoute.routeMode,
        trafficLightCount: municipalityRoute.trafficLights.length,
        trafficLights: municipalityRoute.trafficLights,
      },
      geometry: municipalityRoute.geometry,
    };
  }

  async function calculateRoute(mode = routeMode, extraSummary = {}) {
    try {
      setLoading(true);
      setRoute(null);
      setRouteSummary(null);

      if (!from.trim() || !to.trim()) {
        throw new Error("Please enter both From and To.");
      }

      const start = await geocodeAddress(from);
      const end = await geocodeAddress(to);
      const walkingRoute = await getWalkingRoute(start, end, mode);

      setRoute(walkingRoute);
      setRouteSummary({
        from: start.displayName,
        to: end.displayName,
        distanceMeters: walkingRoute.properties.distanceMeters,
        durationSeconds: walkingRoute.properties.durationSeconds,
        source: walkingRoute.properties.source,
        routeMode: mode,
        trafficLightCount: walkingRoute.properties.trafficLightCount,
        message:
          "Route is calculated from Tel Aviv municipality roads.geojson and traffic-light data.",
        ...extraSummary,
      });
    } catch (error) {
      setRouteSummary({
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleFindRoute() {
    await calculateRoute();
  }

  async function handleTryHarder() {
    await calculateRoute("trafficLightsPriority", {
      triedHarder: true,
    });
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Safe Path</h1>
          <p>Test: enter A and B, then draw a walking route on the map</p>
        </div>
      </header>

      <main className="main-layout">
        <aside className="side-panel">
          <section className="card">
            <h2>Plan a safe route</h2>

            <AddressField
              id="from"
              label="From"
              value={from}
              onChange={setFrom}
              placeholder="Example: Dizengoff Center"
            />

            <AddressField
              id="to"
              label="To"
              value={to}
              onChange={setTo}
              placeholder="Example: Tel Aviv Port"
            />

            <div className="filters">
              <h3>Route mode</h3>

              <div className="route-mode-options">
                {ROUTE_MODES.map((mode) => (
                  <label className="route-mode-option" key={mode.id}>
                    <input
                      checked={routeMode === mode.id}
                      name="route-mode"
                      onChange={() => setRouteMode(mode.id)}
                      type="radio"
                      value={mode.id}
                    />
                    <span>
                      <strong>{mode.label}</strong>
                      <small>{mode.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="primary-button"
              disabled={loading || !roadGraph}
              onClick={handleFindRoute}
            >
              {loading
                ? "Finding route..."
                : roadGraph
                  ? "Find safe route"
                  : "Loading municipality roads..."}
            </button>
          </section>

          <section className="card">
            <h2>Route result</h2>

            {roadGraphError && (
              <p className="error-text">{roadGraphError}</p>
            )}

            {!routeSummary && (
              <p className="muted">
                Enter two Tel Aviv locations and click Find safe route.
              </p>
            )}

            {routeSummary?.error && (
              <p className="error-text">{routeSummary.error}</p>
            )}

            {routeSummary && !routeSummary.error && (
              <div>
                <p>
                  <strong>Distance:</strong>{" "}
                  {(routeSummary.distanceMeters / 1000).toFixed(2)} km
                </p>
                <p>
                  <strong>Estimated walking time:</strong>{" "}
                  {Math.round(routeSummary.durationSeconds / 60)} min
                </p>
                <p>
                  <strong>Route mode:</strong>{" "}
                  {
                    ROUTE_MODES.find((mode) => mode.id === routeSummary.routeMode)
                      ?.label || "Try harder"
                  }
                </p>
                <p>
                  <strong>Traffic lights on route:</strong>{" "}
                  {routeSummary.trafficLightCount}
                </p>
                {routeSummary.routeMode === "safest" &&
                  routeSummary.trafficLightCount === 0 && (
                    <div className="route-note">
                      <p>
                        No traffic-light crossings were found on this route.
                        You can try a larger detour.
                      </p>
                      <button
                        className="secondary-button"
                        disabled={loading || !roadGraph}
                        onClick={handleTryHarder}
                        type="button"
                      >
                        Try harder
                      </button>
                    </div>
                  )}
                {routeSummary.triedHarder &&
                  routeSummary.trafficLightCount === 0 && (
                    <p className="route-note">
                      Still no traffic-light route was found for these
                      addresses.
                    </p>
                  )}
                <p>{routeSummary.message}</p>
              </div>
            )}
          </section>
        </aside>

        <section className="map-panel">
          <MapView route={route} />
        </section>
      </main>
    </div>
  );
}
