import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPropertiesNumericDraftController,
} from "@/engines/visual/controllers/propertiesNumericDraftController";
import {
  resolvePropertiesSelectionKind,
} from "@/engines/visual/helpers/propertiesSelectionHelpers";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  PropertiesNumericDraftState,
} from "@/engines/visual/models/propertiesNumericDraftModel";

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
assert.equal(draft.syncScope("layer-b:2:1:1:0"), true);
assert.deepEqual(draft.read(), {
  scopeIdentity: "layer-b:2:1:1:0",
  focusedInputId: null,
  inputDrafts: {},
});

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
const engine = source("src/engines/visual/useLayerDocumentVisualEngine.ts");
const composer = source("src/engines/visual/composers/useLayerDocumentPropertiesComposer.ts");
const viewComposer = source("src/engines/visual/composers/propertiesViewPropsComposer.ts");
const numericDraft = source("src/engines/visual/controllers/propertiesNumericDraftController.ts");
const visual = source("src/engines/visual/controllers/visualPropertiesController.ts");
const audio = source("src/engines/audio/useAudioEngine.ts");
const audioBasic = source("src/engines/audio/controllers/useAudioBasicController.ts");
const modifier = source("src/engines/visual/controllers/modifierPropertiesController.ts");
const helperFiles = [
  "modifierPropertiesViewModelHelpers.ts",
  "propertiesDescriptorViewModelHelpers.ts",
  "propertiesSelectionHelpers.ts",
  "visualPropertiesHelpers.ts",
  "visualPropertiesViewModelHelpers.ts",
].map((file) => source(`src/engines/visual/helpers/${file}`));

assert.match(engine, /useLayerDocumentPropertiesComposer\(options\)/);
assert.doesNotMatch(engine, /useState|dispatchPanel|set-audio-properties|set-modifiers/);
assert.doesNotMatch(composer, /createAudioPropertiesController|audioSection/);
assert.match(composer, /useVisualPropertiesController/);
assert.match(composer, /createModifierPropertiesController/);
assert.match(composer, /usePropertiesNumericDraftController/);
assert.doesNotMatch(composer, /kind:\s*["']set-(?:audio-properties|modifiers|animation)/);
assert.doesNotMatch(composer, /canHandle|registry/);
assert.match(viewComposer, /resolvePropertiesSelectionKind/);

assert.doesNotMatch(numericDraft, /@\/engines\/project|Preview|dispatchPanel|History/);
for (const controller of [visual, modifier]) {
  assert.doesNotMatch(
    controller,
    /controllers\/(?:audioPropertiesController|visualPropertiesController|modifierPropertiesController)/
  );
  assert.doesNotMatch(controller, /audio-effects|useLayerDocumentAudioEngine/);
}
assert.match(audio, /basicPort/);
assert.match(audio, /useAudioComposer/);
assert.match(audioBasic, /toggleMuted/);
assert.doesNotMatch(audio, /@\/engines\/visual/);
for (const helper of helperFiles) {
  assert.doesNotMatch(helper, /from ["']react["']|useState|dispatchPanel|\.preview\(/);
}

console.log("Properties type controller split verification passed");
