import leaflet from "leaflet";

// Define the Cell interface to represent a cell on the board
// Each cell is defined by its (i, j) coordinates
export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number; // Width of each tile in degrees
  readonly tileVisibilityRadius: number; // Radius of visibility in tiles
  private readonly knownCells: Map<string, Cell>; // Map to store unique cells

  // Constructor initializes the board with a specified tile width and visibility radius
  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  //Ensures that each cell is unique
  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  //Converts a geographical point (latitude, longitude) to a cell (i, j) on the board
  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: Math.floor((point.lat + 90) / this.tileWidth),
      j: Math.floor((point.lng + 180) / this.tileWidth),
    });
  }

  //Computes the geographical boundaries of a given cell
  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;
    const origin = leaflet.latLng(
      -90 + i * this.tileWidth,
      -180 + j * this.tileWidth,
    );
    const bounds = leaflet.latLngBounds([
      [origin.lat, origin.lng],
      [origin.lat + this.tileWidth, origin.lng + this.tileWidth],
    ]);
    return bounds;
  }

  //Finds all neighboring cells around a given geographical point
  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);

    const { i, j } = originCell;
    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const neighborCell = this.getCanonicalCell({ i: i + di, j: j + dj });
        if (
          !resultCells.some((cell) =>
            cell.i === neighborCell.i && cell.j === neighborCell.j
          )
        ) {
          resultCells.push(neighborCell);
        }
      }
    }

    // Return the unique neighboring cells
    return resultCells;
  }
}
