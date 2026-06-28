# Safe Path Test Cases

## Test Case Types

### Positive Test Cases

- POS-001: Fastest route is calculated
- POS-002: Prefer traffic lights route is calculated
- POS-003: Fastest route is shorter
- POS-004: Prefer traffic lights has more traffic lights
- POS-005: Local Hebrew fallback works
- POS-006: Local English fallback works
- POS-007: Only one route mode can be selected
- POS-008: Route result displays required values
- POS-009: Try harder forces a traffic-light route

### Negative Test Cases

- NEG-001: Empty road graph
- NEG-002: Missing From address
- NEG-003: Missing To address
- NEG-004: Unknown address
- NEG-005: Missing roads file
- NEG-006: Missing traffic-light file

### Edge Test Cases

- EDGE-001: Same start and destination coordinate
- EDGE-002: Start/end are not exact graph nodes
- EDGE-003: Unknown route mode
- EDGE-004: Input shorter than minimum length
- EDGE-005: External geocoder fails but local fallback exists
- EDGE-006: Recalculate same A/B with different mode

### Municipality Data Test Cases

- DATA-001: Roads file structure
- DATA-002: Traffic-light file structure
- DATA-003: Real graph size
- DATA-004: Traffic lights attach to graph
- DATA-005: Stable known route result
- DATA-006: Short Sharett to Belkind forced traffic-light route

### Web UI Test Cases

- WEB-001: Desktop app loads
- WEB-002: Route mode list
- WEB-003: Balanced is removed
- WEB-004: Fastest desktop route
- WEB-005: Prefer traffic lights desktop route
- WEB-006: Route appears on map

### Mobile Test Cases

- MOB-001: Mobile app loads
- MOB-002: Mobile address entry
- MOB-003: Mobile route mode selection
- MOB-004: Mobile route calculation
- MOB-005: Mobile result text wrapping
- MOB-006: Mobile map visibility

## Positive Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| POS-001 | Routing | Fastest route is calculated | Build graph from municipality roads. Calculate route from `משה שרת 80` to `Tel Aviv Port` with `fastest`. | Route is returned with valid LineString geometry, distance, and traffic-light count. | Vitest | Passed |
| POS-002 | Routing | Prefer traffic lights route is calculated | Build graph from municipality roads and traffic lights. Calculate same route with `safest`. | Route is returned and includes more traffic-light-connected points than `fastest`. | Vitest | Passed |
| POS-003 | Routing | Fastest route is shorter | Compare `fastest` and `safest` for `משה שרת 80` to `Tel Aviv Port`. | `fastest.distanceMeters < safest.distanceMeters`. | Vitest | Passed |
| POS-004 | Routing | Prefer traffic lights has more traffic lights | Compare traffic-light count for `fastest` and `safest`. | `safest.trafficLights.length > fastest.trafficLights.length`. | Vitest | Passed |
| POS-005 | Address | Local Hebrew fallback works | Enter `בה״ס גרץ`. | App suggests `בית הספר גרץ, אד"ם הכהן, תל אביב`. | Planned Playwright | Not run |
| POS-006 | Address | Local English fallback works | Enter `Tel Aviv Port`. | App resolves to local Tel Aviv Port coordinates. | Planned Playwright | Not run |
| POS-007 | UI | Only one route mode can be selected | Select `Fastest`, then select `Prefer traffic lights`. | Only the last selected radio option is checked. | Planned Playwright | Not run |
| POS-008 | UI | Route result displays required values | Calculate a valid route. | Result shows distance, estimated walking time, route mode, and traffic-light count. | Planned Playwright | Not run |
| POS-009 | Routing | Try harder forces a traffic-light route | Build graph with a short direct route and a longer route through a traffic light. Call forced traffic-light routing. | Returned route includes at least one traffic light. | Vitest | Passed |

## Negative Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| NEG-001 | Routing | Empty road graph | Build graph from empty FeatureCollection and request route. | Error: `Municipality road network is empty.` | Vitest | Passed |
| NEG-002 | Address | Missing From address | Clear From field and click Find route. | User sees validation error requiring both addresses. | Planned Playwright | Not run |
| NEG-003 | Address | Missing To address | Clear To field and click Find route. | User sees validation error requiring both addresses. | Planned Playwright | Not run |
| NEG-004 | Address | Unknown address | Enter an address outside Tel Aviv or invalid text. | App shows address-not-found or unavailable message. | Planned Playwright | Not run |
| NEG-005 | Data | Missing roads file | Simulate failed `/data/roads.geojson` request. | App shows municipality road loading error. | Planned Playwright | Not run |
| NEG-006 | Data | Missing traffic-light file | Simulate failed `/data/signalized_intersections.geojson` request. | App shows municipality traffic-light loading error. | Planned Playwright | Not run |

## Edge Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| EDGE-001 | Distance | Same start and destination coordinate | Calculate distance between identical coordinates. | Distance is `0`. | Vitest | Passed |
| EDGE-002 | Routing | Start/end are not exact graph nodes | Use coordinates near the road graph, not exactly on nodes. | App snaps to nearest road nodes and includes snap distance. | Vitest | Passed |
| EDGE-003 | Routing | Unknown route mode | Call route builder with unknown mode. | App falls back to traffic-light preference behavior. | Vitest | Passed |
| EDGE-004 | Autocomplete | Input shorter than minimum length | Type one character. | No suggestions are shown. | Planned Playwright | Not run |
| EDGE-005 | Autocomplete | External geocoder fails but local fallback exists | Type `בה״ס גרץ` while geocoder is unavailable. | Local suggestion still appears. | Planned Playwright | Not run |
| EDGE-006 | UI | Recalculate same A/B with different mode | Calculate `Fastest`, then `Prefer traffic lights`. | Map redraws and result values update. | Planned Playwright | Not run |

## Municipality Data Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DATA-001 | Roads | Roads file structure | Load `public/data/roads.geojson`. | All features used by routing are LineStrings. | Vitest | Passed |
| DATA-002 | Traffic lights | Traffic-light file structure | Load `public/data/signalized_intersections.geojson`. | All features are Points. | Vitest | Passed |
| DATA-003 | Graph | Real graph size | Build graph from municipality roads. | Graph has more than 10,000 nodes. | Vitest | Passed |
| DATA-004 | Traffic lights | Traffic lights attach to graph | Build graph with traffic-light data. | More than 495 graph nodes are annotated with nearby traffic lights. | Vitest | Passed |
| DATA-005 | Known route | Stable known route result | Route `משה שרת 80` to `Tel Aviv Port`. | `fastest` is about `2325m` and `safest` is about `2842m`. | Vitest | Passed |
| DATA-006 | Known route | Short Sharett to Belkind forced traffic-light route | Route `84 Moshe Sharett` to `1 Belkind` with normal and forced traffic-light routing. | Normal route has `0` traffic lights; forced route has at least `1` traffic light and is longer. | Vitest | Passed |

## Web UI Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| WEB-001 | Load | Desktop app loads | Open app at desktop viewport. | App loads with no console errors. | Planned Playwright | Not run |
| WEB-002 | Controls | Route mode list | Inspect route mode controls. | Only `Prefer traffic lights` and `Fastest` are visible. | Planned Playwright | Not run |
| WEB-003 | Controls | Balanced is removed | Search visible UI for `Balanced`. | `Balanced` is not visible. | Planned Playwright | Not run |
| WEB-004 | Route | Fastest desktop route | Enter `משה שרת 80` to `Tel Aviv Port`, select `Fastest`, click Find route. | Result shows about `2.33 km` and `6` traffic lights. | Planned Playwright | Not run |
| WEB-005 | Route | Prefer traffic lights desktop route | Same route, select `Prefer traffic lights`. | Result shows about `2.84 km` and `14` traffic lights. | Planned Playwright | Not run |
| WEB-006 | Map | Route appears on map | Calculate valid route. | Map status says route is shown and route line is rendered. | Planned Playwright | Not run |

## Mobile Test Cases

| ID | Area | Scenario | Steps | Expected Result | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MOB-001 | Layout | Mobile app loads | Open app in mobile viewport. | Main controls are visible without horizontal overflow. | Planned Playwright | Not run |
| MOB-002 | Forms | Mobile address entry | Tap From and To fields, enter addresses. | Text entry works and fields remain usable. | Planned Playwright | Not run |
| MOB-003 | Controls | Mobile route mode selection | Tap each route mode option. | Only one option is selected at a time. | Planned Playwright | Not run |
| MOB-004 | Route | Mobile route calculation | Calculate `משה שרת 80` to `Tel Aviv Port`. | Route result is visible and readable. | Planned Playwright | Not run |
| MOB-005 | Text | Mobile result text wrapping | Check result panel after route calculation. | Distance, time, mode, and traffic-light count do not overlap. | Planned Playwright | Not run |
| MOB-006 | Map | Mobile map visibility | Calculate route and inspect map area. | Map remains visible and route status updates. | Planned Playwright | Not run |
