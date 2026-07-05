# Safe Path Happy Path Flows

This document describes the successful end-to-end user flows for Safe Path. It is a QA and product reference: every flow should stay aligned with `docs/spec.md` and the automated test coverage.

Update this file when:

- the product spec changes;
- address search behavior changes;
- route-building logic changes;
- route result fields change;
- web or mobile UI flow changes;
- happy-path test fixtures change.

## Flow Index

| Flow ID | Flow | Priority | Main Spec Section | Example Fixture | Automation Coverage |
| --- | --- | --- | --- | --- | --- |
| HP-FLOW-001 | App loads with map and route form | P0 | `2. Release Scope`, `10. Map Requirements` | Open app | Playwright |
| HP-FLOW-002 | Hebrew autocomplete returns Hebrew options | P0 | `5. Address And Place Search` | `נמי` -> `נמיר` | Playwright |
| HP-FLOW-003 | English autocomplete returns English options | P0 | `5. Address And Place Search` | `nami` -> `NAMIR` | Playwright |
| HP-FLOW-004 | Hebrew to Hebrew route is built | P0 | `4. Core User Flow`, `7. Routing Model` | `אבן גבירול 71` -> `נמל תל אביב` | Playwright |
| HP-FLOW-005 | English to English route is built | P0 | `4. Core User Flow`, `7. Routing Model` | `IBN GVIROL 71` -> `Tel Aviv Port` | Playwright |
| HP-FLOW-006 | Mixed-language route is built | P1 | `5. Address And Place Search`, `7. Routing Model` | `אבן גבירול 71` -> `Tel Aviv Port` | Playwright |
| HP-FLOW-007 | Prefer traffic lights route is built | P0 | `6. Route Modes`, `8. Crossing Logic` | Valid From and To with route mode `Prefer traffic lights` | Vitest + Playwright |
| HP-FLOW-008 | Try harder builds a longer traffic-light route after confirmation | P0 | `9. Try Harder Flow` | `סמטת החרמון 7` -> `כפר גלעדי 32` | Playwright |
| HP-FLOW-009 | Mobile route flow works | P0 | `2. Release Scope`, `4. Core User Flow` | Mobile viewport route fixture | Playwright |

## HP-FLOW-001: App Loads With Map And Route Form

Related spec sections:

- `2. Release Scope`
- `10. Map Requirements`
- `15. Acceptance Criteria`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Data as Local GeoJSON Data
    participant Map as Map View

    User->>UI: Open Safe Path app
    UI->>Data: Load required municipality and crossing datasets
    Data-->>UI: Roads, addresses, schools, streets, traffic lights, crossings loaded
    UI->>Map: Initialize map and traffic-light markers
    Map-->>UI: Map ready
    UI-->>User: Route form and map are visible
```

Expected successful end state:

- From and To fields are visible.
- Route mode control is visible.
- `Find safe route` action is available.
- Map is visible.
- Traffic-light markers are visible when data is loaded.

## HP-FLOW-002: Hebrew Autocomplete Returns Hebrew Options

Related spec sections:

- `5. Address And Place Search`
- `15. Acceptance Criteria > Search`

Example fixture:

- User types `נמי`.
- Expected option includes Hebrew `נמיר`.

```mermaid
sequenceDiagram
    actor User
    participant UI as From or To Field
    participant Search as Search Logic
    participant Data as Local Search Datasets

    User->>UI: Type Hebrew query
    UI->>Search: Request suggestions after minimum input length
    Search->>Data: Search Hebrew address, street, school, and place records
    Data-->>Search: Hebrew matches
    Search-->>UI: Ranked Hebrew suggestions
    UI-->>User: Hebrew suggestion list is shown
```

Expected successful end state:

- Hebrew suggestions are shown for Hebrew input.
- English suggestions do not replace Hebrew results when Hebrew matches exist.
- User can select one suggestion.

## HP-FLOW-003: English Autocomplete Returns English Options

Related spec sections:

- `5. Address And Place Search`
- `15. Acceptance Criteria > Search`

Example fixture:

- User types `nami`.
- Expected option includes English `NAMIR`.

```mermaid
sequenceDiagram
    actor User
    participant UI as From or To Field
    participant Search as Search Logic
    participant Data as Local Search Datasets

    User->>UI: Type English query
    UI->>Search: Request suggestions after minimum input length
    Search->>Data: Search English address, street, school, and place records
    Data-->>Search: English matches
    Search-->>UI: Ranked English suggestions
    UI-->>User: English suggestion list is shown
```

Expected successful end state:

- English suggestions are shown for English input.
- Hebrew suggestions do not replace English results when English matches exist.
- User can select one suggestion.

## HP-FLOW-004: Hebrew To Hebrew Route Is Built

Related spec sections:

- `4. Core User Flow`
- `5. Address And Place Search`
- `7. Routing Model`
- `11. Result Panel Requirements`

Example fixture:

- From: `אבן גבירול 71`
- To: `נמל תל אביב`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Search as Search Logic
    participant Routing as Routing Logic
    participant Map as Map View
    participant Result as Result Panel

    User->>UI: Enter Hebrew From field
    UI->>Search: Find matching Hebrew start location
    Search-->>UI: From field valid full address
    User->>UI: Enter Hebrew To field
    UI->>Search: Find matching Hebrew destination
    Search-->>UI: To field valid known place
    User->>UI: Click Find safe route
    UI->>Routing: Build route from local road graph
    Routing-->>UI: Route geometry, distance, time, crossing counts
    UI->>Map: Draw route and markers
    UI->>Result: Show route result
    UI-->>User: Hebrew route result is visible
```

Expected successful end state:

- Route line is shown on the map.
- Start and destination markers are shown.
- Result panel shows distance and estimated walking time.
- Result panel shows route mode and crossing counts.

## HP-FLOW-005: English To English Route Is Built

Related spec sections:

- `4. Core User Flow`
- `5. Address And Place Search`
- `7. Routing Model`
- `11. Result Panel Requirements`

Example fixture:

- From: `IBN GVIROL 71`
- To: `Tel Aviv Port`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Search as Search Logic
    participant Routing as Routing Logic
    participant Map as Map View
    participant Result as Result Panel

    User->>UI: Enter English From field
    UI->>Search: Find matching English start location
    Search-->>UI: From field valid full address
    User->>UI: Enter English To field
    UI->>Search: Find matching English destination
    Search-->>UI: To field valid known place
    User->>UI: Click Find safe route
    UI->>Routing: Build route from local road graph
    Routing-->>UI: Route geometry, distance, time, crossing counts
    UI->>Map: Draw route and markers
    UI->>Result: Show route result
    UI-->>User: English route result is visible
```

Expected successful end state:

- English input can produce a valid route.
- Route distance is calculated from graph edges.
- Walking time is calculated from route distance.

## HP-FLOW-006: Mixed-Language Route Is Built

Related spec sections:

- `5. Address And Place Search`
- `7. Routing Model`
- `15. Acceptance Criteria > Search`

Example fixtures:

- Hebrew to English: `אבן גבירול 71` -> `Tel Aviv Port`
- English to Hebrew: `IBN GVIROL 71` -> `נמל תל אביב`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Search as Search Logic
    participant Routing as Routing Logic
    participant Map as Map View
    participant Result as Result Panel

    User->>UI: Enter From field in one language
    UI->>Search: Match From using input language
    Search-->>UI: From field valid
    User->>UI: Enter To field in another language
    UI->>Search: Match To using input language
    Search-->>UI: To field valid
    User->>UI: Click Find safe route
    UI->>Routing: Build route from matched coordinates
    Routing-->>UI: Route geometry and metrics
    UI->>Map: Draw route
    UI->>Result: Show route result
    UI-->>User: Mixed-language route result is visible
```

Expected successful end state:

- Each field respects its own input language.
- Mixed language input works when it reflects real user input.
- Route result is not blocked because the two fields use different languages.

## HP-FLOW-007: Prefer Traffic Lights Route Is Built

Related spec sections:

- `6. Route Modes`
- `8. Crossing Logic`
- `11. Result Panel Requirements`
- `15. Acceptance Criteria > Routing`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Routing as Routing Logic
    participant Crossings as Crossing Logic
    participant Map as Map View
    participant Result as Result Panel

    User->>UI: Select Prefer traffic lights
    User->>UI: Click Find safe route
    UI->>Routing: Build fastest route baseline
    Routing->>Crossings: Score candidate routes by crossing quality
    Crossings-->>Routing: Best route within reasonable added distance
    Routing-->>UI: Preferred route, distance, time, crossing counts
    UI->>Map: Draw selected route and markers
    UI->>Result: Show route mode and crossing counts
    UI-->>User: Prefer traffic lights route result is visible
```

Expected successful end state:

- Only one route mode is active.
- Prefer traffic lights uses crossing quality and distance limit.
- Result panel shows signalized and non-signalized crossing counts.
- If crossing data is used, user sees the crossing-data warning before route result details.

## HP-FLOW-008: Try Harder Builds A Longer Traffic-Light Route After Confirmation

Related spec sections:

- `8. Crossing Logic`
- `9. Try Harder Flow`
- `12. Error States`
- `15. Acceptance Criteria > Routing`

Example fixture:

- From: `סמטת החרמון 7`
- To: `כפר גלעדי 32`

```mermaid
sequenceDiagram
    actor User
    participant UI as Safe Path UI
    participant Routing as Routing Logic
    participant Dialog as Confirmation Dialog
    participant Map as Map View
    participant Result as Result Panel

    User->>UI: Build normal Prefer traffic lights route
    UI->>Routing: Calculate route within reasonable added distance
    Routing-->>UI: No better signalized-crossing route found
    UI-->>User: Show Try harder option
    User->>UI: Click Try harder
    UI->>Dialog: Show longer-route confirmation
    Dialog-->>User: This can significantly lengthen the path
    User->>Dialog: Click Do it anyway
    Dialog->>Routing: Recalculate with extended distance limit
    Routing-->>UI: Best available longer route
    UI->>Map: Draw updated route
    UI->>Result: Show updated route result and warnings if needed
    UI-->>User: Longer route result is visible
```

Expected successful end state:

- `Try harder` requires confirmation.
- Extended route does not exceed the defined maximum distance limit.
- If the route still includes crossings without traffic lights, the UI clearly warns the user.

## HP-FLOW-009: Mobile Route Flow Works

Related spec sections:

- `2. Release Scope`
- `4. Core User Flow`
- `10. Map Requirements`
- `15. Acceptance Criteria > UI`

```mermaid
sequenceDiagram
    actor User
    participant Mobile as Mobile UI
    participant Search as Search Logic
    participant Routing as Routing Logic
    participant Map as Mobile Map
    participant Result as Result Panel

    User->>Mobile: Open app on mobile viewport
    Mobile-->>User: Route form is usable
    User->>Mobile: Enter From and To fields
    Mobile->>Search: Validate selected or typed locations
    Search-->>Mobile: Both fields valid
    User->>Mobile: Click Find safe route
    Mobile->>Routing: Build route from local road graph
    Routing-->>Mobile: Route geometry and metrics
    Mobile->>Map: Draw mobile route view
    Mobile->>Result: Show route result
    Mobile-->>User: Mobile route result is visible without broken layout
```

Expected successful end state:

- Form controls are usable on mobile width.
- Route is calculated and drawn.
- Result content is visible without overlap.
- Map and result remain readable on mobile viewport.
