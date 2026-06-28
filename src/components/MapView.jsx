import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
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

function trafficLightPoint(feature, latlng) {
  return L.marker(latlng, {
    icon: trafficLightIcon,
  });
}

function trafficLightPopup(feature, layer) {
  const p = feature.properties || {};
  const name =
    p.shem_tzomet_win ||
    p.shem_tzomet ||
    p.name ||
    "Traffic light";

  layer.bindPopup(`
    <b>${name}</b><br/>
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
    <CircleMarker
      center={[trafficLight.lat, trafficLight.lon]}
      key={`${trafficLight.lon}-${trafficLight.lat}`}
      radius={5}
      pathOptions={{
        color: "#f59e0b",
        fillColor: "#fef3c7",
        fillOpacity: 0.95,
        weight: 2,
      }}
    >
      <Popup>Traffic light used by selected route</Popup>
    </CircleMarker>
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

      <MapContainer center={TEL_AVIV_CENTER} zoom={13} className="map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
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
