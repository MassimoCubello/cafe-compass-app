# cafe-compass-app

## Concept
Cafe Compass is a web application designed to help users discover independent coffee shops in Toronto. 

The concept came about when looking for local cafes with good coffee and a nice environment to spend time in. As many search results for coffee shops are dominated by large chains such as Tim Hortons or Starbucks that are annoying to filter through, this application focuses on helping users find smaller, local cafes by retrieving cafe data and displaying it on an interactive map.

Users will be able to explore cafes around Toronto, view their locations, and see basic information such as name and address. The application will filter out large coffee chains to highlight independent coffee shops. Users will also be able to search for cafes by neighbourhood or area within Toronto.

## How To Run
1. Clone the repository to your local machine.
2. Download node modules by running `npm install` in the project directory.
3. Start the development server with `npm run dev`.
4. Open your web browser and navigate to `http://localhost:3000` to view the application.

## Deployment
The application is deployed on Render and can be accessed at the following URL: https://cafe-compass-app.onrender.com/

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