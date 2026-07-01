# Safe Path Product Specification

## 1. Objective

Safe Path helps pedestrians in Tel Aviv choose walking routes that prefer road crossings with traffic lights.

The product is not a generic navigation app. The core value is crossing safety: when a route crosses roads, the app should prefer crossings that are signalized, while still keeping walking distance reasonable.

## 2. Release Scope

### In Scope

- Walking routes inside Tel Aviv.
- Hebrew and English location search.
- Autocomplete for addresses, streets, schools, and known local places.
- One route mode selected at a time.
- Route modes:
  - `Prefer traffic lights`
  - `Fastest`
- Route distance calculated from the local road graph.
- Walking time calculated from route distance.
- Traffic-light markers on the map.
- Signalized and non-signalized pedestrian crossing counts in route results.
- Crossings without confirmed traffic lights count and yellow map markers for non-signalized OSM pedestrian crossings on the selected route.
- `Try harder` flow for a longer route when the normal result has no signalized pedestrian crossings.

### Out of Scope For Current Release

- Accident-risk scoring.
- Bicycle routing.
- Bus-stop logic.

## 3. Source Of Truth

### Primary Source

Tel Aviv Municipality data is the primary source for app-owned route and safety logic.

Used now:

| Dataset | File | Purpose |
| --- | --- | --- |
| Roads | `public/data/roads.geojson` | Build walking route graph and calculate route distance |
| Signalized intersections | `public/data/signalized_intersections.geojson` | Identify municipality traffic-light locations |
| Intersections | `public/data/intersections.geojson` | Available for intersection context |
| Addresses | `public/data/addresses.geojson` | Municipality address autocomplete and address matching |
| Schools | `public/data/schools.geojson` | School search and autocomplete |
| Street names | `public/data/street_names.geojson` | Street-name autocomplete |

### Secondary Helper Source

OpenStreetMap pedestrian crossing data is used only because the municipality traffic-light layer does not prove exact pedestrian crossing locations.

Used now:

| Dataset | File | Purpose |
| --- | --- | --- |
| Pedestrian crossings | `public/data/pedestrian_crossings.geojson` | Identify possible pedestrian crossing points and whether they are signalized |
| Map tiles | OpenStreetMap tile layer | Visual map background only |

Required warning when OSM pedestrian crossings affect routing:

`This route partly uses open-source pedestrian crossing data and may contain mismatches.`

### External Services

Nominatim may be used for autocomplete/geocoding helper behavior only.

Nominatim must not decide route safety.

External routing engines must not be the source of route safety logic.

## 4. Core User Flow

1. User enters `From`.
2. User enters `To`.
3. App shows autocomplete suggestions while typing.
4. User selects a suggestion or enters a full address.
5. User selects one route mode.
6. User clicks `Find safe route`.
7. App validates both locations before drawing a route.
8. App builds route from the local road graph.
9. App displays:
   - route line
   - start marker
   - destination marker
   - traffic-light markers
   - distance
   - estimated walking time
   - route mode
   - traffic lights on route
   - crossings without confirmed traffic lights
   - signalized pedestrian crossings
   - non-signalized pedestrian crossings
   - data warning when OSM crossing data is used

## 5. Address And Place Search

### Functional Requirements

- Search must support Hebrew and English.
- Hebrew input should prioritize Hebrew suggestions.
- English input should prioritize English suggestions.
- Search starts after at least 2 characters.
- Results should include all matching entity types, not only streets.
- If a name can mean several entity types, all relevant options must appear.

Example:

Input: `משה שרת`

Expected options may include:

- street named `משה שרת`
- school named `משה שרת`
- other municipality place/entity with the same name, if present in loaded datasets

### Street Without Building Number

If the user selects or enters a street name without a building number, the app must ask for the building number immediately in the address field, before the user clicks `Find safe route`.

Message:

`Enter building number`

The message disappears after a building number is entered.

Full address existence must be verified before the route is built and presented.

### Local Aliases

The app must support common Hebrew school prefixes:

- `בית ספר`
- `ביהס`
- `ביה״ס`
- `בהס`
- `בה״ס`

Example:

`בה״ס גרץ` should resolve to `בית הספר גרץ`, not to `רחוב גרץ`.

## 6. Route Modes

The user can select only one route mode at a time.

Default:

- `Prefer traffic lights`

Allowed modes:

| Mode | Product Meaning | Technical Meaning |
| --- | --- | --- |
| `Fastest` | Shortest available walking route | Minimize road-graph distance |
| `Prefer traffic lights` | Prefer routes with signalized pedestrian crossings | Optimize crossing quality while limiting extra distance |

## 7. Routing Model

### Graph Construction

1. Load `roads.geojson`.
2. Convert each `LineString` coordinate sequence into graph nodes and edges.
3. Edge distance is calculated from geographic coordinates.
4. Load traffic-light points from `signalized_intersections.geojson`.
5. Annotate nearby graph nodes with traffic-light metadata.
6. Load pedestrian crossings from `pedestrian_crossings.geojson`.
7. Annotate nearby graph nodes with pedestrian-crossing metadata.

### Snapping

For each route request:

1. Convert `From` and `To` into coordinates.
2. Snap each coordinate to the nearest road graph node.
3. Add snap distance to final route distance.

### Distance

Distance must be route-path distance through the road graph.

Distance must not be straight-line distance between A and B.

### Walking Time

Walking time is derived from route distance.

Formula:

`walking time seconds = route distance meters / 1.3`

Assumption:

- `1.3 m/s`
- approximately `4.7 km/h`

External service duration must not be used.

## 8. Crossing Logic

### Definitions

Signalized pedestrian crossing:

- OSM crossing marked as signalized, or
- pedestrian crossing near a Tel Aviv Municipality traffic-light point.

Non-signalized pedestrian crossing:

- OSM crossing point that is not marked as signalized and is not near a municipality traffic-light point.

Traffic-light point:

- Municipality signalized-intersection point.

Important limitation:

- A traffic-light point alone does not prove that a pedestrian crossing exists.
- OSM crossing data helps locate pedestrian crossings, but it may contain mismatches.

### Possible Crossing-Data Mismatches

The app must show crossings without confirmed traffic lights for the selected route.

Current visible marker rule:

- Yellow `!` marker appears only for a non-signalized OSM pedestrian crossing on the selected route.
- Yellow marker must not be shown for traffic-light crossings.
- Yellow marker coordinates come from the OSM pedestrian crossing point, not from a generic road point.
- Yellow marker popup text:

`Please note: crossing details here may not be fully verified.`

The result count `Crossings without confirmed traffic lights` must match the number of yellow `!` markers on the route.

The marker should be small enough not to hide traffic-light markers. Current target size: approximately `12px`.

### Ranking Rules

`Fastest`:

- Minimize route distance.
- Traffic lights and crossings are displayed as context.
- Safety preference does not override distance.

`Prefer traffic lights`:

- Prefer routes with more signalized pedestrian crossings.
- Penalize known non-signalized pedestrian crossings.
- Allow non-signalized crossings when no reasonable signalized alternative exists.
- Do not select a safer-looking route if the added distance is unreasonable.

Current internal reasonable-distance limit:

- Up to `1.3x` the fastest route distance.

UI must not expose the numeric `1.3x` value.

User-facing message:

`No better traffic-light crossing route was found within adding reasonable distance.`

## 9. Try Harder Flow

Trigger:

- The normal `Prefer traffic lights` result has no signalized pedestrian crossings.
- The app has no better signalized-crossing route within reasonable added distance.

Button:

- `Try harder`

Before recalculating, show confirmation:

`This can significantly lengthen the path.`

Buttons:

- `Do it anyway`
- `Cancel`

If user selects `Do it anyway`:

- App may calculate a route up to `2x` the fastest route distance.
- App should still prefer signalized pedestrian crossings.
- App should choose the best crossing-score route available inside that limit.

If the returned route still has non-signalized crossings, show:

`Please note: this route may still include crossings without traffic lights.`

If no better route is found up to `2x`, show a clear no-route message.

## 10. Map Requirements

The map must show:

- route line
- start marker
- destination marker
- traffic-light markers from municipality data
- route traffic-light markers when a route is selected
- small yellow `!` markers for crossings without confirmed traffic lights

Traffic-light markers must look like traffic-light symbols, not generic dots.

The map must not label all intersections as traffic lights.

Yellow mismatch markers must not be used for traffic-light crossings and must not visually hide traffic-light markers.

The map should not show visible attribution labels inside the map UI.

## 11. Result Panel Requirements

After route calculation, show:

- `Distance`
- `Estimated walking time`
- `Route mode`
- `Traffic lights on route`
- `Crossings without confirmed traffic lights`
- `Signalized pedestrian crossings`
- `Non-signalized pedestrian crossings`
- data-source warning when OSM crossings are used

Do not show `Try harder` if the current route already includes signalized pedestrian crossings.

## 12. Error States

### Missing Input

If either field is empty:

`Please enter both From and To.`

### Street Without Building Number

If a selected/typed street lacks building number:

`Enter building number`

### Address Not Found

If location cannot be resolved:

- show clear message
- do not draw a route
- keep user input editable

### Road Graph Not Loaded

If road data is still loading:

`Municipality road network is still loading.`

### No Connected Route

If snapped points cannot be connected through the graph:

`No connected municipality road route found.`

## 13. Current Known Limitations

- OSM pedestrian crossing data can be incomplete or mismatched.
- Municipality traffic lights identify signalized intersections, not guaranteed pedestrian crossing geometry.
- Address/place search depends on loaded municipality layers and Nominatim helper behavior.
- Accident-risk scoring is not implemented.
- Bicycle routing is not implemented.
- The app does not validate live street closures.

## 14. Future Work

### Accident Map

Add `מפת תאונות דרכים`.

Purpose:

- identify accident-prone areas
- reduce score near repeated pedestrian accidents
- warn users about risky route segments

### Bicycle Safe Path

Add bicycle routing based on Tel Aviv Municipality `שבילי אופניים`.

Routing should prefer:

- official bicycle lanes
- protected or separated bicycle paths
- lower-risk intersections

Routing should penalize:

- major roads without bicycle infrastructure
- known bicycle accident areas

### School Safety

Add school-specific scoring.

Potential signals:

- school proximity
- משמרת זהב
- time/day availability
- safer crossings near school entrances

## 15. Acceptance Criteria

### Routing

- `Fastest` returns the shortest graph-distance route.
- `Prefer traffic lights` returns a route with better crossing score when available within reasonable added distance.
- `Try harder` requires confirmation before allowing a longer route.
- `Try harder` does not exceed `2x` fastest distance.
- Route distance is calculated from graph edges, not straight-line distance.
- Walking time is calculated from distance using `1.3 m/s`.

### Search

- Hebrew input returns Hebrew suggestions.
- English input returns English suggestions.
- Same-name entities from different layers appear as separate suggestions.
- Street-only selection requires building number.
- Known school aliases resolve to the school, not to a street.

### UI

- Only one route mode can be selected.
- Result panel shows crossing counts.
- OSM crossing warning appears when crossing data is used.
- Map traffic-light markers are visible and are not generic intersection dots.
- Map attribution labels are not visible in the UI.

### Data

- Required GeoJSON files load successfully.
- GeoJSON data files intended for repository storage are tracked through Git LFS.

## 16. Open Product Decisions

- Which additional municipality place layers should be included in first release search?
- Should school-related routes receive stronger safety weighting?
- Should accident data affect score only, map display only, or both?
- Should bicycle routing be a mode inside the same app or a separate section?
- Should user profile, age, or mobility needs change route scoring?
