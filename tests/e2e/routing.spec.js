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
    await expect(page.getByText("Route: shown")).toBeVisible();
  });

  test("prefer traffic lights route has more traffic lights than fastest for known A/B", async ({ page }) => {
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");
    const fastestLights = Number(await routeMetric(page, "Traffic lights on route"));

    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "safest");
    const saferLights = Number(await routeMetric(page, "Traffic lights on route"));

    expect(saferLights).toBeGreaterThan(fastestLights);
    await expect(page.getByText("Route mode: Prefer traffic lights")).toBeVisible();
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

    await expect(page.getByText("No traffic-light crossings were found on this route.")).toBeVisible();
    await page.getByRole("button", { name: "Try harder" }).click();

    await expect(page.getByText("Route mode: Try harder")).toBeVisible();
    const tryHarderLights = Number(await routeMetric(page, "Traffic lights on route"));
    expect(tryHarderLights).toBeGreaterThan(0);
  });
});

test.describe("map rendering", () => {
  test("map, traffic-light icons, route, and route markers render", async ({ page }) => {
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".traffic-light-marker").first()).toBeVisible();
    await expect(page.locator(".leaflet-overlay-pane svg path").first()).toBeVisible();
    await expect(page.getByText("Traffic lights: 495")).toBeVisible();
    await expect(page.getByText(/Route traffic lights:\s+\d+/)).toBeVisible();
  });
});
