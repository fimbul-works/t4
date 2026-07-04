import { describe, expect, it } from "vitest";
import {
  cartesianToT4,
  createT4,
  createT4Id,
  getParentT4Id,
  getT4Center,
  getT4Children,
  getT4Neighbors,
  getT4VerticesFlat,
  isValidT4Id,
  latLngToT4,
  parseT4Id,
} from "./index";

// ---- shared geometry helpers (3D, flat-space arithmetic) ----

// Flat Euclidean distance between two points. The flat vertices returned by
// getT4VerticesFlat live INSIDE the tetrahedron (not on the unit sphere), so
// coincidence must be checked in flat space — normalizing them to the sphere
// would distort their positions and miss genuine coincidences.
function flatDist(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Two triangles "share an edge" iff they have >= 2 coincident vertices.
function sharedVertexCount(v1: number[][], v2: number[][]): number {
  let n = 0;
  for (const a of v1) {
    for (const b of v2) {
      if (flatDist(a, b) < 1e-9) n++;
    }
  }
  return n;
}

// Tetrahedron vertices (mirrors src/index.ts) — for the determinism test.
const TETRA_VERTICES: [string, number[]][] = [
  ["v0", [0, 0, 1]],
  ["v1", [Math.sqrt(8 / 9), 0, -1 / 3]],
  ["v2", [-Math.sqrt(2 / 9), Math.sqrt(2 / 3), -1 / 3]],
  ["v3", [-Math.sqrt(2 / 9), -Math.sqrt(2 / 3), -1 / 3]],
];

describe("T4 Property & Edge-Case Tests", () => {
  describe("Neighbors across face boundaries", () => {
    // 1. Neighbor of a zoom-0 cell (a whole base face) lands on a DIFFERENT
    //    base face. Each base face has exactly 3 adjacent faces; the 3
    //    neighbors must be on those adjacent faces, never on itself.
    it("zoom-0 cell's neighbors land on the 3 adjacent base faces", () => {
      const adjacent: Record<number, number[]> = {
        0: [1, 2, 3],
        1: [0, 2, 3],
        2: [0, 1, 3],
        3: [0, 1, 2],
      };
      for (let face = 0; face < 4; face++) {
        const id = createT4Id(face, [], 0);
        const ns = getT4Neighbors(id);
        const neighborFaces = ns.map((n) => parseT4Id(n).baseFace).sort();
        expect(neighborFaces).toEqual(adjacent[face].slice().sort());
        // and none of them is the source face
        expect(neighborFaces).not.toContain(face);
      }
    });

    // 2. A corner cell (path all-zeros) sits with two of its edges ON a
    //    base-face boundary. At least one neighbor must cross to a different
    //    base face, and it must still share a full edge (2 vertices). This is
    //    the "neighbor on the other edge" scenario from the requirements.
    it("corner cell at base-face seam has a cross-face neighbor that still shares an edge", () => {
      const z = 12;
      const id = createT4Id(0, Array(z).fill(0), z);
      const v = getT4VerticesFlat(id);
      const ns = getT4Neighbors(id);
      const neighborFaces = ns.map((n) => parseT4Id(n).baseFace);

      // At least one neighbor is on a different base face.
      expect(neighborFaces.some((f) => f !== 0)).toBe(true);

      // EVERY neighbor (including the cross-face ones) must share an edge.
      for (const n of ns) {
        expect(sharedVertexCount(v, getT4VerticesFlat(n))).toBeGreaterThanOrEqual(2);
      }
    });

    // 3. Reflexive adjacency: if B is a neighbor of A, then A must be a
    //    neighbor of B — including across base-face seams at deep zoom.
    it("adjacency is reflexive across base-face seams", () => {
      for (let face = 0; face < 4; face++) {
        for (let trial = 0; trial < 200; trial++) {
          const path = Array.from({ length: 8 }, () => Math.floor(Math.random() * 4));
          const id = createT4Id(face, path, 8);
          const ns = getT4Neighbors(id);
          for (const n of ns) {
            const back = getT4Neighbors(n);
            expect(back).toContain(id);
          }
        }
      }
    });
  });

  describe("Subdivision structure", () => {
    // 4. The 4 children of any cell must exactly tile the parent: their
    //    combined vertex set (de-duplicated) is the parent's 3 corners plus
    //    the 3 edge midpoints — exactly 6 distinct points, bit-identical.
    it("children partition the parent into 6 distinct vertices (3 corners + 3 midpoints)", () => {
      const id = createT4Id(2, [0, 1, 3, 2], 4);
      const parentVerts = getT4VerticesFlat(id);
      const childVerts = getT4Children(id).map((c) => getT4VerticesFlat(c));

      const all: number[][] = [];
      for (const tri of childVerts) for (const p of tri) all.push(p);
      const dedup: number[][] = [];
      for (const p of all) {
        if (!dedup.some((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])) dedup.push(p);
      }
      expect(dedup).toHaveLength(6);

      // The 3 parent corners must appear verbatim among the children's verts.
      for (const corner of parentVerts) {
        const found = dedup.some((q) => q[0] === corner[0] && q[1] === corner[1] && q[2] === corner[2]);
        expect(found).toBe(true);
      }
    });

    // 11. The center child (subdivision index 3) is the inverted triangle
    //     formed from the 3 edge midpoints; it shares one full edge with each
    //     of the 3 corner children. This is the internal adjacency contract.
    it("center child (index 3) shares an edge with each corner child (0,1,2)", () => {
      const id = createT4Id(1, [2, 0, 1], 3);
      const childIds = getT4Children(id);
      const centerV = getT4VerticesFlat(childIds[3]);
      for (let i = 0; i < 3; i++) {
        const cornerV = getT4VerticesFlat(childIds[i]);
        expect(sharedVertexCount(centerV, cornerV)).toBe(2);
      }
    });
  });

  describe("Precision & determinism at extreme zoom", () => {
    // 5. At z28 (~5.5cm cells on Earth), the center must still round-trip
    //    back to the same cell id.
    it("center round-trip is stable at z28", () => {
      const lat = 60.1699;
      const lng = 24.9384;
      const id = latLngToT4(lat, lng, 28);
      const center = getT4Center(id);
      const back = latLngToT4(center[1], center[0], 28);
      expect(back).toBe(id);
    });

    // 6. A tetrahedron vertex is shared by 3 faces; the face assignment is a
    //    deterministic tie-break. Same input must always yield the same face.
    it("tetra-vertex projection is deterministic", () => {
      for (const [name, v] of TETRA_VERTICES) {
        const faces = new Set<number>();
        for (let i = 0; i < 50; i++) {
          faces.add(parseT4Id(cartesianToT4(v as Parameters<typeof cartesianToT4>[0], 5)).baseFace);
        }
        expect(faces.size).toBe(1);
        // Document which face wins (informational; pinning the current behavior).
        expect([...faces][0]).toBeGreaterThanOrEqual(0);
        expect([...faces][0]).toBeLessThanOrEqual(3);
        // sanity: known assignments observed during analysis
        if (name === "v0") expect([...faces][0]).toBe(0);
      }
    });

    // 12. Repeated indexing of the same input is bit-for-bit reproducible —
    //     no floating-point nondeterminism across calls.
    it("same input yields same id across 1000 calls", () => {
      const ids = new Set<bigint>();
      for (let i = 0; i < 1000; i++) {
        ids.add(latLngToT4(40.7128, -74.006, 15));
      }
      expect(ids.size).toBe(1);
    });
  });

  describe("Cache & options handling", () => {
    // 7. Regression guard for the cache-overwrite bug: Earth and Mars variants
    //    of the same cell id must coexist in the cache. Recreating the Earth
    //    variant after creating Mars must return the SAME Earth object.
    it("createT4 with mixed options does not evict the other variant", () => {
      const id = createT4Id(1, [0, 1, 2], 3);
      const earth = createT4(id, { radiusKm: 6371, applyEarthCurvature: true });
      const mars = createT4(id, { radiusKm: 3390, applyEarthCurvature: false });
      const earthAgain = createT4(id, { radiusKm: 6371, applyEarthCurvature: true });
      const marsAgain = createT4(id, { radiusKm: 3390, applyEarthCurvature: false });

      expect(earth).toBe(earthAgain); // same reference — cache preserved
      expect(mars).toBe(marsAgain);
      expect(earth).not.toBe(mars); // distinct variants
      expect(earth.radiusKm).toBe(6371);
      expect(mars.radiusKm).toBe(3390);
    });
  });

  describe("Zoom boundary handling", () => {
    // 8. Children at max zoom throws; parent at zoom 0 returns null.
    it("getT4Children throws at z28 and getParentT4Id returns null at z0", () => {
      const maxId = createT4Id(3, Array(28).fill(2), 28);
      expect(() => getT4Children(maxId)).toThrow();

      const rootId = createT4Id(0, [], 0);
      expect(getParentT4Id(rootId)).toBeNull();
    });
  });

  describe("Coordinate singularities", () => {
    // 9. Poles and the antimeridian must index to valid cells and round-trip.
    it.each([
      ["north pole", [90, 0]],
      ["south pole", [-90, 0]],
      ["antimeridian +180", [0, 180]],
      ["antimeridian -180", [0, -180]],
      ["origin", [0, 0]],
    ] as const)("%s produces a valid id and round-trips", (_name, [lat, lng]) => {
      const id = latLngToT4(lat, lng, 10);
      expect(isValidT4Id(id)).toBe(true);
      const center = getT4Center(id);
      const back = latLngToT4(center[1], center[0], 10);
      expect(back).toBe(id);
    });
  });

  describe("ID validation robustness", () => {
    // 10. isValidT4Id rejects malformed inputs that could come from
    //     corruption or misuse.
    it.each([
      ["zoom 29", (1n << 5n) | 29n],
      ["negative (-1n)", -1n],
      ["validity flag cleared", createT4Id(0, [], 0) & ~(1n << 5n)],
      ["stray high bit", createT4Id(0, [], 0) | (1n << 70n)],
      ["bare zero", 0n],
    ])("isValidT4Id rejects %s", (_name, id) => {
      expect(isValidT4Id(id)).toBe(false);
    });

    it("isValidT4Id accepts well-formed extremes", () => {
      expect(isValidT4Id(createT4Id(0, [], 0))).toBe(true);
      expect(isValidT4Id(createT4Id(3, Array(28).fill(2), 28))).toBe(true);
    });
  });
});
