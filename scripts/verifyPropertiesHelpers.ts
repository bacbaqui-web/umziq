import assert from "node:assert/strict";
import {
  applyLinkedScaleInput,
  applyPositionInput,
  clampPropertiesNumericValue,
  formatPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  hasPropertiesAnchorSemanticChange,
  parsePropertiesNumericDraft,
  roundPropertiesNumericValue,
} from "@/engines/properties/helpers/propertiesNumericHelpers";
import {
  buildPropertiesDraftScope,
  buildPropertiesInfoViewModel,
  buildPropertiesPropertyRows,
  buildPropertiesTransformOriginViewModel,
} from "@/engines/properties/helpers/propertiesViewModelHelpers";
import type { Composition, CompositionMeta } from "@/models";
import { createDefaultModifier } from "@/engines/animation";
import {
  buildPropertiesModifierViewModel,
  getModifierInputDescriptor,
  getModifierInputId,
} from "@/engines/properties/helpers/propertiesModifierHelpers";
import type { PropertiesDraftControllerPort } from "@/engines/properties/models/propertiesInternalModel";

assert.deepEqual(parsePropertiesNumericDraft(""), { kind: "intermediate" });
assert.deepEqual(parsePropertiesNumericDraft("-"), { kind: "intermediate" });
assert.deepEqual(parsePropertiesNumericDraft("."), { kind: "intermediate" });
assert.deepEqual(parsePropertiesNumericDraft("-."), { kind: "intermediate" });
assert.deepEqual(parsePropertiesNumericDraft("12."), { kind: "number", value: 12 });
assert.deepEqual(parsePropertiesNumericDraft("-.5"), { kind: "number", value: -0.5 });
assert.deepEqual(parsePropertiesNumericDraft("1.25"), { kind: "number", value: 1.25 });
assert.deepEqual(parsePropertiesNumericDraft("1e2"), { kind: "invalid" });
assert.deepEqual(parsePropertiesNumericDraft("abc"), { kind: "invalid" });

assert.equal(clampPropertiesNumericValue("scale", -10), 1);
assert.equal(clampPropertiesNumericValue("opacity", -10), 0);
assert.equal(clampPropertiesNumericValue("opacity", 120), 100);
assert.equal(clampPropertiesNumericValue("rotation", 450), 450);
assert.equal(clampPropertiesNumericValue("anchor", -25.5), -25.5);
assert.equal(roundPropertiesNumericValue(1.23456, 3), 1.235);
assert.equal(formatPropertiesNumericValue("position", 1.23456), "1.23456");
assert.equal(formatPropertiesNumericValue("scale", 99.5), "100");
assert.equal(formatPropertiesNumericValue("rotation", 12.345), "12.35");
assert.equal(formatPropertiesNumericValue("opacity", 72.6), "73");
assert.equal(formatPropertiesNumericValue("anchor", 12.75), "12.75");
assert.deepEqual(getPropertiesNumericInputDescriptor("position.x"), {
  property: "position",
  axis: "x",
});
assert.deepEqual(getPropertiesNumericInputDescriptor("anchor.y"), {
  property: "anchor",
  axis: "y",
});
assert.equal(hasPropertiesAnchorSemanticChange(
  { x: 10, y: 20 },
  {
    target: { kind: "layer", id: "layer" },
    anchor: { x: 10, y: 20 },
    transformOffset: { x: 0, y: 0 },
  }
), false);
assert.equal(hasPropertiesAnchorSemanticChange(
  { x: 10, y: 20 },
  {
    target: { kind: "layer", id: "layer" },
    anchor: { x: 15, y: 20 },
    transformOffset: { x: 5, y: 0 },
  }
), true);
assert.equal(hasPropertiesAnchorSemanticChange({ x: 10, y: 20 }, null), false);
assert.deepEqual(applyPositionInput({ x: 10, y: 20 }, "y", -5.5), { x: 10, y: -5.5 });
assert.deepEqual(applyLinkedScaleInput({ x: 100, y: 50 }, "x", 200, false), {
  x: 200,
  y: 50,
});
assert.deepEqual(applyLinkedScaleInput({ x: 100, y: 50 }, "x", 200, true), {
  x: 200,
  y: 100,
});
assert.deepEqual(applyLinkedScaleInput({ x: 25, y: 100 }, "y", 50, true), {
  x: 12.5,
  y: 50,
});

const composition: Composition = {
  id: "comp",
  name: "Composition",
  type: "sub",
  layers: [],
  children: [],
  position: { x: 0, y: 0 },
  positionKeyframes: [],
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: { position: true, scale: false, rotation: false, opacity: true },
  modifiers: [],
};
const meta: CompositionMeta = {
  width: 1080,
  height: 1920,
  layerCount: 0,
  sourceFileName: "source.psd",
  frameRate: 30,
  durationFrames: 75,
};
assert.deepEqual(buildPropertiesInfoViewModel(composition, meta), {
  name: "Composition",
  sourceFileName: "source.psd",
  canvasSize: "1080 x 1920",
  duration: "2.5s",
});
assert.equal(buildPropertiesDraftScope(composition, 12, 2), "comp:12:2");

const rows = buildPropertiesPropertyRows({
  properties: ["position", "scale", "rotation", "opacity"],
  propertyState: composition.enabledProperties,
  values: {
    position: { x: 10, y: 20 },
    scale: { x: 100, y: 50 },
    rotation: 12.345,
    opacity: 80.4,
    anchor: { x: 25, y: 50 },
  },
  editableProperties: { position: true, scale: true, rotation: false, opacity: true },
  scaleLinked: true,
  numericDrafts: { "position.x": "-", "rotation.value": "12." },
  hasKeyframeAtCurrentFrame: (property) => property === "position",
  selectedKeyframe: {
    targetKind: "composition",
    targetId: "comp",
    property: "position",
    frame: 2,
  },
});
assert.equal(rows.length, 4);
assert.deepEqual(rows.map((row) => row.label), ["위치", "크기", "회전", "투명"]);
assert.equal(rows[0].inputs[0].value, "-");
assert.equal(rows[0].hasKeyframeAtCurrentFrame, true);
assert.equal(rows[1].scaleLinked, true);
assert.equal(rows[2].inputs[0].value, "12.");
assert.equal(rows[2].inputs[0].readOnly, true);
assert.equal(rows[3].inputs[0].value, "80");

const transformOrigin = buildPropertiesTransformOriginViewModel({
  values: {
    position: { x: 10, y: 20 },
    scale: { x: 100, y: 50 },
    rotation: 12.345,
    opacity: 80.4,
    anchor: { x: 25.5, y: 50 },
  },
  editable: true,
  numericDrafts: { "anchor.x": "-" },
});
assert.equal(transformOrigin.label, "기준");
assert.equal(transformOrigin.inputs[0].id, "anchor.x");
assert.equal(transformOrigin.inputs[0].value, "-");
assert.equal(transformOrigin.inputs[0].readOnly, false);
assert.equal(transformOrigin.inputs[1].value, "50");
const focusedTransformOrigin = buildPropertiesTransformOriginViewModel({
  values: {
    position: { x: 0, y: 0 },
    scale: { x: 100, y: 100 },
    rotation: 0,
    opacity: 100,
    anchor: { x: 40, y: 5 },
  },
  editable: true,
  numericDrafts: { "anchor.x": "12." },
});
assert.equal(focusedTransformOrigin.inputs[0].value, "12.");
assert.equal(focusedTransformOrigin.inputs[1].value, "5");
assert.equal(buildPropertiesTransformOriginViewModel({
  values: {
    position: { x: 0, y: 0 },
    scale: { x: 100, y: 100 },
    rotation: 0,
    opacity: 100,
    anchor: { x: 540, y: 960 },
  },
  editable: false,
  numericDrafts: {},
}).inputs.every((input) => input.readOnly), true);

const modifierDraft: PropertiesDraftControllerPort = {
  scope: "comp:12:2",
  focusedInputId: null,
  getNumericDraft: (inputId) => inputId === "modifier.wiggle.frequency" ? "2." : undefined,
  hasNumericDraft: () => false,
  focusNumericDraft: () => {},
  setNumericDraft: () => {},
  clearNumericDraft: () => {},
  clearNumericFocus: () => {},
  setPositionDraft: () => {},
  setScaleDraft: () => {},
  setRotationDraft: () => {},
  setOpacityDraft: () => {},
};
const modifierComposition = {
  ...composition,
  modifiers: [{ ...createDefaultModifier("wiggle", composition.id), frequency: 2, amount: 12 }],
};
const modifierView = buildPropertiesModifierViewModel({
  target: { kind: "composition", composition: modifierComposition },
  masterCompId: "master",
  draft: modifierDraft,
});
assert.equal(modifierView.modifiers[0]?.label, "부들부들");
assert.equal(modifierView.modifiers[0]?.fields[0]?.label, "초당 얼마나");
assert.equal(modifierView.modifiers[0]?.fields[0]?.value, "2.");
assert.equal(modifierView.modifiers[0]?.fields[1]?.value, "12");
assert.equal(modifierView.library.visible, true);
assert.equal(modifierView.library.items[0]?.active, true);
assert.equal(getModifierInputId("wiggle", "amount"), "modifier.wiggle.amount");
assert.deepEqual(getModifierInputDescriptor("modifier.wiggle.frequency"), {
  type: "wiggle",
  field: "frequency",
});
assert.equal(buildPropertiesModifierViewModel({
  target: { kind: "composition", composition: modifierComposition },
  masterCompId: composition.id,
  draft: modifierDraft,
}).library.visible, false);

console.log("Properties helper verification passed.");
