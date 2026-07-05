#!/usr/bin/env node
/**
 * Generates a CSV of streets that need name fixes:
 *   - Corrupt streets: t_rechov is a number (no Hebrew or English name)
 *   - Missing-English streets: has Hebrew name but no English translation
 *
 * Each row includes a Google Maps link so names can be verified manually.
 * Fill in the hebrew_name and english_name columns, then run:
 *   node scripts/apply_street_patches_csv.mjs
 *
 * Usage:
 *   node scripts/generate_street_patches_csv.mjs
 * Output:
 *   data/street_patches.csv
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADDRESSES_PATH = resolve(ROOT, "public/data/addresses.geojson");
const STREET_NAMES_PATH = resolve(ROOT, "public/data/street_names.geojson");
const OUTPUT_PATH = resolve(ROOT, "data/street_patches.csv");

console.log("Loading data files...");
const addressesGeoJson = JSON.parse(readFileSync(ADDRESSES_PATH, "utf8"));
const streetNamesGeoJson = JSON.parse(readFileSync(STREET_NAMES_PATH, "utf8"));

// Build existing English fallback from street_names.geojson
const streetNamesEnglishByHebrew = new Map(
  streetNamesGeoJson.features.flatMap((f) => {
    const he = f.properties?.t_rechov;
    const en = f.properties?.shem_angli;
    return he && en && !/^\d+$/.test(he.trim()) ? [[he, en]] : [];
  }),
);

// Collect one representative coordinate per street that needs fixing
const rows = new Map(); // k_rechov → row object

for (const feature of addressesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const code = p.k_rechov;
  if (!code || rows.has(code)) continue;

  const he = String(p.t_rechov ?? "").trim();
  const en = String(p.t_rechov_eng ?? "").trim();
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) continue;

  const lat = coords[1];
  const lon = coords[0];
  const isCorrupt = /^\d+$/.test(he);
  const isMissingEn = !isCorrupt && !en && !streetNamesEnglishByHebrew.has(he);

  if (!isCorrupt && !isMissingEn) continue;

  rows.set(code, {
    k_rechov: code,
    type: isCorrupt ? "corrupt" : "missing_en",
    current_hebrew: isCorrupt ? "" : he,
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    maps_link: `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`,
    hebrew_name: isCorrupt ? "" : he,
    english_name: "",
  });
}

console.log(`Rows to generate: ${rows.size}`);
console.log(`  Corrupt (no name):          ${[...rows.values()].filter((r) => r.type === "corrupt").length}`);
console.log(`  Missing English:            ${[...rows.values()].filter((r) => r.type === "missing_en").length}`);

// Write CSV
function escapeCsv(value) {
  const str = String(value ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

const header = [
  "k_rechov",
  "type",
  "current_hebrew",
  "lat",
  "lon",
  "maps_link",
  "hebrew_name",
  "english_name",
];

const lines = [
  header.join(","),
  ...[...rows.values()].map((r) =>
    header.map((col) => escapeCsv(r[col])).join(","),
  ),
];

writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
console.log(`\nCSV written to: data/street_patches.csv`);
console.log(`\nNext steps:`);
console.log(`  1. Open data/street_patches.csv`);
console.log(`  2. Click each maps_link to verify the street name`);
console.log(`  3. Fill in hebrew_name and english_name columns`);
console.log(`  4. Run: node scripts/apply_street_patches_csv.mjs`);
