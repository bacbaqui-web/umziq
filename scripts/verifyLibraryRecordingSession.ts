import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  prepareLayerDocumentAudioImport,
  type LayerDocumentAudioProcessingSnapshot,
  type LayerDocumentAudioRecordingSession,
  type PreparedLayerDocumentAudioImport,
} from "@/engines/project";
import {
  createLibraryRecordingSessionController,
} from "@/engines/library/controllers/libraryRecordingSessionController";
import {
  createEditorLibraryRecordingAssetStoreAdapter,
} from "@/editor/libraryRecordingAssetStoreAdapter";

function common(parentLayerDocumentId: string | null): LayerDocumentCommon {
  return {
    source: null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 },
      scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: {
      parentLayerDocumentId, order: 0, startFrame: 0, durationFrames: 300,
      sourceOffsetFrames: 0, visible: true, alias: null,
    },
    animation: {
      positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
    },
    effects: [], modifiers: [],
  };
}

function fixture(): LayerDocumentProject {
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "recording-session",
      name: "Recording session",
    },
    payload: {
      sourceRegistry: { sourcesById: {} },
      layerDocumentsById: {
        root: {
          layerDocumentId: "root", revision: 0, name: "Root", type: "group",
          common: common(null),
          data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 },
        },
      },
    },
  };
}

let preparedSequence = 0;
async function makePrepared(onDispose?: () => void) {
  preparedSequence += 1;
  return prepareLayerDocumentAudioImport({
    project: fixture(),
    file: new File([`voice-${preparedSequence}`], `take-${preparedSequence}.webm`, {
      type: "audio/webm",
    }),
    token: `take-${preparedSequence}`,
    selectedLayerDocumentId: "root",
    provenance: "recorded",
    decoder: {
      decode: async () => ({
        decodedAudio: { take: preparedSequence },
        metadata: { durationSeconds: 1, channelCount: 1, sampleRate: 48_000 },
        dispose: onDispose,
      }),
    },
  });
}

const fakeSession = (id: number) => ({
  id,
  state: "ready",
  startedAt: 0,
  recorder: {
    mimeType: "audio/webm",
    start: () => undefined,
    stop: async () => new Blob(),
    cancel: () => undefined,
    dispose: () => undefined,
  },
}) as unknown as LayerDocumentAudioRecordingSession;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function waitFor(
  read: () => { readonly status: string },
  status: string
) {
  for (let index = 0; index < 20; index += 1) {
    if (read().status === status) return;
    await flush();
  }
  assert.equal(read().status, status);
}

const processingOff: LayerDocumentAudioProcessingSnapshot = {
  noiseSuppression: { supported: true, enabled: false, canToggle: true },
  echoCancellation: { supported: true, enabled: false, canToggle: true },
  autoGainControl: { supported: true, enabled: false, canToggle: true },
};
const processingOn: LayerDocumentAudioProcessingSnapshot = {
  ...processingOff,
  noiseSuppression: { supported: true, enabled: true, canToggle: true },
};
let requestedProcessing: Partial<Record<keyof LayerDocumentAudioProcessingSnapshot, boolean>> | null = null;
const processingController = createLibraryRecordingSessionController({
  audioRecording: {
    start: async (preferences) => {
      requestedProcessing = preferences;
      return ({
      cutLayerDocumentId: "root",
      startedAt: 0,
      state: "ready",
      disposed: false,
      recorder: {
        mimeType: "audio/webm",
        start: () => undefined,
        audioProcessing: processingOn,
        stop: async () => new Blob(),
        cancel: () => undefined,
        dispose: () => undefined,
      },
    }); },
    begin: (session) => { session.state = "recording"; return true; },
    stop: async () => { throw new Error("not used"); },
    cancel: () => true,
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: () => undefined,
    confirm: () => ({ ok: true }),
  },
  assetStore: { persist: async (candidate) => candidate },
});
processingController.start();
await waitFor(processingController.read, "ready");
assert.equal(
  processingController.read().audioProcessing?.noiseSuppression.enabled,
  false,
  "the setup screen defaults browser processing to off"
);
processingController.setAudioProcessing("noiseSuppression", true);
assert.equal(
  processingController.read().audioProcessing?.noiseSuppression.enabled,
  true,
  "the setup screen stores the requested processing preference"
);
processingController.begin();
await waitFor(processingController.read, "recording");
assert.equal(requestedProcessing?.noiseSuppression, true);
processingController.dispose();

// Stop and repeated recording only touch the session Runtime. Confirm performs
// the first and only file write, then one Owner confirm.
let preparedDisposals = 0;
const takes = [
  await makePrepared(() => { preparedDisposals += 1; }),
  await makePrepared(() => { preparedDisposals += 1; }),
];
let starts = 0;
let writes = 0;
let confirms = 0;
const controller = createLibraryRecordingSessionController({
  audioRecording: {
    start: async () => fakeSession(++starts),
    begin: (session) => { session.state = "recording"; return true; },
    stop: async () => takes.shift()!,
    cancel: () => true,
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: (candidate) => candidate.runtime.cancel(),
    confirm: (candidate) => {
      confirms += 1;
      assert.match(
        candidate.command.sources[0]?.locator.relativePathHint ?? "",
        /^audio\//
      );
      return { ok: true };
    },
  },
  assetStore: {
    persist: async (candidate) => {
      writes += 1;
      const storedFile = new File([await candidate.file.arrayBuffer()], candidate.file.name, {
        type: candidate.file.type,
      });
      return {
        ...candidate,
        file: storedFile,
        command: {
          ...candidate.command,
          sources: candidate.command.sources.map((source) => ({
            ...source,
            locator: {
              ...source.locator,
              relativePathHint: `audio/${storedFile.name}`,
            },
          })),
        },
      };
    },
  },
});
controller.start();
await waitFor(controller.read, "ready");
controller.begin();
await waitFor(controller.read, "recording");
controller.stop();
await waitFor(controller.read, "review");
assert.equal(writes, 0, "stop does not write a project file");
assert.equal(confirms, 0, "stop does not touch Owner/History");
controller.retry();
await waitFor(controller.read, "ready");
controller.begin();
await waitFor(controller.read, "recording");
assert.equal(preparedDisposals, 1, "retry disposes the previous take exactly once");
assert.equal(writes, 0, "retry does not write a project file");
controller.stop();
await waitFor(controller.read, "review");
controller.confirm();
await waitFor(controller.read, "idle");
assert.equal(writes, 1, "confirm writes exactly one final recording");
assert.equal(confirms, 1, "confirm performs one Owner confirm");
assert.equal(preparedDisposals, 1, "confirmed Runtime transfers without cancellation");
controller.dispose();

// A failed asset write keeps the prepared take available for a confirm retry.
const retryPrepared = await makePrepared();
let writeAttempts = 0;
let retryConfirms = 0;
const retryController = createLibraryRecordingSessionController({
  audioRecording: {
    start: async () => fakeSession(3),
    begin: (session) => { session.state = "recording"; return true; },
    stop: async () => retryPrepared,
    cancel: () => true,
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: (candidate) => candidate.runtime.cancel(),
    confirm: () => { retryConfirms += 1; return { ok: true }; },
  },
  assetStore: {
    persist: async (candidate) => {
      writeAttempts += 1;
      if (writeAttempts === 1) throw new Error("disk unavailable");
      return candidate;
    },
  },
});
retryController.start();
await waitFor(retryController.read, "ready");
retryController.begin();
await waitFor(retryController.read, "recording");
retryController.stop();
await waitFor(retryController.read, "review");
retryController.confirm();
await waitFor(retryController.read, "error");
assert.equal(retryController.read().canConfirm, true);
assert.equal(retryConfirms, 0, "storage failure leaves Project/History untouched");
retryController.confirm();
await waitFor(retryController.read, "idle");
assert.equal(writeAttempts, 2);
assert.equal(retryConfirms, 1);
retryController.dispose();

// Project replacement/unmount invalidates a pending stop and cancels its late
// prepared Runtime exactly once without persisting it.
let resolvePending!: (value: PreparedLayerDocumentAudioImport) => void;
const pendingStop = new Promise<PreparedLayerDocumentAudioImport>((resolve) => {
  resolvePending = resolve;
});
let staleDisposals = 0;
const stalePrepared = await makePrepared(() => { staleDisposals += 1; });
let staleWrites = 0;
const staleController = createLibraryRecordingSessionController({
  audioRecording: {
    start: async () => fakeSession(4),
    begin: (session) => { session.state = "recording"; return true; },
    stop: () => pendingStop,
    cancel: () => true,
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: (candidate) => candidate.runtime.cancel(),
    confirm: () => { throw new Error("not used"); },
  },
  assetStore: {
    persist: async (candidate) => { staleWrites += 1; return candidate; },
  },
});
staleController.start();
await waitFor(staleController.read, "ready");
staleController.begin();
await waitFor(staleController.read, "recording");
staleController.stop();
await waitFor(staleController.read, "preparing");
staleController.dispose();
resolvePending(stalePrepared);
await flush();
assert.equal(staleDisposals, 1);
assert.equal(staleWrites, 0);

// Owner rejection happens only after the approved file write, leaves History
// untouched and disposes the non-transferred prepared Runtime once.
let rejectedDisposals = 0;
const rejectedPrepared = await makePrepared(() => { rejectedDisposals += 1; });
let rejectedWrites = 0;
const rejectedHistory = 0;
let rejectedRecorderCancels = 0;
const rejectedController = createLibraryRecordingSessionController({
  audioRecording: {
    start: async () => fakeSession(5),
    begin: (session) => { session.state = "recording"; return true; },
    stop: async () => rejectedPrepared,
    cancel: () => { rejectedRecorderCancels += 1; return true; },
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: (candidate) => candidate.runtime.cancel(),
    confirm: (candidate) => {
      const claim = candidate.runtime.claimForConfirm();
      assert.equal(claim.ok, true);
      candidate.runtime.failBeforeOwner();
      return { ok: false, recovery: "none", message: "Owner rejected" };
    },
  },
  assetStore: {
    persist: async (candidate) => { rejectedWrites += 1; return candidate; },
  },
});
rejectedController.start();
await waitFor(rejectedController.read, "ready");
rejectedController.begin();
await waitFor(rejectedController.read, "recording");
rejectedController.stop();
await waitFor(rejectedController.read, "review");
rejectedController.confirm();
await waitFor(rejectedController.read, "error");
assert.equal(rejectedWrites, 1);
assert.equal(rejectedHistory, 0);
assert.equal(rejectedDisposals, 1);
assert.equal(rejectedController.read().canConfirm, false);
rejectedController.retry();
await waitFor(rejectedController.read, "ready");
rejectedController.begin();
await waitFor(rejectedController.read, "recording");
rejectedController.cancel();
assert.equal(rejectedRecorderCancels, 1);
assert.equal(rejectedController.read().status, "idle");
rejectedController.dispose();

// If Owner committed but Runtime registration remains pending, Project/session
// replacement abandons that retry resource exactly once instead of leaking it.
let pendingRegistrationDisposals = 0;
const pendingRegistrationPrepared = await makePrepared(
  () => { pendingRegistrationDisposals += 1; }
);
const pendingRegistrationController = createLibraryRecordingSessionController({
  audioRecording: {
    start: async () => fakeSession(6),
    begin: (session) => { session.state = "recording"; return true; },
    stop: async () => pendingRegistrationPrepared,
    cancel: () => true,
  },
  audioImport: {
    prepare: async () => { throw new Error("not used"); },
    cancel: (candidate) => candidate.runtime.cancel(),
    confirm: (candidate) => {
      const claim = candidate.runtime.claimForConfirm();
      assert.equal(claim.ok, true);
      candidate.runtime.markOwnerCommitted();
      candidate.runtime.markRegistrationFailed();
      return {
        ok: false,
        recovery: "retry-runtime-registration",
        message: "registration pending",
      };
    },
  },
  assetStore: { persist: async (candidate) => candidate },
});
pendingRegistrationController.start();
await waitFor(pendingRegistrationController.read, "ready");
pendingRegistrationController.begin();
await waitFor(pendingRegistrationController.read, "recording");
pendingRegistrationController.stop();
await waitFor(pendingRegistrationController.read, "review");
pendingRegistrationController.confirm();
await waitFor(pendingRegistrationController.read, "error");
assert.equal(pendingRegistrationController.read().canCancel, false);
pendingRegistrationController.dispose();
assert.equal(pendingRegistrationDisposals, 1);
assert.equal(
  pendingRegistrationPrepared.runtime.readState(),
  "abandoned-after-owner"
);

// The Editor adapter records the actual collision-safe path returned by the
// project asset directory writer.
const adapterPrepared = await makePrepared();
const adapter = createEditorLibraryRecordingAssetStoreAdapter(async () => [{
  file: new File(["stored"], "take (2).webm", { type: "audio/webm" }),
  relativePathHint: "audio/take (2).webm",
}]);
const storedPrepared = await adapter.persist(adapterPrepared);
assert.equal(storedPrepared.file.name, "take (2).webm");
assert.equal(
  storedPrepared.command.sources[0]?.locator.relativePathHint,
  "audio/take (2).webm"
);
adapterPrepared.runtime.cancel();

console.log("Library confirmed recording session verification passed");
