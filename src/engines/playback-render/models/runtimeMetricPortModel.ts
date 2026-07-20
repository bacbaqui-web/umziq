export type RuntimeMetricRecordPort = {
  readonly increment: (counter: string, amount?: number) => void;
  readonly resetFrame?: () => void;
};
