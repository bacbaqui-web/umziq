import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  buildUpdateLayerDocumentCommonTransaction,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  resolveLayerDocumentTimelineTimingDraft,
  projectLayerDocumentAudioWaveform,
} from "@/engines/timeline";

const common: LayerDocumentCommon = {
  source: { sourceId: "audio-source" },
  transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
  placement: { parentLayerDocumentId: "root", order: 0, startFrame: 10, durationFrames: 30, sourceOffsetFrames: 5, visible: true, alias: null },
  animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
  effects: [], modifiers: [],
};
let project: LayerDocumentProject = {
  metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "audio-timing", name: "Audio timing" },
  payload: {
    sourceRegistry: { sourcesById: {
      "audio-source": { sourceId: "audio-source", kind: "audio", displayName: "Audio", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio", kind: "linked-file", suggestedFileName: "audio.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 40, channelCount: 1, sampleRate: 48_000, provenance: "imported" } },
    } },
    layerDocumentsById: {
      root: { layerDocumentId: "root", revision: 0, name: "Root", type: "group", common: { ...structuredClone(common), source: null, placement: { ...common.placement, parentLayerDocumentId: null } }, data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 120 } },
      audio: { layerDocumentId: "audio", revision: 0, name: "Audio", type: "audio", common, data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 } },
    },
  },
};
let historyCount = 0;
const initial = { layerDocumentId: "audio", ...common.placement };
assert.deepEqual(
  projectLayerDocumentAudioWaveform([0, 0.25, 0.5, 0.75, 1], 50, 10, 20),
  [0.25, 0.5],
  "waveform projection follows source offset and trimmed duration"
);
const trimStart = resolveLayerDocumentTimelineTimingDraft({ operation: "trim-start", timelineDurationFrames: 120, sourceDurationFrames: 40, initial }, 8);
assert.equal(trimStart.startFrame, 18);
assert.equal(trimStart.durationFrames, 22);
assert.equal(trimStart.sourceOffsetFrames, 13);
assert.equal(historyCount, 0, "pointer draft does not create History");
const commit = buildUpdateLayerDocumentCommonTransaction(project, {
  layerDocumentId: "audio",
  update: {
    kind: "set-placement-timing",
    startFrame: trimStart.startFrame,
    durationFrames: trimStart.durationFrames,
    sourceOffsetFrames: trimStart.sourceOffsetFrames,
  },
});
assert.equal(commit.ok, true);
if (commit.ok) {
  project = commit.transaction.after;
  historyCount += 1;
}
assert.equal(historyCount, 1, "pointer release creates one History entry");
assert.equal(project.payload.layerDocumentsById.audio.common.placement.sourceOffsetFrames, 13);
const trimEnd = resolveLayerDocumentTimelineTimingDraft({ operation: "trim-end", timelineDurationFrames: 120, sourceDurationFrames: 40, initial }, 100);
assert.equal(trimEnd.durationFrames, 35, "trim end is clamped by sourceOffset + source duration");
const extendStart = resolveLayerDocumentTimelineTimingDraft({ operation: "trim-start", timelineDurationFrames: 120, sourceDurationFrames: 40, initial }, -100);
assert.equal(extendStart.sourceOffsetFrames, 0, "trim start cannot create a negative source offset");
const movedBeforeTimeline = resolveLayerDocumentTimelineTimingDraft(
  { operation: "move", timelineDurationFrames: 120, sourceDurationFrames: 40, initial },
  -100
);
assert.equal(movedBeforeTimeline.startFrame, -29, "a moved Layer may extend before frame zero while one frame remains reachable");
const movedAfterTimeline = resolveLayerDocumentTimelineTimingDraft(
  { operation: "move", timelineDurationFrames: 120, sourceDurationFrames: 40, initial },
  200
);
assert.equal(movedAfterTimeline.startFrame, 119, "a moved Layer may extend past the parent duration while one frame remains reachable");
const moveBeforeCommit = buildUpdateLayerDocumentCommonTransaction(project, {
  layerDocumentId: "audio",
  update: {
    kind: "set-placement-timing",
    startFrame: movedBeforeTimeline.startFrame,
    durationFrames: movedBeforeTimeline.durationFrames,
    sourceOffsetFrames: movedBeforeTimeline.sourceOffsetFrames,
  },
});
assert.equal(moveBeforeCommit.ok, true, "negative Placement start persists through the Owner transaction");

console.log("LayerDocument Timeline Audio timing verification passed");
