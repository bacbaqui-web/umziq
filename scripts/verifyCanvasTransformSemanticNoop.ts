import assert from "node:assert/strict";
import type { CompositionMeta, Layer } from "@/models";
import type { PreviewSceneTransformPatch } from "@/engines/playback-render";
import {
  areDraftTransformSnapshotsSemanticallyEqual,
  resolveDraftTransformSnapshot,
  type DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { createCanvasPointerFrameScheduler } from "@/engines/canvas/helpers/canvasPointerFrameHelpers";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};
const layer: Layer = {
  id: "semantic-layer",
  name: "Semantic Layer",
  visible: true,
  position: { x: 10, y: 20 },
  positionKeyframes: [],
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 50, y: 40 },
  scale: { x: -100, y: 80 },
  scaleKeyframes: [],
  scaleLinked: false,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: { ...disabledProperties },
  modifiers: [],
};
const meta: CompositionMeta = {
  width: 200,
  height: 160,
  layerCount: 1,
  sourceFileName: "semantic.psd",
  frameRate: 30,
  durationFrames: 150,
};
const overlay: PreviewOverlay = {
  targetKind: "layer",
  targetId: layer.id,
  x: -40,
  y: -20,
  width: 100,
  height: 80,
  centerX: 10,
  centerY: 20,
  corners: {
    nw: { x: -40, y: -20 },
    ne: { x: 60, y: -20 },
    se: { x: 60, y: 60 },
    sw: { x: -40, y: 60 },
  },
  anchorX: 10,
  anchorY: 20,
  scaleX: -100,
  scaleY: 80,
  rotation: 0,
  sourceWidth: 100,
  sourceHeight: 80,
  canvasWidth: 100,
  canvasHeight: 80,
};

type HandleName =
  | "Position"
  | "Anchor"
  | "Scale W"
  | "Scale H"
  | "Scale WH"
  | "Rotation"
  | "Opacity";

type SessionCounts = {
  raw: number;
  scheduled: number;
  accepted: number;
  semanticDraft: number;
  propertyDraft: number;
  readout: number;
  snapshot: number;
  preview: number;
  project: number;
  historyBegin: number;
  historyDirty: number;
  historyCommit: number;
  historyCancel: number;
  reset: number;
};

function makeSnapshot(patch: PreviewSceneTransformPatch) {
  const snapshot = resolveDraftTransformSnapshot({
    target: { kind: "layer", layer },
    localFrame: 0,
    frameRate: meta.frameRate,
    selectedMeta: meta,
    overlay,
    patch,
  });
  assert.ok(snapshot);
  return snapshot;
}

function equalPatch(handle: HandleName): PreviewSceneTransformPatch {
  switch (handle) {
    case "Position": return { position: { x: 25, y: -15 } };
    case "Anchor": return {
      anchor: { x: -12, y: 7 },
      transformOffset: { x: 62, y: 33 },
    };
    case "Scale W": return { scale: { x: -125, y: 80 } };
    case "Scale H": return { scale: { x: -100, y: -75 } };
    case "Scale WH": return { scale: { x: -150, y: 120 } };
    case "Rotation": return { rotation: 105 };
    case "Opacity": return { opacity: 60 };
  }
}

function changingPatch(
  handle: HandleName,
  index: number
): PreviewSceneTransformPatch {
  switch (handle) {
    case "Position": return { position: { x: index, y: -index } };
    case "Anchor": return {
      anchor: { x: index - 50, y: index + 1 },
      transformOffset: { x: 50 - index, y: -index },
    };
    case "Scale W": return { scale: { x: -100 - index, y: 80 } };
    case "Scale H": return { scale: { x: -100, y: 80 + index } };
    case "Scale WH": return { scale: { x: -100 - index, y: 80 + index } };
    case "Rotation": return { rotation: index * 15 };
    case "Opacity": return { opacity: index };
  }
}

function runSession({
  patchAt,
  finishMode,
}: {
  patchAt: (index: number) => PreviewSceneTransformPatch;
  finishMode: "commit" | "cancel";
}) {
  const counts: SessionCounts = {
    raw: 0,
    scheduled: 0,
    accepted: 0,
    semanticDraft: 0,
    propertyDraft: 0,
    readout: 0,
    snapshot: 0,
    preview: 0,
    project: 0,
    historyBegin: 1,
    historyDirty: 0,
    historyCommit: 0,
    historyCancel: 0,
    reset: 0,
  };
  const scheduledFrames = new Map<number, () => void>();
  let nextFrameId = 0;
  let previousAccepted: DraftTransformSnapshot | null = null;
  let latestAccepted: DraftTransformSnapshot | null = null;
  const scheduler = createCanvasPointerFrameScheduler({
    requestFrame: (callback) => {
      nextFrameId += 1;
      counts.scheduled += 1;
      scheduledFrames.set(nextFrameId, callback);
      return nextFrameId;
    },
    cancelFrame: (frameId) => scheduledFrames.delete(frameId),
  });
  scheduler.start({
    onMove: (sample) => {
      counts.accepted += 1;
      const snapshot = makeSnapshot(patchAt(sample.clientX));
      if (areDraftTransformSnapshotsSemanticallyEqual(previousAccepted, snapshot)) {
        return;
      }
      previousAccepted = snapshot;
      latestAccepted = snapshot;
      counts.semanticDraft += 1;
      counts.propertyDraft += 1;
      counts.readout += 1;
      counts.snapshot += 1;
      counts.preview += 1;
    },
    onCommit: () => {
      if (latestAccepted) {
        counts.project += 1;
        counts.historyDirty += 1;
      }
      previousAccepted = null;
      counts.reset += 1;
      counts.historyCommit += 1;
    },
    onCancel: () => {
      previousAccepted = null;
      latestAccepted = null;
      counts.reset += 1;
      counts.historyCancel += 1;
    },
  });
  for (let index = 0; index < 100; index += 1) {
    counts.raw += 1;
    scheduler.push({ clientX: index, clientY: index, shiftKey: true });
    if (index === 99 && finishMode === "commit") continue;
    const callback = scheduledFrames.values().next().value;
    assert.ok(callback);
    scheduledFrames.clear();
    callback();
  }
  scheduler.finish(finishMode);
  return { counts, latestAccepted };
}

const handles: HandleName[] = [
  "Position",
  "Anchor",
  "Scale W",
  "Scale H",
  "Scale WH",
  "Rotation",
  "Opacity",
];

handles.forEach((handle) => {
  const equal = runSession({
    patchAt: () => equalPatch(handle),
    finishMode: "commit",
  });
  assert.deepEqual(
    {
      raw: equal.counts.raw,
      scheduled: equal.counts.scheduled,
      accepted: equal.counts.accepted,
    },
    { raw: 100, scheduled: 100, accepted: 100 }
  );
  assert.deepEqual(
    {
      semanticDraft: equal.counts.semanticDraft,
      propertyDraft: equal.counts.propertyDraft,
      readout: equal.counts.readout,
      snapshot: equal.counts.snapshot,
      preview: equal.counts.preview,
    },
    { semanticDraft: 1, propertyDraft: 1, readout: 1, snapshot: 1, preview: 1 }
  );
  assert.deepEqual(
    {
      project: equal.counts.project,
      begin: equal.counts.historyBegin,
      dirty: equal.counts.historyDirty,
      commit: equal.counts.historyCommit,
      cancel: equal.counts.historyCancel,
      reset: equal.counts.reset,
    },
    { project: 1, begin: 1, dirty: 1, commit: 1, cancel: 0, reset: 1 }
  );

  const changing = runSession({
    patchAt: (index) => changingPatch(handle, index),
    finishMode: "commit",
  });
  assert.equal(changing.counts.accepted, 100);
  assert.equal(changing.counts.semanticDraft, 100);
  assert.equal(changing.counts.propertyDraft, 100);
  assert.equal(changing.counts.readout, 100);
  assert.equal(changing.counts.snapshot, 100);
  assert.equal(changing.counts.preview, 100);
  assert.equal(changing.counts.project, 1);
  assert.equal(changing.counts.historyCommit, 1);
  assert.ok(changing.latestAccepted);
  assert.ok(areDraftTransformSnapshotsSemanticallyEqual(
    changing.latestAccepted,
    makeSnapshot(changingPatch(handle, 99))
  ));

  const cancelled = runSession({
    patchAt: () => equalPatch(handle),
    finishMode: "cancel",
  });
  assert.equal(cancelled.counts.semanticDraft, 1);
  assert.equal(cancelled.counts.project, 0);
  assert.equal(cancelled.counts.historyDirty, 0);
  assert.equal(cancelled.counts.historyCommit, 0);
  assert.equal(cancelled.counts.historyCancel, 1);
  assert.equal(cancelled.counts.reset, 1);
  assert.equal(cancelled.latestAccepted, null);
});

const sameRotationSnap = makeSnapshot({ rotation: 105 });
assert.equal(
  areDraftTransformSnapshotsSemanticallyEqual(
    sameRotationSnap,
    makeSnapshot({ rotation: 105 })
  ),
  true
);
const sameOpacityClamp = makeSnapshot({ opacity: 100 });
assert.equal(
  areDraftTransformSnapshotsSemanticallyEqual(
    sameOpacityClamp,
    makeSnapshot({ opacity: 100 })
  ),
  true
);
assert.equal(
  areDraftTransformSnapshotsSemanticallyEqual(
    makeSnapshot({ scale: { x: -125, y: 80 } }),
    makeSnapshot({ scale: { x: -125, y: 80 } })
  ),
  true
);

console.log(
  "Canvas transform semantic no-op verification passed",
  JSON.stringify({ handles, equalAccepted: 100, equalDispatch: 1, changingDispatch: 100 })
);
