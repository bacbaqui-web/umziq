import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import { createLayerDocumentAudioRuntimeStore } from "@/engines/project";
import {
  createEditorAudioRuntime,
  type EditorAudioAuditionBackend,
} from "@/editor/audio-runtime";

function common(parent: string | null, order: number, sourceId: string | null = null): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 },
      scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: { parentLayerDocumentId: parent, order, startFrame: 0, durationFrames: 90, sourceOffsetFrames: 0, visible: true, alias: null },
    animation: {
      positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
    },
    effects: [], modifiers: [],
  };
}

function project(): LayerDocumentProject {
  return {
    metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "audition", name: "Audition" },
    payload: {
      sourceRegistry: { sourcesById: {} },
      layerDocumentsById: {
        root: {
          layerDocumentId: "root", revision: 0, name: "Root", type: "group", common: common(null, 0),
          data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 },
        },
        a: {
          layerDocumentId: "a", revision: 0, name: "A", type: "audio", common: common("root", 0, "source-a"),
          data: { gain: 0.5, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
        },
        b: {
          layerDocumentId: "b", revision: 0, name: "B", type: "audio", common: common("root", 1, "source-b"),
          data: { gain: 0.8, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
        },
      },
    },
  };
}

let starts = 0;
let stops = 0;
let currentGain = -1;
let position = 0;
let ended: (() => void) | null = null;
const startRecords: Array<{ offsetSeconds: number; gain: number }> = [];
const backend: EditorAudioAuditionBackend = {
  start: (options) => {
    starts += 1;
    position = options.offsetSeconds;
    currentGain = options.gain;
    ended = options.onEnded;
    startRecords.push({ offsetSeconds: options.offsetSeconds, gain: options.gain });
    let stopped = false;
    return {
      readPositionSeconds: () => position,
      setGain: (gain) => { currentGain = gain; },
      stop: () => {
        if (stopped) return;
        stopped = true;
        stops += 1;
      },
    };
  },
};

const resources = createLayerDocumentAudioRuntimeStore();
assert.equal(resources.register([
  { sourceId: "source-a", fingerprint: "a", decodedAudio: {}, metadata: { durationSeconds: 3, channelCount: 1, sampleRate: 48_000 } },
  { sourceId: "source-b", fingerprint: "b", decodedAudio: {}, metadata: { durationSeconds: 4, channelCount: 2, sampleRate: 44_100 } },
]).ok, true);
const runtime = createEditorAudioRuntime({ resources, backend });
let notifications = 0;
const unsubscribe = runtime.subscribe(() => { notifications += 1; });
let current = project();

assert.equal(runtime.play({ project: current, layerDocumentId: "a" }).ok, true);
assert.equal(runtime.read().status, "playing");
assert.equal(currentGain, 0.5);
assert.equal(starts, 1);

assert.equal(runtime.play({ project: current, layerDocumentId: "b", offsetSeconds: 1.25 }).ok, true);
assert.equal(stops, 1, "starting B must stop A");
assert.equal(starts, 2);
assert.equal(runtime.read().status === "playing" ? runtime.read().layerDocumentId : null, "b");
assert.equal(runtime.read().status === "playing" ? runtime.read().positionSeconds : null, 1.25);

assert.equal(runtime.seek(2.5).ok, true);
assert.equal(stops, 2);
assert.equal(starts, 3);
assert.equal(runtime.read().status === "playing" ? runtime.read().positionSeconds : null, 2.5);

current = structuredClone(current);
const muted = current.payload.layerDocumentsById.b;
if (muted.type !== "audio") throw new Error("fixture");
muted.data.muted = true;
runtime.reconcileProject(current);
assert.equal(currentGain, 0);
assert.equal(runtime.read().status === "playing" ? runtime.read().muted : null, true);

const sourceBBeforeSuspend = resources.resolve("source-b");
runtime.suspendSource("source-b");
assert.equal(runtime.read().status, "idle");
assert.equal(stops, 3);
assert.equal(resources.resolve("source-b"), null);
assert.equal(runtime.restoreSource("source-b"), true);
assert.strictEqual(resources.resolve("source-b"), sourceBBeforeSuspend);
assert.equal(runtime.disposeSource("source-b"), true);
assert.equal(resources.resolve("source-b"), null);

resources.register([{
  sourceId: "source-a", fingerprint: "a", decodedAudio: {},
  metadata: { durationSeconds: 3, channelCount: 1, sampleRate: 48_000 },
}]);
assert.equal(runtime.play({ project: current, layerDocumentId: "a" }).ok, true);
runtime.replaceProject(project());
assert.equal(runtime.read().status, "idle");
assert.equal(resources.resolve("source-a"), null);

resources.register([{
  sourceId: "source-a", fingerprint: "a2", decodedAudio: {},
  metadata: { durationSeconds: 3, channelCount: 1, sampleRate: 48_000 },
}]);
runtime.play({ project: project(), layerDocumentId: "a" });
ended?.();
assert.equal(runtime.read().status, "idle");

const timelineProject = project();
const timelineA = timelineProject.payload.layerDocumentsById.a;
const timelineB = timelineProject.payload.layerDocumentsById.b;
timelineA.common.placement.startFrame = 10;
timelineA.common.placement.sourceOffsetFrames = 5;
timelineA.common.placement.durationFrames = 60;
if (timelineA.type !== "audio") throw new Error("fixture");
timelineA.data.fadeInFrames = 10;
timelineB.common.placement.startFrame = 10;
timelineB.common.placement.durationFrames = 60;
resources.register([
  { sourceId: "source-a", fingerprint: "timeline-a", decodedAudio: { numberOfChannels: 1, length: 4, getChannelData: () => new Float32Array([0, 0.5, -1, 0.25]) }, metadata: { durationSeconds: 3, channelCount: 1, sampleRate: 48_000 } },
  { sourceId: "source-b", fingerprint: "timeline-b", decodedAudio: {}, metadata: { durationSeconds: 4, channelCount: 2, sampleRate: 44_100 } },
]);
assert.deepEqual(runtime.readWaveform("source-a", 2), [0.5, 1]);
const startsBeforeTimeline = starts;
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 10, frameRate: 30, isPlaying: true });
assert.equal(starts, startsBeforeTimeline + 2, "overlapping Audio layers start from the Timeline clock");
assert.equal(startRecords.at(-2)?.offsetSeconds, 5 / 30, "source offset and placement frame determine seek position");
assert.equal(startRecords.at(-2)?.gain, 0, "fade-in is applied at the placement start");
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 11, frameRate: 30, isPlaying: true });
assert.equal(starts, startsBeforeTimeline + 2, "ordinary +1 frame tick must not restart Audio");
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 25, frameRate: 30, isPlaying: true });
assert.equal(starts, startsBeforeTimeline + 4, "seek/discontinuity restarts active Audio at the requested frame");
if (timelineB.type !== "audio") throw new Error("fixture");
timelineB.data.muted = true;
runtime.reconcileProject(timelineProject);
const stopsAfterMute = stops;
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 26, frameRate: 30, isPlaying: true });
assert.equal(stops, stopsAfterMute, "muted Audio remains suppressed");
delete timelineProject.payload.layerDocumentsById.a;
runtime.reconcileProject(timelineProject);
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 27, frameRate: 30, isPlaying: true });
const stopsBeforePause = stops;
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 27, frameRate: 30, isPlaying: false });
assert.equal(stops, stopsBeforePause, "deleted/muted tracks leave no handle for pause to stop");
timelineProject.payload.layerDocumentsById.a = timelineA;
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 27, frameRate: 30, isPlaying: true });
assert.ok(starts > startsBeforeTimeline + 4, "resume starts eligible Audio from the Timeline frame");
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 89, frameRate: 30, isPlaying: true });
const stopsOutOfRange = stops;
runtime.synchronizeTimeline({ project: timelineProject, activeGroupLayerDocumentId: "root", currentFrame: 90, frameRate: 30, isPlaying: true });
assert.equal(stops, stopsOutOfRange, "out-of-range Audio remains suppressed");
assert.ok(notifications >= 7);
unsubscribe();
runtime.dispose();
runtime.dispose();
console.log("Editor Audio Runtime verification passed");
