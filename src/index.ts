import { type ArrayVector2D, type ArrayVector3D, normalize3D } from "@fimbul-works/vec";

// WGS84 flattening factor for Earth
export const F_EARTH = 1.0 / 298.257223563;
export const DEFAULT_RADIUS_KM = 6371.0;

// Regular tetrahedron vertices on unit sphere centered at origin
const sqrt8_9 = Math.sqrt(8.0 / 9.0);
const sqrt2_9 = Math.sqrt(2.0 / 9.0);
const sqrt2_3 = Math.sqrt(2.0 / 3.0);

const v0: ArrayVector3D = [0.0, 0.0, 1.0];
const v1: ArrayVector3D = [sqrt8_9, 0.0, -1.0 / 3.0];
const v2: ArrayVector3D = [-sqrt2_9, sqrt2_3, -1.0 / 3.0];
const v3: ArrayVector3D = [-sqrt2_9, -sqrt2_3, -1.0 / 3.0];

// 4 base faces of the tetrahedron (ordered CCW from outside)
export const BASE_FACES: [ArrayVector3D, ArrayVector3D, ArrayVector3D][] = [
  [v0, v1, v2], // Face 0
  [v0, v2, v3], // Face 1
  [v0, v3, v1], // Face 2
  [v1, v3, v2], // Face 3
];

interface BaseFaceData {
  Ax: number;
  Ay: number;
  Az: number;
  Bx: number;
  By: number;
  Bz: number;
  Cx: number;
  Cy: number;
  Cz: number;
  v0x: number;
  v0y: number;
  v0z: number;
  v1x: number;
  v1y: number;
  v1z: number;
  nx: number;
  ny: number;
  nz: number;
  D: number;
  d00: number;
  d01: number;
  d11: number;
  invDenom: number;
}

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

const BASE_FACE_DATA: BaseFaceData[] = [
  computeBaseFaceData(v0, v1, v2),
  computeBaseFaceData(v0, v2, v3),
  computeBaseFaceData(v0, v3, v1),
  computeBaseFaceData(v1, v3, v2),
];

// Precomputed BigInt constants & lookup tables to eliminate V8 heap allocations in hot paths
const BIGINT_SUBS = [0n, 1n, 2n, 3n];
const BIGINT_FACES = [0n << 62n, 1n << 62n, 2n << 62n, 3n << 62n];
const VALID_FLAG = 1n << 5n;

// Precomputed subdivision bit shifts: SUB_SHIFTS[i] = 60n - 2n * i (for i = 0..27)
const SUB_SHIFTS: bigint[] = new Array(28);
for (let i = 0; i < 28; i++) {
  SUB_SHIFTS[i] = BigInt(60 - 2 * i);
}

// Precomputed unused bit masks for validation: UNUSED_MASKS[zoom]
const UNUSED_MASKS: bigint[] = new Array(29);
for (let z = 0; z <= 28; z++) {
  const unusedBits = 2 * (28 - z);
  UNUSED_MASKS[z] = unusedBits > 0 ? ((1n << BigInt(unusedBits)) - 1n) << 6n : 0n;
}

// Precomputed descendant masks: DESCENDANT_MASKS[parentZoom]
const DESCENDANT_MASKS: bigint[] = new Array(29);
for (let pz = 0; pz <= 28; pz++) {
  const bits = 2 * pz;
  DESCENDANT_MASKS[pz] = bits > 0 ? ((1n << BigInt(bits)) - 1n) << BigInt(62 - bits) : 0n;
}

// Precomputed parent clearing masks: PARENT_CLEAR_MASKS[newZoom] = ~(3n << SUB_SHIFTS[newZoom])
const PARENT_CLEAR_MASKS: bigint[] = new Array(28);
for (let nz = 0; nz < 28; nz++) {
  PARENT_CLEAR_MASKS[nz] = ~(3n << SUB_SHIFTS[nz]);
}

// Precomputed zoom BigInts: ZOOM_BIGINTS[zoom] = BigInt(zoom)
const ZOOM_BIGINTS: bigint[] = new Array(29);
for (let z = 0; z <= 28; z++) {
  ZOOM_BIGINTS[z] = BigInt(z);
}

export interface T4Options {
  radiusKm?: number;
  applyEarthCurvature?: boolean;
  authalicWarp?: boolean;
  warpFactor?: number;
}

export interface T4Object {
  readonly id: bigint;
  readonly zoom: number;
  readonly radiusKm: number;
  readonly applyEarthCurvature: boolean;
  readonly authalicWarp: boolean;
  readonly warpFactor: number;
  readonly vertices: [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  readonly center: ArrayVector2D;
  readonly vertices2D: [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  readonly center2D: ArrayVector2D;
  readonly vertices3D: [ArrayVector3D, ArrayVector3D, ArrayVector3D];
  readonly center3D: ArrayVector3D;
  readonly area: number;
  readonly parent: T4Object | null;
  readonly neighbors: [T4Object, T4Object, T4Object];
  readonly children: [T4Object, T4Object, T4Object, T4Object];
  getChildren(): [T4Object, T4Object, T4Object, T4Object];
  readonly childIds: [bigint, bigint, bigint, bigint];
  isDescendantOf(parent: T4Object | bigint): boolean;
}

// Instance cache to reuse T4Object instances (using WeakRefs to prevent leaks).
const instanceCache = new Map<string, WeakRef<T4Object>>();

const cacheFinalizer = new FinalizationRegistry((key: string) => {
  const ref = instanceCache.get(key);
  if (ref && !ref.deref()) instanceCache.delete(key);
});

function cacheKeyFor(
  id: bigint,
  radiusKm: number,
  applyEarthCurvature: boolean,
  authalicWarp: boolean,
  warpFactor: number,
): string {
  return `${id}|${radiusKm}|${applyEarthCurvature}|${authalicWarp}|${warpFactor}`;
}

// --- ID Generation & Validation (Fixed 64-bit Layout) ---

/**
 * Creates a 64-bit T4 BigInt ID from base face, subdivision path, and zoom level.
 * Bit layout:
 * - Bits 63..62: base face (2 bits)
 * - Bits 61..6: subdivisions (2 bits each from step 0 at bit 60 down to step 27 at bit 6)
 * - Bit 5: validity flag (always 1)
 * - Bits 4..0: zoom level (5 bits, 0-28)
 */
export function createT4Id(baseFace: number, subdivisions: number[], zoom: number): bigint {
  if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");
  if (baseFace < 0 || baseFace > 3) throw new Error("Base face must be between 0 and 3");
  if (subdivisions.length !== zoom) {
    throw new Error(`Subdivisions length (${subdivisions.length}) must match zoom level (${zoom})`);
  }

  let id = BIGINT_FACES[baseFace];
  for (let i = 0; i < zoom; ++i) {
    const sub = subdivisions[i];
    if (sub < 0 || sub > 3) {
      throw new Error(`Subdivision index ${sub} at path position ${i} must be between 0 and 3`);
    }
    id |= BIGINT_SUBS[sub] << SUB_SHIFTS[i];
  }

  id |= VALID_FLAG | ZOOM_BIGINTS[zoom];
  return id;
}

export interface ParsedT4Id {
  baseFace: number;
  subdivisions: number[];
  zoom: number;
  isValid: boolean;
}

/**
 * Parses a T4 BigInt ID into its face, subdivisions array, zoom, and validity flag.
 */
export function parseT4Id(id: bigint): ParsedT4Id {
  if (typeof id !== "bigint" || id < 0n || id >> 64n !== 0n) {
    return { baseFace: 0, subdivisions: [], zoom: 0, isValid: false };
  }

  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;

  if (!isValid || zoom > 28 || zoom < 0) {
    return { baseFace: 0, subdivisions: [], zoom: 0, isValid: false };
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
    return { baseFace: 0, subdivisions: [], zoom: 0, isValid: false };
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
 */
export function getParentT4Id(id: bigint): bigint | null {
  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom <= 0 || zoom > 28) {
    return null;
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
    return null;
  }

  const newZoom = zoom - 1;
  return (id & PARENT_CLEAR_MASKS[newZoom] & ~0x1fn) | ZOOM_BIGINTS[newZoom];
}

/**
 * Gets the 4 child T4 IDs by setting the subdivision at zoom level and incrementing zoom.
 */
export function getT4Children(id: bigint): [bigint, bigint, bigint, bigint] {
  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom >= 28 || zoom < 0) {
    throw new Error("Cannot get children for invalid ID or max zoom level reached");
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Cannot get children for invalid ID");
  }

  const newZoom = zoom + 1;
  const base = (id & ~0x1fn) | ZOOM_BIGINTS[newZoom];
  const shift = SUB_SHIFTS[zoom];

  return [base, base | (1n << shift), base | (2n << shift), base | (3n << shift)];
}

/**
 * Checks whether childId is a descendant of parentId in $O(1)$ bit comparisons.
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

// --- Geodetic & Geocentric Conversions ---

/**
 * Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).
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
    const invK = (1.0 - F_EARTH) * (1.0 - F_EARTH);
    latRad = Math.atan2(z / invK, Math.sqrt(d2d));
  } else {
    latRad = Math.atan2(z, Math.sqrt(d2d));
  }

  return [(lngRad * 180.0) / Math.PI, (latRad * 180.0) / Math.PI];
}

/**
 * Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].
 */
export function geodeticToGeocentric(lngLat: ArrayVector2D, applyEarthCurvature = true): ArrayVector3D {
  const lng = lngLat[0];
  const lat = lngLat[1];
  const lngRad = (lng * Math.PI) / 180.0;
  const latRad = (lat * Math.PI) / 180.0;

  let latGeocentric: number;
  if (applyEarthCurvature) {
    const invK = (1.0 - F_EARTH) * (1.0 - F_EARTH);
    latGeocentric = Math.atan2(invK * Math.sin(latRad), Math.cos(latRad));
  } else {
    latGeocentric = latRad;
  }

  const cosLat = Math.cos(latGeocentric);
  return [cosLat * Math.cos(lngRad), cosLat * Math.sin(lngRad), Math.sin(latGeocentric)];
}

// --- Vertices & Center Calculations ---

/**
 * Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.
 */
export function getT4VerticesFlat(id: bigint): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  const zoom = Number(id & 0x1fn);
  const isValid = ((id >> 5n) & 1n) === 1n;
  if (!isValid || zoom > 28 || zoom < 0) {
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

function authalicWarpG(xIn: number): number {
  const x = Math.max(1e-7, Math.min(1.0, xIn));
  const xc = x - 1.0 / 3.0;
  const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
  const sqrtX = Math.sqrt(x);
  const fourthRootX = Math.sqrt(sqrtX);
  return sqrtX * fourthRootX * poly;
}

let gInvPrime = 1.0;

function authalicWarpGInv(y: number): number {
  if (y <= 0.0) {
    gInvPrime = 1.0;
    return 0.0;
  }

  // Initial estimate x0 = y^(4/3) = y * cbrt(y)
  let x = Math.max(1e-7, Math.min(1.0, y * Math.cbrt(y)));

  for (let iter = 0; iter < 4; ++iter) {
    const xc = x - 1.0 / 3.0;
    const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
    const polyDeriv = -0.5 + 0.7 * xc + 0.9 * xc * xc;
    const sqrtX = Math.sqrt(x);
    const fourthRootX = Math.sqrt(sqrtX);
    const xPowGamma = sqrtX * fourthRootX;
    const xPowGammaMinus1 = 1.0 / fourthRootX;

    const gVal = xPowGamma * poly;
    const gp = xPowGammaMinus1 * (0.75 * poly + x * polyDeriv);
    gInvPrime = gp;

    const diff = gVal - y;
    if (Math.abs(diff) < 1e-12 || Math.abs(gp) < 1e-12) {
      gInvPrime = gp > 1e-12 ? gp : 1e-12;
      return x;
    }

    const step = diff / gp;
    x = Math.max(1e-7, Math.min(1.0, x - step));
    if (Math.abs(step) < 1e-12) {
      break;
    }
  }

  const xc = x - 1.0 / 3.0;
  const poly = 1.0 - 0.5 * xc + 0.35 * xc * xc + 0.3 * xc * xc * xc;
  const polyDeriv = -0.5 + 0.7 * xc + 0.9 * xc * xc;
  const sqrtX = Math.sqrt(x);
  const fourthRootX = Math.sqrt(sqrtX);
  const xPowGammaMinus1 = 1.0 / fourthRootX;
  const gp = xPowGammaMinus1 * (0.75 * poly + x * polyDeriv);
  gInvPrime = gp < 1e-12 ? 1e-12 : gp;
  return x;
}

function unwarpAuthalicCornerInternal(uIn: number, vIn: number, wIn: number): [number, number, number] {
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

  for (let iter = 0; iter < 8; ++iter) {
    uf = authalicWarpGInv(lambda * uw);
    const duRaw = gInvPrime;
    vf = authalicWarpGInv(lambda * vw);
    const dvRaw = gInvPrime;
    wf = authalicWarpGInv(lambda * ww);
    const dwRaw = gInvPrime;

    const F = uf + vf + wf - 1.0;
    if (Math.abs(F) < 1e-12) {
      break;
    }

    if (F < 0.0) {
      if (lambda > lambdaLow) lambdaLow = lambda;
    } else {
      if (lambda < lambdaHigh) lambdaHigh = lambda;
    }

    const du = duRaw > 1e-12 ? duRaw : 1e-12;
    const dv = dvRaw > 1e-12 ? dvRaw : 1e-12;
    const dw = dwRaw > 1e-12 ? dwRaw : 1e-12;

    const FPrime = uw / du + vw / dv + ww / dw;
    if (FPrime > 1e-12) {
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
  return [uf / sum, vf / sum, wf / sum];
}

/**
 * Inverts the authalic corner warp on barycentric coordinates.
 */
export function unwarpAuthalicCorner(baryW: ArrayVector3D): ArrayVector3D {
  const [u, v, w] = unwarpAuthalicCornerInternal(baryW[0], baryW[1], baryW[2]);
  return [u, v, w];
}

function getBarycentricFast(qx: number, qy: number, qz: number, face: number): [number, number, number] {
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

function getRayFaceIntersectionFast(
  px: number,
  py: number,
  pz: number,
  face: number,
): { hit: boolean; x: number; y: number; z: number } {
  const fd = BASE_FACE_DATA[face];
  const denom = px * fd.nx + py * fd.ny + pz * fd.nz;
  if (denom <= 1e-12) {
    return { hit: false, x: 0, y: 0, z: 0 };
  }
  const t = fd.D / denom;
  return { hit: true, x: px * t, y: py * t, z: pz * t };
}

/**
 * Projects a flat point on a tetrahedron base face using the authalic corner warp.
 */
export function projectAuthalicCornerWarp(
  flatPt: ArrayVector3D,
  baseFaceIndex: number,
  warpFactor = 1.0,
): ArrayVector3D {
  const faceIdx = (baseFaceIndex & 3) % 4;
  const A = BASE_FACES[faceIdx][0];
  const B = BASE_FACES[faceIdx][1];
  const C = BASE_FACES[faceIdx][2];

  const bary = getBarycentricFast(flatPt[0], flatPt[1], flatPt[2], faceIdx);
  const u = Math.max(0.0, Math.min(1.0, bary[0]));
  const v = Math.max(0.0, Math.min(1.0, bary[1]));
  const w = Math.max(0.0, Math.min(1.0, bary[2]));

  let fu: number, fv: number, fw: number;
  if (warpFactor === 1.0) {
    fu = authalicWarpG(u);
    fv = authalicWarpG(v);
    fw = authalicWarpG(w);
  } else {
    const gamma = warpFactor * 0.75;
    const uc = u - 1.0 / 3.0;
    const vc = v - 1.0 / 3.0;
    const wc = w - 1.0 / 3.0;
    fu = Math.pow(Math.max(1e-7, u), gamma) * (1.0 - 0.5 * uc + 0.35 * uc * uc + 0.3 * uc * uc * uc);
    fv = Math.pow(Math.max(1e-7, v), gamma) * (1.0 - 0.5 * vc + 0.35 * vc * vc + 0.3 * vc * vc * vc);
    fw = Math.pow(Math.max(1e-7, w), gamma) * (1.0 - 0.5 * wc + 0.35 * wc * wc + 0.3 * wc * wc * wc);
  }

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
 */
export function getT4Vertices3D(
  id: bigint,
  radiusKm = DEFAULT_RADIUS_KM,
  options?: T4Options,
): [ArrayVector3D, ArrayVector3D, ArrayVector3D] {
  const baseFace = Number((id >> 62n) & 3n);
  const [A, B, C] = getT4VerticesFlat(id);
  const authalic = options?.authalicWarp ?? true;
  const warpFactor = options?.warpFactor ?? 1.0;

  if (authalic) {
    const pA = projectAuthalicCornerWarp(A, baseFace, warpFactor);
    const pB = projectAuthalicCornerWarp(B, baseFace, warpFactor);
    const pC = projectAuthalicCornerWarp(C, baseFace, warpFactor);
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
  const warpFactor = options?.warpFactor ?? 1.0;

  if (authalic) {
    const pCenter = projectAuthalicCornerWarp(centerFlat, baseFace, warpFactor);
    return [pCenter[0] * radiusKm, pCenter[1] * radiusKm, pCenter[2] * radiusKm];
  }

  const nCenter = normalize3D(centerFlat);
  return [nCenter[0] * radiusKm, nCenter[1] * radiusKm, nCenter[2] * radiusKm];
}

/**
 * Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.
 */
export function getT4Vertices(
  id: bigint,
  options?: T4Options | boolean,
): [ArrayVector2D, ArrayVector2D, ArrayVector2D] {
  const applyEarthCurvature = typeof options === "boolean" ? options : (options?.applyEarthCurvature ?? true);
  const authalic = typeof options === "boolean" ? true : (options?.authalicWarp ?? true);
  const warpFactor = typeof options === "boolean" ? 1.0 : (options?.warpFactor ?? 1.0);
  const baseFace = Number((id >> 62n) & 3n);

  const [A, B, C] = getT4VerticesFlat(id);

  const pA = authalic ? projectAuthalicCornerWarp(A, baseFace, warpFactor) : normalize3D(A);
  const pB = authalic ? projectAuthalicCornerWarp(B, baseFace, warpFactor) : normalize3D(B);
  const pC = authalic ? projectAuthalicCornerWarp(C, baseFace, warpFactor) : normalize3D(C);

  return [
    geocentricToGeodetic(pA, applyEarthCurvature),
    geocentricToGeodetic(pB, applyEarthCurvature),
    geocentricToGeodetic(pC, applyEarthCurvature),
  ];
}

export const getT4Vertices2D = getT4Vertices;

/**
 * Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.
 */
export function getT4Center(id: bigint, options?: T4Options | boolean): ArrayVector2D {
  const applyEarthCurvature = typeof options === "boolean" ? options : (options?.applyEarthCurvature ?? true);
  const center3D = getT4Center3D(id, 1.0, typeof options === "object" ? options : undefined);
  return geocentricToGeodetic(center3D, applyEarthCurvature);
}

export const getT4Center2D = getT4Center;

// --- Face Selection & Cartesian to T4 ---

function findBestFace(px: number, py: number, pz: number): { face: number; u: number; v: number; w: number } {
  // Outward face normals dot products: -v3, -v1, -v2, -v0
  const d0 = px * sqrt2_9 + py * sqrt2_3 + pz * (1.0 / 3.0);
  const d1 = -px * sqrt8_9 + pz * (1.0 / 3.0);
  const d2 = px * sqrt2_9 - py * sqrt2_3 + pz * (1.0 / 3.0);
  const d3 = -pz;

  let bestFace = 0;
  let maxD = d0;
  if (d1 > maxD) {
    maxD = d1;
    bestFace = 1;
  }
  if (d2 > maxD) {
    maxD = d2;
    bestFace = 2;
  }
  if (d3 > maxD) {
    maxD = d3;
    bestFace = 3;
  }

  const hitRes = getRayFaceIntersectionFast(px, py, pz, bestFace);
  if (hitRes.hit) {
    const bary = getBarycentricFast(hitRes.x, hitRes.y, hitRes.z, bestFace);
    if (bary[0] >= -1e-4 && bary[1] >= -1e-4 && bary[2] >= -1e-4) {
      let u = Math.max(0.0, bary[0]);
      let v = Math.max(0.0, bary[1]);
      let w = Math.max(0.0, bary[2]);
      const s = u + v + w;
      if (s > 1e-9) {
        u /= s;
        v /= s;
        w /= s;
      }
      return { face: bestFace, u, v, w };
    }
  }

  // Fallback: search all faces if boundary precision required it
  let bestScore = -Infinity;
  let fallbackFace = -1;
  let bestU = 0.0,
    bestV = 0.0,
    bestW = 0.0;

  for (let i = 0; i < 4; ++i) {
    const fHit = getRayFaceIntersectionFast(px, py, pz, i);
    if (!fHit.hit) continue;

    const bary = getBarycentricFast(fHit.x, fHit.y, fHit.z, i);
    const score = Math.min(bary[0], bary[1], bary[2]);
    if (score >= 0.0) {
      return { face: i, u: bary[0], v: bary[1], w: bary[2] };
    }
    if (score > bestScore) {
      bestScore = score;
      fallbackFace = i;
      bestU = bary[0];
      bestV = bary[1];
      bestW = bary[2];
    }
  }

  if (fallbackFace === -1) {
    throw new Error("Point could not be projected onto the tetrahedron");
  }
  return { face: fallbackFace, u: bestU, v: bestV, w: bestW };
}

/**
 * Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.
 */
export function cartesianToT4(P: ArrayVector3D, zoom: number, options?: T4Options): bigint {
  if (zoom < 0 || zoom > 28) throw new Error("Zoom must be between 0 and 28");

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
    if (u > 0.5) {
      s = 0;
      u = 2.0 * u - 1.0;
      v = 2.0 * v;
      w = 2.0 * w;
    } else if (v > 0.5) {
      s = 1;
      u = 2.0 * u;
      v = 2.0 * v - 1.0;
      w = 2.0 * w;
    } else if (w > 0.5) {
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
 * Converts GPS [lat, lng] degrees to a T4 ID.
 */
export function latLngToT4(lat: number, lng: number, zoom: number, options?: T4Options): bigint {
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const P = geodeticToGeocentric([lng, lat], applyEarthCurvature);
  return cartesianToT4(P, zoom, options);
}

// --- Topology & Neighbors via Discrete Triangular Coordinates (TriCoord) ---

interface TriCoord {
  i: number;
  j: number;
  k: number;
  up: number;
}

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
        // s === 3
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
        // s === 3
        i = (i << 1) | 1;
        j = (j << 1) | 1;
        k = (k << 1) | 1;
        up = 1;
      }
    }
  }

  return { i, j, k, up };
}

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
 */
export function getT4Neighbors(id: bigint, _options?: T4Options): [bigint, bigint, bigint] {
  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || zoom < 0) {
    throw new Error("Invalid T4 ID");
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
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
 */
export function getT4CellArea(id: bigint, radiusKm = DEFAULT_RADIUS_KM): number {
  const zoom = Number(id & 0x1fn);
  if (((id >> 5n) & 1n) !== 1n || zoom > 28 || zoom < 0) {
    throw new Error("Invalid T4 ID");
  }

  if ((id & UNUSED_MASKS[zoom]) !== 0n) {
    throw new Error("Invalid T4 ID");
  }

  const baseFace = Number((id >> 62n) & 3n);
  const [A, B, C] = getT4VerticesFlat(id);

  const uA = projectAuthalicCornerWarp(A, baseFace);
  const uB = projectAuthalicCornerWarp(B, baseFace);
  const uC = projectAuthalicCornerWarp(C, baseFace);

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

  if (lenAB < 1e-12 || lenBC < 1e-12 || lenCA < 1e-12) {
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
  if (sphericalExcess <= 1e-12) {
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
 */
export function createT4(
  idOrConfig: bigint | { baseFace: number; subdivisions?: number[]; zoom?: number },
  options?: T4Options,
): T4Object {
  const radiusKm = options?.radiusKm ?? DEFAULT_RADIUS_KM;
  const applyEarthCurvature = options?.applyEarthCurvature ?? true;
  const authalicWarp = options?.authalicWarp ?? true;
  const warpFactor = options?.warpFactor ?? 1.0;

  let id: bigint;
  if (typeof idOrConfig === "bigint") {
    id = idOrConfig;
  } else {
    const baseFace = idOrConfig.baseFace;
    const subdivisions = idOrConfig.subdivisions ?? [];
    const zoom = idOrConfig.zoom ?? subdivisions.length;
    id = createT4Id(baseFace, subdivisions, zoom);
  }

  const key = cacheKeyFor(id, radiusKm, applyEarthCurvature, authalicWarp, warpFactor);
  const cachedRef = instanceCache.get(key);
  if (cachedRef) {
    const cached = cachedRef.deref();
    if (cached) return cached;
  }

  const parsed = parseT4Id(id);
  if (!parsed.isValid) {
    throw new Error("Invalid T4 ID");
  }

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
    get authalicWarp() {
      return authalicWarp;
    },
    get warpFactor() {
      return warpFactor;
    },
    get vertices3D() {
      return getT4Vertices3D(id, radiusKm, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
    },
    get center3D() {
      return getT4Center3D(id, radiusKm, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
    },
    get vertices() {
      return getT4Vertices(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
    },
    get center() {
      return getT4Center(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
    },
    get vertices2D() {
      return this.vertices;
    },
    get center2D() {
      return this.center;
    },
    get area() {
      return getT4CellArea(id, radiusKm);
    },
    get parent() {
      const parentId = getParentT4Id(id);
      if (parentId === null) return null;
      return createT4(parentId, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
    },
    get neighbors(): [T4Object, T4Object, T4Object] {
      const neighborIds = getT4Neighbors(id, {
        radiusKm,
        applyEarthCurvature,
        authalicWarp,
        warpFactor,
      });
      return [
        createT4(neighborIds[0], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
        createT4(neighborIds[1], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
        createT4(neighborIds[2], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
      ];
    },
    get children(): [T4Object, T4Object, T4Object, T4Object] {
      const childIds = getT4Children(id);
      return [
        createT4(childIds[0], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
        createT4(childIds[1], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
        createT4(childIds[2], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
        createT4(childIds[3], {
          radiusKm,
          applyEarthCurvature,
          authalicWarp,
          warpFactor,
        }),
      ];
    },
    getChildren(): [T4Object, T4Object, T4Object, T4Object] {
      return this.children;
    },
    get childIds(): [bigint, bigint, bigint, bigint] {
      return getT4Children(id);
    },
    isDescendantOf(parent: T4Object | bigint): boolean {
      const parentId = typeof parent === "bigint" ? parent : parent.id;
      return isT4Descendant(id, parentId);
    },
  };

  instanceCache.set(key, new WeakRef(obj));
  cacheFinalizer.register(obj, key);
  return obj;
}
