export type RuntimeMetricRecordPort = {
  readonly increment: (counter: string, amount?: number) => void;
  /**
   * Starts a physical Canvas paint observation. Renderer/evaluation counters
   * remain available in the global snapshot because they occur before paint.
   */
  readonly resetFrame?: () => void;
};
