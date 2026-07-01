import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMunicipalityRoute,
  buildRoadGraph,
  buildTrafficLightRoute,
  distanceMeters,
  findNearestNode,
} from "./municipalityRouting";

const repoRoot = process.cwd();

function readGeoJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
  );
}

function point(lon, lat) {
  return { lat, lon };
}

function roadFeature(coordinates, properties = {}) {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates,
    },
    properties,
  };
}

function pointFeature(coordinates, properties = {}) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates,
    },
    properties,
  };
}

describe("municipality routing primitives", () => {
  it("calculates zero distance for the same coordinate", () => {
    const coordinate = point(34.77455, 32.09612);

    expect(distanceMeters(coordinate, coordinate)).toBe(0);
  });

  it("builds an undirected graph from road line strings", () => {
    const graph = buildRoadGraph({
      type: "FeatureCollection",
      features: [
        roadFeature([
          [34.77, 32.09],
          [34.771, 32.091],
          [34.772, 32.092],
        ]),
      ],
    });

    expect(graph.nodes.size).toBe(3);

    const middle = findNearestNode(graph, point(34.771, 32.091)).node;

    expect(middle.edges).toHaveLength(2);
  });

  it("throws a clear error when the road graph is empty", () => {
    const graph = buildRoadGraph({
      type: "FeatureCollection",
      features: [],
    });

    expect(() =>
      buildMunicipalityRoute(
        graph,
        point(34.77, 32.09),
        point(34.78, 32.1),
      ),
    ).toThrow("Municipality road network is empty.");
  });
});

describe("route mode logic", () => {
  it("uses distance only for fastest and traffic-light preference for Prefer traffic lights", () => {
    const roads = {
      type: "FeatureCollection",
      features: [
        roadFeature(
          [
            [34.77, 32.09],
            [34.7725, 32.09],
            [34.775, 32.09],
          ],
          { name: "short-route" },
        ),
        roadFeature(
          [
            [34.77, 32.09],
            [34.77, 32.0904],
            [34.7725, 32.0904],
            [34.775, 32.0904],
            [34.775, 32.09],
          ],
          { name: "signalized-route" },
        ),
      ],
    };
    const trafficLights = {
      type: "FeatureCollection",
      features: [
        pointFeature([34.77, 32.0904], { name: "light-a" }),
        pointFeature([34.7725, 32.0904], { name: "light-b" }),
        pointFeature([34.775, 32.0904], { name: "light-c" }),
      ],
    };
    const graph = buildRoadGraph(roads, trafficLights);
    const start = point(34.77, 32.09);
    const end = point(34.775, 32.09);

    const fastest = buildMunicipalityRoute(graph, start, end, "fastest");
    const preferTrafficLights = buildMunicipalityRoute(
      graph,
      start,
      end,
      "preferTrafficLights",
    );

    expect(fastest.distanceMeters).toBeLessThan(preferTrafficLights.distanceMeters);
    expect(fastest.trafficLights).toHaveLength(0);
    expect(preferTrafficLights.trafficLights).toHaveLength(3);
  });

  it("penalizes non-signalized pedestrian crossings in traffic-light preference mode", () => {
    const roads = {
      type: "FeatureCollection",
      features: [
        roadFeature([
          [34.77, 32.09],
          [34.7725, 32.09],
          [34.775, 32.09],
        ]),
        roadFeature([
          [34.77, 32.09],
          [34.77, 32.0904],
          [34.7725, 32.0904],
          [34.775, 32.0904],
          [34.775, 32.09],
        ]),
      ],
    };
    const trafficLights = {
      type: "FeatureCollection",
      features: [
        pointFeature([34.7725, 32.0904], { name: "signalized-crossing" }),
      ],
    };
    const pedestrianCrossings = {
      type: "FeatureCollection",
      features: [
        pointFeature([34.7725, 32.09], { crossing: "uncontrolled" }),
        pointFeature([34.7725, 32.0904], { crossing: "traffic_signals" }),
      ],
    };
    const graph = buildRoadGraph(roads, trafficLights, pedestrianCrossings);
    const start = point(34.77, 32.09);
    const end = point(34.775, 32.09);

    const fastest = buildMunicipalityRoute(graph, start, end, "fastest");
    const preferTrafficLights = buildMunicipalityRoute(
      graph,
      start,
      end,
      "preferTrafficLights",
    );

    expect(fastest.unsignalizedCrossingCount).toBe(1);
    expect(preferTrafficLights.signalizedCrossingCount).toBeGreaterThan(0);
    expect(preferTrafficLights.unsignalizedCrossingCount).toBe(0);
    expect(preferTrafficLights.distanceMeters).toBeGreaterThan(fastest.distanceMeters);
  });

  it("falls back to traffic-light preference for unknown route modes", () => {
    const roads = {
      type: "FeatureCollection",
      features: [
        roadFeature([
          [34.77, 32.09],
          [34.7725, 32.09],
          [34.775, 32.09],
        ]),
        roadFeature([
          [34.77, 32.09],
          [34.77, 32.0904],
          [34.7725, 32.0904],
          [34.775, 32.0904],
          [34.775, 32.09],
        ]),
      ],
    };
    const trafficLights = {
      type: "FeatureCollection",
      features: [
        pointFeature([34.77, 32.0904]),
        pointFeature([34.7725, 32.0904]),
        pointFeature([34.775, 32.0904]),
      ],
    };
    const graph = buildRoadGraph(roads, trafficLights);

    const fallback = buildMunicipalityRoute(
      graph,
      point(34.77, 32.09),
      point(34.775, 32.09),
      "unknown-mode",
    );

    expect(fallback.trafficLights).toHaveLength(3);
  });

  it("forces a route through at least one traffic light when requested", () => {
    const roads = {
      type: "FeatureCollection",
      features: [
        roadFeature([
          [34.77, 32.09],
          [34.7725, 32.09],
          [34.775, 32.09],
        ]),
        roadFeature([
          [34.77, 32.09],
          [34.77, 32.0912],
          [34.7725, 32.0912],
          [34.775, 32.0912],
          [34.775, 32.09],
        ]),
      ],
    };
    const trafficLights = {
      type: "FeatureCollection",
      features: [
        pointFeature([34.7725, 32.0912], { name: "required-light" }),
      ],
    };
    const graph = buildRoadGraph(roads, trafficLights);

    const forced = buildTrafficLightRoute(
      graph,
      point(34.77, 32.09),
      point(34.775, 32.09),
    );

    expect(forced.routeMode).toBe("trafficLightsPriority");
    expect(forced.trafficLights).toHaveLength(1);
  });

  it("uses the standard disconnected-route error for Try harder on disconnected roads", () => {
    const roads = {
      type: "FeatureCollection",
      features: [
        roadFeature([
          [34.77, 32.09],
          [34.771, 32.09],
        ]),
        roadFeature([
          [34.78, 32.1],
          [34.781, 32.1],
        ]),
      ],
    };
    const graph = buildRoadGraph(roads);

    expect(() =>
      buildTrafficLightRoute(
        graph,
        point(34.77, 32.09),
        point(34.781, 32.1),
      ),
    ).toThrow("No connected municipality road route found.");
  });
});

describe("Tel Aviv municipality data integration", () => {
  const roads = readGeoJson("public/data/roads.geojson");
  const trafficLights = readGeoJson("public/data/signalized_intersections.geojson");
  const pedestrianCrossings = readGeoJson("public/data/pedestrian_crossings.geojson");
  const graph = buildRoadGraph(roads, trafficLights, pedestrianCrossings);

  it("loads valid municipality road and traffic-light datasets", () => {
    expect(roads.features.length).toBeGreaterThan(8000);
    expect(trafficLights.features.length).toBeGreaterThan(400);
    expect(pedestrianCrossings.features.length).toBeGreaterThan(4000);
    expect(
      roads.features.every((feature) => feature.geometry?.type === "LineString"),
    ).toBe(true);
    expect(
      trafficLights.features.every(
        (feature) => feature.geometry?.type === "Point",
      ),
    ).toBe(true);
  });

  it("builds a road graph with traffic-light annotations", () => {
    const trafficLightNodeCount = [...graph.nodes.values()].filter(
      (node) => node.trafficLight,
    ).length;

    expect(graph.nodes.size).toBeGreaterThan(10000);
    expect(trafficLightNodeCount).toBeGreaterThan(trafficLights.features.length);
  });

  it("calculates distinct route behavior for Moshe Sharett 80 to Tel Aviv Port", () => {
    const mosheSharett80 = point(34.79287, 32.08747);
    const telAvivPort = point(34.77455, 32.09612);

    const fastest = buildMunicipalityRoute(
      graph,
      mosheSharett80,
      telAvivPort,
      "fastest",
    );
    const preferTrafficLights = buildMunicipalityRoute(
      graph,
      mosheSharett80,
      telAvivPort,
      "preferTrafficLights",
    );

    expect(fastest.distanceMeters).toBeLessThan(preferTrafficLights.distanceMeters);
    expect(preferTrafficLights.distanceMeters).toBeLessThanOrEqual(
      fastest.distanceMeters * 1.3,
    );
    expect(fastest.trafficLights.length).toBeGreaterThan(0);
    expect(preferTrafficLights.trafficLights.length).toBeGreaterThan(
      fastest.trafficLights.length,
    );
    expect(preferTrafficLights.possibleCrossingMismatchCount).toBe(
      preferTrafficLights.possibleCrossingMismatches.length,
    );
    expect(preferTrafficLights.unsignalizedCrossingCount).toBeLessThan(
      fastest.unsignalizedCrossingCount,
    );
  });

  it("finds a forced traffic-light route for a short Sharett to Belkind route", () => {
    const sharett84 = point(34.79287, 32.08747);
    const belkind1 = point(34.78936, 32.08923);

    const regular = buildMunicipalityRoute(
      graph,
      sharett84,
      belkind1,
      "preferTrafficLights",
    );
    expect(regular.signalizedCrossingCount).toBe(0);
    expect(() => buildTrafficLightRoute(graph, sharett84, belkind1)).toThrow(
      "No better traffic-light crossing route was found for these addresses.",
    );
  });
});
