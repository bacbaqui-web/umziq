import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type AnimatableProperty,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentVerificationPorts,
} from "./helpers/createLayerDocumentVerificationPorts";
import {
  createLayerDocumentNexusState,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  reduceLayerDocumentNexus,
  type LayerDocumentNexusPort,
  type LayerDocumentNexusState,
} from "@/engines/project";
import { createLayerDocumentSourceRuntimeResourceCache } from "@/render";
import { LAYER_DOCUMENT_PANEL_PREPARATION_PORT } from "@/engines/visual/adapters/layerDocumentPanelPreparationAdapter";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/layer-types";
import { createLayerDocumentTimelineInteractionController } from "@/engines/timeline/controllers/layerDocumentTimelineInteractionController";
import { createLayerDocumentTimelineNavigationController } from "@/engines/timeline/controllers/layerDocumentTimelineNavigationController";
import { createLayerDocumentTimelinePlaybackRuntime } from "@/engines/timeline/state/layerDocumentTimelinePlaybackRuntime";
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
  const durationFrames =
    role === "project-root" ? 20 : 6;
  value.placement.startFrame = 0;
  value.placement.durationFrames =
    durationFrames;
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
      durationFrames,
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
  createLayerDocumentNexusState({
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
let nexusState: LayerDocumentNexusState =
  initialized.state;
let nexusTransitionCount = 0;
const nexus: LayerDocumentNexusPort = {
  get state() {
    return nexusState;
  },
  transition: (action) => {
    nexusTransitionCount += 1;
    const result = reduceLayerDocumentNexus(
      nexusState,
      action
    );
    if (result.ok) nexusState = result.state;
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
const ports =
  createLayerDocumentVerificationPorts({
    nexus,
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
      applyNexusEffect: (effect) => {
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
    scope: ports.scope,
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
// Public scrub/range commands mutate the nexus session, while the injected
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
playback.commands.setLoop(true);
playback.commands.seek(4);
playback.commands.play();
scheduledTick?.();
assert.equal(playback.read().currentFrame, 2, "loop returns to the Timeline range start");
assert.equal(playback.read().isPlaying, true);
playback.commands.pause();
playback.commands.setLoop(false);
playback.commands.seek(4);
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
  ports.timeline.dispatchIntent({
    kind: "set-group-duration",
    layerDocumentId: "root",
    durationFrames: 12,
  }).ok,
  true
);
playback.validity.reconcile();
assert.equal(playback.read().currentFrame, 11);
assert.deepEqual(playback.read().range, {
  startFrame: 0,
  endFrame: 12,
});
assert.equal(ports.project.undo().ok, true);
playback.validity.reconcile();
assert.deepEqual(playback.read(), {
  currentFrame: 11,
  range: { startFrame: 0, endFrame: 12 },
  isPlaying: false,
  loop: false,
});
playback.commands.setRange(5, 18);
playback.commands.seek(15);
assert.equal(ports.project.redo().ok, true);
playback.validity.reconcile();
assert.deepEqual(playback.read(), {
  currentFrame: 11,
  range: { startFrame: 5, endFrame: 12 },
  isPlaying: false,
  loop: false,
});
assert.equal(ports.project.undo().ok, true);
playback.validity.reconcile();
assert.deepEqual(playback.read(), {
  currentFrame: 11,
  range: { startFrame: 5, endFrame: 12 },
  isPlaying: false,
  loop: false,
});
playback.commands.reset();
let switcherOpen = false;
let focusRestoreCount = 0;
const navigation =
  createLayerDocumentTimelineNavigationController({
    nexus: ports,
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
playback.commands.setRange(0, 18);
playback.commands.seek(11);
navigation.selectComposition("nested");
playback.validity.reconcile();
assert.equal(
  ports.scope.read().ok &&
    ports.scope.read().model
      .activeGroupLayerDocumentId,
  "nested"
);
assert.equal(switcherOpen, false);
assert.equal(focusRestoreCount, 3);
assert.deepEqual(playback.read(), {
  currentFrame: 5,
  range: { startFrame: 0, endFrame: 6 },
  isPlaying: false,
  loop: false,
});
ports.scope.enter("root");
playback.validity.reconcile();
type TimingPointerState = {
  session: LayerDocumentTimelineTimingSession;
  draft: ReturnType<
    typeof resolveLayerDocumentTimelineTimingDraft
  > | null;
};
let timingPointer: TimingPointerState | null =
  null;
let timingPointerWasSelected = false;
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
      ports.timeline.dispatchIntent({
        kind: "set-timing",
        ...timingPointer.draft,
      });
    }
    timingPointer = null;
    return;
  }
  if (keyframePointer) {
    ports.timeline.dispatchIntent({
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
let timingClickDecision:
  "toggle" | "keep" = "toggle";
let lastSourceStatusResult:
  LayerDocumentTimelineSourceStatusResult = null;
const sourceStatus =
  createLayerDocumentTimelineSourceStatusAdapter({
    nexus: ports,
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
    nexus: ports,
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
          LayerDocumentTimelineTimingOperation,
        wasSelected: boolean
      ) => {
        timingPointerWasSelected = wasSelected;
        const layer =
          ports.project.read().payload
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
      consumeTimingClick: () => {
        const decision = timingClickDecision;
        timingClickDecision = "toggle";
        return decision;
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
const projectBeforeSelection = structuredClone(
  ports.project.read()
);
const historyBeforeSelection =
  nexus.state.undoStack.length;
interactions.selectTimelineItem("video-a");
interactions.selectTimelineItem("video-a");
assert.equal(
  nexus.state.session.layerSelection
    ?.layerDocumentId,
  "video-a",
  "force selection must not toggle an already selected Layer"
);
interactions.toggleTimelineItemSelection(
  "video-a"
);
assert.equal(
  nexus.state.session.layerSelection,
  null,
  "a repeated general click clears Layer selection"
);
interactions.toggleTimelineItemSelection(
  "video-b"
);
assert.equal(
  nexus.state.session.layerSelection
    ?.layerDocumentId,
  "video-b"
);
timingClickDecision = "keep";
interactions.activateTimelineItemTrack(
  "video-b"
);
assert.equal(
  nexus.state.session.layerSelection
    ?.layerDocumentId,
  "video-b",
  "a completed timing drag keeps Layer selection"
);
assert.deepEqual(
  ports.project.read(),
  projectBeforeSelection,
  "selection intent must not mutate Project"
);
assert.equal(
  nexus.state.undoStack.length,
  historyBeforeSelection,
  "selection intent must not create History"
);
const historyBeforePointer =
  nexus.state.undoStack.length;
interactions.beginMoveTimelineItem(
  100,
  "video-a"
);
assert.equal(
  timingPointerWasSelected,
  false,
  "move start records whether the Layer was already selected"
);
assert.equal(
  nexus.state.session.layerSelection
    ?.layerDocumentId,
  "video-a",
  "move start force-selects its Layer"
);
const transitionsAfterPointerBegin =
  nexusTransitionCount;
moveTimingPointer(3);
assert.equal(
  nexus.state.undoStack.length,
  historyBeforePointer,
  "pointer draft must not commit history"
);
assert.equal(
  nexusTransitionCount,
  transitionsAfterPointerBegin,
  "pointer draft must not transition the nexus"
);
assert.equal(
  ports.project.read().payload
    .layerDocumentsById["video-a"].common
    .placement.startFrame,
  2
);
releasePointer();
assert.equal(
  nexus.state.undoStack.length,
  historyBeforePointer + 1,
  "pointerup commits exactly one timing transaction"
);
assert.equal(
  nexusTransitionCount,
  transitionsAfterPointerBegin + 1
);
assert.equal(
  ports.project.read().payload
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
  ports.project.read().payload
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
  ports.project.read().payload
    .layerDocumentsById["video-a-copy"]
);
interactions.setDraggedTimelineItemId(
  "video-b"
);
interactions.reorderTimelineItem("video-a");
assert.ok(
  ports.project.read().payload
    .layerDocumentsById["video-b"].common
    .placement.order <
    ports.project.read().payload
      .layerDocumentsById["video-a"].common
      .placement.order
);
const sourcesBeforeLayerDelete =
  structuredClone(
    ports.project.read().payload
      .sourceRegistry
  );
interactions.deleteTimelineItem(
  "video-a-copy"
);
assert.equal(
  ports.project.read().payload
    .layerDocumentsById["video-a-copy"],
  undefined
);
assert.deepEqual(
  ports.project.read().payload
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
  ports.project.read().payload
    .layerDocumentsById["video-a"].common
    .animation.positionKeyframes.map(
      (keyframe) => keyframe.frame
    );
assert.deepEqual(positionFrames, [3, 4]);

interactions.selectTimelineItem("video-b");
const projectBeforeAcknowledge =
  structuredClone(ports.project.read());
const undoBeforeAcknowledge =
  structuredClone(nexus.state.undoStack);
const redoBeforeAcknowledge =
  structuredClone(nexus.state.redoStack);
const invalidationsBeforeAcknowledge =
  runtimeInvalidationEffectCount;
interactions.activateTimelineItem(
  "video-a",
  "updated"
);
assert.equal(lastSourceStatusResult?.ok, true);
assert.deepEqual(
  ports.project.read(),
  projectBeforeAcknowledge,
  "row activation must not rewrite Source content/version/status"
);
assert.deepEqual(nexus.state.undoStack, undoBeforeAcknowledge);
assert.deepEqual(nexus.state.redoStack, redoBeforeAcknowledge);
assert.equal(runtimeInvalidationEffectCount, invalidationsBeforeAcknowledge);
assert.equal(nexus.state.session.layerSelection?.layerDocumentId, "video-a");
const acknowledged =
  nexus.state.runtimeSession
    .acknowledgedSourceStatuses ?? [];
assert.equal(
  resolveLayerDocumentTimelineEffectiveSourceStatus(
    ports.project.read(),
    ports.project.read().payload
      .layerDocumentsById["video-a"],
    acknowledged,
    sourceResolution.read("source-a").status
  ),
  "normal",
  "ViewModel effective status consumes Runtime-only acknowledgment"
);
const sourceA = ports.project.read().payload
  .sourceRegistry.sourcesById["source-a"];
sourceA.version += 1;
sourceA.refresh.status = "new";
interactions.selectTimelineItem("video-b");
const sourceBeforeNewAcknowledge = structuredClone(sourceA);
const historyBeforeNewAcknowledge = nexus.state.undoStack.length;
const invalidationsBeforeNewAcknowledge = runtimeInvalidationEffectCount;
interactions.activateTimelineItem("video-a", "new");
assert.deepEqual(sourceA, sourceBeforeNewAcknowledge);
assert.equal(nexus.state.undoStack.length, historyBeforeNewAcknowledge);
assert.equal(runtimeInvalidationEffectCount, invalidationsBeforeNewAcknowledge);
assert.ok((nexus.state.runtimeSession.acknowledgedSourceStatuses ?? [])
  .some((identity) => identity.sourceId === "source-a" &&
    identity.version === sourceA.version &&
    identity.status === "new"));
interactions.activateTimelineItem(
  "video-b",
  "deletePending"
);
const sourceBeforeKeep = structuredClone(ports.project.read()
  .payload.sourceRegistry.sourcesById["source-b"]);
const historyBeforeKeep = nexus.state.undoStack.length;
interactions.resolveTimelineSourceDelete("video-b", "keep");
assert.equal(lastSourceStatusResult?.ok, true);
assert.deepEqual(
  ports.project.read().payload.sourceRegistry
    .sourcesById["source-b"],
  sourceBeforeKeep,
  "keep acknowledges deletePending without Source refresh"
);
assert.equal(nexus.state.undoStack.length, historyBeforeKeep);
assert.equal(deleteDecisionLayerDocumentId, null);
assert.ok((nexus.state.runtimeSession.acknowledgedSourceStatuses ?? [])
  .some((identity) => identity.sourceId === "source-b"));
interactions.activateTimelineItem("video-b", "deletePending");
const projectBeforeDelete = structuredClone(
  ports.project.read()
);
const undoBeforeDelete = structuredClone(nexus.state.undoStack);
const redoBeforeDelete = structuredClone(nexus.state.redoStack);
interactions.resolveTimelineSourceDelete(
  "video-b",
  "delete"
);
assert.equal(
  deleteDecisionLayerDocumentId,
  null
);
const reconciledProject = ports.project.read();
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
assert.deepEqual(nexus.state.undoStack, undoBeforeDelete);
assert.deepEqual(nexus.state.redoStack, redoBeforeDelete);

unsubscribePlayback();
playback.dispose();
console.log(
  "LayerDocument Timeline controller harness verification passed"
);
