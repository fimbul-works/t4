# @fimbul-works/t4

## Interfaces

### ParsedT4Id

Defined in: [index.ts:358](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L358)

A parsed T4 ID.

#### Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="property-baseface"></a> `baseFace` | `readonly` | `number` | The base face of the T4 ID. | [index.ts:360](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L360) |
| <a id="property-isvalid"></a> `isValid` | `readonly` | `boolean` | Whether the T4 ID is valid. | [index.ts:366](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L366) |
| <a id="property-subdivisions"></a> `subdivisions` | `readonly` | readonly `number`[] | The subdivisions of the T4 ID. | [index.ts:362](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L362) |
| <a id="property-zoom"></a> `zoom` | `readonly` | `number` | The zoom level of the T4 ID. | [index.ts:364](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L364) |

***

### T4Cell

Defined in: [index.ts:211](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L211)

A traversable T4 cell.

#### Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="property-applyearthcurvature"></a> `applyEarthCurvature` | `readonly` | `boolean` | Whether to apply Earth curvature correction. | [index.ts:219](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L219) |
| <a id="property-area"></a> `area` | `readonly` | `number` | The area of the cell. | [index.ts:235](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L235) |
| <a id="property-authalicwarp"></a> `authalicWarp` | `readonly` | `boolean` | Whether the cell is warped to the sphere's surface (authalic warp). | [index.ts:221](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L221) |
| <a id="property-center"></a> `center` | `readonly` | `ArrayVector2D` | The 2D center of the cell (longitude, latitude) in degrees. | [index.ts:225](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L225) |
| <a id="property-center2d"></a> `center2D` | `readonly` | `ArrayVector2D` | The 2D center of the cell (longitude, latitude) in the flat tetrahedral domain. | [index.ts:229](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L229) |
| <a id="property-center3d"></a> `center3D` | `readonly` | `ArrayVector3D` | The 3D center of the cell (x, y, z) in Cartesian coordinates. | [index.ts:233](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L233) |
| <a id="property-childids"></a> `childIds` | `readonly` | \[`bigint`, `bigint`, `bigint`, `bigint`\] | The IDs of the children of this cell. | [index.ts:243](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L243) |
| <a id="property-children"></a> `children` | `readonly` | \[[`T4Cell`](#t4cell), [`T4Cell`](#t4cell), [`T4Cell`](#t4cell), [`T4Cell`](#t4cell)\] | The children of this cell (four sub-cells). | [index.ts:241](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L241) |
| <a id="property-id"></a> `id` | `readonly` | `bigint` | The T4 ID of this cell. | [index.ts:213](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L213) |
| <a id="property-neighbors"></a> `neighbors` | `readonly` | \[[`T4Cell`](#t4cell), [`T4Cell`](#t4cell), [`T4Cell`](#t4cell)\] | The neighbors of this cell (adjacent cells sharing an edge). | [index.ts:239](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L239) |
| <a id="property-parent"></a> `parent` | `readonly` | [`T4Cell`](#t4cell) \| `null` | The parent cell of this cell. | [index.ts:237](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L237) |
| <a id="property-radiuskm"></a> `radiusKm` | `readonly` | `number` | The radius of the sphere in kilometers. | [index.ts:217](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L217) |
| <a id="property-vertices"></a> `vertices` | `readonly` | \[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\] | The 2D vertices of the cell (longitude, latitude) in degrees. | [index.ts:223](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L223) |
| <a id="property-vertices2d"></a> `vertices2D` | `readonly` | \[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\] | The 2D vertices of the cell (longitude, latitude) in the flat tetrahedral domain. | [index.ts:227](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L227) |
| <a id="property-vertices3d"></a> `vertices3D` | `readonly` | \[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\] | The 3D vertices of the cell (x, y, z) in Cartesian coordinates. | [index.ts:231](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L231) |
| <a id="property-zoom-1"></a> `zoom` | `readonly` | `number` | The zoom level of this cell. | [index.ts:215](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L215) |

#### Methods

##### isDescendantOf()

```ts
isDescendantOf(parent): boolean;
```

Defined in: [index.ts:245](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L245)

Check if this cell is a descendant of the given parent cell or ID.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `parent` | `bigint` \| [`T4Cell`](#t4cell) |

###### Returns

`boolean`

***

### T4Options

Defined in: [index.ts:199](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L199)

Options for creating a T4Object.

#### Properties

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="property-applyearthcurvature-1"></a> `applyEarthCurvature?` | `readonly` | `boolean` | Whether to apply Earth curvature correction. Defaults to true. | [index.ts:203](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L203) |
| <a id="property-authalicwarp-1"></a> `authalicWarp?` | `readonly` | `boolean` | Whether the cell is warped to the sphere's surface (authalic warp). Defaults to true. | [index.ts:205](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L205) |
| <a id="property-radiuskm-1"></a> `radiusKm?` | `readonly` | `number` | Planet radius in kilometers. Defaults to Earth's radius. | [index.ts:201](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L201) |

## Variables

### BASE\_FACES

```ts
const BASE_FACES: [ArrayVector3D, ArrayVector3D, ArrayVector3D][];
```

Defined in: [index.ts:24](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L24)

***

### DEFAULT\_RADIUS\_KM

```ts
const DEFAULT_RADIUS_KM: 6371 = 6371.0;
```

Defined in: [index.ts:10](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L10)

Default radius for Earth in kilometers.

***

### F\_EARTH

```ts
const F_EARTH: number;
```

Defined in: [index.ts:4](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L4)

WGS84 flattening factor for Earth.

***

### INV\_K

```ts
const INV_K: number;
```

Defined in: [index.ts:7](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L7)

1.0 minus the square of WGS84 flattening factor for Earth.

***

### TETRAHEDRA\_V0

```ts
const TETRAHEDRA_V0: ArrayVector3D;
```

Defined in: [index.ts:18](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L18)

***

### TETRAHEDRA\_V1

```ts
const TETRAHEDRA_V1: ArrayVector3D;
```

Defined in: [index.ts:19](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L19)

***

### TETRAHEDRA\_V2

```ts
const TETRAHEDRA_V2: ArrayVector3D;
```

Defined in: [index.ts:20](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L20)

***

### TETRAHEDRA\_V3

```ts
const TETRAHEDRA_V3: ArrayVector3D;
```

Defined in: [index.ts:21](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L21)

## Functions

### cartesianToT4()

```ts
function cartesianToT4(
   P, 
   zoom, 
   options?): bigint;
```

Defined in: [index.ts:1225](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1225)

Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `P` | `ArrayVector3D` | The geocentric unit vector to project. |
| `zoom` | `number` | The zoom level. |
| `options?` | [`T4Options`](#t4options) | Optional T4 options. |

#### Returns

`bigint`

The T4 ID of the cell.

#### Throws

Error if the vector is invalid or zoom is out of range.

***

### createT4()

```ts
function createT4(idOrPath, options?): T4Cell;
```

Defined in: [index.ts:1723](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1723)

Standard OOP wrapper and memoized factory for T4 cells.
This function creates a T4 cell object from a T4 ID or configuration.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `idOrPath` | `bigint` \| `number`[] | The T4 ID or configuration. |
| `options?` | [`T4Options`](#t4options) | Optional T4 options. |

#### Returns

[`T4Cell`](#t4cell)

A T4 cell object.

#### Throws

Error if the configuration is invalid.

***

### createT4Id()

Creates a 64-bit T4 BigInt ID from base face, subdivision path, and zoom level.
Bit layout:
- Bits 63..62: base face (2 bits)
- Bits 61..6: subdivisions (2 bits each; subdivision 0 at bits 61..60 down to subdivision 27 at bits 7..6)
- Bit 5: validity flag (always 1)
- Bits 4..0: zoom level (5 bits, 0-28)

#### Call Signature

```ts
function createT4Id(path): bigint;
```

Defined in: [index.ts:287](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L287)

Creates a 64-bit T4 BigInt ID from a full path array `[baseFace, ...subdivisions]`.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `number`[] | Array containing the base face (0-3) followed by subdivision codes (0-3). |

##### Returns

`bigint`

The 64-bit T4 ID.

##### Throws

Error if the path is empty or invalid.

#### Call Signature

```ts
function createT4Id(...path): bigint;
```

Defined in: [index.ts:295](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L295)

Creates a 64-bit T4 BigInt ID from variadic path arguments `(baseFace, ...subdivisions)`.

##### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| ...`path` | `number`[] | Subdivision path [baseFace, ...subdivisions] |

##### Returns

`bigint`

The 64-bit T4 ID.

##### Throws

Error if the path is invalid.

***

### geocentricToGeodetic()

```ts
function geocentricToGeodetic(xyz, applyEarthCurvature?): ArrayVector2D;
```

Defined in: [index.ts:605](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L605)

Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `xyz` | `ArrayVector3D` | `undefined` | The geocentric Cartesian coordinates [x, y, z]. |
| `applyEarthCurvature` | `boolean` | `true` | Whether to apply Earth curvature correction. |

#### Returns

`ArrayVector2D`

A 2-element array containing longitude and latitude in degrees.

***

### geodeticToGeocentric()

```ts
function geodeticToGeocentric(lngLat, applyEarthCurvature?): ArrayVector3D;
```

Defined in: [index.ts:633](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L633)

Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `lngLat` | `ArrayVector2D` | `undefined` | The geodetic GPS coordinates [longitude, latitude] in degrees. |
| `applyEarthCurvature` | `boolean` | `true` | Whether to apply Earth curvature correction. |

#### Returns

`ArrayVector3D`

A 3-element array containing unit Cartesian coordinates [x, y, z].

***

### getParentT4Id()

```ts
function getParentT4Id(id): bigint | null;
```

Defined in: [index.ts:423](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L423)

Gets the parent T4 ID by clearing the lowest subdivision bits and decrementing zoom.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 BigInt ID to get the parent of. |

#### Returns

`bigint` \| `null`

The parent T4 ID, or null if the given id is a valid zoom-0 cell (base face).

#### Throws

Error if the given id is not a valid T4 ID.

***

### getRecommendedT4Zoom()

```ts
function getRecommendedT4Zoom(
   lat, 
   lng?, 
   radiusKm?): number;
```

Defined in: [index.ts:544](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L544)

Calculates the recommended T4 zoom level (0..28) for a given GPS coordinate pair
based on its floating-point precision and geographical latitude.

Automatically accounts for meridian convergence at higher latitudes, where
longitude degrees span fewer physical meters on the spherical surface.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `lat` | \| `string` \| `number` \| `ArrayVector2D` \| \{ `lat`: `number`; `lng`: `number`; \} \| \{ `latitude`: `number`; `longitude`: `number`; \} | `undefined` | Latitude in degrees (number, numeric string, [lng, lat] vector, or { lat, lng } object). |
| `lng?` | `string` \| `number` | `undefined` | Longitude in degrees (number or numeric string). |
| `radiusKm?` | `number` | `DEFAULT_RADIUS_KM` | - |

#### Returns

`number`

An integer zoom level between 0 and 28.

#### Example

```ts
getRecommendedT4Zoom(60.1699, 24.9384); // 21 (~5.2 m resolution for 4 decimals in Helsinki)
getRecommendedT4Zoom(0, 0); // 7 (~85 km resolution for integer degrees)
getRecommendedT4Zoom([24.9384, 60.1699]); // 21
```

***

### getT4CellArea()

```ts
function getT4CellArea(id, options?): number;
```

Defined in: [index.ts:1628](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1628)

Calculates the spherical surface area of the cell in square kilometers ($km^2$).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 ID of the cell. |
| `options?` | [`T4Options`](#t4options) | Optional T4 options. |

#### Returns

`number`

The surface area of the cell in square kilometers.

#### Throws

Error if the T4 ID is invalid.

***

### getT4Center()

```ts
function getT4Center(id, options?): ArrayVector2D;
```

Defined in: [index.ts:1083](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1083)

Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | `boolean` \| [`T4Options`](#t4options) |

#### Returns

`ArrayVector2D`

***

### getT4Center3D()

```ts
function getT4Center3D(
   id, 
   radiusKm?, 
   options?): ArrayVector3D;
```

Defined in: [index.ts:1034](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1034)

Gets the center point of the T4 cell on the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `id` | `bigint` | `undefined` | The T4 ID of the cell. |
| `radiusKm` | `number` | `DEFAULT_RADIUS_KM` | The radius of the sphere in kilometers. |
| `options?` | [`T4Options`](#t4options) | `undefined` | Optional T4 options. |

#### Returns

`ArrayVector3D`

The center point of the cell.

***

### getT4Children()

```ts
function getT4Children(id): [bigint, bigint, bigint, bigint];
```

Defined in: [index.ts:447](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L447)

Gets the 4 child T4 IDs by setting the subdivision at zoom level and incrementing zoom.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 BigInt ID to get the children of. |

#### Returns

\[`bigint`, `bigint`, `bigint`, `bigint`\]

An array of 4 T4 BigInt IDs representing the children of the given id.

#### Throws

Error if the given id is not a valid T4 ID or if maximum zoom level (28) is reached.

***

### getT4Neighbors()

```ts
function getT4Neighbors(id): [bigint, bigint, bigint];
```

Defined in: [index.ts:1559](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1559)

Gets the 3 neighbor T4 IDs sharing the edges of the cell using discrete TriCoord arithmetic.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 ID of the cell. |

#### Returns

\[`bigint`, `bigint`, `bigint`\]

An array containing the three neighbor T4 IDs.

#### Throws

Error if the T4 ID is invalid.

***

### getT4Vertices()

```ts
function getT4Vertices(id, options?): [ArrayVector2D, ArrayVector2D, ArrayVector2D];
```

Defined in: [index.ts:1059](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1059)

Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 ID of the cell. |
| `options?` | `boolean` \| [`T4Options`](#t4options) | Optional T4 options or boolean for applyEarthCurvature. |

#### Returns

\[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\]

An array containing the three 2D vertices of the cell.

***

### getT4Vertices3D()

```ts
function getT4Vertices3D(
   id, 
   radiusKm?, 
   options?): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: [index.ts:997](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L997)

Gets the 3D vertices of the T4 cell normalized to the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `id` | `bigint` | `undefined` | The T4 ID of the cell. |
| `radiusKm` | `number` | `DEFAULT_RADIUS_KM` | The radius of the sphere in kilometers. |
| `options?` | [`T4Options`](#t4options) | `undefined` | Optional T4 options. |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

An array containing the three 3D vertices of the cell.

***

### getT4VerticesFlat()

```ts
function getT4VerticesFlat(id): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: [index.ts:662](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L662)

Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 BigInt ID to get the vertices of. |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

An array of 3 T4Object arrays representing the vertices of the cell.

#### Throws

Error if the given id is not a valid T4 ID.

***

### isT4Descendant()

```ts
function isT4Descendant(childId, parentId): boolean;
```

Defined in: [index.ts:474](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L474)

Checks whether childId is a descendant of parentId in $O(1)$ bit comparisons.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `childId` | `bigint` | The child T4 BigInt ID. |
| `parentId` | `bigint` | The parent T4 BigInt ID. |

#### Returns

`boolean`

True if the childId is a descendant of the parentId, false otherwise.

***

### isValidT4Id()

```ts
function isValidT4Id(id): boolean;
```

Defined in: [index.ts:404](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L404)

Validates whether a BigInt represents a valid 64-bit T4 ID.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 BigInt ID to validate. |

#### Returns

`boolean`

True if the T4 ID is valid, false otherwise.

***

### latLngToT4()

```ts
function latLngToT4(
   lat, 
   lng, 
   zoom, 
   options?): bigint;
```

Defined in: [index.ts:1291](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1291)

Converts GPS coordinates (latitude, longitude in degrees) to a T4 ID.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `lat` | `number` | Latitude in degrees [-90, 90] |
| `lng` | `number` | Longitude in degrees [-180, 180] |
| `zoom` | `number` | Zoom level [0, 28] |
| `options?` | [`T4Options`](#t4options) | Optional T4 configuration |

#### Returns

`bigint`

The T4 ID of the cell.

#### Throws

Error if the latitude or longitude is invalid or zoom is out of range.

***

### lngLatToT4()

```ts
function lngLatToT4(
   lngLat, 
   zoom, 
   options?): bigint;
```

Defined in: [index.ts:1375](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1375)

Converts a 2D GPS coordinate vector [lng, lat] (GeoJSON [x, y] convention) to a T4 ID.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `lngLat` | `ArrayVector2D` | 2D array vector [longitude, latitude] in degrees |
| `zoom` | `number` | Zoom level [0, 28] |
| `options?` | [`T4Options`](#t4options) | Optional T4 configuration |

#### Returns

`bigint`

The T4 ID of the cell.

#### Throws

Error if the latitude or longitude is invalid or zoom is out of range.

***

### parseT4Id()

```ts
function parseT4Id(id): ParsedT4Id;
```

Defined in: [index.ts:374](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L374)

Parses a T4 BigInt ID into its face, subdivisions array, zoom, and validity flag.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `bigint` | The T4 BigInt ID to parse. |

#### Returns

[`ParsedT4Id`](#parsedt4id)

A ParsedT4Id object containing the face, subdivisions, zoom, and validity flag.

***

### projectAuthalicCornerWarp()

```ts
function projectAuthalicCornerWarp(flatPt, baseFaceIndex): ArrayVector3D;
```

Defined in: [index.ts:958](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L958)

Projects a flat point on a tetrahedron base face using the authalic corner warp.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `flatPt` | `ArrayVector3D` | The point to project. |
| `baseFaceIndex` | `number` | The base face index. |

#### Returns

`ArrayVector3D`

The projected point.

***

### unwarpAuthalicCorner()

```ts
function unwarpAuthalicCorner(baryW): ArrayVector3D;
```

Defined in: [index.ts:904](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L904)

Inverts the authalic corner warp on barycentric coordinates.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `baryW` | `ArrayVector3D` | The barycentric coordinates [u, v, w]. |

#### Returns

`ArrayVector3D`

An ArrayVector3D containing the three unwarped authalic corner values.
