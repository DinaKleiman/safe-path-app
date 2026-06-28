# Safe Path Specification

## 1. Product Purpose

Safe Path helps pedestrians choose safer walking routes in Tel Aviv.

The app is not only a map. Its purpose is to support safer movement decisions, especially around road crossings, traffic-light crossings, schools, and areas that may become risky for pedestrians.

The first version focuses on:

- Accepting a start location and destination.
- Displaying a route on the map.
- Showing Tel Aviv traffic-light locations.
- Supporting Hebrew and English address input.
- Preparing the logic for future safety-based route scoring.

## 2. Core Data Principle

Safe Path should use Tel Aviv Municipality maps as the source of truth for safety and routing logic.

This means municipality data decides:

- Road-network distance.
- Traffic-light locations.
- Intersection context.
- Future accident-risk logic.
- Future bicycle-lane logic.
- Future pedestrian-safety scoring.

External services may be used only as helper or display layers. They should not decide whether a route is safe.

Allowed helper/display layers:

- OpenStreetMap tile layer: visual background only.
- Nominatim address search: converts typed text into coordinates only.

Not allowed as Safe Path source of truth:

- External traffic-light data.
- External intersection safety data.
- External accident-risk data.
- External bicycle-lane safety data.
- External route safety scoring.

Routing engines should not be treated as the source of safety truth. If an external routing engine is temporarily used to draw a route shape, the final Safe Path logic should still be based on municipality data.

Target direction:

- Use municipality road data for route distance.
- Use municipality traffic-light data to identify traffic-light locations.
- Use municipality datasets for future accident and bicycle-lane layers.

Current municipality files:

- `roads.geojson`
- `intersections.geojson`
- `signalized_intersections.geojson`

If a future safety feature cannot be supported by these files, the app should require another Tel Aviv Municipality dataset instead of using a non-municipality safety source.

## 3. Target Users

Primary users:

- Pedestrians in Tel Aviv.
- Parents planning routes for children.
- School-related walking routes.
- Elderly pedestrians or users who prefer safer crossings.
- Users who want a safer alternative to the shortest route.

Future users:

- Cyclists who want safer bicycle routes based on official bike-lane data.

## 4. Core User Flow

1. User enters a start location.
2. User enters a destination.
3. App checks address suggestions while the user types.
4. User can select an autocomplete suggestion.
5. User clicks `Find safe route`.
6. App draws the route on the map.
7. App shows start and destination markers.
8. App shows traffic-light locations on the map.
9. App shows route distance and estimated time.

## 5. Address Input Logic

The app should support both Hebrew and English input.

Examples:

- `Dizengoff Center`
- `Tel Aviv Port`
- `בית הספר גרץ`
- `בה״ס גרץ`
- `אד"ם הכהן`

### Autocomplete

While the user types in either address field, the app should check possible address matches.

Autocomplete behavior:

- Starts after at least 2 characters.
- Uses a short delay so it does not search on every keystroke immediately.
- Shows matching Tel Aviv locations.
- Includes local known aliases when external geocoding is incomplete.
- Lets the user select one suggestion.
- Fills the input field with the selected suggestion.

Important limitation:

- The current municipality road file includes street names, but does not include all building addresses, house numbers, schools, businesses, or landmarks.
- For full address autocomplete using municipality-only data, the app needs a Tel Aviv Municipality address/places dataset.
- Until that dataset is added, autocomplete can support street names from `roads.geojson` and known local aliases.

### Local Address Aliases

Some local names or Hebrew abbreviations may not be recognized by external geocoding services.

The app should support local fallback mappings for important known places.

Current required local fallback:

- `בית הספר גרץ`
- `בה״ס גרץ`
- `ביה״ס גרץ`

These should resolve to:

- `בית הספר גרץ, אד"ם הכהן, תל אביב`

This is important because `בית הספר גרץ` should not resolve to `רחוב גרץ`.

### Address Not Found

If an address is not found:

- The app should try common Tel Aviv variants.
- The app should try Hebrew/English forms when available.
- The app should try local aliases.
- If still not found, the app should show a clear error message.

The app should not silently fail.

## 6. Map Display Logic

The map should display:

- Municipality road network as the base map.
- Route line.
- Start point.
- Destination point.
- Traffic-light locations.

Traffic-light locations should be shown as traffic-light symbols, not generic intersection dots.

The map should not make users think all intersections are traffic lights.

## 7. Distance and Route Logic

The app should calculate route distance from the Tel Aviv Municipality road network.

Basic logic:

1. Load `roads.geojson`.
2. Convert each road LineString into graph edges.
3. Use road coordinates as graph nodes.
4. Calculate each edge distance from its coordinates.
5. Convert user start and destination into map points.
6. Snap each point to the nearest road node or nearest road segment.
7. Run shortest-path search through the road graph.
8. Sum the selected road-edge distances.
9. Draw the resulting route geometry.

Recommended first algorithm:

- Dijkstra shortest path.

Why this is enough for first version:

- All edges have a distance.
- The app only needs shortest route first.
- Later, safety weights can modify edge cost.

Distance meaning:

- Distance should be the length of the selected road-network path.
- It should not be straight-line distance between A and B.

Walking-time meaning:

- Walking time should be calculated from the road-network distance.
- Formula: `walking time seconds = route distance meters / 1.3`
- `1.3 m/s` is about `4.7 km/h`.

What is needed for A/B text input:

- If A and B are already coordinates, distance can be calculated from `roads.geojson`.
- If A and B are text addresses, the app needs a way to convert text into coordinates.
- With current municipality files, this is possible for street names and known aliases, but not for every exact address.
- For exact addresses, the app needs a municipality address/places dataset.

## 8. Data Sources

Map safety layers and traffic-light data should be based on Tel Aviv Municipality data.

Current municipality-based data:

- Traffic-light locations: `צמתים מרומזרים`
- Road data
- Intersection data

The traffic-light layer should represent traffic-light locations only, not every intersection.

Future municipality-based data:

- `מפת תאונות דרכים`
- `שבילי אופניים`
- Municipality address/places dataset

## 9. Route Mode Selection

The user should be able to select only one route mode at a time.

The UI should use a single-choice control:

- Segmented control, or
- Radio buttons, or
- Dropdown

Recommended route modes:

1. `Fastest`
2. `Prefer traffic lights`

Default mode:

- `Prefer traffic lights`

Current implementation:

- Route mode is implemented as single-selection radio options.
- Only one route mode can be selected at a time.

### Fastest

Goal:

- Shortest walking time.

Behavior:

- Uses normal route calculation.
- Shows traffic lights as map context.
- Does not strongly prioritize traffic-light crossings.

Best for:

- Users who want the quickest route.

### Prefer Traffic Lights

Goal:

- Prefer signalized crossings, even if the route is longer.

Behavior:

- Prefers crossings near traffic lights.
- Avoids unsignalized crossings where possible.
- Uses traffic lights as a simple proxy because richer safety data is not available yet.

Best for:

- Children.
- School routes.
- Elderly pedestrians.
- Users who prefer signalized crossings over shortest distance.

### Multiple Mode Selection

The app should not allow more than one route mode at the same time.

Reason:

- `Fastest` and `Safest` can conflict.
- Example: the fastest route may cross a road without traffic lights, while the safest route may add several minutes to reach a traffic-light crossing.

If the UI ever allows more than one mode by mistake, the app should apply this priority:

1. `Prefer traffic lights`
2. `Fastest`

But the preferred design is to prevent multiple selection entirely.

## 10. Safety Scoring Logic

Future versions should compare possible routes using a safety score.

Higher score means safer route.

Example scoring factors:

- Traffic-light crossing: positive score.
- Unsignalized crossing: negative score.
- Major road crossing: negative score.
- Accident-prone area: negative score.
- Quiet street: positive score.
- Extra walking time: small negative score.

### Example

Route A:

- Walking time: 10 minutes
- Road crossings: 4
- Crossings near traffic lights: 1
- Major road crossings: 2
- Accident-prone areas nearby: 1

Route B:

- Walking time: 13 minutes
- Road crossings: 5
- Crossings near traffic lights: 4
- Major road crossings: 1
- Accident-prone areas nearby: 0

Example scoring:

| Factor | Route A | Route B |
| --- | ---: | ---: |
| Base score | 100 | 100 |
| Traffic-light crossings | +10 | +40 |
| Unsignalized crossings | -45 | -15 |
| Major road crossings | -40 | -20 |
| Accident-prone areas | -25 | 0 |
| Extra walking time | 0 | -6 |
| Final score | 0 | 99 |

Interpretation:

- `Fastest` may choose Route A because it is 3 minutes shorter.
- `Prefer traffic lights` should choose Route B because it has more traffic-light crossings.

The exact scoring values can change later. The important logic is that safe features add points, risk factors remove points, and time penalty prevents unreasonable detours.

## 11. Current Walking-Time Logic

Distance should represent the length of the returned route path, not the straight-line distance between the start and destination.

Current walking-time estimate:

- Walking speed: `1.3 meters per second`
- Equivalent speed: about `4.7 km/h`
- Formula: `walking time seconds = route distance meters / 1.3`

Example:

- Distance: `4.07 km`
- Calculation: `4,070 / 1.3 = 3,131 seconds`
- Result: about `52 minutes`

Important note:

- The target logic is municipality-only route distance.
- External routing-service duration should not be used.
- The app should calculate walking time from route distance.

## 12. Future Direction: Accident Map

Future versions should add `מפת תאונות דרכים`.

Purpose:

- Identify accident-prone areas.
- Show accident locations or zones on the map.
- Reduce safety score for routes that pass near repeated accident locations.
- Warn users when a route includes risky segments.

Possible accident-map logic:

- Accident near route: reduce score.
- Multiple accidents in same area: stronger score reduction.
- Pedestrian-related accident: stronger score reduction than general traffic accident.
- Recent accident data: stronger impact than old data.

## 13. Future Direction: Bicycle Safe Path

Future versions should add Safe Path for bicycles.

This should be based on Tel Aviv Municipality `שבילי אופניים` data.

Purpose:

- Help cyclists choose safer bicycle routes.
- Prefer official bicycle infrastructure.
- Avoid unsafe streets for cycling.

Future bicycle route logic:

- Prefer official bicycle lanes.
- Prefer protected or separated bicycle paths.
- Avoid major roads without bicycle infrastructure.
- Avoid complex intersections where possible.
- Use bicycle accident history when available.
- Show bicycle lanes on the map.

Possible travel modes:

1. `Walking`
2. `Bicycle`

For bicycle mode, safety scoring should use bicycle-specific signals:

- Bike lane exists: positive score.
- Protected bike lane: stronger positive score.
- No bike lane on major road: negative score.
- Dangerous intersection: negative score.
- Bicycle accident history: negative score.

## 14. Current Implemented Behavior

Current app behavior:

- Accepts Hebrew and English addresses.
- Provides autocomplete while typing.
- Supports local fallback for `בית הספר גרץ`.
- Allows only one route mode at a time: `Prefer traffic lights` or `Fastest`.
- Draws route from start to destination using `roads.geojson`.
- Calculates route distance from the Tel Aviv Municipality road graph.
- Estimates walking time from route distance using walking speed.
- Shows Tel Aviv traffic-light locations.
- Displays traffic lights as traffic-light symbols.
- Uses traffic-light locations to prefer signalized route segments in `Prefer traffic lights` mode.

Current known limitations:

- OpenStreetMap tiles are still used as visual background only.
- Nominatim is still used as address-to-coordinate helper only.
- Rich safety scoring is not implemented yet.
- Route alternatives are not compared yet.
- Traffic lights are only a simple proxy for safer crossings.
- Accident map is not added yet.
- Bicycle mode is not added yet.

## 15. Open Product Decisions

Questions to decide later:

- How much extra walking time is acceptable for `Safest` mode?
- Should schools have stronger safety weighting?
- Should user age or mobility preference affect route scoring?
- Should accident data be shown directly on the map or only used in scoring?
- Should bicycle mode be a separate travel mode or a separate app section?
- Which Tel Aviv Municipality address/places dataset should be added for exact address lookup?
