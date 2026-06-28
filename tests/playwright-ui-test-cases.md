# Safe Path Playwright UI Test Cases

These tests validate the real browser experience. They should be automated with Playwright and run against the web app in desktop and mobile viewports.

Current status: planned, unless marked otherwise. A few autocomplete checks were manually spot-checked in the live app browser, but there is not yet a committed Playwright test suite.

## Test Case Types

### Autocomplete Tests

- PW-AUTO-001: Hebrew street prefix shows Hebrew street options
- PW-AUTO-002: English street prefix shows English street options
- PW-AUTO-003: Multi-word Hebrew streets appear
- PW-AUTO-004: Multi-word English streets appear
- PW-AUTO-005: Hebrew quote variants work
- PW-AUTO-006: English apostrophe variants work
- PW-AUTO-007: Fuzzy typo suggestion appears
- PW-AUTO-008: School prefix shows school results
- PW-AUTO-009: No prefix and no house number asks for full address
- PW-AUTO-010: Street-only suggestion is not treated as a routable address
- PW-AUTO-011: Address autocomplete ranking is acceptable for known regression streets

### Web Route Tests

- PW-WEB-001: Desktop app loads
- PW-WEB-002: Route mode list is correct
- PW-WEB-003: Balanced mode is removed
- PW-WEB-004: Only one route mode can be selected
- PW-WEB-005: Fastest desktop route is calculated
- PW-WEB-006: Prefer traffic lights desktop route is calculated
- PW-WEB-007: Route result displays required values
- PW-WEB-008: Route appears on map

### Negative UI Tests

- PW-NEG-001: Missing From address
- PW-NEG-002: Missing To address
- PW-NEG-003: Unknown address
- PW-NEG-004: Missing roads file
- PW-NEG-005: Missing traffic-light file
- PW-NEG-006: Input shorter than minimum length

### Try Harder Tests

- PW-TRY-001: Try harder appears when route has no traffic lights
- PW-TRY-002: Try harder searches for a route through traffic lights
- PW-TRY-003: Try harder explains when no traffic-light route can be found

### Map Tests

- PW-MAP-001: Map loads
- PW-MAP-002: Traffic-light symbols are visible
- PW-MAP-003: Traffic-light symbols use the expected small size
- PW-MAP-004: Start and destination markers appear
- PW-MAP-005: Route line appears after calculation
- PW-MAP-006: Route traffic-light count matches route result text

### Mobile Tests

- PW-MOB-001: Mobile app loads
- PW-MOB-002: Mobile address entry works
- PW-MOB-003: Mobile autocomplete remains usable
- PW-MOB-004: Mobile route mode selection works
- PW-MOB-005: Mobile route calculation works
- PW-MOB-006: Mobile result text wraps without overlap
- PW-MOB-007: Mobile map remains visible after route calculation

## Autocomplete Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-AUTO-001 | Autocomplete | Hebrew street prefix shows Hebrew street options | Type `נמי` in From field. | `נמיר מרדכי` appears as a street option. | Manual spot check passed |
| PW-AUTO-002 | Autocomplete | English street prefix shows English street options | Type `nami` in From field. | `NAMIR` appears as a street option. | Manual spot check passed |
| PW-AUTO-003 | Autocomplete | Multi-word Hebrew streets appear | Type prefixes for `אבן גבירול`, `שאול המלך`, `יהודה הלוי`, `רוקח ישראל`, and `נמל תל אביב`. | Matching Hebrew street options appear. | Planned |
| PW-AUTO-004 | Autocomplete | Multi-word English streets appear | Type prefixes for `IBN GVIROL`, `SHARET`, `YIG'AL ALLON`, `ROKACH YISRA'EL`, and `NAMEL TEL AVIV`. | Matching English street options appear. | Planned |
| PW-AUTO-005 | Autocomplete | Hebrew quote variants work | Type `אדם` and `אד״ם`. | `אד"ם הכהן` appears. | Manual spot check passed |
| PW-AUTO-006 | Autocomplete | English apostrophe variants work | Type `yiga` and `YIGAL ALLON`. | `YIG'AL ALLON` appears or resolves. | Planned |
| PW-AUTO-007 | Autocomplete | Fuzzy typo suggestion appears | Type `נמירר` and `namr`. | Close street suggestions appear, including `נמיר מרדכי` or `NAMIR`. | Planned |
| PW-AUTO-008 | Autocomplete | School prefix shows school results | Type `בית ספר אהבת ציון` and `בה״ס אהבת ציון`. | School result appears as `בית ספר אהבת ציון, כהנשטם 16`. | Planned |
| PW-AUTO-009 | Autocomplete | No prefix and no house number asks for full address | Type `אהבת ציון` and click Find route. | App asks for a full address with building number or school prefix. | Planned |
| PW-AUTO-010 | Autocomplete | Street-only suggestion is not treated as a routable address | Select or type `נמיר מרדכי` without house number and click Find route. | App does not route and asks for a full address. | Planned |
| PW-AUTO-011 | Autocomplete | Address autocomplete ranking is acceptable for known regression streets | Type progressively longer prefixes for `בן יהודה`, `קהילת ריגה`, and `קהילת פוזנא`. | Expected street appears once enough characters are typed; ranking behavior is documented. | Planned |

## Web Route Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-WEB-001 | Load | Desktop app loads | Open app at desktop viewport. | App loads with no console errors. | Planned |
| PW-WEB-002 | Controls | Route mode list is correct | Inspect route mode controls. | Only `Prefer traffic lights` and `Fastest` are visible. | Planned |
| PW-WEB-003 | Controls | Balanced mode is removed | Search visible UI for `Balanced`. | `Balanced` is not visible. | Planned |
| PW-WEB-004 | Controls | Only one route mode can be selected | Select `Fastest`, then select `Prefer traffic lights`. | Only the last selected radio option is checked. | Planned |
| PW-WEB-005 | Route | Fastest desktop route is calculated | Enter `משה שרת 80` to `Tel Aviv Port`, select `Fastest`, click Find route. | Result shows about `2.33 km` and route traffic-light count. | Planned |
| PW-WEB-006 | Route | Prefer traffic lights desktop route is calculated | Enter same A/B, select `Prefer traffic lights`, click Find route. | Result shows about `2.84 km` and more traffic lights than fastest. | Planned |
| PW-WEB-007 | Result | Route result displays required values | Calculate a valid route. | Result shows distance, estimated walking time, route mode, and traffic-light count. | Planned |
| PW-WEB-008 | Map | Route appears on map | Calculate valid route. | Map status says route is shown and route line is rendered. | Planned |

## Negative UI Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-NEG-001 | Address | Missing From address | Clear From field and click Find route. | User sees validation error requiring both addresses. | Planned |
| PW-NEG-002 | Address | Missing To address | Clear To field and click Find route. | User sees validation error requiring both addresses. | Planned |
| PW-NEG-003 | Address | Unknown address | Enter an address outside Tel Aviv or invalid text. | App shows address-not-found or unavailable message. | Planned |
| PW-NEG-004 | Data | Missing roads file | Simulate failed `/data/roads.geojson` request. | App shows municipality road loading error. | Planned |
| PW-NEG-005 | Data | Missing traffic-light file | Simulate failed `/data/signalized_intersections.geojson` request. | App shows municipality traffic-light loading error. | Planned |
| PW-NEG-006 | Autocomplete | Input shorter than minimum length | Type one character. | No suggestions are shown. | Planned |

## Try Harder Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-TRY-001 | Try harder | Button appears when route has no traffic lights | Calculate a route known to have no traffic lights. | App shows calm message and `Try harder` button. | Planned |
| PW-TRY-002 | Try harder | Button searches for a traffic-light route | Click `Try harder`. | App recalculates a route that passes through at least one traffic light when possible. | Planned |
| PW-TRY-003 | Try harder | No traffic-light route can be found | Use a case where no traffic-light route is possible. | App explains that no traffic-light route was found. | Planned |

## Map Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-MAP-001 | Map | Map loads | Open app and wait for map. | Leaflet map is visible. | Planned |
| PW-MAP-002 | Map | Traffic-light symbols are visible | Wait for traffic-light layer. | Traffic-light icons are visible, not generic blue intersection dots. | Planned |
| PW-MAP-003 | Map | Traffic-light symbols use expected small size | Inspect rendered traffic-light icons. | Icons use the reduced size requested for the app. | Planned |
| PW-MAP-004 | Map | Start and destination markers appear | Calculate route. | Start and destination markers are visible. | Planned |
| PW-MAP-005 | Map | Route line appears after calculation | Calculate valid route. | Route polyline is visible. | Planned |
| PW-MAP-006 | Map | Route traffic-light count matches result text | Calculate valid route. | Header count and result count are consistent. | Planned |

## Mobile Tests

| ID | Area | Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- | --- |
| PW-MOB-001 | Layout | Mobile app loads | Open app in mobile viewport. | Main controls are visible without horizontal overflow. | Planned |
| PW-MOB-002 | Forms | Mobile address entry works | Tap From and To fields, enter addresses. | Text entry works and fields remain usable. | Planned |
| PW-MOB-003 | Autocomplete | Mobile autocomplete remains usable | Type `נמי` and `nami` in mobile viewport. | Suggestions appear and do not cover critical controls incorrectly. | Planned |
| PW-MOB-004 | Controls | Mobile route mode selection works | Tap each route mode option. | Only one option is selected at a time. | Planned |
| PW-MOB-005 | Route | Mobile route calculation works | Calculate `משה שרת 80` to `Tel Aviv Port`. | Route result is visible and readable. | Planned |
| PW-MOB-006 | Text | Mobile result text wraps without overlap | Check result panel after route calculation. | Distance, time, mode, and traffic-light count do not overlap. | Planned |
| PW-MOB-007 | Map | Mobile map remains visible after route calculation | Calculate route and inspect map area. | Map remains visible and route status updates. | Planned |
