const statusElement = document.getElementById("status");
const resultsElement = document.getElementById("results");
const formElement = document.getElementById("search-form");
const queryElement = document.getElementById("search-input");
const radiusElement = document.getElementById("radius-select");
const includeChainsElement = document.getElementById("include-chains");

// These variables hold the map, info window, and markers once initialized.
let map;
let infoWindow;
let markers = [];

// Updates the status text
const setStatus = (text) => {
  statusElement.textContent = text;
};

// Removes all current markers before reloading new ones.
function clearMarkers() {
  for (const marker of markers) marker.setMap(null);
  markers = [];
}

// Builds the details-page URL for a cafe.
function detailsUrl(cafeId) {
  return `/cafe/${encodeURIComponent(cafeId)}`;
}

// This function renders the cafe list and links rows to map markers.
function renderResults(cafes) {
  resultsElement.innerHTML = "";

    for (const cafe of cafes) {
    const item = document.createElement("li");
    item.className = "result-item";
    item.innerHTML = `<h3>${cafe.name}</h3><p>${cafe.address}</p><p><a href="${detailsUrl(cafe.id)}">View details</a></p>`;
    // Clicking a result row opens the details page.
    item.addEventListener("click", () => {
      window.location.href = detailsUrl(cafe.id);
    });

    resultsElement.appendChild(item);
  }
}

// Function to place one marker per cafe with valid coordinates.
function renderMarkers(cafes) {
  clearMarkers();
    // Loops through cafes and creates markers for those with valid lat/lon.
    for (const cafe of cafes) {
        if (!Number.isFinite(cafe.lat) || !Number.isFinite(cafe.lon)) continue;
        // This function creates a marker for each cafe.
        const marker = new google.maps.Marker({
            map,
            position: { lat: cafe.lat, lng: cafe.lon },
            title: cafe.name,
        });

    marker.__id = cafe.id;
    marker.addListener("click", () => { // Click listener
      infoWindow.setContent(`<strong>${cafe.name}</strong><p>${cafe.address}</p><p><a href="${detailsUrl(cafe.id)}">View details</a></p>`);
      infoWindow.open({ map, anchor: marker });
    });

    markers.push(marker);
  }
}

// This function calls the backend search with active filters (ex. includeChains).
async function fetchCafes(options) {
  const params = new URLSearchParams();
  if (options.query) params.set("query", options.query);
  if (Number.isFinite(options.radius)) params.set("radius", String(options.radius));
  params.set("includeChains", String(Boolean(options.includeChains)));

  const response = await fetch(`/api/cafes?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to load cafes.");
  }
  
  return response.json();
}

// Fetches cafes 
async function loadAndRender(options) {
  setStatus("Loading cafes...");

  try {
    const payload = await fetchCafes(options);
    const cafes = payload.cafes || [];

    renderMarkers(cafes);
    renderResults(cafes);

    if (Number.isFinite(payload.center?.lat) && Number.isFinite(payload.center?.lon)) {
      map.setCenter({ lat: payload.center.lat, lng: payload.center.lon }); 
    }

    setStatus(`Showing ${cafes.length} cafes.`);
  } catch (error) {
    setStatus(error.message || "Unable to load cafes.");
  }
}

// Loads Google Maps 
function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });
}

// This function registers the form submit event to trigger a new search with the current filters.
function registerEvents() {
  formElement.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadAndRender({
      query: queryElement.value.trim(),
      radius: Number.parseInt(radiusElement.value, 10),
      includeChains: includeChainsElement.checked,
    });
  });
}

// This function initializes the app by loading the config, Google Maps, and performing an initial search.
async function init() {
  setStatus("Loading map...");

  try {
    const response = await fetch("/api/config");
    const config = await response.json();

    if (!response.ok || !config.googleMapsApiKey) {
      setStatus("Missing or invalid Google Maps API key in server config.");
      return;
    }

    await loadGoogleMaps(config.googleMapsApiKey);

    map = new google.maps.Map(document.getElementById("map"), { 
      center: { lat: config.torontoCenter.lat, lng: config.torontoCenter.lon },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
    });
    
    infoWindow = new google.maps.InfoWindow();
    registerEvents();

    await loadAndRender({
      radius: Number.parseInt(radiusElement.value, 10),
      includeChains: includeChainsElement.checked,
    });
  } catch (error) {
    setStatus(error.message || "Unable to initialize app.");
  }
}

init();


