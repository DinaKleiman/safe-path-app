import { expect, test } from "@playwright/test";
import {
  calculateRoute,
  expectOption,
  fillFrom,
  prepareApp,
} from "./helpers";

const MOBILE_ROUTE = {
  from: "אבן גבירול 71",
  to: "נמל תל אביב",
};

test.beforeEach(async ({ page }) => {
  await prepareApp(page);
});

test.describe("mobile experience", () => {
  test("mobile app loads without horizontal overflow", async ({ page }) => {
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    expect(hasOverflow).toBe(false);
    await expect(page.getByRole("heading", { name: "Plan a safe route" })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("mobile autocomplete remains usable", async ({ page }) => {
    await fillFrom(page, "נמי");
    await expectOption(page, "נמיר מרדכי");

    await fillFrom(page, "nami");
    await expectOption(page, "NAMIR");
  });

  test("mobile route calculation keeps result and map readable", async ({ page }) => {
    await calculateRoute(page, MOBILE_ROUTE.from, MOBILE_ROUTE.to, "fastest");

    await expect(page.getByText(/Distance:\s+\d+\.\d{2} km/)).toBeVisible();
    await expect(page.getByText(/Estimated walking time:\s+\d+ min/)).toBeVisible();
    await expect(page.locator(".leaflet-overlay-pane svg path").first()).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });
});
