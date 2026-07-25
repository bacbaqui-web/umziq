import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type AnimatableProperty,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentTransformProperty,
  type SourceRegistryRecord,
} from "@/models";
import {
  createLayerDocumentConsumerCutoverAssembly,
} from "@/cutover";
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
  type LayerDocumentTransformDraftSnapshot,
} from "@/engines/playback-render";
import {
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/properties/adapters/layerDocumentPanelPreparationAdapter";
import {
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
} from "@/engines/drawing";
import {
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/engines/text";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
} from "@/engines/audio";
import {
  createLayerDocumentTimelineInteractionController,
} from "@/engines/timeline/adapters/layerDocumentTimelineInteractionController";
import {
  createLayerDocumentTimelinePlaybackRuntime,
} from "@/engines/timeline/adapters/layerDocumentTimelinePlaybackAdapter";
import {
  buildMoveLayerDocumentTransaction,
} from "@/models/layerDocumentTimelineTransactions";

function common(
  parentLayerDocumentId: string | null,
  order: number,
  durationFrames = 20,
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
      startFrame: 0,
      durationFrames,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [
        { frame: 1, value: { x: 1, y: 1 } },
        { frame: 4, value: { x: 4, y: 4 } },
      ],
      scaleKeyframes: [
        { frame: 1, value: { x: 101, y: 101 } },
        { frame: 4, value: { x: 104, y: 104 } },
      ],
      rotationKeyframes: [
        { frame: 1, value: 10 },
        { frame: 4, value: 40 },
      ],
      opacityKeyframes: [
        { frame: 1, value: 90 },
        { frame: 4, value: 60 },
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
  id: string,
  parentLayerDocumentId: string | null,
  order: number,
  role: "project-root" | "composition"
): LayerDocument {
  return {
    layerDocumentId: id,
    name: id,
    revision: 0,
    type: "group",
    common: common(
      parentLayerDocumentId,
      order
    ),
    data: {
      role,
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationFrames: 20,
    },
  };
}

function text(
  id: string,
  parentLayerDocumentId: string,
  order: number
): LayerDocument {
  return {
    layerDocumentId: id,
    name: id,
    revision: 0,
    type: "text",
    common: common(
      parentLayerDocumentId,
      order,
      10
    ),
    data: {
      text: id,
      style: {
        fontFamily: "sans-serif",
        fontSize: 20,
        color: "#ffffff",
      },
    },
  };
}

function psd(
  id: string,
  name: string,
  parentLayerDocumentId: string,
  order: number,
  sourceId: string,
  x: number
): LayerDocument {
  const layer = {
    layerDocumentId: id,
    name,
    revision: 0,
    type: "psd" as const,
    common: common(
      parentLayerDocumentId,
      order,
      20,
      sourceId
    ),
    data: {},
  };
  layer.common.transform.position.x = x;
  layer.common.animation.enabledProperties.position =
    false;
  return layer;
}

function duplicateSources():
Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
  };
  return {
    "duplicate-document": {
      sourceId: "duplicate-document",
      kind: "psd-document",
      displayName: "drag_test.psd",
      locator: {
        locatorId: "linked:duplicate-document",
        kind: "linked-file",
        suggestedFileName: "drag_test.psd",
        relativePathHint: "drag_test.psd",
      },
      contentFingerprint: null,
      version: 1,
      refresh,
      data: {
        importSettings: {
          compositionName: "drag_test",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "background-source": {
      sourceId: "background-source",
      kind: "psd-node",
      displayName: "background",
      version: 1,
      refresh,
      data: {
        documentSourceId: "duplicate-document",
        sourceKey: "layer:background",
        sourcePath: "background",
        visualFingerprint: "background-v1",
      },
    },
    "source-name-collision": {
      sourceId: "source-name-collision",
      kind: "psd-node",
      displayName: "background_6",
      version: 1,
      refresh,
      data: {
        documentSourceId: "duplicate-document",
        sourceKey: "layer:source-name-collision",
        sourcePath: "source-name-collision",
        visualFingerprint: "source-name-collision-v1",
      },
    },
  };
}

const project: LayerDocumentProject = {
  metadata: {
    schemaVersion:
      LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
    projectId: "timeline-public-keyframes",
    name: "Timeline public keyframes",
  },
  payload: {
    layerDocumentsById: {
      root: group(
        "root",
        null,
        0,
        "project-root"
      ),
      a: text("a", "root", 0),
      b: text("b", "root", 1),
      nested: group(
        "nested",
        "root",
        2,
        "composition"
      ),
      "nested-child": text(
        "nested-child",
        "nested",
        0
      ),
      background: psd(
        "background",
        "background",
        "nested",
        1,
        "background-source",
        600
      ),
      "name-collision": {
        ...text(
          "name-collision",
          "nested",
          2
        ),
        name: "background_4",
      },
      "alias-collision": {
        ...text(
          "alias-collision",
          "nested",
          3
        ),
        common: {
          ...common("nested", 3),
          placement: {
            ...common("nested", 3).placement,
            alias: "background_5",
          },
        },
      },
      "source-collision": psd(
        "source-collision",
        "Other Layer",
        "nested",
        4,
        "source-name-collision",
        0
      ),
      "suffix-source": {
        ...text(
          "suffix-source",
          "nested",
          5
        ),
        name: "plate_2",
      },
    },
    sourceRegistry: {
      sourcesById: duplicateSources(),
    },
  },
};
const initialized =
  createLayerDocumentProjectOwnerState({
    project,
    layerSelection: {
      kind: "layer-document",
      layerDocumentId: "a",
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
if (!initialized.ok) {
  throw new Error(initialized.error.message);
}
assert.equal(initialized.ok, true);
let state: LayerDocumentProjectOwnerState =
  initialized.state;
let transitionCount = 0;
const owner: LayerDocumentProjectOwnerPort = {
  get state() {
    return state;
  },
  transition: (action) => {
    transitionCount += 1;
    const result = reduceLayerDocumentProjectOwner(
      state,
      action
    );
    if (result.ok) state = result.state;
    return result;
  },
};
let canvasDraft:
LayerDocumentTransformDraftSnapshot | null = null;
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
Object.keys(duplicateSources()).forEach((sourceId) => {
  sourceResolution.setAvailable({ sourceId });
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
      read: () => canvasDraft,
      publish: (draft) => {
        canvasDraft = draft;
      },
      clear: () => {
        canvasDraft = null;
      },
    },
    effects: {
      applyOwnerEffect: () => {},
    },
    metrics: {
      increment: () => {},
    },
  });
const playback =
  createLayerDocumentTimelinePlaybackRuntime({
    assembly,
    scheduler: {
      setRepeating: () => "clock",
      clearRepeating: () => {},
    },
  });

const allocatedDuplicateIds = [
  "background-copy-2",
  "background-copy-3",
  "background-copy-7",
  "suffix-copy-3",
];
let allocatedDuplicateIndex = 0;
let draggedLayerDocumentId: string | null =
  null;
let keyframePointer: {
  layerDocumentId: string;
  localFrame: number;
  property: AnimatableProperty;
  targetLocalFrame: number;
} | null = null;
const interactions =
  createLayerDocumentTimelineInteractionController({
    assembly,
    playback,
    sourceStatus: {
      acknowledge: () => {},
      resolve: () => {},
    },
    allocateLayerDocumentId: () =>
      allocatedDuplicateIds[
        allocatedDuplicateIndex++
      ] ?? "unused",
    ui: {
      read: () => ({
        draggedLayerDocumentId,
        editingLayerDocumentId: null,
        draftName: "",
      }),
      setDraggedLayerDocumentId: (value) => {
        draggedLayerDocumentId = value;
      },
      beginRename: () => {},
      setDraftName: () => {},
      clearRename: () => {},
      setDeleteDecisionLayerDocumentId:
        () => {},
    },
    pointer: {
      beginTiming: () => {},
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

const properties:
readonly LayerDocumentTransformProperty[] = [
  "position",
  "scale",
  "rotation",
  "opacity",
];
function animationFor(property:
LayerDocumentTransformProperty) {
  return property === "position"
    ? "positionKeyframes"
    : property === "scale"
      ? "scaleKeyframes"
      : property === "rotation"
        ? "rotationKeyframes"
        : "opacityKeyframes";
}

properties.forEach((property) => {
  const beforeMove = structuredClone(
    assembly.project.read().payload
      .layerDocumentsById.a.common.animation
  );
  const historyBeforeMove =
    owner.state.undoStack.length;
  interactions.beginMoveKeyframe(
    100,
    "a",
    1,
    property
  );
  assert.ok(keyframePointer);
  keyframePointer.targetLocalFrame = 2;
  const transitionsBeforePointerUp =
    transitionCount;
  const activePointer = keyframePointer;
  assembly.timeline.dispatchIntent({
    kind: "move-keyframe",
    layerDocumentId:
      activePointer.layerDocumentId,
    property: activePointer.property,
    fromLocalFrame:
      activePointer.localFrame,
    toLocalFrame:
      activePointer.targetLocalFrame,
  });
  keyframePointer = null;
  assert.equal(
    transitionCount,
    transitionsBeforePointerUp + 1,
    `${property} pointerup commits one owner transaction`
  );
  assert.equal(
    owner.state.undoStack.length,
    historyBeforeMove + 1
  );
  assert.deepEqual(
    owner.state.runtimeSession
      .selectedTransformKeyframe,
    {
      layerDocumentId: "a",
      property,
      localFrame: 2,
      globalFrame: 2,
    }
  );
  const afterMove =
    assembly.project.read().payload
      .layerDocumentsById.a.common.animation;
  assert.deepEqual(
    afterMove[animationFor(property)].map(
      (keyframe) => keyframe.frame
    ),
    [2, 4]
  );
  properties
    .filter((other) => other !== property)
    .forEach((other) => {
      assert.deepEqual(
        afterMove[animationFor(other)],
        beforeMove[animationFor(other)],
        `${property} move preserves ${other}`
      );
    });

  const beforeRemove = structuredClone(
    afterMove
  );
  const historyBeforeRemove =
    owner.state.undoStack.length;
  interactions.deleteKeyframe(
    "a",
    2,
    property
  );
  assert.equal(
    owner.state.undoStack.length,
    historyBeforeRemove + 1
  );
  assert.equal(
    owner.state.runtimeSession
      .selectedTransformKeyframe,
    null
  );
  const afterRemove =
    assembly.project.read().payload
      .layerDocumentsById.a.common.animation;
  assert.deepEqual(
    afterRemove[animationFor(property)].map(
      (keyframe) => keyframe.frame
    ),
    [4]
  );
  properties
    .filter((other) => other !== property)
    .forEach((other) => {
      assert.deepEqual(
        afterRemove[animationFor(other)],
        beforeRemove[animationFor(other)],
        `${property} remove preserves ${other}`
      );
  });
});

const sourceRegistryBeforeDuplicate =
  structuredClone(
    assembly.project.read().payload.sourceRegistry
  );
const duplicateOnceHistory =
  owner.state.undoStack.length;
const duplicateOnceTransitions = transitionCount;
interactions.duplicateTimelineItem("background");
assert.equal(
  transitionCount,
  duplicateOnceTransitions + 1
);
assert.equal(
  owner.state.undoStack.length,
  duplicateOnceHistory + 1
);
let duplicateProject = assembly.project.read();
const background2 =
  duplicateProject.payload.layerDocumentsById[
    "background-copy-2"
  ];
assert.equal(background2.name, "background_2");
assert.equal(background2.common.placement.alias, null);
assert.equal(
  background2.common.source?.sourceId,
  "background-source"
);
assert.equal(
  owner.state.session.layerSelection
    .layerDocumentId,
  "background-copy-2"
);
assert.notStrictEqual(
  background2.common,
  duplicateProject.payload
    .layerDocumentsById.background.common
);

const duplicateTwiceHistory =
  owner.state.undoStack.length;
interactions.duplicateTimelineItem("background");
assert.equal(
  owner.state.undoStack.length,
  duplicateTwiceHistory + 1
);
duplicateProject = assembly.project.read();
assert.equal(
  duplicateProject.payload.layerDocumentsById[
    "background-copy-3"
  ].name,
  "background_3"
);
assert.equal(
  owner.state.session.layerSelection
    .layerDocumentId,
  "background-copy-3"
);
const historyAfterSecondDuplicate =
  owner.state.undoStack.length;
assert.equal(assembly.project.undo().ok, true);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["background-copy-3"],
  undefined
);
assert.equal(
  owner.state.session.layerSelection
    .layerDocumentId,
  "background-copy-2"
);
assert.equal(assembly.project.redo().ok, true);
assert.ok(
  assembly.project.read().payload
    .layerDocumentsById["background-copy-3"]
);
assert.equal(
  owner.state.session.layerSelection
    .layerDocumentId,
  "background-copy-3"
);
assert.equal(
  owner.state.undoStack.length,
  historyAfterSecondDuplicate
);

interactions.duplicateTimelineItem("background");
duplicateProject = assembly.project.read();
assert.equal(
  duplicateProject.payload.layerDocumentsById[
    "background-copy-7"
  ].name,
  "background_7",
  "name, alias, and Source display collisions are skipped"
);
const nestedSiblingIds = Object.values(
  duplicateProject.payload.layerDocumentsById
)
  .filter(
    (layer) =>
      layer.common.placement
        .parentLayerDocumentId === "nested"
  )
  .sort(
    (left, right) =>
      left.common.placement.order -
      right.common.placement.order
  )
  .map((layer) => layer.layerDocumentId);
assert.equal(
  nestedSiblingIds.indexOf("background-copy-7") + 1,
  nestedSiblingIds.indexOf("background"),
  "the newest duplicate is immediately above the original"
);

interactions.duplicateTimelineItem("suffix-source");
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["suffix-copy-3"].name,
  "plate_3",
  "an existing numeric duplicate suffix advances"
);
assert.deepEqual(
  assembly.project.read().payload.sourceRegistry,
  sourceRegistryBeforeDuplicate
);
assert.equal(
  assembly.scope.enter("nested").ok,
  true
);
const duplicateRowLabels =
  assembly.timeline.readViewProps().rows.map(
    (row) => row.label
  );
assert.ok(
  [
    "background",
    "background_2",
    "background_3",
    "background_7",
    "plate_2",
    "plate_3",
  ].every((label) =>
    duplicateRowLabels.includes(label)
  )
);

const background2BeforeTransform =
  assembly.project.read().payload
    .layerDocumentsById["background-copy-2"];
assert.equal(
  background2BeforeTransform.common.transform.position.x,
  600
);
const transformHistoryBefore =
  owner.state.undoStack.length;
assert.equal(
  assembly.selection.selectLayer(
    "background-copy-2"
  ).ok,
  true
);
const transformDraft = assembly.canvas.pointerMove({
  layerDocumentId: "background-copy-2",
  patch: { position: { x: 700, y: 0 } },
  quality: "original",
});
assert.ok(transformDraft);
const transformCommit = assembly.canvas.pointerUp();
assert.equal(transformCommit.ok, true);
assert.equal(
  owner.state.undoStack.length,
  transformHistoryBefore + 1
);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["background-copy-2"]
    .common.transform.position.x,
  700
);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById.background
    .common.transform.position.x,
  600
);
assert.equal(assembly.project.undo().ok, true);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["background-copy-2"]
    .common.transform.position.x,
  600
);
assert.equal(assembly.project.redo().ok, true);
assert.equal(
  assembly.project.read().payload
    .layerDocumentsById["background-copy-2"]
    .common.transform.position.x,
  700
);
assert.equal(
  assembly.scope.enter("root").ok,
  true
);

const outsideBefore = structuredClone(
  assembly.project.read().payload
    .layerDocumentsById["nested-child"]
);
interactions.setDraggedTimelineItemId("b");
interactions.reorderTimelineItem("a");
const reordered =
  assembly.project.read().payload
    .layerDocumentsById;
const rootSiblingIds = Object.values(reordered)
  .filter(
    (layer) =>
      layer.common.placement
        .parentLayerDocumentId === "root"
  )
  .sort(
    (left, right) =>
      left.common.placement.order -
      right.common.placement.order
  )
  .map((layer) => layer.layerDocumentId);
assert.deepEqual(
  rootSiblingIds,
  ["b", "a", "nested"]
);
assert.deepEqual(
  rootSiblingIds.map(
    (id) =>
      reordered[id].common.placement.order
  ),
  [0, 1, 2],
  "valid reorder output preserves normalized [0..n-1] orders"
);
assert.equal(
  new Set(rootSiblingIds).size,
  rootSiblingIds.length,
  "reorder has no duplicate or lost sibling IDs"
);
assert.deepEqual(
  reordered["nested-child"],
  outsideBefore,
  "reorder leaves Layers outside the active Group unchanged"
);
const invalidOrderProject =
  structuredClone(assembly.project.read());
invalidOrderProject.payload
  .layerDocumentsById.a.common.placement.order = 10;
invalidOrderProject.payload
  .layerDocumentsById.b.common.placement.order = 30;
invalidOrderProject.payload
  .layerDocumentsById.nested.common.placement.order = 90;
const invalidOrderMove =
  buildMoveLayerDocumentTransaction(
    invalidOrderProject,
    {
      layerDocumentId: "b",
      newParentLayerDocumentId: "root",
      newOrder: 0,
    }
  );
assert.equal(invalidOrderMove.ok, false);
if (invalidOrderMove.ok) {
  throw new Error(
    "Non-contiguous Project must be rejected"
  );
}
assert.equal(
  invalidOrderMove.error.code,
  "invalid-before"
);
assert.ok(
  invalidOrderMove.error.validationIssues.some(
    (issue) =>
      issue.code === "invalid-sibling-order"
  )
);

playback.dispose();
console.log(
  "LayerDocument Timeline public keyframe/reorder verification passed"
);
