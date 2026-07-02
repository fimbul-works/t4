# @fimbul-works/t4

## Interfaces

### T4Object

Defined in: index.ts:31

#### Properties

| Property | Modifier | Type | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-applyearthcurvature"></a> `applyEarthCurvature` | `readonly` | `boolean` | index.ts:35 |
| <a id="property-center"></a> `center` | `readonly` | `ArrayVector2D` | index.ts:37 |
| <a id="property-center3d"></a> `center3D` | `readonly` | `ArrayVector3D` | index.ts:39 |
| <a id="property-childids"></a> `childIds` | `readonly` | \[`bigint`, `bigint`, `bigint`, `bigint`\] | index.ts:44 |
| <a id="property-children"></a> `children` | `readonly` | \[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\] | index.ts:42 |
| <a id="property-id"></a> `id` | `readonly` | `bigint` | index.ts:32 |
| <a id="property-neighbors"></a> `neighbors` | `readonly` | \[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\] | index.ts:41 |
| <a id="property-parent"></a> `parent` | `readonly` | [`T4Object`](#t4object) \| `null` | index.ts:40 |
| <a id="property-radiuskm"></a> `radiusKm` | `readonly` | `number` | index.ts:34 |
| <a id="property-vertices"></a> `vertices` | `readonly` | \[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\] | index.ts:36 |
| <a id="property-vertices3d"></a> `vertices3D` | `readonly` | \[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\] | index.ts:38 |
| <a id="property-zoom"></a> `zoom` | `readonly` | `number` | index.ts:33 |

#### Methods

##### getChildren()

```ts
getChildren(): [T4Object, T4Object, T4Object, T4Object];
```

Defined in: index.ts:43

###### Returns

\[[`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object), [`T4Object`](#t4object)\]

***

### T4Options

Defined in: index.ts:26

#### Properties

| Property | Type | Defined in |
| ------ | ------ | ------ |
| <a id="property-applyearthcurvature-1"></a> `applyEarthCurvature?` | `boolean` | index.ts:28 |
| <a id="property-radiuskm-1"></a> `radiusKm?` | `number` | index.ts:27 |

## Functions

### cartesianToT4()

```ts
function cartesianToT4(P, zoom): bigint;
```

Defined in: index.ts:312

Projects a geocentric unit vector P onto the tetrahedron and maps it to a T4 ID.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `P` | `ArrayVector3D` |
| `zoom` | `number` |

#### Returns

`bigint`

***

### createT4()

```ts
function createT4(idOrConfig, options?): T4Object;
```

Defined in: index.ts:395

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

Defined in: index.ts:53

Creates a T4 BigInt ID from base face, subdivision path, and zoom level.

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
function geocentricToGeodetic(xyz, applyEarthCurvature): ArrayVector2D;
```

Defined in: index.ts:159

Converts geocentric Cartesian coordinates [x, y, z] to geodetic GPS [lng, lat] (degrees).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `xyz` | `ArrayVector3D` |
| `applyEarthCurvature` | `boolean` |

#### Returns

`ArrayVector2D`

***

### geodeticToGeocentric()

```ts
function geodeticToGeocentric(lngLat, applyEarthCurvature): ArrayVector3D;
```

Defined in: index.ts:183

Converts geodetic GPS [lng, lat] (degrees) to geocentric unit Cartesian coordinates [x, y, z].

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `lngLat` | `ArrayVector2D` |
| `applyEarthCurvature` | `boolean` |

#### Returns

`ArrayVector3D`

***

### getParentT4Id()

```ts
function getParentT4Id(id): bigint | null;
```

Defined in: index.ts:106

Gets the parent T4 ID by decrementing zoom and bit-shifting positional bits.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

`bigint` \| `null`

***

### getT4Center()

```ts
function getT4Center(id, options?): ArrayVector2D;
```

Defined in: index.ts:263

Gets the 2D GPS center coordinate of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | [`T4Options`](#t4options) |

#### Returns

`ArrayVector2D`

***

### getT4Center3D()

```ts
function getT4Center3D(id, radiusKm?): ArrayVector3D;
```

Defined in: index.ts:240

Gets the center point of the T4 cell on the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `id` | `bigint` | `undefined` |
| `radiusKm` | `number` | `6371` |

#### Returns

`ArrayVector3D`

***

### getT4Children()

```ts
function getT4Children(id): [bigint, bigint, bigint, bigint];
```

Defined in: index.ts:119

Gets the 4 child T4 IDs by incrementing zoom and shifting/appending subdivision bits.

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

Defined in: index.ts:379

Gets the 3 neighbor T4 IDs sharing the edges of the cell.

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

Defined in: index.ts:250

Gets the 2D GPS vertices of the T4 cell in [lng, lat] degrees.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |
| `options?` | [`T4Options`](#t4options) |

#### Returns

\[`ArrayVector2D`, `ArrayVector2D`, `ArrayVector2D`\]

***

### getT4Vertices3D()

```ts
function getT4Vertices3D(id, radiusKm?): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: index.ts:231

Gets the 3D vertices of the T4 cell normalized to the sphere surface of radiusKm.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `id` | `bigint` | `undefined` |
| `radiusKm` | `number` | `6371` |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

***

### getT4VerticesFlat()

```ts
function getT4VerticesFlat(id): [ArrayVector3D, ArrayVector3D, ArrayVector3D];
```

Defined in: index.ts:203

Gets the vertices of the T4 cell in flat 3D space on the tetrahedron face.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

\[`ArrayVector3D`, `ArrayVector3D`, `ArrayVector3D`\]

***

### isValidT4Id()

```ts
function isValidT4Id(id): boolean;
```

Defined in: index.ts:141

Validates whether a BigInt represents a valid T4 ID.

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

Defined in: index.ts:362

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
function parseT4Id(id): {
  baseFace: number;
  isValid: boolean;
  subdivisions: number[];
  zoom: number;
};
```

Defined in: index.ts:78

Parses a T4 BigInt ID into its components.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `bigint` |

#### Returns

```ts
{
  baseFace: number;
  isValid: boolean;
  subdivisions: number[];
  zoom: number;
}
```

| Name | Type | Defined in |
| ------ | ------ | ------ |
| `baseFace` | `number` | index.ts:79 |
| `isValid` | `boolean` | index.ts:82 |
| `subdivisions` | `number`[] | index.ts:80 |
| `zoom` | `number` | index.ts:81 |
