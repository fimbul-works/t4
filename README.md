![T4](./T4.png)

**T4** is a hierarchical spatial indexing system for spheres, built on a recursively subdivided [tetrahedron](https://en.wikipedia.org/wiki/Tetrahedron) projected onto the sphere's surface. Every point on the sphere resolves to a compact `BigInt` ID that encodes its face, its subdivision path, and its zoom level — no lookup tables, no floating-point drift, just bit-packed geometry.

It converts freely between GPS coordinates, geocentric Cartesian vectors, and T4 IDs, and lets you walk the resulting grid via parents, children, and edge-sharing neighbors. **T4's hierarchy is strictly geometric**: every parent cell is exactly partitioned into four child cells, giving the index predictable multi-resolution containment without cross-resolution overlap.

Whether you're building planetary datasets, game-world spatial partitioning, or a discrete global grid for geospatial queries, T4 gives you a compact, deterministic address for any point on any sphere.

[![npm version](https://badge.fury.io/js/%40fimbul-works%2Ft4.svg)](https://www.npmjs.com/package/@fimbul-works/t4)
[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/microsoft/TypeScript)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@fimbul-works/t4)](https://bundlephobia.com/package/@fimbul-works/t4)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Why T4?](#why-t4)
- [Performance Benchmarks (vs. Uber H3)](#performance-benchmarks-vs-uber-h3)
- [When to Use T4?](#when-to-use-t4)
- [Core Concepts](#core-concepts)
- [Documentation](#documentation)
- [Example: Geocoding a Point](#example-geocoding-a-point)
- [Advanced Usage](#advanced-usage)
- [License](#license)

## Features

- 🌐 Hierarchical spatial indexing on any sphere, not just Earth
- 🧊 Compact `BigInt` IDs — face, subdivision path, and zoom packed into a single integer
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

T4 uses a different geometric model from hexagonal and cube-based global grids: a regular tetrahedron is recursively quadrisected after projection onto a sphere, producing a triangular hierarchy with strict 1→4 containment.

### Geometric Model

- **Strict 1→4 hierarchy** - Every parent triangle is exactly partitioned into four child triangles. A child's geometric footprint is fully contained within its parent, making multi-resolution aggregation and spatial hierarchy straightforward.
- **Sphere-agnostic geometry** - T4 can operate on a perfect sphere or apply WGS84 Earth curvature correction. The same indexing system can therefore represent Earth, other planetary bodies, or arbitrary spherical game worlds.
- **Triangular topology** - Every cell has exactly three edge-sharing neighbors, and the entire hierarchy derives from the topology of four tetrahedral base faces.

### Compact Addressing

- **Simplicity** - A regular tetrahedron has just 4 faces and quadrisects cleanly, so every cell is a triangle and every subdivision is one of exactly 4 cases.
- **Compact addressing** - An entire cell's lineage (face, path, zoom) lives in one `BigInt`, cheap to store, compare, and sort.
- **Predictable traversal** - Parent, child, descendant, and neighbor relationships can be resolved directly from the encoded topology rather than requiring spatial lookup tables.

## Performance Benchmarks (vs. Uber H3)

T4 is designed around compact bit-packed IDs and direct topological operations. The benchmark below compares the TypeScript implementation of T4 against Uber's `h3-js` v4.5.0 using Node.js.

The benchmark covers hierarchical operations, spatial conversion, geometry, and topology rather than a single synthetic operation. Results are machine-dependent, so the included benchmark suite can be run locally with `pnpm benchmark:h3` or `pnpm benchmark`.

| Operation | **T4** Avg Time | **T4** Ops/sec | **Uber H3** Avg Time | **Uber H3** Ops/sec | **T4 vs H3 Speedup** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ID -> Children`** | **0.1795 µs** | **5,570,118** | 1.8054 µs | 553,898 | **10.06x FASTER** 🚀 |
| **`ID -> Parent`** | **0.1104 µs** | **9,059,138** | 0.3136 µs | 3,188,407 | **2.84x FASTER** 🚀 |
| **`isValid`** | **0.0710 µs** | **14,083,240** | 0.1528 µs | 6,545,928 | **2.15x FASTER** 🚀 |
| **`latLng -> ID (raw)`** | **0.3630 µs** | **2,754,735** | 0.7251 µs | 1,379,149 | **2.00x FASTER** 🚀 |
| **`Cell Area`** | **0.9374 µs** | **1,066,742** | 1.6083 µs | 621,757 | **1.72x FASTER** 🚀 |
| **`ID -> Boundary`** | **0.8884 µs** | **1,125,640** | 1.4747 µs | 678,106 | **1.66x FASTER** 🚀 |
| **`ID -> Neighbors`** | **1.3262 µs** | **754,041** | 1.5571 µs | 642,204 | **1.17x FASTER** 🚀 |
| **`ID -> Centroid`** | **0.7085 µs** | **1,411,415** | 0.5072 µs | 1,971,543 | 0.72x |
| **`latLng -> ID (warped)`** | **2.0080 µs** | **498,020** | 0.9388 µs | 1,065,139 | 0.47x *(8-step Newton unwarp)* |

Overall, T4's direct bit-packed topology gives it a substantial throughput advantage for most indexing and hierarchy operations in this benchmark, while retaining strict 1→4 geometric containment and configurable spherical/ellipsoidal coordinate handling. The full WGS84 warped conversion is intentionally more computationally expensive due to its numerical inverse transform.

## When to Use T4?

Spatial indexing systems involve fundamental geometric trade-offs. T4 was designed to solve key architectural and computational limitations found in hexagon- (H3) and cube-based (S2) grids:

### 1. 3D Game Engines & Procedural Planets (Godot, Unreal, WebGL)
- **Direct GPU Triangle Meshes**: GPUs rasterize triangles natively. A T4 cell is directly an indexed triangular mesh (`[v0, v1, v2]`), requiring zero polygon triangulation before uploading to vertex buffers (VBOs).
- **Dual Marching Tetrahedra (DMT) & Volumetric Chunks**: Slicing T4 triangular prisms along radial altitude layers creates simplicial tetrahedral meshes with **zero topological ambiguity** (eliminating Marching Cubes hole/crack bugs) and clean adaptive Level-of-Detail (LOD).
- **No 12 Degenerate Pentagons**: Unlike icosahedral systems (H3) that have 12 pentagonal singularities requiring special-case stitching, T4 has 4 completely homogeneous base faces.

### 2. Strict Hierarchies & Multi-Resolution Aggregation

- **Exact 1→4 containment** - Every T4 parent is partitioned into exactly four child triangles, with each child fully contained within its parent. This makes the hierarchy geometrically explicit rather than an approximation between resolutions.
- **$O(1)$ ancestry queries** - Checking whether cell B is a descendant of cell A is a mask comparison against the packed subdivision path.
- **Deterministic hierarchy** - A cell's complete lineage is encoded directly in its ID, allowing parent and child relationships to be derived without external hierarchy tables.

### 3. Centimeter-Scale Resolution in a Single 64-bit Integer

- **28 zoom levels** - Zoom 28 reaches approximately $\sim 5.5\text{ cm}$ cell width on Earth, while the complete cell address remains encoded in a single 64-bit `BigInt`.
- **Predictable scaling** - Each additional zoom level quadrisects the cells, providing four times as many cells per level and roughly halving characteristic cell dimensions.

### 4. Non-Earth Planetary Bodies & Custom Spheres
- T4 allows configuring the sphere radius and toggling ellipsoidal flattening (`applyEarthCurvature: false`), enabling seamless indexing of moons, asteroids, exoplanets, or synthetic game worlds.

---

### When to Consider Hexagons (H3) Instead?
- **Radial Smoothing & Spatial Convolution**: Hexagons have equidistant centers to all 6 neighbors. If your primary use case is kernel density estimation, equal-distance spatial buffering, or isotropic diffusion analysis, hexagonal grids are mathematically advantageous.

## Core Concepts

### The Base Tetrahedron

T4 starts from a regular tetrahedron inscribed in the unit sphere, giving 4 base faces (0–3). Every T4 cell traces back to one of these faces.

### Subdivision

Each face recursively quadrisects into 4 child triangles per zoom level: 3 "corner" triangles (indices 0–2) and 1 "center" triangle (index 3), formed from the edge midpoints. A cell's full address is its base face plus a sequence of 2-bit subdivision indices, one per zoom level, packed directly into the ID.

### T4 IDs

A T4 ID is a single 64-bit `BigInt` packing:
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
At zoom 10, each cell covers a few kilometers, small enough for city-scale indexing while staying a single `BigInt` comparison away from any neighbor.

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

### Creating & Validating T4 IDs

`createT4Id` accepts path arrays `[baseFace, ...subdivisions]` or variadic arguments `(baseFace, ...subdivisions)`:

```typescript
import { createT4Id, isValidT4Id } from '@fimbul-works/t4';

// 1. Full path array [baseFace, ...subdivisions]
const id1 = createT4Id([0, 1, 2, 3]); // Face 0, subdivisions [1, 2, 3] (zoom 3)

// 2. Spread / Variadic arguments
const id2 = createT4Id(0, 1, 2, 3);
const path = [0, 1, 2, 3];
const id3 = createT4Id(...path);

// 3. Zoom 0 (base face only)
const rootId = createT4Id([2]); // or createT4Id(2)

console.log(isValidT4Id(id1)); // true
console.log(isValidT4Id(1n));  // false
```

### Error Handling

```typescript
// Zoom out of range (> 28)
createT4Id(Array(31).fill(0)); // Error: "Zoom must be between 0 and 28"

// Requesting children past maximum zoom
getT4Children(createT4Id(Array(29).fill(0))); // Error: "Cannot get children..."
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

Built with ⚡ by [FimbulWorks](https://github.com/fimbul-works)
