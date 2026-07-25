import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  validateLayerDocumentProject,
  type LayerAnimation,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerSourceReference,
  type SourceRegistryRecord,
} from "@/models";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
} from "@/engines/audio";
import {
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
} from "@/engines/drawing";
import {
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/properties/adapters/layerDocumentPanelPreparationAdapter";
import {
  prepareLayerDocumentPanelCommand,
} from "@/engines/properties/adapters/layerDocumentPanelCommandAdapter";
import {
  buildLayerDocumentPanelDescriptor,
} from "@/engines/properties/helpers/layerDocumentPanelDescriptorHelpers";
import type {
  LayerDocumentPanelCommand,
  LayerDocumentPanelCommandPreparation,
} from "@/engines/properties/models/layerDocumentPanelModel";
import {
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/engines/text";
import type {
  LayerDocumentRuntimeInput,
} from "@/engines/playback-render";

const EMPTY_ANIMATION: LayerAnimation = {
  positionKeyframes: [],
  scaleKeyframes: [],
  rotationKeyframes: [],
  opacityKeyframes: [],
  enabledProperties: {
    position: true,
    scale: true,
    rotation: true,
    opacity: true,
  },
};

function common<TSource extends LayerSourceReference | null>(
  parentLayerDocumentId: string | null,
  order: number,
  source: TSource,
  seed: number
): LayerDocumentCommon<TSource> {
  return {
    source,
    transform: {
      position: { x: seed * 10, y: seed * 20 },
      transformOffset: { x: seed, y: seed + 1 },
      anchor: { x: 50, y: 50 },
      scale: { x: 100 + seed, y: 100 + seed },
      scaleLinked: true,
      rotation: seed,
      opacity: 100 - seed,
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
      ...EMPTY_ANIMATION,
      positionKeyframes: [{
        frame: 12,
        value: { x: seed * 30, y: seed * 40 },
      }],
    },
    effects: [{
      effectId: `effect-${seed}`,
      type: "fixture-effect",
      enabled: true,
      parameters: { amount: seed },
    }],
    modifiers: [{
      modifierId: `modifier-${seed}`,
      type: "wiggle",
      enabled: true,
      frequency: seed + 1,
      amount: seed + 2,
    }],
  };
}

function sources(): Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
  };
  return {
    "psd-document": {
      sourceId: "psd-document",
      kind: "psd-document",
      displayName: "Shared file.psd",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:psd-document",
        kind: "linked-file",
        suggestedFileName: "shared.psd",
        relativePathHint: null,
      },
      contentFingerprint: null,
      data: {
        importSettings: {
          compositionName: "Shared",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "shared-psd-source": {
      sourceId: "shared-psd-source",
      kind: "psd-node",
      displayName: "Shared PSD pixels",
      version: 2,
      refresh,
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:shared",
        sourcePath: "Layer",
        visualFingerprint: "pixels-v1",
      },
    },
    "audio-source": {
      sourceId: "audio-source",
      kind: "audio",
      displayName: "Voice resource.wav",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:audio-source",
        kind: "linked-file",
        suggestedFileName: "voice.wav",
        relativePathHint: null,
      },
      contentFingerprint: null,
      data: {
        mimeType: "audio/wav",
        durationFrames: 120,
      },
    },
    "video-source": {
      sourceId: "video-source",
      kind: "video",
      displayName: "Future resource.mov",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:video-source",
        kind: "linked-file",
        suggestedFileName: "future.mov",
        relativePathHint: null,
      },
      contentFingerprint: null,
      data: {
        mimeType: "video/quicktime",
        durationFrames: 120,
        width: 1920,
        height: 1080,
      },
    },
    "unknown-source": {
      sourceId: "unknown-source",
      kind: "unknown",
      displayName: "Plugin resource",
      version: 1,
      refresh,
      data: {
        originalKind: "plugin",
        rawData: { resource: true },
      },
    },
  };
}

function projectFixture(): LayerDocumentProject {
  const rootCommon = common(null, 0, null, 0);
  rootCommon.effects = [];
  rootCommon.modifiers = [];
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Project edit name",
      revision: 0,
      type: "group",
      common: rootCommon,
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    "psd-a": {
      layerDocumentId: "psd-a",
      name: "PSD edit A",
      revision: 3,
      type: "psd",
      common: {
        ...common(
          "root",
          0,
          { sourceId: "shared-psd-source" },
          1
        ),
        placement: {
          ...common(
            "root",
            0,
            { sourceId: "shared-psd-source" },
            1
          ).placement,
          alias: "Opening edit alias",
        },
      },
      data: {},
    },
    "psd-b": {
      layerDocumentId: "psd-b",
      name: "PSD edit B",
      revision: 7,
      type: "psd",
      common: common(
        "root",
        1,
        { sourceId: "shared-psd-source" },
        2
      ),
      data: {},
    },
    drawing: {
      layerDocumentId: "drawing",
      name: "Drawing edit",
      revision: 1,
      type: "drawing",
      common: common("root", 2, null, 3),
      data: {
        documentVersion: 1,
        elements: [{ kind: "stroke", id: "stroke-a" }],
      },
    },
    text: {
      layerDocumentId: "text",
      name: "Text edit",
      revision: 2,
      type: "text",
      common: common("root", 3, null, 4),
      data: {
        text: "Layer text",
        style: {
          fontFamily: "Fixture Sans",
          fontSize: 48,
          color: "#ffffff",
        },
      },
    },
    audio: {
      layerDocumentId: "audio",
      name: "Audio edit",
      revision: 1,
      type: "audio",
      common: common(
        "root",
        4,
        { sourceId: "audio-source" },
        5
      ),
      data: {},
    },
    video: {
      layerDocumentId: "video",
      name: "Video edit",
      revision: 1,
      type: "video",
      common: common(
        "root",
        5,
        { sourceId: "video-source" },
        6
      ),
      data: {},
    },
    shape: {
      layerDocumentId: "shape",
      name: "Shape edit",
      revision: 1,
      type: "shape",
      common: common("root", 6, null, 7),
      data: {
        documentVersion: 1,
        shapes: [{ kind: "rectangle" }],
      },
    },
    group: {
      layerDocumentId: "group",
      name: "Nested group edit",
      revision: 1,
      type: "group",
      common: common("root", 7, null, 8),
      data: {
        role: "composition",
        width: 640,
        height: 640,
        frameRate: 24,
        durationFrames: 120,
      },
    },
    "unknown-a": {
      layerDocumentId: "unknown-a",
      name: "Plugin edit A",
      revision: 1,
      type: "unknown",
      common: common(
        "root",
        8,
        { sourceId: "unknown-source" },
        9
      ),
      data: {
        originalType: "plugin",
        rawData: { instance: "a" },
      },
    },
    "unknown-b": {
      layerDocumentId: "unknown-b",
      name: "Plugin edit B",
      revision: 1,
      type: "unknown",
      common: common(
        "root",
        9,
        { sourceId: "unknown-source" },
        10
      ),
      data: {
        originalType: "plugin",
        rawData: { instance: "b" },
      },
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "panel-preparation",
      name: "Panel preparation",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: { sourcesById: sources() },
    },
  };
}

const project = projectFixture();
const projectSnapshot = structuredClone(project);
assert.deepEqual(validateLayerDocumentProject(project), []);

assert.deepEqual(
  buildLayerDocumentPanelDescriptor({
    project,
    selectedLayerDocumentId: null,
    readSourceResolutionStatus: () => "available",
  }),
  {
    status: "empty",
    selectedLayerDocumentId: null,
    reason: "no-selection",
    descriptor: null,
  }
);
assert.deepEqual(
  buildLayerDocumentPanelDescriptor({
    project,
    selectedLayerDocumentId: "stale-layer",
    readSourceResolutionStatus: () => "available",
  }),
  {
    status: "empty",
    selectedLayerDocumentId: "stale-layer",
    reason: "layer-not-found",
    descriptor: null,
  }
);

function descriptor(layerDocumentId: string) {
  const result = LAYER_DOCUMENT_PANEL_PREPARATION_PORT.query.describe({
    project,
    selectedLayerDocumentId: layerDocumentId,
    readSourceResolutionStatus: (sourceId) =>
      sourceId === "video-source" ? "missing" : "available",
  });
  assert.equal(result.status, "ready");
  if (result.status !== "ready") {
    throw new Error(`Descriptor not ready: ${layerDocumentId}`);
  }
  assert.equal(result.selectedLayerDocumentId, layerDocumentId);
  assert.equal(result.descriptor.selectedLayerDocumentId, layerDocumentId);
  assert.equal(result.descriptor.layerDocumentId, layerDocumentId);
  return result.descriptor;
}

const psdA = descriptor("psd-a");
const psdB = descriptor("psd-b");
assert.equal(psdA.name, "PSD edit A");
assert.equal(psdA.alias, "Opening edit alias");
assert.equal(psdA.displayName, "Opening edit alias");
assert.equal(psdA.source.displayName, "Shared PSD pixels");
assert.notEqual(psdA.name, psdA.source.displayName);
assert.equal(psdA.source.sourceId, psdB.source.sourceId);
assert.notDeepEqual(psdA.transform, psdB.transform);
assert.notDeepEqual(psdA.effects, psdB.effects);
assert.notDeepEqual(psdA.modifiers, psdB.modifiers);
assert.equal(psdA.typeData.kind, "psd");
assert.equal(psdB.typeData.kind, "psd");

const unknownA = descriptor("unknown-a");
const unknownB = descriptor("unknown-b");
assert.equal(unknownA.source.sourceId, unknownB.source.sourceId);
assert.equal(unknownA.typeData.kind, "unknown");
assert.equal(unknownB.typeData.kind, "unknown");
if (
  unknownA.typeData.kind === "unknown" &&
  unknownB.typeData.kind === "unknown"
) {
  assert.notDeepEqual(
    unknownA.typeData.data.rawData,
    unknownB.typeData.data.rawData
  );
}

const drawingDescriptor = descriptor("drawing");
const textDescriptor = descriptor("text");
assert.equal(drawingDescriptor.typeData.kind, "drawing");
assert.equal(textDescriptor.typeData.kind, "text");
if (drawingDescriptor.typeData.kind === "drawing") {
  assert.equal(drawingDescriptor.typeData.data.documentVersion, 1);
  assert.equal("text" in drawingDescriptor.typeData.data, false);
}
if (textDescriptor.typeData.kind === "text") {
  assert.equal(textDescriptor.typeData.data.text, "Layer text");
  assert.equal("elements" in textDescriptor.typeData.data, false);
}

for (const layerDocumentId of [
  "psd-a",
  "drawing",
  "text",
  "audio",
  "video",
  "shape",
  "group",
  "unknown-a",
]) {
  const selected = descriptor(layerDocumentId);
  assert.equal(selected.capabilities.transform.status, "editable");
  assert.equal(selected.capabilities.effects.status, "editable");
  assert.equal(selected.capabilities.modifiers.status, "editable");
}
assert.equal(
  drawingDescriptor.capabilities.domain.status,
  "editable"
);
assert.equal(textDescriptor.capabilities.domain.status, "editable");
assert.equal(descriptor("audio").capabilities.domain.status, "future");
assert.equal(descriptor("audio").typeData.kind, "audio");
assert.equal(descriptor("video").capabilities.domain.status, "future");
assert.equal(
  descriptor("video").source.resolutionStatus,
  "missing"
);
assert.equal(descriptor("video").source.refreshStatus, "normal");
assert.equal(descriptor("shape").capabilities.domain.status, "future");
assert.equal(descriptor("group").capabilities.domain.status, "read-only");
assert.equal(
  descriptor("unknown-a").capabilities.domain.status,
  "unsupported"
);
const rootDescriptor = descriptor("root");
assert.equal(rootDescriptor.isProjectRoot, true);
assert.equal(rootDescriptor.capabilities.transform.status, "unsupported");
assert.equal(rootDescriptor.capabilities.placement.status, "read-only");
assert.equal(rootDescriptor.capabilities.effects.status, "unsupported");

assert.equal(
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT.query(project, "drawing")
    .status,
  "ready"
);
assert.equal(
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT.query(project, "text").status,
  "ready"
);
assert.deepEqual(
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT.query(project, "audio"),
  {
    status: "ready",
    layerDocumentId: "audio",
    dataSchema: "empty",
    domainEditing: "future",
  }
);
assert.equal(
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT.query(project, "text")
    .status,
  "type-mismatch"
);

function prepare(
  selectedLayerDocumentId: string | null,
  command: LayerDocumentPanelCommand
) {
  return prepareLayerDocumentPanelCommand({
    project,
    selectedLayerDocumentId,
    command,
  });
}

function assertPrepared(
  result: LayerDocumentPanelCommandPreparation,
  layerDocumentId: string
) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  const before = project.payload.layerDocumentsById[layerDocumentId];
  const after =
    result.transaction.after.payload.layerDocumentsById[layerDocumentId];
  assert.ok(before);
  assert.ok(after);
  assert.equal(result.selectedLayerDocumentId, layerDocumentId);
  assert.equal(result.layerDocumentId, layerDocumentId);
  assert.equal(result.projectUpdateCount, 0);
  assert.equal(result.transactionCount, 1);
  assert.equal(result.historyEntryCount, 1);
  assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(
    result.transaction.historyEntry.affectedLayerDocumentIds,
    [layerDocumentId]
  );
  assert.strictEqual(result.transaction.before, project);
  assert.notStrictEqual(result.transaction.after, project);
  assert.deepEqual(project, projectSnapshot);
  return result.transaction.after.payload.layerDocumentsById[
    layerDocumentId
  ];
}

const runtimeInput: LayerDocumentRuntimeInput = {
  target: {
    kind: "layer-document",
    layerDocumentId: "psd-a",
  },
  layerDocumentId: "psd-a",
  sourceId: "shared-psd-source",
  type: "psd",
  revision: 3,
  label: "Opening edit alias",
  globalFrame: 37,
  localFrame: 12,
  order: 0,
  evaluatedTransform: psdA.transform,
  opacity: psdA.transform.opacity,
  effects: psdA.effects,
  modifiers: psdA.modifiers,
  content: {
    kind: "unavailable",
    reason: "resolver-miss",
  },
  sourceResourceCacheKey: "fixture-source-key",
  layerResultCacheKey: "fixture-result-key",
  draftIdentity: null,
  draftApplied: false,
};
const pointerMove =
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT.draft.preparePointerMove({
    input: runtimeInput,
    patch: {
      position: { x: 333, y: 444 },
      scale: { x: 155, y: 166 },
      rotation: 27,
      opacity: 55,
      anchor: { x: 40, y: 60 },
      transformOffset: { x: 7, y: 8 },
    },
  });
assert.equal(pointerMove.kind, "pointer-move");
if (pointerMove.kind !== "pointer-move") {
  throw new Error("Expected pointer move preparation");
}
assert.deepEqual(
  {
    projectUpdateCount: pointerMove.projectUpdateCount,
    transactionCount: pointerMove.transactionCount,
    historyEntryCount: pointerMove.historyEntryCount,
  },
  {
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  }
);
const pointerUp =
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT.draft.preparePointerUp(
    pointerMove.draft
  );
assert.equal(pointerUp.kind, "pointer-up");
if (pointerUp.kind !== "pointer-up") {
  throw new Error("Expected pointer up preparation");
}
assert.equal(pointerUp.transactionCount, 1);
assert.equal(pointerUp.historyEntryCount, 1);
assert.deepEqual(project, projectSnapshot);

const transformAfter = assertPrepared(
  prepare("psd-a", {
    kind: "commit-transform",
    intent: pointerUp.commitIntent,
  }),
  "psd-a"
);
assert.deepEqual(
  transformAfter.common.transform,
  {
    ...project.payload.layerDocumentsById["psd-a"].common.transform,
    anchor: { x: 40, y: 60 },
    transformOffset: { x: 7, y: 8 },
  }
);
assert.deepEqual(
  transformAfter.common.animation.positionKeyframes,
  [{ frame: 12, value: { x: 333, y: 444 } }]
);
assert.deepEqual(
  transformAfter.common.animation.scaleKeyframes,
  [{ frame: 12, value: { x: 155, y: 166 } }]
);
assert.deepEqual(
  transformAfter.common.animation.rotationKeyframes,
  [{ frame: 12, value: 27 }]
);
assert.deepEqual(
  transformAfter.common.animation.opacityKeyframes,
  [{ frame: 12, value: 55 }]
);

const mixedTrackProject = structuredClone(project);
const mixedTrackBefore =
  mixedTrackProject.payload.layerDocumentsById["psd-b"];
mixedTrackBefore.common.animation.enabledProperties = {
  position: true,
  scale: false,
  rotation: false,
  opacity: false,
};
const mixedTrackPreparation =
  prepareLayerDocumentPanelCommand({
    project: mixedTrackProject,
    selectedLayerDocumentId: "psd-b",
    command: {
      kind: "commit-transform",
      intent: {
        kind: "commit-layer-document-transform",
        layerDocumentId: "psd-b",
        globalFrame: 12,
        localFrame: 12,
        patch: {
          position: { x: 700, y: 800 },
          scale: { x: 130, y: 140 },
          rotation: 45,
          opacity: 65,
        },
      },
    },
  });
assert.equal(mixedTrackPreparation.ok, true);
if (!mixedTrackPreparation.ok) {
  throw new Error(mixedTrackPreparation.message);
}
assert.equal(mixedTrackPreparation.transactionCount, 1);
assert.equal(mixedTrackPreparation.historyEntryCount, 1);
const mixedTrackAfter =
  mixedTrackPreparation.transaction.after.payload
    .layerDocumentsById["psd-b"];
assert.deepEqual(
  mixedTrackAfter.common.transform.position,
  mixedTrackBefore.common.transform.position
);
assert.deepEqual(
  mixedTrackAfter.common.animation.positionKeyframes,
  [{ frame: 12, value: { x: 700, y: 800 } }]
);
assert.deepEqual(mixedTrackAfter.common.transform.scale, {
  x: 130,
  y: 140,
});
assert.equal(mixedTrackAfter.common.transform.rotation, 45);
assert.equal(mixedTrackAfter.common.transform.opacity, 65);
assert.deepEqual(
  mixedTrackAfter.common.animation.scaleKeyframes,
  mixedTrackBefore.common.animation.scaleKeyframes
);

const effectAfter = assertPrepared(
  prepare("psd-a", {
    kind: "set-effects",
    layerDocumentId: "psd-a",
    effects: [{
      effectId: "effect-panel",
      type: "panel-effect",
      enabled: true,
      parameters: { amount: 99 },
    }],
  }),
  "psd-a"
);
assert.equal(effectAfter.common.effects[0].effectId, "effect-panel");
assert.deepEqual(
  project.payload.layerDocumentsById["psd-b"].common.effects,
  projectSnapshot.payload.layerDocumentsById["psd-b"].common.effects
);

const modifierAfter = assertPrepared(
  prepare("psd-a", {
    kind: "set-modifiers",
    layerDocumentId: "psd-a",
    modifiers: [{
      modifierId: "modifier-panel",
      type: "wiggle",
      enabled: true,
      frequency: 7,
      amount: 8,
    }],
  }),
  "psd-a"
);
assert.equal(
  modifierAfter.common.modifiers[0].modifierId,
  "modifier-panel"
);

const drawingAfter = assertPrepared(
  prepare("drawing", {
    kind: "replace-drawing-document",
    layerDocumentId: "drawing",
    data: {
      documentVersion: 2,
      elements: [{ kind: "stroke", id: "stroke-b" }],
    },
  }),
  "drawing"
);
assert.equal(
  drawingAfter.type === "drawing"
    ? drawingAfter.data.documentVersion
    : null,
  2
);

const textAfter = assertPrepared(
  prepare("text", {
    kind: "replace-text-document",
    layerDocumentId: "text",
    data: {
      text: "Updated text",
      style: {
        fontFamily: "Fixture Sans",
        fontSize: 52,
        color: "#00ffff",
      },
    },
  }),
  "text"
);
assert.equal(textAfter.type === "text" ? textAfter.data.text : null, "Updated text");

assertPrepared(
  prepare("psd-a", {
    kind: "set-name",
    layerDocumentId: "psd-a",
    name: "Renamed edit",
  }),
  "psd-a"
);
assertPrepared(
  prepare("psd-a", {
    kind: "set-alias",
    layerDocumentId: "psd-a",
    alias: "Renamed alias",
  }),
  "psd-a"
);
assertPrepared(
  prepare("psd-a", {
    kind: "set-placement-timing",
    layerDocumentId: "psd-a",
    startFrame: 4,
    durationFrames: 100,
    sourceOffsetFrames: 2,
  }),
  "psd-a"
);
assertPrepared(
  prepare("psd-a", {
    kind: "set-visibility",
    layerDocumentId: "psd-a",
    visible: false,
  }),
  "psd-a"
);
assertPrepared(
  prepare("psd-a", {
    kind: "set-animation",
    layerDocumentId: "psd-a",
    animation: {
      ...project.payload.layerDocumentsById["psd-a"].common.animation,
      enabledProperties: {
        ...project.payload.layerDocumentsById["psd-a"].common.animation
          .enabledProperties,
        rotation: false,
      },
    },
  }),
  "psd-a"
);

const wrongType = prepare("text", {
  kind: "replace-drawing-document",
  layerDocumentId: "text",
  data: {
    documentVersion: 2,
    elements: [],
  },
});
assert.equal(wrongType.ok, false);
if (!wrongType.ok) {
  assert.equal(wrongType.reason, "type-mismatch");
  assert.equal(wrongType.transactionCount, 0);
  assert.equal(wrongType.historyEntryCount, 0);
  assert.strictEqual(wrongType.project, project);
}
const noChange = prepare("psd-a", {
  kind: "set-effects",
  layerDocumentId: "psd-a",
  effects: structuredClone(
    project.payload.layerDocumentsById["psd-a"].common.effects
  ),
});
assert.equal(noChange.ok, false);
if (!noChange.ok) assert.equal(noChange.reason, "no-change");

const selectionMismatch = prepare("psd-a", {
  kind: "set-name",
  layerDocumentId: "psd-b",
  name: "Wrong target",
});
assert.equal(selectionMismatch.ok, false);
if (!selectionMismatch.ok) {
  assert.equal(selectionMismatch.reason, "selection-mismatch");
}
const noSelection = prepare(null, {
  kind: "set-name",
  layerDocumentId: "psd-a",
  name: "No selection",
});
assert.equal(noSelection.ok, false);
if (!noSelection.ok) assert.equal(noSelection.reason, "no-selection");

const rootTransform = prepare("root", {
  kind: "commit-transform",
  intent: {
    ...pointerUp.commitIntent,
    layerDocumentId: "root",
  },
});
assert.equal(rootTransform.ok, false);
if (!rootTransform.ok) {
  assert.equal(rootTransform.reason, "root-operation-forbidden");
}

for (const domain of ["audio", "video", "shape"] as const) {
  const future = prepare(domain, {
    kind: "request-future-domain-update",
    layerDocumentId: domain,
    domain,
  });
  assert.equal(future.ok, false);
  if (!future.ok) {
    assert.equal(future.reason, "unsupported-capability");
    assert.equal(future.transactionCount, 0);
    assert.equal(future.historyEntryCount, 0);
    assert.strictEqual(future.project, project);
  }
}
const wrongFutureType = prepare("video", {
  kind: "request-future-domain-update",
  layerDocumentId: "video",
  domain: "shape",
});
assert.equal(wrongFutureType.ok, false);
if (!wrongFutureType.ok) {
  assert.equal(wrongFutureType.reason, "type-mismatch");
}
assert.deepEqual(project, projectSnapshot);

const taskFiles = [
  "src/engines/properties/models/layerDocumentPanelModel.ts",
  "src/engines/properties/helpers/layerDocumentPanelDescriptorHelpers.ts",
  "src/engines/properties/adapters/layerDocumentPanelCommandAdapter.ts",
  "src/engines/properties/adapters/layerDocumentPanelPreparationAdapter.ts",
  "src/engines/drawing/models/layerDocumentDrawingPreparationModel.ts",
  "src/engines/drawing/adapters/layerDocumentDrawingPreparationAdapter.ts",
  "src/engines/text/models/layerDocumentTextPreparationModel.ts",
  "src/engines/text/adapters/layerDocumentTextPreparationAdapter.ts",
  "src/engines/audio/models/layerDocumentAudioPreparationModel.ts",
  "src/engines/audio/adapters/layerDocumentAudioPreparationAdapter.ts",
];
taskFiles.forEach((path) => {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /\buseState\b|\buseReducer\b|createStore/);
  assert.doesNotMatch(
    source,
    /@\/editor|@\/features|@\/engines\/canvas/
  );
  assert.doesNotMatch(
    source,
    /setProject|setComps|setTimelineItems|commitTransaction\s*\(/
  );
});
for (const path of taskFiles.filter((path) =>
  /engines\/(drawing|text|audio)\//.test(path)
)) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /@\/engines\/properties/);
}
const compositionRootSource = readFileSync(
  "src/editor/useEditorCompositionRoot.ts",
  "utf8"
);
const productPanelSource = readFileSync(
  "src/features/properties/components/PropertiesPanel.tsx",
  "utf8"
);
assert.doesNotMatch(
  compositionRootSource,
  /LAYER_DOCUMENT_PANEL_PREPARATION_PORT|buildLayerDocumentPanelDescriptor/
);
assert.doesNotMatch(
  productPanelSource,
  /LAYER_DOCUMENT_PANEL_PREPARATION_PORT|buildLayerDocumentPanelDescriptor/
);

console.log("Layer Document Panel preparation verification passed");
