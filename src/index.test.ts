import { describe, it, expect } from "vitest";
import {
  createT4Id,
  parseT4Id,
  getParentT4Id,
  isValidT4Id,
  geocentricToGeodetic,
  geodeticToGeocentric,
  getT4Vertices,
  getT4Center,
  latLngToT4,
  getT4Neighbors,
  createT4,
  getT4Children,
} from "./index";
import { magnitude3D } from "@fimbul-works/vec/3d";

describe("T4 Indexer", () => {
  describe("Bitwise Operations", () => {
    it("should round-trip createT4Id and parseT4Id for Zoom 0", () => {
      for (let face = 0; face < 4; face++) {
        const id = createT4Id(face, [], 0);
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
      const id = createT4Id(face, subdivisions, 5);

      expect(isValidT4Id(id)).toBe(true);

      const parsed = parseT4Id(id);
      expect(parsed.baseFace).toBe(face);
      expect(parsed.subdivisions).toEqual(subdivisions);
      expect(parsed.zoom).toBe(5);
      expect(parsed.isValid).toBe(true);
    });

    it("should shift right by 6 bits to get the base face at zoom 0", () => {
      const face = 3;
      const id = createT4Id(face, [], 0);
      const faceExtracted = Number(id >> 6n);
      expect(faceExtracted).toBe(face);
    });

    it("should retrieve parent IDs correctly", () => {
      const id = createT4Id(1, [0, 3, 2], 3);

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

    it("should fail validation on invalid IDs", () => {
      expect(isValidT4Id(0n)).toBe(false); // Validity flag not set
      expect(isValidT4Id(1n << 5n)).toBe(true); // Valid Zoom 0, Face 0

      // Zoom 29 is invalid
      expect(isValidT4Id((1n << 5n) | 29n)).toBe(false);

      // Active bit checking
      const id = createT4Id(0, [], 0);
      // set bit 9 (which is inactive at Zoom 0)
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
      // At geodetic latitude 45 degrees, curvature should shift geocentric latitude
      // to atan((1 - f)^2 * tan(45)) = atan((1 - 1/298.257223563)^2) ~ 44.807897 degrees
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
      // At zoom 15, the triangle should be very small, so its center should be extremely close to the input point
      expect(center[0]).toBeCloseTo(lng, 2);
      expect(center[1]).toBeCloseTo(lat, 2);
    });

    it("should verify that the center of the cell maps back to the same cell", () => {
      const id = createT4Id(1, [3, 2, 0, 1, 3], 5);
      const center = getT4Center(id, { applyEarthCurvature: true });

      const mappedId = latLngToT4(center[1], center[0], 5, { applyEarthCurvature: true });
      expect(mappedId).toBe(id);
    });
  });

  describe("Neighbors (Adjacency)", () => {
    it("should return exactly 3 valid neighbors", () => {
      const id = createT4Id(0, [1, 2, 3], 3);
      const neighbors = getT4Neighbors(id);

      expect(neighbors).toHaveLength(3);
      for (const n of neighbors) {
        expect(isValidT4Id(n)).toBe(true);
        const parsedN = parseT4Id(n);
        expect(parsedN.zoom).toBe(3);
      }
    });

    it("should verify that neighbors are adjacent (share 2 vertices)", () => {
      const id = createT4Id(0, [2, 1], 2);
      const vertices = getT4Vertices(id);

      const neighbors = getT4Neighbors(id);
      for (const neighborId of neighbors) {
        const neighborVertices = getT4Vertices(neighborId);
        // Count shared vertices
        let sharedCount = 0;
        for (const v1 of vertices) {
          for (const v2 of neighborVertices) {
            const dist = Math.sqrt((v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2);
            if (dist < 1e-4) {
              sharedCount++;
            }
          }
        }
        // Adjacent triangles must share exactly 2 vertices (1 edge)
        expect(sharedCount).toBe(2);
      }
    });
  });

  describe("OOP Wrapper & Caching", () => {
    it("should memoize and retrieve objects from the WeakRef cache", () => {
      const config = { baseFace: 1, subdivisions: [0, 3], zoom: 2 };
      const t4_1 = createT4(config);
      const t4_2 = createT4(t4_1.id);

      expect(t4_1).toBe(t4_2); // same object instance reference
      expect(t4_1.zoom).toBe(2);
    });

    it("should return parent, neighbors, and children as cached T4Objects", () => {
      const id = createT4Id(2, [0, 1, 2], 3);
      const t4 = createT4(id);

      const parent = t4.parent;
      expect(parent).not.toBeNull();
      expect(parent!.zoom).toBe(2);

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
      });

      const childrenMethod = t4.getChildren();
      expect(childrenMethod).toEqual(children);

      const childIds = t4.childIds;
      expect(childIds).toEqual(children.map((c) => c.id));
    });
  });
});
