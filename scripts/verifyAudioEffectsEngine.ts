import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerEffect,
} from "@/models";
import { createLayerDocumentAudioRuntimeStore } from "@/engines/project";
import { AUDIO_EFFECT_CATALOG, audioEffectParameters, clampAudioEffectParameter, createAudioEffect, createAudioEffectsNexusPort } from "@/engines/audio";
import { createEditorAudioRuntime } from "@/editor/audio-runtime";

function common(parentLayerDocumentId: string | null, sourceId: string | null): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
    placement: { parentLayerDocumentId, order: 0, startFrame: 0, durationFrames: 90, sourceOffsetFrames: 0, visible: true, alias: null },
    animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
    effects: [], modifiers: [],
  };
}

let project: LayerDocumentProject = {
  metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "effects", name: "Effects" },
  payload: {
    sourceRegistry: { sourcesById: { audio: { sourceId: "audio", kind: "audio", displayName: "voice", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio", kind: "linked-file", suggestedFileName: "voice.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 90, channelCount: 1, sampleRate: 48_000, provenance: "imported" } } } },
    layerDocumentsById: {
      root: { layerDocumentId: "root", revision: 0, name: "Root", type: "group", common: common(null, null), data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 } },
      cut: { layerDocumentId: "cut", revision: 0, name: "Cut", type: "group", common: common("root", null), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 } },
      voice: { layerDocumentId: "voice", revision: 0, name: "Voice", type: "audio", common: common("cut", "audio"), data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 } },
      visual: { layerDocumentId: "visual", revision: 0, name: "Visual", type: "drawing", common: common("cut", null), data: { documentVersion: 1, elements: [] } },
    },
  },
};
project.payload.layerDocumentsById.visual.common.placement.order = 1;
let selected: string | null = "voice";
let history = 0;
const nexus = createAudioEffectsNexusPort({
  readProject: () => project,
  readSelectedLayerDocumentId: () => selected,
  commit: (transaction) => { project = transaction.after; history += 1; return { ok: true }; },
});
assert.deepEqual(AUDIO_EFFECT_CATALOG.map((item) => item.type), ["compressor", "reverb", "delay", "noise-gate"]);
const compressor = createAudioEffect("compressor", "effect:compressor:stable");
assert.equal(nexus.commit([compressor]).ok, true);
assert.equal(history, 1);
assert.equal(project.payload.layerDocumentsById.voice.common.effects[0].effectId, "effect:compressor:stable");
const delay = createAudioEffect("delay", "effect:delay:stable");
assert.equal(nexus.commit([compressor, delay]).ok, true);
assert.equal(history, 2, "add creates one transaction");
assert.equal(nexus.commit([delay, compressor]).ok, true);
assert.equal(history, 3, "reorder creates one transaction");
assert.equal(nexus.commit([{ ...delay, enabled: false }, compressor]).ok, true);
assert.equal(history, 4, "bypass creates one transaction");
const delayTime = audioEffectParameters(delay).find((item) => item.key === "time");
assert.equal(delayTime?.value, 0.25);
assert.equal(clampAudioEffectParameter("delay", "feedback", 5), 0.9);
const historyBeforeDraft = history;
const draftOnly = "0.75";
assert.equal(draftOnly, "0.75");
assert.equal(history, historyBeforeDraft, "continuous Draft does not touch Nexus/History");
const editedDelay: LayerEffect = { ...delay, parameters: { ...delay.parameters, time: clampAudioEffectParameter("delay", "time", Number(draftOnly))! } };
assert.equal(nexus.commit([editedDelay, compressor]).ok, true);
assert.equal(history, historyBeforeDraft + 1, "parameter confirm creates one transaction");
selected = "visual";
assert.equal(nexus.commit([]).ok, false);
assert.equal(history, historyBeforeDraft + 1, "non-Audio stale selection creates no transaction");

const resources = createLayerDocumentAudioRuntimeStore();
resources.register([{ sourceId: "audio", fingerprint: "fixture", decodedAudio: {}, metadata: { durationSeconds: 3, channelCount: 1, sampleRate: 48_000 } }]);
const startedEffects: readonly LayerEffect[][] = [];
const runtime = createEditorAudioRuntime({ resources, backend: { start: (options) => {
  startedEffects.push(structuredClone(options.effects));
  return { readPositionSeconds: () => options.offsetSeconds, setGain: () => undefined, stop: () => undefined };
} } });
runtime.play({ project, layerDocumentId: "voice" });
assert.equal(startedEffects.length, 1);
assert.deepEqual(startedEffects[0].map((effect) => effect.effectId), ["effect:delay:stable", "effect:compressor:stable"]);
selected = "voice";
nexus.commit([...project.payload.layerDocumentsById.voice.common.effects, createAudioEffect("reverb", "effect:reverb:stable")]);
runtime.reconcileProject(project);
assert.equal(startedEffects.length, 2, "active audition restarts at its position when the effect graph changes");
runtime.dispose();

const hookSource = readFileSync(new URL("../src/engines/audio/useAudioEngine.ts", import.meta.url), "utf8");
const composerSource = readFileSync(new URL("../src/engines/audio/composers/useAudioComposer.ts", import.meta.url), "utf8");
const controllerSource = readFileSync(new URL("../src/engines/audio/controllers/useAudioEffectsController.ts", import.meta.url), "utf8");
assert.match(hookSource, /useAudioComposer\(options\)/);
assert.doesNotMatch(hookSource, /useState|setDraft|\.commit\(/);
assert.match(composerSource, /useAudioBasicController/);
assert.match(composerSource, /useAudioEffectsController/);
assert.match(controllerSource, /changeParameter:[\s\S]*setDraft/);
assert.match(controllerSource, /commitParameter:[\s\S]*commit/);
assert.match(controllerSource, /cancelParameter: \(\) => setDraft\(null\)/);
console.log("Audio Effects Engine verification passed");
