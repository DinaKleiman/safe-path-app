import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OSM_ATTRIBUTION,
  OSM_TILE_MAX_ZOOM,
  OSM_TILE_REFERRER_POLICY,
  OSM_TILE_URL,
} from "./osmTiles";

// Policy: https://operations.osmfoundation.org/policies/tiles/
describe("OSM tile usage policy configuration", () => {
  it("uses exactly the required HTTPS tile URL", () => {
    expect(OSM_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });

  it("does not use a/b/c subdomains or plain HTTP", () => {
    expect(OSM_TILE_URL).not.toContain("{s}");
    expect(OSM_TILE_URL.startsWith("http://")).toBe(false);
  });

  it("uses a referrer policy that still sends the Referer header", () => {
    const restrictive = ["no-referrer", "same-origin", "origin-when-cross-origin-none"];
    expect(restrictive).not.toContain(OSM_TILE_REFERRER_POLICY);
    expect(["strict-origin-when-cross-origin", "origin", "strict-origin", "origin-when-cross-origin"]).toContain(
      OSM_TILE_REFERRER_POLICY,
    );
  });

  it("shows OpenStreetMap licence attribution and a map-issue link", () => {
    expect(OSM_ATTRIBUTION).toContain("OpenStreetMap");
    expect(OSM_ATTRIBUTION).toContain("contributors");
    expect(OSM_ATTRIBUTION).toContain("https://www.openstreetmap.org/copyright");
    expect(OSM_ATTRIBUTION).toContain("https://www.openstreetmap.org/fixthemap");
  });

  it("caps zoom at the highest level OSM serves", () => {
    expect(OSM_TILE_MAX_ZOOM).toBe(19);
  });

  it("index.html does not set a restrictive referrer policy", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const meta = html.match(/<meta\s+name="referrer"\s+content="([^"]+)"/);
    expect(meta?.[1]).toBe("strict-origin-when-cross-origin");
  });

  it("map code does not disable attribution or prefetch tiles", () => {
    const source = readFileSync(new URL("../components/MapView.jsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/attributionControl=\{false\}/);
    expect(source).not.toMatch(/\{s\}\.tile\.openstreetmap\.org/);
    expect(source).not.toMatch(/keepBuffer|serviceWorker|caches\.open/);
  });
});
