# Safe Path — QA Architecture Review (Problems Only)

> Verified against: `docs/spec.md` (primary source of truth)

---

## PROBLEMS FOUND

### CRITICAL — Spec Mismatches

---

**[C-1] `street_names.geojson` is listed as "Used now" in spec but is never loaded or used**

- Spec §3 Source Of Truth table explicitly lists: `public/data/street_names.geojson` → "Street-name autocomplete" — status "Used now."
- `App.jsx` does not fetch this file. `buildMunicipalitySearchIndex` does not accept it. Streets come from a secondary derivation off address records.
- The file exists in `public/data/` and `dist/data/` but the app silently ignores it.
- Impact: The spec's data source table is factually wrong about what the app actually uses. Any engineer or auditor treating the spec as truth will be misled.

---

**[C-2] Route traffic-light markers on the selected route are generic circle dots, not traffic-light symbols**

- Spec §10: "Traffic-light markers must look like traffic-light symbols, not generic dots."
- The full background dataset renders using the proper `trafficLightIcon` (three-dot stacked symbol, CSS class `.traffic-light-marker`).
- `RouteTrafficLights` component ([MapView.jsx:111](src/components/MapView.jsx#L111)) renders route-specific traffic lights as `CircleMarker` — a plain yellow circle.
- The Playwright test `page.locator(".traffic-light-marker")` passes because it targets background markers. Route traffic lights are never tested for their visual type.
- The spec requirement fails for every selected route.

---

**[C-3] Non-signalized pedestrian crossings are not penalized — the cost model contradicts the spec**

- Spec §8: "Penalize known non-signalized pedestrian crossings."
- `ROUTE_MODE_WEIGHTS` in [municipalityRouting.js:6](src/utils/municipalityRouting.js#L6):
  - `safest.unsignalizedCrossingMultiplier = 1.05`, `safest.regularMultiplier = 1.6`
  - `trafficLightsPriority.unsignalizedCrossingMultiplier = 0.8`, `trafficLightsPriority.regularMultiplier = 2.5`
- In both modes, non-signalized crossing edges cost **less** than regular road edges (`1.05 < 1.6` and `0.8 < 2.5`).
- The algorithm never penalizes non-signalized crossings; it simply does not reward them with the strong discounts that signalized crossings and traffic lights receive.
- Practical effect: tests pass because the strong traffic-light discounts (0.1×, 0.05×) dominate routing. But any route that avoids traffic lights will prefer non-signalized crossings over plain road segments, which is the opposite of the spec requirement.

---

**[C-4] Data source warning is hardcoded — always shown, spec says it is conditional**

- Spec §3 and §4: "Required warning when OSM pedestrian crossings affect routing" and "data warning when OSM crossing data is used."
- [App.jsx:683](src/App.jsx#L683): `message` is always set to the warning string in every successful route calculation, regardless of whether any OSM pedestrian crossings were found on the route.
- A route with zero pedestrian crossings will still display the warning.
- The Playwright helper ([helpers.js:59](tests/e2e/helpers.js#L59)) asserts this warning on every call to `calculateRoute`, which means no test would catch a route where the warning correctly should not appear.

---

**[C-5] `buildTrafficLightRoute` throws wrong error message for disconnected graph**

- Spec §12: disconnected graph error text is `"No connected municipality road route found."`
- [municipalityRouting.js:659](src/utils/municipalityRouting.js#L659): when both `fastestPath` and `tryHarderPath` are null (disconnected graph), the function throws `"No traffic-light crossing route was found for these addresses."` — a different, non-spec message.
- The correct spec error text only surfaces from `buildMunicipalityRoute`, not from the Try Harder path.

---

**[C-6] Application header contains development placeholder text visible to users**

- [App.jsx:726](src/App.jsx#L726): `<p>Test: enter A and B, then draw a walking route on the map</p>`
- The spec §4 describes a real product user flow. This text is a developer note exposed in the production UI.

---

### HIGH — Logic Problems

---

**[H-1] `possibleMismatch` flag is always `true` for non-signalized crossings — the concept is collapsed**

- `annotatePedestrianCrossingNodes` sets `possibleMismatch: !explicitlySignalized`.
- `routeCrossingMetrics` computes: `possibleCrossingMismatches = unsignalizedCrossings.filter(c => c.possibleMismatch)`.
- A non-signalized crossing is by definition not explicitly signalized in OSM, so `possibleMismatch` is always `true` for all non-signalized crossings.
- Result: `possibleCrossingMismatches.length === unsignalizedCrossings.length` always. The two counts shown in the result panel ("Possible crossing-data mismatches" and "Non-signalized pedestrian crossings") are always identical.
- The spec treats these as distinct concepts — a mismatch implies a discrepancy between the two data sources, not every non-signalized crossing.

---

**[H-2] `buildTrafficLightRoute` compares result against fastest route metrics, not the safest route the user was already shown**

Plain issue description:

- When the user clicks `Try harder`, the app must decide whether the new route is better than the route currently shown to the user.
- The concern was that the app might compare `Try harder` against `Fastest`, even when the user was actually looking at `Prefer traffic lights`.
- The correct comparison is: `Try harder route` versus `currently displayed route`.
- Example: if `Prefer traffic lights` already shows 3 good crossings, and `Try harder` finds 4 good crossings, the app should compare 4 versus 3, not 4 versus the fastest route.

- Try Harder is triggered because the `safest` route has 0 signalized crossings AND `crossingPreferenceLimited`.
- `buildTrafficLightRoute` internally recalculates the fastest path and compares `hasBetterCrossingScore(tryHarderMetrics, fastestMetrics)`.
- The logically correct baseline for "is this better?" is the `safest` route the user was shown — not the fastest.
- In practice both `fastest` and `safest` will have 0 signalized crossings when Try Harder triggers, so the results likely match. But if `fastest` somehow has a better crossing score than the `safest` result shown, Try Harder could silently reject a route that was actually an improvement.

Codex follow-up after fix:

- H-2 is partially fixed by adding `displayedPreferredPath()` and using `baseMetrics` from the displayed route.
- `buildTrafficLightRoute` calls `displayedPreferredPath(graph, startKey, endKey, fastestPath)`, which recalculates the preferred route before deciding the comparison baseline.
- If the normal displayed route fell back to fastest because the preferred route was not better or was not reasonable, `displayedPreferredPath()` returns `fastestPath`; comparing Try Harder against fastest is correct in that edge case because fastest is what the user saw.
- If the normal displayed route used the preferred route, `displayedPreferredPath()` returns that preferred path; comparing Try Harder against preferred route metrics is also correct.
- Codex opinion: no remaining H-2 logic defect is present after this fix. The recalculation is acceptable because it is deterministic for the same graph/start/end/mode inputs. A future refactor could pass the already displayed route into `buildTrafficLightRoute` to avoid recomputation, but that would be a performance/code-clarity improvement, not a correctness fix.

Conclusion:

- H-2 is logically fixed.
- Current behavior compares `Try harder` against the route the user saw.
- No additional code fix is required for this issue.

---

### MEDIUM — Test Quality and Coverage Gaps

---

**[M-1] `vitest-logic-test-cases.md` VIT-DATA-005 contains stale numbers**

- Doc says `safest` route is "about `2842m`."
- Actual test ([municipalityRouting.test.js:263](src/utils/municipalityRouting.test.js#L263)): `expect(Math.round(safest.distanceMeters)).toBe(2780)`.
- 62 m difference. The test doc is out of sync. Anyone using the test doc to verify behavior would see wrong expected values.

---

**[M-2] `SCHOOL_WORDS_PATTERN` does not include spec-required aliases `בה״ס` and `ביה״ס` as explicit literals**

- Spec §5 explicitly lists `בה״ס` and `ביה״ס` as required aliases.
- [municipalitySearch.js:1](src/utils/municipalitySearch.js#L1): pattern is `(בהס|ביהס|ביס|בית\s*ספר|בית\s*הספר)` — neither alias appears directly.
- These work only because `compactText` strips `״` before pattern matching (`בה״ס` → `בהס`, `ביה״ס` → `ביהס`).
- If quote-stripping behavior changes for any reason, the spec-required aliases silently stop working with no test failure pointing to the spec requirement.

---

**[M-3] Routing test hardcodes exact distance and traffic-light count values tied to live data**

- [municipalityRouting.test.js:255,257,263](src/utils/municipalityRouting.test.js#L255): asserts `fastest.trafficLights.toHaveLength(6)`, `fastest.distanceMeters === 2325`, `safest.distanceMeters === 2780`.
- These values will change with any data update, producing failures with no indication of whether it is a logic break or a data change.

---

**[M-4] `ROUTE-007` gap has no test — Try Harder warning for remaining non-signalized crossings**

- Spec §9: "If the returned route still has non-signalized crossings, show: `Please note: this route may still include crossings without traffic lights.`"
- Traceability matrix marks this as `Gap`. No Playwright test covers this case.
- The logic exists in [App.jsx:880](src/App.jsx#L880) but is never automatically verified.

---

**[M-5] `calculateRoute` Playwright helper always asserts the OSM warning text**

- [helpers.js:59](tests/e2e/helpers.js#L59) asserts the warning on every `calculateRoute` call.
- If the app is corrected to show the warning conditionally (fixing C-4), all tests using this helper will break simultaneously with no clear indication of which test is testing warning-present vs warning-absent behavior.

---

**[M-6] Tests use internal mode ID `"safest"` — spec never defines this term**

- [routing.spec.js:54](tests/e2e/routing.spec.js#L54): `calculateRoute(page, ..., "safest")`
- `municipalityRouting.test.js` and `vitest-logic-test-cases.md`: use `"safest"` throughout.
- Spec only defines `Prefer traffic lights` and `Fastest`. The internal alias `"safest"` is never documented in the spec. A QA reading tests against spec cannot trace `"safest"` to any spec requirement without reading the code.

---

### LOW — Dead Code / Placeholder Files

---

**[L-1] `RoutePanel.jsx` is a dead placeholder — route panel logic lives in `App.jsx`**

- [src/components/RoutePanel.jsx](src/components/RoutePanel.jsx): `return <div>Route details will be here</div>`. Never imported or used.

**[L-2] `routing.js` is dead code — `buildSafeRoute()` returns `null`, never imported**

- [src/utils/routing.js](src/utils/routing.js) exists but is unused.

**[L-3] `safetyScore.js` is dead code — `calculateSafetyScore()` returns `0`, never imported**

- [src/utils/safetyScore.js](src/utils/safetyScore.js) exists but is unused.

All three files will confuse any new developer about where logic lives and what is complete.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical — spec mismatch | 6 |
| High — logic problem | 2 |
| Medium — test/coverage | 6 |
| Low — dead code | 3 |

Most impactful for correctness: **C-2** (route markers), **C-3** (penalty cost model), **C-1** (street_names.geojson spec claim is false).
