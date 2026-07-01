import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMunicipalitySearchIndex,
  findMunicipalityPlace,
  searchMunicipalityPlaces,
} from "./municipalitySearch";

const repoRoot = process.cwd();

function readGeoJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8"),
  );
}

describe("Tel Aviv municipality search data", () => {
  const addresses = readGeoJson("public/data/addresses.geojson");
  const schools = readGeoJson("public/data/schools.geojson");
  const streetNames = readGeoJson("public/data/street_names.geojson");
  const index = buildMunicipalitySearchIndex(addresses, schools, streetNames);

  it("loads local address and school search datasets", () => {
    expect(index.addresses.length).toBeGreaterThan(50000);
    expect(index.schools.length).toBeGreaterThan(200);
    expect(index.streets.length).toBeGreaterThan(1000);
  });

  it("uses the dedicated municipality street names dataset for street suggestions", () => {
    const streetOnlyIndex = buildMunicipalitySearchIndex(
      { type: "FeatureCollection", features: [] },
      { type: "FeatureCollection", features: [] },
      streetNames,
    );

    const results = searchMunicipalityPlaces(streetOnlyIndex, "אמסטרדם", 5);

    expect(results[0]).toMatchObject({
      displayName: "אמסטרדם",
      source: "municipality-street",
    });
  });

  it("finds a school by Hebrew abbreviation and school name", () => {
    const variations = [
      "בהס אהבת ציון",
      "בה״ס אהבת ציון",
      "בה\"ס אהבת ציון",
      "ביהס אהבת ציון",
      "ביה״ס אהבת ציון",
      "בי״ס אהבת ציון",
      "ביס אהבת ציון",
      "בית ספר אהבת ציון",
      "בית הספר אהבת ציון",
      "ביתספר אהבת ציון",
    ];

    for (const variation of variations) {
      const result = findMunicipalityPlace(index, variation);

      expect(result).toMatchObject({
        displayName: "בית ספר אהבת ציון, כהנשטם 16",
        lat: 32.08989250107372,
        lon: 34.78844813036208,
        source: "municipality-school",
      });
    }
  });

  it("does not mix school-prefixed search with a same-name street", () => {
    const results = searchMunicipalityPlaces(index, "בית ספר אהבת ציון", 10);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      displayName: "בית ספר אהבת ציון, כהנשטם 16",
      source: "municipality-school",
    });
  });

  it("keeps selected school display text resolved as a school", () => {
    const result = findMunicipalityPlace(
      index,
      "בית ספר אהבת ציון, כהנשטם 16",
    );

    expect(result).toMatchObject({
      displayName: "בית ספר אהבת ציון, כהנשטם 16",
      source: "municipality-school",
    });
  });

  it("finds an address when the user writes street tokens in a different order", () => {
    const result = findMunicipalityPlace(index, "משה שרת 80");

    expect(result).toMatchObject({
      displayName: "שרת משה 80",
      source: "municipality-address",
    });
  });

  it("returns Hebrew address text for Hebrew input and English text for English input", () => {
    const hebrewResult = findMunicipalityPlace(index, "משה שרת 80");
    const englishResult = findMunicipalityPlace(index, "Sharet 80");

    expect(hebrewResult).toMatchObject({
      displayName: "שרת משה 80",
      source: "municipality-address",
    });
    expect(englishResult).toMatchObject({
      displayName: "SHARET 80",
      source: "municipality-address",
    });
  });

  it("requires a prefix or building number for ambiguous names", () => {
    expect(findMunicipalityPlace(index, "אהבת ציון")).toBeNull();
    expect(findMunicipalityPlace(index, "משה שרת")).toBeNull();
  });

  it("suggests partial street names while keeping them non-routable", () => {
    const hebrewResults = searchMunicipalityPlaces(index, "נמ", 10);
    const englishResults = searchMunicipalityPlaces(index, "nam", 10);

    expect(hebrewResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "נמיר מרדכי",
          source: "municipality-street",
        }),
      ]),
    );
    expect(englishResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "NAMIR",
          source: "municipality-street",
        }),
      ]),
    );
    expect(findMunicipalityPlace(index, "נמיר מרדכי")).toBeNull();
  });

  it("suggests street names with small Hebrew and English typos", () => {
    const hebrewResults = searchMunicipalityPlaces(index, "נמירר", 10);
    const englishResults = searchMunicipalityPlaces(index, "namr", 10);

    expect(englishResults[0]).toMatchObject({
      displayName: "NAMIR",
      source: "municipality-street",
    });
    expect(hebrewResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "נמיר מרדכי",
          source: "municipality-street",
        }),
      ]),
    );
    expect(englishResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "NAMIR",
          source: "municipality-street",
        }),
      ]),
    );
  });

  it("finds schools with a small typo when a school prefix is present", () => {
    const result = findMunicipalityPlace(index, "בית ספר אהבת ציונ");

    expect(result).toMatchObject({
      displayName: "בית ספר אהבת ציון, כהנשטם 16",
      source: "municipality-school",
    });
  });

  it("finds a street address only when a building number is typed", () => {
    const results = searchMunicipalityPlaces(index, "אהבת ציון 26", 10);

    expect(results[0]).toMatchObject({
      displayName: "אהבת ציון 26",
      source: "municipality-address",
    });
  });

  it("returns municipality suggestions before external geocoder suggestions are needed", () => {
    const results = searchMunicipalityPlaces(index, "אד״ם הכהן 12");

    expect(results[0]).toMatchObject({
      displayName: 'אד"ם הכהן 12',
      source: "municipality-address",
    });
  });
});
