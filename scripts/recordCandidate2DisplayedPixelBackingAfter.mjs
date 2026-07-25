#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = resolve(root, "scripts/previewInteractionProfilingBaseline.json");
const paths = {
  position: "/tmp/candidate2-after-position.json",
  wh: "/tmp/candidate2-after-wh.json",
  rasterBefore: "/tmp/wh-residual-attribution.json",
  rasterAfter: "/tmp/candidate2-after-raster.json",
};
const metricNames = [
  "wallCaptureDurationMs", "runTaskDurationMs", "scriptingDurationMs", "layoutDurationMs",
  "paintDurationMs", "compositeDurationMs", "gcDurationMs", "p95PresentedFrameIntervalMs",
  "presentedFrameCount", "rawPointerEventCount", "msPerRawPointerEvent",
];
const rasterNames = [
  "SkCanvas::experimental_DrawEdgeAAImageSet", "TileManager::CreateRasterTask",
  "RendererRasterWorker", "MainFrame.Draw", "DirectRenderer::DrawFrame", "RasterTask",
];
const round = (value) => Number.isFinite(value) ? Math.round(value * 1_000) / 1_000 : value;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

function compactRun(run, wh) {
  return {
    run: run.run,
    valid: run.valid,
    invalidReasons: run.invalidReasons,
    replayActualDurationMs: round(run.highFrequencyReplay?.actualDurationMs),
    replayMaxScheduleDriftMs: round(run.highFrequencyReplay?.maxScheduleDriftMs),
    wallCaptureDurationMs: round(run.wallCaptureDurationMs),
    runTaskMs: round(run.trace?.runTaskDurationMs),
    scriptingMs: round(run.trace?.scriptingDurationMs),
    layoutMs: round(run.trace?.layoutDurationMs),
    paintMs: round(run.trace?.paintDurationMs),
    p95PresentedFrameIntervalMs: round(run.trace?.p95PresentedFrameIntervalMs),
    presentedFrameCount: run.presentedFrameCount,
    rawPointerEventCount: run.rawPointerEventCount,
    msPerRawPointerEvent: round(run.msPerRawPointerEvent),
    identityValid: run.setupEvidence?.identityValid === true,
    viewportMatches: run.setupEvidence?.viewportMatches === true,
    initialFrame: run.setupEvidence?.frame,
    liveDraftValidated: wh
      ? run.whScaleValidation?.linkedScaleValidated === true && run.whScaleValidation?.commitValidated === true
      : run.livePositionValidation?.propertiesGizmoLayerSynchronized === true,
    undoRestored: run.undoRestored === true,
    renderSurfaceIdentity: run.renderSurfaceIdentity,
    rawTraceFile: basename(run.rawTracePath),
  };
}

function compactLane(result, wh) {
  return {
    status: result.valid ? "complete-15-of-15" : "incomplete",
    lane: result.lane,
    productionAsset: result.productionAsset,
    artifactTempRoot: result.environment.traceDirectory,
    rawArtifactPolicy: result.rawArtifactPolicy,
    scenarioResults: Object.fromEntries(Object.entries(result.scenarioResults).map(([id, scenario]) => [id, {
      fixture: scenario.fixture, mode: scenario.mode, glow: scenario.glow, cadence: scenario.cadence,
      rawRuns: scenario.rawRuns.map((run) => compactRun(run, wh)), statistics: scenario.statistics,
    }])),
  };
}

function compare(beforeLane, afterLane) {
  return Object.fromEntries(Object.entries(afterLane.scenarioResults).map(([id, after]) => {
    const before = beforeLane.scenarioResults[id];
    assert.ok(before, `missing Before scenario ${id}`);
    return [id, { metrics: Object.fromEntries(metricNames.map((name) => {
      const b = before.statistics[name];
      const a = after.statistics[name];
      assert.ok(b && a, `missing ${id} ${name}`);
      const deltaMedian = round(a.median - b.median);
      const combinedMad = round(a.mad + b.mad);
      return [name, {
        beforeMedian: b.median, afterMedian: a.median, deltaMedian,
        beforeMad: b.mad, afterMad: a.mad,
        noiseBand: { method: "plus-or-minus sum of Before MAD and After MAD", lower: -combinedMad, upper: combinedMad,
          deltaInsideBand: Math.abs(deltaMedian) <= combinedMad },
      }];
    })) }];
  }));
}

function eventMatches(name, contract) {
  return contract === "SkCanvas::experimental_DrawEdgeAAImageSet"
    ? name.includes(contract)
    : name === contract;
}

async function rasterSummary(result) {
  const output = {};
  for (const [id, scenario] of Object.entries(result.scenarioResults)) {
    const run = scenario.rawRuns[0];
    const raw = await readJson(run.rawTracePath);
    const complete = raw.traceEvents.filter((event) => event.ph === "X" && Number.isFinite(event.dur));
    output[id] = {
      valid: run.valid,
      excludedFromTimingStatistics: true,
      renderSurface: run.residualAttribution,
      events: Object.fromEntries(rasterNames.map((contract) => {
        const durations = complete.filter((event) => eventMatches(event.name, contract)).map((event) => event.dur / 1_000).sort((a, b) => a - b);
        const p95Index = durations.length ? Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1) : 0;
        return [contract, { count: durations.length, totalMs: round(durations.reduce((sum, value) => sum + value, 0)), p95Ms: round(durations[p95Index] ?? 0) }];
      })),
      rawTraceFile: basename(run.rawTracePath),
    };
  }
  return output;
}

const [baseline, position, wh, rasterBeforeResult, rasterAfterResult] = await Promise.all([
  readJson(baselinePath), readJson(paths.position), readJson(paths.wh), readJson(paths.rasterBefore), readJson(paths.rasterAfter),
]);
assert.equal(position.valid, true);
assert.equal(wh.valid, true);
assert.equal(rasterAfterResult.valid, true);
assert.equal(position.productionAsset.sha256, wh.productionAsset.sha256);
assert.equal(position.productionAsset.sha256, rasterAfterResult.productionAsset.sha256);
for (const result of [position, wh]) {
  assert.equal(Object.values(result.scenarioResults).flatMap((scenario) => scenario.rawRuns).filter((run) => run.valid).length, 15);
}
const allTimingRuns = [position, wh].flatMap((result) => Object.values(result.scenarioResults).flatMap((scenario) => scenario.rawRuns));
assert.ok(allTimingRuns.every((run) => run.setupEvidence.identityValid && run.setupEvidence.viewportMatches && run.setupEvidence.frame === 0));
assert.ok(allTimingRuns.every((run) => run.undoRestored && run.renderSurfaceIdentity));

const files = await readdir(resolve(root, "dist/assets"));
const js = files.filter((file) => file.endsWith(".js") && !file.endsWith(".js.map"));
assert.equal(js.length, 1);
const bytes = await readFile(join(root, "dist/assets", js[0]));
const productionBuild = { file: js[0], sha256: createHash("sha256").update(bytes).digest("hex"), sourceMap: files.includes(`${js[0]}.map`) };
assert.equal(productionBuild.sha256, position.productionAsset.sha256);
assert.equal(productionBuild.sourceMap, false);

baseline.candidate2DisplayedPixelPreviewBackingAfter = {
  status: "measurement-complete-decision-pending",
  recordedAtUtc: new Date().toISOString(),
  candidate: "candidate2-displayed-pixel-preview-backing",
  decision: "pending-supervisor-gate",
  statementBoundary: "Observed samples, medians, deltas, MAD bands, p95 intervals, and raster/compositor counts only; no accepted/rejected/rollback conclusion",
  protocol: {
    browserProductionCdp: true, viewportAndDprFrozen: true, samplesPerReplay: 100,
    timingRunsPerScenario: 3, rasterRunsPerScenario: 1, rasterExcludedFromTimingStatistics: true,
  },
  productionBuild,
  runAccounting: {
    positionTiming: { valid: 15, required: 15, invalidAttempts: 0 },
    whTiming: { valid: 15, required: 15, invalidAttempts: 0 },
    rasterDiagnostic: { valid: 2, required: 2, invalidAttempts: 0 },
  },
  functionalValidity: {
    positionDraftPropertiesGizmoLayerPerRun: true,
    whDraftLinkedScaleGizmoCommitPerRun: true,
    undoExactRestorePerRun: true,
    fixtureIdentityViewportFramePerRun: true,
    projectUpdateOneHistoryOne: "verified by deterministic Project History and drag integration fixtures; not inferred from CDP timing traces",
  },
  renderSurfaceContract: {
    flat: { backingPixels: { width: 540, height: 960 }, canvasDomCss: { width: 1080, height: 1920 } },
    largeNestedAndGlow: { backingPixels: { width: 1600, height: 1600 }, canvasDomCss: { width: 800, height: 800 } },
    previewViewportDomCss: { width: 1180, height: 726 }, devicePixelRatio: 2,
    allTimingRunsBeforeAndDraftMatch: true,
  },
  timing: { position: compactLane(position, false), wh: compactLane(wh, true) },
  beforeAfterTimingComparison: {
    position: compare(baseline.cdpHighFrequencySteadyMatrix, position),
    wh: compare(baseline.cdpWhScaleHighFrequencyMatrix, wh),
  },
  rasterCompositorDiagnostic: {
    excludedFromTimingStatistics: true,
    traceCategories: "timeline+frame+cc+gpu+viz+cc.debug+gpu.debug+layers+skia",
    before: await rasterSummary(rasterBeforeResult),
    after: await rasterSummary(rasterAfterResult),
  },
};

await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log("Candidate 2 displayed-pixel backing After evidence recorded");
