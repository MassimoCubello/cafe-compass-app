# cafe-compass-app
Cafe Compass is a web application initially designed to help users discover independent coffee shops in Toronto. 

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```bash
GEOAPIFY_API_KEY=your_geoapify_key
GOOGLE_MAPS_API_KEY=your_google_maps_javascript_key
PORT=3000
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## What The App Includes

- Interactive Google Map centered on Toronto.
- Geoapify-powered cafe search and marker plotting.
- Filter to hide large coffee chains by default.
- Search by neighborhood/address within Toronto.
- "Near Me" option to search cafes around user location.
- Dedicated details page with available cafe metadata.

## Files

- `index.js`: Express server, static hosting, and backend API routes (`/api/config`, `/api/search-area`, `/api/cafes`, `/api/cafes/:id`).
- `public/index.html`: Home page layout (hero, search controls, map, and results list).
- `public/app.js`: Home page client logic (Google Maps loading, marker rendering, search/filter logic, and nearby cafes behavior).
- `public/details.html`: Coffee shop details page layout.
- `public/details.js`: Details page logic (cached + live place details fetch and mini-map rendering).
- `public/styles.css`: Shared styling for home/details pages (responsive layout, visual theme, animations).
- `.env.example`: Required environment variables template (`GEOAPIFY_API_KEY`, `GOOGLE_MAPS_API_KEY`, `PORT`).
- `README.md`: Setup instructions, feature summary, and project documentation.

## Concept
Cafe Compass is a web application designed to help users discover independent coffee shops in Toronto. 

The concept came about when looking for local cafes with good coffee and a nice environment to spend time in. As many search results for coffee shops are dominated by large chains such as Tim Hortons or Starbucks that are annoying to filter through, this application focuses on helping users find smaller, local cafes by retrieving cafe data and displaying it on an interactive map.

Users will be able to explore cafes around Toronto, view their locations, and see basic information such as name and address. The application will filter out large coffee chains to highlight independent coffee shops. Users will also be able to search for cafes by neighbourhood or area within Toronto.

## APIs
### Geoapify Places API 
(https://www.geoapify.com/places-api/)

This API will be used to retrieve cafe data such as the following:
- coffee shop name
- address
- geographic coordinates
- additional business information (if available)

The application will query the Geoapify Places API for cafes within the Toronto area.

### Google Maps JavaScript API 
(https://developers.google.com/maps/documentation/javascript)

This API will be used to display an interactive map on the website. Coffee shop locations retrieved from the Geoapify API will be displayed as markers on the map, allowing users to visually explore cafes around the city.

## MVP (Minimum Viable Product)
    - Display an interactive map (for the purposes of this assignment, centered on Toronto)
    - Retrieve cafe data using the Geoapify Places API   
    - Display cafes as markers on the map
    - Show basic cafe information (name and address) when a marker is selected
    - Filter out large coffee chains to highlight independent cafes

## Pages
### Home Page
    - Interactive map of Toronto.
    - Coffee shop markers displayed on the map
    - Basic cafe information when markers are clicked
    - Search by neighborhood or address

### Coffee Shop Details Page
    - Name of the cafe
    - Address and location
    - Additional details available from the API
