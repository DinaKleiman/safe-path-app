#!/usr/bin/env node
/**
 * Enriches two categories of broken address data in addresses.geojson:
 *
 * 1. CORRUPT streets — t_rechov contains only digits (the street code was
 *    stored in the name field). Both Hebrew and English names are missing.
 *    (183 unique street codes)
 *
 * 2. MISSING ENGLISH streets — t_rechov has a real Hebrew name but t_rechov_eng
 *    is empty and the street isn't in street_names.geojson either.
 *    (37 streets after the runtime fallback is applied)
 *
 * For both categories, one representative coordinate per street code is
 * reverse-geocoded via OSM Nominatim to retrieve real Hebrew and English names,
 * then all matching records are patched. street_names.geojson is also patched
 * for corrupt entries that appear there.
 *
 * Usage:
 *   node scripts/enrich_corrupt_streets.mjs            # patch files in-place
 *   node scripts/enrich_corrupt_streets.mjs --dry-run  # preview only, no writes
 *
 * Rate limit: Nominatim requires ≤ 1 req/sec.
 * With ~220 lookups this takes roughly 4-5 minutes.
 */

import { readFileSync, writeFileSync } from "fs";
import { setTimeout as sleep } from "timers/promises";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDRESSES_PATH = resolve(ROOT, "public/data/addresses.geojson");
const STREET_NAMES_PATH = resolve(ROOT, "public/data/street_names.geojson");
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) {
  console.log("DRY RUN — no files will be written.\n");
}

// ── 1. Load data files ────────────────────────────────────────────────────────

console.log("Loading addresses.geojson...");
const addressesGeoJson = JSON.parse(readFileSync(ADDRESSES_PATH, "utf8"));

console.log("Loading street_names.geojson...");
const streetNamesGeoJson = JSON.parse(readFileSync(STREET_NAMES_PATH, "utf8"));

// Build existing street_names English lookup to skip already-resolved streets
const streetNamesEnglishByHebrew = new Map(
  streetNamesGeoJson.features.flatMap((f) => {
    const he = f.properties?.t_rechov;
    const en = f.properties?.shem_angli;
    return he && en && !/^\d+$/.test(he.trim()) ? [[he, en]] : [];
  }),
);

// ── 2. Collect streets that need Nominatim lookup ─────────────────────────────

// Map: k_rechov → { lat, lon, isCorrupt, hebrewName }
const toEnrich = new Map();

for (const feature of addressesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const code = p.k_rechov;
  if (!code || toEnrich.has(code)) continue;

  const he = String(p.t_rechov ?? "").trim();
  const en = String(p.t_rechov_eng ?? "").trim();
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) continue;

  const isCorrupt = /^\d+$/.test(he);

  if (isCorrupt) {
    // Corrupt: no Hebrew or English name
    toEnrich.set(code, { lat: coords[1], lon: coords[0], isCorrupt: true, hebrewName: "" });
  } else if (!en && !streetNamesEnglishByHebrew.has(he)) {
    // Has Hebrew, missing English, and not in street_names fallback
    toEnrich.set(code, { lat: coords[1], lon: coords[0], isCorrupt: false, hebrewName: he });
  }
}

const corruptCount = [...toEnrich.values()].filter((v) => v.isCorrupt).length;
const missingEnCount = [...toEnrich.values()].filter((v) => !v.isCorrupt).length;

console.log(`\nStreets to enrich:`);
console.log(`  Corrupt (no name at all):       ${corruptCount}`);
console.log(`  Missing English (has Hebrew):   ${missingEnCount}`);
console.log(`  Total:                          ${toEnrich.size}\n`);

// ── 3. Query Nominatim for each street ───────────────────────────────────────

const patches = new Map(); // k_rechov → { he, en }
let index = 0;

for (const [code, { lat, lon, isCorrupt, hebrewName }] of toEnrich) {
  index += 1;
  const label = isCorrupt ? `[corrupt]` : `[missing-en]`;
  process.stdout.write(`[${index}/${toEnrich.size}] ${label} k_rechov=${code} `);

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2&lat=${lat}&lon=${lon}&namedetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "safe-path-app/data-enrichment (educational project)",
        "Accept-Language": "he,en",
      },
    });

    if (!response.ok) {
      console.log(`→ HTTP ${response.status}`);
    } else {
      const data = await response.json();
      const nd = data.namedetails ?? {};

      const he = isCorrupt
        ? nd["name:he"] || nd["name"] || data.address?.road || ""
        : hebrewName; // already known for missing-english streets

      const en =
        nd["name:en"] ||
        nd["int_name"] ||
        "";

      if (he || en) {
        patches.set(code, { he, en });
        const heLabel = isCorrupt ? `he="${he}" ` : "";
        console.log(`→ ${heLabel}en="${en || "(none)"}"`);
      } else {
        console.log("→ no name found");
      }
    }
  } catch (err) {
    console.log(`→ error: ${err.message}`);
  }

  // Nominatim policy: max 1 request per second
  await sleep(1100);
}

console.log(`\nResolved ${patches.size} of ${toEnrich.size} streets.\n`);

if (patches.size === 0) {
  console.log("Nothing to patch — exiting.");
  process.exit(0);
}

// ── 4. Patch addresses.geojson ───────────────────────────────────────────────

let addressesPatched = 0;

for (const feature of addressesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const code = p.k_rechov;
  if (!patches.has(code)) continue;

  const he = String(p.t_rechov ?? "").trim();
  const isCorrupt = /^\d+$/.test(he);
  const missingEn = !isCorrupt && !String(p.t_rechov_eng ?? "").trim();

  if (!isCorrupt && !missingEn) continue;

  const { he: newHe, en: newEn } = patches.get(code);
  if (isCorrupt && newHe) p.t_rechov = newHe;
  if (newEn) p.t_rechov_eng = newEn;
  addressesPatched += 1;
}

console.log(`addresses.geojson: ${addressesPatched} records patched.`);

// ── 5. Patch street_names.geojson (corrupt entries only) ─────────────────────

let streetNamesPatched = 0;

for (const feature of streetNamesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const name = String(p.t_rechov ?? "").trim();
  if (!/^\d+$/.test(name)) continue;

  // street_names.geojson has no k_rechov; match by the numeric string
  const patch = patches.get(Number(name)) ?? patches.get(String(name));
  if (!patch) continue;

  const { he, en } = patch;
  if (he) p.t_rechov = he;
  if (en) p.shem_angli = en;
  streetNamesPatched += 1;
}

console.log(`street_names.geojson: ${streetNamesPatched} records patched.`);

// ── 6. Write files ────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("\nDry run complete — files not modified.");
} else {
  console.log("\nWriting patched files...");
  writeFileSync(ADDRESSES_PATH, JSON.stringify(addressesGeoJson), "utf8");
  writeFileSync(STREET_NAMES_PATH, JSON.stringify(streetNamesGeoJson), "utf8");
  console.log("Done.");
}
