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
  value: number;
  rectangle: leaflet.Rectangle;
  coins: Geocoin[];
}

interface Geocoin {
  ID: string;
}

// Define global player coin inventory
const playerCoins: Geocoin[] = [];

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

function generateRandomID(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit random number
}

function generateInitialCoins(i: number, j: number): Geocoin[] {
  const numCoins = Math.floor(luck([i, j, "initialCoins"].toString()) * 5);
  return Array.from({ length: numCoins }, () => ({
    ID: generateRandomID(),
  }));
}

// Spawn caches in the neighborhood
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
