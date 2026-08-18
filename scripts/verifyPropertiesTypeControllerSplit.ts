import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPropertiesNumericDraftController,
} from "@/engines/properties/controllers/propertiesNumericDraftController";
import {
  resolvePropertiesSelectionKind,
} from "@/engines/properties/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/properties/models/layerDocumentPropertiesModel";
import type {
  PropertiesNumericDraftState,
} from "@/engines/properties/models/propertiesNumericDraftModel";

let draftState: PropertiesNumericDraftState = {
  scopeIdentity: "layer-a:1:0:0:0",
  focusedInputId: null,
  inputDrafts: {},
};
const draft = createPropertiesNumericDraftController({
  read: () => draftState,
  replace: (next) => { draftState = next; },
});
draft.begin("position.x", "12", draftState.scopeIdentity);
assert.equal(draft.read().focusedInputId, "position.x");
assert.equal(draft.change("position.x", "24"), true);
assert.equal(draft.read().inputDrafts["position.x"], "24");
assert.equal(draft.change("audio.gain", "2"), false);
assert.equal(draft.syncScope("layer-b:2:1:1:0"), true);
assert.deepEqual(draft.read(), {
  scopeIdentity: "layer-b:2:1:1:0",
  focusedInputId: null,
  inputDrafts: {},
});
draft.begin("audio.name", "Voice", draftState.scopeIdentity);
assert.equal(draft.cancel("audio.name"), true);
assert.equal(draft.read().focusedInputId, null);

assert.equal(resolvePropertiesSelectionKind(null), "none");
assert.equal(resolvePropertiesSelectionKind({
  typeData: { kind: "audio" },
} as LayerDocumentPropertiesDescriptor), "audio");
assert.equal(resolvePropertiesSelectionKind({
  typeData: { kind: "drawing" },
} as LayerDocumentPropertiesDescriptor), "visual");

const source = (path: string) => readFileSync(
  new URL(`../${path}`, import.meta.url),
  "utf8"
);
const engine = source("src/engines/properties/useLayerDocumentPropertiesEngine.ts");
const composer = source("src/engines/properties/composers/useLayerDocumentPropertiesComposer.ts");
const viewComposer = source("src/engines/properties/composers/propertiesViewPropsComposer.ts");
const numericDraft = source("src/engines/properties/controllers/propertiesNumericDraftController.ts");
const visual = source("src/engines/properties/controllers/visualPropertiesController.ts");
const audio = source("src/engines/properties/controllers/audioPropertiesController.ts");
const modifier = source("src/engines/properties/controllers/modifierPropertiesController.ts");
const helperFiles = [
  "audioPropertiesHelpers.ts",
  "modifierPropertiesViewModelHelpers.ts",
  "propertiesDescriptorViewModelHelpers.ts",
  "propertiesSelectionHelpers.ts",
  "visualPropertiesHelpers.ts",
  "visualPropertiesViewModelHelpers.ts",
].map((file) => source(`src/engines/properties/helpers/${file}`));

assert.match(engine, /useLayerDocumentPropertiesComposer\(options\)/);
assert.doesNotMatch(engine, /useState|dispatchPanel|set-audio-properties|set-modifiers/);
assert.match(composer, /createAudioPropertiesController/);
assert.match(composer, /useVisualPropertiesController/);
assert.match(composer, /createModifierPropertiesController/);
assert.match(composer, /usePropertiesNumericDraftController/);
assert.doesNotMatch(composer, /kind:\s*["']set-(?:audio-properties|modifiers|animation)/);
assert.doesNotMatch(composer, /canHandle|registry/);
assert.match(viewComposer, /resolvePropertiesSelectionKind/);

assert.doesNotMatch(numericDraft, /@\/engines\/project|Preview|dispatchPanel|History/);
for (const controller of [visual, audio, modifier]) {
  assert.doesNotMatch(
    controller,
    /controllers\/(?:audioPropertiesController|visualPropertiesController|modifierPropertiesController)/
  );
  assert.doesNotMatch(controller, /audio-effects|useLayerDocumentAudioEffectsEngine/);
}
for (const helper of helperFiles) {
  assert.doesNotMatch(helper, /from ["']react["']|useState|dispatchPanel|\.preview\(/);
}

console.log("Properties type controller split verification passed");
