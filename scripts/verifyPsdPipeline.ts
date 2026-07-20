import assert from "node:assert/strict";
import { initializeCanvas, writePsd, type PixelData, type Psd } from "ag-psd";
import { loadPsd } from "@/engines/project/import/psdLoader";
import {
  importPreparedPsdPlanIntoProject,
  importPsdSourcesIntoProject,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import { mergeRefreshedMainCompIntoProject } from "@/engines/project/helpers/psd/psdCompositionMergeHelpers";
import { createDefaultModifier } from "@/engines/animation";
import { analyzeParsedPsd, preparePsdImportSource } from "@/engines/project/import/psdImportAnalyzer";
import { createPreparedPsdImportStore } from "@/engines/project/state/preparedPsdImportStore";
import { movePsdImportPlanNode } from "@/engines/psd-tree/helpers/psdImportPlanTreeHelpers";
import { findPsdImportPlanNode } from "@/engines/psd-tree/helpers/psdImportPlanTreeHelpers";
import { parsePsdToComposition } from "@/engines/project/import/psdCompositionBuilder";
import { buildPsdRefreshSourceMatches } from "@/engines/project/helpers/psd/psdSourceMatchingHelpers";
import { normalizePsdImportSettings } from "@/engines/project/import/psdImportSettingsHelpers";
import {
  acknowledgeCompositionSourceStatus,
  acknowledgeTimelineSourceStatus,
} from "@/engines/project/helpers/psd/psdSourceCleanupHelpers";
import { createPsdRefreshSummary } from "@/engines/project/helpers/psd/psdSourceStatusHelpers";

type TestImageData = ImageData & { data: Uint8ClampedArray };

class TestCanvasContext {
  private pixels: Uint8ClampedArray;
  private readonly canvas: TestCanvas;

  constructor(canvas: TestCanvas) {
    this.canvas = canvas;
    this.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }

  createImageData(width: number, height: number): TestImageData {
    return createImageData(width, height);
  }

  putImageData(imageData: TestImageData) {
    this.pixels = new Uint8ClampedArray(imageData.data);
  }

  getImageData(): TestImageData {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      data: new Uint8ClampedArray(this.pixels),
      colorSpace: "srgb",
    } as TestImageData;
  }
}

class TestCanvas {
  readonly context: TestCanvasContext;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.context = new TestCanvasContext(this);
  }

  getContext() {
    return this.context;
  }
}

function createImageData(width: number, height: number, red = 0): TestImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = red;
    data[index + 3] = 255;
  }

  return { width, height, data, colorSpace: "srgb" } as TestImageData;
}

initializeCanvas(
  (width, height) => new TestCanvas(width, height) as unknown as HTMLCanvasElement,
  (width, height) => createImageData(width, height)
);

const sourcePsd: Psd = {
  width: 8,
  height: 6,
  imageData: createImageData(8, 6) as PixelData,
  children: [
    {
      name: "Background",
      id: 1001,
      left: 1,
      top: 2,
      right: 5,
      bottom: 4,
      opacity: 0.5,
      imageData: createImageData(4, 2, 32) as PixelData,
    },
    {
      name: "Controls",
      id: 1002,
      hidden: true,
      children: [
        {
          name: "Button",
          id: 1003,
          left: 2,
          top: 1,
          right: 5,
          bottom: 3,
          imageData: createImageData(3, 2, 192) as PixelData,
        },
      ],
    },
  ],
};
const psdBytes = writePsd(sourcePsd);
const sourceFile = new File([psdBytes], "fixture.psd", {
  type: "image/vnd.adobe.photoshop",
});

const parsed = await loadPsd(sourceFile, 7);
const main = parsed.composition;
const nested = main.children[0];

assert.equal(main.id, "main-7-fixture");
assert.equal(main.name, "fixture.psd");
assert.deepEqual(main.importSettings, {
  compositionName: "fixture.psd",
  hiddenLayerMode: "preserve",
});
assert.deepEqual(JSON.parse(JSON.stringify(main.importSettings)), main.importSettings);
assert.equal(main.sourceSyncStatus, "normal");
assert.equal(main.layers.length, 1);
assert.equal(main.layers[0]?.name, "Background");
assert.deepEqual(main.layers[0]?.sourceIdentity, {
  sourceFileName: "fixture.psd",
  sourceKey: "layer-id:1001",
});
assert.deepEqual(main.layers[0]?.position, { x: 3, y: 3 });
assert.equal(main.layers[0]?.opacity, 50);
assert.equal(nested?.name, "Controls");
assert.equal(nested?.sourceIdentity?.sourceKey, "layer-id:1002");
assert.equal(nested?.parentId, main.id);
assert.equal(nested?.layers[0]?.name, "Button");
assert.equal(nested?.layers[0]?.sourceIdentity?.sourceKey, "layer-id:1003");
assert.equal(parsed.metaByCompId[main.id]?.layerCount, 2);
assert.equal(parsed.metaByCompId[nested.id]?.layerCount, 1);
assert.equal(parsed.timelineItemsByCompId[main.id]?.length, 2);
assert.equal(parsed.timelineItemsByCompId[main.id]?.[0]?.kind, "subComp");
assert.equal(parsed.timelineItemsByCompId[main.id]?.[0]?.visible, false);
assert.equal(parsed.timelineItemsByCompId[nested.id]?.[0]?.kind, "layer");
assert.equal(parsed.renderItemsByCompId[main.id]?.[0]?.kind, "subComp");
assert.equal(parsed.renderItemsByCompId[nested.id]?.[0]?.drawables[0]?.canvas?.width, 3);
assert.ok(main.sourceFingerprint);
assert.ok(main.layers[0]?.sourceFingerprint);

const existingMainWithModifier = {
  ...main,
  layers: main.layers.map((layer, index) => index === 0
    ? { ...layer, modifiers: [createDefaultModifier("wiggle", layer.id)] }
    : layer),
};
const refreshed = mergeRefreshedMainCompIntoProject(
  {
    comps: [existingMainWithModifier],
    metaByCompId: parsed.metaByCompId,
    timelineItemsByCompId: parsed.timelineItemsByCompId,
    renderItemsByCompId: parsed.renderItemsByCompId,
  },
  existingMainWithModifier,
  parsed
);
assert.equal(refreshed.comps[0]?.layers[0]?.modifiers[0]?.type, "wiggle");

const legacyMainWithoutIdentity = {
  ...main,
  sourceIdentity: undefined,
  layers: main.layers.map((layer) => ({ ...layer, sourceIdentity: undefined })),
  children: main.children.map((child) => ({
    ...child,
    sourceIdentity: undefined,
    layers: child.layers.map((layer) => ({ ...layer, sourceIdentity: undefined })),
  })),
};
const legacyIdentityUpgrade = mergeRefreshedMainCompIntoProject(
  {
    comps: [legacyMainWithoutIdentity],
    metaByCompId: parsed.metaByCompId,
    timelineItemsByCompId: parsed.timelineItemsByCompId,
    renderItemsByCompId: parsed.renderItemsByCompId,
  },
  legacyMainWithoutIdentity,
  parsed
);
assert.equal(legacyIdentityUpgrade.comps[0]?.sourceIdentity?.sourceKey, "document");
assert.deepEqual(legacyIdentityUpgrade.comps[0]?.importSettings, {
  compositionName: "fixture.psd",
  hiddenLayerMode: "preserve",
});
assert.equal(
  legacyIdentityUpgrade.comps[0]?.layers[0]?.sourceIdentity?.sourceKey,
  "layer-id:1001"
);
assert.equal(
  legacyIdentityUpgrade.comps[0]?.children[0]?.sourceIdentity?.sourceKey,
  "layer-id:1002"
);

const ignoredFile = new File(["not a psd"], "notes.txt", { type: "text/plain" });
const initialState = {
  comps: [],
  metaByCompId: {},
  timelineItemsByCompId: {},
  renderItemsByCompId: {},
  nextImportIndex: 0,
};
const firstImport = await importPsdSourcesIntoProject(
  [{ file: ignoredFile }, { file: sourceFile }],
  initialState
);

assert.equal(firstImport.comps.length, 1);
assert.equal(firstImport.nextImportIndex, 1);
assert.deepEqual(firstImport.failedFiles, []);
assert.deepEqual(firstImport.replacedFiles, []);
assert.equal(firstImport.importedSources[0]?.fileName, "fixture.psd");

const replacement = await importPsdSourcesIntoProject(
  [{ file: sourceFile }],
  firstImport
);

assert.equal(replacement.comps.length, 1);
assert.equal(replacement.nextImportIndex, 2);
assert.deepEqual(replacement.replacedFiles, ["fixture.psd"]);
assert.equal(replacement.importedSources[0]?.replacedCompId, "main-0-fixture");
assert.equal(replacement.comps[0]?.id, "main-1-fixture");
assert.equal(replacement.metaByCompId["main-0-fixture"], undefined);
assert.equal(replacement.timelineItemsByCompId["main-0-fixture"], undefined);
assert.equal(replacement.renderItemsByCompId["main-0-fixture"], undefined);

assert.deepEqual(normalizePsdImportSettings(undefined, "Legacy Name"), {
  compositionName: "Legacy Name",
  hiddenLayerMode: "preserve",
});
assert.deepEqual(
  normalizePsdImportSettings(
    { compositionName: "  Custom Composition  ", hiddenLayerMode: "omit" },
    "fallback.psd"
  ),
  { compositionName: "Custom Composition", hiddenLayerMode: "omit" }
);
assert.deepEqual(
  normalizePsdImportSettings(
    { compositionName: "", hiddenLayerMode: "unsupported" },
    "fallback.psd"
  ),
  { compositionName: "fallback.psd", hiddenLayerMode: "preserve" }
);

const omittedHidden = await loadPsd(sourceFile, 8, {
  compositionName: "Visible Artwork",
  hiddenLayerMode: "omit",
});
assert.equal(omittedHidden.composition.name, "Visible Artwork");
assert.deepEqual(omittedHidden.composition.importSettings, {
  compositionName: "Visible Artwork",
  hiddenLayerMode: "omit",
});
assert.equal(omittedHidden.composition.children.length, 0);
assert.equal(omittedHidden.composition.layers.length, 1);
assert.equal(omittedHidden.timelineItemsByCompId[omittedHidden.composition.id]?.length, 1);

const duplicatePsd: Psd = {
  width: 10,
  height: 12,
  children: [
    { name: "눈", imageData: createImageData(1, 1) as PixelData },
    {
      name: "얼굴",
      children: [
        { name: "눈", imageData: createImageData(1, 1) as PixelData },
        { name: "눈", imageData: createImageData(1, 1) as PixelData },
        { name: "눈", children: [] },
      ],
    },
    { name: "눈", children: [] },
    { name: "눈", imageData: createImageData(1, 1) as PixelData },
  ],
};
const originalStructure = JSON.stringify(duplicatePsd, (key, value) =>
  key === "imageData" ? "pixel-data" : value
);
const duplicateAnalysis = analyzeParsedPsd(duplicatePsd);
assert.equal(duplicateAnalysis.groupCount, 3);
assert.equal(duplicateAnalysis.layerCount, 4);
assert.deepEqual(
  duplicateAnalysis.tree.filter((node) => node.originalName === "눈").map((node) => node.displayName),
  ["눈_1", "눈_2", "눈_3"]
);
assert.equal(
  duplicateAnalysis.tree.filter((node) => node.originalName === "눈").every((node) => node.autoRenamed),
  true
);
const face = duplicateAnalysis.tree.find((node) => node.originalName === "얼굴");
assert.deepEqual(face?.children.map((node) => node.displayName), ["눈_1", "눈_2", "눈_3"]);
assert.equal(JSON.stringify(duplicatePsd, (key, value) => key === "imageData" ? "pixel-data" : value), originalStructure);
const duplicateSourceKeys = duplicateAnalysis.tree.flatMap((node) => [
  node.sourceKey,
  ...node.children.map((child) => child.sourceKey),
]);
assert.equal(new Set(duplicateSourceKeys).size, duplicateSourceKeys.length);
assert.equal(duplicateSourceKeys.every((sourceKey) => sourceKey.startsWith("legacy-tree:")), true);

let parseCount = 0;
const duplicateFile = new File(["prepared"], "duplicate.psd");
const preparedResult = await preparePsdImportSource(
  { file: duplicateFile },
  "test-token",
  async () => {
    parseCount += 1;
    return duplicatePsd;
  }
);
assert.equal(parseCount, 1);
const serializedPreparedPlan = JSON.parse(JSON.stringify({
  entries: [preparedResult.planEntry],
}));
assert.deepEqual(serializedPreparedPlan.entries[0], preparedResult.planEntry);
assert.equal("parsedPsd" in preparedResult.planEntry, false);
assert.equal("source" in preparedResult.planEntry, false);
const store = createPreparedPsdImportStore();
store.register(preparedResult.prepared);
assert.equal(store.get("test-token")?.source.file, duplicateFile);
const editedTree = movePsdImportPlanNode(
  preparedResult.planEntry.tree,
  preparedResult.planEntry.tree.find((node) => node.kind === "layer")!.id,
  face!.id,
  "inside"
);
const preparedImport = importPreparedPsdPlanIntoProject(
  {
    entries: [{
      ...preparedResult.planEntry,
      settings: { compositionName: "Prepared Artwork", hiddenLayerMode: "preserve" },
      tree: editedTree,
    }],
  },
  store,
  initialState
);
assert.equal(parseCount, 1);
assert.equal(preparedImport.comps.length, 1);
assert.equal(preparedImport.importedSources.length, 1);
const preparedMain = preparedImport.comps[0]!;
assert.equal(preparedMain.name, "Prepared Artwork");
assert.deepEqual(preparedMain.importSettings, {
  compositionName: "Prepared Artwork",
  hiddenLayerMode: "preserve",
});
const preparedFace = preparedMain.children.find((child) => child.name === "얼굴")!;
assert.equal(preparedFace.layers.some((layer) => layer.name.startsWith("눈_")), true);
assert.deepEqual(
  preparedImport.timelineItemsByCompId[preparedMain.id]?.map((item) => item.name),
  editedTree.map((node) => node.displayName)
);
assert.equal(JSON.stringify(duplicatePsd, (key, value) => key === "imageData" ? "pixel-data" : value), originalStructure);
store.discard(["test-token"]);
assert.equal(store.size(), 0);

const hierarchySourcePsd: Psd = {
  width: 6,
  height: 6,
  children: [
    {
      name: "Left",
      id: 101,
      children: [
        {
          name: "Moved",
          id: 301,
          hidden: true,
          left: 0,
          top: 0,
          right: 2,
          bottom: 2,
          imageData: createImageData(2, 2, 20) as PixelData,
        },
      ],
    },
    {
      name: "Right",
      id: 202,
      children: [
        {
          name: "Stay",
          id: 302,
          left: 2,
          top: 2,
          right: 4,
          bottom: 4,
          imageData: createImageData(2, 2, 40) as PixelData,
        },
      ],
    },
  ],
};
const hierarchyAnalysis = analyzeParsedPsd(hierarchySourcePsd);
const movedPlanNode = hierarchyAnalysis.tree
  .flatMap((node) => node.children)
  .find((node) => node.originalName === "Moved")!;
const rightPlanNode = hierarchyAnalysis.tree.find((node) => node.originalName === "Right")!;
let hierarchyPlan = movePsdImportPlanNode(
  hierarchyAnalysis.tree,
  movedPlanNode.id,
  rightPlanNode.id,
  "inside"
);
const leftPlanNode = hierarchyPlan.find((node) => node.originalName === "Left")!;
hierarchyPlan = movePsdImportPlanNode(
  hierarchyPlan,
  rightPlanNode.id,
  leftPlanNode.id,
  "before"
);
assert.equal(findPsdImportPlanNode(hierarchyPlan, rightPlanNode.id)?.children.at(-1)?.originalName, "Moved");

const hierarchyImported = parsePsdToComposition(
  hierarchySourcePsd,
  "hierarchy.psd",
  20,
  { nodes: hierarchyPlan, sourceNodeByKey: hierarchyAnalysis.sourceNodeByKey }
);
const importedRight = hierarchyImported.composition.children.find((child) => child.name === "Right")!;
const importedMoved = importedRight.layers.find((layer) => layer.name === "Moved")!;
assert.deepEqual(importedRight.sourceIdentity, {
  sourceFileName: "hierarchy.psd",
  sourceKey: "layer-id:202",
});
assert.deepEqual(importedMoved.sourceIdentity, {
  sourceFileName: "hierarchy.psd",
  sourceKey: "layer-id:301",
});
assert.deepEqual(JSON.parse(JSON.stringify(importedMoved.sourceIdentity)), importedMoved.sourceIdentity);
const editedMoved = {
  ...importedMoved,
  name: "Editor Moved",
  sourcePath: "editor/custom/moved",
  sourceFingerprint: "editor-stale-layer",
};
const editedRight = {
  ...importedRight,
  name: "Editor Right",
  sourcePath: "editor/custom/right",
  sourceFingerprint: "editor-stale-group",
  layers: importedRight.layers.map((layer) =>
    layer.id === importedMoved.id ? editedMoved : layer
  ),
};
const hierarchyExistingMain = {
  ...hierarchyImported.composition,
  children: hierarchyImported.composition.children.map((child) =>
    child.id === importedRight.id ? editedRight : child
  ),
};
const hierarchyExistingTimeline = {
  ...hierarchyImported.timelineItemsByCompId,
  [hierarchyExistingMain.id]: hierarchyImported.timelineItemsByCompId[
    hierarchyExistingMain.id
  ]!.map((item) =>
    item.sourceId === editedRight.id ? { ...item, name: editedRight.name } : item
  ),
  [editedRight.id]: hierarchyImported.timelineItemsByCompId[editedRight.id]!.map((item) =>
    item.sourceId === editedMoved.id ? { ...item, name: editedMoved.name } : item
  ),
};
const hierarchyExistingRender = {
  ...hierarchyImported.renderItemsByCompId,
  [hierarchyExistingMain.id]: hierarchyImported.renderItemsByCompId[
    hierarchyExistingMain.id
  ]!.map((item) =>
    item.sourceId === editedRight.id ? { ...item, name: editedRight.name } : item
  ),
  [editedRight.id]: hierarchyImported.renderItemsByCompId[editedRight.id]!.map((item) =>
    item.sourceId === editedMoved.id ? { ...item, name: editedMoved.name } : item
  ),
};
const importedMainOrder = hierarchyExistingTimeline[hierarchyExistingMain.id]!.map(
  (item) => item.name
);
const importedRightOrder = hierarchyExistingTimeline[editedRight.id]!.map(
  (item) => item.name
);

const hierarchyRefreshedPsd: Psd = {
  ...hierarchySourcePsd,
  children: [
    {
      name: "Right",
      id: 202,
      children: hierarchySourcePsd.children![1]!.children,
    },
    {
      name: "Left",
      id: 101,
      children: [
        {
          name: "Moved",
          id: 301,
          left: 0,
          top: 0,
          right: 2,
          bottom: 2,
          imageData: createImageData(2, 2, 220) as PixelData,
        },
      ],
    },
  ],
};
const hierarchyRefreshed = parsePsdToComposition(
  hierarchyRefreshedPsd,
  "hierarchy.psd",
  21
);
const refreshedLeftForMismatch = hierarchyRefreshed.composition.children.find(
  (child) => child.name === "Left"
)!;
const refreshedMovedForMismatch = refreshedLeftForMismatch.layers.find(
  (layer) => layer.name === "Moved"
)!;
const mismatchedIdentityDocument = {
  ...hierarchyRefreshed.composition,
  children: hierarchyRefreshed.composition.children.map((child) =>
    child.id === refreshedLeftForMismatch.id
      ? {
          ...child,
          layers: child.layers.map((layer) =>
            layer.id === refreshedMovedForMismatch.id
              ? {
                  ...layer,
                  name: editedMoved.name,
                  sourcePath: editedMoved.sourcePath,
                  sourceFingerprint: editedMoved.sourceFingerprint,
                  sourceIdentity: {
                    sourceFileName: "hierarchy.psd",
                    sourceKey: "layer-id:999",
                  },
                }
              : layer
          ),
        }
      : child
  ),
};
assert.equal(
  buildPsdRefreshSourceMatches(hierarchyExistingMain, mismatchedIdentityDocument)
    .refreshedLayerByExistingId.has(editedMoved.id),
  false
);
const hierarchyMerged = mergeRefreshedMainCompIntoProject(
  {
    comps: [hierarchyExistingMain],
    metaByCompId: hierarchyImported.metaByCompId,
    timelineItemsByCompId: hierarchyExistingTimeline,
    renderItemsByCompId: hierarchyExistingRender,
  },
  hierarchyExistingMain,
  hierarchyRefreshed
);
const mergedHierarchyMain = hierarchyMerged.comps[0]!;
const mergedRight = mergedHierarchyMain.children.find((child) => child.name === "Editor Right")!;
const mergedLeft = mergedHierarchyMain.children.find((child) => child.name === "Left")!;
assert.deepEqual(
  hierarchyMerged.timelineItemsByCompId[mergedHierarchyMain.id]!.map((item) => item.name),
  importedMainOrder
);
assert.deepEqual(
  hierarchyMerged.timelineItemsByCompId[mergedRight.id]!.map((item) => item.name),
  importedRightOrder
);
assert.equal(mergedRight.layers.some((layer) => layer.name === "Editor Moved"), true);
assert.equal(mergedLeft.layers.some((layer) => layer.sourceIdentity?.sourceKey === "layer-id:301"), false);
assert.notEqual(
  mergedRight.layers.find((layer) => layer.name === "Editor Moved")!.sourceFingerprint,
  editedMoved.sourceFingerprint
);
const mergedMovedRender = hierarchyMerged.renderItemsByCompId[mergedRight.id]!.find(
  (item) => item.name === "Editor Moved"
)!;
assert.equal(mergedMovedRender.visible, true);
assert.equal(
  mergedMovedRender.sourceId,
  mergedRight.layers.find((layer) => layer.name === "Editor Moved")!.id
);

const newSourceBasePsd: Psd = {
  width: 8,
  height: 8,
  children: [
    {
      name: "Old Root",
      id: 701,
      imageData: createImageData(1, 1, 10) as PixelData,
    },
    {
      name: "Old Group",
      id: 710,
      children: [
        {
          name: "Old Nested",
          id: 711,
          imageData: createImageData(1, 1, 20) as PixelData,
        },
      ],
    },
  ],
};
const newSourceBase = parsePsdToComposition(newSourceBasePsd, "new-source.psd", 30);
const newSourceRefreshedPsd: Psd = {
  ...newSourceBasePsd,
  children: [
    newSourceBasePsd.children![0]!,
    {
      name: "New Root",
      id: 702,
      imageData: createImageData(1, 1, 30) as PixelData,
    },
    {
      ...newSourceBasePsd.children![1]!,
      children: [
        newSourceBasePsd.children![1]!.children![0]!,
        {
          name: "New Nested",
          id: 712,
          imageData: createImageData(1, 1, 40) as PixelData,
        },
      ],
    },
    {
      name: "New Group",
      id: 720,
      children: [
        {
          name: "New Group Child",
          id: 721,
          imageData: createImageData(1, 1, 50) as PixelData,
        },
      ],
    },
  ],
};
const newSourceRefreshed = parsePsdToComposition(
  newSourceRefreshedPsd,
  "new-source.psd",
  31
);
const newSourceMerged = mergeRefreshedMainCompIntoProject(
  {
    comps: [newSourceBase.composition],
    metaByCompId: newSourceBase.metaByCompId,
    timelineItemsByCompId: newSourceBase.timelineItemsByCompId,
    renderItemsByCompId: newSourceBase.renderItemsByCompId,
  },
  newSourceBase.composition,
  newSourceRefreshed
);
const newSourceMain = newSourceMerged.comps[0]!;
const newGroup = newSourceMain.children[0]!;
const oldGroup = newSourceMain.children[1]!;
const newRoot = newSourceMain.layers[0]!;
assert.equal(newGroup.name, "New Group");
assert.equal(newGroup.sourceSyncStatus, "new");
assert.equal(newGroup.layers[0]?.sourceSyncStatus, "new");
assert.equal(newRoot.name, "New Root");
assert.equal(newRoot.sourceSyncStatus, "new");
assert.equal(oldGroup.name, "Old Group");
assert.equal(oldGroup.layers[0]?.name, "New Nested");
assert.equal(oldGroup.layers[0]?.sourceSyncStatus, "new");
assert.equal(newSourceMerged.counts.newGroups, 1);
assert.equal(newSourceMerged.counts.newLayers, 3);
assert.equal(newSourceMerged.counts.missing, 0);
assert.equal(newSourceMerged.counts.deletePending, 0);
assert.deepEqual(
  newSourceMerged.timelineItemsByCompId[newSourceMain.id]!.map((item) => item.name),
  ["New Group", "New Root", "Old Group", "Old Root"]
);
assert.deepEqual(
  newSourceMerged.renderItemsByCompId[newSourceMain.id]!.map((item) => item.name),
  ["New Group", "New Root", "Old Group", "Old Root"]
);
assert.deepEqual(
  newSourceMerged.timelineItemsByCompId[oldGroup.id]!.map((item) => item.name),
  ["New Nested", "Old Nested"]
);
assert.equal(JSON.parse(JSON.stringify(newSourceMain)).children[0].sourceSyncStatus, "new");

const acknowledgedGroupComps = acknowledgeCompositionSourceStatus(
  newSourceMerged.comps,
  newGroup.id
);
assert.equal(acknowledgedGroupComps[0]?.children?.[0]?.sourceSyncStatus, "normal");
assert.equal(acknowledgedGroupComps[0]?.children?.[0]?.layers[0]?.sourceSyncStatus, "new");
assert.equal(
  acknowledgeCompositionSourceStatus(acknowledgedGroupComps, newGroup.id),
  acknowledgedGroupComps
);
const newRootTimelineItem = newSourceMerged.timelineItemsByCompId[newSourceMain.id]!.find(
  (item) => item.sourceId === newRoot.id
)!;
const acknowledgedLayerComps = acknowledgeTimelineSourceStatus(
  acknowledgedGroupComps,
  newRootTimelineItem
);
assert.equal(acknowledgedLayerComps[0]?.layers[0]?.sourceSyncStatus, "normal");

const repeatedAcknowledgedMerge = mergeRefreshedMainCompIntoProject(
  {
    comps: [acknowledgedLayerComps[0]!],
    metaByCompId: newSourceMerged.metaByCompId,
    timelineItemsByCompId: newSourceMerged.timelineItemsByCompId,
    renderItemsByCompId: newSourceMerged.renderItemsByCompId,
  },
  acknowledgedLayerComps[0]!,
  parsePsdToComposition(newSourceRefreshedPsd, "new-source.psd", 32)
);
assert.equal(repeatedAcknowledgedMerge.comps[0]?.children?.[0]?.sourceSyncStatus, "normal");
assert.equal(repeatedAcknowledgedMerge.comps[0]?.layers[0]?.sourceSyncStatus, "normal");
assert.deepEqual(repeatedAcknowledgedMerge.counts, {
  newGroups: 0,
  newLayers: 0,
  updated: 0,
  missing: 0,
  deletePending: 0,
});

const repeatedNewMerge = mergeRefreshedMainCompIntoProject(
  {
    comps: [newSourceMain],
    metaByCompId: newSourceMerged.metaByCompId,
    timelineItemsByCompId: newSourceMerged.timelineItemsByCompId,
    renderItemsByCompId: newSourceMerged.renderItemsByCompId,
  },
  newSourceMain,
  parsePsdToComposition(newSourceRefreshedPsd, "new-source.psd", 32)
);
assert.equal(repeatedNewMerge.comps[0]?.children?.[0]?.sourceSyncStatus, "new");
assert.equal(repeatedNewMerge.comps[0]?.layers[0]?.sourceSyncStatus, "new");
assert.deepEqual(repeatedNewMerge.counts, {
  newGroups: 0,
  newLayers: 0,
  updated: 0,
  missing: 0,
  deletePending: 0,
});
const unchangedSummary = createPsdRefreshSummary(
  newSourceMain.id,
  newSourceMain.name,
  repeatedNewMerge.counts
);
assert.equal(unchangedSummary.problematic, 0);
assert.deepEqual(JSON.parse(JSON.stringify(unchangedSummary)), unchangedSummary);

const problemExisting = {
  ...newSourceBase.composition,
  layers: newSourceBase.composition.layers.map((layer) => ({
    ...layer,
    sourceSyncStatus: "missing" as const,
  })),
};
const emptyRefresh = parsePsdToComposition(
  { width: 8, height: 8, children: [] },
  "new-source.psd",
  33
);
const problemMerge = mergeRefreshedMainCompIntoProject(
  {
    comps: [problemExisting],
    metaByCompId: newSourceBase.metaByCompId,
    timelineItemsByCompId: newSourceBase.timelineItemsByCompId,
    renderItemsByCompId: newSourceBase.renderItemsByCompId,
  },
  problemExisting,
  emptyRefresh
);
assert.equal(problemMerge.counts.missing, 1);
assert.equal(problemMerge.counts.deletePending, 1);
const problemSummary = createPsdRefreshSummary(
  problemExisting.id,
  problemExisting.name,
  problemMerge.counts
);
assert.equal(problemSummary.problematic, 2);

console.log("PSD binary/import pipeline verification passed");
