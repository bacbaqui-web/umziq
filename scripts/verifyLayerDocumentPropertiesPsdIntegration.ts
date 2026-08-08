import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Psd } from "ag-psd";
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
  createLayerDocumentPsdTreeController,
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
} from "@/render";
import {
  createLayerDocumentPropertiesController,
  type LayerDocumentPropertiesRuntimeState,
} from "@/engines/properties/controllers/layerDocumentPropertiesController";
import {
  createLayerDocumentPropertiesCommandPort,
} from "@/engines/properties/adapters/layerDocumentPropertiesCommandPortAdapter";
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

function common(
  parentLayerDocumentId: string | null,
  order: number,
  sourceId: string | null = null
): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: {
      position: { x: 10, y: 20 },
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
      positionKeyframes: [
        { frame: 0, value: { x: 100, y: 110 } },
        { frame: 7, value: { x: 170, y: 180 } },
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

function projectFixture(): LayerDocumentProject {
  const rootCommon = common(null, 0);
  rootCommon.animation.positionKeyframes = [];
  rootCommon.animation.enabledProperties.position = false;
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Root",
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
    psd: {
      layerDocumentId: "psd",
      name: "PSD placement",
      revision: 0,
      type: "psd",
      common: common("root", 0, "node"),
      data: {},
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "properties-psd-integration",
      name: "Properties PSD integration",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: {
        sourcesById: {
          document: {
            sourceId: "document",
            kind: "psd-document",
            displayName: "existing.psd",
            version: 1,
            refresh: { status: "normal" },
            locator: {
              locatorId: "linked:document",
              kind: "linked-file",
              suggestedFileName: "existing.psd",
              relativePathHint: null,
            },
            contentFingerprint: null,
            data: {
              importSettings: {
                compositionName: "Existing",
                hiddenLayerMode: "preserve",
              },
            },
          },
          node: {
            sourceId: "node",
            kind: "psd-node",
            displayName: "Existing layer",
            version: 1,
            refresh: { status: "normal" },
            data: {
              documentSourceId: "document",
              sourceKey: "layer:1",
              sourcePath: "existing.psd/Layer",
              visualFingerprint: "node-v1",
            },
          },
        },
      },
    },
  };
}

const initialized = createLayerDocumentProjectOwnerState({
  project: projectFixture(),
  layerSelection: {
    kind: "layer-document",
    layerDocumentId: "psd",
  },
  activeGroupLayerDocumentId: "root",
});
assert.equal(initialized.ok, true);
if (!initialized.ok) throw new Error(initialized.error.message);
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
let draft: LayerDocumentTransformDraftSnapshot | null = null;
let failRegistration = true;
const resources =
  createLayerDocumentSourceRuntimeResourceCache({
    registrationFailureInjection: () => {
      if (!failRegistration) return false;
      failRegistration = false;
      return true;
    },
  });
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
sourceResolution.setAvailable({ sourceId: "document" });
sourceResolution.setAvailable({ sourceId: "node" });
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
      read: () => draft,
      publish: (next) => {
        draft = next;
      },
      clear: () => {
        draft = null;
      },
    },
    effects: {
      applyOwnerEffect: (effect) => {
        if (effect.clearDraft) draft = null;
      },
    },
    metrics: { increment: () => {} },
  });

const propertiesPort =
  createLayerDocumentPropertiesCommandPort({
    readDescriptor:
      ports.properties.describe,
    readProject: ports.project.read,
    readDraft: () => draft,
    readGlobalFrame: () => 7,
    previewDraft: ports.canvas.pointerMove,
    commitDraft: ports.canvas.pointerUp,
    cancelDraft: ports.canvas.cancelDraft,
    dispatchPanel: ports.properties.dispatch,
    dispatchTimeline:
      ports.timeline.dispatchIntent,
    selectKeyframe:
      ports.timeline.selectTransformKeyframe,
    readSelectedKeyframe: () =>
      ports.timeline.readViewProps()
        .selectedTransformKeyframe,
  });
let runtime: LayerDocumentPropertiesRuntimeState = {
  selectedLayerDocumentId: null,
  selectedLayerRevision: null,
  globalFrame: -1,
  localFrame: null,
  focusedInputId: null,
  focusedTransform: null,
  inputDrafts: {},
};
const properties =
  createLayerDocumentPropertiesController({
    port: propertiesPort,
    runtime: {
      read: () => runtime,
      replace: (next) => {
        runtime = next;
      },
    },
  });
properties.syncSelection();
assert.equal(
  properties.read().displayedTransform?.position.x,
  170
);
const transitionsBeforePreview = ownerTransitionCount;
const historyBeforePreview = ownerState.undoStack.length;
properties.focusNumericInput("position.x");
properties.changeNumericInput("position.x", "190");
assert.equal(ownerTransitionCount, transitionsBeforePreview);
assert.equal(ownerState.undoStack.length, historyBeforePreview);
assert.equal(draft?.evaluatedTransform.position.x, 190);
assert.equal(
  properties.read().displayedTransform?.position.x,
  190
);
assert.equal(
  properties.blurNumericInput("position.x")?.committed,
  true
);
assert.equal(
  ownerState.undoStack.length,
  historyBeforePreview + 1
);
assert.equal(draft, null);
assert.equal(
  ownerState.currentProject.payload
    .layerDocumentsById.psd.common.animation
    .positionKeyframes.find((keyframe) =>
      keyframe.frame === 7
    )?.value.x,
  190
);

const psdController =
  createLayerDocumentPsdTreeController({
    port: {
      readTree: ports.sources.readTree,
      readProject: ports.project.read,
      selectSource:
        ports.selection.selectSource,
      confirmImport:
        ports.sources.confirmPreparedPsdImport,
      cancelImport:
        ports.sources.cancelPreparedPsdImport,
      confirmRefresh:
        ports.sources.confirmPreparedPsdRefresh,
      cancelRefresh:
        ports.sources.cancelPreparedPsdRefresh,
      refreshSource:
        ports.sources.refreshSource,
      reconnect: ports.sources.reconnect,
      deleteSource:
        ports.sources.deleteSource,
    },
  });
const selectedLayerBeforeSource =
  ownerState.session.layerSelection?.layerDocumentId;
const activeGroupBeforeSource =
  ownerState.session.activeGroupLayerDocumentId;
psdController.selectSource("document");
assert.equal(
  ownerState.session.layerSelection?.layerDocumentId,
  selectedLayerBeforeSource
);
assert.equal(
  ownerState.session.activeGroupLayerDocumentId,
  activeGroupBeforeSource
);

const parsed: Psd = {
  width: 100,
  height: 100,
  children: [{
    id: 1,
    name: "Imported",
    left: 0,
    top: 0,
    canvas: {
      width: 10,
      height: 10,
      getContext: () => null,
    } as never,
  }],
};
const importPlan = await psdController.prepareImport({
  file: new File(["integration"], "integration.psd"),
  token: "integration",
  parentLayerDocumentId: "root",
  order: 1,
  durationFrames: 120,
  parsePsd: async () => parsed,
});
const historyBeforeImport = ownerState.undoStack.length;
const firstConfirm = psdController.confirmImport(importPlan);
assert.equal(firstConfirm.ok, false);
assert.equal(
  importPlan.prepared.runtime.readState(),
  "runtime-registration-pending"
);
assert.equal(
  ownerState.undoStack.length,
  historyBeforeImport + 1
);
const secondConfirm = psdController.confirmImport(importPlan);
assert.equal(secondConfirm.ok, true);
assert.equal(
  importPlan.prepared.runtime.readState(),
  "transferred"
);
assert.equal(
  ownerState.undoStack.length,
  historyBeforeImport + 1
);
assert.ok(
  ownerState.currentProject.payload
    .layerDocumentsById[
      importPlan.prepared.command.selectLayerDocumentId
    ]
);
const firstPsdLayer =
  importPlan.prepared.command.layers.find(
    (layer) => layer.type === "psd"
  );
assert.ok(firstPsdLayer?.common.source);
const firstRuntime = ports.canvas.readViewProps({
  globalFrame: 7,
  sourceSamplingQuality: "preview",
});
assert.equal(firstRuntime.runtime.ok, true);
if (!firstRuntime.runtime.ok || !firstPsdLayer) {
  throw new Error("First PSD runtime unavailable");
}
const firstRuntimeInput =
  firstRuntime.runtime.model.inputs.find(
    (input) =>
      input.layerDocumentId ===
      firstPsdLayer.layerDocumentId
  );
assert.ok(
  firstRuntimeInput?.sourceResourceCacheKey
);
const firstResourceRequest = {
  sourceId:
    firstPsdLayer.common.source!.sourceId,
  sourceResourceCacheKey:
    firstRuntimeInput!.sourceResourceCacheKey!,
};
assert.ok(resources.resolve(firstResourceRequest));

const secondPlan =
  await psdController.prepareImport({
    file: new File(
      ["integration-2"],
      "integration-2.psd"
    ),
    token: "integration-2",
    parentLayerDocumentId: "root",
    order: 2,
    durationFrames: 120,
    parsePsd: async () => ({
      ...parsed,
      children: [{
        ...parsed.children![0],
        id: 2,
        name: "Imported 2",
      }],
    }),
  });
assert.equal(
  psdController.confirmImport(secondPlan).ok,
  true
);
assert.ok(
  resources.resolve(firstResourceRequest),
  "Second PSD import must preserve the first PSD runtime resource"
);
const historyAfterSecondImport =
  ownerState.undoStack.length;
assert.equal(ports.project.undo().ok, true);
assert.ok(resources.resolve(firstResourceRequest));
assert.equal(ports.project.redo().ok, true);
assert.equal(
  ownerState.undoStack.length,
  historyAfterSecondImport
);
assert.ok(resources.resolve(firstResourceRequest));

const rootSource = readFileSync(
  "src/editor/useEditorCompositionRoot.ts",
  "utf8"
);
const ownerSource = readFileSync(
  "src/editor/useLayerDocumentEditorOwner.ts",
  "utf8"
);
assert.match(
  rootSource,
  /psdTreeProps:\s*psdTree\.viewProps/
);
assert.match(
  rootSource,
  /propertiesPanelProps:\s*properties\.viewProps/
);
assert.match(
  rootSource,
  /timelinePanelProps:\s*timeline\.viewProps/
);
assert.match(
  rootSource,
  /readPort:\s*panelPorts\.canvasRead/
);
assert.doesNotMatch(
  `${rootSource}\n${ownerSource}`,
  /useEditorState|useProjectSourceSession|useProjectPsdEngine|useTimelineEngine|usePropertiesEngine|usePsdTreeEngine|useCanvasComposition/
);
assert.match(
  ownerSource,
  /useState\(\s*createInitialLayerDocumentOwnerOptions\s*\)/
);
assert.doesNotMatch(
  ownerSource,
  /useEffect\([\s\S]{0,200}migrateProjectSource/
);

console.log(
  "LayerDocument Properties/PSD integration verified"
);
