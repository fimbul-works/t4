import * as fs from "node:fs";
import * as path from "node:path";
import type { ArrayVector2D } from "@fimbul-works/vec";
import * as h3 from "h3-js";
import * as T4 from "./src/index";

// ==============================================================================
// T4 vs Uber H3 Head-to-Head Benchmark Suite (Using Full T4 Corpus)
// ==============================================================================

interface CorpusRecord {
  name: string;
  category?: string;
  country?: string;
  latitude: number;
  longitude: number;
  cells: {
    zoom: number;
    id: string;
    hex: string;
    neighbors: [string, string, string];
  }[];
}

// 1. Load dataset from t4_corpus.json (falling back to cities.csv / edge_cases.csv if missing)
function loadCorpus(): { points: ArrayVector2D[]; t4IdsByZoom: bigint[][] } {
  const corpusPath = path.resolve("./t4_corpus.json");
  if (fs.existsSync(corpusPath)) {
    console.log(`Loading points and test vectors from ${corpusPath}...`);
    const raw = fs.readFileSync(corpusPath, "utf-8");
    const records: CorpusRecord[] = JSON.parse(raw);
    const points: ArrayVector2D[] = new Array(records.length);
    const t4IdsByZoom: bigint[][] = Array.from({ length: 29 }, () => new Array(records.length));

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      points[i] = [rec.longitude, rec.latitude];
      for (let z = 0; z <= 28; z++) {
        t4IdsByZoom[z][i] = BigInt(rec.cells[z].id);
      }
    }
    return { points, t4IdsByZoom };
  }

  // Fallback if corpus not yet generated
  console.log("t4_corpus.json not found, falling back to cities.csv...");
  const citiesPath = path.resolve("./cities.csv");
  const rawCsv = fs.readFileSync(citiesPath, "utf-8");
  const lines = rawCsv
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(1);
  const points: ArrayVector2D[] = [];

  for (const line of lines) {
    const parts = line.split(",");
    const lat = Number.parseFloat(parts[parts.length - 2]);
    const lng = Number.parseFloat(parts[parts.length - 1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90) {
      points.push([lng, lat]);
    }
  }

  const t4IdsByZoom: bigint[][] = Array.from({ length: 29 }, () => new Array(points.length));
  for (let z = 0; z <= 28; z++) {
    for (let i = 0; i < points.length; i++) {
      t4IdsByZoom[z][i] = T4.latLngToT4(points[i][1], points[i][0], z);
    }
  }

  return { points, t4IdsByZoom };
}

const { points: SAMPLE_POINTS, t4IdsByZoom } = loadCorpus();

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

const WARMUP_PASSES = 1;
const TIMING_PASSES = 5;
const SAMPLES = 3;

/**
 * Runs a benchmark function across all sample points over multiple passes and rounds.
 */
function timeOp(fn: () => void): number {
  // Warmup pass over all points
  for (let w = 0; w < WARMUP_PASSES; w++) {
    fn();
  }

  let minTimeUs = Infinity;

  // Run multiple rounds and take minimum to filter background OS noise
  for (let s = 0; s < SAMPLES; s++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < TIMING_PASSES; i++) {
      fn();
    }
    const end = process.hrtime.bigint();
    const totalOps = TIMING_PASSES * SAMPLE_POINTS.length;
    const elapsedUs = Number(end - start) / 1000.0;
    const avgPerOpUs = elapsedUs / totalOps;
    if (avgPerOpUs < minTimeUs) {
      minTimeUs = avgPerOpUs;
    }
  }

  return minTimeUs;
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
    ` Sample Points     : ${SAMPLE_POINTS.length.toLocaleString()} locations from t4_corpus.json (cities + edge cases)`,
  );
  console.log(
    ` Iterations/test   : ${TIMING_PASSES} passes x ${SAMPLES} sample rounds (${(
      TIMING_PASSES * SAMPLES * SAMPLE_POINTS.length
    ).toLocaleString()} total executions/test)`,
  );
  console.log(
    "=========================================================================================================\n",
  );

  const results: BenchmarkResult[] = [];

  for (const lvl of TEST_LEVELS) {
    console.log(`\n--- Benchmark Level: ${lvl.label} (H3 Res ${lvl.h3Res} vs T4 Zoom ${lvl.t4Zoom}) ---`);

    // Prepare indices for this level
    const t4Ids: bigint[] = t4IdsByZoom[lvl.t4Zoom];
    const h3Indices: string[] = SAMPLE_POINTS.map((pt) => h3.latLngToCell(pt[1], pt[0], lvl.h3Res));

    // 1a. Lat/Lng -> Index (Warped - Default)
    const t4WarpedTime = timeOp(() => {
      for (let p = 0; p < SAMPLE_POINTS.length; p++) {
        T4.latLngToT4(SAMPLE_POINTS[p][1], SAMPLE_POINTS[p][0], lvl.t4Zoom);
      }
    });

    const h3IndexTime = timeOp(() => {
      for (let p = 0; p < SAMPLE_POINTS.length; p++) {
        h3.latLngToCell(SAMPLE_POINTS[p][1], SAMPLE_POINTS[p][0], lvl.h3Res);
      }
    });

    results.push({
      operation: "latLng -> ID (warped)",
      level: lvl.label,
      t4AvgUs: t4WarpedTime,
      t4OpsSec: 1000000.0 / t4WarpedTime,
      h3AvgUs: h3IndexTime,
      h3OpsSec: 1000000.0 / h3IndexTime,
      speedup: h3IndexTime / t4WarpedTime,
    });

    // 1b. Lat/Lng -> Index (Raw - Unwarped)
    const t4RawTime = timeOp(() => {
      for (let p = 0; p < SAMPLE_POINTS.length; p++) {
        T4.latLngToT4(SAMPLE_POINTS[p][1], SAMPLE_POINTS[p][0], lvl.t4Zoom, { authalicWarp: false });
      }
    });

    results.push({
      operation: "latLng -> ID (raw)",
      level: lvl.label,
      t4AvgUs: t4RawTime,
      t4OpsSec: 1000000.0 / t4RawTime,
      h3AvgUs: h3IndexTime,
      h3OpsSec: 1000000.0 / h3IndexTime,
      speedup: h3IndexTime / t4RawTime,
    });

    // 2. Index -> Centroid
    const t4CenterTime = timeOp(() => {
      for (let p = 0; p < t4Ids.length; p++) {
        T4.getT4Center(t4Ids[p]);
      }
    });

    const h3CenterTime = timeOp(() => {
      for (let p = 0; p < h3Indices.length; p++) {
        h3.cellToLatLng(h3Indices[p]);
      }
    });

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
    const t4BoundaryTime = timeOp(() => {
      for (let p = 0; p < t4Ids.length; p++) {
        T4.getT4Vertices(t4Ids[p]);
      }
    });

    const h3BoundaryTime = timeOp(() => {
      for (let p = 0; p < h3Indices.length; p++) {
        h3.cellToBoundary(h3Indices[p]);
      }
    });

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
      const t4ParentTime = timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getParentT4Id(t4Ids[p]);
        }
      });

      const h3ParentTime = timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.cellToParent(h3Indices[p], lvl.h3Res - 1);
        }
      });

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
      const t4ChildrenTime = timeOp(() => {
        for (let p = 0; p < t4Ids.length; p++) {
          T4.getT4Children(t4Ids[p]);
        }
      });

      const h3ChildrenTime = timeOp(() => {
        for (let p = 0; p < h3Indices.length; p++) {
          h3.cellToChildren(h3Indices[p], lvl.h3Res + 1);
        }
      });

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
    const t4NeighborTime = timeOp(() => {
      for (let p = 0; p < t4Ids.length; p++) {
        T4.getT4Neighbors(t4Ids[p]);
      }
    });

    const h3NeighborTime = timeOp(() => {
      for (let p = 0; p < h3Indices.length; p++) {
        h3.gridDisk(h3Indices[p], 1);
      }
    });

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
    const t4ValidTime = timeOp(() => {
      for (let p = 0; p < t4Ids.length; p++) {
        T4.isValidT4Id(t4Ids[p]);
      }
    });

    const h3ValidTime = timeOp(() => {
      for (let p = 0; p < h3Indices.length; p++) {
        h3.isValidCell(h3Indices[p]);
      }
    });

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
    const t4AreaTime = timeOp(() => {
      for (let p = 0; p < t4Ids.length; p++) {
        T4.getT4CellArea(t4Ids[p]);
      }
    });

    const h3AreaTime = timeOp(() => {
      for (let p = 0; p < h3Indices.length; p++) {
        h3.cellArea(h3Indices[p], h3.UNITS.km2);
      }
    });

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
    "Operation".padEnd(22) +
      " | " +
      " T4 Avg (µs)".padStart(12) +
      " | " +
      "    T4 Ops/sec".padStart(14) +
      " | " +
      " H3 Avg (µs)".padStart(12) +
      " | " +
      "    H3 Ops/sec".padStart(14) +
      " | " +
      "  T4 vs H3 Speedup",
  );
  console.log(
    "-----------------------+--------------+----------------+--------------+----------------+-------------------",
  );

  const ops = [
    "latLng -> ID (warped)",
    "latLng -> ID (raw)",
    "ID -> Centroid",
    "ID -> Boundary",
    "ID -> Parent",
    "ID -> Children",
    "ID -> Neighbors",
    "isValid",
    "Cell Area",
  ];

  for (const op of ops) {
    const opResults = results.filter((r) => r.operation === op);
    if (opResults.length === 0) continue;

    const avgT4 = opResults.reduce((sum, r) => sum + r.t4AvgUs, 0) / opResults.length;
    const avgH3 = opResults.reduce((sum, r) => sum + r.h3AvgUs, 0) / opResults.length;
    const t4Ops = 1000000.0 / avgT4;
    const h3Ops = 1000000.0 / avgH3;
    const speedup = avgH3 / avgT4;

    const speedupStr =
      speedup >= 1.05
        ? `${speedup.toFixed(2)}x FASTER`
        : speedup <= 0.95
          ? `${speedup.toFixed(2)}x slower`
          : "~1.0x (Parity)";

    console.log(
      op.padEnd(22) +
        " | " +
        avgT4.toFixed(4).padStart(12) +
        " | " +
        Math.round(t4Ops).toLocaleString().padStart(14) +
        " | " +
        avgH3.toFixed(4).padStart(12) +
        " | " +
        Math.round(h3Ops).toLocaleString().padStart(14) +
        " | " +
        speedupStr.padStart(19),
    );
  }

  console.log(
    "=========================================================================================================\n",
  );
}

runComparison();
