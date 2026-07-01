import json
import time
from pathlib import Path

import requests


OUT_DIR = Path("data/raw")
META_DIR = Path("data/metadata")
OUT_FILE = OUT_DIR / "osm_pedestrian_crossings_tel_aviv_raw.geojson"
SUMMARY_FILE = META_DIR / "osm_pedestrian_crossings_download_summary.json"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]

# Tel Aviv app bounds, split to reduce Overpass load.
MIN_LAT = 32.02
MIN_LON = 34.73
MAX_LAT = 32.16
MAX_LON = 34.86
ROWS = 4
COLS = 4


def tile_bounds():
    lat_step = (MAX_LAT - MIN_LAT) / ROWS
    lon_step = (MAX_LON - MIN_LON) / COLS

    for row in range(ROWS):
        for col in range(COLS):
            south = MIN_LAT + row * lat_step
            north = MIN_LAT + (row + 1) * lat_step
            west = MIN_LON + col * lon_step
            east = MIN_LON + (col + 1) * lon_step
            yield south, west, north, east


def build_query(bounds):
    south, west, north, east = bounds
    bbox = f"{south},{west},{north},{east}"

    return f"""
[out:json][timeout:60];
(
  node["highway"="crossing"]({bbox});
  node["crossing"="traffic_signals"]({bbox});
  node["crossing:signals"="yes"]({bbox});
  way["highway"="footway"]["footway"="crossing"]({bbox});
  way["highway"="crossing"]({bbox});
  way["crossing"="traffic_signals"]({bbox});
  way["crossing:signals"="yes"]({bbox});
);
out tags center geom;
"""


def fetch_overpass(query):
    last_error = None

    for attempt in range(3):
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers={
                        "User-Agent": "safe-path-app-osm-crossings-download/1.0",
                    },
                    timeout=90,
                )
                response.raise_for_status()

                body = response.text
                if not body.strip().startswith("{"):
                    raise RuntimeError(body[:300])

                return response.json()
            except Exception as error:
                last_error = error
                continue

        time.sleep(5 * (attempt + 1))

    raise RuntimeError(f"Overpass request failed: {last_error}")


def element_point(element):
    if "lat" in element and "lon" in element:
        return float(element["lon"]), float(element["lat"])

    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lon"]), float(center["lat"])

    geometry = element.get("geometry") or []
    if geometry:
        lon = sum(point["lon"] for point in geometry) / len(geometry)
        lat = sum(point["lat"] for point in geometry) / len(geometry)
        return float(lon), float(lat)

    return None


def to_feature(element):
    point = element_point(element)

    if not point:
        return None

    tags = element.get("tags") or {}
    osm_id = f"{element['type']}/{element['id']}"

    return {
        "type": "Feature",
        "properties": {
            "osm_id": osm_id,
            "osm_type": element["type"],
            "highway": tags.get("highway"),
            "footway": tags.get("footway"),
            "crossing": tags.get("crossing"),
            "crossing_signals": tags.get("crossing:signals"),
            "traffic_signals": tags.get("crossing") == "traffic_signals"
            or tags.get("crossing:signals") == "yes",
            "source": "OpenStreetMap",
        },
        "geometry": {
            "type": "Point",
            "coordinates": list(point),
        },
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    features_by_id = {}
    tile_summaries = []

    for index, bounds in enumerate(tile_bounds(), start=1):
        print(f"Downloading OSM crossing tile {index}/{ROWS * COLS}: {bounds}", flush=True)
        data = fetch_overpass(build_query(bounds))
        elements = data.get("elements", [])

        for element in elements:
            feature = to_feature(element)

            if feature:
                features_by_id[feature["properties"]["osm_id"]] = feature

        tile_summaries.append({
            "tile": index,
            "bounds": bounds,
            "elements": len(elements),
        })
        time.sleep(1)

    features = sorted(
        features_by_id.values(),
        key=lambda feature: feature["properties"]["osm_id"],
    )
    output = {
        "type": "FeatureCollection",
        "name": "osm_pedestrian_crossings_tel_aviv_raw",
        "features": features,
    }

    with OUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False)

    summary = {
        "source": "OpenStreetMap Overpass API",
        "file": str(OUT_FILE),
        "feature_count": len(features),
        "bounds": {
            "min_lat": MIN_LAT,
            "min_lon": MIN_LON,
            "max_lat": MAX_LAT,
            "max_lon": MAX_LON,
        },
        "queries": [
            'node["highway"="crossing"]',
            'node["crossing"="traffic_signals"]',
            'node["crossing:signals"="yes"]',
            'way["highway"="footway"]["footway"="crossing"]',
            'way["highway"="crossing"]',
            'way["crossing"="traffic_signals"]',
            'way["crossing:signals"="yes"]',
        ],
        "tiles": tile_summaries,
    }

    with SUMMARY_FILE.open("w", encoding="utf-8") as file:
        json.dump(summary, file, ensure_ascii=False, indent=2)

    print(f"Saved: {OUT_FILE}", flush=True)
    print(f"Total unique crossings: {len(features)}", flush=True)
    print(f"Summary saved to: {SUMMARY_FILE}", flush=True)


if __name__ == "__main__":
    main()
