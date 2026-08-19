import type {
  LayerModifier,
  ModifierNumberField,
  ModifierType,
} from "@/models";
import type {
  LayerDocumentPropertiesDescriptor,
} from "@/engines/visual/models/layerDocumentPropertiesModel";
import type {
  PropertiesModifierInputId,
} from "@/engines/visual/models/propertiesEngineModel";

export function getModifierInputDescriptor(
  inputId: PropertiesModifierInputId
) {
  const [, type, field] = inputId.split(".") as [
    "modifier",
    ModifierType,
    ModifierNumberField,
  ];
  return { type, field };
}

export function findModifierForInput(
  descriptor: LayerDocumentPropertiesDescriptor,
  inputId: PropertiesModifierInputId
) {
  const { type } = getModifierInputDescriptor(inputId);
  return descriptor.modifiers.find(
    (modifier): modifier is Extract<
      LayerModifier,
      { type: "wiggle" | "swing" | "oscillate" }
    > => (
      modifier.type === "wiggle" ||
      modifier.type === "swing" ||
      modifier.type === "oscillate"
    ) && modifier.type === type
  ) ?? null;
}

export function normalizeModifierNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
