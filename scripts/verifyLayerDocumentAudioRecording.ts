import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  cancelLayerDocumentAudioRecording,
  createLayerDocumentAudioRuntimeStore,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  startLayerDocumentAudioRecording,
  stopLayerDocumentAudioRecording,
  type LayerDocumentAudioRecordingBrowserPort,
  LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT,
} from "@/engines/project";
import { confirmLayerDocumentAudioPreparedSource } from "@/engines/library";

function common(parentLayerDocumentId: string | null): LayerDocumentCommon {
  return {
    source: null,
    transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
    placement: { parentLayerDocumentId, order: 0, startFrame: 0, durationFrames: 300, sourceOffsetFrames: 0, visible: true, alias: null },
    animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
    effects: [], modifiers: [],
  };
}

function fixture(): LayerDocumentProject {
  return {
    metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "recording", name: "Recording" },
    payload: {
      sourceRegistry: { sourcesById: {} },
      layerDocumentsById: {
        root: { layerDocumentId: "root", revision: 0, name: "Root", type: "group", common: common(null), data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 } },
        cut: { layerDocumentId: "cut", revision: 0, name: "Cut", type: "group", common: common("root"), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 } },
      },
    },
  };
}

function fakeBrowser(blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" })) {
  let stops = 0;
  let cancels = 0;
  let disposals = 0;
  const browser: LayerDocumentAudioRecordingBrowserPort = {
    request: async () => ({
      mimeType: "audio/webm",
      stop: async () => { stops += 1; return blob; },
      cancel: () => { cancels += 1; },
      dispose: () => { disposals += 1; },
    }),
  };
  return { browser, counts: () => ({ stops, cancels, disposals }) };
}

const decoder = { decode: async () => ({ decodedAudio: { recorded: true }, metadata: { durationSeconds: 1, channelCount: 1, sampleRate: 48_000 } }) };

// Exercise the real browser adapter with fake getUserMedia/MediaRecorder.
let fakeTrackStops = 0;
class FakeTrack extends EventTarget { stop() { fakeTrackStops += 1; } }
class FakeMediaRecorder extends EventTarget {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  readonly stream: MediaStream;
  constructor(stream: MediaStream) { super(); this.stream = stream; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    const data = new Event("dataavailable") as BlobEvent;
    Object.defineProperty(data, "data", { value: new Blob(["voice"], { type: this.mimeType }) });
    this.dispatchEvent(data);
    this.dispatchEvent(new Event("stop"));
  }
}
const originalMediaRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
const originalMediaDevices = Object.getOwnPropertyDescriptor(globalThis.navigator, "mediaDevices");
const fakeTrack = new FakeTrack();
Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [fakeTrack] }) } });
Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
const browserRecorder = await LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT.request();
assert.equal((await browserRecorder.stop()).size > 0, true);
browserRecorder.dispose();
assert.equal(fakeTrackStops, 1);
if (originalMediaRecorder) Object.defineProperty(globalThis, "MediaRecorder", originalMediaRecorder);
else delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
if (originalMediaDevices) Object.defineProperty(globalThis.navigator, "mediaDevices", originalMediaDevices);
else delete (globalThis.navigator as { mediaDevices?: unknown }).mediaDevices;

let project = fixture();
const fake = fakeBrowser();
const session = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: fake.browser, now: () => 100 });
assert.equal(session.cutLayerDocumentId, "cut");
assert.deepEqual(fake.counts(), { stops: 0, cancels: 0, disposals: 0 });
const prepared = await stopLayerDocumentAudioRecording({ session, project, token: "take", decoder, now: () => new Date("2026-08-17T01:02:03Z") });
assert.deepEqual(fake.counts(), { stops: 1, cancels: 0, disposals: 1 });
assert.match(prepared.command.layers[0].name, /^움직 녹음/);
assert.equal(prepared.command.sources[0]?.kind, "audio");
assert.equal(prepared.command.sources[0]?.kind === "audio" && prepared.command.sources[0].data.provenance, "recorded");

let history = 0;
const runtime = createLayerDocumentAudioRuntimeStore();
const resolution = createLayerDocumentSourceRuntimeResolutionStore();
const confirmed = confirmLayerDocumentAudioPreparedSource({
  prepared,
  readProject: () => project,
  prepare: (current, command) => LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(current, command),
  commit: (result) => {
    if (!result.ok) return { ok: false as const, stage: "preparation" as const, message: result.error.message };
    project = result.transaction.after;
    history += 1;
    return { ok: true as const };
  },
  runtime,
  sourceResolution: resolution,
});
assert.equal(confirmed.ok, true);
assert.equal(history, 1, "recording confirm creates exactly one Owner history entry");
assert.equal(project.payload.layerDocumentsById[prepared.layerDocumentId].type, "audio");

let failedPreparedDisposals = 0;
const ownerFailureFake = fakeBrowser(new Blob(["different"], { type: "audio/webm" }));
const ownerFailureSession = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: ownerFailureFake.browser });
const ownerFailurePrepared = await stopLayerDocumentAudioRecording({
  session: ownerFailureSession,
  project,
  token: "owner-failure",
  decoder: { decode: async () => ({ decodedAudio: {}, metadata: { durationSeconds: 1, channelCount: 1, sampleRate: 48_000 }, dispose: () => { failedPreparedDisposals += 1; } }) },
});
const ownerFailure = confirmLayerDocumentAudioPreparedSource({
  prepared: ownerFailurePrepared,
  readProject: () => project,
  prepare: (current, command) => LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(current, command),
  commit: () => ({ ok: false as const, stage: "owner" as const, message: "rejected" }),
  runtime,
  sourceResolution: resolution,
});
assert.equal(ownerFailure.ok, false);
assert.equal(failedPreparedDisposals, 1);
assert.equal(history, 1, "Owner failure does not update Project/History");

const cancelledFake = fakeBrowser();
const cancelled = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: cancelledFake.browser });
assert.equal(cancelLayerDocumentAudioRecording(cancelled), true);
assert.equal(cancelLayerDocumentAudioRecording(cancelled), false);
assert.deepEqual(cancelledFake.counts(), { stops: 0, cancels: 1, disposals: 1 });
assert.equal(history, 1, "cancel does not update Project/History");

const emptyFake = fakeBrowser(new Blob([], { type: "audio/webm" }));
const empty = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: emptyFake.browser });
await assert.rejects(stopLayerDocumentAudioRecording({ session: empty, project, token: "empty", decoder }), /없습니다/);
assert.equal(emptyFake.counts().disposals, 1);

const decodeFake = fakeBrowser();
const decodeFailure = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: decodeFake.browser });
await assert.rejects(stopLayerDocumentAudioRecording({ session: decodeFailure, project, token: "decode", decoder: { decode: async () => { throw new Error("decode failed"); } } }), /decode failed/);
assert.equal(decodeFake.counts().disposals, 1);

const staleFake = fakeBrowser();
const stale = await startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: staleFake.browser });
const staleProject = fixture();
delete staleProject.payload.layerDocumentsById.cut;
await assert.rejects(stopLayerDocumentAudioRecording({ session: stale, project: staleProject, token: "stale", decoder }), /Cut/);
assert.equal(staleFake.counts().disposals, 1);
assert.equal(history, 1, "stale recording does not update Project/History");

await assert.rejects(startLayerDocumentAudioRecording({ project, selectedLayerDocumentId: "cut", browser: { request: async () => { throw new Error("permission denied"); } } }), /permission denied/);
assert.equal(history, 1, "permission denial does not update Project/History");
runtime.dispose();
console.log("Layer Document Audio recording verification passed");
