// Read the selected cafe id from the hidden data attribute.
const cafeIdElement = document.getElementById("cafe-id");
const cafeId = cafeIdElement?.dataset?.id;

// Grab all output fields.
const nameElement = document.getElementById("cafe-name");
const addressElement = document.getElementById("cafe-address");
const phoneElement = document.getElementById("cafe-phone");
const websiteElement = document.getElementById("cafe-website");
const hoursElement = document.getElementById("cafe-hours");

// Populates the page with cafe details.
function renderCafe(cafe) {
  nameElement.textContent = cafe.name || "Cafe details unavailable";
  addressElement.textContent = cafe.address || "Address unavailable";
  phoneElement.textContent = cafe.phone || "Not listed";
  hoursElement.textContent = cafe.openingHours || "Not listed";

  if (cafe.website) {
    websiteElement.innerHTML = `<a href="${cafe.website}" target="_blank" rel="noopener noreferrer">${cafe.website}</a>`;
  } else {
    websiteElement.textContent = "Not listed";
  }
}

// Loads one cafe from the backend API.
async function init() {
  if (!cafeId) {
    nameElement.textContent = "Missing cafe id.";
    return;
  }

  try {
    const response = await fetch(`/api/cafes/${encodeURIComponent(cafeId)}`);
    if (!response.ok) {
      throw new Error("Could not load cafe details.");
    }

    const cafe = await response.json();
    renderCafe(cafe);
  } catch (error) {
    nameElement.textContent = error.message;
  }
}

init();
