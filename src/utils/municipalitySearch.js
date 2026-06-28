const SCHOOL_WORDS_PATTERN =
  /(בהס|ביהס|ביס|בית\s*ספר|בית\s*הספר)/;

function compactText(value) {
  return String(value ?? "")
    .trim()
    .replace(/[׳']/g, "")
    .replace(/[״"]/g, "")
    .replace(/[.,:;()]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSearchText(value) {
  return compactText(value).replace(SCHOOL_WORDS_PATTERN, "").trim();
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/.test(String(value ?? ""));
}

function hasSchoolPrefix(value) {
  return SCHOOL_WORDS_PATTERN.test(compactText(value));
}

function textTokens(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter(Boolean);
}

function allowedFuzzyDistance(query) {
  if (query.length < 3) {
    return 0;
  }

  if (query.length <= 5) {
    return 1;
  }

  return 2;
}

function editDistanceWithin(a, b, maxDistance) {
  if (!maxDistance || Math.abs(a.length - b.length) > maxDistance) {
    return false;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMinimum = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );

      current[j] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) {
      return false;
    }

    previous = current;
  }

  return previous[b.length] <= maxDistance;
}

function fuzzyMatches(query, candidates) {
  const maxDistance = allowedFuzzyDistance(query);

  return candidates.some((candidate) =>
    editDistanceWithin(query, candidate, maxDistance),
  );
}

function commonPrefixLength(a, b) {
  let index = 0;

  while (index < a.length && index < b.length && a[index] === b[index]) {
    index += 1;
  }

  return index;
}

function fuzzyScore(query, candidates) {
  const maxDistance = allowedFuzzyDistance(query);
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!editDistanceWithin(query, candidate, maxDistance)) {
      continue;
    }

    const prefixBonus = Math.min(commonPrefixLength(query, candidate), 4) * 3;
    const lengthPenalty = Math.abs(query.length - candidate.length);
    bestScore = Math.max(bestScore, 50 + prefixBonus - lengthPenalty);
  }

  return bestScore;
}

function getPoint(feature) {
  const coordinates = feature.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  return {
    lat: Number(coordinates[1]),
    lon: Number(coordinates[0]),
  };
}

function uniqueByDisplayName(results) {
  const seen = new Set();

  return results.filter((result) => {
    const key = result.displayName;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toAddressRecord(feature) {
  const properties = feature.properties ?? {};
  const point = getPoint(feature);

  if (!point) {
    return null;
  }

  const fullAddress = properties.t_ktovet_melea || "";
  const street = properties.t_rechov || "";
  const streetEnglish = properties.t_rechov_eng || "";
  const houseNumber = properties.ms_bayit;
  const entrance = compactText(properties.knisa);
  const displayNameHe = fullAddress.trim() || `${street} ${houseNumber}`.trim();
  const displayNameEn = streetEnglish
    ? `${streetEnglish} ${houseNumber}`.trim()
    : displayNameHe;

  if (!street || !houseNumber || !displayNameHe) {
    return null;
  }

  return {
    ...point,
    displayName: displayNameHe,
    displayNameEn,
    displayNameHe,
    houseNumber: String(houseNumber),
    matchedQuery: "municipality:addresses",
    normalizedFullAddressEn: normalizeSearchText(displayNameEn),
    normalizedFullAddressHe: normalizeSearchText(displayNameHe),
    source: "municipality-address",
    street,
    streetEnglish,
    streetTokensEn: textTokens(streetEnglish),
    streetTokensHe: textTokens(street),
    entrance,
  };
}

function toSchoolRecord(feature) {
  const properties = feature.properties ?? {};
  const point = getPoint(feature);

  if (!point || !properties.shem_mosad) {
    return null;
  }

  const schoolName = properties.shem_mosad;
  const street = properties.shem_rechov || "";
  const houseNumber = properties.ms_bait || "";
  const address = [street, houseNumber].filter(Boolean).join(" ");

  return {
    ...point,
    address,
    displayName: address
      ? `בית ספר ${schoolName}, ${address}`
      : `בית ספר ${schoolName}`,
    matchedQuery: "municipality:schools",
    normalizedName: normalizeSearchText(schoolName),
    source: "municipality-school",
  };
}

function toStreetRecords(addressRecords) {
  const streets = new Map();

  for (const record of addressRecords) {
    const key = [...record.streetTokensHe].sort().join("|");

    if (!key || streets.has(key)) {
      continue;
    }

    streets.set(key, {
      displayName: record.street,
      displayNameEn: record.streetEnglish || record.street,
      displayNameHe: record.street,
      lat: record.lat,
      lon: record.lon,
      matchedQuery: "municipality:streets",
      normalizedNameEn: normalizeSearchText(record.streetEnglish),
      normalizedNameHe: normalizeSearchText(record.street),
      source: "municipality-street",
      streetTokensEn: record.streetTokensEn,
      streetTokensHe: record.streetTokensHe,
    });
  }

  return [...streets.values()];
}

function scoreStreetRecord(record, query, queryTokens, language) {
  const normalizedName = language === "he"
    ? record.normalizedNameHe
    : record.normalizedNameEn;
  const streetTokens = language === "he"
    ? record.streetTokensHe
    : record.streetTokensEn;

  if (!normalizedName) {
    return 0;
  }

  if (normalizedName === query) {
    return 95;
  }

  if (normalizedName.startsWith(query)) {
    return 85;
  }

  if (normalizedName.includes(query)) {
    return 65;
  }

  const streetFuzzyScore = fuzzyScore(query, [normalizedName, ...streetTokens]);

  if (streetFuzzyScore) {
    return streetFuzzyScore;
  }

  const streetTokenMatches = queryTokens.filter((token) =>
    streetTokens.some(
      (streetToken) =>
        streetToken.startsWith(token) || fuzzyMatches(token, [streetToken]),
    ),
  ).length;

  return streetTokenMatches ? streetTokenMatches * 20 : 0;
}

function scoreAddressRecord(record, query, queryTokens, houseNumber, language) {
  let score = 0;
  const normalizedFullAddress = language === "he"
    ? record.normalizedFullAddressHe
    : record.normalizedFullAddressEn;
  const streetTokens = language === "he"
    ? record.streetTokensHe
    : record.streetTokensEn;

  if (normalizedFullAddress === query) {
    score += 100;
  } else if (normalizedFullAddress.includes(query)) {
    score += 60;
  }

  if (houseNumber && record.houseNumber === houseNumber) {
    score += 50;
  } else if (houseNumber) {
    return 0;
  }

  const streetTokenMatches = queryTokens.filter((token) =>
    streetTokens.includes(token) || fuzzyMatches(token, streetTokens),
  ).length;

  if (streetTokenMatches === streetTokens.length) {
    score += 30;
  } else if (streetTokenMatches) {
    score += streetTokenMatches * 8;
  }

  return score;
}

function scoreSchoolRecord(record, query, schoolQuery) {
  if (!schoolQuery) {
    return 0;
  }

  if (record.normalizedName === query) {
    return 100;
  }

  if (record.normalizedName.includes(query)) {
    return 70;
  }

  if (query.includes(record.normalizedName)) {
    return 90;
  }

  const schoolFuzzyScore = fuzzyScore(query, [record.normalizedName]);

  if (schoolFuzzyScore) {
    return schoolFuzzyScore;
  }

  return 0;
}

export function buildMunicipalitySearchIndex(addressesGeoJson, schoolsGeoJson) {
  const addresses = (addressesGeoJson?.features ?? [])
    .map(toAddressRecord)
    .filter(Boolean);

  return {
    addresses,
    schools: (schoolsGeoJson?.features ?? [])
      .map(toSchoolRecord)
      .filter(Boolean),
    streets: toStreetRecords(addresses),
  };
}

export function searchMunicipalityPlaces(index, address, limit = 5) {
  const query = normalizeSearchText(address);

  if (!index || query.length < 2) {
    return [];
  }

  const queryTokens = textTokens(address);
  const houseNumber = query.match(/\d+[א-ת]?/)?.[0] ?? "";
  const schoolQuery = hasSchoolPrefix(address);
  const language = hasHebrew(address) ? "he" : "en";
  const schoolResults = index.schools
    .map((record) => ({
      ...record,
      score: scoreSchoolRecord(record, query, schoolQuery),
    }))
    .filter((record) => record.score > 0);
  const streetResults = houseNumber || schoolQuery
    ? []
    : index.streets
        .map((record) => ({
          ...record,
          displayName: language === "he"
            ? record.displayNameHe
            : record.displayNameEn,
          score: scoreStreetRecord(record, query, queryTokens, language),
        }))
        .filter((record) => record.score > 0);
  const addressResults = houseNumber && !schoolQuery
    ? index.addresses
        .map((record) => ({
          ...record,
          displayName: language === "he"
            ? record.displayNameHe
            : record.displayNameEn,
          score: scoreAddressRecord(
            record,
            query,
            queryTokens,
            houseNumber,
            language,
          ),
        }))
        .filter((record) => record.score > 0)
    : [];

  return uniqueByDisplayName([
    ...schoolResults,
    ...streetResults,
    ...addressResults,
  ])
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
    .map(({ score: _score, ...record }) => record);
}

export function findMunicipalityPlace(index, address) {
  return (
    searchMunicipalityPlaces(index, address, 10).find(
      (result) => result.source !== "municipality-street",
    ) ?? null
  );
}
