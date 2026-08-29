import { type ArrayVector2D, type ArrayVector3D, normalize3D } from "@fimbul-works/vec";

/** WGS84 flattening factor for Earth. */
export const F_EARTH = 1.0 / 298.257223563;

/** 1.0 minus the square of WGS84 flattening factor for Earth. */
export const INV_K = (1.0 - F_EARTH) * (1.0 - F_EARTH);

/** Default radius for Earth in kilometers. */
export const DEFAULT_RADIUS_KM = 6371.0;

// Internal constants
const SQRT8_9 = Math.sqrt(8.0 / 9.0);
const SQRT2_9 = Math.sqrt(2.0 / 9.0);
const SQRT2_3 = Math.sqrt(2.0 / 3.0);

// Regular tetrahedron vertices on unit sphere centered at origin
export const TETRAHEDRA_V0: ArrayVector3D = [0.0, 0.0, 1.0];
export const TETRAHEDRA_V1: ArrayVector3D = [SQRT8_9, 0.0, -1.0 / 3.0];
export const TETRAHEDRA_V2: ArrayVector3D = [-SQRT2_9, SQRT2_3, -1.0 / 3.0];
export const TETRAHEDRA_V3: ArrayVector3D = [-SQRT2_9, -SQRT2_3, -1.0 / 3.0];

// 4 base faces of the tetrahedron (ordered CCW from outside)
export const BASE_FACES: [ArrayVector3D, ArrayVector3D, ArrayVector3D][] = [
  [TETRAHEDRA_V0, TETRAHEDRA_V1, TETRAHEDRA_V2], // Face 0
  [TETRAHEDRA_V0, TETRAHEDRA_V2, TETRAHEDRA_V3], // Face 1
  [TETRAHEDRA_V0, TETRAHEDRA_V3, TETRAHEDRA_V1], // Face 2
  [TETRAHEDRA_V1, TETRAHEDRA_V3, TETRAHEDRA_V2], // Face 3
];

/**
 * Precomputed data for each of the 4 base faces of the tetrahedron.
 * @internal
 */
interface BaseFaceData {
  /** Vertex A x */
  Ax: number;
  /** Vertex A y */
  Ay: number;
  /** Vertex A z */
  Az: number;
  /** Vertex B x */
  Bx: number;
  /** Vertex B y */
  By: number;
  /** Vertex B z */
  Bz: number;
  /** Vertex C x */
  Cx: number;
  /** Vertex C y */
  Cy: number;
  /** Vertex C z */
  Cz: number;
  /** Vector v0 from A to B */
  v0x: number;
  /** Vector v0 from A to B */
  v0y: number;
  /** Vector v0 from A to B */
  v0z: number;
  /** Vector v1 from A to C */
  v1x: number;
  /** Vector v1 from A to C */
  v1y: number;
  /** Vector v1 from A to C */
  v1z: number;
  /** Normal vector of the face */
  nx: number;
  /** Normal vector of the face */
  ny: number;
  /** Normal vector of the face */
  nz: number;
  /** Constant D in the plane equation Ax + By + Cz = D */
  D: number;
  /** Dot product of v0 with itself */
  d00: number;
  /** Dot product of v0 with v1 */
  d01: number;
  /** Dot product of v1 with itself */
  d11: number;
  /** 1.0 / (d00 * d11 - d01 * d01) */
  invDenom: number;
}

/**
 * Computes the base face data for a given face of the tetrahedron.
 * @param A Vertex A of the face.
 * @param B Vertex B of the face.
 * @param C Vertex C of the face.
 * @returns The base face data.
 */
function computeBaseFaceData(A: ArrayVector3D, B: ArrayVector3D, C: ArrayVector3D): BaseFaceData {
  const Ax = A[0],
    Ay = A[1],
    Az = A[2];
  const Bx = B[0],
    By = B[1],
    Bz = B[2];
  const Cx = C[0],
    Cy = C[1],
    Cz = C[2];

  const v0x = Bx - Ax,
    v0y = By - Ay,
    v0z = Bz - Az;
  const v1x = Cx - Ax,
    v1y = Cy - Ay,
    v1z = Cz - Az;

  const nx = v0y * v1z - v0z * v1y;
  const ny = v0z * v1x - v0x * v1z;
  const nz = v0x * v1y - v0y * v1x;

  const D = Ax * nx + Ay * ny + Az * nz;

  const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
  const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
  const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const invDenom = 1.0 / (d00 * d11 - d01 * d01);

  return {
    Ax,
    Ay,
    Az,
    Bx,
    By,
    Bz,
    Cx,
    Cy,
    Cz,
    v0x,
    v0y,
    v0z,
    v1x,
    v1y,
    v1z,
    nx,
    ny,
    nz,
    D,
    d00,
    d01,
    d11,
    invDenom,
  };
}

/** Precomputed base face data for the 4 faces of the tetrahedron. */
const BASE_FACE_DATA: BaseFaceData[] = [
  computeBaseFaceData(TETRAHEDRA_V0, TETRAHEDRA_V1, TETRAHEDRA_V2),
  computeBaseFaceData(TETRAHEDRA_V0, TETRAHEDRA_V2, TETRAHEDRA_V3),
  computeBaseFaceData(TETRAHEDRA_V0, TETRAHEDRA_V3, TETRAHEDRA_V1),
  computeBaseFaceData(TETRAHEDRA_V1, TETRAHEDRA_V3, TETRAHEDRA_V2),
];

/** Epsilon for floating point comparisons. */
const EPSILON12 = 1e-12;
const EPSILON14 = 1e-14;

/** Precomputed BigInt constants & lookup tables to eliminate V8 heap allocations in hot paths. */
const BIGINT_SUBS = [0n, 1n, 2n, 3n];
const BIGINT_FACES = [0n << 62n, 1n << 62n, 2n << 62n, 3n << 62n];
const VALID_FLAG = 1n << 5n;

/** Precomputed subdivision bit shifts: SUB_SHIFTS[i] = 60n - 2n * i (for i = 0..27). */
const SUB_SHIFTS: bigint[] = new Array(28);
for (let i = 0; i < 28; i++) {
  SUB_SHIFTS[i] = BigInt(60 - 2 * i);
}

/** Precomputed unused bit masks for validation: UNUSED_MASKS[zoom]. */
const UNUSED_MASKS: bigint[] = new Array(29);
for (let z = 0; z <= 28; z++) {
  const unusedBits = 2 * (28 - z);
  UNUSED_MASKS[z] = unusedBits > 0 ? ((1n << BigInt(unusedBits)) - 1n) << 6n : 0n;
}

/** Precomputed descendant masks: DESCENDANT_MASKS[parentZoom]. */
const DESCENDANT_MASKS: bigint[] = new Array(29);
for (let pz = 0; pz <= 28; pz++) {
  const bits = 2 * pz;
  DESCENDANT_MASKS[pz] = bits > 0 ? ((1n << BigInt(bits)) - 1n) << BigInt(62 - bits) : 0n;
}

/** Precomputed parent clearing masks: PARENT_CLEAR_MASKS[newZoom] = ~(3n << SUB_SHIFTS[newZoom]). */
const PARENT_CLEAR_MASKS: bigint[] = new Array(28);
for (let nz = 0; nz < 28; nz++) {
  PARENT_CLEAR_MASKS[nz] = ~(3n << SUB_SHIFTS[nz]);
}

/** Precomputed zoom BigInts: ZOOM_BIGINTS[zoom] = BigInt(zoom). */
const ZOOM_BIGINTS: bigint[] = new Array(29);
for (let z = 0; z <= 28; z++) {
  ZOOM_BIGINTS[z] = BigInt(z);
}

/**
 * Options for creating a T4Object.
 */
export interface T4Options {
  /** Planet radius in kilometers. Defaults to Earth's radius. */
  readonly radiusKm?: number;
  /** Whether to apply Earth curvature correction. Defaults to true. */
  readonly applyEarthCurvature?: boolean;
  /** Whether the cell is warped to the sphere's surface (authalic warp). Defaults to true. */
  readonly authalicWarp?: boolean;
}

/**
 * A traversable T4 cell.
 */
export interface T4Cell {
  /** The T4 ID of this cell. */
  readonly id: bigint;
  /** The zoom level of this cell. */
  readonly zoom: number;
  /** The radius of the sphere in kilometers. */
  readonly radiusKm: number;
  /** Whether to apply Earth curvature correction. */
  readonly applyEarthCurvature: boolean;
  /** Whether the cell is warped to the sphere's surface (authalic warp). */
  readonly authalicWarp: boolean;
  /** The 2D vertices of the cell (longitude, latitude) in degrees. */
  readonly vertices: [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  /** The 2D center of the cell (longitude, latitude) in degrees. */
  readonly center: ArrayVector2D;
  /** The 2D vertices of the cell (longitude, latitude) in the flat tetrahedral domain. */
  readonly vertices2D: [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  /** The 2D center of the cell (longitude, latitude) in the flat tetrahedral domain. */
  readonly center2D: ArrayVector2D;
  /** The 3D vertices of the cell (x, y, z) in Cartesian coordinates. */
  readonly vertices3D: [ArrayVector3D, ArrayVector3D, ArrayVector3D];
  /** The 3D center of the cell (x, y, z) in Cartesian coordinates. */
  readonly center3D: ArrayVector3D;
  /** The area of the cell. */
  readonly area: number;
  /** The parent cell of this cell. */
  readonly parent: T4Cell | null;
  /** The neighbors of this cell (adjacent cells sharing an edge). */
  readonly neighbors: [T4Cell, T4Cell, T4Cell];
  /** The children of this cell (four sub-cells). */
  readonly children: [T4Cell, T4Cell, T4Cell, T4Cell];
  /** The IDs of the children of this cell. */
  readonly childIds: [bigint, bigint, bigint, bigint];
  /** Check if this cell is a descendant of the given parent cell or ID. */
  isDescendantOf(parent: T4Cell | bigint): boolean;
}

// Instance cache to reuse T4Object instances (using WeakRefs to prevent leaks).
interface CacheFinalizerToken {
  optionsKey: string;
  id: bigint;
}

const optionsCache = new Map<string, Map<bigint, WeakRef<T4Cell>>>();

const cacheFinalizer = new FinalizationRegistry<CacheFinalizerToken>((token) => {
  const subMap = optionsCache.get(token.optionsKey);
  if (subMap) {
    const ref = subMap.get(token.id);
    if (ref && !ref.deref()) {
      subMap.delete(token.id);
      if (subMap.size === 0) {
        optionsCache.delete(token.optionsKey);
      }
    }
  }
});

/**
 * Generates a cache key for the given options.
 * @param radiusKm Planet radius in kilometers.
 * @param applyEarthCurvature Whether to apply Earth curvature correction.
 * @param authalicWarp Whether the cell is warped to the sphere's surface (authalic warp).
 * @returns A unique cache key.
 */
const getOptionsKey = (radiusKm: number, applyEarthCurvature: boolean, authalicWarp: boolean): string =>
  `${radiusKm}|${applyEarthCurvature}|${authalicWarp}`;

// --- ID Generation & Validation (Fixed 64-bit Layout) ---

/**
 * Creates a 64-bit T4 BigInt ID from a full path array `[baseFace, ...subdivisions]`.
 * @param path Array containing the base face (0-3) followed by subdivision codes (0-3).
 * @returns The 64-bit T4 ID.
 * @throws Error if the path is empty or invalid.
 */
export function createT4Id(path: number[]): bigint;

/**
 * Creates a 64-bit T4 BigInt ID from variadic path arguments `(baseFace, ...subdivisions)`.
 * @param path Subdivision path [baseFace, ...subdivisions]
 * @returns The 64-bit T4 ID.
 * @throws Error if the path is invalid.
 */
export function createT4Id(...path: number[]): bigint;

/**
 * Creates a 64-bit T4 BigInt ID from base face, subdivision path, and zoom level.
 * Bit layout:
 * - Bits 63..62: base face (2 bits)
 * - Bits 61..6: subdivisions (2 bits each; subdivision 0 at bits 61..60 down to subdivision 27 at bits 7..6)
 * - Bit 5: validity flag (always 1)
 * - Bits 4..0: zoom level (5 bits, 0-28)
 */
export function createT4Id(...args: (number | number[])[]): bigint {
  if (args.length === 0) {
    throw new Error("createT4Id requires at least a base face (0-3)");
  }

  const first = args[0];

  if (Array.isArray(first)) {
    // Array form: createT4Id([baseFace, ...subdivisions])
    const len = first.length;
    if (len === 0) {
      throw new Error("Path array must contain at least a base face (0-3)");
    }
    const baseFace = first[0];
    const zoom = len - 1;
    if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");
    if (baseFace < 0 || baseFace > 3 || !Number.isInteger(baseFace)) {
      throw new Error("Base face must be an integer between 0 and 3");
    }

    let id = BIGINT_FACES[baseFace];
    for (let i = 0; i < zoom; ++i) {
      const sub = first[i + 1];
      if (sub < 0 || sub > 3 || !Number.isInteger(sub)) {
        throw new Error(`Subdivision index ${sub} at path position ${i} must be between 0 and 3`);
      }
      id |= BIGINT_SUBS[sub] << SUB_SHIFTS[i];
    }
    return id | VALID_FLAG | ZOOM_BIGINTS[zoom];
  }

  // Variadic form: createT4Id(baseFace, ...subdivisions)
  const baseFace = first as number;
  const zoom = args.length - 1;
  if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");
  if (baseFace < 0 || baseFace > 3 || !Number.isInteger(baseFace)) {
    throw new Error("Base face must be an integer between 0 and 3");
  }

  let id = BIGINT_FACES[baseFace];
  for (let i = 0; i < zoom; ++i) {
    const sub = args[i + 1] as number;
    if (sub < 0 || sub > 3 || !Number.isInteger(sub)) {
      throw new Error(`Subdivision index ${sub} at path position ${i} must be between 0 and 3`);
    }
    id |= BIGINT_SUBS[sub] << SUB_SHIFTS[i];
  }
  return id | VALID_FLAG | ZOOM_BIGINTS[zoom];
}

/**
 * A parsed T4 ID.
 */
export interface ParsedT4Id {
  /** The base face of the T4 ID. */
  readonly baseFace: number;
  /** The subdivisions of the T4 ID. */
  readonly subdivisions: readonly number[];
  /** The zoom level of the T4 ID. */
  readonly zoom: number;
  /** Whether the T4 ID is valid. */
  readonly isValid: boolean;
}

/**
 * Parses a T4 BigInt ID into its face, subdivisions array, zoom, and validity flag.
 * @param id The T4 BigInt ID to parse.
 * @returns A ParsedT4Id object containing the face, subdivisions, zoom, and validity flag.
 */
export function parseT4Id(id: bigint): ParsedT4Id {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error(`Invalid T4 ID ${id}`);
  }

  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;

  if (!isValid || zoom > 28 || zoom < 0) {
    throw new Error(`Invalid T4 ID ${id}`);
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error(`Invalid T4 ID ${id}`);
  }

  const baseFace = Number((id >> 62n) & 3n);
  const subdivisions: number[] = new Array(zoom);
  for (let i = 0; i < zoom; ++i) {
    subdivisions[i] = Number((id >> SUB_SHIFTS[i]) & 3n);
  }

  return { baseFace, subdivisions, zoom, isValid: true };
}

/**
 * Validates whether a BigInt represents a valid 64-bit T4 ID.
 * @param id The T4 BigInt ID to validate.
 * @returns True if the T4 ID is valid, false otherwise.
 */
export function isValidT4Id(id: bigint): boolean {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    return false;
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || zoom < 0) {
    return false;
  }

  return (id & UNUSED_MASKS[zoom]) === 0n;
}

/**
 * Gets the parent T4 ID by clearing the lowest subdivision bits and decrementing zoom.
 * @param id The T4 BigInt ID to get the parent of.
 * @returns The parent T4 ID, or null if the given id is a valid zoom-0 cell (base face).
 * @throws Error if the given id is not a valid T4 ID.
 */
export function getParentT4Id(id: bigint): bigint | null {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || (id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  if (zoom === 0) {
    return null;
  }

  const newZoom = zoom - 1;
  return (id & PARENT_CLEAR_MASKS[newZoom] & ~0x1fn) | ZOOM_BIGINTS[newZoom];
}

/**
 * Gets the 4 child T4 IDs by setting the subdivision at zoom level and incrementing zoom.
 * @param id The T4 BigInt ID to get the children of.
 * @returns An array of 4 T4 BigInt IDs representing the children of the given id.
 * @throws Error if the given id is not a valid T4 ID or if maximum zoom level (28) is reached.
 */
export function getT4Children(id: bigint): [bigint, bigint, bigint, bigint] {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || (id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  if (zoom >= 28) {
    throw new Error("Cannot get children: max zoom level 28 reached");
  }

  const newZoom = zoom + 1;
  const base = (id & ~0x1fn) | ZOOM_BIGINTS[newZoom];
  const shift = SUB_SHIFTS[zoom];

  return [base, base | (1n << shift), base | (2n << shift), base | (3n << shift)];
}

/**
 * Checks whether childId is a descendant of parentId in $O(1)$ bit comparisons.
 * @param childId The child T4 BigInt ID.
 * @param parentId The parent T4 BigInt ID.
 * @returns True if the childId is a descendant of the parentId, false otherwise.
 */
export function isT4Descendant(childId: bigint, parentId: bigint): boolean {
  if (typeof childId !== "bigint" || typeof parentId !== "bigint") {
    return false;
  }

  const childZoom = Number(childId & 0x1fn);
  const parentZoom = Number(parentId & 0x1fn);

  if (childZoom <= parentZoom || childZoom > 28 || parentZoom < 0) {
    return false;
  }

  if (((childId >> 5n) & 1n) !== 1n || ((parentId >> 5n) & 1n) !== 1n) {
    return false;
  }

  if ((childId & UNUSED_MASKS[childZoom]) !== 0n || (parentId & UNUSED_MASKS[parentZoom]) !== 0n) {
    return false;
  }

  if (childId >> 62n !== parentId >> 62n) {
    return false;
  }

  if (parentZoom === 0) {
    return true;
  }

  const mask = DESCENDANT_MASKS[parentZoom];
  return (childId & mask) === (parentId & mask);
}

// --- Coordinate Precision & Recommended Zoom ---

/**
 * Counts the number of significant decimal places in a number or numeric string.
 * @internal
 */
function countDecimals(val: number | string): number {
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return 0;
    if (Math.floor(val) === val) return 0;
    const str = val.toString();
    if (str.includes("e-")) {
      return Number.parseInt(str.split("e-")[1], 10);
    }
    const dot = str.indexOf(".");
    return dot === -1 ? 0 : str.length - dot - 1;
  }
  const s = String(val).trim();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Calculates the recommended T4 zoom level (0..28) for a given GPS coordinate pair
 * based on its floating-point precision and geographical latitude.
 *
 * Automatically accounts for meridian convergence at higher latitudes, where
 * longitude degrees span fewer physical meters on the spherical surface.
 *
 * @param lat Latitude in degrees (number, numeric string, [lng, lat] vector, or { lat, lng } object).
 * @param lng Longitude in degrees (number or numeric string).
 * @returns An integer zoom level between 0 and 28.
 *
 * @example
 * getRecommendedT4Zoom(60.1699, 24.9384); // 21 (~5.2 m resolution for 4 decimals in Helsinki)
 * getRecommendedT4Zoom(0, 0); // 7 (~85 km resolution for integer degrees)
 * getRecommendedT4Zoom([24.9384, 60.1699]); // 21
 */
export function getRecommendedT4Zoom(
  lat: number | string | ArrayVector2D | { lat: number; lng: number } | { latitude: number; longitude: number },
  lng?: number | string,
  radiusKm = DEFAULT_RADIUS_KM,
): number {
  let latVal: number | string;
  let lngVal: number | string;

  if (Array.isArray(lat)) {
    lngVal = lat[0];
    latVal = lat[1];
  } else if (typeof lat === "object" && lat !== null) {
    if ("lat" in lat && "lng" in lat) {
      latVal = lat.lat;
      lngVal = lat.lng;
    } else if ("latitude" in lat && "longitude" in lat) {
      latVal = (lat as { latitude: number; longitude: number }).latitude;
      lngVal = (lat as { latitude: number; longitude: number }).longitude;
    } else {
      latVal = 0;
      lngVal = 0;
    }
  } else {
    latVal = lat;
    lngVal = lng ?? 0;
  }

  const dLat = countDecimals(latVal);
  const dLng = countDecimals(lngVal);
  const radiusScale = radiusKm > 0 ? radiusKm / DEFAULT_RADIUS_KM : 1.0;

  // ~85 km cell on Earth for 1-degree whole integer precision
  if (dLat === 0 && dLng === 0) {
    return 7 * radiusScale;
  }

  const numLat = typeof latVal === "number" ? latVal : Number.parseFloat(String(latVal));
  const safeLat = Number.isFinite(numLat) ? Math.max(-90, Math.min(90, numLat)) : 0;
  const latRad = (safeLat * Math.PI) / 180.0;
  const cosLat = Math.max(0.001, Math.abs(Math.cos(latRad)));

  const latM = Math.pow(10, -dLat) * 111139.0 * radiusScale;
  const lngM = Math.pow(10, -dLng) * 111320.0 * cosLat * radiusScale;

  // The effective precision scale in meters (finer dimension)
  const precisionM = Math.min(latM, lngM);

  // Root tetrahedron edge span on sphere
  const rootEdgeM = 10915000.0 * radiusScale;
  const z = Math.ceil(Math.log2(rootEdgeM / precisionM));
  return Math.max(0, Math.min(28, z));
}

// --- Geodetic & Geocentric Conversions ---

/**
 * Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).
 * @param xyz The geocentric Cartesian coordinates [x, y, z].
 * @param applyEarthCurvature Whether to apply Earth curvature correction.
 * @returns A 2-element array containing longitude and latitude in degrees.
 */
export function geocentricToGeodetic(xyz: ArrayVector3D, applyEarthCurvature = true): ArrayVector2D {
  const x = xyz[0];
  const y = xyz[1];
  const z = xyz[2];
  const d2d = x * x + y * y;

  if (d2d === 0.0) {
    return [0.0, z > 0 ? 90.0 : -90.0];
  }

  const lngRad = Math.atan2(y, x);
  let latRad: number;

  if (applyEarthCurvature) {
    latRad = Math.atan2(z / INV_K, Math.sqrt(d2d));
  } else {
    latRad = Math.atan2(z, Math.sqrt(d2d));
  }

  return [(lngRad * 180.0) / Math.PI, (latRad * 180.0) / Math.PI];
}

/**
 * Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].
 * @param lngLat The geodetic GPS coordinates [longitude, latitude] in degrees.
 * @param applyEarthCurvature Whether to apply Earth curvature correction.
 * @returns A 3-element array containing unit Cartesian coordinates [x, y, z].
 */
export function geodeticToGeocentric(lngLat: ArrayVector2D, applyEarthCurvature = true): ArrayVector3D {
  const lng = lngLat[0];
  const lat = lngLat[1];

  if (lat >= 90.0) return [0.0, 0.0, 1.0];
  if (lat <= -90.0) return [0.0, 0.0, -1.0];

  const lngRad = (lng * Math.PI) / 180.0;
  const latRad = (lat * Math.PI) / 180.0;

  let latGeocentric: number;
  if (applyEarthCurvature) {
    latGeocentric = Math.atan2(INV_K * Math.sin(latRad), Math.cos(latRad));
  } else {
    latGeocentric = latRad;
  }

  const cosLat = Math.cos(latGeocentric);
  return [cosLat * Math.cos(lngRad), cosLat * Math.sin(lngRad), Math.sin(latGeocentric)];
}

// --- Vertices & Center Calculations ---

/**
 * Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.
 * @param id The T4 BigInt ID to get the vertices of.
 * @returns An array of 3 T4Object arrays representing the vertices of the cell.
 * @throws Error if the given id is not a valid T4 ID.
 */
export function getT4VerticesFlat(id: bigint): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || (id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const baseFace = Number((id >> 62n) & 3n);
  const faceVerts = BASE_FACES[baseFace];
  let Ax = faceVerts[0][0],
    Ay = faceVerts[0][1],
    Az = faceVerts[0][2];
  let Bx = faceVerts[1][0],
    By = faceVerts[1][1],
    Bz = faceVerts[1][2];
  let Cx = faceVerts[2][0],
    Cy = faceVerts[2][1],
    Cz = faceVerts[2][2];

  for (let d = 0; d < zoom; ++d) {
    const sub = Number((id >> SUB_SHIFTS[d]) & 3n);
    const MabX = (Ax + Bx) * 0.5,
      MabY = (Ay + By) * 0.5,
      MabZ = (Az + Bz) * 0.5;
    const MbcX = (Bx + Cx) * 0.5,
      MbcY = (By + Cy) * 0.5,
      MbcZ = (Bz + Cz) * 0.5;
    const McaX = (Cx + Ax) * 0.5,
      McaY = (Cy + Ay) * 0.5,
      McaZ = (Cz + Az) * 0.5;

    if (sub === 0) {
      Bx = MabX;
      By = MabY;
      Bz = MabZ;
      Cx = McaX;
      Cy = McaY;
      Cz = McaZ;
    } else if (sub === 1) {
      Ax = MabX;
      Ay = MabY;
      Az = MabZ;
      Cx = MbcX;
      Cy = MbcY;
      Cz = MbcZ;
    } else if (sub === 2) {
      Ax = McaX;
      Ay = McaY;
      Az = McaZ;
      Bx = MbcX;
      By = MbcY;
      Bz = MbcZ;
    } else if (sub === 3) {
      Ax = MbcX;
      Ay = MbcY;
      Az = MbcZ;
      Bx = McaX;
      By = McaY;
      Bz = McaZ;
      Cx = MabX;
      Cy = MabY;
      Cz = MabZ;
    }
  }

  return [
    [Ax, Ay, Az],
    [Bx, By, Bz],
    [Cx, Cy, Cz],
  ];
}

// --- Authalic Corner Warp & Inversion ---

/**
 * Applies the authalic corner warp to a value.
 * @param x The value to apply the warp to.
 * @returns The warped value.
 */
function authalicWarpG(xIn: number): number {
  const x = Math.max(1e-7, Math.min(1.0, xIn));
  const xc = x - 1.0 / 3.0;
  const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
  const sqrtX = Math.sqrt(x);
  return sqrtX * Math.sqrt(sqrtX) * poly;
}

interface AuthalicGInvResult {
  x: number;
  gPrime: number;
}

const G_INV_RESULT: AuthalicGInvResult = { x: 0.0, gPrime: 1.0 };

/**
 * Inverts the authalic corner warp.
 * @param y The warped value to invert.
 * @returns An object containing the original value and the derivative of the warp.
 */
function authalicWarpGInv(y: number): AuthalicGInvResult {
  if (y <= 0.0) {
    G_INV_RESULT.x = 0.0;
    G_INV_RESULT.gPrime = 1.0;
    return G_INV_RESULT;
  }

  // Initial estimate x0 = y^(4/3) = y * cbrt(y)
  let x = Math.max(1e-7, Math.min(1.0, y * Math.cbrt(y)));
  let gp = 1.0;

  for (let iter = 0; iter < 4; ++iter) {
    const xc = x - 1.0 / 3.0;
    const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
    const polyDeriv = -0.5 + 0.7 * xc + 0.9 * xc * xc;
    const sqrtX = Math.sqrt(x);
    const fourthRootX = Math.sqrt(sqrtX);
    const xPowGamma = sqrtX * fourthRootX;
    const xPowGammaMinus1 = 1.0 / fourthRootX;

    const gVal = xPowGamma * poly;
    gp = xPowGammaMinus1 * (0.75 * poly + x * polyDeriv);

    const diff = gVal - y;
    if (Math.abs(diff) < EPSILON12 || Math.abs(gp) < EPSILON12) {
      G_INV_RESULT.x = x;
      G_INV_RESULT.gPrime = gp > EPSILON12 ? gp : EPSILON12;
      return G_INV_RESULT;
    }

    const step = diff / gp;
    x = Math.max(1e-7, Math.min(1.0, x - step));
    if (Math.abs(step) < EPSILON12) {
      break;
    }
  }

  const xc = x - 1.0 / 3.0;
  const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
  const polyDeriv = -0.5 + 0.7 * xc + 0.9 * xc * xc;
  const sqrtX = Math.sqrt(x);
  const fourthRootX = Math.sqrt(sqrtX);
  const xPowGammaMinus1 = 1.0 / fourthRootX;
  gp = xPowGammaMinus1 * (0.75 * poly + x * polyDeriv);
  G_INV_RESULT.x = x;
  G_INV_RESULT.gPrime = gp < EPSILON12 ? EPSILON12 : gp;
  return G_INV_RESULT;
}

/**
 * Unwarps authalic corner values.
 * @param uIn The first warped authalic corner value.
 * @param vIn The second warped authalic corner value.
 * @param wIn The third warped authalic corner value.
 * @returns An array containing the three unwarped authalic corner values.
 */
function unwarpAuthalicCornerInternal(uIn: number, vIn: number, wIn: number): ArrayVector3D {
  const uw = Math.max(0.0, Math.min(1.0, uIn));
  const vw = Math.max(0.0, Math.min(1.0, vIn));
  const ww = Math.max(0.0, Math.min(1.0, wIn));

  const sumSq = uw * uw + vw * vw + ww * ww;
  let lambda = Math.max(0.8, Math.min(1.5, 1.316074 - 0.607444 * (sumSq - 1.0 / 3.0)));
  let lambdaLow = 0.5;
  let lambdaHigh = 2.0;

  let uf = 0.0,
    vf = 0.0,
    wf = 0.0;

  for (let iter = 0; iter < 5; ++iter) {
    authalicWarpGInv(lambda * uw);
    uf = G_INV_RESULT.x;
    const duRaw = G_INV_RESULT.gPrime;

    authalicWarpGInv(lambda * vw);
    vf = G_INV_RESULT.x;
    const dvRaw = G_INV_RESULT.gPrime;

    authalicWarpGInv(lambda * ww);
    wf = G_INV_RESULT.x;
    const dwRaw = G_INV_RESULT.gPrime;

    const F = uf + vf + wf - 1.0;
    if (Math.abs(F) < EPSILON12) {
      break;
    }

    if (F < 0.0) {
      if (lambda > lambdaLow) lambdaLow = lambda;
    } else {
      if (lambda < lambdaHigh) lambdaHigh = lambda;
    }

    const du = duRaw > EPSILON12 ? duRaw : EPSILON12;
    const dv = dvRaw > EPSILON12 ? dvRaw : EPSILON12;
    const dw = dwRaw > EPSILON12 ? dwRaw : EPSILON12;

    const FPrime = uw / du + vw / dv + ww / dw;
    if (FPrime > EPSILON12) {
      const nextLambda = lambda - F / FPrime;
      if (nextLambda > lambdaLow && nextLambda < lambdaHigh) {
        lambda = nextLambda;
      } else {
        lambda = Math.max(
          lambdaLow + 0.1 * (lambdaHigh - lambdaLow),
          Math.min(lambdaHigh - 0.1 * (lambdaHigh - lambdaLow), nextLambda),
        );
      }
    } else {
      lambda = 0.5 * (lambdaLow + lambdaHigh);
    }
  }

  const sum = uf + vf + wf;
  if (sum <= 1e-9) {
    return [uw, vw, ww];
  }
  let outU = uf / sum;
  let outV = vf / sum;
  let outW = wf / sum;

  if (Math.abs(uw - vw) < EPSILON14) {
    outU = outV = 0.5 * (outU + outV);
  }
  if (Math.abs(vw - ww) < EPSILON14) {
    outV = outW = 0.5 * (outV + outW);
  }
  if (Math.abs(ww - uw) < EPSILON14) {
    outW = outU = 0.5 * (outW + outU);
  }

  return [outU, outV, outW];
}

/**
 * Inverts the authalic corner warp on barycentric coordinates.
 * @param baryW The barycentric coordinates [u, v, w].
 * @returns An ArrayVector3D containing the three unwarped authalic corner values.
 */
export function unwarpAuthalicCorner(baryW: ArrayVector3D): ArrayVector3D {
  return unwarpAuthalicCornerInternal(baryW[0], baryW[1], baryW[2]);
}

/**
 * Get the barycentric coordinates of a point on a face.
 * @param qx The x-coordinate of the point.
 * @param qy The y-coordinate of the point.
 * @param qz The z-coordinate of the point.
 * @param face The face index.
 * @returns An ArrayVector3D containing the three barycentric coordinates [u, v, w].
 */
function getBarycentricFast(qx: number, qy: number, qz: number, face: number): ArrayVector3D {
  const fd = BASE_FACE_DATA[face];
  const v2x = qx - fd.Ax;
  const v2y = qy - fd.Ay;
  const v2z = qz - fd.Az;
  const d20 = v2x * fd.v0x + v2y * fd.v0y + v2z * fd.v0z;
  const d21 = v2x * fd.v1x + v2y * fd.v1y + v2z * fd.v1z;
  const v = (fd.d11 * d20 - fd.d01 * d21) * fd.invDenom;
  const w = (fd.d00 * d21 - fd.d01 * d20) * fd.invDenom;
  const u = 1.0 - v - w;
  return [u, v, w];
}

/**
 * Calculate the intersection of a ray with a face.
 * @param px The x-coordinate of the ray origin.
 * @param py The y-coordinate of the ray origin.
 * @param pz The z-coordinate of the ray origin.
 * @param face The face index.
 * @returns An object containing the hit status and the intersection point.
 */
function getRayFaceIntersectionFast(
  px: number,
  py: number,
  pz: number,
  face: number,
): { hit: boolean; x: number; y: number; z: number } {
  const fd = BASE_FACE_DATA[face];
  const denom = px * fd.nx + py * fd.ny + pz * fd.nz;
  if (denom <= EPSILON12) {
    return { hit: false, x: 0, y: 0, z: 0 };
  }
  const t = fd.D / denom;
  return { hit: true, x: px * t, y: py * t, z: pz * t };
}

/**
 * Projects a flat point on a tetrahedron base face using the authalic corner warp.
 * @param flatPt The point to project.
 * @param baseFaceIndex The base face index.
 * @returns The projected point.
 */
export function projectAuthalicCornerWarp(flatPt: ArrayVector3D, baseFaceIndex: number): ArrayVector3D {
  if (baseFaceIndex < 0 || baseFaceIndex > 3 || !Number.isInteger(baseFaceIndex)) {
    throw new Error("Base face index must be an integer between 0 and 3");
  }

  const faceIdx = baseFaceIndex;
  const A = BASE_FACES[faceIdx][0];
  const B = BASE_FACES[faceIdx][1];
  const C = BASE_FACES[faceIdx][2];

  const bary = getBarycentricFast(flatPt[0], flatPt[1], flatPt[2], faceIdx);
  const u = Math.max(0.0, Math.min(1.0, bary[0]));
  const v = Math.max(0.0, Math.min(1.0, bary[1]));
  const w = Math.max(0.0, Math.min(1.0, bary[2]));

  const fu = authalicWarpG(u);
  const fv = authalicWarpG(v);
  const fw = authalicWarpG(w);

  const sum = fu + fv + fw;
  if (sum <= 1e-9) {
    return normalize3D(flatPt);
  }

  const px = (fu * A[0] + fv * B[0] + fw * C[0]) / sum;
  const py = (fu * A[1] + fv * B[1] + fw * C[1]) / sum;
  const pz = (fu * A[2] + fv * B[2] + fw * C[2]) / sum;

  const len = Math.hypot(px, py, pz);
  return len === 0 ? [0, 0, 0] : [px / len, py / len, pz / len];
}

/**
 * Gets the 3D vertices of the T4 cell normalized to the sphere surface of radiusKm.
 * @param id The T4 ID of the cell.
 * @param radiusKm The radius of the sphere in kilometers.
 * @param options Optional T4 options.
 * @returns An array containing the three 3D vertices of the cell.
 */
export function getT4Vertices3D(
  id: bigint,
  radiusKm = DEFAULT_RADIUS_KM,
  options?: T4Options,
): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  const baseFace = Number((id >> 62n) & 3n);
  const [A, B, C] = getT4VerticesFlat(id);
  const authalic = options?.authalicWarp ?? true;

  if (authalic) {
    const pA = projectAuthalicCornerWarp(A, baseFace);
    const pB = projectAuthalicCornerWarp(B, baseFace);
    const pC = projectAuthalicCornerWarp(C, baseFace);
    return [
      [pA[0] * radiusKm, pA[1] * radiusKm, pA[2] * radiusKm],
      [pB[0] * radiusKm, pB[1] * radiusKm, pB[2] * radiusKm],
      [pC[0] * radiusKm, pC[1] * radiusKm, pC[2] * radiusKm],
    ];
  }

  const nA = normalize3D(A);
  const nB = normalize3D(B);
  const nC = normalize3D(C);
  return [
    [nA[0] * radiusKm, nA[1] * radiusKm, nA[2] * radiusKm],
    [nB[0] * radiusKm, nB[1] * radiusKm, nB[2] * radiusKm],
    [nC[0] * radiusKm, nC[1] * radiusKm, nC[2] * radiusKm],
  ];
}

/**
 * Gets the center point of the T4 cell on the sphere surface of radiusKm.
 * @param id The T4 ID of the cell.
 * @param radiusKm The radius of the sphere in kilometers.
 * @param options Optional T4 options.
 * @returns The center point of the cell.
 */
export function getT4Center3D(id: bigint, radiusKm = DEFAULT_RADIUS_KM, options?: T4Options): ArrayVector3D {
  const baseFace = Number((id >> 62n) & 3n);
  const [A, B, C] = getT4VerticesFlat(id);
  const centerFlat: ArrayVector3D = [
    (A[0] + B[0] + C[0]) / 3.0,
    (A[1] + B[1] + C[1]) / 3.0,
    (A[2] + B[2] + C[2]) / 3.0,
  ];
  const authalic = options?.authalicWarp ?? true;

  if (authalic) {
    const pCenter = projectAuthalicCornerWarp(centerFlat, baseFace);
    return [pCenter[0] * radiusKm, pCenter[1] * radiusKm, pCenter[2] * radiusKm];
  }

  const nCenter = normalize3D(centerFlat);
  return [nCenter[0] * radiusKm, nCenter[1] * radiusKm, nCenter[2] * radiusKm];
}

/**
 * Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.
 * @param id The T4 ID of the cell.
 * @param options Optional T4 options or boolean for applyEarthCurvature.
 * @returns An array containing the three 2D vertices of the cell.
 */
export function getT4Vertices(
  id: bigint,
  options?: T4Options | boolean,
): [ArrayVector2D, ArrayVector2D, ArrayVector2D] {
  const applyEarthCurvature = typeof options === "boolean" ? options : (options?.applyEarthCurvature ?? true);
  const authalic = typeof options === "boolean" ? true : (options?.authalicWarp ?? true);
  const baseFace = Number((id >> 62n) & 3n);

  const [A, B, C] = getT4VerticesFlat(id);

  const pA = authalic ? projectAuthalicCornerWarp(A, baseFace) : normalize3D(A);
  const pB = authalic ? projectAuthalicCornerWarp(B, baseFace) : normalize3D(B);
  const pC = authalic ? projectAuthalicCornerWarp(C, baseFace) : normalize3D(C);

  return [
    geocentricToGeodetic(pA, applyEarthCurvature),
    geocentricToGeodetic(pB, applyEarthCurvature),
    geocentricToGeodetic(pC, applyEarthCurvature),
  ];
}

/**
 * Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.
 */
export function getT4Center(id: bigint, options?: T4Options | boolean): ArrayVector2D {
  const applyEarthCurvature = typeof options === "boolean" ? options : (options?.applyEarthCurvature ?? true);
  const center3D = getT4Center3D(id, 1.0, typeof options === "object" ? options : undefined);
  return geocentricToGeodetic(center3D, applyEarthCurvature);
}

// --- Face Selection & Cartesian to T4 ---

interface FaceFindResult {
  face: number;
  u: number;
  v: number;
  w: number;
}

const FACE_FIND_RESULT: FaceFindResult = { face: 0, u: 0, v: 0, w: 0 };

/**
 * Finds the face that contains the given point and the barycentric coordinates of the point on that face.
 * @param px The x-coordinate of the point.
 * @param py The y-coordinate of the point.
 * @param pz The z-coordinate of the point.
 * @returns The face index and barycentric coordinates of the point.
 * @throws Error if the point could not be projected onto the tetrahedron.
 */
function findBestFace(px: number, py: number, pz: number): FaceFindResult {
  // Outward face normals dot products: -v3, -v1, -v2, -v0
  const d0 = px * SQRT2_9 + py * SQRT2_3 + pz * (1.0 / 3.0);
  const d1 = -px * SQRT8_9 + pz * (1.0 / 3.0);
  const d2 = px * SQRT2_9 - py * SQRT2_3 + pz * (1.0 / 3.0);
  const d3 = -pz;

  let bestFace = 0;
  let maxD = d0;
  if (d1 > maxD + EPSILON12) {
    maxD = d1;
    bestFace = 1;
  }
  if (d2 > maxD + EPSILON12) {
    maxD = d2;
    bestFace = 2;
  }
  if (d3 > maxD + EPSILON12) {
    maxD = d3;
    bestFace = 3;
  }

  const fd = BASE_FACE_DATA[bestFace];
  const denom = px * fd.nx + py * fd.ny + pz * fd.nz;
  if (denom > EPSILON12) {
    const t = fd.D / denom;
    const qx = px * t;
    const qy = py * t;
    const qz = pz * t;
    const v2x = qx - fd.Ax;
    const v2y = qy - fd.Ay;
    const v2z = qz - fd.Az;
    const d20 = v2x * fd.v0x + v2y * fd.v0y + v2z * fd.v0z;
    const d21 = v2x * fd.v1x + v2y * fd.v1y + v2z * fd.v1z;
    const v = (fd.d11 * d20 - fd.d01 * d21) * fd.invDenom;
    const w = (fd.d00 * d21 - fd.d01 * d20) * fd.invDenom;
    const u = 1.0 - v - w;

    if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4) {
      let cu = u > 0.0 ? u : 0.0;
      let cv = v > 0.0 ? v : 0.0;
      let cw = w > 0.0 ? w : 0.0;
      const s = cu + cv + cw;
      if (s > 1e-9) {
        cu /= s;
        cv /= s;
        cw /= s;
      }
      FACE_FIND_RESULT.face = bestFace;
      FACE_FIND_RESULT.u = cu;
      FACE_FIND_RESULT.v = cv;
      FACE_FIND_RESULT.w = cw;
      return FACE_FIND_RESULT;
    }
  }

  // Fallback: search all faces if boundary precision required it
  let bestScore = -Infinity;
  let fallbackFace = -1;
  let bestU = 0.0,
    bestV = 0.0,
    bestW = 0.0;

  for (let i = 0; i < 4; ++i) {
    const fdi = BASE_FACE_DATA[i];
    const denomi = px * fdi.nx + py * fdi.ny + pz * fdi.nz;
    if (denomi <= EPSILON12) continue;

    const ti = fdi.D / denomi;
    const qx = px * ti;
    const qy = py * ti;
    const qz = pz * ti;
    const v2x = qx - fdi.Ax;
    const v2y = qy - fdi.Ay;
    const v2z = qz - fdi.Az;
    const d20 = v2x * fdi.v0x + v2y * fdi.v0y + v2z * fdi.v0z;
    const d21 = v2x * fdi.v1x + v2y * fdi.v1y + v2z * fdi.v1z;
    const v = (fdi.d11 * d20 - fdi.d01 * d21) * fdi.invDenom;
    const w = (fdi.d00 * d21 - fdi.d01 * d20) * fdi.invDenom;
    const u = 1.0 - v - w;

    const score = Math.min(u, v, w);
    if (score >= 0.0) {
      FACE_FIND_RESULT.face = i;
      FACE_FIND_RESULT.u = u;
      FACE_FIND_RESULT.v = v;
      FACE_FIND_RESULT.w = w;
      return FACE_FIND_RESULT;
    }
    if (score > bestScore + EPSILON12) {
      bestScore = score;
      fallbackFace = i;
      bestU = u;
      bestV = v;
      bestW = w;
    }
  }

  if (fallbackFace === -1) {
    throw new Error("Point could not be projected onto the tetrahedron");
  }

  FACE_FIND_RESULT.face = fallbackFace;
  FACE_FIND_RESULT.u = bestU;
  FACE_FIND_RESULT.v = bestV;
  FACE_FIND_RESULT.w = bestW;
  return FACE_FIND_RESULT;
}

/**
 * Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.
 * @param P The geocentric unit vector to project.
 * @param zoom The zoom level.
 * @param options Optional T4 options.
 * @returns The T4 ID of the cell.
 * @throws Error if the vector is invalid or zoom is out of range.
 */
export function cartesianToT4(P: ArrayVector3D, zoom: number, options?: T4Options): bigint {
  if (!P || P.length < 3 || !Number.isFinite(P[0]) || !Number.isFinite(P[1]) || !Number.isFinite(P[2])) {
    throw new Error("Invalid 3D vector");
  }
  if (zoom < 0 || zoom > 28 || !Number.isInteger(zoom)) {
    throw new Error("Zoom must be an integer between 0 and 28");
  }

  const best = findBestFace(P[0], P[1], P[2]);
  const authalic = options?.authalicWarp ?? true;

  let u = best.u;
  let v = best.v;
  let w = best.w;

  if (authalic) {
    const unwarped = unwarpAuthalicCornerInternal(u, v, w);
    u = unwarped[0];
    v = unwarped[1];
    w = unwarped[2];
  }

  let subId = 0n;

  for (let step = 0; step < zoom; ++step) {
    let s: number;
    if (u >= 0.5) {
      s = 0;
      u = 2.0 * u - 1.0;
      v = 2.0 * v;
      w = 2.0 * w;
    } else if (v >= 0.5) {
      s = 1;
      u = 2.0 * u;
      v = 2.0 * v - 1.0;
      w = 2.0 * w;
    } else if (w >= 0.5) {
      s = 2;
      u = 2.0 * u;
      v = 2.0 * v;
      w = 2.0 * w - 1.0;
    } else {
      s = 3;
      u = 1.0 - 2.0 * u;
      v = 1.0 - 2.0 * v;
      w = 1.0 - 2.0 * w;
    }
    subId |= BIGINT_SUBS[s] << SUB_SHIFTS[step];
  }

  let id = BIGINT_FACES[best.face];
  id |= subId;
  id |= VALID_FLAG | ZOOM_BIGINTS[zoom];
  return id;
}

/**
 * Converts GPS coordinates (latitude, longitude in degrees) to a T4 ID.
 *
 * @param lat Latitude in degrees [-90, 90]
 * @param lng Longitude in degrees [-180, 180]
 * @param zoom Zoom level [0, 28]
 * @param options Optional T4 configuration
 * @returns The T4 ID of the cell.
 * @throws Error if the latitude or longitude is invalid or zoom is out of range.
 */
export function latLngToT4(lat: number, lng: number, zoom: number, options?: T4Options): bigint {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("Latitude must be a valid number between -90 and 90 degrees");
  }
  if (!Number.isFinite(lng)) {
    throw new Error("Longitude must be a valid number");
  }
  if (zoom < 0 || zoom > 28 || !Number.isInteger(zoom)) {
    throw new Error("Zoom must be an integer between 0 and 28");
  }

  let px: number, py: number, pz: number;
  if (lat >= 90.0) {
    px = 0.0;
    py = 0.0;
    pz = 1.0;
  } else if (lat <= -90.0) {
    px = 0.0;
    py = 0.0;
    pz = -1.0;
  } else {
    const applyEarthCurvature = options?.applyEarthCurvature ?? true;
    const lngRad = (lng * Math.PI) / 180.0;
    const latRad = (lat * Math.PI) / 180.0;
    const latGeocentric = applyEarthCurvature ? Math.atan2(INV_K * Math.sin(latRad), Math.cos(latRad)) : latRad;
    const cosLat = Math.cos(latGeocentric);
    px = cosLat * Math.cos(lngRad);
    py = cosLat * Math.sin(lngRad);
    pz = Math.sin(latGeocentric);
  }

  const best = findBestFace(px, py, pz);
  const authalic = options?.authalicWarp ?? true;

  let u = best.u;
  let v = best.v;
  let w = best.w;

  if (authalic) {
    const unwarped = unwarpAuthalicCornerInternal(u, v, w);
    u = unwarped[0];
    v = unwarped[1];
    w = unwarped[2];
  }

  let subId = 0n;
  for (let step = 0; step < zoom; ++step) {
    let s: number;
    if (u >= 0.5) {
      s = 0;
      u = 2.0 * u - 1.0;
      v = 2.0 * v;
      w = 2.0 * w;
    } else if (v >= 0.5) {
      s = 1;
      u = 2.0 * u;
      v = 2.0 * v - 1.0;
      w = 2.0 * w;
    } else if (w >= 0.5) {
      s = 2;
      u = 2.0 * u;
      v = 2.0 * v;
      w = 2.0 * w - 1.0;
    } else {
      s = 3;
      u = 1.0 - 2.0 * u;
      v = 1.0 - 2.0 * v;
      w = 1.0 - 2.0 * w;
    }
    subId |= BIGINT_SUBS[s] << SUB_SHIFTS[step];
  }

  return BIGINT_FACES[best.face] | subId | VALID_FLAG | ZOOM_BIGINTS[zoom];
}

/**
 * Converts a 2D GPS coordinate vector [lng, lat] (GeoJSON [x, y] convention) to a T4 ID.
 *
 * @param lngLat 2D array vector [longitude, latitude] in degrees
 * @param zoom Zoom level [0, 28]
 * @param options Optional T4 configuration
 * @returns The T4 ID of the cell.
 * @throws Error if the latitude or longitude is invalid or zoom is out of range.
 */
export function lngLatToT4(lngLat: ArrayVector2D, zoom: number, options?: T4Options): bigint {
  if (!lngLat || lngLat.length < 2) {
    throw new Error("Invalid 2D coordinate array: expected [lng, lat]");
  }
  return latLngToT4(lngLat[1], lngLat[0], zoom, options);
}

// --- Topology & Neighbors via Discrete Triangular Coordinates (TriCoord) ---

interface TriCoord {
  i: number;
  j: number;
  k: number;
  up: number;
}

const TRI_COORD_RESULT: TriCoord = { i: 0, j: 0, k: 0, up: 1 };

/**
 * Converts a T4 ID to triangular coordinates.
 * @param id The T4 ID of the cell.
 * @param zoom The zoom level.
 * @returns The triangular coordinates of the cell.
 */
function t4IdToTriCoord(id: bigint, zoom: number): TriCoord {
  let i = 0;
  let j = 0;
  let k = 0;
  let up = 1;

  for (let d = 0; d < zoom; ++d) {
    const s = Number((id >> SUB_SHIFTS[d]) & 3n);
    if (up) {
      if (s === 0) {
        i = (i << 1) | 1;
        j = j << 1;
        k = k << 1;
      } else if (s === 1) {
        i = i << 1;
        j = (j << 1) | 1;
        k = k << 1;
      } else if (s === 2) {
        i = i << 1;
        j = j << 1;
        k = (k << 1) | 1;
      } else {
        i = i << 1;
        j = j << 1;
        k = k << 1;
        up = 0;
      }
    } else {
      if (s === 0) {
        i = i << 1;
        j = (j << 1) | 1;
        k = (k << 1) | 1;
      } else if (s === 1) {
        i = (i << 1) | 1;
        j = j << 1;
        k = (k << 1) | 1;
      } else if (s === 2) {
        i = (i << 1) | 1;
        j = (j << 1) | 1;
        k = k << 1;
      } else {
        i = (i << 1) | 1;
        j = (j << 1) | 1;
        k = (k << 1) | 1;
        up = 1;
      }
    }
  }

  TRI_COORD_RESULT.i = i;
  TRI_COORD_RESULT.j = j;
  TRI_COORD_RESULT.k = k;
  TRI_COORD_RESULT.up = up;
  return TRI_COORD_RESULT;
}

/**
 * Converts triangular coordinates to a T4 ID.
 * @param baseFace The base face of the tetrahedron.
 * @param tcI The i coordinate.
 * @param tcJ The j coordinate.
 * @param tcK The k coordinate.
 * @param zoom The zoom level.
 * @returns The T4 ID of the cell.
 */
function triCoordToT4Id(baseFace: number, tcI: number, tcJ: number, tcK: number, zoom: number): bigint {
  let subId = 0n;
  let up = 1;
  let i = tcI;
  let j = tcJ;
  let k = tcK;

  for (let d = 0; d < zoom; ++d) {
    const m = 1 << (zoom - 1 - d);
    let s = 0;
    if (up) {
      if (i >= m) {
        s = 0;
        i -= m;
      } else if (j >= m) {
        s = 1;
        j -= m;
      } else if (k >= m) {
        s = 2;
        k -= m;
      } else {
        s = 3;
        up = 0;
      }
    } else {
      if (i < m) {
        s = 0;
        j -= m;
        k -= m;
      } else if (j < m) {
        s = 1;
        i -= m;
        k -= m;
      } else if (k < m) {
        s = 2;
        i -= m;
        j -= m;
      } else {
        s = 3;
        i -= m;
        j -= m;
        k -= m;
        up = 1;
      }
    }
    subId |= BIGINT_SUBS[s] << SUB_SHIFTS[d];
  }

  let id = BIGINT_FACES[baseFace];
  id |= subId;
  id |= VALID_FLAG | ZOOM_BIGINTS[zoom];
  return id;
}

interface BoundaryMapping {
  targetFace: number;
  iSrc: number;
  jSrc: number;
  kSrc: number;
}

// BASE_FACE_ADJACENCY[baseFace][edge (0: k<0, 1: i<0, 2: j<0)]
const BASE_FACE_ADJACENCY: BoundaryMapping[][] = [
  // Face 0: {v0, v1, v2}
  [
    { targetFace: 2, iSrc: 0, jSrc: -1, kSrc: 1 }, // Edge 0 (k<0, v0-v1): Face 2, (i, 0, j)
    { targetFace: 3, iSrc: 1, jSrc: -1, kSrc: 2 }, // Edge 1 (i<0, v1-v2): Face 3, (j, 0, k)
    { targetFace: 1, iSrc: 0, jSrc: 2, kSrc: -1 }, // Edge 2 (j<0, v2-v0): Face 1, (i, k, 0)
  ],
  // Face 1: {v0, v2, v3}
  [
    { targetFace: 0, iSrc: 0, jSrc: -1, kSrc: 1 }, // Edge 0 (k<0, v0-v2): Face 0, (i, 0, j)
    { targetFace: 3, iSrc: -1, jSrc: 2, kSrc: 1 }, // Edge 1 (i<0, v2-v3): Face 3, (0, k, j)
    { targetFace: 2, iSrc: 0, jSrc: 2, kSrc: -1 }, // Edge 2 (j<0, v3-v0): Face 2, (i, k, 0)
  ],
  // Face 2: {v0, v3, v1}
  [
    { targetFace: 1, iSrc: 0, jSrc: -1, kSrc: 1 }, // Edge 0 (k<0, v0-v3): Face 1, (i, 0, j)
    { targetFace: 3, iSrc: 2, jSrc: 1, kSrc: -1 }, // Edge 1 (i<0, v3-v1): Face 3, (k, j, 0)
    { targetFace: 0, iSrc: 0, jSrc: 2, kSrc: -1 }, // Edge 2 (j<0, v1-v0): Face 0, (i, k, 0)
  ],
  // Face 3: {v1, v3, v2}
  [
    { targetFace: 2, iSrc: -1, jSrc: 1, kSrc: 0 }, // Edge 0 (k<0, v1-v3): Face 2, (0, j, i)
    { targetFace: 1, iSrc: -1, jSrc: 2, kSrc: 1 }, // Edge 1 (i<0, v3-v2): Face 1, (0, k, j)
    { targetFace: 0, iSrc: -1, jSrc: 0, kSrc: 2 }, // Edge 2 (j<0, v2-v1): Face 0, (0, i, k)
  ],
];

/**
 * Gets the 3 neighbor T4 IDs sharing the edges of the cell using discrete TriCoord arithmetic.
 * @param id The T4 ID of the cell.
 * @returns An array containing the three neighbor T4 IDs.
 * @throws Error if the T4 ID is invalid.
 */
export function getT4Neighbors(id: bigint): [bigint, bigint, bigint] {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || (id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }
  const baseFace = Number((id >> 62n) & 3n);
  const tc = t4IdToTriCoord(id, zoom);

  if (tc.up) {
    // Edge 0: across AB (k decreases)
    let n0: bigint;
    if (tc.k > 0) {
      n0 = triCoordToT4Id(baseFace, tc.i, tc.j, tc.k - 1, zoom);
    } else {
      const adj = BASE_FACE_ADJACENCY[baseFace][0];
      const ni = adj.iSrc === 0 ? tc.i : adj.iSrc === 1 ? tc.j : adj.iSrc === 2 ? tc.k : 0;
      const nj = adj.jSrc === 0 ? tc.i : adj.jSrc === 1 ? tc.j : adj.jSrc === 2 ? tc.k : 0;
      const nk = adj.kSrc === 0 ? tc.i : adj.kSrc === 1 ? tc.j : adj.kSrc === 2 ? tc.k : 0;
      n0 = triCoordToT4Id(adj.targetFace, ni, nj, nk, zoom);
    }

    // Edge 1: across BC (i decreases)
    let n1: bigint;
    if (tc.i > 0) {
      n1 = triCoordToT4Id(baseFace, tc.i - 1, tc.j, tc.k, zoom);
    } else {
      const adj = BASE_FACE_ADJACENCY[baseFace][1];
      const ni = adj.iSrc === 0 ? tc.i : adj.iSrc === 1 ? tc.j : adj.iSrc === 2 ? tc.k : 0;
      const nj = adj.jSrc === 0 ? tc.i : adj.jSrc === 1 ? tc.j : adj.jSrc === 2 ? tc.k : 0;
      const nk = adj.kSrc === 0 ? tc.i : adj.kSrc === 1 ? tc.j : adj.kSrc === 2 ? tc.k : 0;
      n1 = triCoordToT4Id(adj.targetFace, ni, nj, nk, zoom);
    }

    // Edge 2: across CA (j decreases)
    let n2: bigint;
    if (tc.j > 0) {
      n2 = triCoordToT4Id(baseFace, tc.i, tc.j - 1, tc.k, zoom);
    } else {
      const adj = BASE_FACE_ADJACENCY[baseFace][2];
      const ni = adj.iSrc === 0 ? tc.i : adj.iSrc === 1 ? tc.j : adj.iSrc === 2 ? tc.k : 0;
      const nj = adj.jSrc === 0 ? tc.i : adj.jSrc === 1 ? tc.j : adj.jSrc === 2 ? tc.k : 0;
      const nk = adj.kSrc === 0 ? tc.i : adj.kSrc === 1 ? tc.j : adj.kSrc === 2 ? tc.k : 0;
      n2 = triCoordToT4Id(adj.targetFace, ni, nj, nk, zoom);
    }

    return [n0, n1, n2];
  } else {
    // Downward triangle: all 3 neighbors are inside the base face and upward
    return [
      triCoordToT4Id(baseFace, tc.i, tc.j, tc.k + 1, zoom),
      triCoordToT4Id(baseFace, tc.i + 1, tc.j, tc.k, zoom),
      triCoordToT4Id(baseFace, tc.i, tc.j + 1, tc.k, zoom),
    ];
  }
}

// --- Spherical Cell Area ---

/**
 * Calculates the spherical surface area of the cell in square kilometers ($km^2$).
 * @param id The T4 ID of the cell.
 * @param options Optional T4 options.
 * @returns The surface area of the cell in square kilometers.
 * @throws Error if the T4 ID is invalid.
 */
export function getT4CellArea(id: bigint, options?: T4Options): number {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || (id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const [A, B, C] = getT4VerticesFlat(id);
  const radiusKm = options?.radiusKm ?? DEFAULT_RADIUS_KM;
  const authalic = options?.authalicWarp ?? true;
  const baseFace = authalic ? Number((id >> 62n) & 3n) : 0;

  const uA = authalic ? projectAuthalicCornerWarp(A, baseFace) : normalize3D(A);
  const uB = authalic ? projectAuthalicCornerWarp(B, baseFace) : normalize3D(B);
  const uC = authalic ? projectAuthalicCornerWarp(C, baseFace) : normalize3D(C);

  const nABx = uA[1] * uB[2] - uA[2] * uB[1];
  const nABy = uA[2] * uB[0] - uA[0] * uB[2];
  const nABz = uA[0] * uB[1] - uA[1] * uB[0];

  const nBCx = uB[1] * uC[2] - uB[2] * uC[1];
  const nBCy = uB[2] * uC[0] - uB[0] * uC[2];
  const nBCz = uB[0] * uC[1] - uB[1] * uC[0];

  const nCAx = uC[1] * uA[2] - uC[2] * uA[1];
  const nCAy = uC[2] * uA[0] - uC[0] * uA[2];
  const nCAz = uC[0] * uA[1] - uC[1] * uA[0];

  const lenAB = Math.hypot(nABx, nABy, nABz);
  const lenBC = Math.hypot(nBCx, nBCy, nBCz);
  const lenCA = Math.hypot(nCAx, nCAy, nCAz);

  if (lenAB < EPSILON12 || lenBC < EPSILON12 || lenCA < EPSILON12) {
    const d1x = uB[0] - uA[0],
      d1y = uB[1] - uA[1],
      d1z = uB[2] - uA[2];
    const d2x = uC[0] - uA[0],
      d2y = uC[1] - uA[1],
      d2z = uC[2] - uA[2];
    const cx = d1y * d2z - d1z * d2y;
    const cy = d1z * d2x - d1x * d2z;
    const cz = d1x * d2y - d1y * d2x;
    const planarArea = 0.5 * Math.hypot(cx, cy, cz);
    return radiusKm * radiusKm * planarArea;
  }

  const unABx = nABx / lenAB,
    unABy = nABy / lenAB,
    unABz = nABz / lenAB;
  const unBCx = nBCx / lenBC,
    unBCy = nBCy / lenBC,
    unBCz = nBCz / lenBC;
  const unCAx = nCAx / lenCA,
    unCAy = nCAy / lenCA,
    unCAz = nCAz / lenCA;

  const cosAlpha = Math.max(-1.0, Math.min(1.0, -(unABx * unCAx + unABy * unCAy + unABz * unCAz)));
  const cosBeta = Math.max(-1.0, Math.min(1.0, -(unBCx * unABx + unBCy * unABy + unBCz * unABz)));
  const cosGamma = Math.max(-1.0, Math.min(1.0, -(unCAx * unBCx + unCAy * unBCy + unCAz * unBCz)));

  const alpha = Math.acos(cosAlpha);
  const beta = Math.acos(cosBeta);
  const gamma = Math.acos(cosGamma);

  const sphericalExcess = alpha + beta + gamma - Math.PI;
  if (sphericalExcess <= EPSILON12) {
    const d1x = uB[0] - uA[0],
      d1y = uB[1] - uA[1],
      d1z = uB[2] - uA[2];
    const d2x = uC[0] - uA[0],
      d2y = uC[1] - uA[1],
      d2z = uC[2] - uA[2];
    const cx = d1y * d2z - d1z * d2y;
    const cy = d1z * d2x - d1x * d2z;
    const cz = d1x * d2y - d1y * d2x;
    const planarArea = 0.5 * Math.hypot(cx, cy, cz);
    return radiusKm * radiusKm * planarArea;
  }

  return radiusKm * radiusKm * sphericalExcess;
}

// --- OOP Wrapper & Memoized Factory ---

/**
 * Standard OOP wrapper and memoized factory for T4 cells.
 * This function creates a T4 cell object from a T4 ID or configuration.
 * @param idOrPath The T4 ID or configuration.
 * @param options Optional T4 options.
 * @returns A T4 cell object.
 * @throws Error if the configuration is invalid.
 */
export function createT4(idOrPath: bigint | number[], options?: T4Options): T4Cell {
  const radiusKm = options?.radiusKm ?? DEFAULT_RADIUS_KM;
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const authalicWarp = options?.authalicWarp ?? true;

  let id: bigint;
  if (typeof idOrPath === "bigint") {
    id = idOrPath;
  } else if (Array.isArray(idOrPath)) {
    id = createT4Id(idOrPath);
  } else {
    throw new Error("Invalid T4 ID or path");
  }

  const optKey = getOptionsKey(radiusKm, applyEarthCurvature, authalicWarp);
  let subMap = optionsCache.get(optKey);
  if (!subMap) {
    subMap = new Map<bigint, WeakRef<T4Cell>>();
    optionsCache.set(optKey, subMap);
  }

  const cachedRef = subMap.get(id);
  if (cachedRef) {
    const cached = cachedRef.deref();
    if (cached) return cached;
  }

  const parsed = parseT4Id(id);
  if (!parsed.isValid) {
    throw new Error("Invalid T4 ID");
  }

  const obj: T4Cell = {
    get id() {
      return id;
    },
    get zoom() {
      return parsed.zoom;
    },
    get radiusKm() {
      return radiusKm;
    },
    get applyEarthCurvature() {
      return applyEarthCurvature;
    },
    get authalicWarp() {
      return authalicWarp;
    },
    get vertices3D() {
      return getT4Vertices3D(id, radiusKm, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get center3D() {
      return getT4Center3D(id, radiusKm, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get vertices() {
      return getT4Vertices(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get center() {
      return getT4Center(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get vertices2D() {
      return this.vertices;
    },
    get center2D() {
      return this.center;
    },
    get area() {
      return getT4CellArea(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get parent() {
      const parentId = getParentT4Id(id);
      if (parentId === null) return null;
      return createT4(parentId, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
      });
    },
    get neighbors(): [T4Cell, T4Cell, T4Cell] {
      const neighborIds = getT4Neighbors(id);
      return [
        createT4(neighborIds[0], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
        createT4(neighborIds[1], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
        createT4(neighborIds[2], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
      ];
    },
    get children(): [T4Cell, T4Cell, T4Cell, T4Cell] {
      const childIds = getT4Children(id);
      return [
        createT4(childIds[0], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
        createT4(childIds[1], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
        createT4(childIds[2], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
        createT4(childIds[3], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
        }),
      ];
    },
    get childIds(): [bigint, bigint, bigint, bigint] {
      return getT4Children(id);
    },
    isDescendantOf(parent: T4Cell | bigint): boolean {
      const parentId = typeof parent === "bigint" ? parent : parent.id;
      return isT4Descendant(id, parentId);
    },
  };

  subMap.set(id, new WeakRef(obj));
  cacheFinalizer.register(obj, { optionsKey: optKey, id });
  return obj;
}
