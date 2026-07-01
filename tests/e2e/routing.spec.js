import { expect, test } from "@playwright/test";
import {
  calculateRoute,
  clickFindRoute,
  closeAutocomplete,
  fillFrom,
  fillTo,
  prepareApp,
  routeMetric,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await prepareApp(page);
});

test.describe("desktop route UI", () => {
  test("header does not show developer test copy", async ({ page }) => {
    await expect(page.getByText(/Test: enter A and B/)).toHaveCount(0);
  });

  test("route modes are single-select and Balanced is removed", async ({ page }) => {
    await expect(page.getByText("Balanced")).toHaveCount(0);

    const fastest = page.getByRole("radio", { name: "Fastest Shortest walking time" });
    const safer = page.getByRole("radio", {
      name: "Prefer traffic lights Accept a longer route for more signalized crossings",
    });

    await fastest.check();
    await expect(fastest).toBeChecked();
    await expect(safer).not.toBeChecked();

    await safer.check();
    await expect(safer).toBeChecked();
    await expect(fastest).not.toBeChecked();
  });

  test("fastest route calculates and displays required values", async ({ page }) => {
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");

    await expect(page.getByText(/Distance:\s+\d+\.\d{2} km/)).toBeVisible();
    await expect(page.getByText(/Estimated walking time:\s+\d+ min/)).toBeVisible();
    await expect(page.getByText("Route mode: Fastest")).toBeVisible();
    await expect(page.getByText(/Traffic lights on route:\s+\d+/)).toBeVisible();
    await expect(page.getByText(/Crossings without confirmed traffic lights:\s+\d+/)).toBeVisible();
    await expect(page.getByText(/Signalized pedestrian crossings:\s+\d+/)).toBeVisible();
    await expect(page.getByText(/Non-signalized pedestrian crossings:\s+\d+/)).toBeVisible();
    await expect(page.getByText("This route partly uses open-source pedestrian crossing data and may contain mismatches.")).toBeVisible();
    await expect(page.getByText("Route: shown")).toBeVisible();
  });

  test("prefer traffic lights route has more traffic lights than fastest for known A/B", async ({ page }) => {
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");
    const fastestLights = Number(await routeMetric(page, "Traffic lights on route"));
    const fastestSignalizedCrossings = Number(
      await routeMetric(page, "Signalized pedestrian crossings"),
    );
    const fastestUnsignalizedCrossings = Number(
      await routeMetric(page, "Non-signalized pedestrian crossings"),
    );

    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "safest");
    const saferLights = Number(await routeMetric(page, "Traffic lights on route"));
    const saferSignalizedCrossings = Number(
      await routeMetric(page, "Signalized pedestrian crossings"),
    );
    const saferUnsignalizedCrossings = Number(
      await routeMetric(page, "Non-signalized pedestrian crossings"),
    );

    expect(saferLights).toBeGreaterThan(fastestLights);
    expect(saferSignalizedCrossings).toBeGreaterThanOrEqual(
      fastestSignalizedCrossings,
    );
    expect(saferUnsignalizedCrossings).toBeLessThan(
      fastestUnsignalizedCrossings,
    );
    await expect(page.getByText("Route mode: Prefer traffic lights")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try harder" })).toHaveCount(0);
  });

  test("missing address validation is visible", async ({ page }) => {
    await fillFrom(page, "");
    await fillTo(page, "Tel Aviv Port");
    await closeAutocomplete(page);
    await clickFindRoute(page);
    await expect(page.getByText("Please enter both From and To.")).toBeVisible();

    await fillFrom(page, "משה שרת 80");
    await fillTo(page, "");
    await closeAutocomplete(page);
    await clickFindRoute(page);
    await expect(page.getByText("Please enter both From and To.")).toBeVisible();
  });

  test("Try harder recalculates a route through traffic lights when available", async ({ page }) => {
    await calculateRoute(page, "שרת משה 84", "בלקינד 1", "safest");

    await expect(page.getByText("No better traffic-light crossing route was found within adding reasonable distance.")).toBeVisible();
    await page.getByRole("button", { name: "Try harder" }).click();
    await expect(page.getByText("This can significantly lengthen the path.")).toBeVisible();
    await page.getByRole("button", { name: "Do it anyway" }).click();

    await expect(page.getByText("Route mode: Try harder")).toBeVisible();
    const tryHarderSignalizedCrossings = Number(
      await routeMetric(page, "Signalized pedestrian crossings"),
    );
    expect(tryHarderSignalizedCrossings).toBeGreaterThan(0);
  });
});

test.describe("map rendering", () => {
  test("map, traffic-light icons, route, and route markers render", async ({ page }) => {
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".traffic-light-marker").first()).toBeVisible();
    await expect(page.locator(".route-traffic-light-marker").first()).toBeVisible();
    await expect(page.locator(".leaflet-overlay-pane svg path").first()).toBeVisible();
    await expect(page.getByText("Traffic lights: 495")).toBeVisible();
    await expect(page.getByText(/Route traffic lights:\s+\d+/)).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toHaveCount(0);
  });
});
