import { describe, expect, it } from "vitest";
import {
  cartesianToT4,
  createT4,
  createT4Id,
  geodeticToGeocentric,
  getParentT4Id,
  getT4Center,
  getT4Children,
  getT4Vertices,
  isValidT4Id,
  latLngToT4,
  parseT4Id,
  getRecommendedT4Zoom,
} from "./index";

describe("README.md Example Code Verification", () => {
  it("Quick Start example works as documented", () => {
    // Convert a GPS coordinate to a T4 cell at zoom level 12
    const id = latLngToT4(60.1699, 24.9384, 12); // Helsinki
    expect(typeof id).toBe("bigint");
    expect(isValidT4Id(id)).toBe(true);

    // Get the cell's GPS vertices and center
    const vertices = getT4Vertices(id);
    expect(vertices).toHaveLength(3);
    expect(vertices[0]).toHaveLength(2); // [lng, lat]
    expect(vertices[0][0]).toBeCloseTo(24.9384, 1);
    expect(vertices[0][1]).toBeCloseTo(60.1699, 1);

    const center = getT4Center(id);
    expect(center).toHaveLength(2); // [lng, lat]
    expect(center[0]).toBeCloseTo(24.9384, 1);
    expect(center[1]).toBeCloseTo(60.1699, 1);
    expect(latLngToT4(center[1], center[0], 12)).toBe(id);

    // Or work with the OOP wrapper for convenient traversal
    const cell = createT4(id);
    expect(cell.zoom).toBe(12);
    expect(cell.parent).not.toBeNull();
    expect(cell.parent!.id).toBe(getParentT4Id(id));
    expect(cell.neighbors).toHaveLength(3);
    expect(cell.children).toHaveLength(4);
    expect(cell.children[0].zoom).toBe(13);
  });

  it("Example: Geocoding a Point (London) works as documented", () => {
    // Index a point at zoom 10
    const id = latLngToT4(51.5074, -0.1278, 10); // London

    // Inspect its address
    const { baseFace, subdivisions, zoom } = parseT4Id(id);
    expect(baseFace).toBeGreaterThanOrEqual(0);
    expect(baseFace).toBeLessThanOrEqual(3);
    expect(subdivisions).toHaveLength(10);
    expect(zoom).toBe(10);

    // Recover the cell's centroid and boundary
    const center = getT4Center(id); // approx [-0.1278, 51.5074]
    expect(center[0]).toBeCloseTo(-0.1278, 0);
    expect(center[1]).toBeCloseTo(51.5074, 0);
    expect(latLngToT4(center[1], center[0], 10)).toBe(id);

    const vertices = getT4Vertices(id); // triangle boundary in [lng, lat] pairs
    expect(vertices).toHaveLength(3);
  });

  it("Walking the Grid example works as documented", () => {
    const id = latLngToT4(51.5074, -0.1278, 10);
    const cell = createT4(id);

    // Step up to a coarser cell
    const parent = cell.parent;
    expect(parent).not.toBeNull();
    expect(parent!.zoom).toBe(9);

    // Step down to the 4 finer cells it contains
    const children = cell.children;
    expect(children).toHaveLength(4);
    for (const child of children) {
      expect(child.zoom).toBe(11);
      expect(child.parent!.id).toBe(cell.id);
    }

    // Step sideways to the 3 cells sharing its edges
    const neighbors = cell.neighbors;
    expect(neighbors).toHaveLength(3);
    for (const neighbor of neighbors) {
      expect(neighbor.zoom).toBe(10);
    }
  });

  it("Non-Earth Spheres example works as documented", () => {
    // Index a point on a synthetic planet with a 3390km radius (Mars-scale),
    // treating it as a perfect sphere
    const id = latLngToT4(10, 45, 8, { applyEarthCurvature: false });
    const cell = createT4(id, { radiusKm: 3390, applyEarthCurvature: false });

    expect(cell.radiusKm).toBe(3390);
    expect(cell.applyEarthCurvature).toBe(false);

    const center3D = cell.center3D; // Cartesian center in km
    expect(center3D).toHaveLength(3);
    const dist = Math.hypot(center3D[0], center3D[1], center3D[2]);
    expect(dist).toBeCloseTo(3390, 1);
  });

  it("Working with Cartesian Vectors Directly example works as documented", () => {
    const P = geodeticToGeocentric([24.9384, 60.1699], true);
    expect(P).toHaveLength(3);
    const len = Math.hypot(P[0], P[1], P[2]);
    expect(len).toBeCloseTo(1.0, 5);

    const id = cartesianToT4(P, 14);
    expect(isValidT4Id(id)).toBe(true);
    expect(parseT4Id(id).zoom).toBe(14);
  });

  it("Creating & Validating T4 IDs example works as documented", () => {
    // 1. Full path array [baseFace, ...subdivisions]
    const id1 = createT4Id([0, 1, 2, 3]); // Face 0, subdivisions [1, 2, 3] (zoom 3)
    expect(isValidT4Id(id1)).toBe(true);
    const p1 = parseT4Id(id1);
    expect(p1.baseFace).toBe(0);
    expect(p1.subdivisions).toEqual([1, 2, 3]);
    expect(p1.zoom).toBe(3);

    // 2. Spread / Variadic arguments
    const id2 = createT4Id(0, 1, 2, 3);
    expect(id2).toBe(id1);

    const path = [0, 1, 2, 3];
    const id3 = createT4Id(...path);
    expect(id3).toBe(id1);

    // 3. Zoom 0 (base face only)
    const rootId = createT4Id([2]);
    const rootId2 = createT4Id(2);
    expect(rootId).toBe(rootId2);
    expect(parseT4Id(rootId).baseFace).toBe(2);
    expect(parseT4Id(rootId).zoom).toBe(0);

    expect(isValidT4Id(id1)).toBe(true);
    expect(isValidT4Id(1n)).toBe(false);
  });

  it("Error Handling examples work as documented", () => {
    // Zoom out of range (> 28)
    expect(() => createT4Id(Array(31).fill(0))).toThrowError("Zoom must be between 0 and 28");

    // Requesting children past maximum zoom
    expect(() => getT4Children(createT4Id(Array(29).fill(0)))).toThrowError("Cannot get children");
  });

  it("Determining Recommended Zoom Level example works as documented", () => {
    const zoom = getRecommendedT4Zoom(60.1699, 24.9384);
    expect(zoom).toBe(21);
    const id = latLngToT4(60.1699, 24.9384, zoom);
    expect(isValidT4Id(id)).toBe(true);

    expect(getRecommendedT4Zoom([24.9384, 60.1699])).toBe(21);
    expect(getRecommendedT4Zoom({ lat: 60.1699, lng: 24.9384 })).toBe(21);
    expect(getRecommendedT4Zoom("60.169900", "24.938400")).toBe(28);
  });
});
