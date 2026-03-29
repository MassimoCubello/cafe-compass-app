// Cache details-page DOM nodes so rendering functions can update fields quickly.
const nameElement = document.getElementById("cafe-name");
const addressElement = document.getElementById("cafe-address");
const neighborhoodElement = document.getElementById("cafe-neighborhood");
const coordsElement = document.getElementById("cafe-coords");
const phoneElement = document.getElementById("cafe-phone");
const websiteElement = document.getElementById("cafe-website");
const hoursElement = document.getElementById("cafe-hours");
const statusElement = document.getElementById("details-status");

// Mini-map state objects reused between renders.
let miniMap;
let marker;

// Status for loading and error text.
function setStatus(text) {
  statusElement.textContent = text;
}

// Reads one cafe from session cache populated by the home page search.
function getCachedCafe(id) {
  try {
    const cache = JSON.parse(sessionStorage.getItem("cafeCache") || "{}");
    return cache[id] || null;
  } catch {
    return null;
  }
}

// Draws the mini-map marker and recenters on the selected cafe.
function updateMap(cafe) {
  // Skip until map is initialized and coordinates are valid.
  if (!miniMap || !Number.isFinite(cafe.lat) || !Number.isFinite(cafe.lon)) {
    return;
  }

  const position = { lat: cafe.lat, lng: cafe.lon };

  // Keep map focused on the selected cafe location.
  miniMap.setCenter(position);
  miniMap.setZoom(15);

  // Replace old marker to avoid duplicates after refresh.
  if (marker) {
    marker.setMap(null);
  }

  marker = new google.maps.Marker({ map: miniMap, position, title: cafe.name });
}

// Populates all text fields on the details page with default text.
function renderCafe(cafe) {
  nameElement.textContent = cafe.name || "Cafe details unavailable";
  addressElement.textContent = cafe.address || "Address unavailable";
  neighborhoodElement.textContent = cafe.neighbourhood || "Unknown";
  coordsElement.textContent =
    Number.isFinite(cafe.lat) && Number.isFinite(cafe.lon)
      ? `${cafe.lat.toFixed(5)}, ${cafe.lon.toFixed(5)}`
      : "Unknown";
  phoneElement.textContent = cafe.phone || "Not listed";

  // Render website as an external link when present, plain text otherwise.
  if (cafe.website) {
    websiteElement.innerHTML = `<a href="${cafe.website}" target="_blank" rel="noopener noreferrer">${cafe.website}</a>`;
  } else {
    websiteElement.textContent = "Not listed";
  }

  hoursElement.textContent = cafe.openingHours || "Not listed";

  // Keep map display aligned with rendered cafe data.
  updateMap(cafe);
}

// Loads Google Maps SDK using API key.
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps failed to load."));

    // Insert SDK script to start loading immediately.
    document.head.appendChild(script);
  });
}

// Fetches runtime config then initializes the mini map instance.
async function initMap() {
  // Read public config (includes Google Maps browser key).
  const response = await fetch("/api/config");
  const config = await response.json();

  // Stop if config call fails or key is unavailable.
  if (!response.ok || !config.googleMapsApiKey) {
    throw new Error("Missing or invalid Google Maps API key in server config.");
  }

  // Load SDK before creating map object.
  await loadGoogleMaps(config.googleMapsApiKey);

  // Create compact map.
  miniMap = new google.maps.Map(document.getElementById("mini-map"), {
    center: { lat: 43.6532, lng: -79.3832 },
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });
}

// Requests fresh cafe details by id.
async function fetchCafeById(id) {
  const response = await fetch(`/api/cafes/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error("Cafe details could not be loaded.");
  }
  return response.json();
}

// Details page bootstrap flow: validate id -> initialize map -> render cache -> fetch live.
async function init() {
  setStatus("Loading cafe details...");

  // Read cafe id from query string (`details.html?id=...`).
  const params = new URLSearchParams(window.location.search);
  const cafeId = params.get("id");

  // Without an id there is nothing to fetch/render.
  if (!cafeId) {
    setStatus("No cafe id was provided.");
    return;
  }

  try {
    // Initialize map first so both cached and live renders can place marker.
    await initMap();
  } catch (error) {
    // Hard-stop if map cannot be created on this page.
    setStatus(error.message || "Map could not be initialized.");
    return;
  }

  // Optional immediate render from local cache while live request is in flight.
  const cachedCafe = getCachedCafe(cafeId);
  if (cachedCafe) {
    renderCafe(cachedCafe);
    setStatus("Showing cached details...");
  }

  try {
    // Replace cached values (if any) with canonical API response.
    const cafe = await fetchCafeById(cafeId);
    renderCafe(cafe);
    setStatus("Live cafe details loaded.");
  } catch (error) {
    // Show error only when cache was not available as fallback.
    if (!cachedCafe) {
      setStatus(error.message || "Failed to load cafe details.");
    }
  }
}

// Start details page initialization.
init();
