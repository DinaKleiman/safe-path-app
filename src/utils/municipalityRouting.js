const EARTH_RADIUS_METERS = 6371000;
const TRAFFIC_LIGHT_SNAP_METERS = 35;

const ROUTE_MODE_WEIGHTS = {
  fastest: {
    trafficLightMultiplier: 1,
    regularMultiplier: 1,
  },
  safest: {
    trafficLightMultiplier: 0.45,
    regularMultiplier: 1.35,
  },
};

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a, b) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function coordinateToPoint([lon, lat]) {
  return { lat, lon };
}

function nodeKey(point) {
  return `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`;
}

function addNode(graph, point) {
  const key = nodeKey(point);

  if (!graph.nodes.has(key)) {
    graph.nodes.set(key, {
      key,
      lat: point.lat,
      lon: point.lon,
      edges: [],
      trafficLight: null,
    });
  }

  return graph.nodes.get(key);
}

function addEdge(from, to) {
  const weight = distanceMeters(from, to);

  from.edges.push({ to: to.key, weight });
  to.edges.push({ to: from.key, weight });
}

class MinHeap {
  values = [];

  push(item) {
    this.values.push(item);
    this.bubbleUp(this.values.length - 1);
  }

  pop() {
    if (!this.values.length) return null;

    const min = this.values[0];
    const end = this.values.pop();

    if (this.values.length) {
      this.values[0] = end;
      this.sinkDown(0);
    }

    return min;
  }

  bubbleUp(index) {
    let currentIndex = index;
    const item = this.values[currentIndex];

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      const parent = this.values[parentIndex];

      if (item.priority >= parent.priority) break;

      this.values[parentIndex] = item;
      this.values[currentIndex] = parent;
      currentIndex = parentIndex;
    }
  }

  sinkDown(index) {
    let currentIndex = index;
    const length = this.values.length;
    const item = this.values[currentIndex];

    while (true) {
      const leftIndex = currentIndex * 2 + 1;
      const rightIndex = currentIndex * 2 + 2;
      let swapIndex = null;

      if (leftIndex < length) {
        const left = this.values[leftIndex];
        if (left.priority < item.priority) {
          swapIndex = leftIndex;
        }
      }

      if (rightIndex < length) {
        const right = this.values[rightIndex];
        const comparisonPriority =
          swapIndex === null ? item.priority : this.values[leftIndex].priority;

        if (right.priority < comparisonPriority) {
          swapIndex = rightIndex;
        }
      }

      if (swapIndex === null) break;

      this.values[currentIndex] = this.values[swapIndex];
      this.values[swapIndex] = item;
      currentIndex = swapIndex;
    }
  }
}

function extractPointFeatures(pointsGeoJson) {
  return (pointsGeoJson?.features || [])
    .filter((feature) => feature.geometry?.type === "Point")
    .map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      return {
        lat,
        lon,
        properties: feature.properties || {},
      };
    });
}

function annotateTrafficLightNodes(graph, trafficLightsGeoJson) {
  const trafficLights = extractPointFeatures(trafficLightsGeoJson);

  for (const node of graph.nodes.values()) {
    let nearestTrafficLight = null;
    let nearestDistance = Infinity;

    for (const trafficLight of trafficLights) {
      const currentDistance = distanceMeters(node, trafficLight);

      if (currentDistance < nearestDistance) {
        nearestTrafficLight = trafficLight;
        nearestDistance = currentDistance;
      }
    }

    if (nearestTrafficLight && nearestDistance <= TRAFFIC_LIGHT_SNAP_METERS) {
      node.trafficLight = {
        distance: nearestDistance,
        point: nearestTrafficLight,
      };
    }
  }
}

export function buildRoadGraph(roadsGeoJson, trafficLightsGeoJson = null) {
  const graph = {
    nodes: new Map(),
  };

  for (const feature of roadsGeoJson.features || []) {
    const { geometry } = feature;

    if (!geometry || geometry.type !== "LineString") {
      continue;
    }

    const coordinates = geometry.coordinates;

    for (let index = 1; index < coordinates.length; index += 1) {
      const from = addNode(graph, coordinateToPoint(coordinates[index - 1]));
      const to = addNode(graph, coordinateToPoint(coordinates[index]));

      addEdge(from, to);
    }
  }

  if (trafficLightsGeoJson) {
    annotateTrafficLightNodes(graph, trafficLightsGeoJson);
  }

  return graph;
}

export function findNearestNode(graph, point) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const node of graph.nodes.values()) {
    const currentDistance = distanceMeters(point, node);

    if (currentDistance < nearestDistance) {
      nearest = node;
      nearestDistance = currentDistance;
    }
  }

  return {
    distance: nearestDistance,
    node: nearest,
  };
}

function getModeWeights(routeMode) {
  return ROUTE_MODE_WEIGHTS[routeMode] || ROUTE_MODE_WEIGHTS.safest;
}

function edgeCost(graph, fromNode, edge, routeMode) {
  const weights = getModeWeights(routeMode);
  const toNode = graph.nodes.get(edge.to);
  const hasTrafficLight = Boolean(fromNode.trafficLight || toNode?.trafficLight);
  const multiplier =
    hasTrafficLight
      ? weights.trafficLightMultiplier
      : weights.regularMultiplier;

  return edge.weight * multiplier;
}

function runShortestPaths(graph, startKey, routeMode) {
  const distances = new Map([[startKey, 0]]);
  const actualDistances = new Map([[startKey, 0]]);
  const previous = new Map();
  const queue = new MinHeap();

  queue.push({ key: startKey, priority: 0 });

  while (queue.values.length) {
    const current = queue.pop();

    if (current.priority > (distances.get(current.key) ?? Infinity)) {
      continue;
    }

    const node = graph.nodes.get(current.key);

    for (const edge of node.edges) {
      const nextDistance =
        current.priority + edgeCost(graph, node, edge, routeMode);
      const nextActualDistance =
        (actualDistances.get(current.key) ?? 0) + edge.weight;

      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        actualDistances.set(edge.to, nextActualDistance);
        previous.set(edge.to, current.key);
        queue.push({ key: edge.to, priority: nextDistance });
      }
    }
  }

  return {
    actualDistances,
    distances,
    previous,
  };
}

function reconstructPath(previous, startKey, endKey) {
  if (startKey === endKey) {
    return [startKey];
  }

  if (!previous.has(endKey)) {
    return null;
  }

  const keys = [];
  let currentKey = endKey;

  while (currentKey) {
    keys.push(currentKey);

    if (currentKey === startKey) {
      break;
    }

    currentKey = previous.get(currentKey);
  }

  keys.reverse();

  return keys;
}

function shortestPath(graph, startKey, endKey, routeMode) {
  const result = runShortestPaths(graph, startKey, routeMode);
  const keys = reconstructPath(result.previous, startKey, endKey);

  if (!keys) {
    return null;
  }

  return {
    distance: result.actualDistances.get(endKey),
    keys,
    score: result.distances.get(endKey),
  };
}

function trafficLightKey(trafficLight) {
  return `${trafficLight.point.lon.toFixed(6)},${trafficLight.point.lat.toFixed(6)}`;
}

function routeTrafficLights(graph, pathKeys) {
  const seen = new Set();
  const trafficLights = [];

  for (const key of pathKeys) {
    const node = graph.nodes.get(key);

    if (!node?.trafficLight) {
      continue;
    }

    const keyForTrafficLight = trafficLightKey(node.trafficLight);

    if (seen.has(keyForTrafficLight)) {
      continue;
    }

    seen.add(keyForTrafficLight);
    trafficLights.push({
      lat: node.trafficLight.point.lat,
      lon: node.trafficLight.point.lon,
      properties: node.trafficLight.point.properties,
    });
  }

  return trafficLights;
}

export function buildMunicipalityRoute(graph, start, end, routeMode = "safest") {
  const snappedStart = findNearestNode(graph, start);
  const snappedEnd = findNearestNode(graph, end);

  if (!snappedStart.node || !snappedEnd.node) {
    throw new Error("Municipality road network is empty.");
  }

  const path = shortestPath(
    graph,
    snappedStart.node.key,
    snappedEnd.node.key,
    routeMode,
  );

  if (!path) {
    throw new Error("No connected municipality road route found.");
  }

  const roadCoordinates = path.keys.map((key) => {
    const node = graph.nodes.get(key);
    return [node.lon, node.lat];
  });

  const coordinates = [
    [start.lon, start.lat],
    ...roadCoordinates,
    [end.lon, end.lat],
  ];

  return {
    distanceMeters:
      path.distance + snappedStart.distance + snappedEnd.distance,
    routeMode,
    score: path.score,
    trafficLights: routeTrafficLights(graph, path.keys),
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

export function buildTrafficLightRoute(graph, start, end) {
  const snappedStart = findNearestNode(graph, start);
  const snappedEnd = findNearestNode(graph, end);

  if (!snappedStart.node || !snappedEnd.node) {
    throw new Error("Municipality road network is empty.");
  }

  const fromStart = runShortestPaths(
    graph,
    snappedStart.node.key,
    "fastest",
  );
  const fromEnd = runShortestPaths(graph, snappedEnd.node.key, "fastest");

  let bestTrafficLightNode = null;
  let bestDistance = Infinity;

  for (const node of graph.nodes.values()) {
    if (!node.trafficLight) {
      continue;
    }

    const distanceFromStart = fromStart.actualDistances.get(node.key);
    const distanceFromEnd = fromEnd.actualDistances.get(node.key);

    if (distanceFromStart === undefined || distanceFromEnd === undefined) {
      continue;
    }

    const totalDistance = distanceFromStart + distanceFromEnd;

    if (totalDistance < bestDistance) {
      bestTrafficLightNode = node;
      bestDistance = totalDistance;
    }
  }

  if (!bestTrafficLightNode) {
    throw new Error("No traffic-light route was found for these addresses.");
  }

  const pathToTrafficLight = reconstructPath(
    fromStart.previous,
    snappedStart.node.key,
    bestTrafficLightNode.key,
  );
  const pathFromTrafficLight = reconstructPath(
    fromEnd.previous,
    snappedEnd.node.key,
    bestTrafficLightNode.key,
  )?.reverse();

  if (!pathToTrafficLight || !pathFromTrafficLight) {
    throw new Error("No traffic-light route was found for these addresses.");
  }

  const pathKeys = [
    ...pathToTrafficLight,
    ...pathFromTrafficLight.slice(1),
  ];
  const trafficLights = routeTrafficLights(graph, pathKeys);

  if (!trafficLights.length) {
    throw new Error("No traffic-light route was found for these addresses.");
  }

  const roadCoordinates = pathKeys.map((key) => {
    const node = graph.nodes.get(key);
    return [node.lon, node.lat];
  });

  return {
    distanceMeters: bestDistance + snappedStart.distance + snappedEnd.distance,
    routeMode: "trafficLightsPriority",
    score: bestDistance,
    trafficLights,
    geometry: {
      type: "LineString",
      coordinates: [
        [start.lon, start.lat],
        ...roadCoordinates,
        [end.lon, end.lat],
      ],
    },
  };
}
