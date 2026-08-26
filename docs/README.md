# @fimbul-works/t4

## Interfaces

### ParsedT4Id

Defined in: [index.ts:228](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L228)

#### Properties

| Property | Type | Defined in |
| ------ | ------ | ------ |
| <a id="property-baseface"></a> `baseFace` | `number` | [index.ts:229](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L229) |
| <a id="property-isvalid"></a> `isValid` | `boolean` | [index.ts:232](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L232) |
| <a id="property-subdivisions"></a> `subdivisions` | `number`[] | [index.ts:230](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L230) |
| <a id="property-zoom"></a> `zoom` | `number` | [index.ts:231](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L231) |

***

### T4Object

Defined in: [index.ts:158](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L158)

#### Properties

| Property | Modifier | Type | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-applyearthcurvature"></a> `applyEarthCurvature` | `readonly` | `boolean` | [index.ts:162](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L162) |
| <a id="property-area"></a> `area` | `readonly` | `number` | [index.ts:171](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L171) |
| <a id="property-authalicwarp"></a> `authalicWarp` | `readonly` | `boolean` | [index.ts:163](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L163) |
| <a id="property-center"></a> `center` | `readonly` | `ArrayVector2D` | [index.ts:166](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L166) |
| <a id="property-center2d"></a> `center2D` | `readonly` | `ArrayVector2D` | [index.ts:168](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L168) |
| <a id="property-center3d"></a> `center3D` | `readonly` | `ArrayVector3D` | [index.ts:170](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L170) |
| <a id="property-childids"></a> `childIds` | `readonly` | \[`bigint`, `bigint`, `bigint`, `bigint`\] | [index.ts:176](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L176) |
| <a id="property-children"></a> `children` | `readonly` | \[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\] | [index.ts:174](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L174) |
| <a id="property-id"></a> `id` | `readonly` | `bigint` | [index.ts:159](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L159) |
| <a id="property-neighbors"></a> `neighbors` | `readonly` | \[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\] | [index.ts:173](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L173) |
| <a id="property-parent"></a> `parent` | `readonly` | [`T4Object`](#t4object) \| `null` | [index.ts:172](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L172) |
| <a id="property-radiuskm"></a> `radiusKm` | `readonly` | `number` | [index.ts:161](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L161) |
| <a id="property-vertices"></a> `vertices` | `readonly` | \[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\] | [index.ts:165](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L165) |
| <a id="property-vertices2d"></a> `vertices2D` | `readonly` | \[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\] | [index.ts:167](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L167) |
| <a id="property-vertices3d"></a> `vertices3D` | `readonly` | \[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\] | [index.ts:169](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L169) |
| <a id="property-warpfactor"></a> `warpFactor` | `readonly` | `number` | [index.ts:164](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L164) |
| <a id="property-zoom-1"></a> `zoom` | `readonly` | `number` | [index.ts:160](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L160) |

#### Methods

##### getChildren()

```ts
getChildren(): [T4Object, T4Object, T4Object, T4Object];
```

Defined in: [index.ts:175](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L175)

###### Returns

\[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\]

##### isDescendantOf()

```ts
isDescendantOf(parent): boolean;
```

Defined in: [index.ts:177](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L177)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `parent` | `bigint` \| [`T4Object`](#t4object) |

###### Returns

`boolean`

***

### T4Options

Defined in: [index.ts:151](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L151)

#### Properties

| Property | Type | Defined in |
| ------ | ------ | ------ |
| <a id="property-applyearthcurvature-1"></a> `applyEarthCurvature?` | `boolean` | [index.ts:153](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L153) |
| <a id="property-authalicwarp-1"></a> `authalicWarp?` | `boolean` | [index.ts:154](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L154) |
| <a id="property-radiuskm-1"></a> `radiusKm?` | `number` | [index.ts:152](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L152) |
| <a id="property-warpfactor-1"></a> `warpFactor?` | `number` | [index.ts:155](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L155) |

## Variables

### BASE\_FACES

```ts
const BASE_FACES: [ArrayVector3D, ArrayVector3D, ArrayVector3D][];
```

Defined in: [index.ts:18](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L18)

***

### DEFAULT\_RADIUS\_KM

```ts
const DEFAULT_RADIUS_KM: 6371 = 6371.0;
```

Defined in: [index.ts:5](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L5)

***

### F\_EARTH

```ts
const F_EARTH: number;
```

Defined in: [index.ts:4](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L4)

***

### getT4Center2D

```ts
const getT4Center2D: (id, options?) => ArrayVector2D = getT4Center;
```

Defined in: [index.ts:771](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L771)

Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | `boolean` \| [`T4Options`](#t4options) |

#### Returns

`ArrayVector2D`

***

### getT4Vertices2D

```ts
const getT4Vertices2D: (id, options?) => [ArrayVector2D, ArrayVector2D, ArrayVector2D] = getT4Vertices;
```

Defined in: [index.ts:760](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L760)

Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | `boolean` \| [`T4Options`](#t4options) |

#### Returns

\[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\]

## Functions

### cartesianToT4()

```ts
function cartesianToT4(
   P, 
   zoom, 
   options?): bigint;
```

Defined in: [index.ts:848](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L848)

Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `P` | `ArrayVector3D` |
| `zoom` | `number` |
| `options?` | [`T4Options`](#t4options) |

#### Returns

`bigint`

***

### createT4()

```ts
function createT4(idOrConfig, options?): T4Object;
```

Defined in: [index.ts:1217](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1217)

Standard OOP wrapper and memoized factory for T4 cells.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `idOrConfig` | \| `bigint` \| \{ `baseFace`: `number`; `subdivisions?`: `number`[]; `zoom?`: `number`; \} |
| `options?` | [`T4Options`](#t4options) |

#### Returns

[`T4Object`](#t4object)

***

### createT4Id()

```ts
function createT4Id(
   baseFace, 
   subdivisions, 
   zoom): bigint;
```

Defined in: [index.ts:208](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L208)

Creates a 64-bit T4 BigInt ID from base face, subdivision path, and zoom level.
Bit layout:
- Bits 63..62: base face (2 bits)
- Bits 61..6: subdivisions (2 bits each from step 0 at bit 60 down to step 27 at bit 6)
- Bit 5: validity flag (always 1)
- Bits 4..0: zoom level (5 bits, 0-28)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `baseFace` | `number` |
| `subdivisions` | `number`[] |
| `zoom` | `number` |

#### Returns

`bigint`

***

### geocentricToGeodetic()

```ts
function geocentricToGeodetic(xyz, applyEarthCurvature?): ArrayVector2D;
```

Defined in: [index.ts:356](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L356)

Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `xyz` | `ArrayVector3D` | `undefined` |
| `applyEarthCurvature` | `boolean` | `true` |

#### Returns

`ArrayVector2D`

***

### geodeticToGeocentric()

```ts
function geodeticToGeocentric(lngLat, applyEarthCurvature?): ArrayVector3D;
```

Defined in: [index.ts:382](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L382)

Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `lngLat` | `ArrayVector2D` | `undefined` |
| `applyEarthCurvature` | `boolean` | `true` |

#### Returns

`ArrayVector3D`

***

### getParentT4Id()

```ts
function getParentT4Id(id): bigint | null;
```

Defined in: [index.ts:282](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L282)

Gets the parent T4 ID by clearing the lowest subdivision bits and decrementing zoom.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

`bigint` \| `null`

***

### getT4CellArea()

```ts
function getT4CellArea(id, radiusKm?): number;
```

Defined in: [index.ts:1129](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1129)

Calculates the spherical surface area of the cell in square kilometers ($km^2$).

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `id` | `bigint` | `undefined` |
| `radiusKm` | `number` | `DEFAULT_RADIUS_KM` |

#### Returns

`number`

***

### getT4Center()

```ts
function getT4Center(id, options?): ArrayVector2D;
```

Defined in: [index.ts:765](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L765)

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

Defined in: [index.ts:715](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L715)

Gets the center point of the T4 cell on the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `id` | `bigint` | `undefined` |
| `radiusKm` | `number` | `DEFAULT_RADIUS_KM` |
| `options?` | [`T4Options`](#t4options) | `undefined` |

#### Returns

`ArrayVector3D`

***

### getT4Children()

```ts
function getT4Children(id): [bigint, bigint, bigint, bigint];
```

Defined in: [index.ts:299](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L299)

Gets the 4 child T4 IDs by setting the subdivision at zoom level and incrementing zoom.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

\[`bigint`, `bigint`, `bigint`, `bigint`\]

***

### getT4Neighbors()

```ts
function getT4Neighbors(id, _options?): [bigint, bigint, bigint];
```

Defined in: [index.ts:1063](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L1063)

Gets the 3 neighbor T4 IDs sharing the edges of the cell using discrete TriCoord arithmetic.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `_options?` | [`T4Options`](#t4options) |

#### Returns

\[`bigint`, `bigint`, `bigint`\]

***

### getT4Vertices()

```ts
function getT4Vertices(id, options?): [ArrayVector2D, ArrayVector2D, ArrayVector2D];
```

Defined in: [index.ts:738](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L738)

Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | `boolean` \| [`T4Options`](#t4options) |

#### Returns

\[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\]

***

### getT4Vertices3D()

```ts
function getT4Vertices3D(
   id, 
   radiusKm?, 
   options?): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: [index.ts:681](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L681)

Gets the 3D vertices of the T4 cell normalized to the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `id` | `bigint` | `undefined` |
| `radiusKm` | `number` | `DEFAULT_RADIUS_KM` |
| `options?` | [`T4Options`](#t4options) | `undefined` |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

***

### getT4VerticesFlat()

```ts
function getT4VerticesFlat(id): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: [index.ts:405](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L405)

Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

***

### isT4Descendant()

```ts
function isT4Descendant(childId, parentId): boolean;
```

Defined in: [index.ts:319](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L319)

Checks whether childId is a descendant of parentId in $O(1)$ bit comparisons.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `childId` | `bigint` |
| `parentId` | `bigint` |

#### Returns

`boolean`

***

### isValidT4Id()

```ts
function isValidT4Id(id): boolean;
```

Defined in: [index.ts:266](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L266)

Validates whether a BigInt represents a valid 64-bit T4 ID.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

`boolean`

***

### latLngToT4()

```ts
function latLngToT4(
   lat, 
   lng, 
   zoom, 
   options?): bigint;
```

Defined in: [index.ts:902](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L902)

Converts GPS [lat, lng] degrees to a T4 ID.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `lat` | `number` |
| `lng` | `number` |
| `zoom` | `number` |
| `options?` | [`T4Options`](#t4options) |

#### Returns

`bigint`

***

### parseT4Id()

```ts
function parseT4Id(id): ParsedT4Id;
```

Defined in: [index.ts:238](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L238)

Parses a T4 BigInt ID into its face, subdivisions array, zoom, and validity flag.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

[`ParsedT4Id`](#parsedt4id)

***

### projectAuthalicCornerWarp()

```ts
function projectAuthalicCornerWarp(
   flatPt, 
   baseFaceIndex, 
   warpFactor?): ArrayVector3D;
```

Defined in: [index.ts:635](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L635)

Projects a flat point on a tetrahedron base face using the authalic corner warp.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `flatPt` | `ArrayVector3D` | `undefined` |
| `baseFaceIndex` | `number` | `undefined` |
| `warpFactor` | `number` | `1.0` |

#### Returns

`ArrayVector3D`

***

### unwarpAuthalicCorner()

```ts
function unwarpAuthalicCorner(baryW): ArrayVector3D;
```

Defined in: [index.ts:599](https://github.com/fimbul-works/t4/blob/main/src/index.ts#L599)

Inverts the authalic corner warp on barycentric coordinates.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `baryW` | `ArrayVector3D` |

#### Returns

`ArrayVector3D`
