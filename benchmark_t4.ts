import * as fs from "node:fs";
import * as path from "node:path";
import * as T4 from "./src/index";
import type { ArrayVector3D } from "@fimbul-works/vec/3d";
import type { ArrayVector2D } from "@fimbul-works/vec/2d";

// ==============================================================================
// T4 Operations Benchmark (Node.js / TypeScript)
//
// Matches benchmark_t4.gd: runs performance benchmarks across T4 operations
// and zoom levels (0 to 28), collects microsecond-precision timing metrics,
// displays an ASCII comparison summary, and writes aggregate JSON results.
// ==============================================================================

const SQRT8_9 = Math.sqrt(8.0 / 9.0);
const SQRT2_9 = Math.sqrt(2.0 / 9.0);
const SQRT2_3 = Math.sqrt(2.0 / 3.0);

const V0: ArrayVector3D = [0.0, 0.0, 1.0];
const V1: ArrayVector3D = [SQRT8_9, 0.0, -1.0 / 3.0];
const V2: ArrayVector3D = [-SQRT2_9, SQRT2_3, -1.0 / 3.0];
const V3: ArrayVector3D = [-SQRT2_9, -SQRT2_3, -1.0 / 3.0];

function normalize(v: ArrayVector3D): ArrayVector3D {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

function add(a: ArrayVector3D, b: ArrayVector3D): ArrayVector3D {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: ArrayVector3D, s: number): ArrayVector3D {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function radToDeg(rad: number): number {
  return (rad * 180.0) / Math.PI;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180.0;
}

interface BenchmarkConfig {
  zoom_min: number;
  zoom_max: number;
  iterations_per_point: number;
  warmup_iterations: number;
  output_dir: string;
  sample_points_count: number;
}

const config: BenchmarkConfig = {
  zoom_min: 0,
  zoom_max: 28,
  iterations_per_point: 200,
  warmup_iterations: 20,
  output_dir: "./benchmarks",
  sample_points_count: 32,
};

function parseCmdlineArgs() {
  const args = process.argv.slice(2);
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--zoom-min" && i + 1 < args.length) {
      config.zoom_min = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (arg === "--zoom-max" && i + 1 < args.length) {
      config.zoom_max = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (arg === "--iterations" && i + 1 < args.length) {
      config.iterations_per_point = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (arg === "--warmup" && i + 1 < args.length) {
      config.warmup_iterations = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (arg === "--output-dir" && i + 1 < args.length) {
      config.output_dir = args[i + 1];
      i += 1;
    } else if (arg === "--sample-points" && i + 1 < args.length) {
      config.sample_points_count = Number.parseInt(args[i + 1], 10);
      i += 1;
    }
    i += 1;
  }
}

interface SamplePoint {
  pos_3d: ArrayVector3D;
  lat_lng: ArrayVector2D; // [lng, lat] matching GDScript Vector2(lng, lat)
}

function generateSamplePoints(targetCount: number): SamplePoint[] {
  const points: SamplePoint[] = [];

  // 1. Base Tetrahedron Vertices (4)
  points.push({ pos_3d: normalize(V0), lat_lng: [0.0, 90.0] });
  points.push({ pos_3d: normalize(V1), lat_lng: [0.0, -19.4712] });
  points.push({ pos_3d: normalize(V2), lat_lng: [120.0, -19.4712] });
  points.push({ pos_3d: normalize(V3), lat_lng: [-120.0, -19.4712] });

  // 2. Base Face Centroids (4)
  const fc0 = normalize(scale(add(add(V0, V1), V2), 1.0 / 3.0));
  const fc1 = normalize(scale(add(add(V0, V2), V3), 1.0 / 3.0));
  const fc2 = normalize(scale(add(add(V0, V3), V1), 1.0 / 3.0));
  const fc3 = normalize(scale(add(add(V1, V3), V2), 1.0 / 3.0));
  points.push({ pos_3d: fc0, lat_lng: [60.0, 19.4712] });
  points.push({ pos_3d: fc1, lat_lng: [180.0, 19.4712] });
  points.push({ pos_3d: fc2, lat_lng: [-60.0, 19.4712] });
  points.push({ pos_3d: fc3, lat_lng: [0.0, -90.0] });

  // 3. Base Edge Midpoints (6)
  const edges: ArrayVector3D[] = [
    scale(add(V0, V1), 0.5),
    scale(add(V0, V2), 0.5),
    scale(add(V0, V3), 0.5),
    scale(add(V1, V2), 0.5),
    scale(add(V2, V3), 0.5),
    scale(add(V3, V1), 0.5),
  ];
  for (const e of edges) {
    const p3 = normalize(e);
    const lat = radToDeg(Math.asin(Math.max(-1.0, Math.min(1.0, p3[2]))));
    const lng = radToDeg(Math.atan2(p3[1], p3[0]));
    points.push({ pos_3d: p3, lat_lng: [lng, lat] });
  }

  // 4. Standard Geographic Landmarks & Equator/Meridians (8)
  const geoCoords: ArrayVector2D[] = [
    [0.0, 0.0], // Null Island
    [45.0, 45.0], // Mid-lat NE
    [-45.0, 45.0], // Mid-lat NW
    [120.0, -35.0], // Southern mid-lat
    [-120.0, -35.0], // Southern mid-lat W
    [0.0, 89.0], // Near North Pole
    [0.0, -89.0], // Near South Pole
    [179.9, 0.0], // Antimeridian Equator
  ];
  for (const g of geoCoords) {
    const latRad = degToRad(g[1]);
    const lngRad = degToRad(g[0]);
    const p3: ArrayVector3D = [
      Math.cos(latRad) * Math.cos(lngRad),
      Math.cos(latRad) * Math.sin(lngRad),
      Math.sin(latRad),
    ];
    points.push({ pos_3d: normalize(p3), lat_lng: g });
  }

  // 5. Golden Spiral / Fibonacci Sphere points to reach target count
  const remaining = targetCount - points.length;
  if (remaining > 0) {
    const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle
    for (let idx = 0; idx < remaining; idx++) {
      const y = 1.0 - (idx / (remaining - 1)) * 2.0;
      const radius = Math.sqrt(Math.max(0.0, 1.0 - y * y));
      const theta = phi * idx;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const p3 = normalize([x, z, y]);
      const lat = radToDeg(Math.asin(Math.max(-1.0, Math.min(1.0, p3[2]))));
      const lng = radToDeg(Math.atan2(p3[1], p3[0]));
      points.push({ pos_3d: p3, lat_lng: [lng, lat] });
    }
  }

  return points;
}

interface TestData {
  points_3d: ArrayVector3D[];
  points_2d: ArrayVector2D[];
  cell_ids: bigint[];
  parent_ids: bigint[];
  subs_arr: number[][];
  base_faces: number[];
}

function prepareTestDataForZoom(zoom: number, samplePoints: SamplePoint[]): TestData {
  const points_3d: ArrayVector3D[] = [];
  const points_2d: ArrayVector2D[] = [];
  const cell_ids: bigint[] = [];
  const parent_ids: bigint[] = [];
  const subs_arr: number[][] = [];
  const base_faces: number[] = [];

  for (const pt of samplePoints) {
    const p3 = pt.pos_3d;
    const p2 = pt.lat_lng;

    const id = T4.cartesianToT4(p3, zoom);
    const parsed = T4.parseT4Id(id);

    points_3d.push(p3);
    points_2d.push(p2);
    cell_ids.push(id);

    const pId = zoom > 0 ? (T4.getParentT4Id(id) ?? id) : id;
    parent_ids.push(pId);

    subs_arr.push(parsed.subdivisions);
    base_faces.push(parsed.baseFace);
  }

  return {
    points_3d,
    points_2d,
    cell_ids,
    parent_ids,
    subs_arr,
    base_faces,
  };
}

interface OpMetadata {
  name: string;
  group: string;
  description: string;
  min_zoom?: number;
  max_zoom?: number;
}

function getOperationsMetadata(): Record<string, OpMetadata> {
  return {
    create_id: {
      name: "create_id",
      group: "ID Manipulation",
      description: "Create uint64 T4 ID from subdivisions",
    },
    parse_id: {
      name: "parse_id",
      group: "ID Manipulation",
      description: "Decode uint64 ID into face, zoom, subdivisions",
    },
    is_valid_id: {
      name: "is_valid_id",
      group: "ID Manipulation",
      description: "Validate T4 ID bitfield format",
    },
    get_parent_id: {
      name: "get_parent_id",
      group: "Hierarchy",
      description: "Calculate parent cell ID",
      min_zoom: 1,
    },
    get_child_ids: {
      name: "get_child_ids",
      group: "Hierarchy",
      description: "Calculate 4 child cell IDs",
      max_zoom: 27,
    },
    is_descendant: {
      name: "is_descendant",
      group: "Hierarchy",
      description: "Check if cell is descendant of parent",
    },
    cartesian_to_id: {
      name: "cartesian_to_id",
      group: "Spatial Indexing",
      description: "3D Cartesian point -> T4 ID",
    },
    lat_lng_to_id: {
      name: "lat_lng_to_id",
      group: "Spatial Indexing",
      description: "Geodetic lat/lng -> T4 ID",
    },
    get_vertices_3d: {
      name: "get_vertices_3d",
      group: "3D Geometry",
      description: "Calculate 3D cell vertices on sphere",
    },
    get_center_3d: {
      name: "get_center_3d",
      group: "3D Geometry",
      description: "Calculate 3D cell center point",
    },
    get_vertices_2d: {
      name: "get_vertices_2d",
      group: "2D Geometry",
      description: "Calculate geodetic 2D vertices",
    },
    get_center_2d: {
      name: "get_center_2d",
      group: "2D Geometry",
      description: "Calculate geodetic 2D center",
    },
    get_neighbor_ids: {
      name: "get_neighbor_ids",
      group: "Topology",
      description: "Calculate 3 neighboring cell IDs across edges",
    },
    get_cell_area: {
      name: "get_cell_area",
      group: "Spherical Area",
      description: "Calculate spherical triangle area in km2",
    },
  };
}

// Any helper for operations that might be missing in baseline or newly added
const anyT4 = T4 as unknown as {
  isT4Descendant?: (child: bigint, parent: bigint) => boolean;
  getT4CellArea?: (id: bigint, radius?: number) => number;
  getT4Vertices2D?: (id: bigint, curvature?: boolean) => [ArrayVector2D, ArrayVector2D, ArrayVector2D];
  getT4Center2D?: (id: bigint, curvature?: boolean) => ArrayVector2D;
};

function executeOp(opKey: string, idx: number, zoom: number, data: TestData): void {
  const { points_3d, points_2d, cell_ids, parent_ids, subs_arr, base_faces } = data;

  switch (opKey) {
    case "create_id":
      T4.createT4Id(base_faces[idx], subs_arr[idx], zoom);
      break;
    case "parse_id":
      T4.parseT4Id(cell_ids[idx]);
      break;
    case "is_valid_id":
      T4.isValidT4Id(cell_ids[idx]);
      break;
    case "get_parent_id":
      T4.getParentT4Id(cell_ids[idx]);
      break;
    case "get_child_ids":
      T4.getT4Children(cell_ids[idx]);
      break;
    case "is_descendant":
      if (typeof anyT4.isT4Descendant === "function") {
        anyT4.isT4Descendant(cell_ids[idx], parent_ids[idx]);
      } else {
        // Fallback for baseline if missing: walk up parents
        let curr: bigint | null = cell_ids[idx];
        while (curr !== null) {
          if (curr === parent_ids[idx]) break;
          curr = T4.getParentT4Id(curr);
        }
      }
      break;
    case "cartesian_to_id":
      T4.cartesianToT4(points_3d[idx], zoom);
      break;
    case "lat_lng_to_id": {
      const pos2 = points_2d[idx];
      T4.latLngToT4(pos2[1], pos2[0], zoom, { applyEarthCurvature: true });
      break;
    }
    case "get_vertices_3d":
      T4.getT4Vertices3D(cell_ids[idx], 6371.0);
      break;
    case "get_center_3d":
      T4.getT4Center3D(cell_ids[idx], 6371.0);
      break;
    case "get_vertices_2d":
      if (typeof anyT4.getT4Vertices2D === "function") {
        anyT4.getT4Vertices2D(cell_ids[idx], true);
      } else {
        T4.getT4Vertices(cell_ids[idx], { applyEarthCurvature: true });
      }
      break;
    case "get_center_2d":
      if (typeof anyT4.getT4Center2D === "function") {
        anyT4.getT4Center2D(cell_ids[idx], true);
      } else {
        T4.getT4Center(cell_ids[idx], { applyEarthCurvature: true });
      }
      break;
    case "get_neighbor_ids":
      T4.getT4Neighbors(cell_ids[idx]);
      break;
    case "get_cell_area":
      if (typeof anyT4.getT4CellArea === "function") {
        anyT4.getT4CellArea(cell_ids[idx], 6371.0);
      }
      break;
  }
}

function benchmarkSingleOp(opKey: string, zoom: number, data: TestData, iters: number, warmup: number) {
  const count = data.cell_ids.length;

  // 1. Warm-up Phase
  for (let w = 0; w < warmup; w++) {
    for (let i = 0; i < count; i++) {
      executeOp(opKey, i, zoom, data);
    }
  }

  // 2. Timed Phase
  const start = process.hrtime.bigint();
  for (let rep = 0; rep < iters; rep++) {
    for (let i = 0; i < count; i++) {
      executeOp(opKey, i, zoom, data);
    }
  }
  const end = process.hrtime.bigint();
  const elapsedNs = Number(end - start);
  const elapsedUs = elapsedNs / 1000.0;

  const totalOps = iters * count;
  const avgUs = elapsedUs / Math.max(1, totalOps);
  const opsSec = avgUs > 0 ? 1000000.0 / avgUs : 0.0;

  return {
    ops: totalOps,
    time_us: Math.round(elapsedUs),
    avg_us: Number(avgUs.toFixed(4)),
    ops_per_sec: Number(opsSec.toFixed(1)),
  };
}

function printSummaryTable(summary: Record<string, any>) {
  console.log(
    "\n=========================================================================================================",
  );
  console.log(
    "                                      T4 BENCHMARK SUMMARY RESULTS                                       ",
  );
  console.log(
    "=========================================================================================================",
  );
  console.log(
    `${"Operation".padEnd(32)} | ${"Group".padEnd(16)} | ${"Avg Time (µs)".padStart(12)} | ${"Ops / sec".padStart(14)} | ${"Min (µs)".padStart(10)} | ${"Max (µs)".padStart(10)}`,
  );
  console.log(
    "---------------------------------+------------------+--------------+----------------+------------+------------",
  );

  const sortedKeys = Object.keys(summary).sort((a, b) => summary[a].overall_avg_us - summary[b].overall_avg_us);

  for (const key of sortedKeys) {
    const item = summary[key];
    const opStr = item.name.padEnd(32);
    const grpStr = item.group.padEnd(16);
    const avgStr = item.overall_avg_us.toFixed(4).padStart(12);
    const opsStr = item.overall_ops_per_sec
      .toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      .padStart(14);
    const minStr = item.min_avg_us.toFixed(4).padStart(10);
    const maxStr = item.max_avg_us.toFixed(4).padStart(10);
    console.log(`${opStr} | ${grpStr} | ${avgStr} | ${opsStr} | ${minStr} | ${maxStr}`);
  }
  console.log(
    "=========================================================================================================\n",
  );
}

function saveJsonFile(data: any, filename: string) {
  const outDir = config.output_dir;
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filePath = path.join(outDir, filename);
  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonStr, "utf-8");
  console.log(`>> Successfully saved benchmark results to: ${filePath} (${jsonStr.length} bytes)`);
}

function runBenchmark() {
  parseCmdlineArgs();

  const zoomMin = Math.max(0, Math.min(28, config.zoom_min));
  const zoomMax = Math.max(zoomMin, Math.min(28, config.zoom_max));
  const iters = config.iterations_per_point;
  const warmup = config.warmup_iterations;

  console.log("================================================================================");
  console.log("                         T4 OPERATIONS BENCHMARK SUITE (Node.js)                ");
  console.log("================================================================================");
  console.log(` Zoom levels       : ${zoomMin} -> ${zoomMax} (${zoomMax - zoomMin + 1} levels)`);
  console.log(` Sample points     : ${config.sample_points_count} deterministic spherical points`);
  console.log(` Iterations/point  : ${iters} (+ ${warmup} warm-up)`);
  console.log(` Output directory  : ${config.output_dir}`);
  console.log("--------------------------------------------------------------------------------");

  const startTotalNs = process.hrtime.bigint();
  const samplePoints = generateSamplePoints(config.sample_points_count);

  const operationsMeta = getOperationsMetadata();
  const resultsByOp: Record<string, any> = {};

  for (const opKey of Object.keys(operationsMeta)) {
    resultsByOp[opKey] = {
      name: operationsMeta[opKey].name,
      group: operationsMeta[opKey].group,
      description: operationsMeta[opKey].description,
      zoom_levels: {},
    };
  }

  for (let z = zoomMin; z <= zoomMax; z++) {
    console.log(`Benchmarking Zoom Level ${String(z).padStart(2)} / ${String(zoomMax).padStart(2)}...`);
    const testData = prepareTestDataForZoom(z, samplePoints);

    for (const opKey of Object.keys(operationsMeta)) {
      const meta = operationsMeta[opKey];
      if (meta.max_zoom !== undefined && meta.max_zoom < z) continue;
      if (meta.min_zoom !== undefined && meta.min_zoom > z) continue;

      const res = benchmarkSingleOp(opKey, z, testData, iters, warmup);
      resultsByOp[opKey].zoom_levels[String(z)] = res;
    }
  }

  const totalDurationSec = Number(process.hrtime.bigint() - startTotalNs) / 1e9;

  console.log("--------------------------------------------------------------------------------");
  console.log(`Benchmark execution completed in ${totalDurationSec.toFixed(2)} seconds.`);
  console.log("Aggregating results and generating report...");

  const summary: Record<string, any> = {};
  const byZoom: Record<string, any> = {};

  for (const opKey of Object.keys(resultsByOp)) {
    const opDict = resultsByOp[opKey];
    let totalOpTimeUs = 0;
    let totalOpCalls = 0;
    let minAvgUs = 1e12;
    let maxAvgUs = 0.0;

    for (const zStr of Object.keys(opDict.zoom_levels)) {
      const zData = opDict.zoom_levels[zStr];
      const calls = zData.ops;
      const timeUs = zData.time_us;
      const avgUs = zData.avg_us;

      totalOpCalls += calls;
      totalOpTimeUs += timeUs;
      if (avgUs < minAvgUs) minAvgUs = avgUs;
      if (avgUs > maxAvgUs) maxAvgUs = avgUs;

      if (!byZoom[zStr]) byZoom[zStr] = {};
      byZoom[zStr][opKey] = {
        avg_us: avgUs,
        ops_per_sec: zData.ops_per_sec,
      };
    }

    const overallAvgUs = totalOpCalls > 0 ? totalOpTimeUs / totalOpCalls : 0.0;
    const overallOpsSec = overallAvgUs > 0 ? 1000000.0 / overallAvgUs : 0.0;

    opDict.overall_avg_us = Number(overallAvgUs.toFixed(4));
    opDict.overall_ops_per_sec = Number(overallOpsSec.toFixed(1));
    opDict.min_zoom_avg_us = minAvgUs < 1e11 ? minAvgUs : 0.0;
    opDict.max_zoom_avg_us = maxAvgUs;
    opDict.total_calls = totalOpCalls;
    opDict.total_time_us = totalOpTimeUs;

    summary[opKey] = {
      name: opDict.name,
      group: opDict.group,
      overall_avg_us: opDict.overall_avg_us,
      overall_ops_per_sec: opDict.overall_ops_per_sec,
      min_avg_us: opDict.min_zoom_avg_us,
      max_avg_us: opDict.max_zoom_avg_us,
    };
  }

  printSummaryTable(summary);

  const now = new Date();
  const timestampClean = now
    .toISOString()
    .replace(/[-:T.]/g, "_")
    .slice(0, 19);

  const outputJsonData = {
    metadata: {
      timestamp: now.toISOString(),
      timestamp_unix: Math.floor(now.getTime() / 1000),
      engine: "Node.js " + process.version,
      platform: process.platform,
      arch: process.arch,
      zoom_min: zoomMin,
      zoom_max: zoomMax,
      zoom_levels_count: zoomMax - zoomMin + 1,
      sample_points_count: config.sample_points_count,
      iterations_per_point: iters,
      warmup_iterations: warmup,
      total_duration_seconds: Number(totalDurationSec.toFixed(2)),
    },
    summary,
    by_operation: resultsByOp,
    by_zoom: byZoom,
  };

  const jsonFilename = `t4_benchmark_${timestampClean}.json`;
  saveJsonFile(outputJsonData, jsonFilename);
}

runBenchmark();
