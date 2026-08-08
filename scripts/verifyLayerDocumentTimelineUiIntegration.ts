import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentVerificationPorts,
} from "./helpers/createLayerDocumentVerificationPorts";
import {
  createLayerDocumentProjectOwnerState,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  reduceLayerDocumentProjectOwner,
  type LayerDocumentProjectOwnerPort,
  type LayerDocumentProjectOwnerState,
} from "@/engines/project";
import {
  createLayerDocumentSourceRuntimeResourceCache,
} from "@/render";
import {
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/properties/adapters/layerDocumentPanelPreparationAdapter";
import {
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
} from "@/layer-types";
import {
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/layer-types";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
} from "@/layer-types";
import {
  buildLayerDocumentTimelineUiReadModel,
} from "@/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers";
import {
  createLayerDocumentTimelinePlaybackRuntime,
} from "@/engines/timeline/state/layerDocumentTimelinePlaybackRuntime";
import {
  resolveLayerDocumentTimelineTimingDraft,
} from "@/engines/timeline/helpers/layerDocumentTimelineInteractionHelpers";
import type {
  LayerDocumentTimelineRuntimeUiState,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type {
  TimelineRulerViewModel,
} from "@/engines/timeline/models/timelineViewModel";

function common(
  parentLayerDocumentId: string | null,
  order: number,
  sourceId: string | null = null
): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: {
      position: { x: 0, y: 0 },
      transformOffset: { x: 0, y: 0 },
      anchor: { x: 50, y: 50 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: 0,
      opacity: 100,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: 10,
      durationFrames: 30,
      sourceOffsetFrames: 2,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [
        { frame: 3, value: { x: 3, y: 4 } },
        { frame: 99, value: { x: 99, y: 99 } },
      ],
      scaleKeyframes: [
        { frame: 4, value: { x: 104, y: 104 } },
      ],
      rotationKeyframes: [
        { frame: 5, value: 15 },
      ],
      opacityKeyframes: [
        { frame: 6, value: 80 },
      ],
      enabledProperties: {
        position: true,
        scale: true,
        rotation: true,
        opacity: true,
      },
    },
    effects: [],
    modifiers: [],
  };
}

function group(
  layerDocumentId: string,
  parentLayerDocumentId: string | null,
  order: number,
  role: "project-root" | "composition",
  durationFrames = 80
): LayerDocument {
  const value = common(
    parentLayerDocumentId,
    order
  );
  value.placement.startFrame = 0;
  value.placement.durationFrames =
    durationFrames;
  value.placement.sourceOffsetFrames = 0;
  return {
    layerDocumentId,
    name:
      role === "project-root"
        ? "Root"
        : "Nested Group",
    revision: 0,
    type: "group",
    common: value,
    data: {
      role,
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationFrames,
    },
  };
}

function projectFixture(): LayerDocumentProject {
  const root = group(
    "root",
    null,
    0,
    "project-root"
  );
  const nested = group(
    "nested",
    "root",
    1,
    "composition",
    50
  );
  const video: LayerDocument = {
    layerDocumentId: "video-a",
    name: "Shared video placement",
    revision: 0,
    type: "video",
    common: common("root", 0, "video-source"),
    data: {},
  };
  const nestedText: LayerDocument = {
    layerDocumentId: "nested-text",
    name: "Nested text",
    revision: 0,
    type: "text",
    common: common("nested", 0),
    data: {
      text: "Nested",
      style: {
        fontFamily: "sans-serif",
        fontSize: 24,
        color: "#ffffff",
      },
    },
  };
  return {
    metadata: {
      schemaVersion:
        LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "timeline-ui-integration",
      name: "Timeline UI integration fixture",
    },
    payload: {
      layerDocumentsById: {
        root,
        "video-a": video,
        nested,
        "nested-text": nestedText,
      },
      sourceRegistry: {
        sourcesById: {
          "video-source": {
            sourceId: "video-source",
            kind: "video",
            displayName: "shared.mp4",
            locator: {
              locatorId: "linked:video-source",
              kind: "linked-file",
              suggestedFileName: "shared.mp4",
              relativePathHint: "fixtures/shared.mp4",
            },
            contentFingerprint: null,
            version: 1,
            refresh: {
              status: "updated",
            },
            data: {
              mimeType: "video/mp4",
              durationFrames: 80,
              width: 1080,
              height: 1920,
            },
          },
        },
      },
    },
  };
}

const initialized =
  createLayerDocumentProjectOwnerState({
    project: projectFixture(),
    layerSelection: {
      kind: "layer-document",
      layerDocumentId: "video-a",
    },
    activeGroupLayerDocumentId: "root",
  });
assert.equal(initialized.ok, true);
if (!initialized.ok) {
  throw new Error(initialized.error.message);
}
let ownerState: LayerDocumentProjectOwnerState =
  initialized.state;
let ownerTransitionCount = 0;
const owner: LayerDocumentProjectOwnerPort = {
  get state() {
    return ownerState;
  },
  transition: (action) => {
    ownerTransitionCount += 1;
    const result = reduceLayerDocumentProjectOwner(
      ownerState,
      action
    );
    if (result.ok) ownerState = result.state;
    return result;
  },
};
const resources =
  createLayerDocumentSourceRuntimeResourceCache();
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
sourceResolution.setAvailable({
  sourceId: "video-source",
});
const ports =
  createLayerDocumentVerificationPorts({
    owner,
    panelPreparation:
      LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
    sourcePreparation:
      LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
    drawingPreparation:
      LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
    textPreparation:
      LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
    audioPreparation:
      LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
    sourceRuntime: resources,
    sourceResolution,
    draftSession: {
      read: () => null,
      publish: () => {},
      clear: () => {},
    },
    effects: {
      applyOwnerEffect: () => {},
    },
    metrics: {
      increment: () => {},
    },
  });

const ruler: TimelineRulerViewModel = {
  contentWidth: 160,
  pxPerFrame: 2,
  frames: [],
  playheadLeft: 24,
  hoveredPlayheadLeft: null,
  hoveredFrame: null,
  isScrubbing: false,
  playbackRangeStartFrame: 0,
  playbackRangeEndFrame: 79,
  playbackRangeLeft: 0,
  playbackRangeWidth: 158,
  playbackRangeRight: 158,
  activeResizeHandle: null,
  activeReadout: null,
  indicator: {
    left: 23,
    width: 2,
    background: "#fff",
    zIndex: 8,
  },
  hideCursor: false,
  showInteractionShield: false,
  rangeDuration: {
    valueFrames: 79,
    frameRate: 30,
    seconds: 2,
    frames: 19,
    title: "range",
    accent: "range",
  },
  timelineDuration: {
    valueFrames: 80,
    frameRate: 30,
    seconds: 2,
    frames: 20,
    title: "timeline",
    accent: "timeline",
  },
};
const runtime: LayerDocumentTimelineRuntimeUiState = {
  isCompositionSwitcherOpen: true,
  draggedLayerDocumentId: null,
  editingLayerDocumentId: null,
  draftName: "",
  deleteDecisionLayerDocumentId: null,
  timingDraft: null,
  keyframeDrag: null,
};
const playback =
  createLayerDocumentTimelinePlaybackRuntime({
    scope: ports.scope,
    scheduler: {
      setRepeating: () => Symbol("clock"),
      clearRepeating: () => {},
    },
  });
const formatTime = (
  frame: number,
  frameRate: number
) => `${frame}/${frameRate}`;
const initialView =
  buildLayerDocumentTimelineUiReadModel({
    project: ports.project.read(),
    timeline:
      ports.timeline.readViewProps(),
    runtime,
    playback: playback.read(),
    ruler,
    nameColumnWidth: 180,
    formatTime,
  });
assert.equal(initialView.available, true);
assert.deepEqual(
  initialView.header.breadcrumbSegments.map(
    (segment) => segment.id
  ),
  ["root"]
);
assert.deepEqual(
  initialView.header.switcher.items.map(
    (item) => item.id
  ),
  ["nested"],
  "Tab map/switcher must contain only direct-child Groups"
);
assert.equal(
  initialView.header.selectionLabel?.label,
  "Shared video placement"
);
const initialItemRow = initialView.rows.find(
  (row) =>
    row.type === "item" &&
    row.item.id === "video-a"
);
assert.ok(initialItemRow);
assert.equal(
  "sourceId" in initialItemRow.item,
  false,
  "public visual item must not expose a source identity fallback"
);
if (initialItemRow.type !== "item") {
  throw new Error("Expected item row");
}
assert.equal(
  initialItemRow.source.status,
  "updated"
);
assert.equal(
  initialView.rows.filter(
    (row) => row.type === "property"
  ).length,
  4
);
const positionRow = initialView.rows.find(
  (row) =>
    row.type === "property" &&
    row.property === "position"
);
assert.ok(positionRow);
if (positionRow.type !== "property") {
  throw new Error("Expected position row");
}
assert.deepEqual(
  positionRow.keyframes.map(
    (keyframe) => keyframe.frame
  ),
  [3],
  "out-of-Placement keyframes use the explicit clipped display policy"
);

([
  ["position", 3],
  ["rotation", 5],
  ["opacity", 6],
  ["scale", 4],
] as const).forEach(([property, localFrame]) => {
  const selection =
    ports.timeline.selectTransformKeyframe({
      layerDocumentId: "video-a",
      property,
      localFrame,
      globalFrame:
        10 + localFrame - 2,
    });
  assert.equal(selection.ok, true);
  assert.equal(
    owner.state.runtimeSession
      .selectedTransformKeyframe?.property,
    property,
    `${property} keyframe selection must be accepted by the shared owner Runtime Session`
  );
});
assert.deepEqual(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  {
    layerDocumentId: "video-a",
    property: "scale",
    localFrame: 4,
    globalFrame: 12,
  }
);
const invalidScaleSelection =
  ports.timeline.selectTransformKeyframe({
    layerDocumentId: "video-a",
    property: "scale",
    localFrame: 77,
    globalFrame: 85,
  });
assert.equal(invalidScaleSelection.ok, false);
assert.equal(
  owner.state.runtimeSession
    .selectedTransformKeyframe?.localFrame,
  4,
  "property-specific existence validation rejects stale keyframe identities"
);
const selectedScaleView =
  buildLayerDocumentTimelineUiReadModel({
    project: ports.project.read(),
    timeline:
      ports.timeline.readViewProps(),
    runtime,
    playback: playback.read(),
    ruler,
    nameColumnWidth: 180,
    formatTime,
  });
const scaleRow = selectedScaleView.rows.find(
  (row) =>
    row.type === "property" &&
    row.property === "scale"
);
assert.ok(
  scaleRow?.type === "property" &&
  scaleRow.keyframes[0]?.selected,
  "Timeline keyframe rows must read the owner Runtime Session selection"
);

const historyBeforeDuplicate =
  owner.state.undoStack.length;
const duplicate =
  ports.timeline.dispatchIntent({
    kind: "duplicate-layer",
    layerDocumentId: "video-a",
    newLayerDocumentId: "video-b",
  });
assert.equal(duplicate.ok, true);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDuplicate + 1
);
const original =
  owner.state.currentProject.payload
    .layerDocumentsById["video-a"];
const duplicateLayer =
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"];
assert.equal(
  original.common.source?.sourceId,
  duplicateLayer.common.source?.sourceId,
  "duplicate placements preserve one shared Source Registry identity"
);

const transitionsBeforeMove =
  ownerTransitionCount;
const historyBeforeMove =
  owner.state.undoStack.length;
const movedKeyframe =
  ports.timeline.dispatchIntent({
    kind: "move-keyframe",
    layerDocumentId: "video-b",
    property: "position",
    fromLocalFrame: 3,
    toLocalFrame: 8,
  });
assert.equal(movedKeyframe.ok, true);
assert.equal(
  ownerTransitionCount,
  transitionsBeforeMove + 1
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeMove + 1,
  "keyframe PointerUp intent creates one History entry"
);
assert.deepEqual(
  owner.state.currentProject.payload
    .layerDocumentsById["video-a"]
    .common.animation.positionKeyframes.map(
      (keyframe) => keyframe.frame
    ),
  [3, 99],
  "same-source duplicate animation remains independent"
);
assert.deepEqual(
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"]
    .common.animation.positionKeyframes.map(
      (keyframe) => keyframe.frame
    ),
  [8, 99]
);
assert.deepEqual(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  {
    layerDocumentId: "video-b",
    property: "position",
    localFrame: 8,
    globalFrame: 16,
  },
  "move commit atomically keeps the new owner keyframe identity selected"
);

assert.equal(
  ports.timeline.selectTransformKeyframe({
    layerDocumentId: "video-b",
    property: "opacity",
    localFrame: 6,
    globalFrame: 14,
  }).ok,
  true
);
const historyBeforeRemove =
  owner.state.undoStack.length;
assert.equal(
  ports.timeline.dispatchIntent({
    kind: "remove-keyframe",
    layerDocumentId: "video-b",
    property: "opacity",
    localFrame: 6,
  }).ok,
  true
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeRemove + 1
);
assert.equal(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  null,
  "removing the selected keyframe normalizes owner Runtime selection"
);

const pointerMoveProjectBefore =
  JSON.stringify(owner.state.currentProject);
assert.equal(
  ports.timeline.selectTransformKeyframe({
    layerDocumentId: "video-b",
    property: "position",
    localFrame: 8,
    globalFrame: 16,
  }).ok,
  true
);
const transitionsBeforeDraft =
  ownerTransitionCount;
const historyBeforeDraft =
  owner.state.undoStack.length;
const timingBefore =
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"].common
    .placement;
const trimDraft =
  resolveLayerDocumentTimelineTimingDraft(
    {
      operation: "trim-start",
      timelineDurationFrames: 80,
      initial: {
        layerDocumentId: "video-b",
        startFrame:
          timingBefore.startFrame,
        durationFrames:
          timingBefore.durationFrames,
        sourceOffsetFrames:
          timingBefore.sourceOffsetFrames,
      },
    },
    3
  );
assert.equal(
  JSON.stringify(owner.state.currentProject),
  pointerMoveProjectBefore
);
assert.equal(
  ownerTransitionCount,
  transitionsBeforeDraft,
  "PointerMove timing draft does not touch the owner"
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDraft
);
const draftView =
  buildLayerDocumentTimelineUiReadModel({
    project: ports.project.read(),
    timeline:
      ports.timeline.readViewProps(),
    runtime: { ...runtime, timingDraft: trimDraft },
    playback: playback.read(),
    ruler,
    nameColumnWidth: 180,
    formatTime,
  });
const draftItemRow = draftView.rows.find(
  (row) =>
    row.type === "item" &&
    row.item.id === "video-b"
);
assert.ok(draftItemRow);
assert.equal(
  draftItemRow.item.startFrame,
  timingBefore.startFrame + 3
);
const transitionsBeforeTrimCommit =
  ownerTransitionCount;
const historyBeforeTrimCommit =
  owner.state.undoStack.length;
assert.equal(
  ports.timeline.dispatchIntent({
    kind: "set-timing",
    ...trimDraft,
  }).ok,
  true
);
assert.equal(
  ownerTransitionCount,
  transitionsBeforeTrimCommit + 1
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeTrimCommit + 1,
  "trim PointerUp creates one transaction/history outcome"
);
assert.equal(
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"].common
    .placement.sourceOffsetFrames,
  timingBefore.sourceOffsetFrames + 3,
  "trim uses the shared Placement frame mapping"
);
assert.equal(
  owner.state.runtimeSession
    .selectedTransformKeyframe?.globalFrame,
  16,
  "trim-start preserves the selected keyframe global projection by advancing sourceOffset"
);

const nameBeforeAlias =
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"].name;
assert.equal(
  ports.timeline.dispatchIntent({
    kind: "set-alias",
    layerDocumentId: "video-b",
    alias: "Edited placement alias",
  }).ok,
  true
);
assert.equal(
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"].name,
  nameBeforeAlias,
  "Timeline rename edits Placement alias, not Layer name or Source name"
);
assert.equal(
  owner.state.currentProject.payload
    .layerDocumentsById["video-b"].common
    .placement.alias,
  "Edited placement alias"
);
assert.equal(
  owner.state.currentProject.payload
    .sourceRegistry.sourcesById[
      "video-source"
    ].displayName,
  "shared.mp4"
);

const historyBeforePlay =
  owner.state.undoStack.length;
const transitionsBeforePlay =
  ownerTransitionCount;
playback.commands.play();
assert.equal(playback.read().isPlaying, true);
assert.equal(
  ownerTransitionCount,
  transitionsBeforePlay,
  "runtime-only play/pause does not create a shadow owner playback write"
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforePlay
);
playback.commands.seek(70);
assert.equal(
  playback.read().currentFrame,
  70,
  "public playback read is the Timeline Runtime authority"
);

const historyBeforeDuration =
  owner.state.undoStack.length;
assert.equal(
  ports.timeline.dispatchIntent({
    kind: "set-group-duration",
    layerDocumentId: "root",
    durationFrames: 40,
  }).ok,
  true
);
playback.validity.reconcile();
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDuration + 1
);
assert.equal(
  owner.state.currentProject.payload
    .layerDocumentsById.root.type,
  "group"
);
const rootAfter =
  owner.state.currentProject.payload
    .layerDocumentsById.root;
assert.ok(rootAfter.type === "group");
assert.equal(rootAfter.data.durationFrames, 40);
assert.equal(
  playback.read().currentFrame,
  39
);
assert.equal(
  playback.read().range.endFrame,
  40,
  "active Group duration commit clamps Timeline Runtime through validity"
);
playback.dispose();

console.log(
  "LayerDocument Timeline UI integration verification passed"
);
