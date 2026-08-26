import * as h3 from "h3-js";
import * as T4 from "./src/index";
import type { ArrayVector2D } from "@fimbul-works/vec";

// ==============================================================================
// T4 vs Uber H3 Comparative Benchmark Suite
// ==============================================================================

const SAMPLE_POINTS: ArrayVector2D[] = [
  [0.0, 0.0], // Null Island
  [45.0, 45.0], // Mid-lat NE
  [-45.0, 45.0], // Mid-lat NW
  [120.0, -35.0], // Southern mid-lat
  [-120.0, -35.0], // Southern mid-lat W
  [0.0, 89.0], // Near North Pole
  [0.0, -89.0], // Near South Pole
  [179.9, 0.0], // Antimeridian Equator
  [24.9384, 60.1699], // Helsinki
  [-74.006, 40.7128], // New York
  [139.6917, 35.6895], // Tokyo
  [-0.1278, 51.5074], // London
  [151.2093, -33.8688], // Sydney
  [-43.1729, -22.9068], // Rio de Janeiro
  [37.6173, 55.7558], // Moscow
  [18.4241, -33.9249], // Cape Town
];

// Equivalent resolution mapping between H3 (0-15) and T4 (0-28)
// Both span coarse global to sub-meter precision
const TEST_LEVELS = [
  { label: "Coarse / Continental", h3Res: 1, t4Zoom: 2 },
  { label: "Regional / State", h3Res: 4, t4Zoom: 7 },
  { label: "City / Municipal", h3Res: 7, t4Zoom: 12 },
  { label: "Neighborhood / Block", h3Res: 10, t4Zoom: 17 },
  { label: "Building / Property", h3Res: 12, t4Zoom: 21 },
  { label: "Sub-meter / Maximum H3", h3Res: 15, t4Zoom: 25 },
];

const WARMUP = 100;
const ITERS = 1000;

function timeOp(fn: () => void): number {
  for (let w = 0; w < WARMUP; w++) fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) fn();
  const end = process.hrtime.bigint();
  const elapsedUs = Number(end - start) / 1000.0;
  return elapsedUs / ITERS;
}

interface BenchmarkResult {
  operation: string;
  level: string;
  t4AvgUs: number;
  t4OpsSec: number;
  h3AvgUs: number;
  h3OpsSec: number;
  speedup: number; // >1 means T4 is faster
}

function runComparison() {
  console.log(
    "=========================================================================================================",
  );
  console.log(
    "                                T4 vs UBER H3 HEAD-TO-HEAD BENCHMARK                                     ",
  );
  console.log(
    "=========================================================================================================",
  );
  console.log(
    ` Sample Points     : ${SAMPLE_POINTS.length} diverse global coordinates (poles, equator, cities, antimeridian)`,
  );
  console.log(` Iterations/test   : ${ITERS} (+ ${WARMUP} warmup)`);
  console.log(
    "=========================================================================================================\n",
  );

  const results: BenchmarkResult[] = [];

  for (const lvl of TEST_LEVELS) {
    console.log(`\n--- Benchmark Level: ${lvl.label} (H3 Res ${lvl.h3Res} vs T4 Zoom ${lvl.t4Zoom}) ---`);

    // Prepare indices
    const t4Ids: bigint[] = SAMPLE_POINTS.map((pt) => T4.latLngToT4(pt[1], pt[0], lvl.t4Zoom));
    const h3Indices: string[] = SAMPLE_POINTS.map((pt) => h3.latLngToCell(pt[1], pt[0], lvl.h3Res));

    // 1. Lat/Lng -> Index
    const t4IndexTime =
      timeOp(() => {
        for (let p = 0; p < SAMPLE_POINTS.length; p++) {
          T4.latLngToT4(SAMPLE_POINTS[p][1], SAMPLE_POINTS[p][0], lvl.t4Zoom);
        }
      }) / SAMPLE_POINTS.length;

    const h3IndexTime =
      timeOp(() => {
        for (let p = 0; p < SAMPLE_POINTS.length; p++) {
          h3.latLngToCell(SAMPLE_POINTS[p][1], SAMPLE_POINTS[p][0], lvl.h3Res);
        }
      }) / SAMPLE_POINTS.length;

    results.push({
      operation: "latLng -> ID",
      level: lvl.label,
      t4AvgUs: t4IndexTime,
      t4OpsSec: 1000000.0 / t4IndexTime,
      h3AvgUs: h3IndexTime,
      h3OpsSec: 1000000.0 / h3IndexTime,
      speedup: h3IndexTime / t4IndexTime,
    });

    // 2. Index -> Centroid
    const t4CenterTime =
      timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getT4Center(t4Ids[p]);
        }
      }) / t4Ids.length;

    const h3CenterTime =
      timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.cellToLatLng(h3Indices[p]);
        }
      }) / h3Indices.length;

    results.push({
      operation: "ID -> Centroid",
      level: lvl.label,
      t4AvgUs: t4CenterTime,
      t4OpsSec: 1000000.0 / t4CenterTime,
      h3AvgUs: h3CenterTime,
      h3OpsSec: 1000000.0 / h3CenterTime,
      speedup: h3CenterTime / t4CenterTime,
    });

    // 3. Index -> Boundary Vertices
    const t4BoundaryTime =
      timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getT4Vertices(t4Ids[p]);
        }
      }) / t4Ids.length;

    const h3BoundaryTime =
      timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.cellToBoundary(h3Indices[p]);
        }
      }) / h3Indices.length;

    results.push({
      operation: "ID -> Boundary",
      level: lvl.label,
      t4AvgUs: t4BoundaryTime,
      t4OpsSec: 1000000.0 / t4BoundaryTime,
      h3AvgUs: h3BoundaryTime,
      h3OpsSec: 1000000.0 / h3BoundaryTime,
      speedup: h3BoundaryTime / t4BoundaryTime,
    });

    // 4. Index -> Parent
    if (lvl.t4Zoom > 0 && lvl.h3Res > 0) {
      const t4ParentTime =
        timeOp(() => {
          for (let p = 0; p < t4Ids.length; p++) {
            T4.getParentT4Id(t4Ids[p]);
          }
        }) / t4Ids.length;

      const h3ParentTime =
        timeOp(() => {
          for (let p = 0; p < h3Indices.length; p++) {
            h3.cellToParent(h3Indices[p], lvl.h3Res - 1);
          }
        }) / h3Indices.length;

      results.push({
        operation: "ID -> Parent",
        level: lvl.label,
        t4AvgUs: t4ParentTime,
        t4OpsSec: 1000000.0 / t4ParentTime,
        h3AvgUs: h3ParentTime,
        h3OpsSec: 1000000.0 / h3ParentTime,
        speedup: h3ParentTime / t4ParentTime,
      });
    }

    // 5. Index -> Children
    if (lvl.t4Zoom < 28 && lvl.h3Res < 15) {
      const t4ChildrenTime =
        timeOp(() => {
          for (let p = 0; p < t4Ids.length; p++) {
            T4.getT4Children(t4Ids[p]);
          }
        }) / t4Ids.length;

      const h3ChildrenTime =
        timeOp(() => {
          for (let p = 0; p < h3Indices.length; p++) {
            h3.cellToChildren(h3Indices[p], lvl.h3Res + 1);
          }
        }) / h3Indices.length;

      results.push({
        operation: "ID -> Children",
        level: lvl.label,
        t4AvgUs: t4ChildrenTime,
        t4OpsSec: 1000000.0 / t4ChildrenTime,
        h3AvgUs: h3ChildrenTime,
        h3OpsSec: 1000000.0 / h3ChildrenTime,
        speedup: h3ChildrenTime / t4ChildrenTime,
      });
    }

    // 6. Index -> Neighbors (Ring 1)
    const t4NeighborTime =
      timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getT4Neighbors(t4Ids[p]);
        }
      }) / t4Ids.length;

    const h3NeighborTime =
      timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.gridDisk(h3Indices[p], 1);
        }
      }) / h3Indices.length;

    results.push({
      operation: "ID -> Neighbors",
      level: lvl.label,
      t4AvgUs: t4NeighborTime,
      t4OpsSec: 1000000.0 / t4NeighborTime,
      h3AvgUs: h3NeighborTime,
      h3OpsSec: 1000000.0 / h3NeighborTime,
      speedup: h3NeighborTime / t4NeighborTime,
    });

    // 7. Validation
    const t4ValidTime =
      timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.isValidT4Id(t4Ids[p]);
        }
      }) / t4Ids.length;

    const h3ValidTime =
      timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.isValidCell(h3Indices[p]);
        }
      }) / h3Indices.length;

    results.push({
      operation: "isValid",
      level: lvl.label,
      t4AvgUs: t4ValidTime,
      t4OpsSec: 1000000.0 / t4ValidTime,
      h3AvgUs: h3ValidTime,
      h3OpsSec: 1000000.0 / h3ValidTime,
      speedup: h3ValidTime / t4ValidTime,
    });

    // 8. Cell Area
    const t4AreaTime =
      timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getT4CellArea(t4Ids[p], 6371.0);
        }
      }) / t4Ids.length;

    const h3AreaTime =
      timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.cellArea(h3Indices[p], h3.UNITS.km2);
        }
      }) / h3Indices.length;

    results.push({
      operation: "Cell Area",
      level: lvl.label,
      t4AvgUs: t4AreaTime,
      t4OpsSec: 1000000.0 / t4AreaTime,
      h3AvgUs: h3AreaTime,
      h3OpsSec: 1000000.0 / h3AreaTime,
      speedup: h3AreaTime / t4AreaTime,
    });
  }

  // Summary Table Grouped by Operation
  console.log(
    "\n=========================================================================================================",
  );
  console.log(
    "                                       OVERALL AGGREGATE SUMMARY                                          ",
  );
  console.log(
    "=========================================================================================================",
  );
  console.log(
    `${"Operation".padEnd(18)} | ${"T4 Avg (µs)".padStart(12)} | ${"T4 Ops/sec".padStart(14)} | ${"H3 Avg (µs)".padStart(12)} | ${"H3 Ops/sec".padStart(14)} | ${"T4 vs H3 Speedup".padStart(18)}`,
  );
  console.log(
    "-------------------+--------------+----------------+--------------+----------------+-------------------",
  );

  const opGroups: Record<string, { t4Total: number; h3Total: number; count: number }> = {};
  for (const r of results) {
    if (!opGroups[r.operation]) opGroups[r.operation] = { t4Total: 0, h3Total: 0, count: 0 };
    opGroups[r.operation].t4Total += r.t4AvgUs;
    opGroups[r.operation].h3Total += r.h3AvgUs;
    opGroups[r.operation].count += 1;
  }

  for (const op of Object.keys(opGroups)) {
    const g = opGroups[op];
    const t4Avg = g.t4Total / g.count;
    const h3Avg = g.h3Total / g.count;
    const t4Ops = 1000000.0 / t4Avg;
    const h3Ops = 1000000.0 / h3Avg;
    const speedup = h3Avg / t4Avg;
    const speedupStr = `${speedup.toFixed(2)}x ${speedup >= 1.0 ? "FASTER" : "slower"}`;

    console.log(
      `${op.padEnd(18)} | ${t4Avg.toFixed(4).padStart(12)} | ${t4Ops.toLocaleString("en-US", { maximumFractionDigits: 0 }).padStart(14)} | ${h3Avg.toFixed(4).padStart(12)} | ${h3Ops.toLocaleString("en-US", { maximumFractionDigits: 0 }).padStart(14)} | ${speedupStr.padStart(18)}`,
    );
  }
  console.log(
    "=========================================================================================================\n",
  );
}

runComparison();
