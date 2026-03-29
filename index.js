require("dotenv").config();

const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Toronto used as the default map origin and fallback search center.
const TORONTO_CENTER = {
  lat: 43.6532,
  lon: -79.3832,
};

// Major coffee chains listed here to optionally filter them out.
const CHAIN_KEYWORDS = [
  "starbucks",
  "tim hortons",
  "second cup",
  "mcdonald",
  "coffee time",
  "country style",
];

// Converts text to lowercase for keyword matching.
function normalizeText(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Flags a place as a likely coffee chain if either its name or brand matches known chain keywords.
function isLikelyChain(name = "", brand = "") {
  const haystack = `${normalizeText(name)} ${normalizeText(brand)}`;
  return CHAIN_KEYWORDS.some((keyword) => haystack.includes(normalizeText(keyword)));
}

// Maps Geoapify to a compact, UI-friendly cafe object.
function toCafe(feature) {
  // Geoapify can put fields in properties and/or geometry depending on endpoint.
  const p = feature.properties || {};
  const lat = typeof p.lat === "number" ? p.lat : feature.geometry?.coordinates?.[1] || null;
  const lon = typeof p.lon === "number" ? p.lon : feature.geometry?.coordinates?.[0] || null;
  const name = p.name || "Unnamed Cafe";
  const brand = p.brand || "";

  // Build one normalized object so frontend code can stay simple and predictable.
  return {
    id: p.place_id || p.datasource?.raw?.place_id || `${name}-${lat}-${lon}`,
    name,
    address: p.formatted || p.address_line2 || "Address unavailable",
    lat,
    lon,
    website: p.website || null,
    phone: p.phone || null,
    openingHours: p.opening_hours || null,
    neighbourhood: p.suburb || p.city_district || p.district || null,
    city: p.city || "Toronto",
    postcode: p.postcode || null,
    isChain: isLikelyChain(name, brand),
    brand: brand || null,
  };
}

// Geocodes user text (e.g., neighborhood) into one best coordinate in Toronto.
async function geocodeTorontoArea(query) {
  // Build geocoding URL with Toronto bias to reduce out-of-city mismatches.
  const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  geocodeUrl.searchParams.set("text", `${query}, Toronto, Ontario`);
  geocodeUrl.searchParams.set("filter", "countrycode:ca");
  geocodeUrl.searchParams.set("bias", `proximity:${TORONTO_CENTER.lon},${TORONTO_CENTER.lat}`);
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  // Call geocoder and error with a readable server-side message.
  const response = await fetch(geocodeUrl);
  if (!response.ok) {
    throw new Error(`Geoapify geocode request failed (${response.status})`);
  }

  // Pull out only the top result.
  const payload = await response.json();
  const topResult = payload.features?.[0]?.properties;
  if (!topResult) {
    return null;
  }

  return {
    label: topResult.formatted || query,
    lat: topResult.lat,
    lon: topResult.lon,
  };
}

// Serve static assets (HTML, CSS, JS) from /public.
app.use(express.static("public"));

// Main route for home page.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Public runtime config route consumed by frontend logic.
app.get("/api/config", (req, res) => {
  res.json({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    torontoCenter: TORONTO_CENTER,
  });
});

// Cafe search route.
// Supports user input of coordinates or a text query that will be geocoded first.
app.get("/api/cafes", async (req, res) => {
  // API keys are required for upstream Geoapify requests.
  if (!GEOAPIFY_API_KEY) {
    return res.status(500).json({ error: "Missing GEOAPIFY_API_KEY in environment." });
  }

  // Parse and sanitize query parameters with safe defaults.
  const includeChains = String(req.query.includeChains || "false") === "true";
  const query = (req.query.query || "").toString().trim();
  let lat = Number.parseFloat(req.query.lat);
  let lon = Number.parseFloat(req.query.lon);

  const radius = Number.parseInt(req.query.radius, 10);
  const limit = Number.parseInt(req.query.limit, 10);
  const safeRadius = Number.isFinite(radius) ? Math.max(500, Math.min(radius, 25000)) : 3000;
  const safeLimit = Number.isFinite(limit) ? Math.max(10, Math.min(limit, 100)) : 60;

  try {
    // If no coordinates were provided, geocoding the user test query.
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && query) {
      const area = await geocodeTorontoArea(query);
      if (area) {
        lat = area.lat;
        lon = area.lon;
      }
    }

    // Default to Toronto (GTA) if coordinates or geocoded result aren't available.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      lat = TORONTO_CENTER.lat;
      lon = TORONTO_CENTER.lon;
    }

    // Build places request targeting cafes around the selected center point.
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", "catering.cafe");
    placesUrl.searchParams.set("filter", `circle:${lon},${lat},${safeRadius}`);
    placesUrl.searchParams.set("bias", `proximity:${lon},${lat}`);
    placesUrl.searchParams.set("limit", String(safeLimit));
    placesUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);

    // Fetch cafes from Geoapify.
    const response = await fetch(placesUrl);
    if (!response.ok) {
      throw new Error(`Geoapify places request failed (${response.status})`);
    }

    // Apply optional chain filtering.
    const payload = await response.json();
    let cafes = (payload.features || []).map(toCafe);
    if (!includeChains) {
      cafes = cafes.filter((cafe) => !cafe.isChain);
    }

    // Return json that includes final search.
    return res.json({
      center: { lat, lon },
      radius: safeRadius,
      total: cafes.length,
      cafes,
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

// Detail route for one cafe place id.
app.get("/api/cafes/:id", async (req, res) => {
  // Key check before API call.
  if (!GEOAPIFY_API_KEY) {
    return res.status(500).json({ error: "Missing GEOAPIFY_API_KEY in environment." });
  }

  // Geoapify place details lookup by id.
  const { id } = req.params;
  const detailsUrl = new URL("https://api.geoapify.com/v2/place-details");
  detailsUrl.searchParams.set("id", id);
  detailsUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  try {
    // Request detail record and validate response.
    const response = await fetch(detailsUrl);
    if (!response.ok) {
      throw new Error(`Geoapify place details request failed (${response.status})`);
    }

    // Return first feature (if present) in normalized cafe shape.
    const payload = await response.json();
    const feature = payload.features?.[0];
    if (!feature) {
      return res.status(404).json({ error: "Cafe details not found." });
    }

    return res.json(toCafe(feature));
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

// Start Express server.
app.listen(PORT, () => {
  console.log(`Cafe Compass server running at http://localhost:${PORT}`);
});