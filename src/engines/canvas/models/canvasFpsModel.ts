export type CanvasFpsStatus = "idle" | "measuring" | "active";

export type CanvasFpsSnapshot = {
  readonly status: CanvasFpsStatus;
  readonly fps: number | null;
};

export type CanvasFpsRuntime = {
  readonly recordFrame: (timestamp?: number) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => CanvasFpsSnapshot;
  readonly dispose: () => void;
};
