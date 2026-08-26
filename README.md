![T4](./T4.png)

T4 is a hierarchical spatial indexing system for spheres, built on a recursively subdivided [tetrahedron](https://en.wikipedia.org/wiki/Tetrahedron) projected onto the sphere's surface. Every point on the sphere resolves to a compact BigInt ID that encodes its face, its subdivision path, and its zoom level — no lookup tables, no floating-point drift, just bit-packed geometry.

It converts freely between GPS coordinates, geocentric Cartesian vectors, and T4 IDs, and lets you walk the resulting grid via parents, children, and edge-sharing neighbors.

Whether you're building planetary datasets, game-world spatial partitioning, or a discrete global grid for geospatial queries, T4 gives you a compact, deterministic address for any point on any sphere.

[![npm version](https://badge.fury.io/js/%40fimbul-works%2Ft4.svg)](https://www.npmjs.com/package/@fimbul-works/t4)
[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/microsoft/TypeScript)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@fimbul-works/t4)](https://bundlephobia.com/package/@fimbul-works/t4)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Why T4?](#why-t4)
- [Core Concepts](#core-concepts)
- [Documentation](#documentation)
- [Example: Geocoding a Point](#example-geocoding-a-point)
- [Advanced Usage](#advanced-usage)
- [License](#license)

## Features

- 🌐 Hierarchical spatial indexing on any sphere, not just Earth
- 🧊 Compact BigInt IDs — face, subdivision path, and zoom packed into a single integer
- 🔁 Bidirectional conversion between GPS, geocentric Cartesian, and T4 IDs
- 🌳 Constant-time parent, children, and neighbor lookups via bit arithmetic
- 🌍 Optional WGS84 Earth curvature correction, toggleable per call
- ♻️ Memoized `T4Object` instances via WeakRef, so repeated lookups don't reallocate
- 📦 Minimal footprint, built on `@fimbul-works/vec`

## Installation

```bash
npm install @fimbul-works/t4
# or
yarn add @fimbul-works/t4
# or
pnpm install @fimbul-works/t4
```

## Quick Start

```typescript
import { latLngToT4, getT4Vertices, getT4Center, createT4 } from '@fimbul-works/t4';

// Convert a GPS coordinate to a T4 cell at zoom level 12
const id = latLngToT4(60.1699, 24.9384, 12); // Helsinki

// Get the cell's GPS vertices and center
console.log(getT4Vertices(id)); // [[lng, lat], [lng, lat], [lng, lat]]
console.log(getT4Center(id));   // [lng, lat]

// Or work with the OOP wrapper for convenient traversal
const cell = createT4(id);
console.log(cell.zoom);      // 12
console.log(cell.parent.id); // parent cell's BigInt ID
console.log(cell.neighbors); // [T4Object, T4Object, T4Object]
console.log(cell.children);  // [T4Object, T4Object, T4Object, T4Object]
```

## Why T4?

Unlike quadtree-on-cube or hexagon-based discrete global grids, T4 gives you:
- **Simplicity** — a regular tetrahedron has just 4 faces and quadrisects cleanly, so every cell is a triangle and every subdivision is one of exactly 4 cases
- **Compact addressing** — an entire cell's lineage (face, path, zoom) lives in one BigInt, cheap to store, compare, and sort
- **Sphere-agnostic** — Earth curvature correction is optional, so the same grid works for perfect spheres: planets, moons, or procedurally generated worlds
- **Predictable traversal** — parent/child/neighbor lookups are bit-shifts and small geometric solves, not table lookups

## Core Concepts

### The Base Tetrahedron

T4 starts from a regular tetrahedron inscribed in the unit sphere, giving 4 base faces (0–3). Every T4 cell traces back to one of these faces.

### Subdivision

Each face recursively quadrisects into 4 child triangles per zoom level: 3 "corner" triangles (indices 0–2) and 1 "center" triangle (index 3), formed from the edge midpoints. A cell's full address is its base face plus a sequence of subdivision indices, one per zoom level.

### T4 IDs

A T4 ID is a single 64-bit BigInt packing:
- **Bits 63..62**: Base face (0–3)
- **Bits 61..6**: Fixed-position subdivision indices (2 bits per zoom level, starting with subdivision 0 at bit 60 down to subdivision 27 at bit 6)
- **Bit 5**: Validity flag (always 1 for valid IDs)
- **Bits 4..0**: Zoom level (0–28)

This fixed-position layout enables $O(1)$ constant-time ancestor checks (`isT4Descendant`), mask-based parent and child generation, and exact discrete coordinate indexing without bit-shifting the path.

### Zoom Levels

Zoom ranges from 0 (a whole base face) to 28. Each level quadruples the number of cells, giving increasingly fine-grained coverage of the sphere.

### Earth Curvature

By default, GPS conversions apply the WGS84 oblate spheroid correction so T4 IDs align with real-world Earth coordinates. Pass `applyEarthCurvature: false` to treat the sphere as a perfect sphere — useful for non-Earth bodies or synthetic worlds.

## Documentation

For detailed API documentation, see the [API Reference](docs/README.md).

## Example: Geocoding a Point

A complete round trip from GPS coordinates to a T4 cell and back, showing how the grid can anchor real-world data to a stable spatial index.

```typescript
import { latLngToT4, getT4Center, getT4Vertices, parseT4Id } from '@fimbul-works/t4';

// Index a point at zoom 10
const id = latLngToT4(51.5074, -0.1278, 10); // London

// Inspect its address
const { baseFace, subdivisions, zoom } = parseT4Id(id);
console.log({ baseFace, subdivisions, zoom });
```
At zoom 10, each cell covers a few kilometers, small enough for city-scale indexing while staying a single BigInt comparison away from any neighbor.

```typescript
// Recover the cell's centroid and boundary
console.log(getT4Center(id));   // approx [-0.1278, 51.5074]
console.log(getT4Vertices(id)); // triangle boundary in [lng, lat] pairs
```

The center approximates the original point; the vertices trace the exact triangular cell that contains it.

### Walking the Grid

```typescript
import { createT4 } from '@fimbul-works/t4';

const cell = createT4(id);

// Step up to a coarser cell
const parent = cell.parent;

// Step down to the 4 finer cells it contains
const children = cell.children;

// Step sideways to the 3 cells sharing its edges
const neighbors = cell.neighbors;
```

This demonstrates T4's core value: once a point is indexed, every spatial relationship — coarser, finer, or adjacent — is a cheap, deterministic lookup.

## Advanced Usage

### Non-Earth Spheres

```typescript
// Index a point on a synthetic planet with a 3390km radius (Mars-scale),
// treating it as a perfect sphere
const id = latLngToT4(10, 45, 8, { applyEarthCurvature: false });
const cell = createT4(id, { radiusKm: 3390, applyEarthCurvature: false });

console.log(cell.center3D); // Cartesian center in km
```

### Working with Cartesian Vectors Directly

```typescript
import { cartesianToT4, geodeticToGeocentric } from '@fimbul-works/t4';

const P = geodeticToGeocentric([24.9384, 60.1699], true);
const id = cartesianToT4(P, 14);
```

### ID Validation

```typescript
import { isValidT4Id, createT4Id } from '@fimbul-works/t4';

const id = createT4Id(0, [1, 2, 3], 3);
console.log(isValidT4Id(id)); // true
console.log(isValidT4Id(1n)); // false
```

### Error Handling

```typescript
// Zoom out of range
createT4Id(0, [], 30); // Error: "Zoom must be between 0 and 28"

// Requesting children past the maximum zoom
getT4Children(createT4Id(0, Array(28).fill(0), 28)); // Error: "Cannot get children..."
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

Built with ⚡ by [FimbulWorks](https://github.com/fimbul-works)
