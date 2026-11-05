import { expect, test } from "@playwright/test";

// OSM Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
// Unlike the other specs, these tests let tile requests through to a stub
// (instead of aborting them) so the real browser request can be inspected.

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function openAppWithTileSpy(page, { documentReferrerPolicy } = {}) {
  const tileRequests = [];

  // Reproduce the production CDN (Cloudflare) adding a site-wide
  // Referrer-Policy header to the HTML document.
  if (documentReferrerPolicy) {
    await page.route(
      (url) => url.pathname === "/",
      async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), "referrer-policy": documentReferrerPolicy },
        });
      },
    );
  }

  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );

  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    const request = route.request();
    tileRequests.push({ url: request.url(), headers: request.headers() });
    await route.fulfill({ contentType: "image/png", body: ONE_PIXEL_PNG });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Safe Path" })).toBeVisible();
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);

  return tileRequests;
}

test.describe("OSM tile usage policy", () => {
  test("tiles use the exact required HTTPS URL, no subdomains", async ({ page }) => {
    const tileRequests = await openAppWithTileSpy(page);

    for (const { url } of tileRequests) {
      expect(url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    }
  });

  test("tile requests carry a Referer identifying the site", async ({ page, baseURL }) => {
    const tileRequests = await openAppWithTileSpy(page);

    for (const { headers } of tileRequests) {
      expect(headers.referer).toBeTruthy();
      expect(headers.referer.startsWith(new URL(baseURL).origin)).toBe(true);
    }
  });

  test("tile requests keep the Referer when the site sends Referrer-Policy: same-origin", async ({
    page,
    baseURL,
  }) => {
    // Production (batuah.org via Cloudflare) sends this header; without a
    // per-tile override OSM receives no Referer and serves "403 Access blocked".
    const tileRequests = await openAppWithTileSpy(page, { documentReferrerPolicy: "same-origin" });

    for (const { headers } of tileRequests) {
      expect(headers.referer).toBeTruthy();
      expect(headers.referer.startsWith(new URL(baseURL).origin)).toBe(true);
    }
  });

  test("tile requests do not bypass the browser cache",async ({ page }) => {
    const tileRequests = await openAppWithTileSpy(page);

    for (const { headers } of tileRequests) {
      expect(headers["cache-control"] ?? "").not.toContain("no-cache");
      expect(headers.pragma ?? "").not.toContain("no-cache");
    }
  });

  test("tile images do not use a restrictive referrer policy", async ({ page }) => {
    await openAppWithTileSpy(page);

    const policies = await page
      .locator("img.leaflet-tile")
      .evaluateAll((images) => images.map((image) => image.referrerPolicy));

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(["no-referrer", "same-origin"]).not.toContain(policy);
    }
  });

  test("document referrer policy lets the Referer header reach OSM", async ({ page }) => {
    await openAppWithTileSpy(page);

    const policy = await page.evaluate(() => document.referrerPolicy);
    expect(["no-referrer", "same-origin"]).not.toContain(policy);
  });

  test("OpenStreetMap attribution and map-issue link are visible", async ({ page }) => {
    await openAppWithTileSpy(page);

    const attribution = page.locator(".leaflet-control-attribution");
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText("© OpenStreetMap contributors");
    await expect(attribution.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    await expect(attribution.getByRole("link", { name: "Report a map issue" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/fixthemap",
    );
  });

  test("zoom is capped at the highest level OSM serves", async ({ page }) => {
    const tileRequests = await openAppWithTileSpy(page);

    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    for (let i = 0; i < 8; i += 1) {
      if (await zoomIn.evaluate((button) => button.classList.contains("leaflet-disabled"))) break;
      await zoomIn.click();
    }

    await expect(zoomIn).toHaveClass(/leaflet-disabled/);
    const zoomLevels = tileRequests.map(({ url }) => Number(url.split("/")[3]));
    expect(Math.max(...zoomLevels)).toBeLessThanOrEqual(19);
  });
});

// Opt-in: checks what the deployed site (e.g. Cloudflare) actually sends.
// Run with: OSM_LIVE_URL=https://www.batuah.org npx playwright test osm-tile-policy
test.describe("deployed site headers", () => {
  test.skip(!process.env.OSM_LIVE_URL, "set OSM_LIVE_URL to check the deployed site");

  // Cloudflare sends `Referrer-Policy: same-origin`; the per-tile referrerPolicy
  // must override it so OSM still receives a Referer on every tile request.
  test("tile requests on the deployed site carry a Referer", async ({ page }) => {
    const liveOrigin = new URL(process.env.OSM_LIVE_URL).origin;
    const tileRequests = [];
    page.on("request", (request) => {
      // Also match legacy a/b/c subdomains so an old deploy fails on the Referer, not the count.
      if (/^https?:\/\/([a-c]\.)?tile\.openstreetmap\.org\//.test(request.url())) tileRequests.push(request);
    });

    await page.goto(process.env.OSM_LIVE_URL);
    await expect.poll(() => tileRequests.length).toBeGreaterThan(0);

    for (const request of tileRequests) {
      const referer = await request.headerValue("referer");
      expect(referer, request.url()).toBeTruthy();
      expect(referer.startsWith(liveOrigin)).toBe(true);
    }
  });
});
