import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentAudioRuntimeStore,
  createLayerDocumentNexusState,
  prepareLayerDocumentDeleteWithOrphanSources,
  reduceLayerDocumentNexus,
} from "@/engines/project";
import {
  createEditorNexusCommandAdapter,
  createEditorNexusPort,
} from "@/editor/nexus";
import { createEditorAudioRuntime } from "@/editor/audio-runtime";
import { createLayerDocumentSourceRuntimeResourceCache } from "@/render";

const common = (
  parentLayerDocumentId: string | null,
  order: number,
  sourceId: string | null = null
): LayerDocumentCommon => ({
  source: sourceId ? { sourceId } : null,
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
});

const project: LayerDocumentProject = {
  metadata: {
    schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
    projectId: "undo-safe-source-runtime",
    name: "Undo-safe Source Runtime",
  },
  payload: {
    sourceRegistry: {
      sourcesById: {
        audio: {
          sourceId: "audio",
          kind: "audio",
          displayName: "voice.wav",
          version: 1,
          refresh: { status: "normal" },
          locator: {
            locatorId: "audio:voice",
            kind: "linked-file",
            suggestedFileName: "voice.wav",
            relativePathHint: "audio/voice.wav",
          },
          contentFingerprint: null,
          data: {
            mimeType: "audio/wav",
            durationFrames: 90,
            channelCount: 1,
            sampleRate: 48_000,
            provenance: "recorded",
          },
        },
      },
    },
    layerDocumentsById: {
      root: {
        layerDocumentId: "root",
        revision: 0,
        name: "Project",
        type: "group",
        common: common(null, 0),
        data: {
          role: "project-root",
          width: 1080,
          height: 1920,
          frameRate: 30,
          durationFrames: 90,
        },
      },
      a: {
        layerDocumentId: "a",
        revision: 0,
        name: "Voice A",
        type: "audio",
        common: common("root", 0, "audio"),
        data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
      },
      b: {
        layerDocumentId: "b",
        revision: 0,
        name: "Voice B",
        type: "audio",
        common: common("root", 1, "audio"),
        data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
      },
    },
  },
};

const initialized = createLayerDocumentNexusState({
  project,
  activeGroupLayerDocumentId: "root",
});
assert.equal(initialized.ok, true);
if (!initialized.ok) throw new Error(initialized.error.message);
const nexus = createEditorNexusPort(
  initialized.state,
  reduceLayerDocumentNexus
);
const visualResources = createLayerDocumentSourceRuntimeResourceCache();
const audioResources = createLayerDocumentAudioRuntimeStore();
let decodedDisposeCount = 0;
const decodedResource = {
  sourceId: "audio",
  fingerprint: "voice-v1",
  decodedAudio: {
    numberOfChannels: 1,
    length: 4,
    getChannelData: () => new Float32Array([0, 0.5, 1, 0.25]),
  },
  metadata: {
    durationSeconds: 3,
    channelCount: 1,
    sampleRate: 48_000,
  },
  dispose: () => { decodedDisposeCount += 1; },
};
assert.equal(audioResources.register([decodedResource]).ok, true);
let handleStops = 0;
const audioRuntime = createEditorAudioRuntime({
  resources: audioResources,
  backend: {
    start: ({ offsetSeconds }) => ({
      readPositionSeconds: () => offsetSeconds,
      setGain: () => undefined,
      stop: () => { handleStops += 1; },
    }),
  },
});
const commands = createEditorNexusCommandAdapter({
  nexus,
  sourceRuntime: visualResources,
  audioRuntime,
  clearDraft: () => undefined,
  applyNexusEffect: () => undefined,
  incrementMetric: () => undefined,
});

const deleteA = commands.commitSourcePreparation(
  prepareLayerDocumentDeleteWithOrphanSources(nexus.state.currentProject, {
    layerDocumentId: "a",
  })
);
assert.equal(deleteA.ok, true);
assert.ok(nexus.state.currentProject.payload.sourceRegistry.sourcesById.audio);
assert.strictEqual(audioResources.resolve("audio"), decodedResource);
assert.equal(decodedDisposeCount, 0);
assert.equal(nexus.state.undoStack.length, 1);

assert.equal(
  audioRuntime.play({
    project: nexus.state.currentProject,
    layerDocumentId: "b",
  }).ok,
  true
);
assert.equal(audioRuntime.readWaveform("audio", 2).length, 2);
const deleteB = commands.commitSourcePreparation(
  prepareLayerDocumentDeleteWithOrphanSources(nexus.state.currentProject, {
    layerDocumentId: "b",
  })
);
assert.equal(deleteB.ok, true);
assert.equal(handleStops, 1, "deleting the last placement stops playback immediately");
assert.equal(audioResources.resolve("audio"), null);
assert.equal(decodedDisposeCount, 0, "delete suspends decoded Audio without disposing it");
assert.equal(nexus.state.undoStack.length, 2);

assert.equal(commands.undo().ok, true);
assert.strictEqual(audioResources.resolve("audio"), decodedResource);
assert.equal(audioRuntime.readWaveform("audio", 2).length, 2);
assert.equal(commands.redo().ok, true);
assert.equal(audioResources.resolve("audio"), null);
assert.equal(commands.undo().ok, true);
assert.strictEqual(audioResources.resolve("audio"), decodedResource);
assert.equal(decodedDisposeCount, 0);

const physicalDeletePath = readFileSync(
  "src/engines/library/useLayerDocumentLibraryEngine.ts",
  "utf8"
);
assert.doesNotMatch(physicalDeletePath, /deleteRecordedAudioProjectAsset/);
assert.equal(
  readFileSync("src/editor/projectAssetDirectoryRuntime.ts", "utf8")
    .includes("removeEntry("),
  false,
  "Library deletion must not expose a physical project asset delete path"
);

audioRuntime.replaceProject(null);
assert.equal(
  decodedDisposeCount,
  1,
  "Project replacement releases active and suspended Audio exactly once"
);
audioRuntime.dispose();
audioRuntime.dispose();
visualResources.dispose();
assert.equal(decodedDisposeCount, 1, "Editor disposal does not dispose an Audio resource twice");
assert.match(
  readFileSync("src/editor/useLayerDocumentEditorRuntime.ts", "utf8"),
  /invalidation\.kind === "all"[\s\S]*audio\.replaceProject\(nexus\.state\.currentProject\)/,
  "successful lifecycle replacement must clear the Audio Project session cache"
);
console.log("Undo-safe Source Runtime verification passed");
