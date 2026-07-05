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
  await expect(page.locator(".leaflet-container")).toBeVisible();
}

export function fromInput(page) {
  return page.getByPlaceholder("Choose starting point");
}

export function toInput(page) {
  return page.getByPlaceholder("Choose destination");
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
  if ((await fromInput(page).count()) === 0) {
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(fromInput(page)).toBeVisible();
  }

  await fillFrom(page, from);
  await fillTo(page, to);
  await closeAutocomplete(page);
  await page.getByRole("radio", { name: mode === "fastest" ? "Fastest Shortest walking time" : "Prefer traffic lights Accept a longer route for more signalized crossings" }).check();
  await clickFindRoute(page);
}

export async function routeMetric(page, label) {
  const text = await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Route result" }) })
    .innerText();
  const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`));
  return match?.[1]?.trim() ?? "";
}
