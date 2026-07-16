import assert from "node:assert/strict";
import type { MutableRefObject, SetStateAction } from "react";
import { createPropertyTrackState } from "@/models";
import { createBaseComposition } from "@/engines/project/import/psdDocumentFactory";
import { useProjectHistoryController as createProjectHistoryController } from "@/engines/project/controllers/useProjectHistoryController";
import type {
  ProjectHistoryReadState,
  ProjectHistoryRestorePort,
} from "@/engines/project/history/projectHistorySnapshot";
import type { CompositionHistoryState } from "@/engines/project/state/useProjectHistoryState";

function applyState<T>(current: T, action: SetStateAction<T>): T {
  return typeof action === "function"
    ? (action as (value: T) => T)(current)
    : action;
}

const compId = "main-0-history";
const drawableCanvas = { width: 2, height: 2 } as HTMLCanvasElement;
const initialComposition = createBaseComposition({
  id: compId,
  name: "History",
  type: "main",
  layers: [],
  children: [],
  width: 100,
  height: 100,
});
const state: ProjectHistoryReadState = {
  comps: [initialComposition],
  masterEnabledProperties: createPropertyTrackState(),
  masterScale: { x: 100, y: 100 },
  masterScaleKeyframes: [],
  masterScaleLinked: true,
  masterRotation: 0,
  masterRotationKeyframes: [],
  masterOpacity: 100,
  masterOpacityKeyframes: [],
  selectedLayerId: null,
  selectedTimelineTarget: { kind: "item", itemId: "item-1" },
  lastSelectedItemByCompId: {
    [compId]: { kind: "item", itemId: "item-1" },
  },
  metaByCompId: {
    [compId]: {
      width: 100,
      height: 100,
      layerCount: 0,
      sourceFileName: "history.psd",
      frameRate: 30,
      durationFrames: 90,
    },
  },
  playbackRangeByCompId: { [compId]: { startFrame: 5, endFrame: 60 } },
  timelineItemsByCompId: {
    [compId]: [
      {
        id: "item-1",
        name: "History",
        kind: "layer",
        visible: true,
        compId,
        sourceId: "layer-1",
        startFrame: 0,
        durationFrames: 90,
      },
    ],
  },
  renderItemsByCompId: {
    [compId]: [
      {
        id: "render-1",
        name: "History",
        kind: "layer",
        visible: true,
        sourceId: "layer-1",
        drawables: [
          {
            id: "drawable-1",
            left: 0,
            top: 0,
            visible: true,
            canvas: drawableCanvas,
          },
        ],
      },
    ],
  },
  currentFrame: 12,
};
let selectedCompId = compId;
const resetValues: Record<string, unknown> = {};
const resetSetter = (key: string) => (value: unknown) => {
  resetValues[key] = value;
};
const restorePort: ProjectHistoryRestorePort = {
  setComps: (action) => { state.comps = applyState(state.comps, action); },
  setMasterEnabledProperties: (action) => {
    state.masterEnabledProperties = applyState(state.masterEnabledProperties, action);
  },
  setMasterScale: (action) => { state.masterScale = applyState(state.masterScale, action); },
  setMasterScaleKeyframes: (action) => {
    state.masterScaleKeyframes = applyState(state.masterScaleKeyframes, action);
  },
  setMasterScaleLinked: (action) => {
    state.masterScaleLinked = applyState(state.masterScaleLinked, action);
  },
  setMasterRotation: (action) => {
    state.masterRotation = applyState(state.masterRotation, action);
  },
  setMasterRotationKeyframes: (action) => {
    state.masterRotationKeyframes = applyState(state.masterRotationKeyframes, action);
  },
  setMasterOpacity: (action) => { state.masterOpacity = applyState(state.masterOpacity, action); },
  setMasterOpacityKeyframes: (action) => {
    state.masterOpacityKeyframes = applyState(state.masterOpacityKeyframes, action);
  },
  setSelectedCompId: (action) => { selectedCompId = applyState(selectedCompId, action); },
  setSelectedLayerId: (action) => {
    state.selectedLayerId = applyState(state.selectedLayerId, action);
  },
  setSelectedTimelineTarget: (action) => {
    state.selectedTimelineTarget = applyState(state.selectedTimelineTarget, action);
  },
  setLastSelectedItemByCompId: (action) => {
    state.lastSelectedItemByCompId = applyState(state.lastSelectedItemByCompId, action);
  },
  setSelectedKeyframe: resetSetter("selectedKeyframe"),
  setPositionDraft: resetSetter("positionDraft"),
  setScaleDraft: resetSetter("scaleDraft"),
  setRotationDraft: resetSetter("rotationDraft"),
  setOpacityDraft: resetSetter("opacityDraft"),
  setMetaByCompId: (action) => {
    state.metaByCompId = applyState(state.metaByCompId, action);
  },
  setPlaybackRangeByCompId: (action) => {
    state.playbackRangeByCompId = applyState(state.playbackRangeByCompId, action);
  },
  setTimelineItemsByCompId: (action) => {
    state.timelineItemsByCompId = applyState(state.timelineItemsByCompId, action);
  },
  setRenderItemsByCompId: (action) => {
    state.renderItemsByCompId = applyState(state.renderItemsByCompId, action);
  },
  setImportError: resetSetter("importError"),
  setImportNotice: resetSetter("importNotice"),
  setDraggedTimelineItemId: resetSetter("draggedTimelineItemId"),
  setCurrentFrame: (action) => { state.currentFrame = applyState(state.currentFrame, action); },
  setIsScrubbingTimeline: resetSetter("isScrubbingTimeline"),
  setIsPlaying: resetSetter("isPlaying"),
  setHoveredFrame: resetSetter("hoveredFrame"),
  setDraggingKeyframe: resetSetter("draggingKeyframe"),
  setRotationHandleReadout: resetSetter("rotationHandleReadout"),
  setOpacityHandleReadout: resetSetter("opacityHandleReadout"),
  setScaleHandleReadout: resetSetter("scaleHandleReadout"),
  setPositionHandleReadout: resetSetter("positionHandleReadout"),
  setMotionPathKeyframeReadout: resetSetter("motionPathKeyframeReadout"),
  setDraggingMotionPathFrame: resetSetter("draggingMotionPathFrame"),
} as ProjectHistoryRestorePort;
const historyRef: MutableRefObject<Record<string, CompositionHistoryState>> = {
  current: {},
};
const history = createProjectHistoryController({ historyRef, readState: state, restorePort });

history.pushCompositionHistorySnapshot(compId);
state.comps = state.comps.map((composition) => ({
  ...composition,
  position: { ...composition.position, x: 200 },
}));
state.currentFrame = 24;

history.undoCompositionHistory(compId);
assert.equal(state.comps[0]?.position.x, 50);
assert.equal(state.currentFrame, 12);
assert.equal(selectedCompId, compId);
assert.equal(state.renderItemsByCompId[compId]?.[0]?.drawables[0]?.canvas, drawableCanvas);
assert.equal(resetValues.isPlaying, false);
assert.equal(resetValues.positionDraft, null);

history.redoCompositionHistory(compId);
assert.equal(state.comps[0]?.position.x, 200);
assert.equal(state.currentFrame, 24);

history.beginCompositionHistoryCapture(compId);
state.comps = state.comps.map((composition) => ({
  ...composition,
  position: { ...composition.position, x: 300 },
}));
history.markCompositionHistoryCaptureDirty(compId);
history.commitCompositionHistoryCapture(compId);
assert.equal(historyRef.current[compId]?.pending, null);
assert.equal(historyRef.current[compId]?.past.length, 2);

history.undoCompositionHistory(compId);
assert.equal(state.comps[0]?.position.x, 200);

const pastCount = historyRef.current[compId]?.past.length;
history.beginCompositionHistoryCapture(compId);
history.commitCompositionHistoryCapture(compId);
assert.equal(historyRef.current[compId]?.past.length, pastCount);

history.clearCompositionHistory(compId);
assert.equal(historyRef.current[compId], undefined);

console.log("Project history undo/redo verification passed");
