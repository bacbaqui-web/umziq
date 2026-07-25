import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type AnimatableProperty,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import { createLayerDocumentConsumerCutoverAssembly } from "@/cutover";
import {
  createLayerDocumentProjectOwnerState,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  reduceLayerDocumentProjectOwner,
  type LayerDocumentProjectOwnerPort,
  type LayerDocumentProjectOwnerState,
} from "@/engines/project";
import { createLayerDocumentSourceRuntimeResourceCache } from "@/engines/playback-render";
import { LAYER_DOCUMENT_PANEL_PREPARATION_PORT } from "@/engines/properties/adapters/layerDocumentPanelPreparationAdapter";
import { LAYER_DOCUMENT_DRAWING_PREPARATION_PORT } from "@/engines/drawing";
import { LAYER_DOCUMENT_TEXT_PREPARATION_PORT } from "@/engines/text";
import { LAYER_DOCUMENT_AUDIO_PREPARATION_PORT } from "@/engines/audio";
import { createLayerDocumentTimelineInteractionController } from "@/engines/timeline/adapters/layerDocumentTimelineInteractionController";
import { createLayerDocumentTimelineNavigationController } from "@/engines/timeline/adapters/layerDocumentTimelineNavigationController";
import { createLayerDocumentTimelinePlaybackRuntime } from "@/engines/timeline/adapters/layerDocumentTimelinePlaybackAdapter";
import {
  createLayerDocumentTimelineSourceStatusAdapter,
  type LayerDocumentTimelineSourceStatusResult,
} from "@/engines/timeline/adapters/layerDocumentTimelineSourceStatusAdapter";
import {
  resolveLayerDocumentTimelineTimingDraft,
  type LayerDocumentTimelineTimingOperation,
  type LayerDocumentTimelineTimingSession,
} from "@/engines/timeline/helpers/layerDocumentTimelineInteractionHelpers";
import { resolveLayerDocumentTimelineEffectiveSourceStatus } from "@/engines/timeline/helpers/layerDocumentTimelineViewModelHelpers";

function common(
  parentLayerDocumentId: string | null,
  order: number,
  sourceId: string | null
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
      startFrame: parentLayerDocumentId ? 2 : 0,
      durationFrames: parentLayerDocumentId ? 6 : 20,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [
        { frame: 1, value: { x: 1, y: 2 } },
        { frame: 4, value: { x: 4, y: 5 } },
      ],
      scaleKeyframes: [],
      rotationKeyframes: [],
      opacityKeyframes: [],
      enabledProperties: {
        position: true,
        scale: false,
        rotation: false,
        opacity: false,
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
  role: "project-root" | "composition"
): LayerDocument {
  const value = common(
    parentLayerDocumentId,
    order,
    null
  );
  value.placement.startFrame = 0;
  value.placement.durationFrames = 20;
  return {
    layerDocumentId,
    name:
      role === "project-root"
        ? "Root"
        : "Nested",
    revision: 0,
    type: "group",
    common: value,
    data: {
      role,
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationFrames: 20,
    },
  };
}
function video(
  layerDocumentId: string,
  order: number,
  sourceId: string
): LayerDocument {
  return {
    layerDocumentId,
    name: layerDocumentId,
    revision: 0,
    type: "video",
    common: common("root", order, sourceId),
    data: {},
  };
}
function projectFixture(): LayerDocumentProject {
  return {
    metadata: {
      schemaVersion:
        LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "timeline-controller-harness",
      name: "Timeline controller harness",
    },
    payload: {
      layerDocumentsById: {
        root: group(
          "root",
          null,
          0,
          "project-root"
        ),
        "video-a": video(
          "video-a",
          0,
          "source-a"
        ),
        "video-b": video(
          "video-b",
          1,
          "source-b"
        ),
        nested: group(
          "nested",
          "root",
          2,
          "composition"
        ),
      },
      sourceRegistry: {
        sourcesById: {
          "source-a": {
            sourceId: "source-a",
            kind: "video",
            displayName: "updated.mp4",
            locator: {
              locatorId: "linked:source-a",
              kind: "linked-file",
              suggestedFileName: "updated.mp4",
              relativePathHint: "fixtures/updated.mp4",
            },
            contentFingerprint: null,
            version: 1,
            refresh: {
              status: "updated",
            },
            data: {
              mimeType: "video/mp4",
              durationFrames: 20,
              width: 1080,
              height: 1920,
            },
          },
          "source-b": {
            sourceId: "source-b",
            kind: "video",
            displayName: "deleted.mp4",
            locator: {
              locatorId: "linked:source-b",
              kind: "linked-file",
              suggestedFileName: "deleted.mp4",
              relativePathHint: "fixtures/deleted.mp4",
            },
            contentFingerprint: null,
            version: 1,
            refresh: {
              status: "deletePending",
            },
            data: {
              mimeType: "video/mp4",
              durationFrames: 20,
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
    playback: {
      currentFrame: 0,
      range: {
        startFrame: 0,
        endFrame: 20,
      },
    },
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
let runtimeInvalidationEffectCount = 0;
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
sourceResolution.setAvailable({
  sourceId: "source-a",
  file: null,
});
sourceResolution.setAvailable({
  sourceId: "source-b",
  file: null,
});
const assembly =
  createLayerDocumentConsumerCutoverAssembly({
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
    sourceRuntime:
      createLayerDocumentSourceRuntimeResourceCache(),
    sourceResolution,
    draftSession: {
      read: () => null,
      publish: () => {},
      clear: () => {},
    },
    effects: {
      applyOwnerEffect: (effect) => {
        if (
          effect.runtimeCachePolicy !==
            "preserve" ||
          effect.cacheInvalidations.length > 0
        ) runtimeInvalidationEffectCount += 1;
      },
    },
    metrics: {
      increment: () => {},
    },
  });
let scheduledTick: (() => void) | null = null;
let scheduledInterval = 0;
let clearedClocks = 0;
let draftClearCount = 0;
const playback =
  createLayerDocumentTimelinePlaybackRuntime({
    assembly,
    scheduler: {
      setRepeating: (callback, intervalMs) => {
        scheduledTick = callback;
        scheduledInterval = intervalMs;
        return "controlled-clock";
      },
      clearRepeating: () => {
        scheduledTick = null;
        clearedClocks += 1;
      },
    },
    clearDraft: () => {
      draftClearCount += 1;
    },
  });
let playbackNotifications = 0;
const unsubscribePlayback = playback.subscribe(
  () => {
    playbackNotifications += 1;
  }
);
// Public scrub/range commands mutate the owner session, while the injected
// Runtime owns only clock progress and isPlaying.
playback.commands.setRange(2, 5);
playback.commands.seek(-10);
assert.deepEqual(playback.read().range, {
  startFrame: 2,
  endFrame: 5,
});
assert.equal(playback.read().currentFrame, 0);
playback.commands.play();
assert.equal(playback.read().currentFrame, 2);
assert.equal(playback.read().isPlaying, true);
assert.equal(scheduledInterval, 1000 / 30);
scheduledTick?.();
assert.equal(playback.read().currentFrame, 3);
scheduledTick?.();
assert.equal(playback.read().currentFrame, 4);
scheduledTick?.();
assert.equal(playback.read().currentFrame, 4);
assert.equal(playback.read().isPlaying, false);
assert.equal(clearedClocks, 1);
playback.commands.stepBackward();
assert.equal(playback.read().currentFrame, 3);
playback.commands.stepForward();
assert.equal(playback.read().currentFrame, 4);
playback.commands.reset();
assert.equal(playback.read().currentFrame, 0);
assert.ok(playbackNotifications > 0);
assert.ok(draftClearCount > 0);

playback.commands.setRange(-20, 99);
playback.commands.seek(99);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "set-group-duration",
    layerDocumentId: "root",
    durationFrames: 12,
  }).ok,
  true
);
assert.equal(playback.read().currentFrame, 11);
assert.deepEqual(playback.read().range, {
  startFrame: 0,
  endFrame: 12,
});
playback.commands.reset();
let switcherOpen = false;
let focusRestoreCount = 0;
const navigation =
  createLayerDocumentTimelineNavigationController({
    assembly,
    ui: {
      readIsOpen: () => switcherOpen,
      setIsOpen: (value) => {
        switcherOpen = value;
      },
      restoreTriggerFocus: () => {
        focusRestoreCount += 1;
      },
    },
  });
navigation.toggleCompositionSwitcher();
assert.equal(switcherOpen, true);
navigation.closeForEscape();
assert.equal(switcherOpen, false);
assert.equal(focusRestoreCount, 1);
navigation.toggleCompositionSwitcher();
navigation.closeForOutsidePointer();
assert.equal(switcherOpen, false);
assert.equal(focusRestoreCount, 2);
navigation.toggleCompositionSwitcher();
navigation.selectComposition("nested");
assert.equal(
  assembly.scope.read().ok &&
    assembly.scope.read().model
      .activeGroupLayerDocumentId,
  "nested"
);
assert.equal(switcherOpen, false);
assert.equal(focusRestoreCount, 3);
assembly.scope.enter("root");
type TimingPointerState = {
  session: LayerDocumentTimelineTimingSession;
  draft: ReturnType<
    typeof resolveLayerDocumentTimelineTimingDraft
  > | null;
};
let timingPointer: TimingPointerState | null =
  null;
let keyframePointer: {
  layerDocumentId: string;
  localFrame: number;
  property: AnimatableProperty;
  targetLocalFrame: number;
} | null = null;
const moveTimingPointer = (
  deltaFrames: number
) => {
  assert.ok(timingPointer);
  timingPointer.draft =
    resolveLayerDocumentTimelineTimingDraft(
      timingPointer.session,
      deltaFrames
    );
};
const releasePointer = () => {
  if (timingPointer) {
    if (timingPointer.draft) {
      assembly.timeline.dispatchIntent({
        kind: "set-timing",
        ...timingPointer.draft,
      });
    }
    timingPointer = null;
    return;
  }
  if (keyframePointer) {
    assembly.timeline.dispatchIntent({
      kind: "move-keyframe",
      layerDocumentId:
        keyframePointer.layerDocumentId,
      property: keyframePointer.property,
      fromLocalFrame:
        keyframePointer.localFrame,
      toLocalFrame:
        keyframePointer.targetLocalFrame,
    });
    keyframePointer = null;
  }
};
let draggedLayerDocumentId: string | null =
  null;
let editingLayerDocumentId: string | null =
  null;
let draftName = "";
let deleteDecisionLayerDocumentId:
  string | null = null;
let lastSourceStatusResult:
  LayerDocumentTimelineSourceStatusResult = null;
const sourceStatus =
  createLayerDocumentTimelineSourceStatusAdapter({
    assembly,
    cacheContext: () => ({
      globalFrame:
        playback.read().currentFrame,
      localFrameByLayerDocumentId: {},
      quality: "preview",
    }),
  });
const observedSourceStatus = {
  acknowledge: (layerDocumentId: string) => {
    lastSourceStatusResult =
      sourceStatus.acknowledge(layerDocumentId);
    return lastSourceStatusResult;
  },
  resolve: (
    layerDocumentId: string,
    decision: "delete" | "keep"
  ) => {
    lastSourceStatusResult =
      sourceStatus.resolve(
        layerDocumentId,
        decision
      );
    return lastSourceStatusResult;
  },
};
const allocatedIds = ["video-a-copy"];
const interactions =
  createLayerDocumentTimelineInteractionController({
    assembly,
    playback,
    sourceStatus: observedSourceStatus,
    allocateLayerDocumentId: () => {
      const id = allocatedIds.shift();
      if (!id) {
        throw new Error("Fixture ID exhausted");
      }
      return id;
    },
    ui: {
      read: () => ({
        draggedLayerDocumentId,
        editingLayerDocumentId,
        draftName,
      }),
      setDraggedLayerDocumentId: (value) => {
        draggedLayerDocumentId = value;
      },
      beginRename: (
        layerDocumentId,
        initialName
      ) => {
        editingLayerDocumentId =
          layerDocumentId;
        draftName = initialName;
      },
      setDraftName: (value) => {
        draftName = value;
      },
      clearRename: () => {
        editingLayerDocumentId = null;
        draftName = "";
      },
      setDeleteDecisionLayerDocumentId:
        (value) => {
          deleteDecisionLayerDocumentId =
            value;
        },
    },
    pointer: {
      beginTiming: (
        _clientX: number,
        layerDocumentId: string,
        operation:
          LayerDocumentTimelineTimingOperation
      ) => {
        const layer =
          assembly.project.read().payload
            .layerDocumentsById[
              layerDocumentId
            ];
        assert.ok(layer);
        timingPointer = {
          session: {
            operation,
            timelineDurationFrames: 12,
            initial: {
              layerDocumentId,
              startFrame:
                layer.common.placement
                  .startFrame,
              durationFrames:
                layer.common.placement
                  .durationFrames,
              sourceOffsetFrames:
                layer.common.placement
                  .sourceOffsetFrames,
            },
          },
          draft: null,
        };
      },
      beginKeyframeMove: (
        _clientX,
        layerDocumentId,
        localFrame,
        property
      ) => {
        keyframePointer = {
          layerDocumentId,
          localFrame,
          property,
          targetLocalFrame: localFrame,
        };
      },
    },
  });
const historyBeforePointer =
  owner.state.undoStack.length;
const transitionsBeforePointer =
  ownerTransitionCount;
interactions.beginMoveTimelineItem(
  100,
  "video-a"
);
moveTimingPointer(3);
assert.equal(
  owner.state.undoStack.length,
  historyBeforePointer,
  "pointer draft must not commit history"
);
assert.equal(
  ownerTransitionCount,
  transitionsBeforePointer,
  "pointer draft must not transition the owner"
);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["video-a"].common
    .placement.startFrame,
  2
);
releasePointer();
assert.equal(
  owner.state.undoStack.length,
  historyBeforePointer + 1,
  "pointerup commits exactly one timing transaction"
);
assert.equal(
  ownerTransitionCount,
  transitionsBeforePointer + 1
);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["video-a"].common
    .placement.startFrame,
  5
);
interactions.beginRenameTimelineItem(
  "video-a"
);
interactions.changeTimelineItemName(
  "  Alias A  "
);
interactions.commitTimelineItemName();
const renamed =
  assembly.project.read().payload
    .layerDocumentsById["video-a"];
assert.equal(
  renamed.common.placement.alias,
  "Alias A"
);
assert.equal(renamed.name, "video-a");
interactions.duplicateTimelineItem(
  "video-a"
);
assert.ok(
  assembly.project.read().payload
    .layerDocumentsById["video-a-copy"]
);
interactions.setDraggedTimelineItemId(
  "video-b"
);
interactions.reorderTimelineItem("video-a");
assert.ok(
  assembly.project.read().payload
    .layerDocumentsById["video-b"].common
    .placement.order <
    assembly.project.read().payload
      .layerDocumentsById["video-a"].common
      .placement.order
);
const sourcesBeforeLayerDelete =
  structuredClone(
    assembly.project.read().payload
      .sourceRegistry
  );
interactions.deleteTimelineItem(
  "video-a-copy"
);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["video-a-copy"],
  undefined
);
assert.deepEqual(
  assembly.project.read().payload
    .sourceRegistry,
  sourcesBeforeLayerDelete,
  "Layer context delete must leave Source Registry immutable"
);

interactions.beginMoveKeyframe(
  100,
  "video-a",
  1,
  "position"
);
assert.ok(keyframePointer);
keyframePointer.targetLocalFrame = 3;
releasePointer();
const positionFrames =
  assembly.project.read().payload
    .layerDocumentsById["video-a"].common
    .animation.positionKeyframes.map(
      (keyframe) => keyframe.frame
    );
assert.deepEqual(positionFrames, [3, 4]);

interactions.selectTimelineItem("video-b");
const projectBeforeAcknowledge =
  structuredClone(assembly.project.read());
const undoBeforeAcknowledge =
  structuredClone(owner.state.undoStack);
const redoBeforeAcknowledge =
  structuredClone(owner.state.redoStack);
const invalidationsBeforeAcknowledge =
  runtimeInvalidationEffectCount;
interactions.activateTimelineItem(
  "video-a",
  "updated"
);
assert.equal(lastSourceStatusResult?.ok, true);
assert.deepEqual(
  assembly.project.read(),
  projectBeforeAcknowledge,
  "row activation must not rewrite Source content/version/status"
);
assert.deepEqual(owner.state.undoStack, undoBeforeAcknowledge);
assert.deepEqual(owner.state.redoStack, redoBeforeAcknowledge);
assert.equal(runtimeInvalidationEffectCount, invalidationsBeforeAcknowledge);
assert.equal(owner.state.session.layerSelection?.layerDocumentId, "video-a");
const acknowledged =
  owner.state.runtimeSession
    .acknowledgedSourceStatuses ?? [];
assert.equal(
  resolveLayerDocumentTimelineEffectiveSourceStatus(
    assembly.project.read(),
    assembly.project.read().payload
      .layerDocumentsById["video-a"],
    acknowledged,
    sourceResolution.read("source-a").status
  ),
  "normal",
  "ViewModel effective status consumes Runtime-only acknowledgment"
);
const sourceA = assembly.project.read().payload
  .sourceRegistry.sourcesById["source-a"];
sourceA.version += 1;
sourceA.refresh.status = "new";
interactions.selectTimelineItem("video-b");
const sourceBeforeNewAcknowledge = structuredClone(sourceA);
const historyBeforeNewAcknowledge = owner.state.undoStack.length;
const invalidationsBeforeNewAcknowledge = runtimeInvalidationEffectCount;
interactions.activateTimelineItem("video-a", "new");
assert.deepEqual(sourceA, sourceBeforeNewAcknowledge);
assert.equal(owner.state.undoStack.length, historyBeforeNewAcknowledge);
assert.equal(runtimeInvalidationEffectCount, invalidationsBeforeNewAcknowledge);
assert.ok((owner.state.runtimeSession.acknowledgedSourceStatuses ?? [])
  .some((identity) => identity.sourceId === "source-a" &&
    identity.version === sourceA.version &&
    identity.status === "new"));
interactions.activateTimelineItem(
  "video-b",
  "deletePending"
);
const sourceBeforeKeep = structuredClone(assembly.project.read()
  .payload.sourceRegistry.sourcesById["source-b"]);
const historyBeforeKeep = owner.state.undoStack.length;
interactions.resolveTimelineSourceDelete("video-b", "keep");
assert.equal(lastSourceStatusResult?.ok, true);
assert.deepEqual(
  assembly.project.read().payload.sourceRegistry
    .sourcesById["source-b"],
  sourceBeforeKeep,
  "keep acknowledges deletePending without Source refresh"
);
assert.equal(owner.state.undoStack.length, historyBeforeKeep);
assert.equal(deleteDecisionLayerDocumentId, null);
assert.ok((owner.state.runtimeSession.acknowledgedSourceStatuses ?? [])
  .some((identity) => identity.sourceId === "source-b"));
interactions.activateTimelineItem("video-b", "deletePending");
const projectBeforeDelete = structuredClone(
  assembly.project.read()
);
const undoBeforeDelete = structuredClone(owner.state.undoStack);
const redoBeforeDelete = structuredClone(owner.state.redoStack);
interactions.resolveTimelineSourceDelete(
  "video-b",
  "delete"
);
assert.equal(
  deleteDecisionLayerDocumentId,
  null
);
const reconciledProject = assembly.project.read();
assert.deepEqual(
  reconciledProject,
  projectBeforeDelete,
  "missing detection must leave persisted Project data unchanged"
);
assert.equal(
  sourceResolution.read("source-b").status,
  "missing",
  "delete accepts upstream deletion in Runtime resolution state"
);
assert.ok(
  reconciledProject.payload
    .layerDocumentsById["video-b"],
  "Source reconciliation must not delete a Layer subtree"
);
assert.equal(
  reconciledProject.payload
    .layerDocumentsById["video-b"].common
    .source?.sourceId,
  "source-b"
);
assert.deepEqual(owner.state.undoStack, undoBeforeDelete);
assert.deepEqual(owner.state.redoStack, redoBeforeDelete);

unsubscribePlayback();
playback.dispose();
console.log(
  "LayerDocument Timeline controller harness verification passed"
);
