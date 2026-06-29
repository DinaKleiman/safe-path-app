import json
import time
from pathlib import Path

import requests


BASE_URL = "https://gisn.tel-aviv.gov.il/ArcGIS/rest/services/IView2/MapServer/{layer_id}/query"

LAYERS = {
    507: "tel_aviv_roads_507_raw.geojson",
    547: "tel_aviv_signalized_intersections_547_raw.geojson",
    836: "tel_aviv_intersections_836_raw.geojson",
    527: "tel_aviv_addresses_527_raw.geojson",
    597: "tel_aviv_place_names_hebrew_597_raw.geojson",
    843: "tel_aviv_selected_buildings_843_raw.geojson",
    513: "tel_aviv_buildings_513_raw.geojson",
    925: "tel_aviv_businesses_925_raw.geojson",
    964: "tel_aviv_licensed_businesses_964_raw.geojson",
    563: "tel_aviv_health_funds_563_raw.geojson",
    565: "tel_aviv_medical_institutions_565_raw.geojson",
    564: "tel_aviv_pharmacies_564_raw.geojson",
    769: "tel_aviv_schools_769_raw.geojson",
    768: "tel_aviv_kindergartens_768_raw.geojson",
    745: "tel_aviv_culture_institutions_745_raw.geojson",
    553: "tel_aviv_community_institutions_553_raw.geojson",
    404: "tel_aviv_heritage_sites_404_raw.geojson",
    937: "tel_aviv_gyms_937_raw.geojson",
    936: "tel_aviv_stadiums_sport_halls_936_raw.geojson",
    939: "tel_aviv_swimming_pools_939_raw.geojson",
    556: "tel_aviv_public_parking_556_raw.geojson",
    956: "tel_aviv_bus_stops_956_raw.geojson",
    577: "tel_aviv_bike_lanes_577_raw.geojson",
    406: "neighboring_authorities_bike_lanes_406_raw.geojson",
}

OUT_DIR = Path("data/raw")
META_DIR = Path("data/metadata")

PAGE_SIZE = 2000


def download_layer(layer_id: int, output_name: str):
    print(f"\nDownloading layer {layer_id} -> {output_name}")

    all_features = []
    offset = 0
    geometry_type = None

    while True:
        params = {
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "f": "geojson",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
        }

        url = BASE_URL.format(layer_id=layer_id)

        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()

        data = response.json()

        if "error" in data:
            raise RuntimeError(f"ArcGIS error for layer {layer_id}: {data['error']}")

        features = data.get("features", [])

        if geometry_type is None:
            geometry_type = data.get("geometryType")

        print(f"  offset={offset}: {len(features)} features")

        if not features:
            break

        all_features.extend(features)

        if len(features) < PAGE_SIZE:
            break

        offset += PAGE_SIZE
        time.sleep(0.3)

    output = {
        "type": "FeatureCollection",
        "name": output_name.replace(".geojson", ""),
        "features": all_features,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / output_name

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"Saved: {out_path}")
    print(f"Total features: {len(all_features)}")

    return {
        "layer_id": layer_id,
        "file": str(out_path),
        "feature_count": len(all_features),
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    summary = []

    for layer_id, output_name in LAYERS.items():
        item = download_layer(layer_id, output_name)
        summary.append(item)

    summary_path = META_DIR / "tlv_municipality_download_summary.json"

    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\nDone.")
    print(f"Summary saved to: {summary_path}")


if __name__ == "__main__":
    main()
