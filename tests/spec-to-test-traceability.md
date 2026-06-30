# Safe Path Spec-To-Test Traceability

This is the living QA coverage document for Safe Path.

Update this file whenever `docs/spec.md`, routing logic, search logic, UX behavior, or test coverage changes.

## Status Values

- `Covered / Passing`: automated test exists and currently passed in the latest run.
- `Partial`: automated coverage exists, but it does not fully prove the spec requirement.
- `Gap`: required by spec, but no sufficient automated test exists.
- `Manual`: verified manually only; should become automated if it is release-critical.
- `Future`: documented future scope; not required for current release.

Latest full known run:

- Vitest: `22/22` passed.
- Playwright: `21` app UI tests passed; Google Maps benchmark is skipped unless explicitly enabled.
- Lint/build: passed in the latest full check.

Latest targeted run:

- Playwright desktop autocomplete/routing: passed after adding language-separation, keyboard-navigation, short-input, no-`Try harder`, and map-attribution checks.

Latest Google Maps benchmark run:

- Command: `npm run test:benchmark:google`.
- Source: Google Maps walking route UI, using coordinates resolved by the app.
- Compared value: app `Prefer traffic lights` distance.
- Rule: `difference = (Google walking distance - App prefer-traffic-lights distance) / Google walking distance`.
- Result meaning: `PASS` when the difference is `0%` or positive; `FAIL` when the difference is negative because the app's prefer-traffic-lights route is longer than Google walking.
- Latest result: `5 PASS`, `9 FAIL`.
- Risk accepted by product: this test depends on Google Maps UI text and can fail if Google changes the page structure, route selection, or wording.

## Maintenance Rules

- Every accepted product rule in `docs/spec.md` must map to at least one row here.
- A release should not be considered product-passed while a current-release row is `Gap`.
- A test can pass and still be insufficient; mark that as `Partial`.
- If code changes product behavior, update the spec first or in the same change.
- If the spec changes, update this matrix before reporting final QA status.

## Current Release Traceability

| ID | Spec Ref | Requirement | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| SCOPE-001 | 2 | Walking routes inside Tel Aviv | Playwright + Vitest | Route tests use Tel Aviv known A/B pairs in `routing.spec.js` and `municipalityRouting.test.js`. | Covered / Passing | Add negative outside-Tel-Aviv route case if strict boundary logic is implemented. |
| SCOPE-002 | 2, 5 | Hebrew and English location search | Vitest + Playwright | `municipalitySearch.test.js`; `autocomplete.spec.js` Hebrew/English prefix and strict Hebrew-no-English-external tests. | Covered / Passing | None. |
| SCOPE-003 | 2, 5 | Autocomplete for addresses, streets, schools, and known places | Vitest + Playwright | Address, street, school, local regression tests exist. | Covered / Passing | Add more place-layer tests when more place datasets become active in search. |
| SCOPE-004 | 2, 6 | One route mode selected at a time | Playwright | `route modes are single-select and Balanced is removed`. | Covered / Passing | None. |
| SCOPE-005 | 2, 7 | Route distance calculated from local road graph | Vitest + Playwright benchmark | `calculates distinct route behavior`; graph construction and distance tests; Google Maps benchmark compares app `Prefer traffic lights` distance with Google walking distance. | Covered / Passing | Review Google benchmark failures as product/routing gaps, not as source-of-truth replacement. |
| SCOPE-006 | 2, 7 | Walking time calculated from route distance | Playwright | Route UI checks estimated walking time is shown. | Partial | Add Vitest unit assertion for `distance / 1.3` if duration helper is exported or isolated. |
| SCOPE-007 | 2, 10 | Traffic-light markers shown on map | Playwright | `map, traffic-light icons, route, and route markers render`. | Covered / Passing | None. |
| SCOPE-008 | 2, 8, 11 | Signalized and non-signalized crossing counts shown | Playwright + Vitest | Routing tests assert signalized crossing improvement; UI checks crossing count labels. | Covered / Passing | Add exact route geometry proximity test if crossing-count logic changes. |
| SCOPE-009 | 2, 9 | `Try harder` flow for longer route | Playwright + Vitest | `Try harder recalculates...`; forced traffic-light route tests. | Covered / Passing | Add negative no-better-route case when a stable fixture exists. |

## Data Source Traceability

| ID | Spec Ref | Requirement | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| DATA-001 | 3 | `roads.geojson` loads and builds graph | Vitest | `loads valid municipality road and traffic-light datasets`; graph size tests. | Covered / Passing | None. |
| DATA-002 | 3 | `signalized_intersections.geojson` loads and annotates graph | Vitest + Playwright | Traffic-light file structure, graph annotation, map marker rendering. | Covered / Passing | None. |
| DATA-003 | 3 | `pedestrian_crossings.geojson` used as crossing helper | Vitest + Playwright | Routing tests use crossing dataset; UI shows crossing-data warning. | Covered / Passing | Add data-integrity test for signalized/non-signalized property distribution. |
| DATA-004 | 3 | OSM crossing warning and possible mismatch count are shown when crossing data is used | Playwright + Vitest | `calculateRoute` helper expects warning text; routing output includes possible mismatch count and map marker coordinates. | Covered / Passing | None. |
| DATA-005 | 3 | Nominatim is helper only, not route safety source | Vitest + architecture | Routing tests build route from local graph. | Partial | Add explicit test/mock proving route still calculates from local graph when geocoder is mocked. |
| DATA-006 | 3 | External routing engines are not safety source | Code review / architecture | No external route engine call is used in current app routing. | Manual | Add static test or architecture check only if external routing code is introduced. |

## Search And Autocomplete Traceability

| ID | Spec Ref | Requirement | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| SEARCH-001 | 5 | Search supports Hebrew and English | Vitest + Playwright | Hebrew/English autocomplete and municipality search tests. | Covered / Passing | None. |
| SEARCH-002 | 5, 15 | Hebrew input should return Hebrew suggestions | Vitest + Playwright | Tests check expected Hebrew option appears and no English external suggestions are appended when Hebrew municipality results exist. | Covered / Passing | None. |
| SEARCH-003 | 5, 15 | English input should return English suggestions | Vitest + Playwright | Tests check English street options appear. | Covered / Passing | Add strict no-Hebrew-result assertion only if product requires English-only display. |
| SEARCH-004 | 5 | Search starts after at least 2 characters | Playwright | One-character input test asserts no options are shown. | Covered / Passing | None. |
| SEARCH-005 | 5 | Same-name entities from different layers appear as separate suggestions | Vitest + Playwright | School prefix and same-name street behavior tests. | Partial | Add direct UI test where a query can show both school/place and street options when no prefix forces one type. |
| SEARCH-006 | 5 | Street without building number asks for building number during address entry | Vitest + Playwright | Street-only tests assert `Enter building number` appears before submit, disappears after a number is entered, and route submit remains blocked without a number. | Covered / Passing | None. |
| SEARCH-007 | 5 | Full address existence verified before route | Vitest + Playwright | Address with building number tests exist. | Partial | Add invalid building number test. |
| SEARCH-008 | 5 | School prefixes resolve to schools, not streets | Vitest + Playwright | `school prefix shows school results...`; school abbreviation unit tests. | Covered / Passing | None. |
| SEARCH-009 | 5 | Quote variants are normalized | Vitest + Playwright | Hebrew quote and English apostrophe tests. | Covered / Passing | None. |
| SEARCH-010 | 5 | Fuzzy typo correction works | Vitest + Playwright | Fuzzy typo tests exist. | Covered / Passing | None. |
| SEARCH-011 | 5 | Autocomplete option can be selected by mouse | Playwright | `selecting an autocomplete option fills the address field`. | Covered / Passing | None. |
| SEARCH-012 | 5, UX | Autocomplete option can be selected by keyboard | Playwright | Keyboard test covers ArrowDown, selected option state, Enter selection, and Escape close. | Covered / Passing | Add ArrowUp coverage if multi-option ordering changes. |
| SEARCH-013 | 5 | External suggestions limited to Tel Aviv | Browser/manual observation | Current rectangle bounds allowed nearby cities in Hebrew example. | Gap | Add boundary test after exact Tel Aviv boundary or stricter external filtering decision is implemented. |

## Routing Traceability

| ID | Spec Ref | Requirement | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| ROUTE-001 | 6, 8 | `Fastest` minimizes road-graph distance | Vitest + Playwright | Fastest route tests and distance comparison tests. | Covered / Passing | None. |
| ROUTE-002 | 6, 8 | `Prefer traffic lights` improves crossing quality when available | Vitest + Playwright | Distinct route behavior and safer route tests. | Covered / Passing | Add more known A/B examples over time. |
| ROUTE-003 | 8 | Non-signalized crossings are allowed when no reasonable alternative exists | Vitest | Crossing metrics included in routing output. | Partial | Add stable fixture where preferred route still includes non-signalized crossings. |
| ROUTE-004 | 8 | Route cannot detour unreasonably in normal mode | Vitest | Reasonable-detour logic tested indirectly. | Partial | Add explicit fixture where better signalized route is over `1.3x` and normal mode rejects it. |
| ROUTE-005 | 9 | `Try harder` requires confirmation | Playwright | Updated test checks confirmation and `Do it anyway`. | Covered / Passing | None. |
| ROUTE-006 | 9 | `Try harder` max distance is `2x` fastest | Vitest | Forced route distance checked in routing tests. | Covered / Passing | Add UI assertion if route summary exposes comparison later. |
| ROUTE-007 | 9 | Try Harder warning appears when non-signalized crossings remain | None | Message exists in app logic but no stable UI test. | Gap | Add fixture or known route that still has non-signalized crossings after Try Harder. |
| ROUTE-008 | 7 | Same start and destination distance is zero | Vitest | `calculates zero distance for same coordinate`. | Covered / Passing | None. |
| ROUTE-009 | 7 | Start/end snap to graph nodes and include snap distance | Vitest | Start/end not exact graph nodes test. | Covered / Passing | None. |
| ROUTE-010 | 12 | Empty or disconnected graph returns clear error | Vitest | Empty road graph test. | Covered / Passing | Add disconnected graph test if disconnected data becomes realistic. |

## Map And Result UI Traceability

| ID | Spec Ref | Requirement | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | 10 | Map shows route line, start, destination, traffic-light markers, and yellow mismatch markers when relevant | Playwright + implementation | Map rendering test covers main layers; routing logic exposes mismatch marker coordinates. | Partial | Add direct marker-count assertion for yellow mismatch markers. |
| UI-002 | 10 | Traffic-light markers look like traffic-light symbols | Playwright | `.traffic-light-marker` visible. | Partial | Add visual/size assertion if icon CSS changes frequently. |
| UI-003 | 10 | Map does not label all intersections as traffic lights | Playwright + implementation | Map uses `signalized_intersections.geojson`, not intersections layer. | Covered / Passing | None. |
| UI-004 | 10 | Map attribution labels are not visible | Playwright | Map rendering test asserts `.leaflet-control-attribution` is not present. | Covered / Passing | None. |
| UI-005 | 11 | Result panel displays required route values | Playwright | Fastest route test checks distance, time, mode, traffic lights, possible crossing-data mismatches, and crossing counts. | Covered / Passing | None. |
| UI-005A | 8, 10, 11 | Yellow mismatch markers are shown only for non-signalized OSM pedestrian crossings and do not hide traffic-light markers | Vitest + planned Playwright | Route metrics verify mismatch count matches non-signalized crossings for known routes; marker layer renders below traffic-light route markers. | Partial | Add Playwright marker-count and z-order visual assertion. |
| UI-006 | 11 | `Try harder` not shown when route has signalized crossings | Playwright | Prefer-traffic-lights route test asserts the `Try harder` button is absent for a route with signalized crossings. | Covered / Passing | None. |
| UI-007 | 12 | Missing From/To errors are shown | Playwright | Missing address validation test. | Covered / Passing | None. |
| UI-008 | 12 | Address not found is clear and route is not drawn | Test docs only | Planned in UI test cases. | Gap | Add Playwright test with mocked empty geocoder and no municipality match. |
| UI-009 | 12 | Road graph loading/failure errors are shown | Test docs only | Planned in UI test cases. | Gap | Add Playwright route-mock tests for failed GeoJSON loads. |
| UI-010 | 10, 11 | Mobile layout remains usable and readable | Playwright | Mobile load, autocomplete, and route calculation tests. | Covered / Passing | Add screenshot/overlap checks if visual regressions continue. |

## Security And Robustness Traceability

| ID | Spec Ref | Requirement / Risk | Test Type | Current Automated Coverage | Status | Gap / Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | General | No API keys or secrets in frontend config | Manual / static | No explicit automated test. | Gap | Add secret scan or CI check before release. |
| SEC-002 | General | External geocoder data is not trusted as safety data | Architecture + tests | Route is built from local graph. | Partial | Add explicit test if geocoder result is malicious/outside bounds. |
| SEC-003 | General | External/map popup text should not inject HTML | Implementation | Traffic-light popup text is escaped before insertion into Leaflet popup HTML. | Partial | Add unit test for escaping if popup logic is extracted. |
| SEC-004 | General | GeoJSON files are valid and do not break app load | Vitest + Playwright | Data load tests exist. | Partial | Add malformed-data negative tests if import pipeline changes. |
| SEC-005 | General | Dependency risk reviewed | Manual | Not covered by current automated tests. | Gap | Run `npm audit` as release check and document result. |

## Current Highest-Priority Gaps

1. `SEARCH-013`: External autocomplete can show nearby non-Tel-Aviv places if the result looks like Tel Aviv inside the current bounds; stricter municipality boundary data is still not implemented.
2. `UI-008` and `UI-009`: Address-not-found and data-load failure UI states are planned but not automated.
3. `SEC-003`: Popup text escaping was added, but no dedicated unit test exists yet.
4. `ROUTE-004`: Add explicit fixture where a better signalized route is over `1.3x` and normal mode rejects it.

## Release QA Checklist

Before reporting a release as product-passed:

1. Update `docs/spec.md`.
2. Update this traceability matrix.
3. Run `npm test -- --run`.
4. Run `npm run test:e2e`.
5. Run `npm run lint`.
6. Run `npm run build`.
7. Review all rows marked `Gap` or `Partial`.
8. State remaining product risks explicitly in the final QA report.
