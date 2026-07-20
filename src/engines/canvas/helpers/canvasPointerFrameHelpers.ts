import type {
  CanvasPointerSample,
  CanvasPointerSession,
} from "@/engines/canvas/models/canvasInteractionModel";

export type CanvasPointerFrameScheduler = {
  start: (session: CanvasPointerSession) => void;
  push: (sample: CanvasPointerSample) => void;
  finish: (mode: "commit" | "cancel") => void;
  dispose: () => void;
};

export function createCanvasPointerFrameScheduler(options: {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (frameId: number) => void;
}): CanvasPointerFrameScheduler {
  let session: CanvasPointerSession | null = null;
  let pendingSample: CanvasPointerSample | null = null;
  let frameId: number | null = null;

  const cancelScheduledFrame = () => {
    if (frameId === null) return;
    options.cancelFrame(frameId);
    frameId = null;
  };

  const flush = () => {
    frameId = null;
    const currentSession = session;
    const sample = pendingSample;
    pendingSample = null;
    if (currentSession && sample) currentSession.onMove(sample);
  };

  const finish = (mode: "commit" | "cancel") => {
    const currentSession = session;
    cancelScheduledFrame();
    if (mode === "commit") flush();
    else pendingSample = null;
    session = null;
    if (!currentSession) return;
    if (mode === "commit") currentSession.onCommit();
    else currentSession.onCancel();
  };

  return {
    start: (nextSession) => {
      if (session) finish("cancel");
      session = nextSession;
    },
    push: (sample) => {
      if (!session) return;
      pendingSample = sample;
      if (frameId !== null) return;
      frameId = options.requestFrame(flush);
    },
    finish,
    dispose: () => finish("cancel"),
  };
}
