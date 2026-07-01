import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TEL_AVIV_CENTER = [32.0853, 34.7818];

const trafficLightIcon = L.divIcon({
  className: "traffic-light-marker",
  html: `
    <span class="traffic-light-shell" aria-hidden="true">
      <span class="traffic-light-dot traffic-light-red"></span>
      <span class="traffic-light-dot traffic-light-yellow"></span>
      <span class="traffic-light-dot traffic-light-green"></span>
    </span>
  `,
  iconSize: [6, 9],
  iconAnchor: [3, 5],
  popupAnchor: [0, -5],
});

const routeTrafficLightIcon = L.divIcon({
  className: "traffic-light-marker route-traffic-light-marker",
  html: trafficLightIcon.options.html,
  iconSize: [6, 9],
  iconAnchor: [3, 5],
  popupAnchor: [0, -5],
});

const crossingMismatchIcon = L.divIcon({
  className: "crossing-mismatch-marker",
  html: '<span class="crossing-mismatch-shell" aria-hidden="true">!</span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

function trafficLightPoint(feature, latlng) {
  return L.marker(latlng, {
    icon: trafficLightIcon,
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trafficLightPopup(feature, layer) {
  const p = feature.properties || {};
  const name =
    p.shem_tzomet_win ||
    p.shem_tzomet ||
    p.name ||
    "Traffic light";

  layer.bindPopup(`
    <b>${escapeHtml(name)}</b><br/>
    Traffic-light location from municipality layer: צמתים מרומזרים
  `);
}

function routeStyle() {
  return {
    color: "#0f766e",
    weight: 6,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
  };
}

function FitRoute({ route }) {
  const map = useMap();

  useEffect(() => {
    if (!route) return;

    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    if (!coords.length) return;

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);

  return null;
}

function RouteEndpoint({ point, label, color }) {
  if (!point) return null;

  return (
    <CircleMarker
      center={[point.lat, point.lon]}
      radius={8}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.95,
        weight: 2,
      }}
    >
      <Popup>{label}</Popup>
    </CircleMarker>
  );
}

function RouteTrafficLights({ route }) {
  const trafficLights = route?.properties?.trafficLights || [];

  return trafficLights.map((trafficLight) => (
    <Marker
      icon={routeTrafficLightIcon}
      key={`${trafficLight.lon}-${trafficLight.lat}`}
      position={[trafficLight.lat, trafficLight.lon]}
    >
      <Popup>Traffic light used by selected route</Popup>
    </Marker>
  ));
}

function RouteCrossingMismatchSymbols({ route }) {
  const mismatches = route?.properties?.possibleCrossingMismatches || [];

  return mismatches.map((mismatch) => (
    <GeoJSON
      data={{
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [mismatch.lon, mismatch.lat],
        },
        properties: mismatch,
      }}
      key={`symbol-${mismatch.lon}-${mismatch.lat}`}
      pointToLayer={(_feature, latlng) =>
        L.marker(latlng, { icon: crossingMismatchIcon })
      }
      onEachFeature={(feature, layer) => {
        layer.bindPopup(
          escapeHtml(
            feature.properties.mismatchReason ||
              "Please note: crossing details here may not be fully verified.",
          ),
        );
      }}
    />
  ));
}

export default function MapView({ route }) {
  const [signals, setSignals] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const signalsRes = await fetch("/data/signalized_intersections.geojson");

        if (!signalsRes.ok) {
          throw new Error("Could not load /data/signalized_intersections.geojson");
        }

        setSignals(await signalsRes.json());
      } catch (err) {
        setError(err.message);
      }
    }

    loadData();
  }, []);

  return (
    <div className="map-card">
      <div className="map-toolbar">
        <div>
          <h2>Tel Aviv route map</h2>
          <p>Walking route + municipality traffic-light locations</p>
        </div>

        <div className="map-stats">
          <span>
            Traffic lights: {signals ? signals.features?.length ?? 0 : "..."}
          </span>
          <span>
            Route traffic lights: {route?.properties?.trafficLightCount ?? 0}
          </span>
          <span>Route: {route ? "shown" : "not yet"}</span>
        </div>
      </div>

      {error && <div className="map-error">Error: {error}</div>}

      <MapContainer
        attributionControl={false}
        center={TEL_AVIV_CENTER}
        zoom={13}
        className="map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {signals && (
          <GeoJSON
            data={signals}
            pointToLayer={trafficLightPoint}
            onEachFeature={trafficLightPopup}
          />
        )}

        {route && (
          <>
            <GeoJSON
              key={`${route.properties.routeMode}-${route.properties.start.lat}-${route.properties.start.lon}-${route.properties.end.lat}-${route.properties.end.lon}`}
              data={route}
              style={routeStyle}
            />
            <RouteCrossingMismatchSymbols route={route} />
            <RouteTrafficLights route={route} />
            <RouteEndpoint
              point={route.properties.start}
              label="Start"
              color="#2563eb"
            />
            <RouteEndpoint
              point={route.properties.end}
              label="Destination"
              color="#dc2626"
            />
            <FitRoute route={route} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
