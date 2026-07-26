import type {
  CanvasFpsRuntime,
  CanvasFpsSnapshot,
} from "@/engines/canvas/models/canvasFpsModel";

const SAMPLE_WINDOW_MS = 1_000;
const DISPLAY_UPDATE_INTERVAL_MS = 250;
const IDLE_TIMEOUT_MS = 750;
const MAX_REPORTED_FPS = 240;

const IDLE_SNAPSHOT: CanvasFpsSnapshot = Object.freeze({
  status: "idle",
  fps: null,
});

function snapshotsEqual(
  left: CanvasFpsSnapshot,
  right: CanvasFpsSnapshot
): boolean {
  return left.status === right.status && left.fps === right.fps;
}

export function createCanvasFpsRuntime(): CanvasFpsRuntime {
  const listeners = new Set<() => void>();
  let frameTimes: number[] = [];
  let lastFrameAt: number | null = null;
  let snapshot = IDLE_SNAPSHOT;
  let updateTimer: ReturnType<typeof setInterval> | null = null;

  const publish = (nextSnapshot: CanvasFpsSnapshot) => {
    if (snapshotsEqual(snapshot, nextSnapshot)) return;
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  const stopTimer = () => {
    if (updateTimer === null) return;
    clearInterval(updateTimer);
    updateTimer = null;
  };

  const updateDisplay = () => {
    const now = performance.now();
    if (lastFrameAt === null || now - lastFrameAt > IDLE_TIMEOUT_MS) {
      frameTimes = [];
      lastFrameAt = null;
      stopTimer();
      publish(IDLE_SNAPSHOT);
      return;
    }

    const windowStart = now - SAMPLE_WINDOW_MS;
    frameTimes = frameTimes.filter((timestamp) => timestamp >= windowStart);
    if (frameTimes.length < 2) {
      publish({ status: "measuring", fps: null });
      return;
    }

    const duration = frameTimes.at(-1)! - frameTimes[0];
    const fps = duration > 0
      ? Math.min(
          MAX_REPORTED_FPS,
          Math.round(((frameTimes.length - 1) * 1_000) / duration)
        )
      : MAX_REPORTED_FPS;
    publish({ status: "active", fps });
  };

  const ensureTimer = () => {
    if (updateTimer !== null) return;
    updateTimer = setInterval(updateDisplay, DISPLAY_UPDATE_INTERVAL_MS);
  };

  return {
    recordFrame: (timestamp = performance.now()) => {
      if (!Number.isFinite(timestamp)) return;
      lastFrameAt = timestamp;
      frameTimes.push(timestamp);
      const windowStart = timestamp - SAMPLE_WINDOW_MS;
      while (frameTimes[0] < windowStart) frameTimes.shift();
      ensureTimer();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    dispose: () => {
      stopTimer();
      listeners.clear();
      frameTimes = [];
      lastFrameAt = null;
      snapshot = IDLE_SNAPSHOT;
    },
  };
}
