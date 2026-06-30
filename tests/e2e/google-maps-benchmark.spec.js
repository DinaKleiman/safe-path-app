import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  buildMunicipalityRoute,
  buildRoadGraph,
} from "../../src/utils/municipalityRouting.js";

const repoRoot = process.cwd();

function readGeoJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

const graph = buildRoadGraph(
  readGeoJson("public/data/roads.geojson"),
  readGeoJson("public/data/signalized_intersections.geojson"),
  readGeoJson("public/data/pedestrian_crossings.geojson"),
);

const benchmarkCases = [
  {
    name: "Moshe Sharett 80 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.08747, lon: 34.79287 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Dizengoff Center -> Tel Aviv Port",
    type: "place + place",
    start: { lat: 32.07532, lon: 34.77542 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Graetz School -> Tel Aviv Port",
    type: "school + place",
    start: { lat: 32.08504510196043, lon: 34.776925844344476 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Ahavat Tzion School -> Tel Aviv Port",
    type: "school + place",
    start: { lat: 32.08989250107372, lon: 34.78844813036208 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Ibn Gvirol 71 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.0823082728593, lon: 34.781059554247726 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Ben Yehuda 100 -> Dizengoff Center",
    type: "street + place",
    start: { lat: 32.08257144865605, lon: 34.771458989771915 },
    end: { lat: 32.07532, lon: 34.77542 },
  },
  {
    name: "Rothschild 22 -> Dizengoff Center",
    type: "street + place",
    start: { lat: 32.06289291779095, lon: 34.77159133630515 },
    end: { lat: 32.07532, lon: 34.77542 },
  },
  {
    name: "Allenby 110 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.06433956341972, lon: 34.77236975049404 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Kaplan 6 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.07325298671639, lon: 34.782940882741535 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Weizmann 14 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.08129096792946, lon: 34.78948358000582 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "HaArbaa 28 -> Dizengoff Center",
    type: "street + place",
    start: { lat: 32.070202055725076, lon: 34.78657801212107 },
    end: { lat: 32.07532, lon: 34.77542 },
  },
  {
    name: "Pinkas 30 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.090558635406865, lon: 34.786877349386934 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "Arlozorov 80 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.085624748836416, lon: 34.77963266542787 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
  {
    name: "HaYarkon 99 -> Tel Aviv Port",
    type: "street + place",
    start: { lat: 32.07942634330028, lon: 34.76780893624635 },
    end: { lat: 32.09612, lon: 34.77455 },
  },
];

function googleMapsWalkingUrl({ start, end }) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${start.lat},${start.lon}`,
    destination: `${end.lat},${end.lon}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function parseGoogleWalkingKm(text) {
  const patterns = [
    /(?:(\d+)\s*h\s*)?(\d+)\s*min\s*\n\s*(\d+(?:[.,]\d+)?)\s*km/gi,
    /(?:(\d+)\s*ש[׳'’]?\s*)?(\d+)\s*דקות\s*\n\s*(\d+(?:[.,]\d+)?)\s*ק"?מ/g,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return Number(match[3].replace(",", "."));
    }
  }

  throw new Error("Google Maps walking distance was not found in page text.");
}

function signedDifferencePercent(appPreferKm, googleKm) {
  return Math.round(((googleKm - appPreferKm) / googleKm) * 100);
}

function formatKm(value) {
  return `${value.toFixed(2)} km`;
}

test.describe.configure({ mode: "serial" });

test.describe("Google Maps walking benchmark", () => {
  test.skip(
    process.env.RUN_GOOGLE_MAPS_BENCHMARK !== "1",
    "Google Maps benchmark runs only through npm run test:benchmark:google.",
  );

  test("prefer-traffic-lights distance is not longer than Google walking distance", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const rows = [];

    for (const benchmarkCase of benchmarkCases) {
      const appPreferRoute = buildMunicipalityRoute(
        graph,
        benchmarkCase.start,
        benchmarkCase.end,
        "safest",
      );
      const appPreferKm = appPreferRoute.distanceMeters / 1000;

      await page.goto(googleMapsWalkingUrl(benchmarkCase), {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(5000);

      const googleKm = parseGoogleWalkingKm(await page.locator("body").innerText());
      const signedDiff = signedDifferencePercent(appPreferKm, googleKm);
      const status = signedDiff >= 0 ? "PASS" : "FAIL";

      rows.push({
        case: benchmarkCase.name,
        type: benchmarkCase.type,
        appPreferTrafficLights: formatKm(appPreferKm),
        googleWalking: `${googleKm.toFixed(1)} km`,
        difference: `${signedDiff}%`,
        status,
      });
    }

    console.table(rows);

    const failedRows = rows.filter((row) => row.status === "FAIL");
    expect(
      failedRows,
      failedRows
        .map(
          (row) =>
            `${row.case}: app prefer traffic lights ${row.appPreferTrafficLights}, Google ${row.googleWalking}, ${row.difference}`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
