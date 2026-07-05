#!/usr/bin/env node
/**
 * Reads data/street_patches.csv (filled in with hebrew_name and english_name)
 * and patches public/data/addresses.geojson and public/data/street_names.geojson.
 *
 * Usage:
 *   node scripts/apply_street_patches_csv.mjs            # patch files in-place
 *   node scripts/apply_street_patches_csv.mjs --dry-run  # preview only
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = resolve(ROOT, "data/street_patches.csv");
const ADDRESSES_PATH = resolve(ROOT, "public/data/addresses.geojson");
const STREET_NAMES_PATH = resolve(ROOT, "public/data/street_names.geojson");
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) console.log("DRY RUN — no files will be written.\n");

// ── Parse CSV ─────────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const csvText = readFileSync(CSV_PATH, "utf8");
const csvLines = csvText.split("\n").filter((l) => l.trim());
const header = parseCsvLine(csvLines[0]);

const patches = new Map(); // k_rechov → { type, hebrewName, englishName }
let skipped = 0;

for (const line of csvLines.slice(1)) {
  const fields = parseCsvLine(line);
  const row = Object.fromEntries(header.map((h, i) => [h, fields[i] ?? ""]));

  const code = Number(row.k_rechov);
  const hebrewName = row.hebrew_name?.trim();
  const englishName = row.english_name?.trim();

  if (!hebrewName && !englishName) {
    skipped++;
    continue;
  }

  patches.set(code, {
    type: row.type,
    hebrewName,
    englishName,
  });
}

console.log(`Loaded ${patches.size} patches from CSV (${skipped} rows skipped — empty names).`);

if (patches.size === 0) {
  console.log("Nothing to apply — fill in hebrew_name / english_name columns first.");
  process.exit(0);
}

// ── Patch addresses.geojson ───────────────────────────────────────────────────

console.log("\nLoading addresses.geojson...");
const addressesGeoJson = JSON.parse(readFileSync(ADDRESSES_PATH, "utf8"));
let addressesPatched = 0;

for (const feature of addressesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const code = Number(p.k_rechov);
  if (!patches.has(code)) continue;

  const currentHe = String(p.t_rechov ?? "").trim();
  const currentEn = String(p.t_rechov_eng ?? "").trim();
  const { type, hebrewName, englishName } = patches.get(code);

  const shouldPatchHe = type === "corrupt" && hebrewName;
  const shouldPatchEn = !currentEn && englishName;

  if (!shouldPatchHe && !shouldPatchEn) continue;

  if (shouldPatchHe) p.t_rechov = hebrewName;
  if (shouldPatchEn) p.t_rechov_eng = englishName;
  addressesPatched++;
}

console.log(`addresses.geojson: ${addressesPatched} records patched.`);

// ── Patch street_names.geojson ────────────────────────────────────────────────

console.log("Loading street_names.geojson...");
const streetNamesGeoJson = JSON.parse(readFileSync(STREET_NAMES_PATH, "utf8"));
let streetNamesPatched = 0;

for (const feature of streetNamesGeoJson.features) {
  const p = feature.properties;
  if (!p) continue;
  const currentHe = String(p.t_rechov ?? "").trim();
  if (!/^\d+$/.test(currentHe)) continue;

  const code = Number(currentHe);
  if (!patches.has(code)) continue;

  const { hebrewName, englishName } = patches.get(code);
  if (hebrewName) p.t_rechov = hebrewName;
  if (englishName) p.shem_angli = englishName;
  streetNamesPatched++;
}

console.log(`street_names.geojson: ${streetNamesPatched} records patched.`);

// ── Write files ───────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("\nDry run complete — files not modified.");
} else {
  console.log("\nWriting patched files...");
  writeFileSync(ADDRESSES_PATH, JSON.stringify(addressesGeoJson), "utf8");
  writeFileSync(STREET_NAMES_PATH, JSON.stringify(streetNamesGeoJson), "utf8");
  console.log("Done.");
}
