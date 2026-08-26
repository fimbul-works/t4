import { describe, it, expect } from "vitest";
import {
  createT4Id,
  parseT4Id,
  getParentT4Id,
  isValidT4Id,
  isT4Descendant,
  geocentricToGeodetic,
  geodeticToGeocentric,
  getT4Vertices,
  getT4Center,
  getT4CellArea,
  unwarpAuthalicCorner,
  latLngToT4,
  getT4Neighbors,
  createT4,
} from "./index";
import { magnitude3D } from "@fimbul-works/vec/3d";

describe("T4 Indexer", () => {
  describe("Bitwise Operations", () => {
    it("should round-trip createT4Id and parseT4Id for Zoom 0", () => {
      for (let face = 0; face < 4; face++) {
        const id = createT4Id(face);
        expect(isValidT4Id(id)).toBe(true);

        const parsed = parseT4Id(id);
        expect(parsed.baseFace).toBe(face);
        expect(parsed.subdivisions).toEqual([]);
        expect(parsed.zoom).toBe(0);
        expect(parsed.isValid).toBe(true);
      }
    });

    it("should round-trip createT4Id and parseT4Id for zoom levels > 0", () => {
      const face = 2;
      const subdivisions = [0, 3, 1, 2, 3];
      const id = createT4Id(face, ...subdivisions);

      expect(isValidT4Id(id)).toBe(true);

      const parsed = parseT4Id(id);
      expect(parsed.baseFace).toBe(face);
      expect(parsed.subdivisions).toEqual(subdivisions);
      expect(parsed.zoom).toBe(5);
      expect(parsed.isValid).toBe(true);
    });

    it("should support array path input [baseFace, ...subdivisions]", () => {
      const path = [2, 0, 3, 1, 2, 3];
      const id = createT4Id(path);
      const parsed = parseT4Id(id);
      expect(parsed.baseFace).toBe(2);
      expect(parsed.subdivisions).toEqual([0, 3, 1, 2, 3]);
      expect(parsed.zoom).toBe(5);

      // Zoom 0 via single-element array
      const id0 = createT4Id([1]);
      const parsed0 = parseT4Id(id0);
      expect(parsed0.baseFace).toBe(1);
      expect(parsed0.zoom).toBe(0);
      expect(parsed0.subdivisions).toEqual([]);
    });

    it("should support spread / variadic path arguments (...path)", () => {
      const id = createT4Id(2, 0, 3, 1, 2, 3);
      const parsed = parseT4Id(id);
      expect(parsed.baseFace).toBe(2);
      expect(parsed.subdivisions).toEqual([0, 3, 1, 2, 3]);
      expect(parsed.zoom).toBe(5);

      // Using the spread operator directly
      const path = [3, 1, 2];
      const idSpread = createT4Id(...path);
      const parsedSpread = parseT4Id(idSpread);
      expect(parsedSpread.baseFace).toBe(3);
      expect(parsedSpread.subdivisions).toEqual([1, 2]);
      expect(parsedSpread.zoom).toBe(2);

      // Zoom 0 via single number
      const idSingle = createT4Id(2);
      const parsedSingle = parseT4Id(idSingle);
      expect(parsedSingle.baseFace).toBe(2);
      expect(parsedSingle.zoom).toBe(0);
    });

    it("should support omitting zoom when passing (baseFace, subdivisions)", () => {
      const id = createT4Id([1, 0, 3, 2]);
      const parsed = parseT4Id(id);
      expect(parsed.baseFace).toBe(1);
      expect(parsed.subdivisions).toEqual([0, 3, 2]);
      expect(parsed.zoom).toBe(3);
    });

    it("should support array path in createT4 factory", () => {
      const cell = createT4([2, 0, 3, 1]);
      expect(cell.zoom).toBe(3);
      const parsed = parseT4Id(cell.id);
      expect(parsed.baseFace).toBe(2);
      expect(parsed.subdivisions).toEqual([0, 3, 1]);
    });

    it("should throw on invalid arguments to createT4Id", () => {
      expect(() => (createT4Id as any)()).toThrow();
      expect(() => createT4Id([])).toThrow();
      expect(() => createT4Id([5, 0, 1])).toThrow();
      expect(() => createT4Id(0, 5)).toThrow();
    });

    it("should shift right by 62 bits to get the base face", () => {
      const face = 3;
      const id = createT4Id(face);
      const faceExtracted = Number((id >> 62n) & 3n);
      expect(faceExtracted).toBe(face);
    });

    it("should retrieve parent IDs correctly", () => {
      const id = createT4Id([1, 0, 3, 2]);

      const parent1 = getParentT4Id(id);
      expect(parent1).not.toBeNull();
      const parsedParent1 = parseT4Id(parent1!);
      expect(parsedParent1.zoom).toBe(2);
      expect(parsedParent1.subdivisions).toEqual([0, 3]);

      const parent2 = getParentT4Id(parent1!);
      expect(parent2).not.toBeNull();
      const parsedParent2 = parseT4Id(parent2!);
      expect(parsedParent2.zoom).toBe(1);
      expect(parsedParent2.subdivisions).toEqual([0]);

      const parent3 = getParentT4Id(parent2!);
      expect(parent3).not.toBeNull();
      const parsedParent3 = parseT4Id(parent3!);
      expect(parsedParent3.zoom).toBe(0);
      expect(parsedParent3.subdivisions).toEqual([]);

      const parent4 = getParentT4Id(parent3!);
      expect(parent4).toBeNull();
    });

    it("should check descendants correctly with isT4Descendant", () => {
      const parent = createT4Id([1, 0, 3]);
      const child = createT4Id([1, 0, 3, 2, 1]);
      const stranger = createT4Id([1, 0, 2, 2, 1]);
      const otherFace = createT4Id([2, 1, 0, 3, 2, 1]);

      expect(isT4Descendant(child, parent)).toBe(true);
      expect(isT4Descendant(stranger, parent)).toBe(false);
      expect(isT4Descendant(otherFace, parent)).toBe(false);
      expect(isT4Descendant(parent, child)).toBe(false);
      expect(isT4Descendant(parent, parent)).toBe(false);

      const root = createT4Id([1]);
      expect(isT4Descendant(child, root)).toBe(true);
      expect(isT4Descendant(otherFace, root)).toBe(false);
    });

    it("should fail validation on invalid IDs", () => {
      expect(isValidT4Id(0n)).toBe(false); // Validity flag not set
      expect(isValidT4Id(1n << 5n)).toBe(true); // Valid Zoom 0, Face 0

      // Zoom 29 is invalid
      expect(isValidT4Id((1n << 5n) | 29n)).toBe(false);

      // Active bit checking: unused bits in 6..61 must be zero
      const id = createT4Id([0]);
      const corruptedId = id | (1n << 9n);
      expect(isValidT4Id(corruptedId)).toBe(false);
    });
  });

  describe("Geodesic Projections", () => {
    it("should correctly project reference points", () => {
      // North Pole
      const npGeodetic = geocentricToGeodetic([0, 0, 1], true);
      expect(npGeodetic[0]).toBe(0);
      expect(npGeodetic[1]).toBe(90);

      // South Pole
      const spGeodetic = geocentricToGeodetic([0, 0, -1], true);
      expect(spGeodetic[0]).toBe(0);
      expect(spGeodetic[1]).toBe(-90);

      // Equator + Prime Meridian
      const eqPM = geocentricToGeodetic([1, 0, 0], true);
      expect(eqPM[0]).toBe(0);
      expect(eqPM[1]).toBe(0);

      // Equator + 90 East
      const eq90E = geocentricToGeodetic([0, 1, 0], true);
      expect(eq90E[0]).toBe(90);
      expect(eq90E[1]).toBe(0);
    });

    it("should verify the mathematical shift caused by Earth's bulge", () => {
      const geodeticInput: [number, number] = [0, 45];

      // With curvature: geocentric latitude should be ~44.807577 deg
      const withCurvatureCartesian = geodeticToGeocentric(geodeticInput, true);
      const withCurvatureGeocentric = geocentricToGeodetic(withCurvatureCartesian, false);
      expect(withCurvatureGeocentric[1]).toBeCloseTo(44.807577, 6);

      // Without curvature: geocentric latitude remains 45 deg
      const withoutCurvatureCartesian = geodeticToGeocentric(geodeticInput, false);
      const withoutCurvatureGeocentric = geocentricToGeodetic(withoutCurvatureCartesian, false);
      expect(withoutCurvatureGeocentric[1]).toBe(45);
    });

    it("should round-trip coordinates without curvature", () => {
      const original: [number, number] = [45.0, 30.0]; // [lng, lat]
      const cartesian = geodeticToGeocentric(original, false);
      expect(Math.abs(magnitude3D(cartesian) - 1.0)).toBeLessThan(1e-9);

      const recovered = geocentricToGeodetic(cartesian, false);
      expect(recovered[0]).toBeCloseTo(original[0], 5);
      expect(recovered[1]).toBeCloseTo(original[1], 5);
    });

    it("should round-trip coordinates with WGS84 curvature", () => {
      const original: [number, number] = [-122.4194, 37.7749]; // San Francisco [lng, lat]
      const cartesian = geodeticToGeocentric(original, true);
      expect(Math.abs(magnitude3D(cartesian) - 1.0)).toBeLessThan(1e-9);

      const recovered = geocentricToGeodetic(cartesian, true);
      expect(recovered[0]).toBeCloseTo(original[0], 5);
      expect(recovered[1]).toBeCloseTo(original[1], 5);
    });
  });

  describe("Subdivision & Lookup", () => {
    it("should resolve latLngToT4 and recover center coordinates close to input", () => {
      const lat = 40.7128;
      const lng = -74.006; // NYC
      const zoom = 15;

      const id = latLngToT4(lat, lng, zoom, { applyEarthCurvature: true });
      expect(isValidT4Id(id)).toBe(true);

      const parsed = parseT4Id(id);
      expect(parsed.zoom).toBe(zoom);

      const center = getT4Center(id, { applyEarthCurvature: true });
      expect(center[0]).toBeCloseTo(lng, 2);
      expect(center[1]).toBeCloseTo(lat, 2);
    });

    it("should verify that the center of the cell maps back to the same cell", () => {
      const id = createT4Id([1, 0, 3, 2, 1, 3]);
      const center = getT4Center(id, { applyEarthCurvature: true });

      const mappedId = latLngToT4(center[1], center[0], 5, { applyEarthCurvature: true });
      expect(mappedId).toBe(id);
    });

    it("should invert authalic corner warp with unwarpAuthalicCorner", () => {
      const origBary: [number, number, number] = [0.2, 0.5, 0.3];
      const unwarped = unwarpAuthalicCorner(origBary);
      expect(unwarped[0] + unwarped[1] + unwarped[2]).toBeCloseTo(1.0, 6);
    });
  });

  describe("Neighbors (Adjacency)", () => {
    it("should return exactly 3 valid neighbors", () => {
      const id = createT4Id([0, 1, 2, 3]);
      const neighbors = getT4Neighbors(id);

      expect(neighbors).toHaveLength(3);
      for (const n of neighbors) {
        expect(isValidT4Id(n)).toBe(true);
        const parsedN = parseT4Id(n);
        expect(parsedN.zoom).toBe(3);
      }
    });

    it("should verify that neighbors are adjacent (share 2 vertices)", () => {
      const id = createT4Id([0, 2, 1]);
      const vertices = getT4Vertices(id, { authalicWarp: false });

      const neighbors = getT4Neighbors(id);
      for (const neighborId of neighbors) {
        const neighborVertices = getT4Vertices(neighborId, { authalicWarp: false });
        let sharedCount = 0;
        for (const v1 of vertices) {
          for (const v2 of neighborVertices) {
            const dist = Math.sqrt((v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2);
            if (dist < 1e-4) {
              sharedCount++;
            }
          }
        }
        expect(sharedCount).toBe(2);
      }
    });
  });

  describe("Spherical Cell Area", () => {
    it("should calculate valid area for zoom 0 face", () => {
      const id = createT4Id(0);
      const area = getT4CellArea(id, 6371.0);
      // Total Earth sphere area = 4 * PI * R^2 ~ 510,064,472 km^2
      // Each base face of regular tetrahedron covers exactly 1/4 of the sphere = ~127,516,118 km^2
      const totalEarthArea = 4 * Math.PI * 6371.0 * 6371.0;
      expect(area).toBeCloseTo(totalEarthArea / 4, -4);
    });

    it("should partition area among child cells and decrease with zoom", () => {
      const id0 = createT4Id(0);
      const a0 = getT4CellArea(id0);

      const c0 = getT4CellArea(createT4Id([0, 0]));
      const c1 = getT4CellArea(createT4Id([0, 1]));
      const c2 = getT4CellArea(createT4Id([0, 2]));
      const c3 = getT4CellArea(createT4Id([0, 3]));

      expect(c0).toBeGreaterThan(0);
      expect(c1).toBeGreaterThan(0);
      expect(c2).toBeGreaterThan(0);
      expect(c3).toBeGreaterThan(0);
      expect(Math.abs(c0 + c1 + c2 + c3 - a0) / a0).toBeLessThan(0.001);

      const id2 = createT4Id([0, 0, 0]);
      const a2 = getT4CellArea(id2);
      expect(a2).toBeLessThan(c0);
    });
  });

  describe("OOP Wrapper & Caching", () => {
    it("should memoize and retrieve objects from the WeakRef cache", () => {
      const config = { baseFace: 1, subdivisions: [0, 3], zoom: 2 };
      const t4_1 = createT4(config);
      const t4_2 = createT4(t4_1.id);

      expect(t4_1).toBe(t4_2); // same object instance reference
      expect(t4_1.zoom).toBe(2);
      expect(t4_1.authalicWarp).toBe(true);
      expect(t4_1.area).toBeGreaterThan(0);
    });

    it("should return parent, neighbors, and children as cached T4Objects", () => {
      const id = createT4Id([2, 0, 1, 2]);
      const t4 = createT4(id);

      const parent = t4.parent;
      expect(parent).not.toBeNull();
      expect(parent!.zoom).toBe(2);
      expect(t4.isDescendantOf(parent!)).toBe(true);

      const neighbors = t4.neighbors;
      expect(neighbors).toHaveLength(3);
      for (const n of neighbors) {
        expect(n.zoom).toBe(3);
      }

      const children = t4.children;
      expect(children).toHaveLength(4);
      children.forEach((c, idx) => {
        expect(c.zoom).toBe(4);
        const parsed = parseT4Id(c.id);
        expect(parsed.subdivisions[3]).toBe(idx);
        expect(c.isDescendantOf(t4)).toBe(true);
      });

      const childrenMethod = t4.getChildren();
      expect(childrenMethod).toEqual(children);

      const childIds = t4.childIds;
      expect(childIds).toEqual(children.map((c) => c.id));
    });
  });
});
