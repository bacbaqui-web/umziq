import {
  compareRuntimeMetricBaseline,
  createEmptyRuntimeMetricCounters,
  normalizeRuntimeMetricAmount,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import type {
  RuntimeMetricCounterName,
  RuntimeMetricCounters,
  RuntimeMetricsResource,
} from "@/engines/canvas/models/runtimeMetricsModel";

function cloneCounters(
  counters: Record<RuntimeMetricCounterName, number>
): RuntimeMetricCounters {
  return { ...counters };
}

export function createRuntimeMetricsResource(): RuntimeMetricsResource {
  let globalCounters = { ...createEmptyRuntimeMetricCounters() };
  let frameCounters = { ...createEmptyRuntimeMetricCounters() };
  let sprintBaseline: RuntimeMetricCounters | null = null;
  let taskBaseline: RuntimeMetricCounters | null = null;

  return {
    increment: (counter, amount = 1) => {
      const normalizedAmount = normalizeRuntimeMetricAmount(amount);
      if (normalizedAmount === 0) return;
      globalCounters[counter] += normalizedAmount;
      frameCounters[counter] += normalizedAmount;
    },
    resetFrame: () => {
      frameCounters = { ...createEmptyRuntimeMetricCounters() };
    },
    resetGlobal: () => {
      globalCounters = { ...createEmptyRuntimeMetricCounters() };
      frameCounters = { ...createEmptyRuntimeMetricCounters() };
    },
    saveSprintBaseline: () => {
      sprintBaseline = cloneCounters(globalCounters);
      return sprintBaseline;
    },
    saveTaskBaseline: () => {
      taskBaseline = cloneCounters(globalCounters);
      return taskBaseline;
    },
    getSprintBaseline: () =>
      sprintBaseline ? cloneCounters(sprintBaseline) : null,
    getTaskBaseline: () => (taskBaseline ? cloneCounters(taskBaseline) : null),
    compareSprintBaseline: () =>
      compareRuntimeMetricBaseline({
        kind: "sprint",
        baseline: sprintBaseline,
        current: cloneCounters(globalCounters),
      }),
    compareTaskBaseline: () =>
      compareRuntimeMetricBaseline({
        kind: "task",
        baseline: taskBaseline,
        current: cloneCounters(globalCounters),
      }),
    resetBaseline: () => {
      sprintBaseline = null;
      taskBaseline = null;
    },
    getFrameSnapshot: () => cloneCounters(frameCounters),
    getGlobalSnapshot: () => cloneCounters(globalCounters),
    getSnapshot: () => ({
      global: cloneCounters(globalCounters),
      frame: cloneCounters(frameCounters),
    }),
  };
}
