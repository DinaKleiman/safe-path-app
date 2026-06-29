import { expect, test } from "@playwright/test";
import {
  calculateRoute,
  expectOption,
  fillFrom,
  prepareApp,
} from "./helpers";

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
    await calculateRoute(page, "משה שרת 80", "Tel Aviv Port", "fastest");

    await expect(page.getByText(/Distance:\s+\d+\.\d{2} km/)).toBeVisible();
    await expect(page.getByText(/Estimated walking time:\s+\d+ min/)).toBeVisible();
    await expect(page.getByText("Route: shown")).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });
});
