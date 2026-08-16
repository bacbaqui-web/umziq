import assert from "node:assert/strict";
import type { LayerDocumentCommon, LayerDocumentProject, LayerDocument } from "@/models";
import { LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION } from "@/models";
import { buildProjectExportAudioClips, combineProjectExportStreams } from "@/editor/projectExportAudio";
import { recordProjectVideo } from "@/editor/projectExportVideoRuntime";

function common(parent: string | null, order: number, start: number, duration: number, sourceId: string | null): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
    placement: { parentLayerDocumentId: parent, order, startFrame: start, durationFrames: duration, sourceOffsetFrames: 5, visible: true, locked: false, alias: null },
    animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
    effects: [
      { effectId: "delay", type: "delay", enabled: true, parameters: { time: 0.2 } },
      { effectId: "gate", type: "noise-gate", enabled: true, parameters: { strength: 0.5 } },
    ],
    modifiers: [],
  };
}
const layers: Record<string, LayerDocument> = {
  root: { layerDocumentId: "root", revision: 0, name: "Project", type: "group", common: common(null, 0, 0, 300, null), data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 } },
  cut: { layerDocumentId: "cut", revision: 0, name: "Cut", type: "group", common: common("root", 0, 30, 100, null), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 100 } },
  voice: { layerDocumentId: "voice", revision: 0, name: "Voice", type: "audio", common: common("cut", 0, 10, 60, "audio"), data: { gain: 2, muted: false, fadeInFrames: 10, fadeOutFrames: 10 } },
};
const project: LayerDocumentProject = {
  metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "export", name: "Export" },
  payload: {
    sourceRegistry: { sourcesById: { audio: { sourceId: "audio", kind: "audio", displayName: "Voice", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio", kind: "linked-file", suggestedFileName: "voice.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 300, channelCount: 1, sampleRate: 48_000, provenance: "imported" } } } },
    layerDocumentsById: layers,
  },
};
const resource = { decodedAudio: {}, metadata: { durationSeconds: 10, channelCount: 1, sampleRate: 48_000 } };
const rootClips = buildProjectExportAudioClips({ project, exportGroupLayerDocumentId: "root", durationFrames: 300, frameRate: 30, resolveAudioResource: () => resource });
assert.equal(rootClips.length, 1);
assert.equal(rootClips[0]!.startSeconds, 40 / 30, "Cut and Audio local start frames compose into project time");
assert.equal(rootClips[0]!.offsetSeconds, 5 / 30);
assert.equal(rootClips[0]!.durationSeconds, 2);
assert.deepEqual(rootClips[0]!.effects.map((effect) => effect.effectId), ["delay", "gate"], "ordered effect envelope is preserved");
assert.equal(rootClips[0]!.initialGain, 0);
assert.equal(rootClips[0]!.fadeInEndSeconds, 10 / 30);
assert.equal(rootClips[0]!.fadeOutStartSeconds, 50 / 30);
assert.equal(rootClips[0]!.finalGain, 0);

const cutClips = buildProjectExportAudioClips({ project, exportGroupLayerDocumentId: "cut", durationFrames: 100, frameRate: 30, resolveAudioResource: () => resource });
assert.equal(cutClips[0]!.startSeconds, 10 / 30, "current Cut export uses Cut-local time");
layers.voice.common.placement.visible = false;
assert.equal(buildProjectExportAudioClips({ project, exportGroupLayerDocumentId: "root", durationFrames: 300, frameRate: 30, resolveAudioResource: () => resource }).length, 0);
layers.voice.common.placement.visible = true;
if (layers.voice.type === "audio") layers.voice.data.muted = true;
assert.equal(buildProjectExportAudioClips({ project, exportGroupLayerDocumentId: "root", durationFrames: 300, frameRate: 30, resolveAudioResource: () => resource }).length, 0);
if (layers.voice.type === "audio") layers.voice.data.muted = false;
assert.throws(
  () => buildProjectExportAudioClips({ project, exportGroupLayerDocumentId: "root", durationFrames: 300, frameRate: 30, resolveAudioResource: () => null }),
  /오디오 원본을 불러올 수 없습니다/,
);

const videoTrack = { kind: "video" } as MediaStreamTrack;
const audioTrack = { kind: "audio" } as MediaStreamTrack;
const OriginalMediaStream = globalThis.MediaStream;
class FakeMediaStream {
  readonly tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[]) { this.tracks = tracks; }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
  getTracks() { return this.tracks; }
}
Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: FakeMediaStream });
try {
  const visual = new FakeMediaStream([videoTrack]) as unknown as MediaStream;
  const audio = new FakeMediaStream([audioTrack]) as unknown as MediaStream;
  const combined = combineProjectExportStreams(visual, audio);
  assert.deepEqual(combined.getVideoTracks(), [videoTrack]);
  assert.deepEqual(combined.getAudioTracks(), [audioTrack], "video recorder stream includes the mixed Audio track");
  assert.deepEqual(combineProjectExportStreams(visual, null).getAudioTracks(), [], "no-audio formats/exports add no Audio track");
} finally {
  Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: OriginalMediaStream });
}

{
  let videoTrackStops = 0;
  const cancellableVideoTrack = { kind: "video", stop: () => { videoTrackStops += 1; } } as unknown as MediaStreamTrack;
  const visualStream = new FakeMediaStream([cancellableVideoTrack]) as unknown as MediaStream;
  class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    static lastAudioTrackCount = 0;
    state: RecordingState = "inactive";
    mimeType = "video/webm";
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(stream: MediaStream) { FakeMediaRecorder.lastAudioTrackCount = stream.getAudioTracks().length; }
    start() { this.state = "recording"; }
    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      queueMicrotask(() => this.onstop?.());
    }
  }
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalRecorder = globalThis.MediaRecorder;
  Object.defineProperties(globalThis, {
    MediaStream: { configurable: true, value: FakeMediaStream },
    MediaRecorder: { configurable: true, value: FakeMediaRecorder },
    window: { configurable: true, value: { setTimeout } },
    document: { configurable: true, value: { createElement: () => ({ width: 0, height: 0, captureStream: () => visualStream }) } },
  });
  layers.voice.common.placement.visible = false;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5);
  try {
    await assert.rejects(
      recordProjectVideo({
        output: { captureStream: () => visualStream } as unknown as HTMLCanvasElement,
        mimeType: "video/mp4",
        renderFrame: async () => undefined,
        totalFrames: 30,
        frameRate: 30,
        transparent: false,
        audioMix: null,
        onProgress: () => undefined,
        signal: controller.signal,
      }),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
    assert.equal(videoTrackStops, 1, "cancel stops the captured video track exactly once");
    let audioDisposed = 0;
    let scheduledAt: number | null = null;
    const mixedAudio = new FakeMediaStream([audioTrack]) as unknown as MediaStream;
    const audioMix = {
      stream: mixedAudio,
      context: { get currentTime() { return performance.now() / 1_000; } } as AudioContext,
      schedule: (time: number) => { scheduledAt = time; },
      dispose: () => { audioDisposed += 1; },
    };
    await recordProjectVideo({
      output: { captureStream: () => visualStream } as unknown as HTMLCanvasElement,
      mimeType: "video/mp4",
      frameRate: 30,
      totalFrames: 1,
      transparent: false,
      audioMix,
      renderFrame: async () => undefined,
      onProgress: () => undefined,
    });
    assert.equal(FakeMediaRecorder.lastAudioTrackCount, 1, "fake MediaRecorder receives the mixed Audio track");
    assert.ok(scheduledAt !== null, "Audio mix is scheduled on the export clock");
    assert.equal(audioDisposed, 1, "successful export disposes the Audio mix");
  } finally {
    layers.voice.common.placement.visible = true;
    Object.defineProperties(globalThis, {
      MediaStream: { configurable: true, value: OriginalMediaStream },
      MediaRecorder: { configurable: true, value: originalRecorder },
      window: { configurable: true, value: originalWindow },
      document: { configurable: true, value: originalDocument },
    });
  }
}

console.log("Project Export Audio verification passed");
