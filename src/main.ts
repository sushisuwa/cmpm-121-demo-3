// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Import the Board class to manage the game board
import { Board, Cell } from "./board.ts";

// Starting location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create a board to manage the game area
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map);
playerMarker.bindTooltip("You are here");

//Cache and Geocoin interfaces
interface Cache {
  cell: Cell;
  rectangle: leaflet.Rectangle;
  coins: Geocoin[];
  updatePopup?: () => void; // Optional function to update popup content
}
// Define the Geocoin interface
interface Geocoin {
  i: number;
  j: number;
  ID: string;
}

// Define global player coin inventory
const playerCoins: Geocoin[] = [];

// Function to generate coins for a cache
// Each cache starts with a fixed number of coins at its (i, j) location
// The coins are represented by their (i, j) coordinates and a unique ID
// The ID is simply the index of the coin in the cache
function generateCoins(di: number, dj: number, maxCoins: number): Geocoin[] {
  const coins: Geocoin[] = [];
  for (let i = 0; i < maxCoins; i++) {
    coins.push({
      i: di,
      j: dj,
      ID: i.toString(),
    });
  }
  return coins;
}

function collectCoin(cache: Cache): void {
  // Collect a coin from the cache if available
  if (cache.coins.length > 0) {
    const temp = cache.coins.pop(); // Remove the last coin from the cache
    playerCoins.push(temp!); // Add it to the player's inventory
  }
  cache.updatePopup?.(); // Update the popup to reflect the new coin count
}

function depositCoin(cache: Cache): void {
  // Deposit a coin into the cache
  if (playerCoins.length > 0) {
    const temp = playerCoins.pop(); // Remove the last coin from the player's inventory
    cache.coins.push(temp!); // Add it to the cache
  }
  cache.updatePopup?.(); // Update the popup to reflect the new coin count
}

// Function to create a popup for a cache
// The popup displays the cache location, number of coins, and buttons to collect or deposit coins
// The popup content is generated dynamically to reflect the current state of the cache
function createCachePopup(cache: Cache): void {
  function generatePopupContent(): HTMLElement {
    const popupDiv = document.createElement("div"); // Create a div to hold the popup content

    const cacheLocation = document.createElement("h4"); // Create an h4 element for the cache location
    cacheLocation.innerText = `Cache at (${cache.cell.i}, ${cache.cell.j})`;

    const coinCount = document.createElement("p"); // Create a paragraph for the coin count
    coinCount.innerText = `Contains ${cache.coins.length} coin(s)`;

    const coinDescriptions = document.createElement("p"); // Create a paragraph for the coin descriptions
    coinDescriptions.innerText = "Coins: ";
    for (const coin of cache.coins) {
      const coinElement = document.createElement("p"); // Create a paragraph for each coin
      coinElement.innerText = `[i: ${coin.i}, j: ${coin.j}] serial: ${coin.ID}`;
      coinDescriptions.appendChild(coinElement);
    }

    const collectButton = document.createElement("button"); // Create a button to collect a coin
    collectButton.innerText = "Collect Coin";
    collectButton.addEventListener("click", () => {
      collectCoin(cache);
      cache.rectangle.getPopup()?.setContent(generatePopupContent()); // Update the popup content
    });

    const depositButton = document.createElement("button"); // Create a button to deposit a coin
    depositButton.innerText = "Deposit Coin";
    depositButton.addEventListener("click", () => {
      depositCoin(cache);
      cache.rectangle.getPopup()?.setContent(generatePopupContent()); // Update the popup content
    });

    popupDiv.appendChild(cacheLocation);
    popupDiv.appendChild(coinCount);
    popupDiv.appendChild(coinDescriptions);
    popupDiv.appendChild(collectButton);
    popupDiv.appendChild(depositButton);

    return popupDiv;
  }
  cache.rectangle.bindPopup(generatePopupContent());

  cache.updatePopup = () => {
    cache.rectangle.getPopup()?.setContent(generatePopupContent()); // Update the popup content
  };
}

// Function to spawn a cache at a given point
// The cache is represented by a rectangle on the map and contains a number of coins
// The cache is created based on the cell corresponding to the given point
function spawnCache(point: leaflet.LatLng): Cache {
  //convert cells numbers to lat/lng bounds, also account for the offset
  const cell = board.getCellForPoint(point);
  const bounds = board.getCellBounds(cell);

  console.log(`Spawning cache at grid (${cell.i}, ${cell.j})`);

  //Create the Cache object
  const cache: Cache = {
    cell,
    rectangle: leaflet.rectangle(bounds, { color: "blue", weight: 1 }),
    coins: generateCoins(cell.i, cell.j, 3), // Start with some random coins
  };
  cache.rectangle.addTo(map); // Add the rectangle to the map
  createCachePopup(cache); // Create the popup for the cache
  return cache;
}

// Create a map to store caches for each cell
const cacheMap: Map<string, Cache> = new Map();

// This allows us to avoid creating multiple caches for the same cell
// and ensures that we only create one cache per cell
function getOrCreateCache(point: leaflet.LatLng): Cache {
  const cell = board.getCellForPoint(point);
  const key = `${cell.i},${cell.j}`;

  if (cacheMap.has(key)) {
    return cacheMap.get(key)!;
  }

  const cache = spawnCache(point);
  cacheMap.set(key, cache);
  return cache;
}

// Spawn caches around the Oakes classroom location
const nearbyCells = board.getCellsNearPoint(OAKES_CLASSROOM);

// For each nearby cell, determine if a cache should be spawned based on the CACHE_SPAWN_PROBABILITY
for (const cell of nearbyCells) {
  const point = leaflet.latLng(
    -90 + cell.i * TILE_DEGREES,
    -180 + cell.j * TILE_DEGREES,
  );
  if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    getOrCreateCache(point);
  }
}
