import assert from "node:assert/strict";
import type {
  Composition,
  CompositionMeta,
  Layer,
  TimelineItem,
} from "@/models";
import {
  createProjectSelectionModelDeriver,
  type UseProjectSelectionModelOptions,
} from "@/engines/project/useProjectSelectionModel";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};

function makeLayer(name = "Layer A"): Layer {
  return {
    id: "layer-a",
    name,
    visible: true,
    sourceFingerprint: `fingerprint:${name}`,
    position: { x: 10, y: 10 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 5, y: 5 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeScene(layer: Layer): Composition {
  return {
    id: "scene-a",
    name: "Scene A",
    type: "main",
    layers: [layer],
    children: [],
    position: { x: 20, y: 15 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 20, y: 15 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeMeta(durationFrames = 30): CompositionMeta {
  return {
    width: 40,
    height: 30,
    layerCount: 1,
    sourceFileName: "identity.psd",
    frameRate: 30,
    durationFrames,
  };
}

function makeLayerTimeline(name = "Layer A"): TimelineItem {
  return {
    id: "timeline-layer-a",
    name,
    kind: "layer",
    visible: true,
    compId: "scene-a",
    sourceId: "layer-a",
    startFrame: 0,
    durationFrames: 30,
  };
}

function makeOptions(): UseProjectSelectionModelOptions {
  const layer = makeLayer();
  const scene = makeScene(layer);
  return {
    masterCompId: "master",
    masterWidth: 40,
    masterHeight: 30,
    defaultFrameRate: 30,
    comps: [scene],
    masterEnabledProperties: { ...disabledProperties },
    masterAnchor: { x: 20, y: 15 },
    masterScale: { x: 100, y: 100 },
    masterScaleKeyframes: [],
    masterScaleLinked: true,
    masterRotation: 0,
    masterRotationKeyframes: [],
    masterOpacity: 100,
    masterOpacityKeyframes: [],
    selectedCompId: scene.id,
    selectedLayerId: layer.id,
    selectedTimelineTarget: {
      itemId: "timeline-layer-a",
      sourceId: layer.id,
      kind: "layer",
    },
    metaByCompId: { [scene.id]: makeMeta() },
    timelineItemsByCompId: {
      master: [],
      [scene.id]: [makeLayerTimeline()],
    },
  };
}

const deriver = createProjectSelectionModelDeriver();
const options = makeOptions();
const initial = deriver.derive(options);
const repeated = deriver.derive(options);
assert.equal(repeated, initial);

const equivalentSelection = deriver.derive({
  ...options,
  selectedTimelineTarget: {
    itemId: "replacement-item-id",
    sourceId: "layer-a",
    kind: "layer",
  },
});
assert.equal(equivalentSelection, initial);
assert.equal(equivalentSelection.masterTimelineItems, initial.masterTimelineItems);
assert.equal(equivalentSelection.masterComp, initial.masterComp);
assert.equal(equivalentSelection.rootComps, initial.rootComps);
assert.equal(equivalentSelection.allLayersById, initial.allLayersById);
assert.equal(equivalentSelection.allCompositionsById, initial.allCompositionsById);
assert.equal(equivalentSelection.selectedTransformTarget, initial.selectedTransformTarget);

const withoutLayer = deriver.derive({
  ...options,
  selectedLayerId: null,
  selectedTimelineTarget: null,
});
assert.notEqual(withoutLayer, initial);
assert.equal(withoutLayer.masterTimelineItems, initial.masterTimelineItems);
assert.equal(withoutLayer.masterComp, initial.masterComp);
assert.equal(withoutLayer.rootComps, initial.rootComps);
assert.equal(withoutLayer.allLayersById, initial.allLayersById);
assert.equal(withoutLayer.allCompositionsById, initial.allCompositionsById);
assert.equal(withoutLayer.selectedLayer, null);
assert.equal(withoutLayer.selectedTransformTarget, null);
assert.equal(withoutLayer.selectedPropertyTarget, initial.selectedComp);

const compositionSelectionDeriver = createProjectSelectionModelDeriver();
const compositionSelectionBase = compositionSelectionDeriver.derive(options);
const compositionChanged = compositionSelectionDeriver.derive({
  ...options,
  selectedCompId: "master",
  selectedLayerId: null,
  selectedTimelineTarget: null,
});
assert.equal(
  compositionChanged.masterTimelineItems,
  compositionSelectionBase.masterTimelineItems
);
assert.equal(compositionChanged.masterComp, compositionSelectionBase.masterComp);
assert.equal(compositionChanged.rootComps, compositionSelectionBase.rootComps);
assert.equal(compositionChanged.allLayersById, compositionSelectionBase.allLayersById);
assert.equal(
  compositionChanged.allCompositionsById,
  compositionSelectionBase.allCompositionsById
);
assert.equal(compositionChanged.selectedComp, compositionChanged.masterComp);
assert.equal(compositionChanged.selectedTimelineItems, compositionChanged.masterTimelineItems);
assert.notEqual(compositionChanged.selectedMeta, compositionSelectionBase.selectedMeta);

const timelineItems = [makeLayerTimeline("Updated Timeline Name")];
const timelineDeriver = createProjectSelectionModelDeriver();
const timelineBase = timelineDeriver.derive(options);
const timelineChanged = timelineDeriver.derive({
  ...options,
  timelineItemsByCompId: {
    ...options.timelineItemsByCompId,
    [options.selectedCompId]: timelineItems,
  },
});
assert.equal(timelineChanged.masterTimelineItems, timelineBase.masterTimelineItems);
assert.equal(timelineChanged.masterComp, timelineBase.masterComp);
assert.equal(timelineChanged.allLayersById, timelineBase.allLayersById);
assert.equal(timelineChanged.allCompositionsById, timelineBase.allCompositionsById);
assert.equal(timelineChanged.selectedTimelineItems, timelineItems);

const masterTimelineDeriver = createProjectSelectionModelDeriver();
const masterTimelineBase = masterTimelineDeriver.derive(options);
const masterTimelineChanged = masterTimelineDeriver.derive({
  ...options,
  timelineItemsByCompId: {
    ...options.timelineItemsByCompId,
    master: [{
      id: "master-timeline-scene-a",
      name: "Scene A",
      kind: "subComp",
      visible: true,
      compId: "master",
      sourceId: "scene-a",
      targetCompId: "scene-a",
      startFrame: 5,
      durationFrames: 30,
    }],
  },
});
assert.notEqual(
  masterTimelineChanged.masterTimelineItems,
  masterTimelineBase.masterTimelineItems
);
assert.equal(masterTimelineChanged.masterTimelineItems[0]?.startFrame, 5);
assert.equal(masterTimelineChanged.masterComp, masterTimelineBase.masterComp);
assert.equal(masterTimelineChanged.rootComps, masterTimelineBase.rootComps);
assert.equal(masterTimelineChanged.allLayersById, masterTimelineBase.allLayersById);
assert.equal(
  masterTimelineChanged.allCompositionsById,
  masterTimelineBase.allCompositionsById
);

const updatedMeta = makeMeta(60);
const metaDeriver = createProjectSelectionModelDeriver();
const metaBase = metaDeriver.derive(options);
const metaChanged = metaDeriver.derive({
  ...options,
  metaByCompId: { [options.selectedCompId]: updatedMeta },
});
assert.notEqual(metaChanged.masterTimelineItems, metaBase.masterTimelineItems);
assert.equal(metaChanged.masterTimelineItems[0]?.durationFrames, 60);
assert.equal(metaChanged.masterComp, metaBase.masterComp);
assert.equal(metaChanged.rootComps, metaBase.rootComps);
assert.equal(metaChanged.allLayersById, metaBase.allLayersById);
assert.equal(metaChanged.allCompositionsById, metaBase.allCompositionsById);
assert.equal(metaChanged.selectedMeta, updatedMeta);

const masterScale = { x: 125, y: 80 };
const masterDeriver = createProjectSelectionModelDeriver();
const masterBase = masterDeriver.derive(options);
const masterChanged = masterDeriver.derive({ ...options, masterScale });
assert.equal(masterChanged.masterTimelineItems, masterBase.masterTimelineItems);
assert.notEqual(masterChanged.masterComp, masterBase.masterComp);
assert.deepEqual(masterChanged.masterComp.scale, masterScale);
assert.notEqual(masterChanged.rootComps, masterBase.rootComps);
assert.equal(masterChanged.allLayersById, masterBase.allLayersById);
assert.notEqual(masterChanged.allCompositionsById, masterBase.allCompositionsById);
assert.equal(masterChanged.selectedComp, masterBase.selectedComp);
assert.equal(masterChanged.selectedLayer, masterBase.selectedLayer);

const refreshedLayer = makeLayer("Layer A Refreshed");
const refreshedScene = makeScene(refreshedLayer);
const projectDeriver = createProjectSelectionModelDeriver();
const projectBase = projectDeriver.derive(options);
const projectChanged = projectDeriver.derive({ ...options, comps: [refreshedScene] });
assert.notEqual(projectChanged.masterTimelineItems, projectBase.masterTimelineItems);
assert.notEqual(projectChanged.masterComp, projectBase.masterComp);
assert.notEqual(projectChanged.rootComps, projectBase.rootComps);
assert.notEqual(projectChanged.allLayersById, projectBase.allLayersById);
assert.notEqual(projectChanged.allCompositionsById, projectBase.allCompositionsById);
assert.equal(projectChanged.selectedComp, refreshedScene);
assert.equal(projectChanged.selectedLayer, refreshedLayer);
assert.equal(projectChanged.selectedPropertyTarget, refreshedLayer);

const masterSelectionDeriver = createProjectSelectionModelDeriver();
const masterSelected = masterSelectionDeriver.derive({
  ...options,
  selectedCompId: "master",
  selectedLayerId: null,
  selectedTimelineTarget: {
    itemId: "master-timeline-scene-a",
    sourceId: "scene-a",
    kind: "subComp",
  },
});
assert.equal(masterSelected.selectedComp, masterSelected.masterComp);
assert.equal(masterSelected.selectedTimelineComp, options.comps[0]);
assert.equal(masterSelected.selectedTransformTarget?.kind, "composition");
assert.equal(masterSelected.selectedMeta?.durationFrames, 150);
assert.equal(masterSelected.selectedTimelineItems, masterSelected.masterTimelineItems);

const timelineTargetCleared = masterSelectionDeriver.derive({
  ...options,
  selectedCompId: "master",
  selectedLayerId: null,
  selectedTimelineTarget: null,
});
assert.equal(timelineTargetCleared.masterComp, masterSelected.masterComp);
assert.equal(timelineTargetCleared.rootComps, masterSelected.rootComps);
assert.equal(timelineTargetCleared.allLayersById, masterSelected.allLayersById);
assert.equal(
  timelineTargetCleared.allCompositionsById,
  masterSelected.allCompositionsById
);
assert.equal(timelineTargetCleared.selectedTimelineComp, null);
assert.equal(timelineTargetCleared.selectedTransformTarget, null);
assert.equal(timelineTargetCleared.propertiesTransformTarget?.kind, "composition");

const fallback = masterSelectionDeriver.derive({
  ...options,
  selectedCompId: "missing-composition",
  selectedLayerId: null,
  selectedTimelineTarget: null,
});
assert.equal(fallback.selectedComp, fallback.masterComp);
assert.equal(fallback.propertiesTransformTarget?.kind, "composition");
assert.equal(fallback.propertiesScaleTarget, fallback.masterComp);

console.log("Project selection model identity verification passed");
