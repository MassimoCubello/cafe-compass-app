require("dotenv").config();

const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const TORONTO_CENTER = {
  lat: 43.6532,
  lon: -79.3832,
};

const CHAIN_KEYWORDS = [
  "starbucks",
  "tim hortons",
  "second cup",
  "mcdonald",
  "coffee time",
  "country style",
];

// Function to load the Google Maps script.
function normalizeText(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Function to flag if a cafe is part of a chain based on its name and brand.
function isLikelyChain(name = "", brand = "") {
  const haystack = `${normalizeText(name)} ${normalizeText(brand)}`;
  return CHAIN_KEYWORDS.some((keyword) => haystack.includes(normalizeText(keyword)));
}

// Function to map Geoapify feature to our Cafe model, with fallbacks for missing data.
function toCafe(feature) {
  const properties = feature.properties || {};
  const lat = typeof properties.lat === "number" ? properties.lat : feature.geometry?.coordinates?.[1] || null;
  const lon = typeof properties.lon === "number" ? properties.lon : feature.geometry?.coordinates?.[0] || null;
  const name = properties.name || "Unnamed Cafe";
  const brand = properties.brand || "";

  // Returns a cafe object.
  return {
    id: properties.place_id || properties.datasource?.raw?.place_id || `${name}-${lat}-${lon}`,
    name,
    address: properties.formatted || properties.address_line2 || "Address unavailable",
    lat,
    lon,
    website: properties.website || null,
    phone: properties.phone || null,
    openingHours: properties.opening_hours || null,
    neighbourhood: properties.suburb || properties.city_district || properties.district || null,
    city: properties.city || "Toronto",
    postcode: properties.postcode || null,
    isChain: isLikelyChain(name, brand),
    brand: brand || null,
  };
}

// Function to geocode a text query within Toronto using Geoapify's geocoding API.
async function geocodeTorontoArea(query) {
  const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  geocodeUrl.searchParams.set("text", `${query}, Toronto, Ontario`);
  geocodeUrl.searchParams.set("filter", "countrycode:ca");
  geocodeUrl.searchParams.set("bias", `proximity:${TORONTO_CENTER.lon},${TORONTO_CENTER.lat}`);
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);
  // Error handling
  const response = await fetch(geocodeUrl);
  if (!response.ok) {
    throw new Error(`Geoapify geocode request failed (${response.status})`);
  }

  // Function to use the top match as the search center.
  const payload = await response.json();
  const topResult = payload.features?.[0]?.properties;
  if (!topResult) {
    return null;
  }
  // Returns the location.
  return {
    label: topResult.formatted || query,
    lat: topResult.lat,
    lon: topResult.lon,
  };
}

// Serves frontend assets from public folder
app.use(express.static("public"));

// Configure Pug as the server-side view engine.
app.set("view engine", "pug");
app.set("views", `${__dirname}/views`);

// Serves the main app page.
app.get("/", (req, res) => {
  res.render("index");
});

// Serves a simple details page for a single cafe.
app.get("/cafe/:id", (req, res) => {
  res.render("details", { cafeId: req.params.id });
});

// Provides the Google Maps API key and default center to the frontend.
app.get("/api/config", (req, res) => {
  res.json({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    torontoCenter: TORONTO_CENTER,
  });
});

// This endpoint accepts search parameters, calls Geoapify Places API, and returns cafes.
app.get("/api/cafes", async (req, res) => {
  if (!GEOAPIFY_API_KEY) {
    return res.status(500).json({ error: "Missing GEOAPIFY_API_KEY in environment." });
  }

  // Include Chains filter
  const includeChains = String(req.query.includeChains || "false") === "true";
  const query = (req.query.query || "").toString().trim();
  let lat = Number.parseFloat(req.query.lat);
  let lon = Number.parseFloat(req.query.lon);
  // Validates radius and max number of cafes returned.
  const radius = Number.parseInt(req.query.radius, 10);
  const limit = Number.parseInt(req.query.limit, 10);
  const safeRadius = Number.isFinite(radius) ? Math.max(500, Math.min(radius, 25000)) : 3000;
  const safeLimit = Number.isFinite(limit) ? Math.max(10, Math.min(limit, 100)) : 60;
  

  try {
    // if statement to geocode the query if lat/lon are not provided or invalid, and a query is present.
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && query) {
      const area = await geocodeTorontoArea(query);
      if (area) {
        lat = area.lat;
        lon = area.lon;
      }
    }

    // Falls back to Toronto center if still invalid.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      lat = TORONTO_CENTER.lat;
      lon = TORONTO_CENTER.lon;
    }

    // Calls Geoapify Places for cafes around the search center.
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", "catering.cafe"); // Restrict to cafes category
    placesUrl.searchParams.set("filter", `circle:${lon},${lat},${safeRadius}`); // Search within a circle defined by center and radius
    placesUrl.searchParams.set("bias", `proximity:${lon},${lat}`); // Bias results towards the search center (Toronto)
    placesUrl.searchParams.set("limit", String(safeLimit)); // Limit the number of results returned
    placesUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY); // API key
    
    // This function fetches the places data and checks for errors
    const response = await fetch(placesUrl);
    if (!response.ok) {
      throw new Error(`Geoapify places request failed (${response.status})`);
    }

    // Excludes chain shops.
    const payload = await response.json();
    let cafes = (payload.features || []).map(toCafe);
    if (!includeChains) {
      cafes = cafes.filter((cafe) => !cafe.isChain);
    }

    // Returns cafes plus final center/radius used.
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

// Returns one cafe by Geoapify place id.
app.get("/api/cafes/:id", async (req, res) => {
  if (!GEOAPIFY_API_KEY) {
    return res.status(500).json({ error: "Missing GEOAPIFY_API_KEY in environment." });
  }

  const detailsUrl = new URL("https://api.geoapify.com/v2/place-details");
  detailsUrl.searchParams.set("id", req.params.id);
  detailsUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  try {
    const response = await fetch(detailsUrl);
    if (!response.ok) {
      throw new Error(`Geoapify place details request failed (${response.status})`);
    }

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

app.listen(PORT, () => {
  console.log(`Cafe Compass server running at http://localhost:${PORT}`);
});