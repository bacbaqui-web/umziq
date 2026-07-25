import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  buildCreateLayerDocumentTransaction,
  buildDeleteLayerDocumentTransaction,
  buildLayerDocumentGroupScopeReadModel,
  buildLayerDocumentTimelineReadModel,
  buildDuplicateLayerDocumentTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  buildUpdateLayerDocumentDomainTransaction,
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentTransaction,
  type LayerDocumentTransactionResult,
  type LayerSourceReference,
  type SourceRegistryRecord,
} from "@/models";
import {
  createLayerDocumentProjectOwnerState,
  reduceLayerDocumentProjectOwner,
} from "@/engines/project/actions/layerDocumentProjectOwnerReducer";
import {
  createLayerDocumentProjectOwnerLivePort,
} from "@/engines/project/helpers/layerDocumentProjectOwnerLivePortHelpers";
import {
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
} from "@/engines/project/adapters/layerDocumentSourcePreparationAdapter";
import type {
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import type {
  LayerDocumentSourceTransactionResult,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

function common(
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null = null
): LayerDocumentCommon {
  return {
    source,
    transform: {
      position: { x: order * 10, y: order * 20 },
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
      durationFrames: 120,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [],
      scaleKeyframes: [],
      rotationKeyframes: [],
      opacityKeyframes: [],
      enabledProperties: {
        position: false,
        scale: false,
        rotation: false,
        opacity: false,
      },
    },
    effects: [],
    modifiers: [],
  };
}

function sourceRegistry(): Record<string, SourceRegistryRecord> {
  const normal = {
    status: "normal" as const,
    reconnectHint: null,
  };
  return {
    "source-document": {
      sourceId: "source-document",
      kind: "psd-document",
      displayName: "owner.psd",
      path: "owner.psd",
      fingerprint: "document-v1",
      version: 1,
      availability: "available",
      refresh: normal,
      data: {
        fileName: "owner.psd",
        importSettings: {
          compositionName: "Owner",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "source-node": {
      sourceId: "source-node",
      kind: "psd-node",
      displayName: "Owner Pixel",
      path: "owner.psd/Pixel",
      fingerprint: "node-v1",
      version: 1,
      availability: "available",
      refresh: normal,
      data: {
        documentSourceId: "source-document",
        sourceKey: "layer:owner-pixel",
        sourcePath: "owner.psd/Pixel",
        nativeVisible: true,
      },
    },
    "unused-source": {
      sourceId: "unused-source",
      kind: "unknown",
      displayName: "Unused",
      path: null,
      fingerprint: "unused-v1",
      version: 1,
      availability: "available",
      refresh: normal,
      data: {
        originalKind: "fixture",
        rawData: { owner: true },
      },
    },
  };
}

function projectFixture(): LayerDocumentProject {
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Root",
      revision: 0,
      type: "group",
      common: common(null, 0),
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    group: {
      layerDocumentId: "group",
      name: "Composition Group",
      revision: 2,
      type: "group",
      common: common(
        "root",
        0,
        { sourceId: "source-document" }
      ),
      data: {
        role: "composition",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    "group-child": {
      layerDocumentId: "group-child",
      name: "Nested Drawing",
      revision: 1,
      type: "drawing",
      common: common("group", 0),
      data: {
        documentVersion: 1,
        elements: [{ kind: "nested" }],
      },
    },
    drawing: {
      layerDocumentId: "drawing",
      name: "Drawing",
      revision: 3,
      type: "drawing",
      common: common("root", 1),
      data: {
        documentVersion: 1,
        elements: [{ kind: "stroke", width: 4 }],
      },
    },
    text: {
      layerDocumentId: "text",
      name: "Text",
      revision: 4,
      type: "text",
      common: common("root", 2),
      data: {
        text: "OWNER",
        style: {
          fontFamily: "sans-serif",
          fontSize: 48,
          color: "#ffffff",
        },
      },
    },
    psd: {
      layerDocumentId: "psd",
      name: "PSD",
      revision: 5,
      type: "psd",
      common: common(
        "root",
        3,
        { sourceId: "source-node" }
      ),
      data: {},
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "owner-fixture",
      name: "Owner fixture",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: {
        sourcesById: sourceRegistry(),
      },
    },
  };
}

function layerTransaction(
  result: LayerDocumentTransactionResult
): LayerDocumentTransaction {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);
  return result.transaction;
}

function sourceTransaction(
  result: LayerDocumentSourceTransactionResult
) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);
  return result.transaction;
}

function initialize(options?: {
  project?: LayerDocumentProject;
  layerDocumentId?: string | null;
  sourceId?: string | null;
  currentFrame?: number;
  range?: { startFrame: number; endFrame: number };
  activeGroupLayerDocumentId?: string | null;
}): LayerDocumentProjectOwnerState {
  const initialized = createLayerDocumentProjectOwnerState({
    project: options?.project ?? projectFixture(),
    layerSelection: options?.layerDocumentId === null
      ? null
      : {
          kind: "layer-document",
          layerDocumentId: options?.layerDocumentId ?? "drawing",
        },
    sourceSelection: options?.sourceId === null
      ? null
      : {
          kind: "psd-tree-source",
          sourceId: options?.sourceId ?? "source-node",
        },
    ...(options?.activeGroupLayerDocumentId
      ? {
          activeGroupLayerDocumentId:
            options.activeGroupLayerDocumentId,
        }
      : {}),
    playback: {
      currentFrame: options?.currentFrame ?? 25,
      range: options?.range ?? {
        startFrame: 10,
        endFrame: 90,
      },
    },
  });
  assert.equal(initialized.ok, true);
  if (!initialized.ok) throw new Error(initialized.error.message);
  return initialized.state;
}

function transition(
  state: LayerDocumentProjectOwnerState,
  action: LayerDocumentProjectOwnerAction
): Extract<LayerDocumentProjectOwnerTransitionResult, { ok: true }> {
  const result = reduceLayerDocumentProjectOwner(state, action);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function commitLayer(
  state: LayerDocumentProjectOwnerState,
  transaction: LayerDocumentTransaction
) {
  const result = transition(state, {
    kind: "commit-layer-transaction",
    transaction,
  });
  assert.equal(result.changed, true);
  assert.equal(result.state.undoStack.length, state.undoStack.length + 1);
  assert.equal(result.state.redoStack.length, 0);
  assert.equal(result.state.canUndo, true);
  assert.equal(result.state.canRedo, false);
  assert.equal(result.effect.clearDraft, true);
  assert.equal(result.effect.recomputeRender, true);
  assert.equal(result.effect.runtimeCachePolicy, "preserve");
  assert.deepEqual(result.effect.cacheInvalidations, []);
  assert.deepEqual(
    result.state.currentProject,
    transaction.after
  );
  assert.notStrictEqual(
    result.state.currentProject,
    transaction.after
  );
  assert.equal(result.state.undoStack.at(-1)?.origin, "layer-transaction");
  assert.equal(findNonPlainDataPath(result.state.undoStack.at(-1)), null);
  return result;
}

const inputProject = projectFixture();
const inputSnapshot = structuredClone(inputProject);
const initial = initialize({ project: inputProject });
assert.notStrictEqual(initial.currentProject, inputProject);
assert.deepEqual(initial.currentProject, inputProject);
assert.deepEqual(inputProject, inputSnapshot);
assert.deepEqual(validateLayerDocumentProject(initial.currentProject), []);
assert.deepEqual(initial.session.layerSelection, {
  kind: "layer-document",
  layerDocumentId: "drawing",
});
assert.deepEqual(initial.session.sourceSelection, {
  kind: "psd-tree-source",
  sourceId: "source-node",
});
assert.deepEqual(initial.session.playback, {
  currentFrame: 25,
  range: { startFrame: 10, endFrame: 90 },
});
assert.deepEqual(initial.runtimeSession, {
  selectedTransformKeyframe: null,
});
const sourceSelectionOnly = transition(
  initial,
  {
    kind: "set-source-selection",
    selection: {
      kind: "psd-tree-source",
      sourceId: "source-document",
    },
  }
);
assert.equal(
  sourceSelectionOnly.effect.clearDraft,
  false
);
assert.equal(
  sourceSelectionOnly.effect.recomputeRender,
  false
);
assert.equal(
  sourceSelectionOnly.effect.resetLocalUi,
  false
);
const playbackFrameOnly = transition(
  sourceSelectionOnly.state,
  {
    kind: "set-playback-session",
    playback: {
      ...sourceSelectionOnly.state.session.playback,
      currentFrame: 26,
    },
  }
);
assert.equal(playbackFrameOnly.effect.clearDraft, true);
assert.equal(playbackFrameOnly.effect.resetLocalUi, false);
assert.strictEqual(
  sourceSelectionOnly.state.currentProject,
  initial.currentProject
);

const keyframeProject = projectFixture();
const keyframeDrawing =
  keyframeProject.payload.layerDocumentsById.drawing;
keyframeDrawing.common.animation = {
  ...keyframeDrawing.common.animation,
  positionKeyframes: [{
    frame: 3,
    value: { x: 30, y: 40 },
  }],
  enabledProperties: {
    ...keyframeDrawing.common.animation.enabledProperties,
    position: true,
  },
};
const keyframeInitial = initialize({
  project: keyframeProject,
  layerDocumentId: "drawing",
});
const keyframeSelected = transition(
  keyframeInitial,
  {
    kind: "set-transform-keyframe-selection",
    selection: {
      layerDocumentId: "drawing",
      property: "position",
      localFrame: 3,
      globalFrame: 3,
    },
  }
);
assert.deepEqual(
  keyframeSelected.state.runtimeSession
    .selectedTransformKeyframe,
  {
    layerDocumentId: "drawing",
    property: "position",
    localFrame: 3,
    globalFrame: 3,
  }
);
assert.equal(
  keyframeSelected.state.undoStack.length,
  keyframeInitial.undoStack.length
);
const mismatchedLayerSelection = transition(
  keyframeSelected.state,
  {
    kind: "set-layer-selection",
    selection: {
      kind: "layer-document",
      layerDocumentId: "text",
    },
  }
);
assert.equal(
  mismatchedLayerSelection.effect.resetLocalUi,
  true
);
assert.equal(
  mismatchedLayerSelection.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
const changedActiveGroup = transition(
  keyframeSelected.state,
  {
    kind: "set-active-group",
    layerDocumentId: "group",
  }
);
assert.equal(
  changedActiveGroup.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
const keyframeLayerDeleted = commitLayer(
  keyframeSelected.state,
  layerTransaction(
    buildDeleteLayerDocumentTransaction(
      keyframeSelected.state.currentProject,
      { layerDocumentId: "drawing" }
    )
  )
);
assert.equal(
  keyframeLayerDeleted.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
const keyframeLayerDeleteUndone = transition(
  keyframeLayerDeleted.state,
  { kind: "undo" }
);
assert.equal(
  keyframeLayerDeleteUndone.state.runtimeSession
    .selectedTransformKeyframe,
  null
);

const keyframeAbsentInitial = initialize({
  layerDocumentId: "drawing",
});
const absentDrawing =
  keyframeAbsentInitial.currentProject.payload
    .layerDocumentsById.drawing;
const addKeyframeTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    keyframeAbsentInitial.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "set-animation",
        animation: {
          ...absentDrawing.common.animation,
          positionKeyframes: [{
            frame: 4,
            value: { x: 44, y: 55 },
          }],
          enabledProperties: {
            ...absentDrawing.common.animation
              .enabledProperties,
            position: true,
          },
        },
      },
    }
  )
);
const keyframeAdded = commitLayer(
  keyframeAbsentInitial,
  addKeyframeTransaction
);
const addedKeyframeSelected = transition(
  keyframeAdded.state,
  {
    kind: "set-transform-keyframe-selection",
    selection: {
      layerDocumentId: "drawing",
      property: "position",
      localFrame: 4,
      globalFrame: 4,
    },
  }
);
const keyframeAddUndone = transition(
  addedKeyframeSelected.state,
  { kind: "undo" }
);
assert.equal(
  keyframeAddUndone.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
const keyframeAddRedone = transition(
  keyframeAddUndone.state,
  { kind: "redo" }
);
assert.equal(
  keyframeAddRedone.state.runtimeSession
    .selectedTransformKeyframe,
  null
);

const timingSelectionProject = projectFixture();
const timingSelectionDrawing =
  timingSelectionProject.payload
    .layerDocumentsById.drawing;
timingSelectionDrawing.common.animation = {
  ...timingSelectionDrawing.common.animation,
  positionKeyframes: [{
    frame: 4,
    value: { x: 70, y: 80 },
  }],
  enabledProperties: {
    ...timingSelectionDrawing.common.animation
      .enabledProperties,
    position: true,
  },
};
timingSelectionDrawing.common.placement.startFrame = 10;
timingSelectionDrawing.common.placement.sourceOffsetFrames = 2;
const timingSelectionInitial = initialize({
  project: timingSelectionProject,
  layerDocumentId: "drawing",
});
const timingSelectionSelected = transition(
  timingSelectionInitial,
  {
    kind: "set-transform-keyframe-selection",
    selection: {
      layerDocumentId: "drawing",
      property: "position",
      localFrame: 4,
      globalFrame: 999,
    },
  }
);
assert.equal(
  timingSelectionSelected.state.runtimeSession
    .selectedTransformKeyframe?.globalFrame,
  12
);
const timingSelectionTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    timingSelectionSelected.state.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "set-placement-timing",
        startFrame: 20,
        durationFrames: 120,
        sourceOffsetFrames: 5,
      },
    }
  )
);
const timingSelectionCommitted = commitLayer(
  timingSelectionSelected.state,
  timingSelectionTransaction
);
assert.equal(
  timingSelectionCommitted.state.runtimeSession
    .selectedTransformKeyframe?.globalFrame,
  19
);
const timingSelectionUndone = transition(
  timingSelectionCommitted.state,
  { kind: "undo" }
);
assert.equal(
  timingSelectionUndone.state.runtimeSession
    .selectedTransformKeyframe?.globalFrame,
  12
);
const timingSelectionRedone = transition(
  timingSelectionUndone.state,
  { kind: "redo" }
);
assert.equal(
  timingSelectionRedone.state.runtimeSession
    .selectedTransformKeyframe?.globalFrame,
  19
);
assert.equal(initial.canUndo, false);
assert.equal(initial.canRedo, false);
assert.equal(findNonPlainDataPath(initial), null);

const scopedProject = projectFixture();
const scopedGroup =
  scopedProject.payload.layerDocumentsById.group;
const scopedChild =
  scopedProject.payload.layerDocumentsById["group-child"];
assert.equal(scopedGroup.type, "group");
if (scopedGroup.type !== "group") throw new Error("group fixture");
scopedGroup.data.durationFrames = 24;
scopedGroup.common.placement.durationFrames = 24;
scopedChild.common.placement.durationFrames = 24;
const scopedInitial = initialize({
  project: scopedProject,
  activeGroupLayerDocumentId: "group",
  layerDocumentId: "drawing",
  currentFrame: 80,
  range: { startFrame: 10, endFrame: 90 },
});
assert.equal(
  scopedInitial.session.activeGroupLayerDocumentId,
  "group"
);
assert.equal(
  scopedInitial.session.layerSelection?.layerDocumentId,
  "drawing",
  "Layer selection is independent from active Group navigation"
);
assert.deepEqual(scopedInitial.session.playback, {
  currentFrame: 23,
  range: { startFrame: 10, endFrame: 24 },
});
const groupScope = buildLayerDocumentGroupScopeReadModel(
  scopedInitial.currentProject,
  scopedInitial.session.activeGroupLayerDocumentId
);
assert.equal(groupScope.ok, true);
if (!groupScope.ok) throw new Error(groupScope.reason);
assert.deepEqual(
  groupScope.model.breadcrumb.map(
    (segment) => segment.layerDocumentId
  ),
  ["root", "group"]
);
const scopedTimeline = buildLayerDocumentTimelineReadModel(
  scopedInitial.currentProject,
  "exclude",
  scopedInitial.session.activeGroupLayerDocumentId
);
assert.equal(scopedTimeline.ok, true);
if (!scopedTimeline.ok) throw new Error("scoped Timeline");
assert.deepEqual(
  scopedTimeline.model.rows.map((row) => row.layerDocumentId),
  ["group-child"]
);
const scopedSelectionChanged = transition(scopedInitial, {
  kind: "set-layer-selection",
  selection: {
    kind: "layer-document",
    layerDocumentId: "psd",
  },
});
assert.equal(
  scopedSelectionChanged.state.session.activeGroupLayerDocumentId,
  "group"
);
const invalidScope = reduceLayerDocumentProjectOwner(
  scopedSelectionChanged.state,
  {
    kind: "set-active-group",
    layerDocumentId: "drawing",
  }
);
assert.equal(invalidScope.ok, false);
const deleteScopedGroup = layerTransaction(
  buildDeleteLayerDocumentTransaction(
    scopedSelectionChanged.state.currentProject,
    { layerDocumentId: "group" }
  )
);
const scopedDeleted = commitLayer(
  scopedSelectionChanged.state,
  deleteScopedGroup
);
assert.equal(
  scopedDeleted.state.session.activeGroupLayerDocumentId,
  "root",
  "Deleted active Group normalizes to project-root"
);
const scopedUndo = transition(scopedDeleted.state, { kind: "undo" });
assert.equal(
  scopedUndo.state.session.activeGroupLayerDocumentId,
  "group",
  "Undo restores active Group with its Project snapshot"
);
assert.deepEqual(scopedUndo.state.session.playback, {
  currentFrame: 23,
  range: { startFrame: 10, endFrame: 24 },
});
const staleGroupInitialized =
  createLayerDocumentProjectOwnerState({
    project: projectFixture(),
    activeGroupLayerDocumentId: "deleted-group",
  });
assert.equal(staleGroupInitialized.ok, true);
if (!staleGroupInitialized.ok) {
  throw new Error(staleGroupInitialized.error.message);
}
assert.equal(
  staleGroupInitialized.state.session.activeGroupLayerDocumentId,
  "root"
);

const liveStateRef = { current: initialize() };
const livePort = createLayerDocumentProjectOwnerLivePort(
  liveStateRef,
  (action) => {
    const result = reduceLayerDocumentProjectOwner(
      liveStateRef.current,
      action
    );
    if (result.ok && result.changed) {
      liveStateRef.current = result.state;
    }
    return result;
  }
);
assert.equal(
  typeof Object.getOwnPropertyDescriptor(livePort, "state")?.get,
  "function"
);
const liveFirstProject = livePort.state.currentProject;
const liveFirstTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(liveFirstProject, {
    layerDocumentId: "drawing",
    update: {
      kind: "set-visibility",
      visible: false,
    },
  })
);
const liveFirstResult = livePort.transition({
  kind: "commit-layer-transaction",
  transaction: liveFirstTransaction,
});
assert.equal(liveFirstResult.ok, true);
assert.notStrictEqual(
  livePort.state.currentProject,
  liveFirstProject
);
assert.equal(
  livePort.state.currentProject.payload.layerDocumentsById.drawing
    .common.placement.visible,
  false
);
const liveSecondTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    livePort.state.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "set-alias",
        alias: "same-turn-latest-state",
      },
    }
  )
);
const liveSecondResult = livePort.transition({
  kind: "commit-layer-transaction",
  transaction: liveSecondTransaction,
});
assert.equal(liveSecondResult.ok, true);
assert.equal(
  livePort.state.currentProject.payload.layerDocumentsById.drawing
    .common.placement.alias,
  "same-turn-latest-state"
);
assert.equal(livePort.state.undoStack.length, 2);

const createdLayer: LayerDocument = {
  layerDocumentId: "shape-created",
  name: "Created Shape",
  revision: 99,
  type: "shape",
  common: common("root", 2),
  data: {
    documentVersion: 1,
    shapes: [{ kind: "rectangle" }],
  },
};
const createTransaction = layerTransaction(
  buildCreateLayerDocumentTransaction(initial.currentProject, {
    layer: createdLayer,
  })
);
const created = commitLayer(initial, createTransaction);
assert.ok(
  created.state.currentProject.payload.layerDocumentsById[
    "shape-created"
  ]
);
assert.deepEqual(created.state.session.layerSelection, {
  kind: "layer-document",
  layerDocumentId: "shape-created",
});

const deleteInitial = initialize({ layerDocumentId: "text" });
const deleteTransaction = layerTransaction(
  buildDeleteLayerDocumentTransaction(deleteInitial.currentProject, {
    layerDocumentId: "text",
  })
);
const deleted = commitLayer(deleteInitial, deleteTransaction);
assert.equal(
  deleted.state.currentProject.payload.layerDocumentsById.text,
  undefined
);
assert.equal(deleted.state.session.layerSelection, null);
const deleteUndone = transition(deleted.state, { kind: "undo" });
assert.ok(
  deleteUndone.state.currentProject.payload.layerDocumentsById.text
);
assert.equal(
  deleteUndone.state.session.layerSelection?.layerDocumentId,
  "text"
);
const deleteRedone = transition(deleteUndone.state, { kind: "redo" });
assert.equal(
  deleteRedone.state.currentProject.payload.layerDocumentsById.text,
  undefined
);

const duplicateInitial = initialize({ layerDocumentId: "group" });
const duplicateTransaction = layerTransaction(
  buildDuplicateLayerDocumentTransaction(
    duplicateInitial.currentProject,
    {
      layerDocumentId: "group",
      newLayerDocumentId: "group-copy",
    }
  )
);
const duplicated = commitLayer(
  duplicateInitial,
  duplicateTransaction
);
assert.equal(duplicated.state.undoStack.length, 1);
assert.equal(
  Object.keys(
    duplicated.state.currentProject.payload.layerDocumentsById
  ).length,
  Object.keys(
    duplicateInitial.currentProject.payload.layerDocumentsById
  ).length + 2
);
const undoDuplicate = transition(duplicated.state, { kind: "undo" });
assert.deepEqual(
  undoDuplicate.state.currentProject,
  duplicateInitial.currentProject
);
assert.deepEqual(
  undoDuplicate.state.session,
  duplicateInitial.session
);
assert.equal(undoDuplicate.state.canRedo, true);
assert.equal(undoDuplicate.effect.clearDraft, true);
assert.equal(
  undoDuplicate.effect.runtimeCachePolicy,
  "preserve"
);
const redoDuplicate = transition(
  undoDuplicate.state,
  { kind: "redo" }
);
assert.deepEqual(
  redoDuplicate.state.currentProject,
  duplicateTransaction.after
);
assert.deepEqual(
  redoDuplicate.state.session,
  duplicated.state.session
);

const transformInitial = initialize();
const drawing =
  transformInitial.currentProject.payload.layerDocumentsById.drawing;
const transformTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    transformInitial.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "set-transform",
        transform: {
          ...drawing.common.transform,
          position: { x: 321, y: 654 },
        },
      },
    }
  )
);
const transformed = commitLayer(
  transformInitial,
  transformTransaction
);
assert.deepEqual(
  transformed.state.currentProject.payload.layerDocumentsById.drawing
    .common.transform.position,
  { x: 321, y: 654 }
);
const transformUndone = transition(
  transformed.state,
  { kind: "undo" }
);
assert.deepEqual(
  transformUndone.state.currentProject.payload.layerDocumentsById
    .drawing.common.transform.position,
  drawing.common.transform.position
);
const transformRedone = transition(
  transformUndone.state,
  { kind: "redo" }
);
assert.deepEqual(
  transformRedone.state.currentProject.payload.layerDocumentsById
    .drawing.common.transform.position,
  { x: 321, y: 654 }
);

const domainInitial = initialize();
const domainTransaction = layerTransaction(
  buildUpdateLayerDocumentDomainTransaction(
    domainInitial.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "replace-drawing-document",
        data: {
          documentVersion: 2,
          elements: [{ kind: "owner-domain-update" }],
        },
      },
    }
  )
);
const domainUpdated = commitLayer(domainInitial, domainTransaction);
assert.equal(
  domainUpdated.state.currentProject.payload.layerDocumentsById.drawing
    .data.documentVersion,
  2
);

const playbackInitial = initialize({
  layerDocumentId: "root",
  currentFrame: 110,
  range: { startFrame: 100, endFrame: 120 },
});
const playbackTransaction = layerTransaction(
  buildUpdateLayerDocumentDomainTransaction(
    playbackInitial.currentProject,
    {
      layerDocumentId: "root",
      update: {
        kind: "set-group-composition-metadata",
        data: {
          width: 1080,
          height: 1920,
          frameRate: 30,
          durationFrames: 60,
        },
      },
    }
  )
);
const playbackCommitted = commitLayer(
  playbackInitial,
  playbackTransaction
);
assert.deepEqual(playbackCommitted.state.session.playback, {
  currentFrame: 59,
  range: { startFrame: 59, endFrame: 60 },
});
const playbackUndone = transition(
  playbackCommitted.state,
  { kind: "undo" }
);
assert.deepEqual(
  playbackUndone.state.session.playback,
  playbackInitial.session.playback
);
const playbackRedone = transition(
  playbackUndone.state,
  { kind: "redo" }
);
assert.deepEqual(playbackRedone.state.session.playback, {
  currentFrame: 59,
  range: { startFrame: 59, endFrame: 60 },
});

const branchInitial = initialize();
const branchCreate = commitLayer(
  branchInitial,
  layerTransaction(
    buildCreateLayerDocumentTransaction(branchInitial.currentProject, {
      layer: createdLayer,
    })
  )
);
const branchUndo = transition(branchCreate.state, { kind: "undo" });
assert.equal(branchUndo.state.canRedo, true);
const branchTransform = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    branchUndo.state.currentProject,
    {
      layerDocumentId: "drawing",
      update: {
        kind: "set-visibility",
        visible: false,
      },
    }
  )
);
const newBranch = commitLayer(branchUndo.state, branchTransform);
assert.equal(newBranch.state.redoStack.length, 0);
assert.equal(newBranch.state.canRedo, false);

const importInitial = initialize({ sourceId: null });
const importedDocument: SourceRegistryRecord = {
  sourceId: "imported-document",
  kind: "psd-document",
  displayName: "imported.psd",
  path: "imported.psd",
  fingerprint: "imported-document-v1",
  version: 1,
  availability: "available",
  refresh: {
    status: "normal",
    reconnectHint: null,
  },
  data: {
    fileName: "imported.psd",
    importSettings: {
      compositionName: "Imported",
      hiddenLayerMode: "preserve",
    },
  },
};
const importedNode: SourceRegistryRecord = {
  sourceId: "imported-node",
  kind: "psd-node",
  displayName: "Imported Node",
  path: "imported.psd/Node",
  fingerprint: "imported-node-v1",
  version: 1,
  availability: "available",
  refresh: {
    status: "normal",
    reconnectHint: null,
  },
  data: {
    documentSourceId: "imported-document",
    sourceKey: "layer:imported",
    sourcePath: "imported.psd/Node",
    nativeVisible: true,
  },
};
const importTransaction = sourceTransaction(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(
    importInitial.currentProject,
    {
      sources: [importedDocument, importedNode],
      layers: [],
      selectSourceId: "imported-node",
      selectLayerDocumentId: null,
    }
  )
);
const imported = transition(importInitial, {
  kind: "commit-source-transaction",
  transaction: importTransaction,
});
assert.equal(imported.state.undoStack.length, 1);
assert.equal(imported.state.undoStack[0].origin, "source-transaction");
assert.deepEqual(imported.state.session.sourceSelection, {
  kind: "psd-tree-source",
  sourceId: "imported-node",
});
assert.ok(
  imported.state.currentProject.payload.sourceRegistry.sourcesById[
    "imported-node"
  ]
);
assert.equal(imported.effect.clearDraft, true);
assert.equal(imported.effect.recomputeRender, true);
assert.equal(imported.effect.runtimeCachePolicy, "preserve");
const importUndone = transition(imported.state, { kind: "undo" });
assert.equal(
  importUndone.state.currentProject.payload.sourceRegistry.sourcesById[
    "imported-node"
  ],
  undefined
);
assert.equal(importUndone.state.session.sourceSelection, null);
const importRedone = transition(importUndone.state, { kind: "redo" });
assert.ok(
  importRedone.state.currentProject.payload.sourceRegistry.sourcesById[
    "imported-node"
  ]
);
assert.equal(
  importRedone.state.session.sourceSelection?.sourceId,
  "imported-node"
);
const unreferencedImportedSource =
  importRedone.state.currentProject.payload
    .sourceRegistry.sourcesById[
      "imported-node"
    ];
assert.equal(
  unreferencedImportedSource.kind,
  "psd-node"
);
const unreferencedRefresh = transition(
  importRedone.state,
  {
    kind: "commit-source-transaction",
    transaction: sourceTransaction(
      LAYER_DOCUMENT_SOURCE_PREPARATION_PORT
        .commands.prepareRefresh(
          importRedone.state.currentProject,
          {
            source: {
              ...unreferencedImportedSource,
              fingerprint: "imported-node-v2",
              version:
                unreferencedImportedSource.version +
                1,
            },
            cacheContext: {
              globalFrame: 0,
              localFrameByLayerDocumentId: {},
              quality: "preview",
            },
          }
        )
    ),
  }
);
assert.deepEqual(
  unreferencedRefresh.effect.cacheInvalidations,
  []
);
assert.equal(
  unreferencedRefresh.effect.runtimeCachePolicy,
  "apply-source-invalidations"
);
assert.deepEqual(
  unreferencedRefresh.effect.sourceDisposalIds,
  ["imported-node"]
);

const sourceDeleteInitial = initialize({ sourceId: "unused-source" });
const sourceDeleteTransaction = sourceTransaction(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareDelete(
    sourceDeleteInitial.currentProject,
    { sourceId: "unused-source" }
  )
);
const sourceDeleted = transition(sourceDeleteInitial, {
  kind: "commit-source-transaction",
  transaction: sourceDeleteTransaction,
});
assert.equal(sourceDeleted.state.undoStack.length, 1);
assert.equal(
  sourceDeleted.effect.runtimeCachePolicy,
  "apply-source-invalidations"
);
assert.deepEqual(
  sourceDeleted.effect.sourceInvalidationIds,
  ["unused-source"]
);
assert.equal(sourceDeleted.state.session.sourceSelection, null);
assert.equal(
  sourceDeleted.state.currentProject.payload.sourceRegistry.sourcesById[
    "unused-source"
  ],
  undefined
);
const sourceDeleteUndone = transition(
  sourceDeleted.state,
  { kind: "undo" }
);
assert.deepEqual(
  sourceDeleteUndone.effect.sourceInvalidationIds,
  []
);
assert.deepEqual(
  sourceDeleteUndone.effect.sourceRestorationIds,
  ["unused-source"]
);
assert.ok(
  sourceDeleteUndone.state.currentProject.payload.sourceRegistry
    .sourcesById["unused-source"]
);
assert.equal(
  sourceDeleteUndone.state.session.sourceSelection?.sourceId,
  "unused-source"
);
const sourceDeleteRedone = transition(
  sourceDeleteUndone.state,
  { kind: "redo" }
);
assert.deepEqual(
  sourceDeleteRedone.effect.sourceInvalidationIds,
  ["unused-source"]
);
assert.equal(sourceDeleteRedone.state.session.sourceSelection, null);

const refreshSeedInitial = initialize();
const refreshHistorySeed = commitLayer(
  refreshSeedInitial,
  layerTransaction(
    buildUpdateLayerDocumentCommonTransaction(
      refreshSeedInitial.currentProject,
      {
        layerDocumentId: "drawing",
        update: {
          kind: "set-visibility",
          visible: false,
        },
      }
    )
  )
);
const refreshSource =
  refreshHistorySeed.state.currentProject.payload.sourceRegistry
    .sourcesById["source-node"];
assert.equal(refreshSource.kind, "psd-node");
if (refreshSource.kind !== "psd-node") {
  throw new Error("Invalid refresh owner fixture");
}
const refreshTransaction = sourceTransaction(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareRefresh(
    refreshHistorySeed.state.currentProject,
    {
      source: {
        ...refreshSource,
        fingerprint: "node-v2",
        version: refreshSource.version + 1,
        refresh: {
          status: "updated",
          reconnectHint: null,
        },
        data: {
          ...refreshSource.data,
          nativeVisible: false,
        },
      },
      cacheContext: {
        globalFrame: 25,
        localFrameByLayerDocumentId: { psd: 25 },
        quality: "preview",
      },
    }
  )
);
const refreshed = transition(refreshHistorySeed.state, {
  kind: "commit-source-transaction",
  transaction: refreshTransaction,
});
assert.equal(refreshed.state.undoStack.length, 0);
assert.equal(refreshed.state.redoStack.length, 0);
assert.equal(refreshed.state.canUndo, false);
assert.equal(refreshed.state.canRedo, false);
assert.equal(refreshed.effect.clearDraft, true);
assert.equal(refreshed.effect.recomputeRender, true);
assert.equal(
  refreshed.effect.runtimeCachePolicy,
  "apply-source-invalidations"
);
assert.equal(refreshed.effect.cacheInvalidations.length, 1);
assert.equal(
  refreshed.effect.cacheInvalidations[0].layerDocumentId,
  "psd"
);
assert.notEqual(
  refreshed.effect.cacheInvalidations[0]
    .sourceResourceCacheKeyBefore,
  refreshed.effect.cacheInvalidations[0]
    .sourceResourceCacheKeyAfter
);
assert.equal(
  JSON.stringify(refreshed.state).includes("cacheInvalidations"),
  false
);

const staleInitial = initialize();
const staleTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    staleInitial.currentProject,
    {
      layerDocumentId: "drawing",
      update: { kind: "set-visibility", visible: false },
    }
  )
);
const currentTransaction = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    staleInitial.currentProject,
    {
      layerDocumentId: "text",
      update: { kind: "set-visibility", visible: false },
    }
  )
);
const currentCommitted = commitLayer(
  staleInitial,
  currentTransaction
);
const currentSnapshot = structuredClone(currentCommitted.state);
const staleRejected = reduceLayerDocumentProjectOwner(
  currentCommitted.state,
  {
    kind: "commit-layer-transaction",
    transaction: staleTransaction,
  }
);
assert.equal(staleRejected.ok, false);
if (!staleRejected.ok) {
  assert.equal(staleRejected.error.code, "stale-transaction");
  assert.strictEqual(staleRejected.state, currentCommitted.state);
}
assert.deepEqual(currentCommitted.state, currentSnapshot);

const invalidInitial = initialize();
const validForForgery = layerTransaction(
  buildUpdateLayerDocumentCommonTransaction(
    invalidInitial.currentProject,
    {
      layerDocumentId: "drawing",
      update: { kind: "set-visibility", visible: false },
    }
  )
);
const invalidAfterProject = structuredClone(validForForgery.after);
delete invalidAfterProject.payload.layerDocumentsById.root;
const invalidAfter = reduceLayerDocumentProjectOwner(
  invalidInitial,
  {
    kind: "commit-layer-transaction",
    transaction: {
      ...validForForgery,
      after: invalidAfterProject,
    },
  }
);
assert.equal(invalidAfter.ok, false);
if (!invalidAfter.ok) {
  assert.equal(invalidAfter.error.code, "invalid-after");
  assert.strictEqual(invalidAfter.state, invalidInitial);
}
const nonPlainAfter = {
  ...structuredClone(validForForgery.after),
  runtimeLeak: new Map([["forbidden", true]]),
} as unknown as LayerDocumentProject;
const nonPlainRejected = reduceLayerDocumentProjectOwner(
  invalidInitial,
  {
    kind: "commit-layer-transaction",
    transaction: {
      ...validForForgery,
      after: nonPlainAfter,
    },
  }
);
assert.equal(nonPlainRejected.ok, false);
if (!nonPlainRejected.ok) {
  assert.equal(nonPlainRejected.error.code, "non-plain-data");
  assert.strictEqual(nonPlainRejected.state, invalidInitial);
}
const noChangeRejected = reduceLayerDocumentProjectOwner(
  invalidInitial,
  {
    kind: "commit-layer-transaction",
    transaction: {
      ...validForForgery,
      after: invalidInitial.currentProject,
    },
  }
);
assert.equal(noChangeRejected.ok, false);
if (!noChangeRejected.ok) {
  assert.equal(noChangeRejected.error.code, "no-change");
}
const mismatchedHistoryRejected = reduceLayerDocumentProjectOwner(
  invalidInitial,
  {
    kind: "commit-layer-transaction",
    transaction: {
      ...validForForgery,
      historyEntry: {
        ...validForForgery.historyEntry,
        affectedLayerDocumentIds: ["text"],
      },
    },
  }
);
assert.equal(mismatchedHistoryRejected.ok, false);
if (!mismatchedHistoryRejected.ok) {
  assert.equal(
    mismatchedHistoryRejected.error.code,
    "invalid-transaction"
  );
}
assert.deepEqual(validateLayerDocumentProject(
  invalidInitial.currentProject
), []);

const emptyUndo = reduceLayerDocumentProjectOwner(
  initialize(),
  { kind: "undo" }
);
assert.equal(emptyUndo.ok, false);
if (!emptyUndo.ok) assert.equal(emptyUndo.error.code, "undo-empty");
const emptyRedo = reduceLayerDocumentProjectOwner(
  initialize(),
  { kind: "redo" }
);
assert.equal(emptyRedo.ok, false);
if (!emptyRedo.ok) assert.equal(emptyRedo.error.code, "redo-empty");

const staleSelectionInitial = initialize({
  layerDocumentId: "does-not-exist",
  sourceId: "missing-source",
  currentFrame: 999,
  range: { startFrame: 998, endFrame: 999 },
});
assert.equal(staleSelectionInitial.session.layerSelection, null);
assert.equal(staleSelectionInitial.session.sourceSelection, null);
assert.deepEqual(staleSelectionInitial.session.playback, {
  currentFrame: 119,
  range: { startFrame: 119, endFrame: 120 },
});
const invalidPlaybackInitialization =
  createLayerDocumentProjectOwnerState({
    project: projectFixture(),
    playback: {
      currentFrame: Number.NaN,
      range: { startFrame: 0, endFrame: 10 },
    },
  });
assert.equal(invalidPlaybackInitialization.ok, false);

const historyState = importRedone.state;
assert.deepEqual(
  Object.keys(historyState).sort(),
  [
    "canRedo",
    "canUndo",
    "currentProject",
    "redoStack",
    "runtimeSession",
    "session",
    "undoStack",
  ]
);
assert.equal(findNonPlainDataPath(historyState), null);
assert.deepEqual(historyState.runtimeSession, {
  selectedTransformKeyframe: null,
});
const serializedHistory = JSON.stringify(historyState.undoStack);
assert.doesNotMatch(
  serializedHistory,
  /cacheInvalidations|clearDraft|recomputeRender|FileHandle|ImageBitmap|Canvas|decoder|renderResult|runtimeSession|selectedTransformKeyframe/
);
assert.equal(
  Object.hasOwn(historyState, "cacheInvalidations"),
  false
);

const taskFiles = [
  "src/engines/project/models/layerDocumentProjectOwnerModel.ts",
  "src/engines/project/helpers/layerDocumentProjectOwnerHelpers.ts",
  "src/engines/project/helpers/layerDocumentProjectOwnerLivePortHelpers.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerLayerCommitReducer.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerSourceCommitReducer.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerHistoryReducer.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerRuntimeSessionReducer.ts",
  "src/engines/project/actions/layerDocumentProjectOwnerReducer.ts",
  "src/engines/project/useLayerDocumentProjectOwner.ts",
];
taskFiles.forEach((path) => {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    /@\/editor|@\/features|ProjectSourceDomainPort|LegacySession|useProjectSourceSession/
  );
  assert.doesNotMatch(
    source,
    /\bFileSystemFileHandle\b|\bImageBitmap\b|\bHTMLCanvasElement\b/
  );
  assert.doesNotMatch(source, /\bFacade\b/);
});
assert.ok(
  readFileSync(
    "src/engines/project/actions/layerDocumentProjectOwnerReducer.ts",
    "utf8"
  ).split("\n").length <= 251
);
const ownerHookSource = readFileSync(
  "src/engines/project/useLayerDocumentProjectOwner.ts",
  "utf8"
);
const ownerLivePortSource = readFileSync(
  "src/engines/project/helpers/layerDocumentProjectOwnerLivePortHelpers.ts",
  "utf8"
);
assert.match(
  ownerHookSource,
  /createLayerDocumentProjectOwnerLivePort\(\s*stateRef,\s*transition\s*\)/
);
assert.match(
  ownerHookSource,
  /createLayerDocumentProjectOwnerLivePort\([\s\S]*?\),[\s\S]*?\[state,\s*transition\]\s*\)/
);
assert.match(
  ownerLivePortSource,
  /get state\(\)\s*\{\s*return stateRef\.current;?\s*\}/
);
const compositionRootSource = readFileSync(
  "src/editor/useEditorCompositionRoot.ts",
  "utf8"
);
assert.doesNotMatch(
  compositionRootSource,
  /useLayerDocumentProjectOwner|reduceLayerDocumentProjectOwner/
);

console.log("Layer Document Project owner verification passed");
