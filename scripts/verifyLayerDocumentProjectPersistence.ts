import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION,
  LAYER_DOCUMENT_PROJECT_FILE_FORMAT,
  LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES,
  LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING,
  LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT,
  loadLayerDocumentProjectFromZiq,
  saveLayerDocumentProjectToZiq,
  type LayerDocumentProjectPersistenceErrorCode,
} from "@/engines/project";

function common(options: {
  parentLayerDocumentId: string | null;
  order: number;
  sourceId?: string | null;
}): LayerDocumentCommon {
  return {
    source: options.sourceId
      ? { sourceId: options.sourceId }
      : null,
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
      parentLayerDocumentId:
        options.parentLayerDocumentId,
      order: options.order,
      startFrame: 0,
      durationFrames: 90,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [
        { frame: 10, value: { x: 1, y: 2 } },
        { frame: 2, value: { x: 3, y: 4 } },
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
    effects: [
      {
        effectId: "effect-z",
        type: "fixture",
        enabled: true,
        parameters: { z: 1, a: 2 },
      },
      {
        effectId: "effect-a",
        type: "fixture",
        enabled: false,
        parameters: {},
      },
    ],
    modifiers: [],
  };
}

function projectFixture(): LayerDocumentProject {
  const root: LayerDocument = {
    layerDocumentId: "root",
    name: "Root",
    revision: 0,
    type: "group",
    common: common({
      parentLayerDocumentId: null,
      order: 0,
    }),
    data: {
      role: "project-root",
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationFrames: 90,
    },
  };
  const video: LayerDocument = {
    layerDocumentId: "video",
    name: "Missing linked video",
    revision: 0,
    type: "video",
    common: common({
      parentLayerDocumentId: "root",
      order: 0,
      sourceId: "video-source",
    }),
    data: {},
  };
  const audio: LayerDocument = {
    layerDocumentId: "audio",
    name: "Recorded voice",
    revision: 2,
    type: "audio",
    common: {
      ...common({
        parentLayerDocumentId: "root",
        order: 1,
        sourceId: "audio-source",
      }),
      effects: [{
        effectId: "future-noise-gate",
        type: "noise-gate",
        enabled: false,
        parameters: { threshold: -36 },
      }],
    },
    data: {
      gain: 0.8,
      muted: false,
      fadeInFrames: 3,
      fadeOutFrames: 6,
    },
  };
  return {
    metadata: {
      schemaVersion:
        LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "persistence-fixture",
      name: "Persistence Fixture",
    },
    payload: {
      layerDocumentsById: {
        root,
        video,
        audio,
      },
      sourceRegistry: {
        sourcesById: {
          "video-source": {
            sourceId: "video-source",
            kind: "video",
            displayName: "missing.mp4",
            version: 3,
            refresh: { status: "normal" },
            locator: {
              locatorId: "linked:video-source",
              kind: "linked-file",
              suggestedFileName: "missing.mp4",
              relativePathHint:
                "media/missing.mp4",
            },
            contentFingerprint: {
              algorithm: "sha-256",
              digestHex: "b".repeat(64),
              byteLength: 1234,
            },
            data: {
              mimeType: "video/mp4",
              durationFrames: 90,
              width: 1080,
              height: 1920,
            },
          },
          "audio-source": {
            sourceId: "audio-source",
            kind: "audio",
            displayName: "recording.wav",
            version: 1,
            refresh: { status: "normal" },
            locator: {
              locatorId: "linked:audio-source",
              kind: "linked-file",
              suggestedFileName: "recording.wav",
              relativePathHint: "media/recording.wav",
            },
            contentFingerprint: null,
            data: {
              mimeType: "audio/wav",
              durationFrames: 75,
              channelCount: 1,
              sampleRate: 48_000,
              provenance: "recorded",
            },
          },
        },
      },
    },
  };
}

function expectLoadError(
  bytes: Uint8Array,
  code: LayerDocumentProjectPersistenceErrorCode
) {
  const result =
    loadLayerDocumentProjectFromZiq(bytes);
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error(`Expected ${code}`);
  }
  assert.equal(result.error.code, code);
  assert.equal(
    typeof result.error.path,
    "string"
  );
  assert.ok(result.error.message.length > 0);
}

function encodeEnvelope(project: unknown) {
  return new TextEncoder().encode(JSON.stringify({
    project,
    format: LAYER_DOCUMENT_PROJECT_FILE_FORMAT,
    containerVersion:
      LAYER_DOCUMENT_PROJECT_CONTAINER_VERSION,
  }));
}

const current = projectFixture();
const currentSnapshot = structuredClone(current);
const saved =
  saveLayerDocumentProjectToZiq(current);
assert.equal(saved.ok, true);
if (!saved.ok) {
  throw new Error(saved.error.message);
}
assert.deepEqual(
  current,
  currentSnapshot,
  "Save must not mutate the current Project"
);

const canonicalText =
  new TextDecoder().decode(saved.value);
assert.ok(canonicalText.endsWith("\n"));
assert.equal(canonicalText.endsWith("\n\n"), false);
assert.ok(canonicalText.includes("\n  \"format\""));
assert.ok(
  canonicalText.indexOf("\"containerVersion\"") <
    canonicalText.indexOf("\"format\"")
);
assert.ok(
  canonicalText.indexOf("\"name\"") <
    canonicalText.indexOf("\"projectId\"")
);
assert.ok(
  canonicalText.indexOf("\"projectId\"") <
    canonicalText.indexOf("\"schemaVersion\"")
);

const loaded =
  loadLayerDocumentProjectFromZiq(saved.value);
assert.equal(loaded.ok, true);
if (!loaded.ok) {
  throw new Error(loaded.error.message);
}
assert.deepEqual(loaded.value.project, current);
assert.notStrictEqual(loaded.value.project, current);
assert.notStrictEqual(
  loaded.value.project.payload,
  current.payload
);
assert.deepEqual(
  current,
  currentSnapshot,
  "Load Candidate creation must not mutate the current Project"
);
assert.deepEqual(
  loaded.value.project.payload.layerDocumentsById
    .video.common.animation.positionKeyframes
    .map((keyframe) => keyframe.frame),
  [10, 2],
  "Canonicalization must preserve array order"
);

const loadedMissingDescriptor =
  loaded.value.project.payload.sourceRegistry
    .sourcesById["video-source"];
assert.deepEqual(
  loadedMissingDescriptor,
  current.payload.sourceRegistry
    .sourcesById["video-source"],
  "A missing runtime binding must not remove its persisted descriptor"
);
assert.equal(
  "availability" in loadedMissingDescriptor,
  false
);

const nonCanonicalBytes = encodeEnvelope(current);
const nonCanonicalLoad =
  loadLayerDocumentProjectFromZiq(
    nonCanonicalBytes
  );
assert.equal(nonCanonicalLoad.ok, true);
if (!nonCanonicalLoad.ok) {
  throw new Error(nonCanonicalLoad.error.message);
}
const canonicalResave =
  saveLayerDocumentProjectToZiq(
    nonCanonicalLoad.value.project
  );
assert.equal(canonicalResave.ok, true);
if (!canonicalResave.ok) {
  throw new Error(canonicalResave.error.message);
}
assert.deepEqual(canonicalResave.value, saved.value);

const legacyProject = structuredClone(
  current
) as unknown as {
  metadata: { schemaVersion: number };
  payload: {
    sourceRegistry: {
      sourcesById: Record<string, unknown>;
    };
  };
};
legacyProject.metadata.schemaVersion = 1;
legacyProject.payload.sourceRegistry.sourcesById[
  "video-source"
] = {
  sourceId: "video-source",
  kind: "video",
  displayName: "missing.mp4",
  path: "media/missing.mp4",
  fingerprint: "legacy-weak-fingerprint",
  version: 3,
  availability: "missing",
  refresh: {
    status: "missing",
    reconnectHint: {
      fileName: "missing.mp4",
      path: "media/missing.mp4",
    },
  },
  data: {
    fileName: "missing.mp4",
    mimeType: "video/mp4",
    durationFrames: 90,
    width: 1080,
    height: 1920,
  },
};
const migratedLoad =
  loadLayerDocumentProjectFromZiq(
    encodeEnvelope(legacyProject)
  );
assert.equal(migratedLoad.ok, true);
if (!migratedLoad.ok) {
  throw new Error(migratedLoad.error.message);
}
assert.equal(
  migratedLoad.value.migratedFromSchemaVersion,
  1
);
assert.equal(
  migratedLoad.value.project.metadata.schemaVersion,
  3
);
const migratedVideo =
  migratedLoad.value.project.payload.sourceRegistry
    .sourcesById["video-source"];
assert.equal(migratedVideo.kind, "video");
if (migratedVideo.kind === "video") {
  assert.equal(
    migratedVideo.locator.relativePathHint,
    "media/missing.mp4"
  );
  assert.equal(
    migratedVideo.contentFingerprint,
    null
  );
}

expectLoadError(
  new Uint8Array(),
  "empty-file"
);
expectLoadError(
  new TextEncoder().encode("   \n"),
  "empty-file"
);
expectLoadError(
  new TextEncoder().encode("{broken"),
  "invalid-json"
);
expectLoadError(
  new Uint8Array([0xc3, 0x28]),
  "invalid-utf8"
);
expectLoadError(
  new TextEncoder().encode(JSON.stringify({
    format: LAYER_DOCUMENT_PROJECT_FILE_FORMAT,
    containerVersion: 2,
    project: current,
  })),
  "unsupported-container-version"
);

const futureSchema = structuredClone(
  current
) as unknown as {
    metadata: { schemaVersion: number };
  };
futureSchema.metadata.schemaVersion = 4;
expectLoadError(
  encodeEnvelope(futureSchema),
  "unsupported-project-schema"
);

const futureType = structuredClone(
  current
) as unknown as {
    payload: {
      layerDocumentsById: Record<
        string,
        { type: string }
      >;
    };
  };
futureType.payload.layerDocumentsById.video.type =
  "future-video";
expectLoadError(
  encodeEnvelope(futureType),
  "unknown-entity-type"
);

expectLoadError(
  new Uint8Array(
    LAYER_DOCUMENT_PROJECT_MAX_JSON_BYTES + 1
  ),
  "file-too-large"
);

let deeplyNested: unknown = null;
for (
  let depth = 0;
  depth <= LAYER_DOCUMENT_PROJECT_MAX_JSON_NESTING;
  depth += 1
) {
  deeplyNested = { child: deeplyNested };
}
expectLoadError(
  encodeEnvelope(deeplyNested),
  "nesting-limit-exceeded"
);

const excessiveSources = structuredClone(
  current
) as unknown as {
    payload: {
      sourceRegistry: {
        sourcesById: Record<string, unknown>;
      };
    };
  };
excessiveSources.payload.sourceRegistry.sourcesById =
  Object.fromEntries(
    Array.from({
      length:
        LAYER_DOCUMENT_PROJECT_MAX_SOURCE_COUNT + 1,
    }, (_, index) => [`source-${index}`, null])
  );
expectLoadError(
  encodeEnvelope(excessiveSources),
  "entity-limit-exceeded"
);
class RuntimeFile {
  readonly name = "runtime.psd";
}
class RuntimeFileHandle {
  readonly kind = "file";
}
class RuntimeCanvas {
  readonly width = 1;
}
class RuntimeBitmap {
  readonly width = 1;
}
for (
  const runtimeValue
  of [
    new RuntimeFile(),
    new RuntimeFileHandle(),
    new RuntimeCanvas(),
    new RuntimeBitmap(),
  ]
) {
  const projectWithRuntimeObject =
    structuredClone(current) as
    LayerDocumentProject & {
      runtimeObject?: object;
    };
  projectWithRuntimeObject.runtimeObject =
    runtimeValue;
  const runtimeSave =
    saveLayerDocumentProjectToZiq(
      projectWithRuntimeObject
    );
  assert.equal(runtimeSave.ok, false);
  if (!runtimeSave.ok) {
    assert.equal(
      runtimeSave.error.code,
      "non-serializable-project"
    );
  }
}

for (
  const runtimeKey
  of ["runtime", "draft", "playback"]
) {
  const projectWithSessionData =
    structuredClone(current) as unknown as
    LayerDocumentProject &
    Record<string, unknown>;
  projectWithSessionData[runtimeKey] = {
    currentFrame: 42,
  };
  const result =
    saveLayerDocumentProjectToZiq(
      projectWithSessionData
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.error.code,
      "invalid-project"
    );
  }
}

console.log(
  "Layer Document Project persistence verification passed"
);
