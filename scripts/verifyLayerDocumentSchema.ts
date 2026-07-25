import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
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
    reconnectHint: {
      fileName: "sample.psd",
      path: "/portable/sample.psd",
    },
  };
  return {
    "source-psd-document": {
      sourceId: "source-psd-document",
      kind: "psd-document",
      displayName: "sample.psd",
      path: "/portable/sample.psd",
      fingerprint: "document-fingerprint",
      version: 1,
      availability: "available",
      refresh,
      data: {
        fileName: "sample.psd",
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
      path: "sample.psd/Logo",
      fingerprint: "node-fingerprint",
      version: 3,
      availability: "available",
      refresh,
      data: {
        documentSourceId: "source-psd-document",
        sourceKey: "layer:1",
        sourcePath: "Logo",
        nativeVisible: null,
      },
    },
    "source-audio": {
      sourceId: "source-audio",
      kind: "audio",
      displayName: "voice.wav",
      path: "/portable/voice.wav",
      fingerprint: "audio-fingerprint",
      version: 1,
      availability: "available",
      refresh: {
        status: "normal",
        reconnectHint: {
          fileName: "voice.wav",
          path: "/portable/voice.wav",
        },
      },
      data: {
        fileName: "voice.wav",
        mimeType: "audio/wav",
        durationFrames: 90,
      },
    },
    "source-video": {
      sourceId: "source-video",
      kind: "video",
      displayName: "clip.mp4",
      path: "/portable/clip.mp4",
      fingerprint: "video-fingerprint",
      version: 1,
      availability: "missing",
      refresh: {
        status: "missing",
        reconnectHint: {
          fileName: "clip.mp4",
          path: "/portable/clip.mp4",
        },
      },
      data: {
        fileName: "clip.mp4",
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
invalidSchema.metadata.schemaVersion = 2;
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
  nativeVisible: null,
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
