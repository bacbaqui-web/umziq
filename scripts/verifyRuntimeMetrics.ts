import assert from "node:assert/strict";
import {
  compareRuntimeMetrics,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import {
  RUNTIME_METRIC_COUNTER_NAMES,
  type ExpectedRuntimeMetrics,
} from "@/engines/canvas/models/runtimeMetricsModel";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";

const metrics = createRuntimeMetricsResource();
const initial = metrics.getSnapshot();

RUNTIME_METRIC_COUNTER_NAMES.forEach((counter) => {
  assert.equal(initial.global[counter], 0);
  assert.equal(initial.frame[counter], 0);
});

metrics.increment("animationEvaluation");
metrics.increment("drawImage", 3);
metrics.increment("surfaceCreate", 2.8);
metrics.increment("surfaceReuse", -1);

assert.equal(metrics.getGlobalSnapshot().animationEvaluation, 1);
assert.equal(metrics.getFrameSnapshot().animationEvaluation, 1);
assert.equal(metrics.getGlobalSnapshot().drawImage, 3);
assert.equal(metrics.getFrameSnapshot().drawImage, 3);
assert.equal(metrics.getGlobalSnapshot().surfaceCreate, 2);
assert.equal(metrics.getFrameSnapshot().surfaceReuse, 0);

metrics.resetFrame();
assert.equal(metrics.getGlobalSnapshot().drawImage, 3);
assert.equal(metrics.getFrameSnapshot().drawImage, 0);
assert.equal(metrics.getFrameSnapshot().animationEvaluation, 0);

metrics.increment("previewRenderer");
metrics.increment("previewSceneGeneration");
metrics.increment("projectUpdate");
metrics.increment("historyCommit");

const sprintBaseline = metrics.saveSprintBaseline();
const taskBaseline = metrics.saveTaskBaseline();
assert.equal(sprintBaseline.drawImage, 3);
assert.equal(taskBaseline.projectUpdate, 1);
assert.equal(metrics.getSprintBaseline()?.drawImage, 3);
assert.equal(metrics.getTaskBaseline()?.historyCommit, 1);

metrics.increment("animationEvaluation", 99);
metrics.increment("drawImage", 2);
metrics.increment("projectUpdate", 1);

const sprintComparison = metrics.compareSprintBaseline();
assert.equal(sprintComparison.kind, "sprint");
assert.equal(sprintComparison.baseline?.animationEvaluation, 1);
assert.equal(sprintComparison.current.animationEvaluation, 100);
const animationDifference = sprintComparison.differences.find(
  (difference) => difference.counter === "animationEvaluation"
);
assert.equal(animationDifference?.baseline, 1);
assert.equal(animationDifference?.current, 100);
assert.equal(animationDifference?.difference, 99);
assert.equal(animationDifference?.percent, 9900);

const drawImageDifference = sprintComparison.differences.find(
  (difference) => difference.counter === "drawImage"
);
assert.equal(drawImageDifference?.baseline, 3);
assert.equal(drawImageDifference?.current, 5);
assert.equal(drawImageDifference?.difference, 2);
assert.equal(drawImageDifference?.percent, 66.66666666666666);

const taskComparison = metrics.compareTaskBaseline();
assert.equal(taskComparison.kind, "task");
assert.equal(taskComparison.baseline?.projectUpdate, 1);
assert.equal(taskComparison.current.projectUpdate, 2);
assert.equal(
  taskComparison.differences.find(
    (difference) => difference.counter === "projectUpdate"
  )?.difference,
  1
);

const improvementMetrics = createRuntimeMetricsResource();
improvementMetrics.increment("animationEvaluation", 100);
improvementMetrics.saveSprintBaseline();
improvementMetrics.resetGlobal();
improvementMetrics.increment("animationEvaluation", 1);
const improvementDifference = improvementMetrics
  .compareSprintBaseline()
  .differences.find(
    (difference) => difference.counter === "animationEvaluation"
  );
assert.equal(improvementDifference?.baseline, 100);
assert.equal(improvementDifference?.current, 1);
assert.equal(improvementDifference?.difference, -99);
assert.equal(improvementDifference?.percent, 99);

const expectedGlobal: ExpectedRuntimeMetrics = {
  animationEvaluation: 100,
  drawImage: { min: 5, max: 5 },
  previewRenderer: { equals: 1 },
  previewSceneGeneration: { min: 1 },
  projectUpdate: 2,
  historyCommit: 1,
};
const globalComparison = compareRuntimeMetrics(
  metrics.getGlobalSnapshot(),
  expectedGlobal
);
assert.equal(globalComparison.pass, true);
assert.equal(globalComparison.results.length, 6);

const expectedFrame: ExpectedRuntimeMetrics = {
  animationEvaluation: 99,
  drawImage: 2,
  previewRenderer: 1,
  previewSceneGeneration: 1,
  projectUpdate: 2,
  historyCommit: 1,
};
assert.equal(
  compareRuntimeMetrics(metrics.getFrameSnapshot(), expectedFrame).pass,
  true
);

const failingComparison = compareRuntimeMetrics(metrics.getGlobalSnapshot(), {
  drawImage: { max: 4 },
});
assert.equal(failingComparison.pass, false);
assert.equal(failingComparison.results[0]?.counter, "drawImage");
assert.equal(failingComparison.results[0]?.actual, 5);

metrics.resetGlobal();
const reset = metrics.getSnapshot();
RUNTIME_METRIC_COUNTER_NAMES.forEach((counter) => {
  assert.equal(reset.global[counter], 0);
  assert.equal(reset.frame[counter], 0);
});
assert.equal(metrics.getSprintBaseline()?.animationEvaluation, 1);
assert.equal(metrics.getTaskBaseline()?.animationEvaluation, 1);

metrics.resetBaseline();
assert.equal(metrics.getSprintBaseline(), null);
assert.equal(metrics.getTaskBaseline(), null);
const emptyBaselineComparison = metrics.compareSprintBaseline();
assert.equal(emptyBaselineComparison.baseline, null);
assert.equal(
  emptyBaselineComparison.differences.find(
    (difference) => difference.counter === "drawImage"
  )?.percent,
  null
);

console.log("Runtime metrics verification passed");
