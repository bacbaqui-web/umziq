#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = resolve(projectRoot, "scripts/previewInteractionProfilingBaseline.json");
const inputPaths = {
  position: "/tmp/candidate1-after-position.json",
  wh: "/tmp/candidate1-after-wh.json",
  cpuPosition: "/tmp/candidate1-after-cpu-position.json",
  cpuWh: "/tmp/candidate1-after-cpu-wh.json",
};
const metricNames = [
  "wallCaptureDurationMs",
  "runTaskDurationMs",
  "scriptingDurationMs",
  "layoutDurationMs",
  "paintDurationMs",
  "compositeDurationMs",
  "gcDurationMs",
  "p95PresentedFrameIntervalMs",
  "presentedFrameCount",
  "rawPointerEventCount",
  "msPerRawPointerEvent",
];

const round = (value) => Number.isFinite(value)
  ? Math.round(value * 1_000) / 1_000
  : value;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function readRestoredProductionAsset() {
  const assetDirectory = resolve(projectRoot, "dist/assets");
  const files = await readdir(assetDirectory);
  const assetFiles = files.filter((file) => file.endsWith(".js") && !file.endsWith(".js.map"));
  assert.equal(assetFiles.length, 1);
  const file = assetFiles[0];
  const bytes = await readFile(join(assetDirectory, file));
  return {
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceMap: files.includes(`${file}.map`),
  };
}

function compactTimingRun(run, whScale) {
  return {
    run: run.run,
    valid: run.valid,
    invalidReasons: run.invalidReasons,
    actualDurationMs: round(run.highFrequencyReplay?.actualDurationMs),
    firstToLastDispatchMs: round(run.highFrequencyReplay?.firstToLastDispatchMs),
    maxScheduleDriftMs: round(run.highFrequencyReplay?.maxScheduleDriftMs),
    medianScheduleDriftMs: round(run.highFrequencyReplay?.medianScheduleDriftMs),
    wallCaptureDurationMs: round(run.wallCaptureDurationMs),
    presentedFrameCount: run.presentedFrameCount,
    p95PresentedFrameIntervalMs: round(run.trace?.p95PresentedFrameIntervalMs),
    rawPointerEventCount: run.rawPointerEventCount,
    runTaskMs: round(run.trace?.runTaskDurationMs),
    scriptingMs: round(run.trace?.scriptingDurationMs),
    layoutMs: round(run.trace?.layoutDurationMs),
    paintMs: round(run.trace?.paintDurationMs),
    compositeMs: round(run.trace?.compositeDurationMs),
    gcMs: round(run.trace?.gcDurationMs),
    msPerRawPointerEvent: round(run.msPerRawPointerEvent),
    identityValid: run.setupEvidence?.identityValid ?? false,
    viewportMatches: run.setupEvidence?.viewportMatches ?? false,
    initialFrame: run.setupEvidence?.frame ?? null,
    undoRestored: run.undoRestored,
    liveDraftValidated: whScale
      ? run.whScaleValidation?.linkedScaleValidated === true
        && run.whScaleValidation?.commitValidated === true
      : run.livePositionValidation?.propertiesGizmoLayerSynchronized === true,
    rawTraceFile: run.rawTracePath ? basename(run.rawTracePath) : null,
  };
}

function compactTimingLane(result, whScale) {
  return {
    status: result.valid ? "complete-15-of-15" : "incomplete",
    lane: result.lane,
    productionAsset: result.productionAsset,
    artifactTempRoot: result.environment.traceDirectory,
    rawArtifactPolicy: result.rawArtifactPolicy,
    scenarioResults: Object.fromEntries(
      Object.entries(result.scenarioResults).map(([scenarioId, scenario]) => [scenarioId, {
        status: scenario.status,
        fixture: scenario.fixture,
        mode: scenario.mode,
        glow: scenario.glow,
        cadence: scenario.cadence,
        rawRuns: scenario.rawRuns.map((run) => compactTimingRun(run, whScale)),
        statistics: scenario.statistics,
      }])
    ),
    invalidAttempts: Object.entries(result.scenarioResults).flatMap(([scenarioId, scenario]) =>
      scenario.rawRuns
        .filter((run) => !run.valid)
        .map((run) => ({ scenarioId, run: run.run, reasons: run.invalidReasons }))
    ),
  };
}

function timingComparison(beforeLane, afterLane) {
  return Object.fromEntries(
    Object.entries(afterLane.scenarioResults).map(([scenarioId, afterScenario]) => {
      const beforeScenario = beforeLane.scenarioResults[scenarioId];
      assert.ok(beforeScenario, `Missing Before scenario ${scenarioId}`);
      const metrics = Object.fromEntries(metricNames.map((metricName) => {
        const before = beforeScenario.statistics[metricName];
        const after = afterScenario.statistics[metricName];
        assert.ok(before && after, `Missing ${scenarioId} ${metricName}`);
        const deltaMedian = round(after.median - before.median);
        const combinedMad = round(before.mad + after.mad);
        return [metricName, {
          beforeMedian: before.median,
          afterMedian: after.median,
          deltaMedian,
          beforeMad: before.mad,
          afterMad: after.mad,
          noiseBand: {
            method: "plus-or-minus sum of Before MAD and After MAD",
            lower: -combinedMad,
            upper: combinedMad,
            deltaInsideBand: Math.abs(deltaMedian) <= combinedMad,
          },
        }];
      }));
      return [scenarioId, { metrics }];
    })
  );
}

function originalContributor(item) {
  const original = item.mappedFrame?.original;
  return original ? {
    source: original.source,
    line: original.line,
    name: original.name,
    selfSamples: item.selfSamples,
    selfTimeMs: item.selfTimeMs,
    totalSamples: item.totalSamples,
    totalTimeMs: item.totalTimeMs,
  } : null;
}

function isRequestedContributor(item) {
  return /EditorShell\.tsx|EditorDraftBoundary\.tsx|useEditorRoot\.ts|useEditorState\.ts|engines\/properties\/|engines\/canvas\/(useCanvas|controllers\/useCanvas|composers\/useCanvas)/.test(
    item.source
  );
}

function aggregateContributors(runs) {
  const aggregate = new Map();
  for (const run of runs) {
    const seen = new Set();
    for (const raw of run.cpuProfile.focusedApplicationContributors) {
      const item = originalContributor(raw);
      if (!item || !isRequestedContributor(item)) continue;
      const key = `${item.source}:${item.line}:${item.name}`;
      const current = aggregate.get(key) ?? {
        source: item.source,
        line: item.line,
        name: item.name,
        observedRuns: 0,
        selfSamples: 0,
        selfTimeMs: 0,
        totalSamples: 0,
        totalTimeMs: 0,
      };
      if (!seen.has(key)) {
        current.observedRuns += 1;
        seen.add(key);
      }
      current.selfSamples += item.selfSamples;
      current.selfTimeMs += item.selfTimeMs;
      current.totalSamples += item.totalSamples;
      current.totalTimeMs += item.totalTimeMs;
      aggregate.set(key, current);
    }
  }
  return [...aggregate.values()]
    .map((item) => ({
      ...item,
      selfTimeMs: round(item.selfTimeMs),
      totalTimeMs: round(item.totalTimeMs),
    }))
    .sort((left, right) => right.totalTimeMs - left.totalTimeMs);
}

function compactCpuLane(result) {
  const scenario = Object.values(result.scenarioResults)[0];
  const validRuns = scenario.rawRuns.filter((run) => run.valid);
  assert.equal(validRuns.length, 3);
  return {
    status: "complete-3-of-3",
    lane: result.lane,
    excludedFromTimingStatistics: true,
    profilingBuild: {
      command: "npm run build -- --sourcemap",
      assetFile: result.productionAsset.file,
      assetSha256: result.productionAsset.sha256,
      sourceMapFile: result.productionAsset.sourceMapFile,
      sourceMapSha256: result.productionAsset.sourceMapSha256,
      mixedWithTimingBuild: false,
    },
    artifactTempRoot: result.environment.traceDirectory,
    rawArtifactPolicy: result.rawArtifactPolicy,
    scenarioId: Object.keys(result.scenarioResults)[0],
    rawRuns: scenario.rawRuns.map((run) => ({
      run: run.run,
      valid: run.valid,
      invalidReasons: run.invalidReasons,
      excludedFromTimingStatistics: true,
      sampleCount: run.cpuProfile?.sampleCount ?? null,
      profileDurationMs: round(run.cpuProfile?.profileDurationMs),
      replayActualDurationMs: round(run.highFrequencyReplay?.actualDurationMs),
      replayMaxScheduleDriftMs: round(run.highFrequencyReplay?.maxScheduleDriftMs),
      sourceMapping: run.cpuProfile?.sourceMapping ?? null,
      focusedApplicationContributors: run.cpuProfile
        ? run.cpuProfile.focusedApplicationContributors
          .map(originalContributor)
          .filter((item) => item && isRequestedContributor(item))
        : [],
      liveDraftValidated: run.livePositionValidation
        ? run.livePositionValidation.propertiesGizmoLayerSynchronized === true
        : run.whScaleValidation
          ? run.whScaleValidation.linkedScaleValidated === true
            && run.whScaleValidation.commitValidated === true
          : false,
      undoRestored: run.undoRestored ?? null,
      rawProfileFile: run.rawProfilePath ? basename(run.rawProfilePath) : null,
    })),
    aggregateFocusedApplicationContributors: aggregateContributors(validRuns),
    invalidAttempts: scenario.rawRuns
      .filter((run) => !run.valid)
      .map((run) => ({ run: run.run, reasons: run.invalidReasons })),
    sourceMappingValidRuns: validRuns.filter((run) =>
      run.cpuProfile.sourceMapping.status === "mapped-original-application-sources"
    ).length,
  };
}

function sumMatching(items, predicate, sampleField, timeField) {
  const matching = items.filter(predicate);
  return {
    observed: matching.length > 0,
    samples: matching.reduce((sum, item) => sum + (item[sampleField] ?? item.samples ?? 0), 0),
    timeMs: round(matching.reduce((sum, item) => sum + (item[timeField] ?? item.timeMs ?? 0), 0)),
  };
}

function cpuFrameComparison(beforeLane, afterLane) {
  const beforeSelf = beforeLane.aggregateApplicationSelfContributors;
  const beforeTotal = beforeLane.aggregateApplicationTotalContributors;
  const after = afterLane.aggregateFocusedApplicationContributors;
  const categories = {
    EditorShell: (item) => item.source.endsWith("/EditorShell.tsx") && item.name === "EditorShell",
    useEditorRoot: (item) => item.source.endsWith("/useEditorRoot.ts"),
    EditorDraftBoundary: (item) => item.source.endsWith("/EditorDraftBoundary.tsx") && item.name === "EditorDraftBoundary",
    useEditorState: (item) => item.source.endsWith("/useEditorState.ts") && item.name === "useEditorState",
    Properties: (item) => item.source.includes("/engines/visual/"),
    Canvas: (item) => item.source.includes("/engines/canvas/"),
  };
  return {
    coverage: {
      before: "stored aggregate application top contributors from immutable Before profile",
      after: "all explicitly focused mapped application contributors from three After profiles",
      interpretation: "sample/time observations only; absence is not a performance conclusion",
    },
    frames: Object.fromEntries(Object.entries(categories).map(([name, predicate]) => [name, {
      self: {
        before: sumMatching(beforeSelf, predicate, "samples", "timeMs"),
        after: sumMatching(after, predicate, "selfSamples", "selfTimeMs"),
      },
      total: {
        before: sumMatching(beforeTotal, predicate, "samples", "timeMs"),
        after: sumMatching(after, predicate, "totalSamples", "totalTimeMs"),
      },
    }])),
  };
}

const baseline = await readJson(baselinePath);
const [position, wh, cpuPosition, cpuWh, restoredProductionAsset] = await Promise.all([
  readJson(inputPaths.position),
  readJson(inputPaths.wh),
  readJson(inputPaths.cpuPosition),
  readJson(inputPaths.cpuWh),
  readRestoredProductionAsset(),
]);
assert.equal(position.valid, true);
assert.equal(wh.valid, true);
assert.equal(cpuPosition.valid, true);
assert.equal(cpuWh.valid, true);
assert.equal(position.productionAsset.sha256, wh.productionAsset.sha256);
assert.equal(restoredProductionAsset.sha256, position.productionAsset.sha256);
assert.equal(restoredProductionAsset.sourceMap, false);
assert.equal(cpuPosition.productionAsset.sha256, cpuWh.productionAsset.sha256);
assert.notEqual(cpuPosition.productionAsset.sha256, position.productionAsset.sha256);

const afterPosition = compactTimingLane(position, false);
const afterWh = compactTimingLane(wh, true);
const afterCpuPosition = compactCpuLane(cpuPosition);
const afterCpuWh = compactCpuLane(cpuWh);
baseline.candidate1ReactDraftBoundaryAfter = {
  status: "complete-30-of-30-timing-and-6-of-6-cpu",
  recordedAtUtc: new Date().toISOString(),
  candidate: "Candidate 1 React Draft Boundary",
  decision: "pending-supervisor-gate",
  statementBoundary: "Observed samples, times, medians, deltas, and MAD bands only; no accepted/rejected/rollback conclusion",
  protocol: {
    timing: "100 samples over one second using absolute monotonic deadlines; seed and two RAF outside capture; pointer up outside capture",
    cpu: "separate 100-sample source-map build profiles excluded from timing statistics",
    beforeSectionsImmutable: [
      "cdpHighFrequencySteadyMatrix",
      "cdpWhScaleHighFrequencyMatrix",
      "cdpCpuAttribution",
      "cdpWhScaleCpuAttribution",
    ],
  },
  productionBuild: position.productionAsset,
  profilingBuild: afterCpuPosition.profilingBuild,
  restoredProductionBuild: restoredProductionAsset,
  runAccounting: {
    positionTiming: { valid: 15, required: 15, invalidAttempts: afterPosition.invalidAttempts.length },
    whTiming: { valid: 15, required: 15, invalidAttempts: afterWh.invalidAttempts.length },
    positionCpu: { valid: 3, required: 3, invalidAttempts: afterCpuPosition.invalidAttempts.length },
    whCpu: { valid: 3, required: 3, invalidAttempts: afterCpuWh.invalidAttempts.length },
  },
  functionalValidity: {
    positionTimingLivePropertiesGizmoLayer: Object.values(afterPosition.scenarioResults)
      .flatMap((scenario) => scenario.rawRuns)
      .filter((run) => run.valid)
      .every((run) => run.liveDraftValidated),
    whTimingLivePropertiesGizmoLinkedScale: Object.values(afterWh.scenarioResults)
      .flatMap((scenario) => scenario.rawRuns)
      .filter((run) => run.valid)
      .every((run) => run.liveDraftValidated),
    timingIdentityViewportFrameUndo: [...Object.values(afterPosition.scenarioResults), ...Object.values(afterWh.scenarioResults)]
      .flatMap((scenario) => scenario.rawRuns)
      .filter((run) => run.valid)
      .every((run) => run.identityValid && run.viewportMatches && run.initialFrame === 0 && run.undoRestored),
    cpuOriginalSourceMapping: afterCpuPosition.sourceMappingValidRuns === 3
      && afterCpuWh.sourceMappingValidRuns === 3,
    pointerMoveProjectHistory: "verified by deterministic fixtures, not inferred from CDP timing traces",
    pointerUpFinalFlushCancelUndo: "verified by transform semantic noop, drag performance/integration, and Project History fixtures",
  },
  timing: {
    position: afterPosition,
    whScale: afterWh,
  },
  beforeAfterTimingComparison: {
    position: timingComparison(baseline.cdpHighFrequencySteadyMatrix, afterPosition),
    whScale: timingComparison(baseline.cdpWhScaleHighFrequencyMatrix, afterWh),
  },
  cpuAttribution: {
    position: afterCpuPosition,
    whScale: afterCpuWh,
    positionBeforeAfterFrames: cpuFrameComparison(baseline.cdpCpuAttribution, afterCpuPosition),
    whScaleBeforeAfterFrames: cpuFrameComparison(baseline.cdpWhScaleCpuAttribution, afterCpuWh),
  },
};

await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log("Candidate 1 React Draft Boundary After profile recorded");
