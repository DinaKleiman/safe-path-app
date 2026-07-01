# Claude QA Review Issues - Codex Fixes

## Summary

This file records Codex's position on the Claude QA review issues and what was fixed on branch `OtherAIModelInspection`.

Scope of this pass:

- Code fixes only.
- No spec changes.
- No edits to the original Claude QA review files.

## Fixed In This Pass

| Issue | Codex position | What changed |
| --- | --- | --- |
| C-1 `street_names.geojson` listed as active but not used | Agree | App now loads `/data/street_names.geojson` and passes it into `buildMunicipalitySearchIndex`. Search can build street suggestions from the dedicated street-name layer, not only from addresses. |
| C-2 route traffic-light markers are generic circles | Agree | Route-specific traffic-light markers now use the same traffic-light icon style as map traffic-light markers. Added `.route-traffic-light-marker` for test targeting. |
| C-3 non-signalized crossings are not truly penalized | Agree | Updated route weighting so non-signalized crossings are more expensive than regular road segments in `Prefer traffic lights` and `Try harder` modes. Updated crossing score so signalized crossings dominate and non-signalized crossings are penalized. |
| C-4 OSM warning always shown | Agree | Warning is now shown only when the selected route has pedestrian crossing data. Playwright helper no longer assumes the warning is always visible. |
| C-5 Try Harder disconnected graph uses wrong error | Agree | `buildTrafficLightRoute` now throws `No connected municipality road route found.` when the graph cannot connect start and destination. |
| C-6 user-facing header contains debug/test copy | Agree | Replaced `Test: enter A and B...` with product copy: `Prefer walking routes through signalized crossings.` |
| H-2 Try Harder compares against fastest route, not displayed route | Agree | Issue meaning: when user clicks `Try harder`, the app must compare the new route against the route currently shown to the user, not always against `Fastest`. Fixed: `Try harder` now compares candidate improvement against the displayed route. Conclusion: no remaining H-2 logic defect; recalculating the displayed route is deterministic and acceptable. |

## Additional Agreed Fixes

These were fixed after the first critical/high pass.

| Issue | Codex position | Explanation |
| --- | --- | --- |
| M-1 test-case markdown expected distance is outdated | Agree | Fixed. `tests/vitest-logic-test-cases.md` now describes expected behavior instead of stale exact route values. |
| M-3 exact route values in tests are brittle | Agree | Fixed for the real-data known-route test. It now checks relative route behavior, reasonable distance, traffic-light improvement, and non-signalized crossing reduction instead of exact distance/count values. |
| M-4 no test for Try Harder remaining non-signalized warning | Agree | Fixed. Playwright now asserts the warning when Try Harder returns a route that still includes non-signalized crossings. |
| M-6 tests/code use internal route mode id `safest` | Agree | Fixed. Internal route mode id is now `preferTrafficLights`. |
| L-1 unused `src/components/RoutePanel.jsx` | Agree | Fixed. Removed the unused file. |
| L-2 unused `src/utils/routing.js` | Agree | Fixed. Removed the unused file. |
| L-3 unused `src/utils/safetyScore.js` | Agree | Fixed. Removed the unused placeholder. |

## Remaining Issues

| Issue | Codex position | Explanation |
| --- | --- | --- |
| H-1 mismatch count equals non-signalized crossings | Partly agree | With the latest product decision, yellow markers and the `Crossings without confirmed traffic lights` count intentionally represent non-signalized OSM pedestrian crossings on the selected route. The label was changed for UX clarity; the marker logic was not changed. |

## Verification

Commands run after the fixes:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 25 tests |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5178 PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --workers=1 --project=desktop tests/e2e/routing.spec.js` | Passed: 7 tests |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5178 PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --workers=1 --project=desktop tests/e2e/autocomplete.spec.js` | Passed: 12 tests |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5178 PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --workers=1 --project=mobile tests/e2e/mobile.spec.js` | Passed: 3 tests |

Note: the default parallel `npm run test:e2e` run failed because the sandbox/dev-server run collapsed around localhost startup. The same Playwright coverage passed against a manually started local server with one worker.
