import { add3D, subtract3D, multiply3D, divide3D, normalize3D, dot3D, cross3D } from "@fimbul-works/vec/3d";
import type { ArrayVector3D } from "@fimbul-works/vec/3d";
import type { ArrayVector2D } from "@fimbul-works/vec/2d";

// WGS84 flattening factor for Earth
const F_EARTH = 1 / 298.257223563;

// Regular tetrahedron vertices on unit sphere centered at origin
const sqrt8_9 = Math.sqrt(8 / 9);
const sqrt2_9 = Math.sqrt(2 / 9);
const sqrt2_3 = Math.sqrt(2 / 3);

const v0: ArrayVector3D = [0, 0, 1];
const v1: ArrayVector3D = [sqrt8_9, 0, -1 / 3];
const v2: ArrayVector3D = [-sqrt2_9, sqrt2_3, -1 / 3];
const v3: ArrayVector3D = [-sqrt2_9, -sqrt2_3, -1 / 3];

// 4 base faces of the tetrahedron (ordered CCW from outside)
const BASE_FACES: [ArrayVector3D, ArrayVector3D, ArrayVector3D][] = [
  [v0, v1, v2], // Face 0
  [v0, v2, v3], // Face 1
  [v0, v3, v1], // Face 2
  [v1, v3, v2], // Face 3
];

// Outward unit normals of each base face. For a regular tetrahedron
// centered at the origin, each face's outward normal points opposite
// to its missing vertex, and is already unit-length because the four
// vertices lie on the unit sphere. Used to find which face a ray exits
// through in O(4) dot products instead of four ray-plane + barycentric
// solves.
const FACE_NORMALS: ArrayVector3D[] = [
  [-v3[0], -v3[1], -v3[2]], // Face 0 (v0,v1,v2) — opposite v3
  [-v1[0], -v1[1], -v1[2]], // Face 1 (v0,v2,v3) — opposite v1
  [-v2[0], -v2[1], -v2[2]], // Face 2 (v0,v3,v1) — opposite v2
  [-v0[0], -v0[1], -v0[2]], // Face 3 (v1,v3,v2) — opposite v0
];

export interface T4Options {
  radiusKm?: number;
  applyEarthCurvature?: boolean;
}

export interface T4Object {
  readonly id: bigint;
  readonly zoom: number;
  readonly radiusKm: number;
  readonly applyEarthCurvature: boolean;
  readonly vertices: [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  readonly center: ArrayVector2D;
  readonly vertices3D: [ArrayVector3D, ArrayVector3D, ArrayVector3D];
  readonly center3D: ArrayVector3D;
  readonly parent: T4Object | null;
  readonly neighbors: [T4Object, T4Object, T4Object];
  readonly children: [T4Object, T4Object, T4Object, T4Object];
  getChildren(): [T4Object, T4Object, T4Object, T4Object];
  readonly childIds: [bigint, bigint, bigint, bigint];
}

// Instance cache to reuse T4Object instances (using WeakRefs to prevent leaks).
// Keyed by id + options so Earth and Mars variants of the same cell don't
// evict each other: a cache miss for one radius must not overwrite a live
// entry for another. The FinalizationRegistry below drops the entry once the
// cached object is garbage-collected, so the map can't grow unbounded in
// long-running processes indexing many distinct cells.
const instanceCache = new Map<string, WeakRef<T4Object>>();

// Deletes cache entries once their T4Object is GC'd. The token captured at
// registration is the composite cache key, so we can remove the exact entry
// without holding a reference to the object (which would defeat the WeakRef).
const cacheFinalizer = new FinalizationRegistry((key: string) => {
  const ref = instanceCache.get(key);
  // Only delete if the entry hasn't already been reused for a newer object.
  if (ref && !ref.deref()) instanceCache.delete(key);
});

function cacheKeyFor(id: bigint, radiusKm: number, applyEarthCurvature: boolean): string {
  return `${id}|${radiusKm}|${applyEarthCurvature}`;
}

/**
 * Creates a T4 BigInt ID from base face, subdivision path, and zoom level.
 */
export function createT4Id(baseFace: number, subdivisions: number[], zoom: number): bigint {
  if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");
  if (baseFace < 0 || baseFace > 3) throw new Error("Base face must be between 0 and 3");
  if (subdivisions.length !== zoom) {
    throw new Error(`Subdivisions length (${subdivisions.length}) must match zoom level (${zoom})`);
  }

  let pos = BigInt(baseFace);
  for (let i = 0; i < zoom; i++) {
    const sub = subdivisions[i];
    if (sub < 0 || sub > 3) {
      throw new Error(`Subdivision index ${sub} at path position ${i} must be between 0 and 3`);
    }
    pos = (pos << 2n) | BigInt(sub);
  }

  // Bits 0-4: zoom level (5 bits)
  // Bit 5: validity flag (always 1 for valid T4 positions)
  // Bits 6+: positional bits (base face is at top, latest subdivision at bottom)
  return (pos << 6n) | (1n << 5n) | BigInt(zoom);
}

/**
 * Parses a T4 BigInt ID into its components.
 */
export function parseT4Id(id: bigint): {
  baseFace: number;
  subdivisions: number[];
  zoom: number;
  isValid: boolean;
} {
  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;

  if (!isValid || zoom > 28) {
    return { baseFace: 0, subdivisions: [], zoom: 0, isValid: false };
  }

  const pos = id >> 6n;
  const baseFace = Number((pos >> BigInt(2 * zoom)) & 3n);

  const subdivisions: number[] = [];
  for (let i = 0; i < zoom; i++) {
    const sub = Number((pos >> BigInt(2 * (zoom - 1 - i))) & 3n);
    subdivisions.push(sub);
  }

  return { baseFace, subdivisions, zoom, isValid: true };
}

/**
 * Gets the parent T4 ID by decrementing zoom and bit-shifting positional bits.
 */
export function getParentT4Id(id: bigint): bigint | null {
  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;
  if (!isValid || zoom === 0 || zoom > 28) return null;

  // Shifting the positional bits right by 2 drops the lowest (newest) subdivision
  // We keep the validity flag (Bit 5) as 1, and set zoom to zoom - 1
  return ((id >> 8n) << 6n) | (1n << 5n) | BigInt(zoom - 1);
}

/**
 * Gets the 4 child T4 IDs by incrementing zoom and shifting/appending subdivision bits.
 */
export function getT4Children(id: bigint): [bigint, bigint, bigint, bigint] {
  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;
  if (!isValid || zoom >= 28) {
    throw new Error("Cannot get children: invalid T4 ID or maximum zoom level reached");
  }

  const basePos = (id & ~0x3fn) << 2n;
  const nextZoom = BigInt(zoom + 1);
  const flag = 1n << 5n;

  return [
    basePos | (0n << 6n) | flag | nextZoom,
    basePos | (1n << 6n) | flag | nextZoom,
    basePos | (2n << 6n) | flag | nextZoom,
    basePos | (3n << 6n) | flag | nextZoom,
  ];
}

/**
 * Validates whether a BigInt represents a valid T4 ID.
 */
export function isValidT4Id(id: bigint): boolean {
  const zoom = Number(id & 0x1fn);
  const isValidFlag = ((id >> 5n) & 1n) === 1n;
  if (!isValidFlag || zoom > 28) return false;

  // Any bits set beyond the maximum active bits for the zoom level are invalid
  const maxActiveBits = 6 + 2 + 2 * zoom;
  const mask = ~((1n << BigInt(maxActiveBits)) - 1n);
  if ((id & mask) !== 0n) return false;

  const pos = id >> 6n;
  const baseFace = Number((pos >> BigInt(2 * zoom)) & 3n);
  return baseFace >= 0 && baseFace <= 3;
}

/**
 * Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).
 */
export function geocentricToGeodetic(xyz: ArrayVector3D, applyEarthCurvature: boolean): ArrayVector2D {
  const [x, y, z] = xyz;
  const d2d = x * x + y * y;
  if (d2d === 0) {
    return [0, z > 0 ? 90 : -90];
  }

  const lngRad = Math.atan2(y, x);
  let latRad: number;

  if (applyEarthCurvature) {
    // Standard oblate spheroid correction (WGS84 flattening)
    const invK = (1 - F_EARTH) * (1 - F_EARTH);
    latRad = Math.atan2(z / invK, Math.sqrt(d2d));
  } else {
    latRad = Math.atan2(z, Math.sqrt(d2d));
  }

  return [(lngRad * 180) / Math.PI, (latRad * 180) / Math.PI];
}

/**
 * Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].
 */
export function geodeticToGeocentric(lngLat: ArrayVector2D, applyEarthCurvature: boolean): ArrayVector3D {
  const [lng, lat] = lngLat;
  const lngRad = (lng * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  let latGeocentric: number;
  if (applyEarthCurvature) {
    const invK = (1 - F_EARTH) * (1 - F_EARTH);
    latGeocentric = Math.atan2(invK * Math.sin(latRad), Math.cos(latRad));
  } else {
    latGeocentric = latRad;
  }

  const cosLat = Math.cos(latGeocentric);
  return [cosLat * Math.cos(lngRad), cosLat * Math.sin(lngRad), Math.sin(latGeocentric)];
}

/**
 * Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.
 */
export function getT4VerticesFlat(id: bigint): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  const parsed = parseT4Id(id);
  if (!parsed.isValid) throw new Error("Invalid T4 ID");

  let [A, B, C] = BASE_FACES[parsed.baseFace];

  for (const sub of parsed.subdivisions) {
    const M_AB = multiply3D(add3D(A, B), [0.5, 0.5, 0.5]);
    const M_BC = multiply3D(add3D(B, C), [0.5, 0.5, 0.5]);
    const M_CA = multiply3D(add3D(C, A), [0.5, 0.5, 0.5]);

    if (sub === 0) {
      [A, B, C] = [A, M_AB, M_CA];
    } else if (sub === 1) {
      [A, B, C] = [M_AB, B, M_BC];
    } else if (sub === 2) {
      [A, B, C] = [M_CA, M_BC, C];
    } else if (sub === 3) {
      [A, B, C] = [M_BC, M_CA, M_AB];
    }
  }

  return [A, B, C];
}

/**
 * Gets the 3D vertices of the T4 cell normalized to the sphere surface of radiusKm.
 */
export function getT4Vertices3D(id: bigint, radiusKm = 6371): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  const [A, B, C] = getT4VerticesFlat(id);
  const scale: ArrayVector3D = [radiusKm, radiusKm, radiusKm];
  return [multiply3D(normalize3D(A), scale), multiply3D(normalize3D(B), scale), multiply3D(normalize3D(C), scale)];
}

/**
 * Gets the center point of the T4 cell on the sphere surface of radiusKm.
 */
export function getT4Center3D(id: bigint, radiusKm = 6371): ArrayVector3D {
  const [A, B, C] = getT4VerticesFlat(id);
  const center = divide3D(add3D(add3D(A, B), C), [3, 3, 3]);
  const scale: ArrayVector3D = [radiusKm, radiusKm, radiusKm];
  return multiply3D(normalize3D(center), scale);
}

/**
 * Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.
 */
export function getT4Vertices(id: bigint, options?: T4Options): [ArrayVector2D, ArrayVector2D, ArrayVector2D] {
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const [A, B, C] = getT4VerticesFlat(id);
  return [
    geocentricToGeodetic(normalize3D(A), applyEarthCurvature),
    geocentricToGeodetic(normalize3D(B), applyEarthCurvature),
    geocentricToGeodetic(normalize3D(C), applyEarthCurvature),
  ];
}

/**
 * Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.
 */
export function getT4Center(id: bigint, options?: T4Options): ArrayVector2D {
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const center3D = getT4Center3D(id, 1.0);
  return geocentricToGeodetic(center3D, applyEarthCurvature);
}

// Ray-plane intersection helper
function getRayFaceIntersection(
  P: ArrayVector3D,
  A: ArrayVector3D,
  B: ArrayVector3D,
  C: ArrayVector3D,
): ArrayVector3D | null {
  const normal = cross3D(subtract3D(B, A), subtract3D(C, A));
  const denom = dot3D(P, normal);
  if (Math.abs(denom) < 1e-12) return null;

  const t = dot3D(A, normal) / denom;
  if (t < 0) return null;

  return multiply3D(P, [t, t, t]);
}

// Barycentric coordinates solver
function getBarycentric(Q: ArrayVector3D, A: ArrayVector3D, B: ArrayVector3D, C: ArrayVector3D): ArrayVector3D {
  const v0 = subtract3D(B, A);
  const v1 = subtract3D(C, A);
  const v2 = subtract3D(Q, A);

  const d00 = dot3D(v0, v0);
  const d01 = dot3D(v0, v1);
  const d11 = dot3D(v1, v1);
  const d20 = dot3D(v2, v0);
  const d21 = dot3D(v2, v1);

  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-12) {
    return [1 / 3, 1 / 3, 1 / 3];
  }

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1.0 - v - w;
  return [u, v, w];
}

/**
 * Finds the base face that contains the projection of P onto the tetrahedron,
 * returning the face index and the barycentric coordinates of P within it.
 *
 * The common case exits early: the first face whose minimum barycentric
 * coordinate is >= 0 means the point projects strictly inside it, so the
 * remaining faces are skipped (O(1) face instead of O(4)). Points exactly on
 * a face edge or vertex (a tie) won't satisfy the early condition for any
 * face, so the loop falls back to selecting the max-score face across all 4,
 * matching the original tie-breaking behavior.
 */
function findBestFace(P: ArrayVector3D): { face: number; barycentric: ArrayVector3D } {
  let bestFace = -1;
  let bestScore = -Infinity;
  let bestBarycentric: ArrayVector3D = [0, 0, 0];

  for (let i = 0; i < 4; i++) {
    const [A, B, C] = BASE_FACES[i];
    const Q = getRayFaceIntersection(P, A, B, C);
    if (!Q) continue;

    const [u, v, w] = getBarycentric(Q, A, B, C);
    const score = Math.min(u, v, w);
    // Early exit: point projects strictly inside this face.
    if (score >= 0) {
      return { face: i, barycentric: [u, v, w] };
    }
    if (score > bestScore) {
      bestScore = score;
      bestFace = i;
      bestBarycentric = [u, v, w];
    }
  }

  if (bestFace === -1) {
    throw new Error("Point could not be projected onto the tetrahedron");
  }
  return { face: bestFace, barycentric: bestBarycentric };
}

/**
 * Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.
 */
export function cartesianToT4(P: ArrayVector3D, zoom: number): bigint {
  if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");

  const { face: bestFace, barycentric: bestBarycentric } = findBestFace(P);

  let [u, v, w] = bestBarycentric;
  const subdivisions: number[] = [];

  for (let step = 0; step < zoom; step++) {
    if (u > 0.5) {
      subdivisions.push(0);
      [u, v, w] = [2 * u - 1, 2 * v, 2 * w];
    } else if (v > 0.5) {
      subdivisions.push(1);
      [u, v, w] = [2 * u, 2 * v - 1, 2 * w];
    } else if (w > 0.5) {
      subdivisions.push(2);
      [u, v, w] = [2 * u, 2 * v, 2 * w - 1];
    } else {
      subdivisions.push(3);
      [u, v, w] = [1 - 2 * u, 1 - 2 * v, 1 - 2 * w];
    }
  }

  return createT4Id(bestFace, subdivisions, zoom);
}

/**
 * Converts GPS [lat, lng] degrees to a T4 ID.
 */
export function latLngToT4(lat: number, lng: number, zoom: number, options?: T4Options): bigint {
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const P = geodeticToGeocentric([lng, lat], applyEarthCurvature);
  return cartesianToT4(P, zoom);
}

// Point across edge helper. Computes the midpoint of edge A-B, then nudges
// it 1% of the way toward the opposite vertex C (i.e. away from the cell
// center) so the resulting point lands inside the adjacent cell across that
// edge. Inlined from vec helpers to avoid per-call allocations on the
// neighbor hot path; math is identical to the original.
function getPointAcrossEdge(A: ArrayVector3D, B: ArrayVector3D, C: ArrayVector3D): ArrayVector3D {
  // center = (A + B + C) / 3
  const cx = (A[0] + B[0] + C[0]) / 3;
  const cy = (A[1] + B[1] + C[1]) / 3;
  const cz = (A[2] + B[2] + C[2]) / 3;
  // midpoint = (A + B) / 2 ; dir = midpoint - center ; out = midpoint + 0.01 * dir
  // Combined: out = midpoint + 0.01 * (midpoint - center) = 1.01*midpoint - 0.01*center
  const m = 1.01 / 2; // 1.01 * (A+B)/2
  const k = 0.01; // -0.01 * center
  return [m * (A[0] + B[0]) - k * cx, m * (A[1] + B[1]) - k * cy, m * (A[2] + B[2]) - k * cz];
}

/**
 * Gets the 3 neighbor T4 IDs sharing the edges of the cell.
 */
export function getT4Neighbors(id: bigint, _options?: T4Options): [bigint, bigint, bigint] {
  const parsed = parseT4Id(id);
  if (!parsed.isValid) throw new Error("Invalid T4 ID");

  const [A, B, C] = getT4VerticesFlat(id);

  const p1 = getPointAcrossEdge(A, B, C);
  const p2 = getPointAcrossEdge(B, C, A);
  const p3 = getPointAcrossEdge(C, A, B);

  return [cartesianToT4(p1, parsed.zoom), cartesianToT4(p2, parsed.zoom), cartesianToT4(p3, parsed.zoom)];
}

/**
 * Standard OOP wrapper and memoized factory for T4 cells.
 */
export function createT4(
  idOrConfig: bigint | { baseFace: number; subdivisions?: number[]; zoom?: number },
  options?: T4Options,
): T4Object {
  const radiusKm = options?.radiusKm ?? 6371;
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;

  let id: bigint;
  if (typeof idOrConfig === "bigint") {
    id = idOrConfig;
  } else {
    const baseFace = idOrConfig.baseFace;
    const subdivisions = idOrConfig.subdivisions ?? [];
    const zoom = idOrConfig.zoom ?? subdivisions.length;
    id = createT4Id(baseFace, subdivisions, zoom);
  }

  // Check cache first. Keyed by id + options so variants with different
  // radius/curvature coexist instead of evicting each other.
  const key = cacheKeyFor(id, radiusKm, applyEarthCurvature);
  const cachedRef = instanceCache.get(key);
  if (cachedRef) {
    const cached = cachedRef.deref();
    if (cached) return cached;
  }

  const parsed = parseT4Id(id);
  if (!parsed.isValid) {
    throw new Error("Invalid T4 ID");
  }

  // Lazily memoized flat vertices. Every geometry getter (vertices3D,
  // center3D, vertices, center) starts from the same flat [A,B,C] computed
  // by walking the subdivision path; computing it once and reusing avoids
  // re-walking the path (z12 = 12 midpoint iterations) on each access.
  let flatCached: [ArrayVector3D, ArrayVector3D, ArrayVector3D] | null = null;
  const getFlat = (): [ArrayVector3D, ArrayVector3D, ArrayVector3D] => {
    if (!flatCached) flatCached = getT4VerticesFlat(id);
    return flatCached;
  };

  const obj: T4Object = {
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
    get vertices3D() {
      const [A, B, C] = getFlat();
      const scale: ArrayVector3D = [radiusKm, radiusKm, radiusKm];
      return [
        multiply3D(normalize3D(A), scale),
        multiply3D(normalize3D(B), scale),
        multiply3D(normalize3D(C), scale),
      ] as [ArrayVector3D, ArrayVector3D, ArrayVector3D];
    },
    get center3D() {
      const [A, B, C] = getFlat();
      const center = divide3D(add3D(add3D(A, B), C), [3, 3, 3]);
      const scale: ArrayVector3D = [radiusKm, radiusKm, radiusKm];
      return multiply3D(normalize3D(center), scale);
    },
    get vertices() {
      const [A, B, C] = getFlat();
      return [
        geocentricToGeodetic(normalize3D(A), applyEarthCurvature),
        geocentricToGeodetic(normalize3D(B), applyEarthCurvature),
        geocentricToGeodetic(normalize3D(C), applyEarthCurvature),
      ] as [ArrayVector2D, ArrayVector2D, ArrayVector2D];
    },
    get center() {
      const [A, B, C] = getFlat();
      const center = divide3D(add3D(add3D(A, B), C), [3, 3, 3]);
      return geocentricToGeodetic(normalize3D(center), applyEarthCurvature);
    },
    get parent() {
      const parentId = getParentT4Id(id);
      if (parentId === null) return null;
      return createT4(parentId, { radiusKm, applyEarthCurvature });
    },
    get neighbors(): [T4Object, T4Object, T4Object] {
      const neighborIds = getT4Neighbors(id, { radiusKm, applyEarthCurvature });
      return [
        createT4(neighborIds[0], { radiusKm, applyEarthCurvature }),
        createT4(neighborIds[1], { radiusKm, applyEarthCurvature }),
        createT4(neighborIds[2], { radiusKm, applyEarthCurvature }),
      ];
    },
    get children(): [T4Object, T4Object, T4Object, T4Object] {
      const childIds = getT4Children(id);
      return [
        createT4(childIds[0], { radiusKm, applyEarthCurvature }),
        createT4(childIds[1], { radiusKm, applyEarthCurvature }),
        createT4(childIds[2], { radiusKm, applyEarthCurvature }),
        createT4(childIds[3], { radiusKm, applyEarthCurvature }),
      ];
    },
    getChildren(): [T4Object, T4Object, T4Object, T4Object] {
      return this.children;
    },
    get childIds(): [bigint, bigint, bigint, bigint] {
      return getT4Children(id);
    },
  };

  instanceCache.set(key, new WeakRef(obj));
  cacheFinalizer.register(obj, key);
  return obj;
}
