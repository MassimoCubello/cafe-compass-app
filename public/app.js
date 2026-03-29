const CAFE_CACHE_KEY = "cafeCache";

const statusElement = document.getElementById("status");
const resultsElement = document.getElementById("results");
const formElement = document.getElementById("search-form");
const queryElement = document.getElementById("search-input");
const radiusElement = document.getElementById("radius-select");
const includeChainsElement = document.getElementById("include-chains");
const nearMeButton = document.getElementById("nearby-btn");

// Shared app state used across search, map rendering, and list rendering.
const torontoCenter = { lat: 43.6532, lon: -79.3832 };
let map;
let infoWindow;
let markers = [];
let userLocation = null;

// Centralized status helper so all user-facing messages are updated consistently.
function setStatus(text) {
  statusElement.textContent = text;
}

// Clears old markers before a new search to prevent duplicate pins on the map.
function clearMarkers() {
  for (const marker of markers) {
    marker.setMap(null);
  }
  markers = [];
}

// Builds the details route URL for a specific cafe id.
function detailsUrl(cafe) {
  return `details.html?id=${encodeURIComponent(cafe.id)}`;
}

// Stores the latest cafe results so details page can render immediately before live fetch.
function cacheCafes(cafes) {
  const cache = {};
  for (const cafe of cafes) {
    cache[cafe.id] = cafe;
  }
  sessionStorage.setItem(CAFE_CACHE_KEY, JSON.stringify(cache));
}

// Calculates great-circle distance using the Haversine formula (output in km).
function distanceKm(aLat, aLon, bLat, bLon) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Renders the left-side cafe list and wires each row to the related map marker.
function renderResults(cafes) {
  // Reset previous list items.
  resultsElement.innerHTML = "";

  // Sort by distance only when browser location is available.
  const sorted = [...cafes];
  if (userLocation) {
    sorted.sort((a, b) => {
      const aDistance = distanceKm(userLocation.lat, userLocation.lon, a.lat, a.lon);
      const bDistance = distanceKm(userLocation.lat, userLocation.lon, b.lat, b.lon);
      return aDistance - bDistance;
    });
  }

  // Build one list row per cafe.
  for (const cafe of sorted) {
    const li = document.createElement("li");
    li.className = "result-item";

    // Show distance only if we know both the user location and cafe coordinates.
    let distanceText = "";
    if (userLocation && Number.isFinite(cafe.lat) && Number.isFinite(cafe.lon)) {
      const km = distanceKm(userLocation.lat, userLocation.lon, cafe.lat, cafe.lon).toFixed(2);
      distanceText = `<p class=\"distance\">${km} km away</p>`;
    }

    // Render summary info + link to full details page.
    li.innerHTML = `
      <h3>${cafe.name}</h3>
      <p>${cafe.address}</p>
      ${distanceText}
      <a class="details-link" href="${detailsUrl(cafe)}">View Details</a>
    `;

    // Clicking a list row pans map to the marker and opens a quick info popup.
    li.addEventListener("click", () => {
      const marker = markers.find((m) => m.__cafeId === cafe.id);
      if (!marker) {
        return;
      }
      map.panTo(marker.getPosition());
      infoWindow.setContent(`<strong>${cafe.name}</strong><p>${cafe.address}</p>`);
      infoWindow.open({ map, anchor: marker });
    });

    // Add row to list container.
    resultsElement.appendChild(li);
  }
}

// Draws markers for each cafe and wires click behavior for popup content.
function renderMarkers(cafes) {
  // Start from a clean map layer.
  clearMarkers();

  // Create one marker per cafe with valid coordinates.
  for (const cafe of cafes) {
    if (!Number.isFinite(cafe.lat) || !Number.isFinite(cafe.lon)) {
      continue;
    }

    const marker = new google.maps.Marker({
      map,
      position: { lat: cafe.lat, lng: cafe.lon },
      title: cafe.name,
    });

    // Keep cafe id on marker for quick reverse lookup from list clicks.
    marker.__cafeId = cafe.id;

    // Marker click opens info popup with direct link to details page.
    marker.addListener("click", () => {
      infoWindow.setContent(`
        <div class="info-window">
          <strong>${cafe.name}</strong>
          <p>${cafe.address}</p>
          <a href="${detailsUrl(cafe)}">View details</a>
        </div>
      `);
      infoWindow.open({ map, anchor: marker });
    });

    // Track marker so it can be cleared on next render.
    markers.push(marker);
  }
}

// Builds request params and fetches cafes from backend API.
async function fetchCafes(options = {}) {
  const params = new URLSearchParams();

  // Optional text query (neighborhood/address).
  if (options.query) {
    params.set("query", options.query);
  }

  // Optional radius filter (meters).
  if (Number.isFinite(options.radius)) {
    params.set("radius", String(options.radius));
  }

  // Optional explicit coordinates (used by "Near Me").
  if (Number.isFinite(options.lat) && Number.isFinite(options.lon)) {
    params.set("lat", String(options.lat));
    params.set("lon", String(options.lon));
  }

  // Explicit chain filter mode.
  params.set("includeChains", String(Boolean(options.includeChains)));

  // Request cafes and surface backend errors in human-readable form.
  const response = await fetch(`/api/cafes?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to load cafes.");
  }

  return response.json();
}

// Loads cafe data then updates cache, markers, list, and map center in one flow.
async function loadAndRender(options = {}) {
  setStatus("Loading cafes...");

  try {
    // Fetch latest cafes based on current search options.
    const payload = await fetchCafes(options);
    const cafes = payload.cafes || [];

    // Keep UI data and details-page fallback in sync.
    cacheCafes(cafes);
    renderMarkers(cafes);
    renderResults(cafes);

    // Recenter map to the backend-confirmed search center.
    if (Number.isFinite(payload.center?.lat) && Number.isFinite(payload.center?.lon)) {
      map.setCenter({ lat: payload.center.lat, lng: payload.center.lon });
    }

    // Final user feedback for successful search.
    setStatus(`Showing ${cafes.length} cafes.`);
  } catch (error) {
    // Final user feedback for failed search.
    setStatus(error.message || "Unable to load cafes.");
  }
}

// Wrapper around browser geolocation API that returns a Promise with {lat, lon}.
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    // Request current position with high accuracy and a timeout guard.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      () => reject(new Error("Unable to access your location.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Dynamically injects Google Maps JS SDK so key can come from backend config.
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps failed to load."));

    // Attach script tag to begin loading the external SDK.
    document.head.appendChild(script);
  });
}

// Registers form submit and near-me button interactions.
function registerEvents() {
  // Search form: query/radius/filter based lookup.
  formElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    const options = {
      query: queryElement.value.trim(),
      radius: Number.parseInt(radiusElement.value, 10),
      includeChains: includeChainsElement.checked,
    };

    // Trigger fetch + render pipeline.
    await loadAndRender(options);
  });

  // Near Me: use browser geolocation to find nearby cafes.
  nearMeButton.addEventListener("click", async () => {
    setStatus("Finding your location...");

    try {
      // 1) Get user coordinates.
      userLocation = await getUserLocation();

      // 2) Move map close to user before fetching results.
      map.setCenter({ lat: userLocation.lat, lng: userLocation.lon });
      map.setZoom(14);

      // 3) Fetch and render cafes around user position.
      await loadAndRender({
        lat: userLocation.lat,
        lon: userLocation.lon,
        radius: Number.parseInt(radiusElement.value, 10),
        includeChains: includeChainsElement.checked,
      });
    } catch (error) {
      // Show geolocation or request failure.
      setStatus(error.message || "Unable to find nearby cafes.");
    }
  });
}

// App bootstrap sequence: config -> maps SDK -> map instance -> events -> initial search.
async function init() {
  setStatus("Loading map...");

  try {
    // Load public runtime config from server.
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();

    // Stop early if API key is missing or config endpoint failed.
    if (!configResponse.ok || !config.googleMapsApiKey) {
      setStatus("Missing or invalid Google Maps API key in server config.");
      return;
    }

    // Load Google Maps SDK using backend-provided key.
    await loadGoogleMaps(config.googleMapsApiKey);

    // Create map instance centered on Toronto.
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: torontoCenter.lat, lng: torontoCenter.lon },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
    });

    // Shared popup used by both marker clicks and list clicks.
    infoWindow = new google.maps.InfoWindow();

    // Attach UI handlers and perform first data load.
    registerEvents();
    await loadAndRender({
      radius: Number.parseInt(radiusElement.value, 10),
      includeChains: includeChainsElement.checked,
    });
  } catch (error) {
    // Catch-all for startup failures.
    setStatus(error.message || "Unable to initialize app.");
  }
}

// Kick off app startup once this script is loaded.
init();
