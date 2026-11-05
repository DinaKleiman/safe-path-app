// OpenStreetMap tile usage policy: https://operations.osmfoundation.org/policies/tiles/
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// The policy forbids a Referrer-Policy that stops the Referer header being
// sent to tile.openstreetmap.org. Set it explicitly per tile so the site-wide
// header (e.g. from the CDN) cannot strip it.
export const OSM_TILE_REFERRER_POLICY = "strict-origin-when-cross-origin";

// OSM standard tiles are served up to zoom 19.
export const OSM_TILE_MAX_ZOOM = 19;

// Visible licence attribution is required, plus the recommended map-issue link.
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' +
  ' &middot; <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Report a map issue</a>';
