export const RUNTIME_METRIC_COUNTER_NAMES = [
  "animationEvaluation",
  "fastPreviewRenderer",
  "accurateRenderer",
  "previewUpdate",
  "previewSceneGeneration",
  "previewNodeUpdated",
  "previewNodeReused",
  "dirtyNode",
  "frameDirty",
  "compositionRender",
  "compositionCacheHit",
  "compositionCacheMiss",
  "compositionCacheCreate",
  "compositionCacheReused",
  "surfaceCreate",
  "surfaceReuse",
  "surfaceDispose",
  "surfaceActive",
  "surfacePoolSize",
  "playbackDirtyNode",
  "playbackCleanNode",
  "playbackNodeUpdated",
  "playbackNodeReused",
  "playbackCompositionReused",
  "playbackFrameUpdateTime",
  "drawImage",
  "drawImageSkipped",
  "layerDraw",
  "compositionDraw",
  "canvasDrawTime",
  "projectUpdate",
  "historyCommit",
] as const;

export type RuntimeMetricCounterName =
  (typeof RUNTIME_METRIC_COUNTER_NAMES)[number];

export type RuntimeMetricCounters = Readonly<
  Record<RuntimeMetricCounterName, number>
>;

export type RuntimeMetricsSnapshot = {
  readonly global: RuntimeMetricCounters;
  readonly frame: RuntimeMetricCounters;
};

export type RuntimeMetricsBaselineKind = "sprint" | "task";

export type RuntimeMetricDifference = {
  readonly counter: RuntimeMetricCounterName;
  readonly baseline: number;
  readonly current: number;
  readonly difference: number;
  readonly percent: number | null;
};

export type RuntimeMetricsBaselineComparison = {
  readonly kind: RuntimeMetricsBaselineKind;
  readonly baseline: RuntimeMetricCounters | null;
  readonly current: RuntimeMetricCounters;
  readonly differences: readonly RuntimeMetricDifference[];
};

export type RuntimeMetricExpectation =
  | number
  | {
      readonly equals?: number;
      readonly min?: number;
      readonly max?: number;
    };

export type ExpectedRuntimeMetrics = Readonly<
  Partial<Record<RuntimeMetricCounterName, RuntimeMetricExpectation>>
>;

export type RuntimeMetricComparisonResult = {
  readonly counter: RuntimeMetricCounterName;
  readonly actual: number;
  readonly expected: RuntimeMetricExpectation;
  readonly pass: boolean;
};

export type RuntimeMetricsComparison = {
  readonly pass: boolean;
  readonly results: readonly RuntimeMetricComparisonResult[];
};

export type RuntimeMetricsResource = {
  readonly increment: (
    counter: RuntimeMetricCounterName,
    amount?: number
  ) => void;
  readonly resetFrame: () => void;
  readonly resetGlobal: () => void;
  readonly saveSprintBaseline: () => RuntimeMetricCounters;
  readonly saveTaskBaseline: () => RuntimeMetricCounters;
  readonly getSprintBaseline: () => RuntimeMetricCounters | null;
  readonly getTaskBaseline: () => RuntimeMetricCounters | null;
  readonly compareSprintBaseline: () => RuntimeMetricsBaselineComparison;
  readonly compareTaskBaseline: () => RuntimeMetricsBaselineComparison;
  readonly resetBaseline: () => void;
  readonly getFrameSnapshot: () => RuntimeMetricCounters;
  readonly getGlobalSnapshot: () => RuntimeMetricCounters;
  readonly getSnapshot: () => RuntimeMetricsSnapshot;
};
