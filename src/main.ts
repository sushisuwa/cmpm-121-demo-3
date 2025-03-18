// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Starting location
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

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
  lat: number;
  lng: number;
  rectangle: leaflet.Rectangle;
  coins: Geocoin[];
  updatePopup?: () => void; // Optional function to update popup content
}

interface Geocoin {
  ID: string;
}

// Define global player coin inventory
const playerCoins: Geocoin[] = [];

function generateCoins(maxCoins: number): Geocoin[] {
  const coins: Geocoin[] = [];
  for (let i = 0; i < maxCoins; i++) {
    coins.push({ ID: generateRandomID() });
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

function createCachePopup(cache: Cache): void {
  const popupDiv = document.createElement("div");

  const cacheLocation = document.createElement("h4");
  cacheLocation.innerText = `Cache at (${cache.lat.toFixed(5)}, ${
    cache.lng.toFixed(5)
  })`;

  const coinCount = document.createElement("p");
  coinCount.innerText = `Contains ${cache.coins.length} coin(s)`;

  const collectButton = document.createElement("button");
  collectButton.innerText = "Collect Coin";
  collectButton.addEventListener("click", () => {
    collectCoin(cache);
  });

  const depositButton = document.createElement("button");
  depositButton.innerText = "Deposit Coin";
  depositButton.addEventListener("click", () => {
    depositCoin(cache);
  });

  popupDiv.appendChild(cacheLocation);
  popupDiv.appendChild(coinCount);
  popupDiv.appendChild(collectButton);
  popupDiv.appendChild(depositButton);
  cache.rectangle.bindPopup(popupDiv);

  cache.updatePopup = () => {
    coinCount.innerText = `Contains ${cache.coins.length} coin(s)`;
  };
}
/*
function spawnCache(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Create the cache object
  const cache: Cache = {
    lat: (bounds.getNorthEast().lat + bounds.getSouthWest().lat) / 2,
    lng: (bounds.getNorthEast().lng + bounds.getSouthWest().lng) / 2,
    value: 0, // Value could represent total coins
    rectangle: leaflet.rectangle(bounds),
    coins: generateInitialCoins(i, j), // Start with some random coins
  };

  // Add a rectangle to the map
  cache.rectangle.addTo(map);

  // Function to update popup UI
  function updatePopup() {
    const popupDiv = document.createElement("div");

    popupDiv.innerHTML = `
      <div>Cache at "${i},${j}". It contains <span id="coin-count">${cache.coins.length}</span> coin(s).</div>
      <div id="coin-list">${
      cache.coins.map((c) => `<div>Coin ID: ${c.ID}</div>`).join("")
    }</div>
      <button id="collect">Collect Coin</button>
      <button id="deposit">Deposit Coin</button>`;

    // Collect coin functionality
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (cache.coins.length > 0) {
          const collectedCoin = cache.coins.pop();
          if (collectedCoin) {
            playerCoins.push(collectedCoin);
            updatePopup(); // Refresh cache popup UI
          }
        }
      },
    );

    // Deposit coin functionality
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins.length > 0) {
          const depositedCoin = playerCoins.pop();
          if (depositedCoin) {
            cache.coins.push(depositedCoin);
            updatePopup(); // Refresh cache popup UI
          }
        }
      },
    );

    return popupDiv;
  }

  // Bind popup to rectangle
  cache.rectangle.bindPopup(updatePopup);
}
*/
function spawnCache(i: number, j: number) {
  //convert cells numbers to lat/lng bounds, also account for the offset
  const cellOffset = TILE_DEGREES / 2;
  const origin = OAKES_CLASSROOM;
  const cellBounds = leaflet.latLngBounds([
    [
      origin.lat + (i - cellOffset) * TILE_DEGREES,
      origin.lng + (j - cellOffset) * TILE_DEGREES,
    ],
    [
      origin.lat + (i + 1 + cellOffset) * TILE_DEGREES,
      origin.lng + (j + 1 + cellOffset) * TILE_DEGREES,
    ],
  ]);
  console.log(`Spawning cache at (${i}, ${j}) with bounds:`, cellBounds);
  //Create the Cache object
  const cache: Cache = {
    lat: (cellBounds.getNorthEast().lat + cellBounds.getSouthWest().lat) / 2,
    lng: (cellBounds.getNorthEast().lng + cellBounds.getSouthWest().lng) / 2,
    rectangle: leaflet.rectangle(cellBounds, { color: "blue", weight: 1 }),
    coins: generateCoins(3), // Start with some random coins
  };
  cache.rectangle.addTo(map); // Add the rectangle to the map
  createCachePopup(cache); // Create the popup for the cache
  return cache;
}

function generateRandomID(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit random number
}
/*
function generateInitialCoins(i: number, j: number): Geocoin[] {
  const numCoins = Math.floor(luck([i, j, "initialCoins"].toString()) * 5);
  return Array.from({ length: numCoins }, () => ({
    ID: generateRandomID(),
  }));
}*/

// Spawn caches in the neighborhood
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
