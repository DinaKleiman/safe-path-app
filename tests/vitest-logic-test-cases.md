# Safe Path Vitest Logic Test Cases

These tests validate app logic without a browser. They should run with `npm test`.

## Test Case Types

### Positive Logic Tests

- VIT-POS-001: Fastest route is calculated
- VIT-POS-002: Prefer traffic lights route is calculated
- VIT-POS-003: Fastest route is shorter
- VIT-POS-004: Prefer traffic lights has more traffic lights
- VIT-POS-005: Try harder forces a traffic-light route
- VIT-POS-006: Hebrew school prefix resolves to a school
- VIT-POS-007: Hebrew and English address search both work
- VIT-POS-008: Street-only search is autocomplete-only and not routable
- VIT-POS-009: Fuzzy typo correction suggests close street/school matches

### Negative Logic Tests

- VIT-NEG-001: Empty road graph
- VIT-NEG-002: Ambiguous address without prefix or house number
- VIT-NEG-003: School-prefixed search does not mix with same-name street

### Edge Logic Tests

- VIT-EDGE-001: Same start and destination coordinate
- VIT-EDGE-002: Start/end are not exact graph nodes
- VIT-EDGE-003: Unknown route mode
- VIT-EDGE-004: Quote variants are normalized
- VIT-EDGE-005: Street tokens can be typed in different order

### Municipality Data Tests

- VIT-DATA-001: Roads file structure
- VIT-DATA-002: Traffic-light file structure
- VIT-DATA-003: Real graph size
- VIT-DATA-004: Traffic lights attach to graph
- VIT-DATA-005: Stable known route result
- VIT-DATA-006: Short Sharett to Belkind forced traffic-light route

## Positive Logic Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| VIT-POS-001 | Routing | Fastest route is calculated | Build graph from municipality roads. Calculate route from `משה שרת 80` to `Tel Aviv Port` with `fastest`. | Route is returned with valid LineString geometry, distance, and traffic-light count. | Passed |
| VIT-POS-002 | Routing | Prefer traffic lights route is calculated | Build graph from municipality roads and traffic lights. Calculate same route with `preferTrafficLights`. | Route is returned and includes more traffic-light-connected points than `fastest`. | Passed |
| VIT-POS-003 | Routing | Fastest route is shorter | Compare `fastest` and `preferTrafficLights` for `משה שרת 80` to `Tel Aviv Port`. | `fastest.distanceMeters < preferTrafficLights.distanceMeters`. | Passed |
| VIT-POS-004 | Routing | Prefer traffic lights has more traffic lights | Compare traffic-light count for `fastest` and `preferTrafficLights`. | `preferTrafficLights.trafficLights.length > fastest.trafficLights.length`. | Passed |
| VIT-POS-005 | Routing | Try harder forces a traffic-light route | Build graph with a short direct route and a longer route through a traffic light. Call forced traffic-light routing. | Returned route includes at least one traffic light. | Passed |
| VIT-POS-006 | Address search | Hebrew school prefix resolves to a school | Search for `בה״ס אהבת ציון`, `ביהס אהבת ציון`, and `בית ספר אהבת ציון`. | All variants resolve to `בית ספר אהבת ציון, כהנשטם 16`. | Passed |
| VIT-POS-007 | Address search | Hebrew and English address search both work | Search for `משה שרת 80` and `Sharet 80`. | Hebrew result is `שרת משה 80`; English result is `SHARET 80`. | Passed |
| VIT-POS-008 | Autocomplete logic | Street-only search is autocomplete-only and not routable | Search for `נמ` and `nam`, then try to route `נמיר מרדכי` without a house number. | Street suggestions appear, but `findMunicipalityPlace` returns no routable place without a house number. | Passed |
| VIT-POS-009 | Fuzzy search | Fuzzy typo correction suggests close street/school matches | Search for `נמירר`, `namr`, and `בית ספר אהבת ציונ`. | Close typo suggestions are returned and school typo resolves with a school prefix. | Passed |

## Negative Logic Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| VIT-NEG-001 | Routing | Empty road graph | Build graph from empty FeatureCollection and request route. | Error: `Municipality road network is empty.` | Passed |
| VIT-NEG-002 | Address search | Ambiguous address without prefix or house number | Search for `אהבת ציון` and `משה שרת`. | No routable result is returned. User must add a school prefix or building number. | Passed |
| VIT-NEG-003 | Address search | School-prefixed search does not mix with same-name street | Search for `בית ספר אהבת ציון`. | Only the school result is returned, not the same-name street. | Passed |

## Edge Logic Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| VIT-EDGE-001 | Distance | Same start and destination coordinate | Calculate distance between identical coordinates. | Distance is `0`. | Passed |
| VIT-EDGE-002 | Routing | Start/end are not exact graph nodes | Use coordinates near the road graph, not exactly on nodes. | App snaps to nearest road nodes and includes snap distance. | Passed |
| VIT-EDGE-003 | Routing | Unknown route mode | Call route builder with unknown mode. | App falls back to traffic-light preference behavior. | Passed |
| VIT-EDGE-004 | Address search | Quote variants are normalized | Search for `אד״ם הכהן 12` and quote variants of school prefixes. | Search treats regular quotes and Hebrew quote marks as the same. | Passed |
| VIT-EDGE-005 | Address search | Street tokens can be typed in different order | Search for `משה שרת 80`. | App resolves to municipality address `שרת משה 80`. | Passed |

## Municipality Data Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| VIT-DATA-001 | Roads | Roads file structure | Load `public/data/roads.geojson`. | All features used by routing are LineStrings. | Passed |
| VIT-DATA-002 | Traffic lights | Traffic-light file structure | Load `public/data/signalized_intersections.geojson`. | All features are Points. | Passed |
| VIT-DATA-003 | Graph | Real graph size | Build graph from municipality roads. | Graph has more than 10,000 nodes. | Passed |
| VIT-DATA-004 | Traffic lights | Traffic lights attach to graph | Build graph with traffic-light data. | More than 495 graph nodes are annotated with nearby traffic lights. | Passed |
| VIT-DATA-005 | Known route | Stable known route behavior | Route `משה שרת 80` to `Tel Aviv Port`. | `preferTrafficLights` stays within the reasonable-distance limit, has more traffic-light-connected points than `fastest`, and has fewer non-signalized crossings. | Passed |
| VIT-DATA-006 | Known route | Short Sharett to Belkind forced traffic-light route | Route `84 Moshe Sharett` to `1 Belkind` with normal and forced traffic-light routing. | Normal route has `0` traffic lights; forced route has at least `1` traffic light and is longer. | Passed |
