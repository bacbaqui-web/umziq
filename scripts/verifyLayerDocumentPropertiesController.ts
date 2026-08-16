import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  buildLayerDocumentTimelineIntentTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  type LayerAnimation,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentTimelineIntent,
  type LayerSourceReference,
} from "@/models";
import {
  applyLayerDocumentTransformDraft,
  evaluateLayerDocumentTransform,
  type PreviewSceneTransformPatch,
} from "@/render";
import {
  createLayerDocumentPropertiesController,
  type LayerDocumentPropertiesCommandPort,
  type LayerDocumentPropertiesRuntimeState,
} from "@/engines/properties/controllers/layerDocumentPropertiesController";
import {
  buildLayerDocumentPropertiesViewProps,
} from "@/engines/properties/useLayerDocumentPropertiesEngine";
import {
  prepareLayerDocumentPropertiesCommand,
} from "@/engines/properties/adapters/layerDocumentPropertiesCommandPreparationAdapter";
import {
  buildLayerDocumentPropertiesDescriptor,
} from "@/engines/properties/helpers/layerDocumentPropertiesDescriptorHelpers";
import type {
  LayerDocumentPropertiesCommand,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import {
  getCompensatedTransformOffset,
} from "@/shared/geometry/transformOffsetHelpers";

const EMPTY_ANIMATION: LayerAnimation = {
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
};

function common(
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null,
  seed: number
): LayerDocumentCommon {
  return {
    source,
    transform: {
      position: { x: seed * 10, y: seed * 20 },
      transformOffset: { x: seed, y: seed + 1 },
      anchor: { x: 50, y: 50 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: seed,
      opacity: 100 - seed,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: 3,
      durationFrames: 120,
      sourceOffsetFrames: 2,
      visible: true,
      alias: null,
    },
    animation: structuredClone(EMPTY_ANIMATION),
    effects: [],
    modifiers: [],
  };
}

function projectFixture(): LayerDocumentProject {
  const rootCommon = common(null, 0, null, 0);
  rootCommon.placement.startFrame = 0;
  rootCommon.placement.sourceOffsetFrames = 0;
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Project",
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
      name: "PSD A",
      revision: 0,
      type: "psd",
      common: common("root", 0, { sourceId: "shared" }, 1),
      data: {},
    },
    "psd-b": {
      layerDocumentId: "psd-b",
      name: "PSD B",
      revision: 0,
      type: "psd",
      common: common("root", 1, { sourceId: "shared" }, 2),
      data: {},
    },
    drawing: {
      layerDocumentId: "drawing",
      name: "Drawing",
      revision: 0,
      type: "drawing",
      common: common("root", 2, null, 3),
      data: { documentVersion: 1, elements: [] },
    },
    text: {
      layerDocumentId: "text",
      name: "Text",
      revision: 0,
      type: "text",
      common: common("root", 3, null, 4),
      data: {
        text: "Layer text",
        style: {
          fontFamily: "Fixture Sans",
          fontSize: 42,
          color: "#fff",
        },
      },
    },
    audio: {
      layerDocumentId: "audio",
      name: "Audio",
      revision: 0,
      type: "audio",
      common: common("root", 4, null, 5),
      data: {
        gain: 1,
        muted: false,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      },
    },
    video: {
      layerDocumentId: "video",
      name: "Video",
      revision: 0,
      type: "video",
      common: common("root", 5, null, 6),
      data: {},
    },
    shape: {
      layerDocumentId: "shape",
      name: "Shape",
      revision: 0,
      type: "shape",
      common: common("root", 6, null, 7),
      data: { documentVersion: 1, shapes: [] },
    },
    group: {
      layerDocumentId: "group",
      name: "Group",
      revision: 0,
      type: "group",
      common: common("root", 7, null, 8),
      data: {
        role: "composition",
        width: 500,
        height: 500,
        frameRate: 24,
        durationFrames: 120,
      },
    },
    unknown: {
      layerDocumentId: "unknown",
      name: "Unknown",
      revision: 0,
      type: "unknown",
      common: common("root", 8, null, 9),
      data: { originalType: "plugin", rawData: {} },
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "properties-controller",
      name: "Properties controller",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: {
        sourcesById: {
          document: {
            sourceId: "document",
            kind: "psd-document",
            displayName: "fixture.psd",
            version: 1,
            refresh: { status: "normal" },
            locator: {
              locatorId: "linked:document",
              kind: "linked-file",
              suggestedFileName: "fixture.psd",
              relativePathHint: null,
            },
            contentFingerprint: null,
            data: {
              importSettings: {
                compositionName: "Fixture",
                hiddenLayerMode: "preserve",
              },
            },
          },
          shared: {
            sourceId: "shared",
            kind: "psd-node",
            displayName: "Shared pixels",
            version: 1,
            refresh: { status: "normal" },
            data: {
              documentSourceId: "document",
              sourceKey: "shared",
              sourcePath: "shared",
              visualFingerprint: "shared-v1",
            },
          },
        },
      },
    },
  };
}

let project = projectFixture();
let selectedLayerDocumentId: string | null = "psd-a";
let globalFrame = 13;
let draftPatch: PreviewSceneTransformPatch | null = null;
let previewFails = false;
let commitFails = false;
let dispatchFails = false;
let projectUpdateCount = 0;
let historyEntryCount = 0;
let selectedKeyframe: ReturnType<
  LayerDocumentPropertiesCommandPort["readSelectedKeyframe"]
> = null;
let runtime: LayerDocumentPropertiesRuntimeState = {
  selectedLayerDocumentId: null,
  selectedLayerRevision: null,
  globalFrame: -1,
  localFrame: null,
  focusedInputId: null,
  focusedTransform: null,
  inputDrafts: {},
};

function selectedLayer() {
  return selectedLayerDocumentId
    ? project.payload.layerDocumentsById[selectedLayerDocumentId]
    : null;
}

function commitProject(next: LayerDocumentProject) {
  project = next;
  projectUpdateCount += 1;
  historyEntryCount += 1;
}

function dispatchPanel(command: LayerDocumentPropertiesCommand) {
  if (dispatchFails) return { ok: false as const };
  const prepared = prepareLayerDocumentPropertiesCommand({
    project,
    selectedLayerDocumentId,
    command,
  });
  if (prepared.ok) commitProject(prepared.transaction.after);
  return prepared;
}

const port: LayerDocumentPropertiesCommandPort = {
  read: () => {
    const descriptor = buildLayerDocumentPropertiesDescriptor({
      project,
      selectedLayerDocumentId,
      readSourceResolutionStatus: () => "available",
    });
    const layer = selectedLayer();
    if (!layer) {
      return {
        descriptor,
        globalFrame,
        localFrame: null,
        displayedTransform: null,
      };
    }
    const localFrame =
      globalFrame -
      layer.common.placement.startFrame +
      layer.common.placement.sourceOffsetFrames;
    const base = evaluateLayerDocumentTransform(layer, localFrame, 30);
    const evaluated = draftPatch
      ? applyLayerDocumentTransformDraft(base, draftPatch)
      : base;
    return {
      descriptor,
      globalFrame,
      localFrame,
      displayedTransform: {
        ...evaluated.transform,
        scaleLinked: layer.common.transform.scaleLinked,
        opacity: evaluated.opacity,
      },
    };
  },
  preview: (_layerDocumentId, patch) => {
    if (previewFails) return { ok: false };
    draftPatch = structuredClone(patch);
    return { ok: true };
  },
  commit: () => {
    if (commitFails) return { ok: false };
    const layer = selectedLayer();
    if (!layer || !draftPatch) return null;
    const localFrame =
      globalFrame -
      layer.common.placement.startFrame +
      layer.common.placement.sourceOffsetFrames;
    const prepared = buildUpdateLayerDocumentCommonTransaction(project, {
      layerDocumentId: layer.layerDocumentId,
      update: {
        kind: "commit-transform",
        localFrame,
        patch: draftPatch,
      },
    });
    draftPatch = null;
    if (prepared.ok) commitProject(prepared.transaction.after);
    return prepared;
  },
  cancel: () => {
    draftPatch = null;
  },
  dispatchPanel,
  dispatchTimeline: (intent: LayerDocumentTimelineIntent) => {
    const prepared = buildLayerDocumentTimelineIntentTransaction(
      project,
      intent
    );
    if (prepared.ok) {
      commitProject(prepared.transaction.after);
      selectedKeyframe = null;
    }
    return prepared;
  },
  selectKeyframe: (selection) => {
    selectedKeyframe = selection;
  },
  readSelectedKeyframe: () => selectedKeyframe,
};

const controller = createLayerDocumentPropertiesController({
  port,
  runtime: {
    read: () => runtime,
    replace: (next) => {
      runtime = next;
    },
  },
});

controller.syncSelection();
const initialUpdates = projectUpdateCount;
assert.equal(controller.focusNumericInput("position.x"), true);
assert.equal(controller.changeNumericInput("position.x", "25")?.ok, true);
assert.equal(projectUpdateCount, initialUpdates);
assert.equal(historyEntryCount, initialUpdates);
assert.equal(controller.keyDownNumericInput("position.x", "Enter"), "blur");
assert.equal(projectUpdateCount, initialUpdates + 1);
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.transform.position.x,
  25
);
controller.blurNumericInput("position.x");
assert.equal(projectUpdateCount, initialUpdates + 1);

assert.equal(controller.focusNumericInput("position.y"), true);
controller.changeNumericInput("position.y", "44");
controller.keyDownNumericInput("position.y", "Escape");
assert.equal(projectUpdateCount, initialUpdates + 1);
assert.equal(draftPatch, null);

assert.equal(controller.focusNumericInput("rotation.value"), true);
assert.deepEqual(
  controller.changeNumericInput("rotation.value", "-"),
  { ok: true, changed: false }
);
controller.blurNumericInput("rotation.value");
assert.equal(projectUpdateCount, initialUpdates + 1);
assert.equal(controller.focusNumericInput("opacity.value"), true);
controller.changeNumericInput("opacity.value", "999");
controller.blurNumericInput("opacity.value");
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.transform.opacity,
  100
);

const beforeSame = projectUpdateCount;
const displayedX = port.read().displayedTransform?.position.x;
assert.equal(controller.focusNumericInput("position.x"), true);
controller.changeNumericInput("position.x", String(displayedX));
controller.blurNumericInput("position.x");
assert.equal(projectUpdateCount, beforeSame);

previewFails = true;
controller.focusNumericInput("position.x");
assert.equal(controller.changeNumericInput("position.x", "88")?.ok, false);
assert.equal(controller.blurNumericInput("position.x")?.ok, false);
assert.equal(projectUpdateCount, beforeSame);
assert.equal(runtime.focusedInputId, "position.x");
previewFails = false;
controller.keyDownNumericInput("position.x", "Escape");

commitFails = true;
controller.focusNumericInput("position.x");
controller.changeNumericInput("position.x", "91");
assert.equal(
  controller.blurNumericInput("position.x")?.ok,
  false
);
assert.equal(runtime.focusedInputId, "position.x");
assert.notEqual(
  project.payload.layerDocumentsById["psd-a"]
    .common.transform.position.x,
  91
);
commitFails = false;
controller.keyDownNumericInput("position.x", "Escape");

const layerBeforeAnchor =
  project.payload.layerDocumentsById["psd-a"].common.transform;
const expectedOffset = getCompensatedTransformOffset(
  layerBeforeAnchor.transformOffset,
  layerBeforeAnchor.anchor,
  { ...layerBeforeAnchor.anchor, x: 75 },
  layerBeforeAnchor.scale,
  layerBeforeAnchor.rotation
);
controller.focusNumericInput("anchor.x");
controller.changeNumericInput("anchor.x", "75");
controller.blurNumericInput("anchor.x");
const anchored = project.payload.layerDocumentsById["psd-a"].common.transform;
assert.equal(anchored.anchor.x, 75);
assert.deepEqual(anchored.transformOffset, expectedOffset);

const beforeLinked = projectUpdateCount;
controller.toggleScaleLink();
assert.equal(projectUpdateCount, beforeLinked + 1);
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.transform.scaleLinked,
  false
);
controller.toggleScaleLink();
controller.focusNumericInput("scale.x");
controller.changeNumericInput("scale.x", "-25");
controller.blurNumericInput("scale.x");
assert.deepEqual(
  project.payload.layerDocumentsById["psd-a"].common.transform.scale,
  { x: 1, y: 1 }
);

for (const property of [
  "position",
  "scale",
  "rotation",
  "opacity",
] as const) {
  const before = projectUpdateCount;
  controller.togglePropertyTrack(property, true);
  const animation =
    project.payload.layerDocumentsById["psd-a"].common.animation;
  assert.equal(animation.enabledProperties[property], true);
  const keyframes = animation[
    `${property}Keyframes` as keyof LayerAnimation
  ];
  assert.equal(Array.isArray(keyframes) && keyframes.length > 0, true);
  assert.equal(projectUpdateCount, before + 1);
  assert.deepEqual(selectedKeyframe, {
    layerDocumentId: "psd-a",
    property,
    localFrame: port.read().localFrame,
    globalFrame,
  });
  controller.togglePropertyTrack(property, false);
  assert.equal(selectedKeyframe, null);
  assert.equal(
    project.payload.layerDocumentsById["psd-a"]
      .common.animation.enabledProperties[property],
    false
  );
}

controller.togglePropertyTrack("position", true);
const beforeEvaluatedSame = projectUpdateCount;
const evaluatedPositionX = port.read().displayedTransform?.position.x;
const positionKeyframeCount =
  project.payload.layerDocumentsById["psd-a"]
    .common.animation.positionKeyframes.length;
controller.focusNumericInput("position.x");
controller.changeNumericInput("position.x", String(evaluatedPositionX));
controller.blurNumericInput("position.x");
assert.equal(projectUpdateCount, beforeEvaluatedSame);
assert.equal(
  project.payload.layerDocumentsById["psd-a"]
    .common.animation.positionKeyframes.length,
  positionKeyframeCount
);

const selectedLocalFrame = port.read().localFrame ?? 0;
selectedKeyframe = {
  layerDocumentId: "psd-a",
  property: "position",
  localFrame: selectedLocalFrame,
  globalFrame,
};
controller.deleteSelectedKeyframe();
assert.equal(selectedKeyframe, null);
controller.savePositionKeyframe();
assert.deepEqual(selectedKeyframe, {
  layerDocumentId: "psd-a",
  property: "position",
  localFrame: selectedLocalFrame,
  globalFrame,
});
assert.equal(
  project.payload.layerDocumentsById["psd-a"]
    .common.animation.positionKeyframes.some(
      (keyframe) => keyframe.frame === selectedLocalFrame
    ),
  true
);
controller.deleteSelectedKeyframe();
assert.equal(selectedKeyframe, null);
assert.equal(
  project.payload.layerDocumentsById["psd-a"]
    .common.animation.positionKeyframes.length,
  0
);

controller.toggleModifier("wiggle");
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.modifiers.length,
  1
);
const addedWiggle =
  project.payload.layerDocumentsById["psd-a"].common.modifiers[0];
assert.equal(
  addedWiggle.type === "wiggle" && addedWiggle.frequency,
  0
);
assert.equal(
  addedWiggle.type === "wiggle" && addedWiggle.amount,
  0
);
dispatchFails = true;
controller.focusModifierInput("modifier.wiggle.frequency");
controller.changeModifierInput("modifier.wiggle.frequency", "8");
assert.equal(
  controller.blurModifierInput("modifier.wiggle.frequency")?.ok,
  false
);
assert.equal(
  runtime.focusedInputId,
  "modifier.wiggle.frequency"
);
dispatchFails = false;
controller.keyDownModifierInput(
  "modifier.wiggle.frequency",
  "Escape"
);
controller.focusModifierInput("modifier.wiggle.frequency");
controller.changeModifierInput("modifier.wiggle.frequency", "3.5");
controller.keyDownModifierInput("modifier.wiggle.frequency", "Enter");
controller.blurModifierInput("modifier.wiggle.frequency");
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.modifiers[0].type ===
    "wiggle" &&
    project.payload.layerDocumentsById["psd-a"].common.modifiers[0].frequency,
  3.5
);
const beforeModifierEscape = projectUpdateCount;
controller.focusModifierInput("modifier.wiggle.amount");
controller.changeModifierInput("modifier.wiggle.amount", "90");
controller.keyDownModifierInput("modifier.wiggle.amount", "Escape");
assert.equal(projectUpdateCount, beforeModifierEscape);

controller.toggleModifier("swing");
assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.modifiers.some(
    (modifier) => modifier.type === "swing"
  ),
  true
);
controller.focusModifierInput("modifier.swing.frequency");
controller.changeModifierInput("modifier.swing.frequency", "2");
controller.blurModifierInput("modifier.swing.frequency");
controller.focusModifierInput("modifier.swing.amount");
controller.changeModifierInput("modifier.swing.amount", "15");
controller.blurModifierInput("modifier.swing.amount");
const addedSwing = project.payload.layerDocumentsById["psd-a"].common.modifiers.find(
  (modifier) => modifier.type === "swing"
);
assert.equal(addedSwing?.type === "swing" && addedSwing.frequency, 2);
assert.equal(addedSwing?.type === "swing" && addedSwing.amount, 15);

controller.toggleModifier("oscillate");
controller.focusModifierInput("modifier.oscillate.angle");
controller.changeModifierInput("modifier.oscillate.angle", "90");
controller.blurModifierInput("modifier.oscillate.angle");
controller.focusModifierInput("modifier.oscillate.frequency");
controller.changeModifierInput("modifier.oscillate.frequency", "3");
controller.blurModifierInput("modifier.oscillate.frequency");
controller.focusModifierInput("modifier.oscillate.amount");
controller.changeModifierInput("modifier.oscillate.amount", "40");
controller.blurModifierInput("modifier.oscillate.amount");
const addedOscillate = project.payload.layerDocumentsById["psd-a"].common.modifiers.find(
  (modifier) => modifier.type === "oscillate"
);
assert.equal(addedOscillate?.type === "oscillate" && addedOscillate.angle, 90);
assert.equal(addedOscillate?.type === "oscillate" && addedOscillate.frequency, 3);
assert.equal(addedOscillate?.type === "oscillate" && addedOscillate.amount, 40);

controller.focusNumericInput("position.x");
globalFrame += 1;
assert.equal(controller.syncSelection(), true);
assert.equal(runtime.focusedInputId, null);
controller.focusNumericInput("position.x");
selectedLayerDocumentId = "psd-b";
assert.equal(controller.syncSelection(), true);
assert.equal(runtime.selectedLayerDocumentId, "psd-b");
controller.focusNumericInput("position.x");
project.payload.layerDocumentsById["psd-b"].revision += 1;
assert.equal(controller.syncSelection(), true);
assert.equal(runtime.focusedInputId, null);

assert.equal(
  project.payload.layerDocumentsById["psd-a"].common.source?.sourceId,
  project.payload.layerDocumentsById["psd-b"].common.source?.sourceId
);
assert.notDeepEqual(
  project.payload.layerDocumentsById["psd-a"].common.transform,
  project.payload.layerDocumentsById["psd-b"].common.transform
);

for (const layerDocumentId of [
  "psd-a",
  "drawing",
  "text",
  "audio",
  "video",
  "shape",
  "group",
  "unknown",
]) {
  const result = buildLayerDocumentPropertiesDescriptor({
    project,
    selectedLayerDocumentId: layerDocumentId,
    readSourceResolutionStatus: () => "available",
  });
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.descriptor.layerDocumentId, layerDocumentId);
    assert.equal(
      result.descriptor.typeData.kind,
      project.payload.layerDocumentsById[layerDocumentId].type
    );
  }
}

selectedLayerDocumentId = "root";
controller.syncSelection();
assert.equal(controller.focusNumericInput("position.x"), false);
assert.equal(controller.focusNumericInput("anchor.x"), false);
assert.equal(controller.focusNumericInput("scale.x"), true);
controller.changeNumericInput("scale.x", "125");
controller.blurNumericInput("scale.x");
assert.deepEqual(
  project.payload.layerDocumentsById.root.common.transform.scale,
  { x: 125, y: 125 }
);
assert.equal(controller.focusNumericInput("rotation.value"), true);
controller.keyDownNumericInput("rotation.value", "Escape");
assert.equal(controller.focusNumericInput("opacity.value"), true);
controller.keyDownNumericInput("opacity.value", "Escape");
for (const property of [
  "scale",
  "rotation",
  "opacity",
] as const) {
  controller.togglePropertyTrack(property, true);
  assert.equal(
    project.payload.layerDocumentsById.root
      .common.animation.enabledProperties[property],
    true
  );
  assert.equal(selectedKeyframe?.property, property);
  controller.togglePropertyTrack(property, false);
  assert.equal(selectedKeyframe, null);
}
assert.equal(
  controller.togglePropertyTrack("position", true),
  null
);
const rootViewProps =
  buildLayerDocumentPropertiesViewProps({
    controller,
    frameRate: 30,
  });
assert.equal(
  rootViewProps.readModel.rows.find(
    (row) => row.property === "position"
  )?.trackEditable,
  false
);
for (const property of [
  "scale",
  "rotation",
  "opacity",
] as const) {
  assert.equal(
    rootViewProps.readModel.rows.find(
      (row) => row.property === property
    )?.trackEditable,
    true
  );
}
assert.equal(
  typeof rootViewProps.commands.focusNumericInput,
  "function"
);

console.log("LayerDocument Properties controller verified");
