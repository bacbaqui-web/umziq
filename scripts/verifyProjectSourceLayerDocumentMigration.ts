import assert from "node:assert/strict";
import {
  createPropertyTrackState,
  findNonPlainDataPath,
  validateLayerDocumentProject,
} from "@/models";
import {
  PROJECT_SOURCE_SCHEMA_VERSION,
  migrateProjectSourceToLayerDocumentProject,
  normalizeLegacyProjectSources,
  type Composition,
  type CompositionMeta,
  type FutureLayerSource,
  type GroupSource,
  type Layer,
  type ProjectSource,
  type ProjectSourceDocument,
  type ProjectSourceTransform,
  type PsdLayerSource,
  type TimelineItem,
  type TimelineItemReference,
} from "@/models/offlineMigration";
function buildMasterTimelineItems(
  sceneComps: Composition[],
  existingItems: TimelineItem[],
  metaByCompId: Record<string, CompositionMeta>,
  options: { masterCompId: string }
): TimelineItem[] {
  const existingBySourceId = new Map(
    existingItems.map((item) => [item.sourceId, item])
  );
  let nextFrame = 0;
  return sceneComps.map((scene) => {
    const existing = existingBySourceId.get(scene.id);
    const durationFrames =
      existing?.durationFrames ??
      metaByCompId[scene.id]?.durationFrames ??
      300;
    const startFrame = existing?.startFrame ?? nextFrame;
    nextFrame = startFrame + durationFrames;
    return {
      id: `${options.masterCompId}-timeline-${scene.id}`,
      name: scene.name,
      kind: "subComp",
      visible: true,
      compId: options.masterCompId,
      sourceId: scene.id,
      startFrame,
      durationFrames,
      targetCompId: scene.id,
    };
  });
}

function buildMasterComposition(
  sceneComps: Composition[],
  enabledProperties: ReturnType<typeof createPropertyTrackState>,
  options: {
    masterCompId: string;
    masterWidth: number;
    masterHeight: number;
  }
): Composition {
  return {
    id: options.masterCompId,
    name: "Master Composition",
    type: "master",
    children: sceneComps,
    layers: [],
    position: {
      x: options.masterWidth / 2,
      y: options.masterHeight / 2,
    },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: {
      x: options.masterWidth / 2,
      y: options.masterHeight / 2,
    },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties,
    modifiers: [],
  };
}

function buildMasterMeta(
  sceneComps: Composition[],
  items: TimelineItem[],
  metaByCompId: Record<string, CompositionMeta>,
  options: {
    masterCompId: string;
    defaultFrameRate: number;
    masterWidth: number;
    masterHeight: number;
  }
): CompositionMeta {
  const first = sceneComps[0]
    ? metaByCompId[sceneComps[0].id]
    : null;
  const stored = metaByCompId[options.masterCompId];
  return {
    width: first?.width ?? options.masterWidth,
    height: first?.height ?? options.masterHeight,
    layerCount: sceneComps.length,
    sourceFileName: "Project",
    frameRate: stored?.frameRate ?? options.defaultFrameRate,
    durationFrames:
      stored?.durationFrames ??
      Math.max(
        300,
        ...items.map((item) =>
          item.startFrame + item.durationFrames
        )
      ),
  };
}

function transform(seed: number): ProjectSourceTransform {
  return {
    position: { x: seed, y: seed + 1 },
    transformOffset: { x: seed + 2, y: seed + 3 },
    anchor: { x: seed + 4, y: seed + 5 },
    scale: { x: 100 + seed, y: 100 - seed },
    scaleLinked: seed % 2 === 0,
    rotation: seed * 2,
    opacity: 100 - seed,
  };
}

function commonSourceFields(sourceId: string, name: string, seed: number) {
  return {
    sourceId,
    name,
    availability: "available" as const,
    syncStatus: "normal" as const,
    sourceVersion: seed + 1,
    transform: transform(seed),
    animation: {
      positionKeyframes: [
        { frame: 0, value: { x: seed, y: seed + 1 } },
      ],
      scaleKeyframes: [
        { frame: 0, value: { x: 100 + seed, y: 100 - seed } },
      ],
      rotationKeyframes: [{ frame: 0, value: seed * 2 }],
      opacityKeyframes: [{ frame: 0, value: 100 - seed }],
      enabledProperties: {
        position: true,
        scale: false,
        rotation: true,
        opacity: false,
      },
    },
    modifiers: [
      {
        id: `modifier-${sourceId}`,
        type: "wiggle" as const,
        frequency: seed + 1,
        amount: seed + 2,
      },
    ],
    effects: [
      {
        effectId: `effect-${sourceId}`,
        type: "fixture-effect",
        enabled: true,
        parameters: { seed },
      },
    ],
  };
}

function defaultCommonSourceFields(sourceId: string, name: string) {
  return {
    sourceId,
    name,
    availability: "available" as const,
    syncStatus: "normal" as const,
    sourceVersion: 1,
    transform: {
      position: { x: 0, y: 0 },
      transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: 0,
      opacity: 100,
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
    modifiers: [],
    effects: [],
  };
}

function groupSource(
  sourceId: string,
  name: string,
  seed: number,
  options: {
    sourceKey?: string;
    sourcePath?: string;
    withImportSettings?: boolean;
  } = {}
): GroupSource {
  const sourceKey = options.sourceKey;
  return {
    ...commonSourceFields(sourceId, name, seed),
    type: "group",
    content: {
      timelineId: sourceId,
      legacyCompositionType:
        sourceId === "root" ? "master" : sourceKey ? "sub" : null,
      sourceIdentity: sourceKey
        ? {
            sourceFileName: "sample.psd",
            sourceKey,
          }
        : null,
      sourcePath: options.sourcePath ?? null,
      sourceFingerprint: sourceKey ? `fingerprint-${sourceId}` : null,
      importSettings: options.withImportSettings
        ? {
            compositionName: "Scene",
            hiddenLayerMode: "preserve",
          }
        : null,
    },
  };
}

function psdSource(
  sourceId: string,
  name: string,
  sourceKey: string,
  seed: number,
  availability: "available" | "missing" = "available"
): PsdLayerSource {
  return {
    ...commonSourceFields(sourceId, name, seed),
    availability,
    syncStatus: availability === "missing" ? "missing" : "normal",
    type: "psd",
    content: {
      sourceIdentity: {
        sourceFileName: "sample.psd",
        sourceKey,
      },
      sourcePath: `sample.psd/${name}`,
      sourceFingerprint: `fingerprint-${sourceId}`,
    },
  };
}

function futureSource(
  sourceId: string,
  type: "video" | "shape",
  data: FutureLayerSource["content"]["data"],
  seed: number
): FutureLayerSource {
  return {
    ...commonSourceFields(sourceId, sourceId, seed),
    type,
    content: {
      originalType: type,
      data,
    },
  };
}

function item(
  itemId: string,
  sourceId: string,
  groupId: string,
  overrides: Partial<TimelineItemReference> = {}
): TimelineItemReference {
  return {
    itemId,
    sourceId,
    groupId,
    alias: null,
    visible: true,
    startFrame: 0,
    durationFrames: 90,
    sourceOffsetFrames: 0,
    ...overrides,
  };
}

function createDocument(): ProjectSourceDocument {
  const sourcesById: Record<string, ProjectSource> = {
    root: groupSource("root", "Project Root", 0, {
      sourceKey: "document",
      sourcePath: "sample.psd",
      withImportSettings: true,
    }),
    "shared-group": groupSource("shared-group", "Shared Group", 1, {
      sourceKey: "group:1",
      sourcePath: "sample.psd/Shared Group",
      withImportSettings: true,
    }),
    "nested-group": groupSource("nested-group", "Nested Group", 2),
    "psd-logo": psdSource("psd-logo", "Logo", "layer:logo", 3),
    "psd-missing": psdSource(
      "psd-missing",
      "Missing",
      "layer:missing",
      4,
      "missing"
    ),
    drawing: {
      ...commonSourceFields("drawing", "Drawing", 5),
      type: "drawing",
      content: {
        documentVersion: 2,
        elements: [{ kind: "stroke", points: [1, 2, 3] }],
      },
    },
    text: {
      ...commonSourceFields("text", "Text", 6),
      type: "text",
      content: {
        text: "Hello",
        style: {
          fontFamily: "Fixture Sans",
          fontSize: 64,
          color: "#ff00ff",
        },
      },
    },
    audio: {
      ...commonSourceFields("audio", "Voice", 7),
      type: "audio",
      content: {
        descriptor: {
          kind: "file",
          fileName: "voice.wav",
          mimeType: "audio/wav",
        },
        durationFrames: 180,
      },
    },
    video: futureSource(
      "video",
      "video",
      {
        fileName: "clip.mp4",
        mimeType: "video/mp4",
        path: "media/clip.mp4",
        fingerprint: "video-fingerprint",
        durationFrames: 120,
        width: 1080,
        height: 1920,
      },
      8
    ),
    shape: futureSource(
      "shape",
      "shape",
      {
        documentVersion: 1,
        shapes: [{ kind: "rectangle", width: 100, height: 50 }],
      },
      9
    ),
    unknown: {
      ...commonSourceFields("unknown", "Plugin Layer", 10),
      type: "unknown",
      content: {
        originalType: "plugin-layer",
        data: {
          pluginValue: 42,
        },
      },
    },
    "unplaced-audio": {
      ...defaultCommonSourceFields("unplaced-audio", "Library Audio"),
      type: "audio",
      content: {
        descriptor: {
          kind: "file",
          fileName: "library.wav",
          mimeType: "audio/wav",
        },
        durationFrames: 240,
      },
    },
    "unplaced-audio-copy": {
      ...defaultCommonSourceFields(
        "unplaced-audio-copy",
        "Library Audio Copy"
      ),
      type: "audio",
      content: {
        descriptor: {
          kind: "file",
          fileName: "library.wav",
          mimeType: "audio/wav",
        },
        durationFrames: 240,
      },
    },
  };

  return {
    schemaVersion: PROJECT_SOURCE_SCHEMA_VERSION,
    sourcesById,
    rootSourceIds: ["root"],
    timelineItemsByGroupId: {
      root: [
        item("item-group-a", "shared-group", "root", {
          alias: "Shared A",
          startFrame: 5,
          durationFrames: 80,
          sourceOffsetFrames: 2,
        }),
        item("item-group-b", "shared-group", "root", {
          alias: "Shared B",
          visible: false,
          startFrame: 20,
          durationFrames: 60,
          sourceOffsetFrames: 10,
        }),
      ],
      "shared-group": [
        item("item-psd", "psd-logo", "shared-group", {
          visible: false,
        }),
        item("item-psd-missing", "psd-missing", "shared-group"),
        item("item-drawing", "drawing", "shared-group"),
        item("item-text-a", "text", "shared-group", {
          alias: "Text A",
          startFrame: 3,
          durationFrames: 40,
          sourceOffsetFrames: 7,
        }),
        item("item-text-b", "text", "shared-group", {
          alias: "Text B",
          startFrame: 50,
          durationFrames: 20,
        }),
        item("item-audio", "audio", "shared-group"),
        item("item-video", "video", "shared-group"),
        item("item-shape", "shape", "shared-group"),
        item("item-unknown", "unknown", "shared-group"),
        item("item-nested", "nested-group", "shared-group"),
      ],
      "nested-group": [
        item("item-nested-text", "text", "nested-group", {
          alias: "Nested Text",
        }),
      ],
    },
    compositionMetaByGroupId: {
      root: {
        width: 1080,
        height: 1920,
        layerCount: 2,
        sourceFileName: "sample.psd",
        frameRate: 30,
        durationFrames: 180,
      },
      "shared-group": {
        width: 1080,
        height: 1920,
        layerCount: 10,
        sourceFileName: "sample.psd",
        frameRate: 30,
        durationFrames: 90,
      },
      "nested-group": {
        width: 500,
        height: 500,
        layerCount: 1,
        sourceFileName: "",
        frameRate: 24,
        durationFrames: 45,
      },
    },
  };
}

function createActualMasterFixture() {
  const masterCompId = "virtual-master";
  const sourceLayer: Layer = {
    id: "actual-logo",
    name: "Actual Logo",
    visible: false,
    sourcePath: "actual.psd/Actual Logo",
    sourceIdentity: {
      sourceFileName: "actual.psd",
      sourceKey: "layer:actual-logo",
    },
    sourceFingerprint: "actual-logo-fingerprint",
    sourceSyncStatus: "normal",
    position: { x: 120, y: 240 },
    transformOffset: { x: 2, y: 4 },
    anchor: { x: 40, y: 50 },
    positionKeyframes: [{ frame: 5, value: { x: 125, y: 245 } }],
    scale: { x: 90, y: 90 },
    scaleKeyframes: [{ frame: 5, value: { x: 95, y: 95 } }],
    scaleLinked: true,
    rotation: 3,
    rotationKeyframes: [{ frame: 5, value: 4 }],
    opacity: 80,
    opacityKeyframes: [{ frame: 5, value: 75 }],
    enabledProperties: createPropertyTrackState({
      position: true,
      scale: true,
      rotation: true,
      opacity: true,
    }),
    modifiers: [{
      id: "actual-logo-wiggle",
      type: "wiggle",
      frequency: 2,
      amount: 3,
    }],
  };
  const scene: Composition = {
    id: "actual-scene",
    name: "Actual Scene",
    type: "main",
    parentId: masterCompId,
    sourcePath: "actual.psd",
    sourceIdentity: {
      sourceFileName: "actual.psd",
      sourceKey: "document",
    },
    importSettings: {
      compositionName: "Actual Scene",
      hiddenLayerMode: "preserve",
    },
    sourceFingerprint: "actual-document-fingerprint",
    sourceSyncStatus: "normal",
    children: [],
    layers: [sourceLayer],
    position: { x: 540, y: 960 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 540, y: 960 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: createPropertyTrackState(),
    modifiers: [],
  };
  const sceneMeta: CompositionMeta = {
    width: 1080,
    height: 1920,
    layerCount: 1,
    sourceFileName: "actual.psd",
    frameRate: 30,
    durationFrames: 75,
  };
  const masterTimelineItems = buildMasterTimelineItems(
    [scene],
    [],
    { [scene.id]: sceneMeta },
    { masterCompId }
  );
  const master = buildMasterComposition(
    [scene],
    createPropertyTrackState({ position: true }),
    {
      masterCompId,
      masterWidth: 1080,
      masterHeight: 1920,
    }
  );
  const masterMeta = buildMasterMeta(
    [scene],
    masterTimelineItems,
    { [scene.id]: sceneMeta },
    {
      masterCompId,
      defaultFrameRate: 30,
      masterWidth: 1080,
      masterHeight: 1920,
    }
  );
  const sceneTimelineItems: TimelineItem[] = [{
    id: "actual-logo-placement",
    name: sourceLayer.name,
    kind: "layer",
    visible: false,
    compId: scene.id,
    sourceId: sourceLayer.id,
    startFrame: 6,
    durationFrames: 45,
    sourceOffsetFrames: 3,
    sourceSyncStatus: "normal",
  }];
  const legacyInput = {
    compositions: [scene],
    virtualRootComposition: master,
    timelineItemsByCompId: {
      [masterCompId]: masterTimelineItems,
      [scene.id]: sceneTimelineItems,
    },
    metaByCompId: {
      [masterCompId]: masterMeta,
      [scene.id]: sceneMeta,
    },
  };
  return {
    legacyInput,
    master,
    masterMeta,
    masterTimelineItems,
    scene,
    sceneMeta,
    sceneTimelineItems,
    sourceLayer,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expectMigrationIssue(
  document: ProjectSourceDocument,
  expectedCode: string
) {
  const result = migrateProjectSourceToLayerDocumentProject({
    document,
    projectId: `project-${expectedCode}`,
    name: `Expected ${expectedCode}`,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.ok
      ? false
      : result.issues.some((issue) => issue.code === expectedCode),
    true
  );
}

const actualMasterFixture = createActualMasterFixture();
const actualLegacyInputSnapshot = clone(actualMasterFixture.legacyInput);
const actualCanonical = normalizeLegacyProjectSources(
  actualMasterFixture.legacyInput
);
assert.deepEqual(
  actualMasterFixture.legacyInput,
  actualLegacyInputSnapshot
);
const actualCanonicalSnapshot = clone(actualCanonical);
assert.deepEqual(actualCanonical.rootSourceIds, [
  actualMasterFixture.master.id,
]);
const actualRootSource =
  actualCanonical.sourcesById[actualMasterFixture.master.id];
assert.equal(actualRootSource.type, "group");
if (actualRootSource.type !== "group") {
  throw new Error("Expected actual normalized Master Group");
}
assert.equal(actualRootSource.content.sourceIdentity, null);
assert.equal(actualRootSource.content.legacyCompositionType, "master");
assert.equal(
  actualCanonical.compositionMetaByGroupId[actualRootSource.sourceId]
    .sourceFileName,
  "Project"
);
assert.equal(
  actualCanonical.timelineItemsByGroupId[actualRootSource.sourceId].length,
  1
);

const actualMasterMigration =
  migrateProjectSourceToLayerDocumentProject({
    document: actualCanonical,
    projectId: "project-actual-master",
    name: "Actual Master Project",
  });
assert.equal(actualMasterMigration.ok, true);
if (!actualMasterMigration.ok) {
  throw new Error(
    `Expected actual Master migration: ` +
    `${JSON.stringify(actualMasterMigration.issues)}`
  );
}
assert.deepEqual(actualCanonical, actualCanonicalSnapshot);
assert.deepEqual(
  validateLayerDocumentProject(actualMasterMigration.project),
  []
);
const actualLayers = Object.values(
  actualMasterMigration.project.payload.layerDocumentsById
);
const actualRootLayers = actualLayers.filter(
  (layer) =>
    layer.type === "group" && layer.data.role === "project-root"
);
assert.equal(actualRootLayers.length, 1);
const actualRootLayer = actualRootLayers[0];
assert.equal(actualRootLayer.name, actualMasterFixture.master.name);
assert.equal(actualRootLayer.revision, actualRootSource.sourceVersion);
assert.equal(actualRootLayer.common.source, null);
assert.equal(actualRootLayer.common.placement.parentLayerDocumentId, null);
assert.deepEqual(actualRootLayer.common.transform, actualRootSource.transform);
assert.deepEqual(actualRootLayer.common.animation, actualRootSource.animation);
assert.deepEqual(actualRootLayer.data, {
  role: "project-root",
  width: actualMasterFixture.masterMeta.width,
  height: actualMasterFixture.masterMeta.height,
  frameRate: actualMasterFixture.masterMeta.frameRate,
  durationFrames: actualMasterFixture.masterMeta.durationFrames,
});

const actualSceneLayers = actualLayers.filter(
  (layer) =>
    layer.type === "group" &&
    layer.common.placement.parentLayerDocumentId ===
      actualRootLayer.layerDocumentId
);
assert.equal(actualSceneLayers.length, 1);
const actualSceneLayer = actualSceneLayers[0];
const actualMasterPlacement =
  actualCanonical.timelineItemsByGroupId[actualRootSource.sourceId][0];
assert.equal(actualSceneLayer.name, actualMasterFixture.scene.name);
assert.deepEqual(actualSceneLayer.common.placement, {
  parentLayerDocumentId: actualRootLayer.layerDocumentId,
  order: 0,
  startFrame: actualMasterPlacement.startFrame,
  durationFrames: actualMasterPlacement.durationFrames,
  sourceOffsetFrames: actualMasterPlacement.sourceOffsetFrames,
  visible: actualMasterPlacement.visible,
  alias: actualMasterPlacement.alias,
});
const actualSceneRegistrySource =
  actualSceneLayer.common.source === null
    ? null
    : actualMasterMigration.project.payload.sourceRegistry.sourcesById[
        actualSceneLayer.common.source.sourceId
      ];
assert.equal(actualSceneRegistrySource?.kind, "psd-document");

const actualLogoLayers = actualLayers.filter(
  (layer) =>
    layer.type === "psd" &&
    layer.common.placement.parentLayerDocumentId ===
      actualSceneLayer.layerDocumentId
);
assert.equal(actualLogoLayers.length, 1);
const actualLogoLayer = actualLogoLayers[0];
const actualLogoSource =
  actualCanonical.sourcesById[actualMasterFixture.sourceLayer.id];
assert.equal(actualLogoSource.type, "psd");
if (actualLogoSource.type !== "psd") {
  throw new Error("Expected actual normalized PSD Layer Source");
}
assert.equal(actualLogoLayer.name, actualMasterFixture.sourceLayer.name);
assert.equal(actualLogoLayer.common.placement.visible, false);
assert.deepEqual(
  actualLogoLayer.common.transform,
  actualLogoSource.transform
);
assert.deepEqual(
  actualLogoLayer.common.animation,
  actualLogoSource.animation
);
assert.deepEqual(
  actualLogoLayer.common.modifiers,
  actualLogoSource.modifiers.map((modifier) => ({
    modifierId: modifier.id,
    type: modifier.type,
    enabled: true,
    frequency: modifier.frequency,
    amount: modifier.amount,
  }))
);
const actualLogoRegistrySource =
  actualLogoLayer.common.source === null
    ? null
    : actualMasterMigration.project.payload.sourceRegistry.sourcesById[
        actualLogoLayer.common.source.sourceId
      ];
assert.equal(actualLogoRegistrySource?.kind, "psd-node");
assert.equal(
  actualLogoRegistrySource?.kind === "psd-node"
    ? actualLogoRegistrySource.data.documentSourceId
    : null,
  actualSceneRegistrySource?.sourceId
);
assert.equal(
  Object.keys(
    actualMasterMigration.project.payload.sourceRegistry.sourcesById
  ).length,
  2
);

const input = createDocument();
const inputSnapshot = clone(input);
const migrated = migrateProjectSourceToLayerDocumentProject({
  document: input,
  projectId: "project-migration",
  name: "Migrated Project",
});
assert.equal(migrated.ok, true);
if (!migrated.ok) {
  throw new Error(`Expected migration success: ${JSON.stringify(migrated.issues)}`);
}
assert.deepEqual(input, inputSnapshot);
assert.deepEqual(validateLayerDocumentProject(migrated.project), []);
assert.equal(findNonPlainDataPath(migrated.project), null);
assert.equal(
  Object.keys(migrated.project.payload.layerDocumentsById).length,
  25
);

const layers = Object.values(migrated.project.payload.layerDocumentsById);
function layerAtPlacementPath(itemIds: string[]) {
  const layerId =
    migrated.report.layerDocumentIdByPlacementPath[JSON.stringify(itemIds)];
  assert.equal(typeof layerId, "string");
  const layer = migrated.project.payload.layerDocumentsById[layerId];
  assert.ok(layer);
  return layer;
}

const rootLayers = layers.filter(
  (layer) => layer.type === "group" && layer.data.role === "project-root"
);
assert.equal(rootLayers.length, 1);
const rootLayer = rootLayers[0];
assert.equal(rootLayer.name, input.sourcesById.root.name);
assert.equal(rootLayer.common.placement.parentLayerDocumentId, null);
assert.equal(rootLayer.data.durationFrames, 180);

const sharedGroups = layers.filter(
  (layer) =>
    layer.type === "group" &&
    layer.data.role === "composition" &&
    layer.common.placement.parentLayerDocumentId === rootLayer.layerDocumentId
);
assert.equal(sharedGroups.length, 2);
assert.notEqual(
  sharedGroups[0].layerDocumentId,
  sharedGroups[1].layerDocumentId
);
assert.deepEqual(
  sharedGroups.map((layer) => layer.common.placement.alias),
  ["Shared A", "Shared B"]
);
assert.deepEqual(
  sharedGroups.map((layer) => layer.name),
  ["Shared Group", "Shared Group"]
);
assert.deepEqual(
  sharedGroups.map((layer) => layer.common.placement.order),
  [0, 1]
);
assert.deepEqual(
  sharedGroups.map((layer) => ({
    startFrame: layer.common.placement.startFrame,
    durationFrames: layer.common.placement.durationFrames,
    sourceOffsetFrames: layer.common.placement.sourceOffsetFrames,
    visible: layer.common.placement.visible,
  })),
  [
    {
      startFrame: 5,
      durationFrames: 80,
      sourceOffsetFrames: 2,
      visible: true,
    },
    {
      startFrame: 20,
      durationFrames: 60,
      sourceOffsetFrames: 10,
      visible: false,
    },
  ]
);

const childrenBySharedGroup = sharedGroups.map((group) =>
  layers.filter(
    (layer) =>
      layer.common.placement.parentLayerDocumentId === group.layerDocumentId
  )
);
assert.deepEqual(childrenBySharedGroup.map((children) => children.length), [
  10,
  10,
]);
assert.equal(
  childrenBySharedGroup[0].some((layer) =>
    childrenBySharedGroup[1].some(
      (other) => other.layerDocumentId === layer.layerDocumentId
    )
  ),
  false
);

const nestedGroups = layers.filter(
  (layer) =>
    layer.type === "group" &&
    layer.data.role === "composition" &&
    sharedGroups.some(
      (group) =>
        layer.common.placement.parentLayerDocumentId === group.layerDocumentId
    )
);
assert.equal(nestedGroups.length, 2);
assert.deepEqual(
  nestedGroups.map(
    (group) =>
      layers.filter(
        (layer) =>
          layer.common.placement.parentLayerDocumentId === group.layerDocumentId
      ).length
  ),
  [1, 1]
);

const psdLayers = layers.filter((layer) => layer.type === "psd");
assert.equal(psdLayers.length, 4);
assert.equal(
  new Set(
    psdLayers
      .filter((layer) => layer.common.source?.sourceId === "psd-logo")
      .map((layer) => layer.common.source?.sourceId)
  ).size,
  1
);
const availablePsdLayers = psdLayers.filter(
  (layer) => layer.common.source?.sourceId === "psd-logo"
);
assert.equal(availablePsdLayers.length, 2);
assert.deepEqual(
  availablePsdLayers.map((layer) => ({
    name: layer.name,
    alias: layer.common.placement.alias,
    displayName: layer.common.placement.alias ?? layer.name,
    visible: layer.common.placement.visible,
  })),
  [
    {
      name: "Logo",
      alias: null,
      displayName: "Logo",
      visible: false,
    },
    {
      name: "Logo",
      alias: null,
      displayName: "Logo",
      visible: false,
    },
  ]
);
assert.deepEqual(
  availablePsdLayers[0].common.transform,
  input.sourcesById["psd-logo"].transform
);
assert.deepEqual(
  availablePsdLayers[0].common.animation,
  input.sourcesById["psd-logo"].animation
);
assert.deepEqual(
  availablePsdLayers[0].common.effects,
  input.sourcesById["psd-logo"].effects
);
assert.deepEqual(
  availablePsdLayers[0].common.modifiers,
  input.sourcesById["psd-logo"].modifiers.map((modifier) => ({
    modifierId: modifier.id,
    type: modifier.type,
    enabled: true,
    frequency: modifier.frequency,
    amount: modifier.amount,
  }))
);
assert.notStrictEqual(
  availablePsdLayers[0].common.transform,
  availablePsdLayers[1].common.transform
);
assert.notStrictEqual(
  availablePsdLayers[0].common.animation,
  availablePsdLayers[1].common.animation
);
assert.notStrictEqual(
  availablePsdLayers[0].common.effects,
  availablePsdLayers[1].common.effects
);
assert.notStrictEqual(
  availablePsdLayers[0].common.effects[0].parameters,
  availablePsdLayers[1].common.effects[0].parameters
);
assert.notStrictEqual(
  availablePsdLayers[0].common.modifiers,
  availablePsdLayers[1].common.modifiers
);
availablePsdLayers[0].common.transform.position.x = 999;
assert.notEqual(
  availablePsdLayers[1].common.transform.position.x,
  999
);
assert.notEqual(input.sourcesById["psd-logo"].transform.position.x, 999);

const registry = migrated.project.payload.sourceRegistry.sourcesById;
assert.equal(registry["psd-logo"]?.kind, "psd-node");
assert.equal(registry["psd-missing"]?.availability, "missing");
assert.equal(
  registry["psd-logo"]?.kind === "psd-node"
    ? registry["psd-logo"].data.nativeVisible
    : true,
  null
);
const psdDocumentRecords = Object.values(registry).filter(
  (source) => source.kind === "psd-document"
);
assert.equal(psdDocumentRecords.length, 1);
assert.equal(
  registry["psd-logo"]?.kind === "psd-node"
    ? registry["psd-logo"].data.documentSourceId
    : null,
  psdDocumentRecords[0].sourceId
);
assert.equal(registry.audio?.kind, "audio");
assert.equal(registry.video?.kind, "video");
const audioSource = input.sourcesById.audio;
assert.equal(audioSource.type, "audio");
if (audioSource.type !== "audio") {
  throw new Error("Expected Audio migration fixture");
}
assert.deepEqual(
  registry.audio?.kind === "audio" ? registry.audio.data : null,
  {
    fileName: "voice.wav",
    mimeType: audioSource.content.descriptor.kind === "file"
      ? audioSource.content.descriptor.mimeType
      : null,
    durationFrames: audioSource.content.durationFrames,
  }
);
assert.equal(registry.audio?.path, null);
assert.equal(registry.audio?.refresh.reconnectHint?.path, null);
const videoSource = input.sourcesById.video;
assert.equal(videoSource.type, "video");
if (videoSource.type !== "video") {
  throw new Error("Expected Video migration fixture");
}
assert.deepEqual(
  registry.video?.kind === "video" ? registry.video.data : null,
  {
    fileName: videoSource.content.data.fileName,
    mimeType: videoSource.content.data.mimeType,
    durationFrames: videoSource.content.data.durationFrames,
    width: videoSource.content.data.width,
    height: videoSource.content.data.height,
  }
);
assert.equal(registry.video?.path, videoSource.content.data.path);
assert.equal(
  registry.video?.fingerprint,
  videoSource.content.data.fingerprint
);
assert.equal(registry["unplaced-audio"]?.kind, "audio");
assert.deepEqual(
  migrated.report.retainedUnplacedExternalSourceIds,
  ["unplaced-audio", "unplaced-audio-copy"]
);
assert.equal(
  layers.some(
    (layer) => layer.common.source?.sourceId === "unplaced-audio"
  ),
  false
);
assert.notEqual(
  registry["unplaced-audio"]?.sourceId,
  registry["unplaced-audio-copy"]?.sourceId
);
for (const sourceId of ["unplaced-audio", "unplaced-audio-copy"]) {
  const source = registry[sourceId];
  assert.equal(source?.kind, "audio");
  assert.equal(source?.path, null);
  assert.equal(source?.refresh.reconnectHint?.path, null);
  assert.equal(
    source?.kind === "audio" ? source.data.fileName : null,
    "library.wav"
  );
}

const drawingLayer = layerAtPlacementPath([
  "item-group-a",
  "item-drawing",
]);
const drawingSource = input.sourcesById.drawing;
assert.equal(drawingLayer.type, "drawing");
assert.equal(drawingSource.type, "drawing");
if (drawingLayer.type !== "drawing" || drawingSource.type !== "drawing") {
  throw new Error("Expected Drawing migration fixture");
}
assert.equal(drawingLayer.name, drawingSource.name);
assert.equal(
  drawingLayer.common.placement.alias ?? drawingLayer.name,
  drawingSource.name
);
assert.equal(drawingLayer.revision, drawingSource.sourceVersion);
assert.deepEqual(drawingLayer.data, drawingSource.content);

const textLayer = layerAtPlacementPath(["item-group-a", "item-text-a"]);
const textSource = input.sourcesById.text;
assert.equal(textLayer.type, "text");
assert.equal(textSource.type, "text");
if (textLayer.type !== "text" || textSource.type !== "text") {
  throw new Error("Expected Text migration fixture");
}
assert.equal(textLayer.name, textSource.name);
assert.deepEqual(textLayer.data, textSource.content);

const shapeLayer = layerAtPlacementPath(["item-group-a", "item-shape"]);
const shapeSource = input.sourcesById.shape;
assert.equal(shapeLayer.type, "shape");
assert.equal(shapeSource.type, "shape");
if (shapeLayer.type !== "shape" || shapeSource.type !== "shape") {
  throw new Error("Expected Shape migration fixture");
}
assert.equal(shapeLayer.name, shapeSource.name);
assert.deepEqual(shapeLayer.data, shapeSource.content.data);

const unknownFixtureLayer = layerAtPlacementPath([
  "item-group-a",
  "item-unknown",
]);
const unknownSource = input.sourcesById.unknown;
assert.equal(unknownFixtureLayer.type, "unknown");
assert.equal(unknownSource.type, "unknown");
if (
  unknownFixtureLayer.type !== "unknown" ||
  unknownSource.type !== "unknown"
) {
  throw new Error("Expected Unknown migration fixture");
}
assert.equal(unknownFixtureLayer.name, unknownSource.name);
assert.deepEqual(unknownFixtureLayer.data, {
  originalType: unknownSource.content.originalType,
  rawData: unknownSource.content.data,
});

assert.equal(layers.filter((layer) => layer.type === "drawing").length, 2);
assert.equal(layers.filter((layer) => layer.type === "text").length, 6);
assert.equal(layers.filter((layer) => layer.type === "audio").length, 2);
assert.equal(layers.filter((layer) => layer.type === "video").length, 2);
assert.equal(layers.filter((layer) => layer.type === "shape").length, 2);
assert.equal(layers.filter((layer) => layer.type === "unknown").length, 2);
const unknownLayer = layers.find((layer) => layer.type === "unknown");
assert.equal(
  unknownLayer?.type === "unknown" ? unknownLayer.data.originalType : null,
  "plugin-layer"
);

const repeated = migrateProjectSourceToLayerDocumentProject({
  document: createDocument(),
  projectId: "project-migration",
  name: "Migrated Project",
});
assert.deepEqual(repeated, migrateProjectSourceToLayerDocumentProject({
  document: createDocument(),
  projectId: "project-migration",
  name: "Migrated Project",
}));

const reorderedInput = createDocument();
reorderedInput.sourcesById = Object.fromEntries(
  Object.entries(reorderedInput.sourcesById).reverse()
);
reorderedInput.compositionMetaByGroupId = Object.fromEntries(
  Object.entries(reorderedInput.compositionMetaByGroupId).reverse()
);
const reorderedMigration = migrateProjectSourceToLayerDocumentProject({
  document: reorderedInput,
  projectId: "project-migration",
  name: "Migrated Project",
});
assert.deepEqual(reorderedMigration, repeated);

const emptyAudio = createDocument();
const emptyAudioSource = emptyAudio.sourcesById.audio;
assert.equal(emptyAudioSource.type, "audio");
if (emptyAudioSource.type !== "audio") {
  throw new Error("Expected empty Audio source fixture");
}
emptyAudioSource.content = {
  descriptor: { kind: "empty" },
  durationFrames: null,
};
const emptyAudioMigration = migrateProjectSourceToLayerDocumentProject({
  document: emptyAudio,
  projectId: "project-empty-audio",
  name: "Empty Audio",
});
assert.equal(emptyAudioMigration.ok, true);
if (!emptyAudioMigration.ok) {
  throw new Error("Expected empty Audio migration");
}
const emptyAudioLayers = Object.values(
  emptyAudioMigration.project.payload.layerDocumentsById
).filter((layer) => layer.type === "audio" && layer.name === "Voice");
assert.equal(emptyAudioLayers.length, 2);
assert.equal(
  emptyAudioLayers.every(
    (layer) =>
      layer.common.source === null &&
      layer.revision === emptyAudioSource.sourceVersion
  ),
  true
);

const futureExtra = createDocument();
const futureExtraSource = futureExtra.sourcesById.video;
assert.equal(futureExtraSource.type, "video");
if (futureExtraSource.type !== "video") {
  throw new Error("Expected future Video source fixture");
}
futureExtraSource.content.data = {
  ...futureExtraSource.content.data,
  codecOptions: {
    profile: "future-profile",
    flags: [1, 2, 3],
  },
};
const futureExtraMigration = migrateProjectSourceToLayerDocumentProject({
  document: futureExtra,
  projectId: "project-future-extra",
  name: "Future Extra",
});
assert.equal(futureExtraMigration.ok, true);
if (!futureExtraMigration.ok) {
  throw new Error("Expected future extra payload migration");
}
const futureExtraLayerId =
  futureExtraMigration.report.layerDocumentIdByPlacementPath[
    JSON.stringify(["item-group-a", "item-video"])
  ];
const futureExtraLayer =
  futureExtraMigration.project.payload.layerDocumentsById[futureExtraLayerId];
assert.equal(futureExtraLayer?.type, "unknown");
if (futureExtraLayer?.type !== "unknown") {
  throw new Error("Expected future Video to migrate as unknown");
}
assert.deepEqual(futureExtraLayer.data, {
  originalType: futureExtraSource.content.originalType,
  rawData: futureExtraSource.content.data,
});

const unplacedTransform = createDocument();
unplacedTransform.sourcesById["unplaced-audio"].transform.position.x = 1;
expectMigrationIssue(
  unplacedTransform,
  "unplaced-external-non-default-transform"
);

const unplacedAnimation = createDocument();
unplacedAnimation.sourcesById[
  "unplaced-audio"
].animation.enabledProperties.position = true;
expectMigrationIssue(
  unplacedAnimation,
  "unplaced-external-non-default-animation"
);

const unplacedEffects = createDocument();
unplacedEffects.sourcesById["unplaced-audio"].effects.push({
  effectId: "unplaced-effect",
  type: "fixture-effect",
  enabled: true,
  parameters: { amount: 1 },
});
expectMigrationIssue(
  unplacedEffects,
  "unplaced-external-non-default-effects"
);

const unplacedModifiers = createDocument();
unplacedModifiers.sourcesById["unplaced-audio"].modifiers.push({
  id: "unplaced-modifier",
  type: "wiggle",
  frequency: 1,
  amount: 2,
});
expectMigrationIssue(
  unplacedModifiers,
  "unplaced-external-non-default-modifiers"
);

const unavailableSourceLess = createDocument();
unavailableSourceLess.sourcesById.drawing.availability = "missing";
expectMigrationIssue(
  unavailableSourceLess,
  "unrepresentable-source-state"
);

const updatedSourceLess = createDocument();
updatedSourceLess.sourcesById.text.syncStatus = "updated";
expectMigrationIssue(updatedSourceLess, "unrepresentable-source-state");

const identityLessGroupMetadata = createDocument();
identityLessGroupMetadata.compositionMetaByGroupId[
  "nested-group"
].sourceFileName = "unrepresented.psd";
expectMigrationIssue(
  identityLessGroupMetadata,
  "unrepresentable-group-source-metadata"
);

const identityLessGroupLegacyType = createDocument();
const identityLessNestedGroup =
  identityLessGroupLegacyType.sourcesById["nested-group"];
assert.equal(identityLessNestedGroup.type, "group");
if (identityLessNestedGroup.type !== "group") {
  throw new Error("Expected identity-less nested Group fixture");
}
identityLessNestedGroup.content.legacyCompositionType = "sub";
expectMigrationIssue(
  identityLessGroupLegacyType,
  "unrepresentable-group-source-metadata"
);

const collisionMigration = migrateProjectSourceToLayerDocumentProject({
  document: createDocument(),
  projectId: "project-collision",
  name: "Collision Project",
  layerIdCandidateFactory: (origin, attempt) =>
    attempt === 0
      ? "collision"
      : `resolved-${[
          origin.kind,
          ...origin.ancestorItemIds,
          origin.itemId ?? "root",
          origin.sourceId,
        ].join("-")}`,
});
assert.equal(collisionMigration.ok, true);
if (!collisionMigration.ok) throw new Error("Expected collision recovery");
assert.equal(
  new Set(
    Object.keys(collisionMigration.project.payload.layerDocumentsById)
  ).size,
  25
);

const allocationFailure = migrateProjectSourceToLayerDocumentProject({
  document: createDocument(),
  projectId: "project-failure",
  name: "Allocation Failure",
  layerIdCandidateFactory: () => "same-id",
});
assert.equal(allocationFailure.ok, false);
assert.equal(
  allocationFailure.ok
    ? false
    : allocationFailure.issues.some(
        (issue) => issue.code === "layer-id-allocation-failed"
      ),
  true
);

const unplacedEditable = createDocument();
unplacedEditable.sourcesById["unplaced-text"] = {
  ...commonSourceFields("unplaced-text", "Unplaced Text", 12),
  type: "text",
  content: {
    text: "Must not disappear",
    style: {
      fontFamily: "sans-serif",
      fontSize: 40,
      color: "#ffffff",
    },
  },
};
const unplacedEditableResult =
  migrateProjectSourceToLayerDocumentProject({
    document: unplacedEditable,
    projectId: "project-unplaced",
    name: "Unplaced Editable",
  });
assert.equal(unplacedEditableResult.ok, false);
assert.equal(
  unplacedEditableResult.ok
    ? false
    : unplacedEditableResult.issues.some(
        (issue) => issue.code === "unplaced-editable-source"
      ),
  true
);

const unplacedGroupContent = createDocument();
unplacedGroupContent.sourcesById["orphan-group"] = groupSource(
  "orphan-group",
  "Orphan Group",
  13
);
unplacedGroupContent.sourcesById["orphan-text"] = {
  ...commonSourceFields("orphan-text", "Orphan Text", 14),
  type: "text",
  content: {
    text: "Orphan",
    style: {
      fontFamily: "sans-serif",
      fontSize: 20,
      color: "#ffffff",
    },
  },
};
unplacedGroupContent.timelineItemsByGroupId["orphan-group"] = [
  item("item-orphan-text", "orphan-text", "orphan-group"),
];
unplacedGroupContent.compositionMetaByGroupId["orphan-group"] = {
  width: 100,
  height: 100,
  layerCount: 1,
  sourceFileName: "",
  frameRate: 30,
  durationFrames: 30,
};
const unplacedGroupResult = migrateProjectSourceToLayerDocumentProject({
  document: unplacedGroupContent,
  projectId: "project-orphan",
  name: "Orphan Group",
});
assert.equal(unplacedGroupResult.ok, false);
assert.equal(
  unplacedGroupResult.ok
    ? false
    : unplacedGroupResult.issues.some(
        (issue) => issue.code === "unplaced-group-content"
      ),
  true
);

const missingMeta = createDocument();
delete missingMeta.compositionMetaByGroupId["nested-group"];
const missingMetaResult = migrateProjectSourceToLayerDocumentProject({
  document: missingMeta,
  projectId: "project-meta",
  name: "Missing Meta",
});
assert.equal(missingMetaResult.ok, false);
assert.equal(
  missingMetaResult.ok
    ? false
    : missingMetaResult.issues.some(
        (issue) => issue.code === "missing-group-meta"
      ),
  true
);

const invalidRoot = createDocument();
invalidRoot.rootSourceIds = ["root", "shared-group"];
const invalidRootResult = migrateProjectSourceToLayerDocumentProject({
  document: invalidRoot,
  projectId: "project-root",
  name: "Invalid Root",
});
assert.equal(invalidRootResult.ok, false);
assert.equal(
  invalidRootResult.ok
    ? false
    : invalidRootResult.issues.some(
        (issue) => issue.code === "invalid-root-source"
      ),
  true
);

const missingSettings = createDocument();
Object.values(missingSettings.sourcesById).forEach((source) => {
  if (source.type === "group") source.content.importSettings = null;
});
const missingSettingsResult =
  migrateProjectSourceToLayerDocumentProject({
    document: missingSettings,
    projectId: "project-settings",
    name: "Missing Settings",
  });
assert.equal(missingSettingsResult.ok, false);
assert.equal(
  missingSettingsResult.ok
    ? false
    : missingSettingsResult.issues.some(
        (issue) => issue.code === "missing-psd-document-settings"
      ),
  true
);

const conflictingSettings = createDocument();
const sharedGroupSource = conflictingSettings.sourcesById["shared-group"];
if (
  sharedGroupSource.type !== "group" ||
  !sharedGroupSource.content.importSettings
) {
  throw new Error("Expected shared Group import settings fixture");
}
sharedGroupSource.content.importSettings.compositionName = "Other Scene";
const conflictingSettingsResult =
  migrateProjectSourceToLayerDocumentProject({
    document: conflictingSettings,
    projectId: "project-conflicting-settings",
    name: "Conflicting Settings",
  });
assert.equal(conflictingSettingsResult.ok, false);
assert.equal(
  conflictingSettingsResult.ok
    ? false
    : conflictingSettingsResult.issues.some(
        (issue) => issue.code === "conflicting-psd-document-settings"
      ),
  true
);

console.log("ProjectSource to Layer Document migration verification passed");
