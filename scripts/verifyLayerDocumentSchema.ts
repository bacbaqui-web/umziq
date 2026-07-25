import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  migrateLayerDocumentProjectSchema1To2,
  normalizeLayerDocumentProject,
  validateLayerDocumentProject,
  type LayerAnimation,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentType,
  type LayerSourceReference,
  type SourceRegistryRecord,
} from "@/models";

function createAnimation(): LayerAnimation {
  return {
    positionKeyframes: [{ frame: 0, value: { x: 10, y: 20 } }],
    scaleKeyframes: [{ frame: 0, value: { x: 100, y: 100 } }],
    rotationKeyframes: [{ frame: 0, value: 0 }],
    opacityKeyframes: [{ frame: 0, value: 100 }],
    enabledProperties: {
      position: true,
      scale: false,
      rotation: false,
      opacity: false,
    },
  };
}

function createCommon(
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null = null
): LayerDocumentCommon {
  return {
    source,
    transform: {
      position: { x: 0, y: 0 },
      transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: 0,
      opacity: 100,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: 0,
      durationFrames: 90,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: createAnimation(),
    effects: [
      {
        effectId: "effect-1",
        type: "test-effect",
        enabled: true,
        parameters: { amount: 1 },
      },
    ],
    modifiers: [
      {
        modifierId: "modifier-1",
        type: "wiggle",
        enabled: true,
        frequency: 2,
        amount: 4,
      },
      {
        modifierId: "modifier-future",
        type: "unknown",
        enabled: false,
        originalType: "plugin-modifier",
        parameters: { seed: 1 },
      },
    ],
  };
}

function createSourceRecords(): Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
  };
  return {
    "source-psd-document": {
      sourceId: "source-psd-document",
      kind: "psd-document",
      displayName: "sample.psd",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:source-psd-document",
        kind: "linked-file",
        suggestedFileName: "sample.psd",
        relativePathHint: "portable/sample.psd",
      },
      contentFingerprint: {
        algorithm: "sha-256",
        digestHex: "a".repeat(64),
        byteLength: 123,
      },
      data: {
        importSettings: {
          compositionName: "Scene",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "source-psd-node": {
      sourceId: "source-psd-node",
      kind: "psd-node",
      displayName: "Logo",
      version: 3,
      refresh,
      data: {
        documentSourceId: "source-psd-document",
        sourceKey: "layer:1",
        sourcePath: "Logo",
        visualFingerprint: "node-fingerprint",
      },
    },
    "source-audio": {
      sourceId: "source-audio",
      kind: "audio",
      displayName: "voice.wav",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:source-audio",
        kind: "linked-file",
        suggestedFileName: "voice.wav",
        relativePathHint: "portable/voice.wav",
      },
      contentFingerprint: null,
      data: {
        mimeType: "audio/wav",
        durationFrames: 90,
      },
    },
    "source-video": {
      sourceId: "source-video",
      kind: "video",
      displayName: "clip.mp4",
      version: 1,
      refresh,
      locator: {
        locatorId: "linked:source-video",
        kind: "linked-file",
        suggestedFileName: "clip.mp4",
        relativePathHint: "portable/clip.mp4",
      },
      contentFingerprint: null,
      data: {
        mimeType: "video/mp4",
        durationFrames: 90,
        width: 1080,
        height: 1920,
      },
    },
  };
}

function createLayerDocuments(): Record<string, LayerDocument> {
  return {
    root: {
      layerDocumentId: "root",
      name: "Project Root",
      revision: 0,
      type: "group",
      common: createCommon(null, 0),
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    psd: {
      layerDocumentId: "psd",
      name: "Logo",
      revision: 2,
      type: "psd",
      common: createCommon("root", 0, { sourceId: "source-psd-node" }),
      data: {},
    },
    drawing: {
      layerDocumentId: "drawing",
      name: "Drawing",
      revision: 0,
      type: "drawing",
      common: createCommon("root", 1),
      data: {
        documentVersion: 1,
        elements: [{ kind: "stroke", points: [0, 1] }],
      },
    },
    text: {
      layerDocumentId: "text",
      name: "Text",
      revision: 1,
      type: "text",
      common: createCommon("root", 2),
      data: {
        text: "TEXT",
        style: {
          fontFamily: "sans-serif",
          fontSize: 48,
          color: "#ffffff",
        },
      },
    },
    audio: {
      layerDocumentId: "audio",
      name: "Voice",
      revision: 0,
      type: "audio",
      common: createCommon("root", 3, { sourceId: "source-audio" }),
      data: {},
    },
    video: {
      layerDocumentId: "video",
      name: "Clip",
      revision: 0,
      type: "video",
      common: createCommon("root", 4, { sourceId: "source-video" }),
      data: {},
    },
    shape: {
      layerDocumentId: "shape",
      name: "Shape",
      revision: 0,
      type: "shape",
      common: createCommon("root", 5),
      data: {
        documentVersion: 1,
        shapes: [{ kind: "rectangle" }],
      },
    },
    group: {
      layerDocumentId: "group",
      name: "Scene",
      revision: 0,
      type: "group",
      common: createCommon("root", 6, {
        sourceId: "source-psd-document",
      }),
      data: {
        role: "composition",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    unknown: {
      layerDocumentId: "unknown",
      name: "Plugin Layer",
      revision: 0,
      type: "unknown",
      common: createCommon("root", 7),
      data: {
        originalType: "plugin-layer",
        rawData: { pluginValue: 10 },
      },
    },
  };
}

function createValidProject(): LayerDocumentProject {
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "project-1",
      name: "Layer Document Fixture",
    },
    payload: {
      layerDocumentsById: createLayerDocuments(),
      sourceRegistry: {
        sourcesById: createSourceRecords(),
      },
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hasIssue(
  value: unknown,
  code: ReturnType<typeof validateLayerDocumentProject>[number]["code"]
) {
  return validateLayerDocumentProject(value).some((issue) => issue.code === code);
}

const valid = createValidProject();
assert.deepEqual(validateLayerDocumentProject(valid), []);

const normalizedValid = normalizeLayerDocumentProject({
  ...clone(valid),
  metadata: {
    ...valid.metadata,
    name: "  Layer Document Fixture  ",
  },
  payload: {
    ...clone(valid).payload,
    layerDocumentsById: {
      ...clone(valid).payload.layerDocumentsById,
      text: {
        ...clone(valid).payload.layerDocumentsById.text,
        name: "  Text  ",
      },
    },
  },
});
assert.equal(normalizedValid.ok, true);
if (!normalizedValid.ok) throw new Error("Expected valid normalization");
assert.equal(normalizedValid.project.metadata.name, "Layer Document Fixture");
assert.equal(
  normalizedValid.project.payload.layerDocumentsById.text.name,
  "Text"
);
assert.deepEqual(valid, createValidProject());
assert.notStrictEqual(normalizedValid.project, valid);

const schema1 = clone(valid) as unknown as {
  metadata: { schemaVersion: number };
  payload: {
    sourceRegistry: {
      sourcesById: Record<string, Record<string, unknown>>;
    };
  };
};
schema1.metadata.schemaVersion = 1;
schema1.payload.sourceRegistry.sourcesById = Object.fromEntries(
  Object.entries(createSourceRecords()).map(([sourceId, source]) => {
    const legacyBase = {
      sourceId,
      kind: source.kind,
      displayName: source.displayName,
      path:
        source.kind === "psd-node"
          ? source.data.sourcePath
          : "locator" in source
            ? source.locator.suggestedFileName
            : null,
      fingerprint:
        source.kind === "psd-node"
          ? source.data.visualFingerprint
          : "legacy-weak-fingerprint",
      version: source.version,
      availability:
        source.kind === "video" ? "missing" : "available",
      refresh: {
        status:
          source.kind === "video" ? "missing" : source.refresh.status,
        reconnectHint: {
          fileName:
            "locator" in source
              ? source.locator.suggestedFileName
              : source.displayName,
          path: null,
        },
      },
    };
    if (source.kind === "psd-document") {
      return [sourceId, {
        ...legacyBase,
        data: {
          fileName: source.locator.suggestedFileName,
          importSettings: source.data.importSettings,
        },
      }];
    }
    if (source.kind === "audio" || source.kind === "video") {
      return [sourceId, {
        ...legacyBase,
        data: {
          fileName: source.locator.suggestedFileName,
          ...source.data,
        },
      }];
    }
    if (source.kind === "psd-node") {
      return [sourceId, {
        ...legacyBase,
        data: {
          documentSourceId: source.data.documentSourceId,
          sourceKey: source.data.sourceKey,
          sourcePath: source.data.sourcePath,
          nativeVisible: true,
        },
      }];
    }
    return [sourceId, { ...legacyBase, data: source.data }];
  })
);
const migratedSchema1 =
  migrateLayerDocumentProjectSchema1To2(schema1);
assert.equal(migratedSchema1.ok, true);
if (!migratedSchema1.ok) {
  throw new Error(migratedSchema1.error.message);
}
const normalizedSchema1 =
  normalizeLayerDocumentProject(schema1);
assert.equal(normalizedSchema1.ok, true);
if (!normalizedSchema1.ok) {
  throw new Error(JSON.stringify(normalizedSchema1.issues));
}
assert.equal(
  normalizedSchema1.project.metadata.schemaVersion,
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION
);
const migratedDocument =
  normalizedSchema1.project.payload.sourceRegistry
    .sourcesById["source-psd-document"];
assert.equal(migratedDocument.kind, "psd-document");
if (migratedDocument.kind === "psd-document") {
  assert.equal(migratedDocument.contentFingerprint, null);
  assert.equal(
    migratedDocument.locator.suggestedFileName,
    "sample.psd"
  );
}
const migratedNode =
  normalizedSchema1.project.payload.sourceRegistry
    .sourcesById["source-psd-node"];
assert.equal(migratedNode.kind, "psd-node");
if (migratedNode.kind === "psd-node") {
  assert.equal(
    migratedNode.data.visualFingerprint,
    "node-fingerprint"
  );
}

const future = clone(valid) as unknown as {
  payload: {
    layerDocumentsById: Record<string, {
      type: string;
      data: unknown;
      common: LayerDocumentCommon;
    }>;
    sourceRegistry: {
      sourcesById: Record<string, {
        kind: string;
        data: unknown;
      }>;
    };
  };
};
future.payload.layerDocumentsById.unknown.type = "future-plugin-layer";
future.payload.layerDocumentsById.unknown.data = { futureValue: 42 };
future.payload.sourceRegistry.sourcesById["source-video"].kind =
  "future-stream-source";
future.payload.sourceRegistry.sourcesById["source-video"].data = {
  codec: "future",
};
future.payload.layerDocumentsById.video.common.source = null;
future.payload.layerDocumentsById.unknown.common.source = {
  sourceId: "source-video",
};
const normalizedFuture = normalizeLayerDocumentProject(future);
if (!normalizedFuture.ok) {
  throw new Error(
    `Expected future type normalization: ${JSON.stringify(normalizedFuture.issues)}`
  );
}
assert.equal(
  normalizedFuture.project.payload.layerDocumentsById.unknown?.type,
  "unknown"
);
assert.deepEqual(
  normalizedFuture.project.payload.layerDocumentsById.unknown?.data,
  {
    originalType: "future-plugin-layer",
    rawData: { futureValue: 42 },
  }
);
assert.equal(
  normalizedFuture.project.payload.sourceRegistry.sourcesById["source-video"]
    ?.kind,
  "unknown"
);

const invalidSchema = clone(valid) as unknown as {
  metadata: { schemaVersion: number };
};
invalidSchema.metadata.schemaVersion = 3;
assert.equal(hasIssue(invalidSchema, "invalid-schema-version"), true);

const invalidMetadata = {
  ...clone(valid),
  metadata: {
    ...valid.metadata,
    currentFrame: 10,
  },
};
assert.equal(hasIssue(invalidMetadata, "unknown-field"), true);

const invalidProjectRuntime = {
  ...clone(valid),
  payload: {
    ...valid.payload,
    renderItemsById: {},
  },
};
assert.equal(hasIssue(invalidProjectRuntime, "unknown-field"), true);

const runtimeObject = {
  ...clone(valid),
  runtimeCanvas: { getContext() {} },
};
assert.equal(hasIssue(runtimeObject, "non-plain-data"), true);

const invalidLayerKey = clone(valid);
invalidLayerKey.payload.layerDocumentsById.text.layerDocumentId =
  "different-layer-id";
assert.equal(hasIssue(invalidLayerKey, "key-id-mismatch"), true);

const emptyLayerName = clone(valid);
emptyLayerName.payload.layerDocumentsById.text.name = "   ";
assert.equal(hasIssue(emptyLayerName, "invalid-id"), true);

const duplicateLayerId = clone(valid);
duplicateLayerId.payload.layerDocumentsById.text.layerDocumentId = "drawing";
assert.equal(hasIssue(duplicateLayerId, "duplicate-id"), true);

const duplicateEffect = clone(valid);
duplicateEffect.payload.layerDocumentsById.text.common.effects.push({
  ...duplicateEffect.payload.layerDocumentsById.text.common.effects[0],
});
assert.equal(hasIssue(duplicateEffect, "duplicate-id"), true);

const danglingSource = clone(valid);
danglingSource.payload.layerDocumentsById.psd.common.source = {
  sourceId: "missing-source",
};
assert.equal(hasIssue(danglingSource, "invalid-source-reference"), true);

const wrongSourceKind = clone(valid);
wrongSourceKind.payload.layerDocumentsById.psd.common.source = {
  sourceId: "source-audio",
};
assert.equal(hasIssue(wrongSourceKind, "invalid-source-kind"), true);

const danglingPsdDocument = clone(valid);
danglingPsdDocument.payload.sourceRegistry.sourcesById[
  "source-psd-node"
].data = {
  documentSourceId: "missing-document",
  sourceKey: "layer:1",
  sourcePath: "Logo",
  visualFingerprint: "node-fingerprint",
};
assert.equal(
  hasIssue(danglingPsdDocument, "invalid-source-reference"),
  true
);

const missingRoot = clone(valid);
const root = missingRoot.payload.layerDocumentsById.root;
if (root.type !== "group") throw new Error("Expected root Group fixture");
root.data.role = "composition";
assert.equal(hasIssue(missingRoot, "invalid-root-count"), true);

const secondRoot = clone(valid);
const group = secondRoot.payload.layerDocumentsById.group;
if (group.type !== "group") throw new Error("Expected Group fixture");
group.data.role = "project-root";
assert.equal(hasIssue(secondRoot, "invalid-root-count"), true);

const invalidParent = clone(valid);
invalidParent.payload.layerDocumentsById.text.common.placement.parentLayerDocumentId =
  "drawing";
assert.equal(hasIssue(invalidParent, "invalid-parent"), true);

const parentCycle = clone(valid);
parentCycle.payload.layerDocumentsById.root.common.placement.parentLayerDocumentId =
  "group";
parentCycle.payload.layerDocumentsById.group.common.placement.parentLayerDocumentId =
  "root";
assert.equal(hasIssue(parentCycle, "parent-cycle"), true);

const invalidSiblingOrder = clone(valid);
invalidSiblingOrder.payload.layerDocumentsById.text.common.placement.order = 1;
assert.equal(hasIssue(invalidSiblingOrder, "invalid-sibling-order"), true);

const invalidTypeData = clone(valid) as unknown as {
  payload: {
    layerDocumentsById: Record<string, {
      type: LayerDocumentType;
      data: unknown;
    }>;
  };
};
invalidTypeData.payload.layerDocumentsById.text.data = {};
assert.equal(hasIssue(invalidTypeData, "unknown-field"), false);
assert.equal(hasIssue(invalidTypeData, "invalid-shape"), true);

const extraGroupChildren = clone(valid) as unknown as {
  payload: {
    layerDocumentsById: Record<string, {
      data: Record<string, unknown>;
    }>;
  };
};
extraGroupChildren.payload.layerDocumentsById.group.data.children = ["text"];
assert.equal(hasIssue(extraGroupChildren, "unknown-field"), true);

const invalidTransform = clone(valid);
invalidTransform.payload.layerDocumentsById.text.common.transform.opacity = 101;
assert.equal(hasIssue(invalidTransform, "invalid-transform"), true);

const invalidTiming = clone(valid);
invalidTiming.payload.layerDocumentsById.text.common.placement.durationFrames = 0;
assert.equal(hasIssue(invalidTiming, "invalid-timing"), true);

const invalidKeyframeTiming = clone(valid);
invalidKeyframeTiming.payload.layerDocumentsById.text.common.animation.positionKeyframes.push(
  { frame: 0, value: { x: 20, y: 30 } }
);
assert.equal(hasIssue(invalidKeyframeTiming, "duplicate-id"), true);

const legacyShape = {
  comps: [],
  timelineItemsByCompId: {},
  projectSourceDocument: null,
};
const legacyNormalization = normalizeLayerDocumentProject(legacyShape);
assert.equal(legacyNormalization.ok, false);
assert.equal(
  legacyNormalization.ok
    ? false
    : legacyNormalization.issues.some(
        (issue) =>
          issue.code === "unknown-field" ||
          issue.code === "invalid-shape"
      ),
  true
);

console.log("Layer Document schema verification passed");
