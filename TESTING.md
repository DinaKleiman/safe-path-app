# Safe Path Testing Guide

This document explains how Safe Path tests are organized, how to run them, and how release quality is decided.

## Test Documents

| File | Purpose |
| --- | --- |
| `tests/spec-to-test-traceability.md` | Maps product requirements from `docs/spec.md` to test coverage. This file should not track latest pass/fail run status. |
| `tests/playwright-ui-test-cases.md` | Browser and UI test case descriptions. |
| `tests/vitest-logic-test-cases.md` | Logic test case descriptions for routing/search/data behavior. |
| `tests/e2e/*.spec.js` | Automated Playwright tests. |
| `src/utils/*.test.js` | Automated Vitest logic/data tests. |
| `tests/releases/release_ver_#.md` | Per-release execution report, known issues, fixes, and release decision. |

## Test Types

| Type | Tool | Purpose |
| --- | --- | --- |
| Unit | Vitest | Verify isolated utility behavior. |
| Integration | Vitest | Verify routing/search logic with real municipality GeoJSON files. |
| E2E | Playwright | Verify real user flows in a browser. |
| Mobile E2E | Playwright | Verify the app in a mobile viewport. |
| Visual/UX | Playwright or manual review | Verify layout, marker visibility, overlap, and readability. |
| Static | Shell/CI checks | Verify repository rules, secrets, dependency state, and data tracking. |
| Benchmark | Playwright + Google Maps | Compare app route distance with Google Maps walking distance for selected cases. |

## Commands

Install dependencies:

```bash
npm install
```

Run logic tests:

```bash
npm test -- --run
```

Run all Playwright app tests:

```bash
npm run test:e2e
```

Run Playwright tests against an already running local app:

```bash
npm run test:e2e:local
```

Open Playwright UI mode:

```bash
npm run test:e2e:ui
```

Run Google Maps benchmark:

```bash
npm run test:benchmark:google
```

Build production app:

```bash
npm run build
```

Run lint:

```bash
npm run lint
```

## Release Gates

Release gate means the minimum quality rule for deciding whether a version can be released.

### P0 Gate

Release is blocked if any P0 requirement has one of these states:

- not covered
- not fully covered
- covered but failing in the latest release run

P0 examples:

- valid user can build a route
- `Fastest` and `Prefer traffic lights` modes work
- route result is not stale or wrong
- address/search core flow works
- street-only input asks for building number
- route safety/crossing counts are not misleading
- app build fails
- core Vitest or Playwright tests fail

### P1 Gate

Release can continue only if the risk is explicitly documented in the release file.

P1 examples:

- yellow marker visual/z-order coverage is not complete
- mobile layout has basic tests but no screenshot-level overlap test
- Google Maps benchmark has known distance differences
- data coverage is good enough for release but not complete for all place types

### P2 Gate

P2 does not block release but must remain tracked.

P2 examples:

- additional typo examples
- more route examples
- broader browser/device matrix
- extra visual polish

## Release Report

Each release should have a file under:

```text
tests/releases/release_ver_#.md
```

Recommended structure:

```markdown
# Release ver #

## Summary

- Date:
- Branch:
- Commit:
- Environment:
- Release decision:

## Changes Tested

- ...

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `npm test -- --run` |  |  |
| `npm run test:e2e` |  |  |
| `npm run build` |  |  |
| `npm run lint` |  |  |
| `npm run test:benchmark:google` |  |  |

## Fixed Issues

- ...

## Known Issues

- ...

## Accepted Risks

- ...

## Blockers

- ...
```

## Traceability Rules

`tests/spec-to-test-traceability.md` should answer:

- Which requirement is being tested?
- What priority does it have?
- What type of requirement is it?
- Which spec section defines it?
- Which example or fixture proves it?
- What test level covers it?
- What automation type covers it?
- Is it covered, not fully covered, not covered, or out of scope?
- If not fully covered, what exact action is needed?

It should not answer:

- Did the test pass today?
- Which release run failed?
- Who approved a release?

Those belong in `tests/releases/release_ver_#.md`.

## Language Coverage Rule

Safe Path supports Hebrew and English input. Test examples should cover:

- Hebrew start and Hebrew destination
- English start and English destination
- Hebrew start and English known place, when this reflects a real user flow
- English start and Hebrew known place, when this reflects a real user flow

Do not use English destinations by default only because they are convenient. If a known place has a Hebrew name available in the app data, include the Hebrew version in coverage.

Examples:

| Coverage | Example |
| --- | --- |
| Hebrew street to Hebrew/known place | `אבן גבירול 71 -> נמל תל אביב` |
| Hebrew street to Hebrew place | `בן יהודה 100 -> דיזנגוף סנטר` |
| English street to English place | `IBN GVIROL 71 -> Tel Aviv Port` |
| School alias | `בה״ס גרץ -> נמל תל אביב` |

## Google Maps Benchmark Notes

The Google Maps benchmark is intentionally separate from the normal Playwright app suite.

Reason:

- it depends on Google Maps UI text
- Google can change route choices or page structure
- it requires network access
- it is useful as an external comparison, not as Safe Path source of truth

Benchmark interpretation:

- app `Prefer traffic lights` distance is compared with Google Maps walking distance
- if app distance is longer than Google, the difference is negative and the case fails the benchmark
- benchmark failures should be reviewed as possible product/routing quality issues

## Release-Ready Definition

A release is product-ready only when:

- all P0 requirements in traceability are covered
- all P0 tests pass in the release report
- P1 gaps are fixed or explicitly documented as accepted risks
- build passes
- lint passes
- latest release report lists known issues clearly
- no critical/high QA issue remains unresolved
