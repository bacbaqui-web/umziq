import {
  RUNTIME_METRIC_COUNTER_NAMES,
  type ExpectedRuntimeMetrics,
  type RuntimeMetricComparisonResult,
  type RuntimeMetricCounterName,
  type RuntimeMetricCounters,
  type RuntimeMetricExpectation,
  type RuntimeMetricsBaselineComparison,
  type RuntimeMetricsBaselineKind,
  type RuntimeMetricsComparison,
  type RuntimeMetricsResource,
} from "@/engines/canvas/models/runtimeMetricsModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render";

export function isRuntimeMetricCounterName(
  value: string
): value is RuntimeMetricCounterName {
  return RUNTIME_METRIC_COUNTER_NAMES.includes(
    value as RuntimeMetricCounterName
  );
}

export function createRuntimeMetricRecordPort(
  metrics?: RuntimeMetricsResource
): RuntimeMetricRecordPort | undefined {
  if (!metrics) return undefined;
  return {
    increment: (counter, amount) => {
      if (!isRuntimeMetricCounterName(counter)) return;
      metrics.increment(counter, amount);
    },
    resetFrame: metrics.resetFrame,
  };
}

export function createEmptyRuntimeMetricCounters(): RuntimeMetricCounters {
  return RUNTIME_METRIC_COUNTER_NAMES.reduce(
    (counters, counter) => ({ ...counters, [counter]: 0 }),
    {} as Record<RuntimeMetricCounterName, number>
  );
}

export function normalizeRuntimeMetricAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function calculateRuntimeMetricPercent(
  baseline: number,
  difference: number
): number | null {
  if (baseline === 0) return null;
  return (Math.abs(difference) / baseline) * 100;
}

export function compareRuntimeMetricBaseline({
  kind,
  baseline,
  current,
}: {
  kind: RuntimeMetricsBaselineKind;
  baseline: RuntimeMetricCounters | null;
  current: RuntimeMetricCounters;
}): RuntimeMetricsBaselineComparison {
  return {
    kind,
    baseline,
    current,
    differences: RUNTIME_METRIC_COUNTER_NAMES.map((counter) => {
      const baselineValue = baseline?.[counter] ?? 0;
      const currentValue = current[counter];
      const difference = currentValue - baselineValue;
      return {
        counter,
        baseline: baselineValue,
        current: currentValue,
        difference,
        percent: calculateRuntimeMetricPercent(baselineValue, difference),
      };
    }),
  };
}

function evaluateRuntimeMetricExpectation(
  actual: number,
  expected: RuntimeMetricExpectation
): boolean {
  if (typeof expected === "number") {
    return actual === expected;
  }

  if (expected.equals !== undefined && actual !== expected.equals) {
    return false;
  }
  if (expected.min !== undefined && actual < expected.min) {
    return false;
  }
  if (expected.max !== undefined && actual > expected.max) {
    return false;
  }

  return true;
}

export function compareRuntimeMetrics(
  actual: RuntimeMetricCounters,
  expected: ExpectedRuntimeMetrics
): RuntimeMetricsComparison {
  const results = Object.entries(expected).map(([counter, expectation]) => {
    const metricCounter = counter as RuntimeMetricCounterName;
    const metricExpectation = expectation as RuntimeMetricExpectation;
    const result: RuntimeMetricComparisonResult = {
      counter: metricCounter,
      actual: actual[metricCounter],
      expected: metricExpectation,
      pass: evaluateRuntimeMetricExpectation(
        actual[metricCounter],
        metricExpectation
      ),
    };
    return result;
  });

  return {
    pass: results.every((result) => result.pass),
    results,
  };
}
