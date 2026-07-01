import { expect } from "@playwright/test";

export async function prepareApp(page, { geocoderResults = [] } = {}) {
  await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(geocoderResults),
    });
  });

  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    await route.abort();
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Safe Path" })).toBeVisible();
  await expect(page.getByText("Traffic lights: 495")).toBeVisible();
}

export function fromInput(page) {
  return page.getByPlaceholder("Example: Dizengoff Center");
}

export function toInput(page) {
  return page.getByPlaceholder("Example: Tel Aviv Port");
}

export async function fillFrom(page, value) {
  await fromInput(page).fill(value);
}

export async function fillTo(page, value) {
  await toInput(page).fill(value);
}

export async function closeAutocomplete(page) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
}

export function optionByText(page, text) {
  return page.getByRole("option").filter({ hasText: text });
}

export async function expectOption(page, text) {
  await expect(optionByText(page, text).first()).toBeVisible();
}

export async function clickFindRoute(page) {
  await page.getByRole("button", { name: "Find safe route" }).click();
}

export async function calculateRoute(page, from, to, mode = "fastest") {
  await fillFrom(page, from);
  await fillTo(page, to);
  await closeAutocomplete(page);
  await page.getByRole("radio", { name: mode === "fastest" ? "Fastest Shortest walking time" : "Prefer traffic lights Accept a longer route for more signalized crossings" }).check();
  await clickFindRoute(page);
  await expect(page.getByText("This route partly uses open-source pedestrian crossing data and may contain mismatches.")).toBeVisible();
}

export async function routeMetric(page, label) {
  const text = await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Route result" }) })
    .innerText();
  const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`));
  return match?.[1]?.trim() ?? "";
}
